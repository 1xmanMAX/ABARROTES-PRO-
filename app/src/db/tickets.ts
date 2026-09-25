import type { CartLine } from '../domain/cart';
import { assertCents, type Cents } from '../domain/money';
import { lineAmount } from '../domain/qty';
import { dayKeyOf } from '../domain/time';
import { BusinessError } from './errors';
import { newId } from './ids';
import { db } from './schema';
import type { Ticket, TicketLine } from './types';

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
    const ticket = blankTicket(
      nextTicketLabel(open.map((t) => t.label)),
      tabOrder,
      Date.now(),
    );
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
  | { method: 'cash'; cashReceived: Cents }
  | { method: 'digital'; digitalRef: string | null };

/**
 * Cobra un ticket abierto en una sola transacción: snapshots de líneas,
 * descuento de stock, movimiento de caja y correlativo del día.
 */
export async function checkoutTicket(ticketId: string, payment: Payment, now = Date.now()): Promise<Ticket> {
  if (payment.method === 'cash') assertCents(payment.cashReceived);
  const digitalRef =
    payment.method === 'digital' && payment.digitalRef ? payment.digitalRef.replace(/\D/g, '').slice(-3) || null : null;

  return db.transaction('rw', [db.tickets, db.ticketLines, db.products, db.stockMovements, db.cashMovements], async () => {
    const ticket = await db.tickets.get(ticketId);
    if (!ticket) throw new BusinessError('not_found', 'Ticket no encontrado.');
    if (ticket.status !== 'open') throw new BusinessError('not_open', 'Este ticket ya fue cobrado.');

    const lines = await db.ticketLines.where('ticketId').equals(ticketId).toArray();
    lines.sort((a, b) => a.seq - b.seq);
    if (lines.length === 0) throw new BusinessError('empty', 'El ticket está vacío.');

    const qtyByProduct = new Map<string, number>();
    for (const l of lines) qtyByProduct.set(l.productId, (qtyByProduct.get(l.productId) ?? 0) + l.qty);

    const products = new Map((await db.products.bulkGet([...qtyByProduct.keys()])).filter((p) => !!p).map((p) => [p!.id, p!]));
    for (const [productId, qty] of qtyByProduct) {
      const p = products.get(productId);
      if (!p) throw new BusinessError('not_found', 'Un producto del ticket ya no existe.');
      if (qty <= 0 || !Number.isSafeInteger(qty)) throw new BusinessError('invalid_qty', 'Cantidad inválida.');
      if (p.stock < qty) throw new BusinessError('no_stock', `No hay stock suficiente de ${p.name}.`);
    }

    let subtotal = 0;
    let total = 0;
    const finalLines: TicketLine[] = lines.map((l) => {
      const p = products.get(l.productId)!;
      const unitPrice = l.priceOverride ?? p.salePrice;
      const lineTotal = lineAmount(p, l.qty, unitPrice);
      const costTotal = lineAmount(p, l.qty, p.costPrice);
      subtotal += lineAmount(p, l.qty, p.salePrice);
      total += lineTotal;
      return {
        ...l,
        productName: p.name,
        fractional: p.allowsFraction,
        unitPrice,
        unitCost: p.costPrice,
        lineTotal,
        lineProfit: lineTotal - costTotal,
      };
    });

    if (total <= 0) throw new BusinessError('zero_total', 'El total debe ser mayor a cero.');
    let cashReceived: Cents | null = null;
    let change: Cents | null = null;
    if (payment.method === 'cash') {
      if (payment.cashReceived < total) throw new BusinessError('insufficient_cash', 'El monto recibido no alcanza.');
      cashReceived = payment.cashReceived;
      change = payment.cashReceived - total;
    }

    const dayKey = dayKeyOf(now);
    const lastOfDay = await db.tickets
      .where('[dayKey+number]')
      .between([dayKey, 1], [dayKey, Infinity])
      .last();
    const number = (lastOfDay?.number ?? 0) + 1;

    const closed: Ticket = {
      ...ticket,
      number,
      status: 'paid',
      paymentMethod: payment.method,
      subtotal,
      discount: subtotal - total,
      total,
      cashReceived,
      change,
      digitalRef,
      dayKey,
      closedAt: now,
      updatedAt: now,
    };
    await db.tickets.put(closed);
    await db.ticketLines.bulkPut(finalLines);

    for (const [productId, qty] of qtyByProduct) {
      const p = products.get(productId)!;
      await db.products.update(productId, { stock: p.stock - qty, updatedAt: now });
      await db.stockMovements.add({
        id: newId(),
        productId,
        delta: -qty,
        reason: 'sale',
        refType: 'ticket',
        refId: ticketId,
        note: '',
        createdAt: now,
      });
    }

    await db.cashMovements.add({
      id: newId(),
      type: 'sale',
      method: payment.method,
      amount: total,
      refType: 'ticket',
      refId: ticketId,
      note: `Venta #${String(number).padStart(4, '0')}`,
      dayKey,
      createdAt: now,
      voidedAt: null,
    });

    return closed;
  });
}

/**
 * Anula un ticket cobrado: repone stock, marca anulado el movimiento de caja y
 * deja rastro en auditoría. En Fase 1 solo se anulan tickets del día; los de días
 * anteriores exigirán el código de dueño (Fase 3).
 */
export async function voidTicket(ticketId: string, reason: string, now = Date.now()): Promise<void> {
  const cleanReason = reason.trim();
  if (!cleanReason) throw new BusinessError('reason_required', 'Escribe el motivo de la anulación.');

  await db.transaction(
    'rw',
    [db.tickets, db.ticketLines, db.products, db.stockMovements, db.cashMovements, db.auditLog],
    async () => {
      const ticket = await db.tickets.get(ticketId);
      if (!ticket) throw new BusinessError('not_found', 'Ticket no encontrado.');
      if (ticket.status === 'void') throw new BusinessError('already_void', 'Este ticket ya está anulado.');
      if (ticket.status !== 'paid') throw new BusinessError('not_paid', 'Solo se anulan tickets cobrados.');
      if (ticket.dayKey !== dayKeyOf(now)) {
        throw new BusinessError('owner_pin_required', 'Para anular ventas de días anteriores se necesita el código de dueño.');
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

      await db.tickets.update(ticketId, { status: 'void', voidReason: cleanReason, voidedAt: now, updatedAt: now });
      await db.auditLog.add({
        id: newId(),
        action: 'void_ticket',
        entity: 'ticket',
        entityId: ticketId,
        detail: JSON.stringify({ reason: cleanReason, total: ticket.total, number: ticket.number }),
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
