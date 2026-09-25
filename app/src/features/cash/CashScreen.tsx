import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { useNav } from '../../app/nav';
import { cashBalance, closeDifference, dayFlow } from '../../domain/cash';
import { formatPEN, parseSolesToCents } from '../../domain/money';
import { dayKeyOf, formatDateTime, lastDayKeys } from '../../domain/time';
import { closeDay, registerCashMovement, voidManualMovement, type ManualCashType } from '../../db/cash';
import { db } from '../../db/schema';
import type { CashMovement } from '../../db/types';
import { t } from '../../i18n/es-PE';
import { Button } from '../../ui/Button';
import { NumPad } from '../../ui/NumPad';
import { ScreenHeader } from '../../ui/ScreenHeader';
import { Sheet } from '../../ui/Sheet';
import s from '../../ui/Screen.module.css';
import { toast, toastError } from '../../ui/toast';
import { ExpenseSheet } from '../stats/ExpenseSheet';
import styles from './Cash.module.css';

type Range = 'today' | '7' | '30' | 'all';
const TYPE_FILTERS = [
  'all',
  'sale',
  'debt_payment',
  'settlement_payment',
  'purchase',
  'expense',
  'withdrawal',
  'contribution',
] as const;
const MANUAL = new Set(['expense', 'withdrawal', 'contribution', 'opening']);

