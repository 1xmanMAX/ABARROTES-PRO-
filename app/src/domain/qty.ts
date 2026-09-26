import type { Cents } from './money';

/**
 * Cantidades enteras. Para productos con `allowsFraction` la cantidad se guarda
 * en milésimas (1 kg = 1000).
 */
export type Qty = number;

export const FRACTION_SCALE = 1000;

export interface QtyUnitInfo {
  allowsFraction: boolean;
}

/** Cantidad que representa "una unidad" de venta del producto. */
export function unitStep(p: QtyUnitInfo): Qty {
  return p.allowsFraction ? FRACTION_SCALE : 1;
}

/**
 * Total de una línea. Con fracciones se redondea al céntimo más cercano
 * (única operación con redondeo: kg × precio).
 */
export function lineAmount(p: QtyUnitInfo, qty: Qty, unitPrice: Cents): Cents {
  if (!Number.isSafeInteger(qty)) throw new Error(`Cantidad inválida: ${qty}`);
  if (!p.allowsFraction) return qty * unitPrice;
  return Math.round((qty * unitPrice) / FRACTION_SCALE);
}

/** Muestra la cantidad: 3 → "3", 1500 (fracción) → "1.5". */
export function formatQty(p: QtyUnitInfo, qty: Qty): string {
  if (!p.allowsFraction) return String(qty);
  const whole = Math.trunc(qty / FRACTION_SCALE);
  const frac = Math.abs(qty % FRACTION_SCALE);
  if (frac === 0) return String(whole);
  const sign = qty < 0 && whole === 0 ? '-' : '';
  return `${sign}${whole}.${String(frac).padStart(3, '0').replace(/0+$/, '')}`;
}

/** Texto del usuario → cantidad interna. "1.5" con fracción → 1500. */
export function parseQty(p: QtyUnitInfo, text: string): Qty | null {
  const clean = text.trim().replace(',', '.');
  if (!p.allowsFraction) {
    return /^\d+$/.test(clean) ? Number(clean) : null;
  }
  const m = /^(\d+)(?:\.(\d{0,3}))?$/.exec(clean);
  if (!m) return null;
  return Number(m[1]) * FRACTION_SCALE + Number((m[2] ?? '').padEnd(3, '0'));
}
