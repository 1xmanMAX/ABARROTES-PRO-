import { describe, expect, it } from 'vitest';
import { predictNext, scoreCandidates, type PredictionInput } from './prediction';
import { pairKey, type PairStat, type ProductStat } from './stats';

const NOW = Date.UTC(2026, 8, 25, 15, 0);

function stat(productId: string, decayedQty: number, hours: Record<number, number> = {}): ProductStat {
  const byHour = new Array(24).fill(0);
  for (const [h, v] of Object.entries(hours)) byHour[Number(h)] = v;
  return { productId, decayedQty, lastSoldAt: NOW, byHour };
}
function pair(x: string, y: string, count: number): PairStat {
  return { ...pairKey(x, y), decayedCount: count, lastAt: NOW };
}

const productStats = new Map(
  [
    stat('arroz', 100, { 8: 20 }),
    stat('aceite', 60, { 8: 5 }),
    stat('avena', 40, { 8: 2, 18: 30 }),
    stat('azucar', 80, { 8: 10 }),
    stat('harina', 30, { 8: 1 }),
    stat('sal', 10),
  ].map((s) => [s.productId, s]),
);
const pairStats = new Map(
  [pair('arroz', 'aceite', 30), pair('arroz', 'avena', 25), pair('azucar', 'harina', 40), pair('arroz', 'sal', 2)].map((p) => [
    p.key,
    p,
  ]),
);
const all = ['arroz', 'aceite', 'avena', 'azucar', 'harina', 'sal'];

const input = (over: Partial<PredictionInput>): PredictionInput => ({
  candidates: all,
  cart: [],
  productStats,
  pairStats,
  hour: 8,
  now: NOW,
  closedTickets: 300,
  previous: [],
  ...over,
});

describe('prediction', () => {
  it('con ticket vacío: hora del día y popularidad', () => {
    expect(predictNext(input({}))).toEqual(['arroz', 'azucar', 'aceite']);
    expect(predictNext(input({ hour: 18 }))[0]).toBe('avena');
  });

  it('con productos: lo que suele ir junto', () => {
    const cand = all.filter((x) => x !== 'arroz');
    expect(predictNext(input({ cart: ['arroz'], candidates: cand }))).toEqual(['aceite', 'avena', 'azucar']);
    const cand2 = all.filter((x) => x !== 'azucar');
    expect(predictNext(input({ cart: ['azucar'], candidates: cand2 }))[0]).toBe('harina');
  });

  it('producto inusual en el ticket también recalcula', () => {
    const cand = all.filter((x) => x !== 'harina');
    expect(predictNext(input({ cart: ['harina'], candidates: cand }))[0]).toBe('azucar');
  });

  it('excluye lo que no es candidato (en el ticket o sin stock)', () => {
    const cand = ['avena', 'sal', 'harina'];
    const r = predictNext(input({ cart: ['arroz'], candidates: cand }));
    expect(r).not.toContain('aceite');
    expect(r[0]).toBe('avena');
  });

  it('arranque en frío: solo popularidad', () => {
    expect(predictNext(input({ closedTickets: 5, hour: 18 }))).toEqual(['arroz', 'azucar', 'aceite']);
  });

  it('sin historial no sugiere nada', () => {
    expect(predictNext(input({ productStats: new Map(), pairStats: new Map() }))).toEqual([]);
  });

  it('no parpadea: se mantiene lo visible salvo que otro lo supere por más de 10 %', () => {
    const scores = scoreCandidates(input({}));
    expect(scores.get('arroz')!).toBeGreaterThan(scores.get('harina')!);
    // 'harina' visible y aún candidata: 'aceite' la supera por mucho → se reemplaza en su lugar
    const r = predictNext(input({ previous: ['harina', 'arroz', 'azucar'] }));
    expect(r).toEqual(['aceite', 'arroz', 'azucar']);
    // diferencias menores al 10 %: se queda como está
    const close = new Map(productStats);
    close.set('aceite', stat('aceite', 80, { 8: 10 })); // empata casi con azúcar
    const r2 = predictNext(input({ productStats: close, previous: ['arroz', 'azucar', 'avena'] }));
    expect(r2.slice(0, 2)).toEqual(['arroz', 'azucar']);
  });

  it('rinde: 60 productos y 1 770 pares en menos de 16 ms', () => {
    const ids = Array.from({ length: 60 }, (_, i) => `p${String(i).padStart(2, '0')}`);
    const ps = new Map(ids.map((id, i) => [id, stat(id, 60 - i, { 8: i })]));
    const pp = new Map<string, PairStat>();
    for (let i = 0; i < 60; i++)
      for (let j = i + 1; j < 60; j++) {
        const p = pair(ids[i]!, ids[j]!, (i * j) % 17);
        pp.set(p.key, p);
      }
    const cart = ids.slice(0, 5);
    const cand = ids.slice(5);
    const args = input({ candidates: cand, cart, productStats: ps, pairStats: pp });
    predictNext(args);
    const t = performance.now();
    for (let k = 0; k < 20; k++) predictNext(args);
    expect((performance.now() - t) / 20).toBeLessThan(16);
  });
});