/** Caja (SPEC §11): saldo esperado, movimientos, compras, gastos, retiros, aportes y cierre. */
export default function CashScreen() {
  const push = useNav((st) => st.push);
  const movements = useLiveQuery(() => db.cashMovements.toArray(), []) ?? [];
  const todayClose = useLiveQuery(() => db.dayCloses.where('dayKey').equals(dayKeyOf(Date.now())).first(), []);
  const [range, setRange] = useState<Range>('today');
  const [type, setType] = useState<(typeof TYPE_FILTERS)[number]>('all');
  const [sheet, setSheet] = useState<null | 'expense' | 'close' | ManualCashType>(null);
  const [voiding, setVoiding] = useState<CashMovement | null>(null);

  const today = dayKeyOf(Date.now());
  const expected = cashBalance(movements, 'cash');
  const flow = dayFlow(movements, today, 'cash');
  const digitalToday = dayFlow(movements, today, 'digital').inflow;
  const neverOpened = !movements.some((m) => m.type === 'opening' && !m.voidedAt);

  const list = useMemo(() => {
    const from = range === 'today' ? today : range === 'all' ? null : lastDayKeys(Number(range), Date.now())[0]!;
    return movements
      .filter((m) => (from === null || m.dayKey >= from) && (type === 'all' || m.type === type))
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [movements, range, type, today]);

  return (
    <div className={s.screen}>
      <ScreenHeader title={t.cash.title} />
      <div className={s.content}>
        <div className={styles.hero}>
          <div className={s.label}>{t.cash.expected}</div>
          <div className={styles.heroValue} data-testid="cash-expected">
            {formatPEN(expected)}
          </div>
          <div className={s.muted}>
            {t.cash.todayIn}: <span className="mono">{formatPEN(flow.inflow)}</span> · {t.cash.todayOut}:{' '}
            <span className="mono">{formatPEN(flow.outflow)}</span>
          </div>
          <div className={s.muted}>
            {t.cash.digital}: <span className="mono">{formatPEN(digitalToday)}</span>
          </div>
        </div>

        <div className={styles.actions}>
          <Button variant="primary" onClick={() => push({ name: 'purchase' })}>
            {t.cash.purchase}
          </Button>
          <Button onClick={() => setSheet('expense')}>{t.cash.expense}</Button>
          <Button onClick={() => setSheet('withdrawal')}>{t.cash.withdrawal}</Button>
          <Button onClick={() => setSheet('contribution')}>{t.cash.contribution}</Button>
          {neverOpened && <Button onClick={() => setSheet('opening')}>{t.cash.opening}</Button>}
          <Button variant="plain" disabled={!!todayClose} onClick={() => setSheet('close')}>
            {t.cash.close}
          </Button>
        </div>
        {todayClose && (
          <p className={s.muted}>
            {t.cash.closedToday(formatPEN(todayClose.countedCash), formatPEN(todayClose.difference, { sign: true }))}
          </p>
        )}

        <div className={s.label}>{t.cash.movements}</div>
        <div className={s.segment} role="group" aria-label="Rango">
          {(['today', '7', '30', 'all'] as Range[]).map((r) => (
            <button key={r} type="button" aria-pressed={range === r} onClick={() => setRange(r)}>
              {t.cash.ranges[r]}
            </button>
          ))}
        </div>
        <div className={styles.chips} role="group" aria-label="Tipo">
          {TYPE_FILTERS.map((ty) => (
            <button key={ty} type="button" className={styles.chip} aria-pressed={type === ty} onClick={() => setType(ty)}>
              {t.cash.types[ty]}
            </button>
          ))}
        </div>
        {list.length === 0 && <p className={s.muted}>{t.cash.noMovements}</p>}
        <ul className={styles.moves} aria-label={t.cash.movements}>
          {list.slice(0, 300).map((m) => (
            <li key={m.id} className={`${styles.move} ${m.voidedAt ? styles.voided : ''}`}>
              <span className={styles.moveMain}>
                <span className={styles.moveType}>
                  {t.cash.types[m.type] ?? m.type}
                  {m.method === 'digital' && <span className={styles.badge}>Yape/Plin</span>}
                </span>
                <span className={s.muted}>
                  {formatDateTime(m.createdAt)}
                  {m.category && ` · ${t.expense.categories[m.category]}`}
                  {m.note && ` · ${m.note}`}
                  {m.voidReason && ` · ${m.voidReason}`}
                </span>
              </span>
              <span className={`mono ${m.amount < 0 ? styles.out : styles.in}`}>{formatPEN(m.amount, { sign: true })}</span>
              {MANUAL.has(m.type) && !m.voidedAt && (
                <button type="button" className={styles.linkBtn} onClick={() => setVoiding(m)}>
                  {t.cash.void}
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>

      {sheet === 'expense' && <ExpenseSheet onClose={() => setSheet(null)} />}
      {(sheet === 'withdrawal' || sheet === 'contribution' || sheet === 'opening') && (
        <ManualSheet type={sheet} cashAvailable={expected} onClose={() => setSheet(null)} />
      )}
      {sheet === 'close' && <CloseSheet expected={expected} onClose={() => setSheet(null)} />}
      {voiding && <VoidSheet movement={voiding} onClose={() => setVoiding(null)} />}
    </div>
  );
}

function ManualSheet({ type, cashAvailable, onClose }: { type: ManualCashType; cashAvailable: number; onClose: () => void }) {
  const [text, setText] = useState('');
  const [method, setMethod] = useState<'cash' | 'digital'>('cash');
  const [note, setNote] = useState('');
  const amount = parseSolesToCents(text || '0');
  const valid = amount !== null && amount > 0;
  const title = type === 'withdrawal' ? t.cash.withdrawal : type === 'contribution' ? t.cash.contribution : t.cash.opening;
  const hint =
    type === 'withdrawal' ? t.cash.withdrawalHint : type === 'contribution' ? t.cash.contributionHint : t.cash.openingHint;
  return (
    <Sheet
      title={title}
      onClose={onClose}
      footer={
        <Button
          variant="primary"
          block
          disabled={!valid}
          onClick={() =>
            amount !== null &&
            registerCashMovement(type, amount, method, note).then(() => {
              toast(t.cash.saved, 'success');
              onClose();
            }, toastError)
          }
        >
          {t.common.save} {valid ? `· ${formatPEN(amount)}` : ''}
        </Button>
      }
    >
      <p className={s.muted}>{hint}</p>
      {type === 'withdrawal' && <p className={s.muted}>{t.cash.noCashFor(formatPEN(cashAvailable))}</p>}
      <div className={styles.display}>S/ {text || '0'}</div>
      {type !== 'opening' && (
        <div className={s.segment} role="group" aria-label="Método">
          <button type="button" aria-pressed={method === 'cash'} onClick={() => setMethod('cash')}>
            {t.checkout.cash}
          </button>
          <button type="button" aria-pressed={method === 'digital'} onClick={() => setMethod('digital')}>
            {t.checkout.digital}
          </button>
        </div>
      )}
      <input
        className={s.input}
        placeholder={t.expense.note}
        aria-label={t.expense.note}
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <NumPad value={text} onChange={setText} decimals={2} />
    </Sheet>
  );
}

function CloseSheet({ expected, onClose }: { expected: number; onClose: () => void }) {
  const [text, setText] = useState('');
  const [note, setNote] = useState('');
  const counted = parseSolesToCents(text || '0');
  const diff = counted === null ? 0 : closeDifference(expected, counted);
  return (
    <Sheet
      title={t.cash.closeTitle}
      onClose={onClose}
      footer={
        <Button
          variant="primary"
          block
          disabled={counted === null || text === ''}
          onClick={() =>
            counted !== null &&
            closeDay(counted, note).then((r) => {
              toast(t.cash.closed(formatPEN(r.difference, { sign: true })), 'success');
              onClose();
            }, toastError)
          }
        >
          {t.cash.closeSave}
        </Button>
      }
    >
      <div className={styles.closeRow}>
        <span>{t.cash.expected}</span>
        <span className="mono">{formatPEN(expected)}</span>
      </div>
      <div className={styles.closeRow}>
        <span>{t.cash.counted}</span>
        <span className="mono">S/ {text || '0'}</span>
      </div>
      {text !== '' && (
        <div className={`${styles.diff} ${diff < 0 ? styles.out : diff > 0 ? styles.in : ''}`} data-testid="close-diff">
          {diff === 0
            ? `✓ ${t.cash.exact}`
            : diff > 0
              ? `+ ${t.cash.over(formatPEN(diff))}`
              : `− ${t.cash.short(formatPEN(-diff))}`}
        </div>
      )}
      <input
        className={s.input}
        placeholder={t.expense.note}
        aria-label={t.expense.note}
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <NumPad value={text} onChange={setText} decimals={2} />
    </Sheet>
  );
}

function VoidSheet({ movement, onClose }: { movement: CashMovement; onClose: () => void }) {
  const [reason, setReason] = useState('');
  return (
    <Sheet
      title={`${t.cash.void} · ${t.cash.types[movement.type]} ${formatPEN(movement.amount, { sign: true })}`}
      onClose={onClose}
      footer={
        <Button
          variant="danger"
          block
          disabled={!reason.trim()}
          onClick={() =>
            voidManualMovement(movement.id, reason).then(() => {
              toast(t.cash.voided, 'success');
              onClose();
            }, toastError)
          }
        >
          {t.cash.void}
        </Button>
      }
    >
      <input
        className={s.input}
        autoFocus
        placeholder={t.cash.voidReason}
        aria-label={t.cash.voidReason}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
    </Sheet>
  );
}
