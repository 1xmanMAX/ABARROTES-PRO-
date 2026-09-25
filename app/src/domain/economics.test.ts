import { describe, expect, it } from 'vitest';
import { abcClassify, bcgMatrix, breakEven, gmroi, inventoryTurnover } from './economics';

describe('punto de equilibrio', () => {
  it('ventas de equilibrio = costos fijos / razón de margen de contribución', () => {
    // 30 días, vendió S/ 30,000 con ganancia bruta S/ 3,000 (10 %), fijos S/ 1,500.
    const be = breakEven(3_000_000, 300_000, 150_000, 30);
    expect(be.contributionRatio).toBeCloseTo(0.1);
    expect(be.breakEvenSales).toBe(1_500_000);
    expect(be.breakEvenDaily).toBe(50_000);
    expect(be.actualDaily).toBe(100_000);
    expect(be.safetyMargin).toBeCloseTo(0.5);
  });
  it('sin margen no hay equilibrio posible', () => {
    expect(breakEven(100_000, 0, 5000, 1).breakEvenSales).toBeNull();
  });
});

describe('Pareto / ABC', () => {
  it('A hasta el 80 % acumulado, B hasta el 95 %, C el resto', () => {
    const r = abcClassify([
      { id: 'c', value: 50 },
      { id: 'a', value: 600 },
      { id: 'b', value: 250 },
      { id: 'd', value: 60 },
      { id: 'e', value: 40 },
      { id: 'x', value: -10 },
    ]);
    expect(r.map((i) => [i.id, i.cls])).toEqual([
      ['a', 'A'],
      ['b', 'A'],
      ['d', 'B'],
      ['c', 'B'],
      ['e', 'C'],
      ['x', 'C'],
    ]);
    expect(r[1]!.cumulativePct).toBeCloseTo(85);
  });
});

describe('matriz BCG', () => {
  it('estrella, vaca lechera, interrogante y perro', () => {
    const { points, shareThreshold } = bcgMatrix([
      { id: 'star', profit: 500, sales: 1200, prevSales: 1000 },
      { id: 'cow', profit: 400, sales: 900, prevSales: 1000 },
      { id: 'q', profit: 50, sales: 300, prevSales: 100 },
      { id: 'dog', profit: 50, sales: 100, prevSales: 400 },
      { id: 'nuevo', profit: 0, sales: 50, prevSales: 0 },
      { id: 'muerto', profit: 0, sales: 0, prevSales: 0 },
    ]);
    expect(shareThreshold).toBe(20);
    expect(Object.fromEntries(points.map((p) => [p.id, p.quadrant]))).toEqual({
      star: 'star',
      cow: 'cash_cow',
      q: 'question',
      dog: 'dog',
      nuevo: 'question',
    });
    expect(points.find((p) => p.id === 'nuevo')!.growthPct).toBeNull();
  });
});

describe('GMROI y rotación', () => {
  it('anualiza sobre el stock a costo', () => {
    // 30 días: ganancia S/ 300, costo vendido S/ 2,700, stock S/ 1,000.
    expect(gmroi(30_000, 100_000, 30)).toBeCloseTo(3.65);
    expect(inventoryTurnover(270_000, 100_000, 30)).toBeCloseTo(32.85);
    expect(gmroi(100, 0, 30)).toBeNull();
  });
});
