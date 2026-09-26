import { useState, type ReactNode } from 'react';
import { abcClassify, bcgMatrix, breakEven, gmroi, inventoryTurnover, type AbcItem, type BcgPoint } from '../../domain/economics';
import { formatPEN } from '../../domain/money';
import type { ProductRow, Summary } from '../../domain/profit';
import { t } from '../../i18n/es-PE';
import { Meter } from '../../ui/Meter';
import { ParetoChart } from '../../ui/ParetoChart';
import { ScatterChart } from '../../ui/ScatterChart';
import s from '../../ui/Screen.module.css';
import styles from './Stats.module.css';
import { fmtPct, signedPct } from './useReport';

export interface Economics {
  be: ReturnType<typeof breakEven>;
  abc: AbcItem[];
  abcById: Map<string, AbcItem>;
  bcg: { points: BcgPoint[]; shareThreshold: number } | null;
  bcgById: Map<string, BcgPoint>;
  gmroiBusiness: number | null;
  turnoverBusiness: number | null;
  gmroiById: Map<string, { gmroi: number | null; turnover: number | null }>;
}

/** Calcula todos los indicadores del periodo (puro, sin BD). */
export function computeEconomics(sum: Summary, rows: ProductRow[], prevRows: ProductRow[] | null, days: number): Economics {
  const be = breakEven(sum.sales, sum.grossProfit, sum.expenses + sum.fixedCosts, days);
  const abc = abcClassify(rows.filter((r) => r.sales > 0).map((r) => ({ id: r.productId, value: r.profit })));
  const prev = new Map((prevRows ?? []).map((r) => [r.productId, r]));
  const bcg = prevRows
    ? bcgMatrix(
        rows.map((r) => ({ id: r.productId, profit: r.profit, sales: r.sales, prevSales: prev.get(r.productId)?.sales ?? 0 })),
      )
    : null;
  const totalStock = rows.reduce((a, r) => a + r.stockValue, 0);
  return {
    be,
    abc,
    abcById: new Map(abc.map((i) => [i.id, i])),
    bcg,
    bcgById: new Map((bcg?.points ?? []).map((p) => [p.id, p])),
    gmroiBusiness: gmroi(sum.grossProfit, totalStock, days),
    turnoverBusiness: inventoryTurnover(sum.cost, totalStock, days),
    gmroiById: new Map(
      rows.map((r) => [
        r.productId,
        { gmroi: gmroi(r.profit, r.stockValue, days), turnover: inventoryTurnover(r.sales - r.profit, r.stockValue, days) },
      ]),
    ),
  };
}

function Section({ title, theory, children, testId }: { title: string; theory: string; children: ReactNode; testId?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <section className={s.card} data-testid={testId}>
      <div className={styles.sectionHead}>
        <h3 className={styles.econTitle}>{title}</h3>
        <button type="button" className={styles.theoryBtn} aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? t.econ.hide : t.econ.whatIs}
        </button>
      </div>
      {open && <p className={styles.theory}>{theory}</p>}
      {children}
    </section>
  );
}

const num = (n: number) => n.toLocaleString('es-PE', { maximumFractionDigits: 1 });

