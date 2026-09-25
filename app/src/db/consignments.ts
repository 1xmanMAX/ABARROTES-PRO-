import { pendingQty, previewSettlement } from '../domain/consignment';
import { assertCents, formatPEN, type Cents } from '../domain/money';
import { lineAmount } from '../domain/qty';
import { dayKeyOf } from '../domain/time';
import { BusinessError } from './errors';
import { newId } from './ids';
import { verifyPartyPin } from './pins';
import { db } from './schema';
import { prepareSignature } from './signatures';
import { applyTicketStats } from './stats';
import type { Consignment, ConsignmentLine, Signature, Ticket, TicketLine } from './types';

export interface DeliveryLineInput {
  productId: string;
  qty: number;
  agreedPrice: Cents;
}

/**
 * Entregar mercadería a un vendedor (SPEC §8.1). El vendedor firma con su código
 * (verificado ANTES de la transacción). El stock sale de la tienda como "en
 * consignación"; no nace deuda hasta liquidar.
 */
export async function deliverConsignment(
  partyId: string,
  input: DeliveryLineInput[],
  dueDate: number,
  pinAttempt: string,
  now = Date.now(),
): Promise<Signature> {
  const party = await db.parties.get(partyId);
  if (!party || !party.active) throw new BusinessError('not_found', 'Vendedor no encontrado.');
  if (!party.roles.includes('seller')) throw new BusinessError('not_seller', 'Esta persona no está marcada como vendedor.');
  const lines = input.filter((l) => l.qty > 0);
  if (lines.length === 0) throw new BusinessError('empty', 'Agrega al menos un producto.');
  if (new Set(lines.map((l) => l.productId)).size !== lines.length) throw new BusinessError('dup', 'Producto repetido.');

  const products = await db.products.bulkGet(lines.map((l) => l.productId));
  let deliveredValue = 0;
  const sigLines = lines.map((l, i) => {
    const p = products[i];
    if (!p) throw new BusinessError('not_found', 'Un producto ya no existe.');
    assertCents(l.agreedPrice);
    if (!Number.isSafeInteger(l.qty) || l.qty <= 0) throw new BusinessError('invalid_qty', 'Cantidad inválida.');
    if (l.agreedPrice <= 0) throw new BusinessError('invalid_price', `Pon el precio pactado de ${p.name}.`);
    if (p.stock < l.qty) throw new BusinessError('no_stock', `No hay stock suficiente de ${p.name}.`);
    const amount = lineAmount(p, l.qty, l.agreedPrice);
    deliveredValue += amount;
    return { name: p.name, qty: l.qty, amount };
  });

  await verifyPartyPin(partyId, pinAttempt, now);
  const consignmentId = newId();
  const signature = await prepareSignature({
    partyId,
    partyName: party.name,
    purpose: 'consignment_receipt',
    amount: deliveredValue,
    concept: 'Recibe mercadería',
    lines: sigLines,
    previousBalance: party.balance,
    newBalance: party.balance,
    refType: 'consignment',
    refId: consignmentId,
    createdAt: now,
  });

  await db.transaction(
    'rw',
    [db.products, db.stockMovements, db.consignments, db.consignmentLines, db.signatures, db.parties],
    async () => {
      const specialPrices = { ...(await db.parties.get(partyId))!.specialPrices };
      for (const l of lines) {
        const p = (await db.products.get(l.productId))!;
        if (p.stock < l.qty) throw new BusinessError('no_stock', `No hay stock suficiente de ${p.name}.`);
        await db.products.update(p.id, { stock: p.stock - l.qty, consignedQty: p.consignedQty + l.qty, updatedAt: now });
        await db.stockMovements.add({
          id: newId(),
          productId: p.id,
          delta: -l.qty,
          reason: 'consign_out',
          refType: 'consignment',
          refId: consignmentId,
          note: party.name,
          createdAt: now,
        });
        await db.consignmentLines.add({
          id: newId(),
          consignmentId,
          productId: p.id,
          productName: p.name,
          fractional: p.allowsFraction,
          qtyDelivered: l.qty,
          qtyReturned: 0,
          qtySold: 0,
          agreedPrice: l.agreedPrice,
          unitCost: p.costPrice,
        });
        // Recordar el precio pactado para la próxima entrega.
        specialPrices[p.id] = l.agreedPrice;
      }
      await db.consignments.add({
        id: consignmentId,
        partyId,
        partyName: party.name,
        status: 'open',
        dueDate,
        deliveredValue,
        signatureId: signature.id,
        createdAt: now,
        updatedAt: now,
        settledAt: null,
      });
      await db.signatures.add(signature);
      await db.parties.update(partyId, { specialPrices, lastUsedAt: now, updatedAt: now });
    },
  );
  return signature;
}

