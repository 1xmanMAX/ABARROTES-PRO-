import type { Cents } from './money';

/**
 * Indicadores económicos clásicos aplicados al puesto. Funciones puras; el dinero
 * en céntimos y los ratios solo para mostrar.
 */

// ---------------------------------------------------------------------------
// 1. Punto de equilibrio (análisis costo-volumen-utilidad, CVU)
//    Ventas de equilibrio = costos fijos / razón de margen de contribución,
//    donde margen de contribución = ventas − costo variable (costo de la mercadería).
// ---------------------------------------------------------------------------
export interface BreakEven {
  /** Razón de margen de contribución (0–1). */
  contributionRatio: number;
  fixedCosts: Cents;
  /** Ventas necesarias en el periodo para no ganar ni perder (null si el margen es ≤ 0). */
  breakEvenSales: Cents | null;
  breakEvenDaily: Cents | null;
  actualDaily: Cents;
  /** Margen de seguridad: cuánto pueden caer las ventas antes de perder (fracción de las ventas). */
  safetyMargin: number | null;
}

export function breakEven(sales: Cents, grossProfit: Cents, fixedCosts: Cents, days: number): BreakEven {
  const d = Math.max(1, days);
  const contributionRatio = sales > 0 ? grossProfit / sales : 0;
  const actualDaily = Math.round(sales / d);
  if (contributionRatio <= 0) {
    return { contributionRatio, fixedCosts, breakEvenSales: null, breakEvenDaily: null, actualDaily, safetyMargin: null };
  }
  const breakEvenSales = Math.round(fixedCosts / contributionRatio);
  return {
    contributionRatio,
    fixedCosts,
    breakEvenSales,
    breakEvenDaily: Math.round(breakEvenSales / d),
    actualDaily,
    safetyMargin: sales > 0 ? (sales - breakEvenSales) / sales : null,
  };
}

// ---------------------------------------------------------------------------
// 2. Pareto / clasificación ABC: A = los que juntos dejan el 80 % de la
//    ganancia, B = el siguiente 15 %, C = el resto.
// ---------------------------------------------------------------------------
export type AbcClass = 'A' | 'B' | 'C';
export const ABC_A = 80;
export const ABC_B = 95;

export interface AbcItem {
  id: string;
  value: number;
  sharePct: number;
  cumulativePct: number;
  cls: AbcClass;
}

export function abcClassify(items: { id: string; value: number }[]): AbcItem[] {
  const sorted = [...items].sort((a, b) => b.value - a.value);
  const total = sorted.reduce((s, i) => s + Math.max(0, i.value), 0);
  let before = 0;
  return sorted.map((i) => {
    const sharePct = total > 0 ? (Math.max(0, i.value) * 100) / total : 0;
    // La clase la decide dónde EMPIEZA el producto en el acumulado.
    const cls: AbcClass = i.value <= 0 || total <= 0 ? 'C' : before < ABC_A ? 'A' : before < ABC_B ? 'B' : 'C';
    before += sharePct;
    return { ...i, sharePct, cumulativePct: before, cls };
  });
}

// ---------------------------------------------------------------------------
// 3. Matriz BCG (Boston Consulting Group), adaptada al puesto:
//    eje X = participación en la ganancia (alta si ≥ el promedio, 1/n),
//    eje Y = crecimiento de las ventas del producto frente al periodo anterior.
// ---------------------------------------------------------------------------
export type BcgQuadrant = 'star' | 'cash_cow' | 'question' | 'dog';

export interface BcgPoint {
  id: string;
  sharePct: number;
  /** % de crecimiento (null si no había ventas antes: producto nuevo). */
  growthPct: number | null;
  quadrant: BcgQuadrant;
}

export function bcgMatrix(items: { id: string; profit: Cents; sales: Cents; prevSales: Cents }[]): {
  points: BcgPoint[];
  shareThreshold: number;
} {
  const active = items.filter((i) => i.sales > 0 || i.prevSales > 0);
  const total = active.reduce((s, i) => s + Math.max(0, i.profit), 0);
  const shareThreshold = active.length ? 100 / active.length : 0;
  const points = active.map((i) => {
    const sharePct = total > 0 ? (Math.max(0, i.profit) * 100) / total : 0;
    const growthPct = i.prevSales > 0 ? ((i.sales - i.prevSales) * 100) / i.prevSales : null;
    const growing = growthPct === null ? i.sales > 0 : growthPct > 0;
    const high = sharePct >= shareThreshold;
    const quadrant: BcgQuadrant = high ? (growing ? 'star' : 'cash_cow') : growing ? 'question' : 'dog';
    return { id: i.id, sharePct, growthPct, quadrant };
  });
  return { points, shareThreshold };
}

// ---------------------------------------------------------------------------
// 4. GMROI y rotación de inventario (indicadores de comercio minorista)
//    GMROI = margen bruto anual / inversión en inventario (a costo).
//    Rotación = costo de lo vendido anual / inventario a costo.
// ---------------------------------------------------------------------------
export function annualize(value: number, days: number): number {
  return (value * 365) / Math.max(1, days);
}

/** Soles de ganancia al año por cada sol invertido en stock (null sin stock). */
export function gmroi(grossProfit: Cents, stockValue: Cents, days: number): number | null {
  if (stockValue <= 0) return null;
  return annualize(grossProfit, days) / stockValue;
}

/** Veces al año que se renueva el stock (null sin stock). */
export function inventoryTurnover(costOfSales: Cents, stockValue: Cents, days: number): number | null {
  if (stockValue <= 0) return null;
  return annualize(costOfSales, days) / stockValue;
}
