import type { Expense, SaleTicket } from '../domain/profit';
import { db } from './schema';
import type { CashMovement } from './types';

/** Ventas cerradas (pagadas y fiadas, no anuladas) desde `fromDayKey` inclusive. */
export async function loadSales(fromDayKey: string | null): Promise<SaleTicket[]> {
  return db.transaction('r', [db.tickets, db.ticketLines], async () => {
    const tickets = await db.tickets
      .where('status')
      .anyOf('paid', 'credit')
      .filter((t) => fromDayKey === null || t.dayKey >= fromDayKey)
      .toArray();
    const lines = await db.ticketLines
      .where('ticketId')
      .anyOf(tickets.map((t) => t.id))
      .toArray();
    const byTicket = new Map<string, SaleTicket['lines']>();
    for (const l of lines) {
      const list = byTicket.get(l.ticketId) ?? [];
      list.push({
        productId: l.productId,
        qty: l.qty,
        fractional: l.fractional,
        lineTotal: l.lineTotal,
        lineProfit: l.lineProfit,
      });
      byTicket.set(l.ticketId, list);
    }
    return tickets.map((t) => ({
      dayKey: t.dayKey,
      closedAt: t.closedAt ?? t.createdAt,
      total: t.total,
      haggle: t.haggle ?? 0,
      lines: byTicket.get(t.id) ?? [],
    }));
  });
}

export async function loadExpenseMovements(fromDayKey: string | null): Promise<CashMovement[]> {
  const list = await db.cashMovements.where('type').equals('expense').toArray();
  return list.filter((m) => fromDayKey === null || m.dayKey >= fromDayKey).sort((a, b) => b.createdAt - a.createdAt);
}

export function toExpenses(list: CashMovement[]): Expense[] {
  return list.filter((m) => !m.voidedAt).map((m) => ({ dayKey: m.dayKey, amount: -m.amount, category: m.category ?? 'otros' }));
}

/** Primer día con ventas (para el periodo "Todo"). */
export async function firstSaleDay(): Promise<string | null> {
  const first = await db.tickets
    .orderBy('closedAt')
    .filter((t) => t.status === 'paid' || t.status === 'credit')
    .first();
  return first?.dayKey ?? null;
}
