import { useLiveQuery } from 'dexie-react-hooks';
import { useStats } from '../../app/stats';
import { salesByHour } from '../../domain/cash';
import { formatPEN } from '../../domain/money';
import type { SaleTicket } from '../../domain/profit';
import { decayed } from '../../domain/stats';
import { dayKeyOf, hourOf } from '../../domain/time';
import { db } from '../../db/schema';
import { t } from '../../i18n/es-PE';
import { BarChart } from '../../ui/BarChart';
import s from '../../ui/Screen.module.css';
import styles from './Stats.module.css';

/** Ventas por hora, pares que se compran juntos, deudores y vendedores (SPEC §12). */
export function MoreStats({ sales, fromKey, names }: { sales: SaleTicket[]; fromKey: string; names: Map<string, string> }) {
  const stats = useStats();
  const byHour = salesByHour(sales.map((x) => ({ hour: hourOf(x.closedAt), total: x.total })));
  const firstHour = byHour.findIndex((v) => v > 0);
  const lastHour = 23 - [...byHour].reverse().findIndex((v) => v > 0);
  const hours = firstHour < 0 ? [] : byHour.slice(firstHour, lastHour + 1).map((v, i) => ({ h: firstHour + i, v }));

  const now = Date.now();
  const pairs = [...stats.pairs.values()]
    .map((p) => ({ ...p, now: decayed(p.decayedCount, p.lastAt, now) }))
    .filter((p) => p.now >= 0.5 && names.has(p.a) && names.has(p.b))
    .sort((x, y) => y.now - x.now)
    .slice(0, 5);

  const data = useLiveQuery(async () => {
    const debtors = (await db.parties.toArray())
      .filter((p) => p.balance > 0)
      .sort((a, b) => b.balance - a.balance)
      .slice(0, 5);
    const settlements = (await db.settlements.toArray()).filter((x) => dayKeyOf(x.createdAt) >= fromKey);
    const lines = await db.settlementLines
      .where('settlementId')
      .anyOf(settlements.map((x) => x.id))
      .toArray();
    const partyOf = new Map(settlements.map((x) => [x.id, x.partyId]));
    const sellers = new Map<string, { sold: number; returned: number }>();
    for (const l of lines) {
      const pid = partyOf.get(l.settlementId)!;
      const acc = sellers.get(pid) ?? { sold: 0, returned: 0 };
      acc.sold += l.lineTotal;
      acc.returned += l.qtyReturned * l.agreedPrice;
      sellers.set(pid, acc);
    }
    const partyNames = new Map((await db.parties.toArray()).map((p) => [p.id, p.name]));
    return {
      debtors,
      sellers: [...sellers.entries()]
        .map(([id, v]) => ({ id, name: partyNames.get(id) ?? '', ...v }))
        .sort((a, b) => b.sold - a.sold),
    };
  }, [fromKey]);

  return (
    <>
      <h2 className={styles.econHeading}>{t.stats.more}</h2>
      <section className={s.card}>
        <h3 className={styles.econTitle}>{t.stats.byHour}</h3>
        {hours.length === 0 ? (
          <p className={s.muted}>{t.stats.none}</p>
        ) : (
          <BarChart
            name={t.stats.byHour}
            signed={false}
            points={hours.map(({ h, v }) => ({ key: String(h), label: String(h), title: `${h}:00 – ${h + 1}:00`, value: v }))}
          />
        )}
      </section>

      <section className={s.card}>
        <h3 className={styles.econTitle}>{t.stats.pairs}</h3>
        <p className={s.muted}>{t.stats.pairsHint}</p>
        {pairs.length === 0 && <p className={s.muted}>{t.stats.none}</p>}
        {pairs.map((p) => (
          <div key={p.key} className={styles.topRow}>
            <span>
              {names.get(p.a)} + {names.get(p.b)}
            </span>
            <span className="mono">{p.now.toLocaleString('es-PE', { maximumFractionDigits: 0 })}×</span>
          </div>
        ))}
      </section>

      <section className={s.card}>
        <h3 className={styles.econTitle}>{t.stats.topDebtors}</h3>
        {(data?.debtors.length ?? 0) === 0 && <p className={s.muted}>{t.stats.none}</p>}
        {data?.debtors.map((p) => (
          <div key={p.id} className={styles.topRow}>
            <span>{p.name}</span>
            <span className={`mono ${styles.negative}`}>{formatPEN(p.balance)}</span>
          </div>
        ))}
      </section>

      <section className={s.card}>
        <h3 className={styles.econTitle}>{t.stats.sellers}</h3>
        {(data?.sellers.length ?? 0) === 0 && <p className={s.muted}>{t.stats.none}</p>}
        {data?.sellers.map((x) => (
          <div key={x.id} className={styles.topRow}>
            <span>{x.name}</span>
            <span className="mono">{t.stats.sellerRow(formatPEN(x.sold), formatPEN(x.returned))}</span>
          </div>
        ))}
      </section>
    </>
  );
}
