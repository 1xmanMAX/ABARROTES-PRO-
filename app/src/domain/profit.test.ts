import { describe, expect, it } from 'vitest';
import {
  businessVerdict,
  byDay,
  changePct,
  productReport,
  proratedFixed,
  summarize,
  type ProductInfo,
  type SaleTicket,
} from './profit';

const t = (dayKey: string, lines: [string, number, number, number][], haggle = 0): SaleTicket => ({
  dayKey,
  closedAt: 0,
  haggle,
  total: lines.reduce((a, l) => a + l[2], 0),
  lines: lines.map(([productId, qty, lineTotal, lineProfit]) => ({ productId, qty, fractional: false, lineTotal, lineProfit })),
});

const tickets = [
  t('2026-09-24', [
    ['arroz', 2, 37000, 4000],
    ['aceite', 1, 10800, 1200],
  ]),
  t('2026-09-25', [['arroz', 1, 18200, 1700]], 300),
  t('2026-09-25', [['sal', 1, 3500, -100]]),
];

describe('ganancias', () => {
  it('resumen: ventas, costo, ganancia bruta, gastos y neta', () => {
    const s = summarize(tickets, [{ dayKey: '2026-09-25', amount: 2000, category: 'transporte' }], 30000, 2);
    expect(s).toMatchObject({
      sales: 69500,
      grossProfit: 6800,
      cost: 62700,
      tickets: 3,
      haggle: 300,
      expenses: 2000,
      fixedCosts: 2000,
      netProfit: 2800,
    });
    expect(s.avgTicket).toBe(23167);
    expect(s.grossMarginPct).toBeCloseTo(9.78, 1);
    expect(proratedFixed(30000, 30)).toBe(30000);
  });

  it('serie por día incluye días sin ventas', () => {
    const d = byDay(
      tickets,
      [{ dayKey: '2026-09-25', amount: 500, category: 'x' }],
      ['2026-09-23', '2026-09-24', '2026-09-25'],
      0,
    );
    expect(d.map((x) => x.grossProfit)).toEqual([0, 5200, 1600]);
    expect(d[2]!.netProfit).toBe(1100);
  });

  it('veredicto por producto', () => {
    const products: ProductInfo[] = [
      { id: 'arroz', name: 'Arroz', stock: 10, allowsFraction: false, costPrice: 16500, active: true },
      { id: 'aceite', name: 'Aceite', stock: 400, allowsFraction: false, costPrice: 9600, active: true },
      { id: 'sal', name: 'Sal', stock: 5, allowsFraction: false, costPrice: 3600, active: true },
      { id: 'harina', name: 'Harina', stock: 8, allowsFraction: false, costPrice: 11200, active: true },
      { id: 'nuevo', name: 'Nuevo', stock: 3, allowsFraction: false, costPrice: 0, active: true },
    ];
    const rows = productReport(tickets, products, 2);
    const v = Object.fromEntries(rows.map((r) => [r.productId, r.verdict]));
    expect(v).toEqual({ arroz: 'star', aceite: 'slow', sal: 'loss', harina: 'no_sales', nuevo: 'no_cost' });
    expect(rows[0]!.productId).toBe('arroz');
    const harina = rows.find((r) => r.productId === 'harina')!;
    expect(harina.stockValue).toBe(89600);
    const aceite = rows.find((r) => r.productId === 'aceite')!;
    expect(aceite.daysOfStock).toBe(800);
  });

  it('veredicto del negocio y variación', () => {
    const s = summarize(tickets, [], 0, 2);
    expect(businessVerdict(s, false)).toBe('missing_expenses');
    expect(businessVerdict(s, true)).toBe('profitable');
    expect(businessVerdict(summarize(tickets, [], 1_000_000, 30), true)).toBe('losing');
    expect(businessVerdict(summarize([], [], 0, 1), true)).toBe('no_data');
    expect(changePct(1500, 1000)).toBe(50);
    expect(changePct(1500, 0)).toBeNull();
  });
});
