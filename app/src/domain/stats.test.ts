import { describe, expect, it } from 'vitest';
import { addTicketToStats, decayed, removeTicketFromStats, replayStats, type PairStat, type ProductStat } from './stats';

const DAY = 86_400_000;
const T0 = Date.UTC(2026, 8, 1, 15, 0); // 10:00 en Lima

describe('stats', () => {
  it('la mitad a los 30 días', () => {
    expect(decayed(10, T0, T0 + 30 * DAY)).toBeCloseTo(5, 10);
  });

  it('suma ventas con decaimiento, por hora y pares', () => {
    const { products, pairs } = replayStats([
      {
        closedAt: T0,
        lines: [
          { productId: 'a', units: 2 },
          { productId: 'b', units: 1 },
        ],
      },
      {
        closedAt: T0 + 30 * DAY,
        lines: [
          { productId: 'a', units: 1 },
          { productId: 'a', units: 1 },
        ],
      },
    ]);
    const a = products.get('a')!;
    expect(a.decayedQty).toBeCloseTo(2 * 0.5 + 2, 10);
    expect(a.byHour[10]).toBe(4);
    expect(pairs.get('a|b')!.decayedCount).toBe(1);
    expect(pairs.size).toBe(1);
  });

  it('anular resta exactamente el aporte', () => {
    const products = new Map<string, ProductStat>();
    const pairs = new Map<string, PairStat>();
    const apply = (u: { products: ProductStat[]; pairs: PairStat[] }) => {
      u.products.forEach((p) => products.set(p.productId, p));
      u.pairs.forEach((p) => pairs.set(p.key, p));
    };
    const get = [(id: string) => products.get(id), (k: string) => pairs.get(k)] as const;
    apply(addTicketToStats(...get, [{ productId: 'a', units: 3 }], T0));
    const lines = [
      { productId: 'a', units: 2 },
      { productId: 'b', units: 1 },
    ];
    apply(addTicketToStats(...get, lines, T0 + 5 * DAY));
    apply(removeTicketFromStats(...get, lines, T0 + 5 * DAY, T0 + 6 * DAY));
    const a = products.get('a')!;
    expect(decayed(a.decayedQty, a.lastSoldAt, T0 + 10 * DAY)).toBeCloseTo(3 * Math.exp((-Math.LN2 / 30) * 10), 9);
    expect(a.byHour[10]).toBe(3);
    expect(products.get('b')!.decayedQty).toBeCloseTo(0, 9);
    expect(pairs.get('a|b')!.decayedCount).toBeCloseTo(0, 9);
  });
});
