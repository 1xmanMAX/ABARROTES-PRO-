import type { Cents } from './money';

export interface CashLike {
  method: 'cash' | 'digital';
  amount: Cents;
  voidedAt: number | null;
  type: string;
  dayKey: string;
}

/**
 * Saldo de caja (SPEC §11) = saldo inicial + ventas en efectivo + cobros en
 * efectivo + aportes − compras − gastos − retiros (± diferencias de cierre).
 * Como cada movimiento guarda su signo, es la suma de los movimientos no anulados.
 */
export function cashBalance(movements: CashLike[], method: 'cash' | 'digital' = 'cash'): Cents {
  let b = 0;
  for (const m of movements) if (!m.voidedAt && m.method === method) b += m.amount;
  return b;
}

export interface DayFlow {
  inflow: Cents;
  outflow: Cents;
  byType: Record<string, Cents>;
}

/** Entradas y salidas de un día por tipo (solo efectivo o solo digital). */
export function dayFlow(movements: CashLike[], dayKey: string, method: 'cash' | 'digital'): DayFlow {
  const byType: Record<string, Cents> = {};
  let inflow = 0;
  let outflow = 0;
  for (const m of movements) {
    if (m.voidedAt || m.dayKey !== dayKey || m.method !== method) continue;
    byType[m.type] = (byType[m.type] ?? 0) + m.amount;
    if (m.amount >= 0) inflow += m.amount;
    else outflow -= m.amount;
  }
  return { inflow, outflow, byType };
}

/** Diferencia del cierre: contado − esperado (+ sobra, − falta). */
export function closeDifference(expected: Cents, counted: Cents): Cents {
  return counted - expected;
}

/** Ventas por hora del día (0–23) a partir de tickets con su hora. */
export function salesByHour(tickets: { hour: number; total: Cents }[]): Cents[] {
  const out = new Array<Cents>(24).fill(0);
  for (const t of tickets) out[t.hour] = (out[t.hour] ?? 0) + t.total;
  return out;
}
