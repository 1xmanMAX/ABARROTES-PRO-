import type { CartLine } from '../domain/cart';
import { distributeDiscount } from '../domain/haggle';
import { assertCents, formatPEN, type Cents } from '../domain/money';
import { lineAmount } from '../domain/qty';
import { dayKeyOf } from '../domain/time';
import { BusinessError } from './errors';
import { newId } from './ids';
import { db } from './schema';
import { getSettings } from './settings';
import { verifyOwnerPin, verifyPartyPin } from './pins';
import { prepareSignature } from './signatures';
import { checkCredit } from '../domain/balances';
import { applyTicketStats } from './stats';
import type { Product, Signature, Ticket, TicketLine } from './types';

export const MAX_OPEN_TICKETS = 6;

export interface OpenTicketData {
  ticket: Ticket;
  lines: CartLine[];
}

function blankTicket(label: string, tabOrder: number, now: number): Ticket {
  return {
    id: newId(),
    number: 0,
    label,
    status: 'open',
    paymentMethod: null,
    partyId: null,
    subtotal: 0,
    discount: 0,
    total: 0,
    cashReceived: null,
    change: null,
    digitalRef: null,
    signatureId: null,
    dayKey: dayKeyOf(now),
    closedAt: null,
    voidReason: null,
    voidedAt: null,
    tabOrder,
    createdAt: now,
    updatedAt: now,
  };
}

/** "Cliente N" con el menor N libre entre los tickets abiertos. */
export function nextTicketLabel(existing: string[]): string {
  for (let n = 1; ; n++) {
    const label = `Cliente ${n}`;
    if (!existing.includes(label)) return label;
  }
}

export async function loadOpenTickets(): Promise<OpenTicketData[]> {
  return db.transaction('r', [db.tickets, db.ticketLines], async () => {
    const tickets = await db.tickets.where('status').equals('open').toArray();
    tickets.sort((a, b) => a.tabOrder - b.tabOrder || a.createdAt - b.createdAt);
    const out: OpenTicketData[] = [];
    for (const ticket of tickets) {
      const lines = await db.ticketLines.where('ticketId').equals(ticket.id).toArray();
      lines.sort((a, b) => a.seq - b.seq);
      out.push({
        ticket,
        lines: lines.map((l) => ({
          productId: l.productId,
          qty: l.qty,
          priceOverride: l.priceOverride,
          priceOverrideReason: l.priceOverrideReason,
        })),
      });
    }
    return out;
  });
}

export async function openTicket(): Promise<Ticket> {
  return db.transaction('rw', db.tickets, async () => {
    const open = await db.tickets.where('status').equals('open').toArray();
    if (open.length >= MAX_OPEN_TICKETS) {
      throw new BusinessError('too_many_tickets', `Máximo ${MAX_OPEN_TICKETS} clientes en espera.`);
    }
    const tabOrder = open.reduce((m, t) => Math.max(m, t.tabOrder), -1) + 1;
    const ticket = blankTicket(nextTicketLabel(open.map((t) => t.label)), tabOrder, Date.now());
    await db.tickets.add(ticket);
    return ticket;
  });
}

export async function renameTicket(ticketId: string, label: string): Promise<void> {
  const clean = label.trim().slice(0, 40);
  if (!clean) throw new BusinessError('label_required', 'Escribe un nombre.');
  await db.tickets.update(ticketId, { label: clean, updatedAt: Date.now() });
}

/**
 * Guarda el borrador de un ticket abierto (reemplaza sus líneas).
 * Los borradores sí se borran físicamente (CLAUDE.md regla 4).
 */
