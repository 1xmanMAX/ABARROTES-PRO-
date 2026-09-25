import type { Cents } from './money';

/**
 * Ganancias y rentabilidad. Todo el dinero en céntimos enteros; los porcentajes
 * solo se usan para mostrar.
 */
export interface SaleLine {
  productId: string;
  qty: number;
  fractional: boolean;
  lineTotal: Cents;
  lineProfit: Cents;
}

export interface SaleTicket {
  dayKey: string;
  closedAt: number;
  total: Cents;
  haggle: Cents;
  lines: SaleLine[];
}

export interface Expense {
  dayKey: string;
  /** Positivo. */
  amount: Cents;
  category: string;
}

export interface Summary {
  sales: Cents;
  cost: Cents;
  grossProfit: Cents;
  tickets: number;
  avgTicket: Cents;
  haggle: Cents;
  expenses: Cents;
  fixedCosts: Cents;
  netProfit: Cents;
  /** % de lo vendido (para mostrar). */
  grossMarginPct: number;
  netMarginPct: number;
}

/** Gastos fijos del mes repartidos por día (mes de 30 días). */
export function proratedFixed(fixedMonthly: Cents, days: number): Cents {
  return Math.round((fixedMonthly * days) / 30);
}

const pct = (part: number, whole: number) => (whole > 0 ? (part * 100) / whole : 0);

export function summarize(tickets: SaleTicket[], expenses: Expense[], fixedMonthly: Cents, days: number): Summary {
  let sales = 0;
  let grossProfit = 0;
  let haggle = 0;
  for (const t of tickets) {
    sales += t.total;
    haggle += t.haggle;
    for (const l of t.lines) grossProfit += l.lineProfit;
  }
  const exp = expenses.reduce((a, e) => a + e.amount, 0);
  const fixedCosts = proratedFixed(fixedMonthly, days);
  const netProfit = grossProfit - exp - fixedCosts;
  return {
    sales,
    cost: sales - grossProfit,
    grossProfit,
    tickets: tickets.length,
    avgTicket: tickets.length ? Math.round(sales / tickets.length) : 0,
    haggle,
    expenses: exp,
    fixedCosts,
    netProfit,
    grossMarginPct: pct(grossProfit, sales),
    netMarginPct: pct(netProfit, sales),
  };
}

export interface DayPoint {
  dayKey: string;
  sales: Cents;
  grossProfit: Cents;
  netProfit: Cents;
}

/** Serie por día (incluye días sin ventas, para no esconder los días malos). */
export function byDay(tickets: SaleTicket[], expenses: Expense[], dayKeys: string[], fixedMonthly: Cents): DayPoint[] {
  const map = new Map(dayKeys.map((k) => [k, { dayKey: k, sales: 0, grossProfit: 0, netProfit: 0 }]));
  for (const t of tickets) {
    const d = map.get(t.dayKey);
    if (!d) continue;
    d.sales += t.total;
    for (const l of t.lines) d.grossProfit += l.lineProfit;
  }
  const fixedDaily = proratedFixed(fixedMonthly, 1);
  for (const d of map.values()) d.netProfit = d.grossProfit - fixedDaily;
  for (const e of expenses) {
    const d = map.get(e.dayKey);
    if (d) d.netProfit -= e.amount;
  }
  return [...map.values()];
}

export interface ProductInfo {
  id: string;
  name: string;
  stock: number;
  allowsFraction: boolean;
  costPrice: Cents;
  active: boolean;
}

export type Verdict = 'no_cost' | 'loss' | 'no_sales' | 'low_margin' | 'slow' | 'star' | 'ok';

export const LOW_MARGIN_PCT = 5;
export const SLOW_DAYS = 60;
/** Estrellas: los que juntos dejan la mitad de la ganancia. */
export const STAR_SHARE_PCT = 50;

export interface ProductRow {
  productId: string;
  name: string;
  /** Unidades de venta (kg si tiene fracciones). */
  units: number;
  sales: Cents;
  profit: Cents;
  marginPct: number;
  /** Parte de la ganancia total del periodo. */
  profitSharePct: number;
  /** Días que dura el stock al ritmo de venta del periodo (null si no se vendió). */
  daysOfStock: number | null;
  /** Capital en stock (a costo). */
  stockValue: Cents;
  verdict: Verdict;
}

export function productReport(tickets: SaleTicket[], products: ProductInfo[], days: number): ProductRow[] {
  const acc = new Map<string, { units: number; sales: number; profit: number }>();
  for (const t of tickets) {
    for (const l of t.lines) {
      const a = acc.get(l.productId) ?? { units: 0, sales: 0, profit: 0 };
      a.units += l.fractional ? l.qty / 1000 : l.qty;
      a.sales += l.lineTotal;
      a.profit += l.lineProfit;
      acc.set(l.productId, a);
    }
  }
  const totalProfit = [...acc.values()].reduce((s, a) => s + Math.max(0, a.profit), 0);
  const rows: ProductRow[] = products
    .filter((p) => p.active || acc.has(p.id))
    .map((p) => {
      const a = acc.get(p.id) ?? { units: 0, sales: 0, profit: 0 };
      const stockUnits = p.allowsFraction ? p.stock / 1000 : p.stock;
      const perDay = a.units / Math.max(1, days);
      return {
        productId: p.id,
        name: p.name,
        units: a.units,
        sales: a.sales,
        profit: a.profit,
        marginPct: pct(a.profit, a.sales),
        profitSharePct: pct(Math.max(0, a.profit), totalProfit),
        daysOfStock: perDay > 0 ? stockUnits / perDay : null,
        stockValue: Math.round(stockUnits * p.costPrice),
        verdict: 'ok' as Verdict,
      };
    })
    .sort((x, y) => y.profit - x.profit || y.sales - x.sales);

  // Estrellas: por ganancia, hasta juntar la mitad del total.
  let cumulative = 0;
  const stars = new Set<string>();
  for (const r of rows) {
    if (r.profit <= 0 || cumulative >= STAR_SHARE_PCT) break;
    stars.add(r.productId);
    cumulative += r.profitSharePct;
  }

  const costById = new Map(products.map((p) => [p.id, p.costPrice]));
  for (const r of rows) r.verdict = verdictFor(r, costById.get(r.productId) ?? 0, stars.has(r.productId));
  return rows;
}

function verdictFor(r: ProductRow, costPrice: Cents, isStar: boolean): Verdict {
  // Sin costo registrado, la ganancia calculada no es real.
  if (costPrice <= 0) return 'no_cost';
  if (r.sales > 0 && r.profit <= 0) return 'loss';
  if (r.units === 0) return 'no_sales';
  if (r.marginPct < LOW_MARGIN_PCT) return 'low_margin';
  if (r.daysOfStock !== null && r.daysOfStock > SLOW_DAYS) return 'slow';
  if (isStar) return 'star';
  return 'ok';
}

export type BusinessVerdict = 'no_data' | 'profitable' | 'losing' | 'missing_expenses';

/** ¿El negocio es rentable en el periodo? */
export function businessVerdict(s: Summary, hasExpenseData: boolean): BusinessVerdict {
  if (s.tickets === 0) return 'no_data';
  if (s.netProfit <= 0) return 'losing';
  if (!hasExpenseData) return 'missing_expenses';
  return 'profitable';
}

/** Variación % frente al periodo anterior (null si no hay base). */
export function changePct(current: Cents, previous: Cents): number | null {
  if (previous <= 0) return null;
  return ((current - previous) * 100) / previous;
}
