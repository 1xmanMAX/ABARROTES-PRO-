import { useMemo, useState } from 'react';
import { useProductMap, useProducts, useSettings } from '../../app/data';
import { useNav } from '../../app/nav';
import { formatPEN } from '../../domain/money';
import { changePct, productReport, summarize } from '../../domain/profit';
import { formatTime, lastDayKeys, dayKeyOf, formatDayKey } from '../../domain/time';
import { useLiveQuery } from 'dexie-react-hooks';
import { cashBalance } from '../../domain/cash';
import { backupDue, daysSince } from '../../domain/backup';
import { isOverdue, pendingValue } from '../../domain/consignment';
import { formatQty } from '../../domain/qty';
import { getOpenConsignments } from '../../db/consignments';
import { db } from '../../db/schema';
import { voidExpense } from '../../db/cash';
import { toExpenses } from '../../db/reports';
import type { CashMovement } from '../../db/types';
import { t } from '../../i18n/es-PE';
import { Button } from '../../ui/Button';
import { ScreenHeader } from '../../ui/ScreenHeader';
import { Sheet } from '../../ui/Sheet';
import s from '../../ui/Screen.module.css';
import { toast, toastError } from '../../ui/toast';
import { ExpenseSheet } from './ExpenseSheet';
import styles from './Stats.module.css';
import { fmtPct, signedPct, useSalesSince } from './useReport';

