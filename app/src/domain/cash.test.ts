import { describe, expect, it } from 'vitest';
import { cashBalance, closeDifference, dayFlow, salesByHour, type CashLike } from './cash';

const m = (
  type: string,
  amount: number,
  method: 'cash' | 'digital' = 'cash',
  dayKey = '2026-09-25',
  voidedAt: number | null = null,
): CashLike => ({
  type,
  amount,
  method,
  dayKey,
  voidedAt,
});

describe('caja', () => {
  const moves = [
    m('opening', 20000),
    m('sale', 47800),
    m('sale', 18500, 'digital'),
    m('debt_payment', 10000),
    m('contribution', 5000),
    m('purchase', -30000),
    m('expense', -2500),
    m('withdrawal', -10000),
    m('sale', 99999, 'cash', '2026-09-25', 5),
    m('sale', 1000, 'cash', '2026-09-24'),
  ];
  it('saldo = inicial + ventas + cobros + aportes − compras − gastos − retiros', () => {
    expect(cashBalance(moves)).toBe(20000 + 47800 + 10000 + 5000 - 30000 - 2500 - 10000 + 1000);
    expect(cashBalance(moves, 'digital')).toBe(18500);
  });
  it('flujo del día', () => {
    const f = dayFlow(moves, '2026-09-25', 'cash');
    expect(f.inflow).toBe(82800);
    expect(f.outflow).toBe(42500);
    expect(f.byType.sale).toBe(47800);
  });
  it('cierre y ventas por hora', () => {
    expect(closeDifference(40000, 39500)).toBe(-500);
    const h = salesByHour([
      { hour: 8, total: 100 },
      { hour: 8, total: 50 },
      { hour: 17, total: 10 },
    ]);
    expect(h[8]).toBe(150);
    expect(h[17]).toBe(10);
    expect(h).toHaveLength(24);
  });
});