export interface OpenConsignment {
  consignment: Consignment;
  lines: ConsignmentLine[];
}

export async function getOpenConsignments(partyId?: string): Promise<OpenConsignment[]> {
  const open = await db.consignments.where('status').equals('open').toArray();
  const mine = open.filter((c) => !partyId || c.partyId === partyId).sort((a, b) => a.createdAt - b.createdAt);
  const lines = await db.consignmentLines
    .where('consignmentId')
    .anyOf(mine.map((c) => c.id))
    .toArray();
  return mine.map((c) => ({ consignment: c, lines: lines.filter((l) => l.consignmentId === c.id) }));
}

/**
 * Liquidar (SPEC §8.2). Lo devuelto vuelve al stock; lo vendido se registra como
 * venta (cuenta en estadísticas y ganancia, a precio pactado y costo de la
 * entrega), se carga a su cuenta, se abona lo pagado y entra a caja. El vendedor
 * firma con su código. Todo en una transacción.
 */
export async function settleConsignments(
  partyId: string,
  consignmentIds: string[],
  returns: Record<string, number>,
  paidNow: Cents,
  method: 'cash' | 'digital',
  pinAttempt: string,
  now = Date.now(),
): Promise<Signature> {
  assertCents(paidNow);
  if (paidNow < 0) throw new BusinessError('invalid_amount', 'El pago no puede ser negativo.');
  const party = await db.parties.get(partyId);
  if (!party) throw new BusinessError('not_found', 'Vendedor no encontrado.');
  const open = (await getOpenConsignments(partyId)).filter((o) => consignmentIds.includes(o.consignment.id));
  if (open.length === 0) throw new BusinessError('empty', 'Elige al menos una entrega abierta.');
  const allLines = open.flatMap((o) => o.lines).filter((l) => pendingQty(l) > 0);
  let preview;
  try {
    preview = previewSettlement(allLines, returns, party.balance);
  } catch (err) {
    throw new BusinessError('invalid_return', err instanceof Error ? err.message : 'Devolución inválida.');
  }
  if (paidNow > preview.totalDue) throw new BusinessError('over_total', `No puede pagar más de ${formatPEN(preview.totalDue)}.`);

  await verifyPartyPin(partyId, pinAttempt, now);
  const settlementId = newId();
  const byLine = new Map(allLines.map((l) => [l.id, l]));
  const signature = await prepareSignature({
    partyId,
    partyName: party.name,
    purpose: 'settlement',
    amount: paidNow,
    concept: 'Liquidación de mercadería',
    lines: preview.lines
      .filter((x) => x.sold > 0)
      .map((x) => ({ name: byLine.get(x.lineId)!.productName, qty: x.sold, amount: x.lineTotal })),
    previousBalance: preview.totalDue,
    newBalance: preview.totalDue - paidNow,
    refType: 'settlement',
    refId: settlementId,
    createdAt: now,
  });

  await db.transaction(
    'rw',
    [
      db.parties,
      db.products,
      db.stockMovements,
      db.consignments,
      db.consignmentLines,
      db.settlements,
      db.settlementLines,
      db.ledgerEntries,
      db.cashMovements,
      db.signatures,
      db.tickets,
      db.ticketLines,
      db.productStats,
      db.pairStats,
    ],
    async () => {
      const p = await db.parties.get(partyId);
      if (!p || p.balance !== party.balance) throw new BusinessError('changed', 'El saldo cambió. Vuelve a firmar.');
      const ticketId = preview.soldValue > 0 ? newId() : null;
      const ticketLines: TicketLine[] = [];
      let seq = 0;
      for (const x of preview.lines) {
        const line = (await db.consignmentLines.get(x.lineId))!;
        if (pendingQty(line) !== x.pending) throw new BusinessError('changed', 'La entrega cambió. Vuelve a firmar.');
        await db.consignmentLines.update(line.id, { qtyReturned: line.qtyReturned + x.returned, qtySold: line.qtySold + x.sold });
        const prod = await db.products.get(line.productId);
        if (prod) {
          await db.products.update(prod.id, {
            stock: prod.stock + x.returned,
            consignedQty: Math.max(0, prod.consignedQty - x.returned - x.sold),
            updatedAt: now,
          });
        }
        if (x.returned > 0) {
          await db.stockMovements.add({
            id: newId(),
            productId: line.productId,
            delta: x.returned,
            reason: 'consign_return',
            refType: 'settlement',
            refId: settlementId,
            note: party.name,
            createdAt: now,
          });
        }
        await db.settlementLines.add({
          id: newId(),
          settlementId,
          consignmentLineId: line.id,
          productId: line.productId,
          qtyReturned: x.returned,
          qtySold: x.sold,
          agreedPrice: line.agreedPrice,
          lineTotal: x.lineTotal,
        });
        if (ticketId && x.sold > 0) {
          const cost = lineAmount({ allowsFraction: line.fractional }, x.sold, line.unitCost);
          ticketLines.push({
            id: newId(),
            ticketId,
            productId: line.productId,
            seq: seq++,
            qty: x.sold,
            priceOverride: null,
            priceOverrideReason: null,
            productName: line.productName,
            fractional: line.fractional,
            unitPrice: line.agreedPrice,
            unitCost: line.unitCost,
            lineTotal: x.lineTotal,
            lineProfit: x.lineTotal - cost,
            lineDiscount: 0,
          });
        }
      }
      for (const o of open) await db.consignments.update(o.consignment.id, { status: 'settled', settledAt: now, updatedAt: now });

      if (ticketId) {
        const dayKey = dayKeyOf(now);
        const lastOfDay = await db.tickets.where('[dayKey+number]').between([dayKey, 1], [dayKey, Infinity]).last();
        const ticket: Ticket = {
          id: ticketId,
          number: (lastOfDay?.number ?? 0) + 1,
          label: `Liquidación · ${party.name}`,
          status: 'credit',
          paymentMethod: 'credit',
          partyId,
          partyName: party.name,
          subtotal: preview.soldValue,
          discount: 0,
          haggle: 0,
          total: preview.soldValue,
          cashReceived: null,
          change: null,
          digitalRef: null,
          signatureId: signature.id,
          dayKey,
          closedAt: now,
          voidReason: null,
          voidedAt: null,
          tabOrder: 0,
          createdAt: now,
          updatedAt: now,
          settlementId,
        };
        await db.tickets.add(ticket);
        await db.ticketLines.bulkAdd(ticketLines);
        await applyTicketStats(ticketLines, { kind: 'add', at: now });
        await db.ledgerEntries.add({
          id: newId(),
          partyId,
          type: 'charge',
          amount: preview.soldValue,
          method: null,
          sourceType: 'settlement',
          sourceId: settlementId,
          signatureId: signature.id,
          note: 'Vendió mercadería en consignación',
          createdAt: now,
          voidedAt: null,
        });
      }
      if (paidNow > 0) {
        await db.ledgerEntries.add({
          id: newId(),
          partyId,
          type: 'payment',
          amount: paidNow,
          method,
          sourceType: 'settlement',
          sourceId: settlementId,
          signatureId: signature.id,
          note: `Pago en liquidación ${method === 'cash' ? '(efectivo)' : '(Yape/Plin)'}`,
          createdAt: now + 1,
          voidedAt: null,
        });
        await db.cashMovements.add({
          id: newId(),
          type: 'settlement_payment',
          method,
          amount: paidNow,
          refType: 'settlement',
          refId: settlementId,
          note: `Liquidación · ${party.name}`,
          dayKey: dayKeyOf(now),
          createdAt: now,
          voidedAt: null,
        });
      }
      await db.settlements.add({
        id: settlementId,
        partyId,
        consignmentIds: open.map((o) => o.consignment.id),
        soldValue: preview.soldValue,
        previousBalance: party.balance,
        paidNow,
        method,
        newBalance: preview.totalDue - paidNow,
        signatureId: signature.id,
        ticketId,
        createdAt: now,
      });
      await db.signatures.add(signature);
      await db.parties.update(partyId, { balance: preview.totalDue - paidNow, lastUsedAt: now, updatedAt: now });
    },
  );
  return signature;
}
