import { decayed, pairKey, type PairStat, type ProductStat } from './stats';

export const SUGGESTION_COUNT = 3;
/** Con menos tickets cerrados que esto, solo se usa la popularidad. */
export const COLD_START_TICKETS = 20;
/** Un candidato ya visible solo se reemplaza si otro lo supera por más de este margen. */
export const FLICKER_MARGIN = 1.1;

export interface PredictionInput {
  /** Productos que se pueden sugerir: activos, con stock disponible y fuera del ticket. */
  candidates: string[];
  /** Productos que ya lleva el ticket activo. */
  cart: string[];
  productStats: ReadonlyMap<string, ProductStat>;
  pairStats: ReadonlyMap<string, PairStat>;
  hour: number;
  now: number;
  closedTickets: number;
  /** Lo que se muestra ahora, para evitar parpadeo. */
  previous: string[];
}

function normalizer(values: number[]): (v: number) => number {
  const max = Math.max(0, ...values);
  return max > 0 ? (v) => v / max : () => 0;
}

/** Puntaje de cada candidato (DATA_MODEL §4.2). Solo puntajes > 0. */
export function scoreCandidates(input: PredictionInput): Map<string, number> {
  const { candidates, productStats, pairStats, hour, now } = input;
  const cart = input.cart.filter((id) => !candidates.includes(id));
  const qtyNow = new Map<string, number>();
  const qtyOf = (id: string) => {
    let v = qtyNow.get(id);
    if (v === undefined) {
      const s = productStats.get(id);
      v = s ? decayed(s.decayedQty, s.lastSoldAt, now) : 0;
      qtyNow.set(id, v);
    }
    return v;
  };
  const hourOfP = (id: string) => productStats.get(id)?.byHour[hour] ?? 0;
  const normQty = normalizer(candidates.map(qtyOf));
  const normHour = normalizer(candidates.map(hourOfP));

  const scores = new Map<string, number>();
  const coldStart = input.closedTickets < COLD_START_TICKETS;
  for (const p of candidates) {
    let score: number;
    if (coldStart) {
      score = normQty(qtyOf(p));
    } else if (cart.length === 0) {
      score = 0.6 * normHour(hourOfP(p)) + 0.4 * normQty(qtyOf(p));
    } else {
      let affinity = 0;
      for (const c of cart) {
        const pair = pairStats.get(pairKey(c, p).key);
        if (pair) affinity += decayed(pair.decayedCount, pair.lastAt, now) / Math.sqrt(1 + qtyOf(c));
      }
      score = affinity + 0.15 * normQty(qtyOf(p)) + 0.1 * normHour(hourOfP(p));
    }
    if (score > 0) scores.set(p, score);
  }
  return scores;
}

const byScoreThenId = (scores: Map<string, number>) => (x: string, y: string) =>
  scores.get(y)! - scores.get(x)! || (x < y ? -1 : x > y ? 1 : 0);

/**
 * Los 3 más probables. Los que ya se muestran conservan su lugar salvo que un
 * candidato nuevo los supere por más del 10 %.
 */
export function predictNext(input: PredictionInput): string[] {
  const scores = scoreCandidates(input);
  const ranked = [...scores.keys()].sort(byScoreThenId(scores));
  const shown: (string | null)[] = input.previous.slice(0, SUGGESTION_COUNT).map((id) => (scores.has(id) ? id : null));
  while (shown.length < SUGGESTION_COUNT) shown.push(null);

  const outsiders = ranked.filter((id) => !shown.includes(id));
  // Huecos: se llenan con los mejores de afuera.
  for (let i = 0; i < SUGGESTION_COUNT; i++) {
    if (shown[i] === null && outsiders.length) shown[i] = outsiders.shift()!;
  }
  // Reemplazo con margen: el mejor de afuera contra el más débil de adentro.
  for (;;) {
    const best = outsiders[0];
    if (!best) break;
    let weakIdx = -1;
    for (let i = 0; i < shown.length; i++) {
      const id = shown[i];
      if (id && (weakIdx < 0 || scores.get(id)! < scores.get(shown[weakIdx]!)!)) weakIdx = i;
    }
    if (weakIdx < 0 || scores.get(best)! <= FLICKER_MARGIN * scores.get(shown[weakIdx]!)!) break;
    const removed = shown[weakIdx]!;
    shown[weakIdx] = best;
    outsiders.shift();
    outsiders.push(removed);
    outsiders.sort(byScoreThenId(scores));
  }
  return shown.filter((id): id is string => id !== null);
}
