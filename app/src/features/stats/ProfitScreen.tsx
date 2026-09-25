import { useMemo, useState } from 'react';
import { useProducts, useSettings } from '../../app/data';
import { formatPEN } from '../../domain/money';
import {
  businessVerdict,
  byDay,
  changePct,
  productReport,
  summarize,
  type ProductRow,
  type SaleTicket,
} from '../../domain/profit';
import { daysBetween, formatDayKey, lastDayKeys } from '../../domain/time';
import { toExpenses } from '../../db/reports';
import { t } from '../../i18n/es-PE';
import { BarChart, type BarPoint } from '../../ui/BarChart';
import { ScreenHeader } from '../../ui/ScreenHeader';
import s from '../../ui/Screen.module.css';
import styles from './Stats.module.css';
import { Kpi } from './TodayScreen';
import { fmtPct, signedPct, useSalesSince } from './useReport';

type Period = '7' | '30' | 'all';
const REVIEW = new Set(['slow', 'low_margin', 'loss', 'no_sales', 'no_cost']);
const VERDICT_ICON: Record<string, string> = {
  star: '★',
  ok: '✓',
  slow: '⏳',
  low_margin: '↓',
  loss: '✕',
  no_sales: '∅',
  no_cost: '?',
};

/** Rentabilidad del negocio y de cada producto. */
export default function ProfitScreen() {
  const settings = useSettings();
  const products = useProducts();
  const [period, setPeriod] = useState<Period>('30');
  const [filter, setFilter] = useState<'all' | 'review'>('all');
  const [open, setOpen] = useState<string | null>(null);
  const [now] = useState(() => Date.now());
  // Para comparar, se carga también el periodo anterior de igual largo.
  const days = period === 'all' ? null : Number(period);
  const fromKey = days ? lastDayKeys(days * 2, now)[0]! : null;
  const data = useSalesSince(fromKey);

  const view = useMemo(() => {
    if (!data) return null;
    const allKeys = days ? lastDayKeys(days * 2, now) : null;
    const currentKeys = allKeys ? allKeys.slice(days!) : null;
    const startKey = currentKeys ? currentKeys[0]! : (data.sales.map((x) => x.dayKey).sort()[0] ?? lastDayKeys(1, now)[0]!);
    const endKey = lastDayKeys(1, now)[0]!;
    const periodDays = days ?? daysBetween(startKey, endKey);
    const inCurrent = (k: string) => k >= startKey;
    const sales = data.sales.filter((x) => inCurrent(x.dayKey));
    const expMovs = data.expenses.filter((m) => inCurrent(m.dayKey));
    const exp = toExpenses(expMovs);
    const sum = summarize(sales, exp, settings.fixedMonthlyCosts, periodDays);
    let vs: number | null = null;
    if (allKeys && days) {
      const prevSales: SaleTicket[] = data.sales.filter((x) => x.dayKey < startKey);
      const prevExp = toExpenses(data.expenses.filter((m) => m.dayKey < startKey));
      vs = changePct(sum.netProfit, summarize(prevSales, prevExp, settings.fixedMonthlyCosts, days).netProfit);
    }
    const keys = currentKeys ?? lastDayKeys(periodDays, now);
    let points: BarPoint[];
    if (keys.length <= 45) {
      points = byDay(sales, exp, keys, settings.fixedMonthlyCosts).map((d) => ({
        key: d.dayKey,
        label: d.dayKey.slice(8),
        title: formatDayKey(d.dayKey),
        value: d.netProfit,
        detail: t.stats.salesDetail(formatPEN(d.sales)),
      }));
    } else {
      // Periodos largos: por mes.
      const months = new Map<string, BarPoint>();
      for (const d of byDay(sales, exp, keys, settings.fixedMonthlyCosts)) {
        const m = d.dayKey.slice(0, 7);
        const p = months.get(m) ?? { key: m, label: m.slice(5), title: m, value: 0 };
        p.value += d.netProfit;
        months.set(m, p);
      }
      points = [...months.values()];
    }
    const rows = productReport(sales, products, periodDays);
    const verdict = businessVerdict(sum, exp.length > 0 || settings.fixedMonthlyCosts > 0);
    return { sum, vs, points, rows, verdict, monthly: keys.length > 45 };
  }, [data, days, now, settings.fixedMonthlyCosts, products]);

  if (!view) return null;
  const { sum, vs, points, rows, verdict, monthly } = view;
  const shown = filter === 'review' ? rows.filter((r) => REVIEW.has(r.verdict)) : rows;
  const reviewCount = rows.filter((r) => REVIEW.has(r.verdict)).length;
  const verdictText =
    verdict === 'no_data'
      ? t.stats.business.no_data
      : verdict === 'profitable'
        ? t.stats.business.profitable(formatPEN(sum.netProfit), fmtPct(sum.netMarginPct))
        : verdict === 'losing'
          ? t.stats.business.losing(formatPEN(-sum.netProfit))
          : t.stats.business.missing_expenses(formatPEN(sum.grossProfit));

  return (
    <div className={s.screen}>
      <ScreenHeader title={t.stats.profitTitle} />
      <div className={s.content}>
        <div className={s.segment} role="group" aria-label="Periodo">
          {(['7', '30', 'all'] as Period[]).map((p) => (
            <button key={p} type="button" aria-pressed={period === p} onClick={() => setPeriod(p)}>
              {t.stats.periods[p]}
            </button>
          ))}
        </div>

        <div
          className={`${styles.verdict} ${verdict === 'losing' ? styles.verdictBad : verdict === 'profitable' ? styles.verdictGood : ''}`}
          data-testid="business-verdict"
        >
          <span className={styles.verdictIcon} aria-hidden="true">
            {verdict === 'profitable' ? '✓' : verdict === 'losing' ? '!' : 'i'}
          </span>
          <span>
            {verdictText}
            {signedPct(vs) && <span className={s.muted}> ({t.stats.vsPrevious(signedPct(vs)!)})</span>}
          </span>
        </div>

        <div className={styles.kpis}>
          <Kpi label={t.stats.sold} value={formatPEN(sum.sales)} sub={t.stats.avgTicket(formatPEN(sum.avgTicket))} />
          <Kpi label={t.stats.grossProfit} value={formatPEN(sum.grossProfit)} sub={t.stats.margin(fmtPct(sum.grossMarginPct))} />
          <Kpi
            label={t.stats.expenses}
            value={formatPEN(-(sum.expenses + sum.fixedCosts))}
            sub={sum.fixedCosts > 0 ? t.stats.fixedPart(formatPEN(sum.fixedCosts)) : undefined}
          />
          <Kpi
            label={t.stats.netProfit}
            value={formatPEN(sum.netProfit, { sign: sum.netProfit !== 0 })}
            sub={t.stats.margin(fmtPct(sum.netMarginPct))}
            testId="net-profit"
          />
        </div>
        {sum.haggle > 0 && (
          <p className={s.muted}>
            {t.stats.haggleGiven}: <span className="mono">{formatPEN(sum.haggle)}</span>
          </p>
        )}
        {settings.fixedMonthlyCosts === 0 && <p className={s.muted}>{t.stats.fixedHint}</p>}

        <div className={s.card}>
          <div className={s.label} style={{ marginBottom: 6 }}>
            {monthly ? t.stats.chartMonthTitle : t.stats.chartTitle}
          </div>
          <BarChart points={points} name={monthly ? t.stats.chartMonthTitle : t.stats.chartTitle} />
        </div>

        <div className={styles.sectionHead}>
          <span className={s.label}>{t.stats.products}</span>
          <div className={s.segment} role="group" aria-label={t.stats.products} style={{ flex: '0 0 auto' }}>
            <button type="button" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>
              {t.stats.filterAll}
            </button>
            <button type="button" aria-pressed={filter === 'review'} onClick={() => setFilter('review')}>
              {t.stats.filterReview} ({reviewCount})
            </button>
          </div>
        </div>
        {shown.length === 0 && <p className={s.muted}>{t.stats.noProducts}</p>}
        <ul className={styles.productList} aria-label={t.stats.products}>
          {shown.map((r) => (
            <ProductItem
              key={r.productId}
              row={r}
              open={open === r.productId}
              onToggle={() => setOpen(open === r.productId ? null : r.productId)}
            />
          ))}
        </ul>
      </div>
    </div>
  );
}