/** Resumen del día: lo que se vendió, lo que se ganó y los gastos. */
export default function TodayScreen() {
  const push = useNav((st) => st.push);
  const settings = useSettings();
  const products = useProducts();
  const productMap = useProductMap(products);
  const [yesterday, today] = lastDayKeys(2, Date.now()) as [string, string];
  const data = useSalesSince(yesterday);
  const [adding, setAdding] = useState(false);
  // Resumen del negocio (SPEC §12): caja, por cobrar, consignación, stock bajo y entregas vencidas.
  const extra = useLiveQuery(async () => {
    const [moves, parties, open] = await Promise.all([db.cashMovements.toArray(), db.parties.toArray(), getOpenConsignments()]);
    return {
      cash: cashBalance(moves, 'cash'),
      receivable: parties.reduce((a, p) => a + Math.max(0, p.balance), 0),
      consigned: open.reduce((a, o) => a + pendingValue(o.lines), 0),
      overdue: open.filter((o) => isOverdue(o.consignment.dueDate, Date.now())),
    };
  }, []);
  const lowStock = products.filter((p) => p.active && p.stock <= p.minStock);
  const [voiding, setVoiding] = useState<CashMovement | null>(null);

  const view = useMemo(() => {
    if (!data) return null;
    const salesToday = data.sales.filter((x) => x.dayKey === today);
    const salesYesterday = data.sales.filter((x) => x.dayKey === yesterday);
    const expToday = data.expenses.filter((m) => m.dayKey === today);
    const sum = summarize(salesToday, toExpenses(expToday), settings.fixedMonthlyCosts, 1);
    const prev = summarize(salesYesterday, [], 0, 1);
    const top = productReport(salesToday, products, 1)
      .filter((r) => r.units > 0)
      .slice(0, 3);
    return { sum, expToday, top, vsYesterday: changePct(sum.grossProfit, prev.grossProfit) };
  }, [data, today, yesterday, settings.fixedMonthlyCosts, products]);

  if (!view) return null;
  const { sum, expToday, top, vsYesterday } = view;
  const hasCosts = sum.expenses > 0 || sum.fixedCosts > 0;

  return (
    <div className={s.screen}>
      <ScreenHeader title={t.stats.todayTitle} />
      <div className={s.content}>
        {backupDue(settings.lastBackupAt, products.length > 0, Date.now()) && (
          <Button variant="danger" block onClick={() => push({ name: 'backup' })}>
            {t.menu.backupDue(
              settings.lastBackupAt ? t.backup.ago(daysSince(settings.lastBackupAt, Date.now())) : t.backup.neverShort,
            )}
          </Button>
        )}

        <div className={styles.hero}>
          <div className={s.label}>{t.stats.netToday}</div>
          <div className={`${styles.heroValue} ${sum.netProfit < 0 ? styles.negative : ''}`} data-testid="net-today">
            {formatPEN(sum.netProfit, { sign: sum.netProfit !== 0 })}
          </div>
          <div className={s.muted}>{hasCosts ? t.stats.afterExpenses : t.stats.grossOnly}</div>
        </div>

        <div className={styles.kpis}>
          <Kpi
            label={t.stats.sold}
            value={formatPEN(sum.sales)}
            sub={t.stats.avgTicket(formatPEN(sum.avgTicket))}
            testId="sold-today"
          />
          <Kpi
            label={t.stats.grossProfit}
            value={formatPEN(sum.grossProfit)}
            sub={
              signedPct(vsYesterday) ? t.stats.vsYesterday(signedPct(vsYesterday)!) : t.stats.margin(fmtPct(sum.grossMarginPct))
            }
          />
          <Kpi
            label={t.stats.expenses}
            value={formatPEN(-(sum.expenses + sum.fixedCosts))}
            sub={sum.fixedCosts > 0 ? t.stats.fixedPart(formatPEN(sum.fixedCosts)) : undefined}
          />
          <Kpi
            label={t.stats.sales}
            value={String(sum.tickets)}
            sub={sum.haggle > 0 ? `${t.stats.haggleGiven}: ${formatPEN(sum.haggle)}` : undefined}
          />
        </div>

        {extra && (
          <div className={styles.kpis}>
            <button type="button" className={styles.kpiBtn} onClick={() => push({ name: 'cash' })}>
              <Kpi label={t.stats.cashNow} value={formatPEN(extra.cash)} testId="home-cash" />
            </button>
            <button type="button" className={styles.kpiBtn} onClick={() => push({ name: 'parties' })}>
              <Kpi label={t.stats.receivable} value={formatPEN(extra.receivable)} sub={t.stats.receivableSub} />
            </button>
            <Kpi label={t.stats.consigned} value={formatPEN(extra.consigned)} />
            <Kpi label={t.stats.lowStock} value={String(lowStock.length)} />
          </div>
        )}

        <Button variant="primary" block onClick={() => push({ name: 'profit' })}>
          {t.stats.seeProfit}
        </Button>

        {extra && extra.overdue.length > 0 && (
          <>
            <div className={s.label}>{t.stats.overdue}</div>
            {extra.overdue.map((o) => (
              <button
                key={o.consignment.id}
                type="button"
                className={styles.topRow}
                onClick={() => push({ name: 'party', id: o.consignment.partyId })}
              >
                <span>
                  {o.consignment.partyName} · {t.consign.due(formatDayKey(dayKeyOf(o.consignment.dueDate)))}
                </span>
                <span className={`mono ${styles.negative}`}>{formatPEN(pendingValue(o.lines))}</span>
              </button>
            ))}
          </>
        )}
        {lowStock.length > 0 && (
          <>
            <div className={s.label}>{t.stats.lowStock}</div>
            {lowStock.map((p) => (
              <button key={p.id} type="button" className={styles.topRow} onClick={() => push({ name: 'product', id: p.id })}>
                <span>{p.name}</span>
                <span className={`mono ${styles.negative}`}>{formatQty(p, p.stock)}</span>
              </button>
            ))}
          </>
        )}

        <div className={styles.sectionHead}>
          <span className={s.label}>{t.stats.todayExpenses}</span>
          <Button onClick={() => setAdding(true)}>{t.stats.addExpense}</Button>
        </div>
        {expToday.length === 0 && <p className={s.muted}>{t.stats.noExpenses}</p>}
        {expToday.map((m) => (
          <div key={m.id} className={`${styles.expRow} ${m.voidedAt ? styles.voided : ''}`}>
            <span className={styles.expMain}>
              <span>{t.expense.categories[m.category ?? 'otros']}</span>
              <span className={s.muted}>
                {formatTime(m.createdAt)}
                {m.note && ` · ${m.note}`}
                {m.voidReason && ` · ${m.voidReason}`}
              </span>
            </span>
            <span className="mono">{formatPEN(m.amount)}</span>
            {!m.voidedAt && (
              <button type="button" className={styles.linkBtn} onClick={() => setVoiding(m)}>
                {t.expense.void}
              </button>
            )}
          </div>
        ))}
        {settings.fixedMonthlyCosts === 0 && <p className={s.muted}>{t.stats.fixedHint}</p>}

        <div className={s.label}>{t.stats.topToday}</div>
        {top.length === 0 && <p className={s.muted}>{t.stats.noSalesToday}</p>}
        {top.map((r) => (
          <div key={r.productId} className={styles.topRow}>
            <span>
              {productMap.get(r.productId)?.name ?? r.name}
              <span className={s.muted}> · {t.stats.unitsSold(r.units, fmtPct(r.units))}</span>
            </span>
            <span className="mono">{formatPEN(r.profit, { sign: true })}</span>
          </div>
        ))}
      </div>
      {adding && <ExpenseSheet onClose={() => setAdding(false)} />}
      {voiding && <VoidExpenseSheet movement={voiding} onClose={() => setVoiding(null)} />}
    </div>
  );
}

export function Kpi({ label, value, sub, testId }: { label: string; value: string; sub?: string; testId?: string }) {
  return (
    <div className={styles.kpi}>
      <div className={styles.kpiLabel}>{label}</div>
      <div className={styles.kpiValue} data-testid={testId}>
        {value}
      </div>
      {sub && <div className={styles.kpiSub}>{sub}</div>}
    </div>
  );
}

function VoidExpenseSheet({ movement, onClose }: { movement: CashMovement; onClose: () => void }) {
  const [reason, setReason] = useState('');
  return (
    <Sheet
      title={`${t.expense.void} · ${formatPEN(-movement.amount)}`}
      onClose={onClose}
      footer={
        <Button
          variant="danger"
          block
          disabled={!reason.trim()}
          onClick={() =>
            voidExpense(movement.id, reason).then(() => {
              toast(t.expense.voided, 'success');
              onClose();
            }, toastError)
          }
        >
          {t.expense.void}
        </Button>
      }
    >
      <input
        className={s.input}
        autoFocus
        placeholder={t.expense.voidReason}
        aria-label={t.expense.voidReason}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
    </Sheet>
  );
}