export function EconomicAnalysis({ econ, rows, names }: { econ: Economics; rows: ProductRow[]; names: Map<string, string> }) {
  const { be, abc, bcg } = econ;
  const nameOf = (id: string) => names.get(id) ?? '';
  const aItems = abc.filter((i) => i.cls === 'A');
  const aShare = aItems.reduce((x, i) => x + i.sharePct, 0);
  const counts = { star: 0, cash_cow: 0, question: 0, dog: 0 };
  for (const p of bcg?.points ?? []) counts[p.quadrant]++;

  return (
    <>
      <h2 className={styles.econHeading}>{t.econ.title}</h2>

      <Section title={t.econ.breakEven.title} theory={t.econ.breakEven.theory} testId="break-even">
        {be.fixedCosts <= 0 ? (
          <p className={s.muted}>{t.econ.breakEven.noFixed}</p>
        ) : be.breakEvenDaily === null ? (
          <p className={styles.bad}>{t.econ.breakEven.noMargin}</p>
        ) : (
          <>
            <p className={styles.econLead}>{t.econ.breakEven.needDaily(formatPEN(be.breakEvenDaily))}</p>
            <Meter
              value={be.actualDaily}
              target={be.breakEvenDaily}
              valueLabel={t.econ.breakEven.actualDaily(formatPEN(be.actualDaily))}
              targetLabel={t.econ.breakEven.target(formatPEN(be.breakEvenDaily))}
              name={t.econ.breakEven.title}
            />
            {be.safetyMargin !== null && be.safetyMargin >= 0 ? (
              <p className={styles.good}>✓ {t.econ.breakEven.safety(fmtPct(be.safetyMargin * 100))}</p>
            ) : (
              <p className={styles.bad}>! {t.econ.breakEven.danger(fmtPct(Math.abs((be.safetyMargin ?? 0) * 100)))}</p>
            )}
            <p className={s.muted}>{t.econ.breakEven.ratio(fmtPct(be.contributionRatio * 100))}</p>
          </>
        )}
      </Section>

      {abc.length > 0 && (
        <Section title={t.econ.abc.title} theory={t.econ.abc.theory} testId="abc">
          <p className={styles.econLead}>{t.econ.abc.summary(aItems.length, abc.length, fmtPct(aShare))}</p>
          <ParetoChart
            name={t.econ.abc.title}
            rows={abc.slice(0, 12).map((i) => ({
              id: i.id,
              name: nameOf(i.id),
              sharePct: i.sharePct,
              cumulativePct: i.cumulativePct,
              cls: i.cls,
              valueLabel: formatPEN(i.value, { sign: true }),
            }))}
          />
        </Section>
      )}

      <Section title={t.econ.bcg.title} theory={t.econ.bcg.theory} testId="bcg">
        {!bcg ? (
          <p className={s.muted}>{t.econ.bcg.needPeriod}</p>
        ) : (
          <>
            <p className={styles.econLead}>{t.econ.bcg.counts(counts.star, counts.cash_cow, counts.question, counts.dog)}</p>
            <ScatterChart
              name={t.econ.bcg.title}
              xLabel={t.econ.bcg.xLabel}
              yLabel={t.econ.bcg.yLabel}
              quadrants={t.econ.bcg.quadrants}
              xThreshold={bcg.shareThreshold}
              points={bcg.points.map((p) => ({
                id: p.id,
                label: nameOf(p.id).split(' ')[0] ?? '',
                x: p.sharePct,
                y: p.growthPct,
                detail: `${t.econ.bcg.names[p.quadrant]} · ${t.econ.bcg.detail(
                  fmtPct(p.sharePct),
                  p.growthPct === null ? t.econ.bcg.isNew : t.econ.bcg.growth(signedPct(p.growthPct) ?? ''),
                )}`,
              }))}
            />
          </>
        )}
      </Section>

      <Section title={t.econ.gmroi.title} theory={t.econ.gmroi.theory} testId="gmroi">
        {econ.gmroiBusiness === null ? (
          <p className={s.muted}>{t.econ.gmroi.noStock}</p>
        ) : (
          <p className={styles.econLead}>{t.econ.gmroi.business(num(econ.gmroiBusiness), num(econ.turnoverBusiness ?? 0))}</p>
        )}
        {rows.length > 0 && (
          <table className={styles.econTable}>
            <thead>
              <tr>
                <th>Producto</th>
                <th>GMROI</th>
                <th>Rotación</th>
              </tr>
            </thead>
            <tbody>
              {rows
                .map((r) => ({ r, g: econ.gmroiById.get(r.productId) }))
                .sort((x, y) => (y.g?.gmroi ?? -1) - (x.g?.gmroi ?? -1))
                .map(({ r, g }) => (
                  <tr
                    key={r.productId}
                    className={g?.gmroi !== null && g?.gmroi !== undefined && g.gmroi < 1 ? styles.rowBad : ''}
                  >
                    <td>{r.name}</td>
                    <td className="mono">
                      {g?.gmroi === null || g?.gmroi === undefined ? '—' : `${num(g.gmroi)}${g.gmroi < 1 ? ' ↓' : ''}`}
                    </td>
                    <td className="mono">{g?.turnover === null || g?.turnover === undefined ? '—' : `${num(g.turnover)}×`}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}
      </Section>
    </>
  );
}