function ProductItem({ row: r, open, onToggle }: { row: ProductRow; open: boolean; onToggle: () => void }) {
  const tone = REVIEW.has(r.verdict) ? styles.chipBad : r.verdict === 'star' ? styles.chipStar : styles.chipOk;
  return (
    <li>
      <button type="button" className={styles.productRow} aria-expanded={open} onClick={onToggle}>
        <span className={styles.productTop}>
          <span className={styles.productName}>{r.name}</span>
          <span className={`${styles.verdictChip} ${tone}`}>
            <span aria-hidden="true">{VERDICT_ICON[r.verdict]}</span> {t.stats.verdicts[r.verdict]}
          </span>
        </span>
        <span className={styles.productNums}>
          <span className="mono">{formatPEN(r.profit, { sign: r.profit !== 0 })}</span>
          <span className={styles.muted}>{t.stats.margin(fmtPct(r.marginPct))}</span>
        </span>
        {/* Parte de la ganancia total: una sola serie, un solo tono. */}
        <span className={styles.shareTrack} aria-hidden="true">
          <span className={styles.shareBar} style={{ width: `${Math.min(100, r.profitSharePct)}%` }} />
        </span>
        <span className={styles.productMeta}>
          {t.stats.unitsSold(r.units, fmtPct(r.units))} · {t.stats.sold.toLowerCase()} {formatPEN(r.sales)} ·{' '}
          {t.stats.share(fmtPct(r.profitSharePct))}
        </span>
        {open && (
          <span className={styles.advice}>
            {t.stats.advice[r.verdict]}
            <br />
            {r.daysOfStock !== null && `${t.stats.stockDays(fmtPct(Math.round(r.daysOfStock)))} · `}
            {t.stats.stockValue(formatPEN(r.stockValue))}
          </span>
        )}
      </button>
    </li>
  );
}
