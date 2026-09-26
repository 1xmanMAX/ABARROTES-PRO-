import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { productReport, summarize } from '../domain/profit';
import { registerExpense, voidExpense } from './cash';
import { setPinIterationsForTests } from './pins';
import { loadExpenseMovements, loadSales, toExpenses } from './reports';
import { db, resetDbForTests } from './schema';
import { seedDemo } from './seed';

beforeAll(() => setPinIterationsForTests(1000));
beforeEach(() => {
  resetDbForTests(`reports-${Math.random()}`);
});

describe('reportes', () => {
  it('ventas de ejemplo: ganancia = venta − costo por línea, y reporte por producto', async () => {
    await seedDemo();
    const sales = await loadSales(null);
    expect(sales).toHaveLength(300);
    const s = summarize(sales, [], 0, 30);
    expect(s.sales).toBeGreaterThan(0);
    expect(s.grossProfit).toBe(sales.reduce((a, t) => a + t.lines.reduce((b, l) => b + l.lineProfit, 0), 0));
    const rows = productReport(sales, await db.products.toArray(), 30);
    expect(rows[0]!.name).toBe('Arroz saco 50kg');
    expect(rows.some((r) => r.verdict === 'star')).toBe(true);
  });

  it('gastos: se registran, se anulan con motivo y no cuentan anulados', async () => {
    const id = await registerExpense(2500, 'transporte', 'cash', 'mototaxi');
    await registerExpense(800, 'bolsas', 'digital');
    await expect(registerExpense(0, 'otros', 'cash')).rejects.toThrow('mayor a cero');
    await voidExpense(id, 'lo registré dos veces');
    const list = await loadExpenseMovements(null);
    expect(list).toHaveLength(2);
    expect(toExpenses(list)).toEqual([expect.objectContaining({ amount: 800, category: 'bolsas' })]);
    const cash = await db.cashMovements.toArray();
    expect(cash.find((m) => m.category === 'bolsas')!.amount).toBe(-800);
  });
});