export async function saveOpenTicketLines(ticketId: string, lines: CartLine[]): Promise<void> {
  await db.transaction('rw', [db.tickets, db.ticketLines], async () => {
    const ticket = await db.tickets.get(ticketId);
    if (!ticket || ticket.status !== 'open') return; // ya se cobró o anuló
    await db.ticketLines.where('ticketId').equals(ticketId).delete();
    await db.ticketLines.bulkAdd(
      lines.map((l, seq) => ({
        id: newId(),
        ticketId,
        productId: l.productId,
        seq,
        qty: l.qty,
        priceOverride: l.priceOverride,
        priceOverrideReason: l.priceOverrideReason,
        productName: '',
        fractional: false,
        unitPrice: 0,
        unitCost: 0,
        lineTotal: 0,
        lineProfit: 0,
      })),
    );
    await db.tickets.update(ticketId, { updatedAt: Date.now() });
  });
}

/** Cierra una pestaña vacía (no se guarda como venta). */
export async function discardEmptyTicket(ticketId: string): Promise<void> {
  await db.transaction('rw', [db.tickets, db.ticketLines], async () => {
    const ticket = await db.tickets.get(ticketId);
    if (!ticket || ticket.status !== 'open') return;
    const count = await db.ticketLines.where('ticketId').equals(ticketId).count();
    if (count > 0) throw new BusinessError('not_empty', 'El ticket tiene productos.');
    await db.tickets.delete(ticketId);
  });
}

export type Payment =
  | { method: 'cash'; cashReceived: Cents; haggle?: Cents }
  | { method: 'digital'; digitalRef: string | null; haggle?: Cents };

interface CloseComputation {
  lines: TicketLine[];
  qtyByProduct: Map<string, number>;
  products: Map<string, Product>;
  subtotal: Cents;
  total: Cents;
}

/**
 * Calcula el cierre de un ticket abierto: valida stock, toma snapshots y reparte
 * la rebaja. Lee la BD pero no escribe; se usa dentro de la transacción y
 * también antes de ella (para preparar la firma del fiado).
 */
async function computeClose(ticketId: string, haggle: Cents): Promise<{ ticket: Ticket; close: CloseComputation }> {
  const ticket = await db.tickets.get(ticketId);
  if (!ticket) throw new BusinessError('not_found', 'Ticket no encontrado.');
  if (ticket.status !== 'open') throw new BusinessError('not_open', 'Este ticket ya fue cobrado.');
  const maxHaggle = (await getSettings()).maxHaggle;
  if (!Number.isSafeInteger(haggle) || haggle < 0 || haggle > maxHaggle) {
    throw new BusinessError('haggle_limit', `La rebaja máxima es ${formatPEN(maxHaggle)}.`);
  }

  const lines = await db.ticketLines.where('ticketId').equals(ticketId).toArray();
  lines.sort((a, b) => a.seq - b.seq);
  if (lines.length === 0) throw new BusinessError('empty', 'El ticket está vacío.');

  const qtyByProduct = new Map<string, number>();
  for (const l of lines) qtyByProduct.set(l.productId, (qtyByProduct.get(l.productId) ?? 0) + l.qty);

  const products = new Map(
    (await db.products.bulkGet([...qtyByProduct.keys()])).filter((p): p is Product => !!p).map((p) => [p.id, p]),
  );
  for (const [productId, qty] of qtyByProduct) {
    const p = products.get(productId);
    if (!p) throw new BusinessError('not_found', 'Un producto del ticket ya no existe.');
    if (qty <= 0 || !Number.isSafeInteger(qty)) throw new BusinessError('invalid_qty', 'Cantidad inválida.');
    if (p.stock < qty) throw new BusinessError('no_stock', `No hay stock suficiente de ${p.name}.`);
  }

  const gross = lines.map((l) => {
    const p = products.get(l.productId)!;
    return { lineTotal: lineAmount(p, l.qty, l.priceOverride ?? p.salePrice), eligible: !!p.allowsHaggle };
  });
  if (haggle > 0) {
    const eligibleTotal = gross.reduce((a, g) => a + (g.eligible ? g.lineTotal : 0), 0);
    if (haggle >= eligibleTotal) throw new BusinessError('haggle_not_allowed', 'Ningún producto del ticket admite esa rebaja.');
  }
  const shares = distributeDiscount(gross, haggle);
  let subtotal = 0;
  let total = 0;
  const finalLines: TicketLine[] = lines.map((l, i) => {
    const p = products.get(l.productId)!;
    const unitPrice = l.priceOverride ?? p.salePrice;
    const lineDiscount = shares[i]!;
    const lineTotal = gross[i]!.lineTotal - lineDiscount;
    subtotal += lineAmount(p, l.qty, p.salePrice);
    total += lineTotal;
    return {
      ...l,
      productName: p.name,
      fractional: p.allowsFraction,
      unitPrice,
      unitCost: p.costPrice,
      lineTotal,
      lineProfit: lineTotal - lineAmount(p, l.qty, p.costPrice),
      lineDiscount,
    };
  });
  if (total <= 0) throw new BusinessError('zero_total', 'El total debe ser mayor a cero.');
  return { ticket, close: { lines: finalLines, qtyByProduct, products, subtotal, total } };
}

