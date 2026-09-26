import { hourOf } from './time';

/** Vida media del decaimiento (DATA_MODEL §4). */
export const HALF_LIFE_DAYS = 30;
export const LAMBDA = Math.LN2 / HALF_LIFE_DAYS;
const DAY_MS = 86_400_000;

export interface ProductStat {
  productId: string;
  /** Unidades vendidas con decaimiento, referidas al instante `lastSoldAt`. */
  decayedQty: number;
  /** Instante de referencia del decaimiento (última venta o último ajuste). */
  lastSoldAt: number;
  /** Unidades vendidas por hora del día (0–23, hora de Lima). */
  byHour: number[];
}

export interface PairStat {
  /** 'a|b' con a < b. */
  key: string;
  a: string;
  b: string;
  decayedCount: number;
  lastAt: number;
}

export interface StatLine {
  productId: string;
  /** Unidades de venta (con fracciones: kg, no milésimas). */
  units: number;
}

export function decayFactor(fromMs: number, toMs: number): number {
  const days = Math.max(0, toMs - fromMs) / DAY_MS;
  return Math.exp(-LAMBDA * days);
}

/** Valor decaído actual. */
export function decayed(value: number, refMs: number, nowMs: number): number {
  return value * decayFactor(refMs, nowMs);
}

export function pairKey(x: string, y: string): { key: string; a: string; b: string } {
  const [a, b] = x < y ? [x, y] : [y, x];
  return { key: `${a}|${b}`, a, b };
}

function emptyHours(): number[] {
  return new Array(24).fill(0);
}

/** Agrupa por producto (un producto puede repetirse en líneas). */
function unitsByProduct(lines: StatLine[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const l of lines) if (l.units > 0) m.set(l.productId, (m.get(l.productId) ?? 0) + l.units);
  return m;
}

export interface StatUpdates {
  products: ProductStat[];
  pairs: PairStat[];
}

/**
 * Suma un ticket cerrado a las estadísticas (DATA_MODEL §4.1 y §4.2).
 * Devuelve solo los registros tocados; no modifica los de entrada.
 */
export function addTicketToStats(
  getProduct: (id: string) => ProductStat | undefined,
  getPair: (key: string) => PairStat | undefined,
  lines: StatLine[],
  at: number,
): StatUpdates {
  const units = unitsByProduct(lines);
  const hour = hourOf(at);
  const products: ProductStat[] = [];
  for (const [productId, qty] of units) {
    const prev = getProduct(productId);
    const byHour = prev ? [...prev.byHour] : emptyHours();
    byHour[hour] = (byHour[hour] ?? 0) + qty;
    products.push({
      productId,
      decayedQty: (prev ? decayed(prev.decayedQty, prev.lastSoldAt, at) : 0) + qty,
      lastSoldAt: Math.max(at, prev?.lastSoldAt ?? at),
      byHour,
    });
  }
  const ids = [...units.keys()];
  const pairs: PairStat[] = [];
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const { key, a, b } = pairKey(ids[i]!, ids[j]!);
      const prev = getPair(key);
      pairs.push({
        key,
        a,
        b,
        decayedCount: (prev ? decayed(prev.decayedCount, prev.lastAt, at) : 0) + 1,
        lastAt: Math.max(at, prev?.lastAt ?? at),
      });
    }
  }
  return { products, pairs };
}

/**
 * Resta un ticket anulado: se quita su aporte decaído hasta `now`.
 * `soldAt` es el momento en que se cerró el ticket.
 */
export function removeTicketFromStats(
  getProduct: (id: string) => ProductStat | undefined,
  getPair: (key: string) => PairStat | undefined,
  lines: StatLine[],
  soldAt: number,
  now: number,
): StatUpdates {
  const units = unitsByProduct(lines);
  const hour = hourOf(soldAt);
  const at = Math.max(now, soldAt);
  const factor = decayFactor(soldAt, at);
  const products: ProductStat[] = [];
  for (const [productId, qty] of units) {
    const prev = getProduct(productId);
    if (!prev) continue;
    const byHour = [...prev.byHour];
    byHour[hour] = Math.max(0, (byHour[hour] ?? 0) - qty);
    const ref = Math.max(prev.lastSoldAt, at);
    products.push({
      productId,
      decayedQty: Math.max(0, decayed(prev.decayedQty, prev.lastSoldAt, ref) - qty * decayFactor(soldAt, ref)),
      lastSoldAt: ref,
      byHour,
    });
  }
  const ids = [...units.keys()];
  const pairs: PairStat[] = [];
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const { key } = pairKey(ids[i]!, ids[j]!);
      const prev = getPair(key);
      if (!prev) continue;
      const ref = Math.max(prev.lastAt, at);
      pairs.push({
        ...prev,
        decayedCount: Math.max(0, decayed(prev.decayedCount, prev.lastAt, ref) - factor * decayFactor(at, ref)),
        lastAt: ref,
      });
    }
  }
  return { products, pairs };
}

/** Reconstruye las estadísticas desde el historial (migración o datos de ejemplo). */
export function replayStats(tickets: { closedAt: number; lines: StatLine[] }[]): {
  products: Map<string, ProductStat>;
  pairs: Map<string, PairStat>;
} {
  const products = new Map<string, ProductStat>();
  const pairs = new Map<string, PairStat>();
  const sorted = [...tickets].sort((x, y) => x.closedAt - y.closedAt);
  for (const t of sorted) {
    const upd = addTicketToStats(
      (id) => products.get(id),
      (k) => pairs.get(k),
      t.lines,
      t.closedAt,
    );
    for (const p of upd.products) products.set(p.productId, p);
    for (const p of upd.pairs) pairs.set(p.key, p);
  }
  return { products, pairs };
}
