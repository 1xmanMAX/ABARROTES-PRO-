import type { Cents } from './money';

/** Rebaja máxima por regateo, por ticket (S/ 1 a S/ 5 según lo que compra). */
export const DEFAULT_MAX_HAGGLE: Cents = 500;
export const HAGGLE_STEP: Cents = 100;

/** Opciones rápidas: S/ 1, S/ 2… hasta el máximo, sin llegar al total rebajable. */
export function haggleOptions(max: Cents, eligibleTotal: Cents): Cents[] {
  const out: Cents[] = [];
  for (let v = HAGGLE_STEP; v <= max && v < eligibleTotal; v += HAGGLE_STEP) out.push(v);
  return out;
}

/**
 * Reparte la rebaja entre las líneas que la admiten, en proporción a su total,
 * en céntimos enteros (el resto va a la línea más grande). Devuelve la parte de cada línea.
 */
export function distributeDiscount(lines: { lineTotal: Cents; eligible: boolean }[], discount: Cents): Cents[] {
  const shares = lines.map(() => 0);
  if (discount <= 0) return shares;
  const eligibleTotal = lines.reduce((a, l) => a + (l.eligible ? l.lineTotal : 0), 0);
  if (discount >= eligibleTotal) throw new Error('La rebaja no puede ser mayor que el total rebajable');
  let assigned = 0;
  let biggest = -1;
  lines.forEach((l, i) => {
    if (!l.eligible || l.lineTotal <= 0) return;
    const share = Math.floor((discount * l.lineTotal) / eligibleTotal);
    shares[i] = share;
    assigned += share;
    if (biggest < 0 || l.lineTotal > lines[biggest]!.lineTotal) biggest = i;
  });
  shares[biggest]! += discount - assigned;
  return shares;
}