/** Escribe el cierre: ticket, líneas, stock, movimientos y estadísticas. */
async function writeClose(ticket: Ticket, close: CloseComputation, patch: Partial<Ticket>, now: number): Promise<Ticket> {
  const dayKey = dayKeyOf(now);
  const lastOfDay = await db.tickets.where('[dayKey+number]').between([dayKey, 1], [dayKey, Infinity]).last();
  const number = (lastOfDay?.number ?? 0) + 1;
  const closed: Ticket = {
    ...ticket,
    ...patch,
    number,
    subtotal: close.subtotal,
    discount: close.subtotal - close.total,
    total: close.total,
    dayKey,
    closedAt: now,
    updatedAt: now,
  };
  await db.tickets.put(closed);
  await db.ticketLines.bulkPut(close.lines);
  for (const [productId, qty] of close.qtyByProduct) {
    const p = close.products.get(productId)!;
    await db.products.update(productId, { stock: p.stock - qty, updatedAt: now });
    await db.stockMovements.add({
      id: newId(),
      productId,
      delta: -qty,
      reason: 'sale',
      refType: 'ticket',
      refId: ticket.id,
      note: '',
      createdAt: now,
    });
  }
  await applyTicketStats(close.lines, { kind: 'add', at: now });
  return closed;
}

const CLOSE_TABLES = () => [
  db.tickets,
  db.ticketLines,
  db.products,
  db.stockMovements,
  db.cashMovements,
  db.productStats,
  db.pairStats,
  db.settings,
];

/**
 * Cobra un ticket abierto en una sola transacción: snapshots de líneas,
 * descuento de stock, movimiento de caja, estadísticas y correlativo del día.
 */
export async function checkoutTicket(ticketId: string, payment: Payment, now = Date.now()): Promise<Ticket> {
  if (payment.method === 'cash') assertCents(payment.cashReceived);
  const digitalRef =
    payment.method === 'digital' && payment.digitalRef ? payment.digitalRef.replace(/\D/g, '').slice(-3) || null : null;

  return db.transaction('rw', CLOSE_TABLES(), async () => {
    const { ticket, close } = await computeClose(ticketId, payment.haggle ?? 0);
    let cashReceived: Cents | null = null;
    let change: Cents | null = null;
    if (payment.method === 'cash') {
      if (payment.cashReceived < close.total) throw new BusinessError('insufficient_cash', 'El monto recibido no alcanza.');
      cashReceived = payment.cashReceived;
      change = payment.cashReceived - close.total;
    }
    const closed = await writeClose(
      ticket,
      close,
      { status: 'paid', paymentMethod: payment.method, haggle: payment.haggle ?? 0, cashReceived, change, digitalRef },
      now,
    );
    await db.cashMovements.add({
      id: newId(),
      type: 'sale',
      method: payment.method,
      amount: closed.total,
      refType: 'ticket',
      refId: ticketId,
      note: `Venta #${String(closed.number).padStart(4, '0')}`,
      dayKey: closed.dayKey,
      createdAt: now,
      voidedAt: null,
    });
    return closed;
  });
}

/** Total que tendría el ticket al cerrarse (para mostrar el nuevo saldo antes de firmar). */
export async function previewTicketTotal(ticketId: string, haggle = 0): Promise<Cents> {
  return db.transaction(
    'r',
    [db.tickets, db.ticketLines, db.products, db.settings],
    async () => (await computeClose(ticketId, haggle)).close.total,
  );
}

/**
 * Venta al fiado (SPEC §6). La persona firma con su código y, si el nuevo saldo
 * pasa su límite, el dueño autoriza con el suyo. Ambos códigos se verifican
 * ANTES de la transacción. El fiado no entra a Caja.
 */
export async function checkoutOnCredit(
  ticketId: string,
  partyId: string,
  pinAttempt: string,
  opts: { ownerPin?: string; haggle?: Cents } = {},
  now = Date.now(),
): Promise<{ ticket: Ticket; signature: Signature }> {
  const haggle = opts.haggle ?? 0;
  const party = await db.parties.get(partyId);
  if (!party || !party.active) throw new BusinessError('not_found', 'Persona no encontrada.');
  const { close } = await db.transaction('r', [db.tickets, db.ticketLines, db.products, db.settings], () =>
    computeClose(ticketId, haggle),
  );
  const credit = checkCredit(party.balance, party.creditLimit, close.total);
  let ownerAuthorized = false;
  if (credit.overLimit) {
    if (!opts.ownerPin) throw new BusinessError('over_limit', 'Pasa el límite de crédito: se necesita el código de dueño.');
    await verifyOwnerPin(opts.ownerPin, now);
    ownerAuthorized = true;
  }
  await verifyPartyPin(partyId, pinAttempt, now);

  const signature = await prepareSignature({
    partyId,
    partyName: party.name,
    purpose: 'credit_sale',
    amount: close.total,
    concept: 'Venta al fiado',
    lines: close.lines.map((l) => ({ name: l.productName, qty: l.qty, amount: l.lineTotal })),
    previousBalance: party.balance,
    newBalance: credit.newBalance,
    refType: 'ticket',
    refId: ticketId,
    createdAt: now,
  });

  const ticket = await db.transaction(
    'rw',
    [...CLOSE_TABLES(), db.parties, db.ledgerEntries, db.signatures, db.auditLog],
    async () => {
      const { ticket: open, close: again } = await computeClose(ticketId, haggle);
      const p = await db.parties.get(partyId);
      if (again.total !== signature.amount || !p || p.balance !== signature.previousBalance) {
        throw new BusinessError('changed', 'El ticket o el saldo cambió. Vuelve a firmar.');
      }
      const closed = await writeClose(
        open,
        again,
        {
          status: 'credit',
          paymentMethod: 'credit',
          partyId,
          partyName: p.name,
          signatureId: signature.id,
          haggle,
          cashReceived: null,
          change: null,
          digitalRef: null,
        },
        now,
      );
      await db.signatures.add(signature);
      await db.ledgerEntries.add({
        id: newId(),
        partyId,
        type: 'charge',
        amount: closed.total,
        method: null,
        sourceType: 'ticket',
        sourceId: ticketId,
        signatureId: signature.id,
        note: `Fiado · ticket #${String(closed.number).padStart(4, '0')}`,
        createdAt: now,
        voidedAt: null,
      });
      await db.parties.update(partyId, { balance: signature.newBalance, lastUsedAt: now, updatedAt: now });
      if (ownerAuthorized) {
        await db.auditLog.add({
          id: newId(),
          action: 'credit_limit_override',
          entity: 'party',
          entityId: partyId,
          detail: `Dueño autorizó fiado sobre el límite (${formatPEN(credit.excess)} de más)`,
          createdAt: now,
        });
      }
      return closed;
    },
  );
  return { ticket, signature };
}

/**
 * Anula un ticket cobrado o fiado: repone stock, anula el movimiento de caja o el
 * cargo del fiado y deja rastro. Los de días anteriores exigen el código de dueño.
 */
export async function voidTicket(ticketId: string, reason: string, ownerPin?: string, now = Date.now()): Promise<void> {
  const cleanReason = reason.trim();
  if (!cleanReason) throw new BusinessError('reason_required', 'Escribe el motivo de la anulación.');
  const pre = await db.tickets.get(ticketId);
  if (pre && pre.dayKey !== dayKeyOf(now)) {
    if (!ownerPin)
      throw new BusinessError('owner_pin_required', 'Para anular ventas de días anteriores se necesita el código de dueño.');
    await verifyOwnerPin(ownerPin, now);
  }

  await db.transaction(
    'rw',
    [
      db.tickets,
      db.ticketLines,
      db.products,
      db.stockMovements,
      db.cashMovements,
      db.auditLog,
      db.productStats,
      db.pairStats,
      db.ledgerEntries,
      db.parties,
    ],
    async () => {
      const ticket = await db.tickets.get(ticketId);
      if (!ticket) throw new BusinessError('not_found', 'Ticket no encontrado.');
      if (ticket.status === 'void') throw new BusinessError('already_void', 'Este ticket ya está anulado.');
      if (ticket.status !== 'paid' && ticket.status !== 'credit')
        throw new BusinessError('not_paid', 'Solo se anulan tickets cobrados.');
      if (ticket.settlementId) {
        throw new BusinessError('settlement', 'Es la venta de una liquidación de vendedor: no se anula desde aquí.');
      }

      const lines = await db.ticketLines.where('ticketId').equals(ticketId).toArray();
      for (const l of lines) {
        const p = await db.products.get(l.productId);
        if (p) await db.products.update(p.id, { stock: p.stock + l.qty, updatedAt: now });
        await db.stockMovements.add({
          id: newId(),
          productId: l.productId,
          delta: l.qty,
          reason: 'sale_void',
          refType: 'ticket',
          refId: ticketId,
          note: cleanReason,
          createdAt: now,
        });
      }

      await db.cashMovements
        .where('[refType+refId]')
        .equals(['ticket', ticketId])
        .modify((m) => {
          if (m.voidedAt == null) m.voidedAt = now;
        });

      if (ticket.status === 'credit' && ticket.partyId) {
        const charges = await db.ledgerEntries.where('[sourceType+sourceId]').equals(['ticket', ticketId]).toArray();
        let reversed = 0;
        for (const c of charges) {
          if (c.voidedAt) continue;
          reversed += c.amount;
          await db.ledgerEntries.update(c.id, { voidedAt: now });
        }
        const party = await db.parties.get(ticket.partyId);
        if (party) await db.parties.update(party.id, { balance: party.balance - reversed, updatedAt: now });
      }

      await applyTicketStats(lines, { kind: 'remove', soldAt: ticket.closedAt ?? ticket.createdAt, now });
      await db.tickets.update(ticketId, { status: 'void', voidReason: cleanReason, voidedAt: now, updatedAt: now });
      await db.auditLog.add({
        id: newId(),
        action: 'void_ticket',
        entity: 'ticket',
        entityId: ticketId,
        detail: JSON.stringify({ reason: cleanReason, total: ticket.total, number: ticket.number, owner: !!ownerPin }),
        createdAt: now,
      });
    },
  );
}

export async function getTicketWithLines(ticketId: string): Promise<{ ticket: Ticket; lines: TicketLine[] } | null> {
  const ticket = await db.tickets.get(ticketId);
  if (!ticket) return null;
  const lines = await db.ticketLines.where('ticketId').equals(ticketId).toArray();
  lines.sort((a, b) => a.seq - b.seq);
  return { ticket, lines };
}
