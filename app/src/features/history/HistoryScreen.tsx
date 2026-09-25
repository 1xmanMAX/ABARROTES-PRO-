import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { formatPEN } from '../../domain/money';
import { formatQty } from '../../domain/qty';
import { dayKeyOf, formatDateTime } from '../../domain/time';
import { db } from '../../db/schema';
import { getTicketWithLines, voidTicket } from '../../db/tickets';
import type { Ticket } from '../../db/types';
import { t } from '../../i18n/es-PE';
import { usePrint } from '../../print/printStore';
import { afterSalesChange } from '../sell/sellStore';
import { Button } from '../../ui/Button';
import { ScreenHeader } from '../../ui/ScreenHeader';
import { Sheet } from '../../ui/Sheet';
import s from '../../ui/Screen.module.css';
import { toast, toastError } from '../../ui/toast';
import styles from './History.module.css';

const LIMIT = 200;

export default function HistoryScreen() {
  const tickets = useLiveQuery(
    () =>
      db.tickets
        .orderBy('closedAt')
        .reverse()
        .filter((tk) => tk.status !== 'open')
        .limit(LIMIT)
        .toArray(),
    [],
  );
  const [selected, setSelected] = useState<string | null>(null);
  const today = dayKeyOf(Date.now());
  const todayTotal = (tickets ?? [])
    .filter((tk) => tk.dayKey === today && tk.status === 'paid')
    .reduce((a, tk) => a + tk.total, 0);

  return (
    <div className={s.screen}>
      <ScreenHeader title={t.history.title} />
      <div className={s.content}>
        <div className={`${s.card} ${styles.summary}`}>
          <span>
            {t.history.dayTotal} ({t.history.today})
          </span>
          <span className="mono">{formatPEN(todayTotal)}</span>
        </div>
        {tickets && tickets.length === 0 && <p className={s.empty}>{t.history.empty}</p>}
        {tickets?.map((tk) => (
          <button key={tk.id} type="button" className={styles.row} onClick={() => setSelected(tk.id)}>
            <span className={styles.num}>#{String(tk.number).padStart(4, '0')}</span>
            <span className={styles.meta}>
              <span>{formatDateTime(tk.closedAt ?? tk.createdAt)}</span>
              <span className={s.muted}>{tk.paymentMethod ? t.receipt.methods[tk.paymentMethod] : ''}</span>
            </span>
            <span className={`mono ${tk.status === 'void' ? styles.void : ''}`}>{formatPEN(tk.total)}</span>
            {tk.status === 'void' && <span className={styles.voidBadge}>{t.history.status.void}</span>}
          </button>
        ))}
      </div>
      {selected && <TicketDetail ticketId={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function TicketDetail({ ticketId, onClose }: { ticketId: string; onClose: () => void }) {
  const data = useLiveQuery(() => getTicketWithLines(ticketId), [ticketId]);
  const [voiding, setVoiding] = useState(false);
  const [reason, setReason] = useState('');
  if (!data) return null;
  const { ticket, lines } = data;
  const isToday = ticket.dayKey === dayKeyOf(Date.now());

  const doVoid = async () => {
    try {
      await voidTicket(ticket.id, reason);
      void afterSalesChange();
      toast(t.history.voided, 'success');
      setVoiding(false);
    } catch (err) {
      toastError(err);
    }
  };

  return (
    <Sheet
      title={`${t.receipt.ticket} #${String(ticket.number).padStart(4, '0')}`}
      onClose={onClose}
      footer={
        voiding ? (
          <>
            <input
              className={s.input}
              autoFocus
              placeholder={t.history.voidReason}
              aria-label={t.history.voidReason}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <Button variant="danger" block disabled={!reason.trim()} onClick={doVoid}>
              {t.history.voidConfirm}
            </Button>
          </>
        ) : (
          <>
            <Button variant="primary" block onClick={() => usePrint.getState().print(ticket, lines)}>
              {t.history.reprint}
            </Button>
            {ticket.status === 'paid' &&
              (isToday ? (
                <Button variant="danger" block onClick={() => setVoiding(true)}>
                  {t.history.void}
                </Button>
              ) : (
                <p className={s.muted}>{t.history.ownerOnly}</p>
              ))}
          </>
        )
      }
    >
      <TicketSummary ticket={ticket} />
      {lines.map((l) => (
        <div key={l.id} className={styles.line}>
          <span>
            {l.productName} × {formatQty({ allowsFraction: l.fractional }, l.qty)}
            {l.priceOverrideReason && <span className={s.muted}> ({l.priceOverrideReason})</span>}
          </span>
          <span className="mono">{formatPEN(l.lineTotal)}</span>
        </div>
      ))}
      <div className={`${styles.line} ${styles.total}`}>
        <span>{t.receipt.total}</span>
        <span className="mono">{formatPEN(ticket.total)}</span>
      </div>
    </Sheet>
  );
}

function TicketSummary({ ticket }: { ticket: Ticket }) {
  return (
    <div className={s.muted}>
      {formatDateTime(ticket.closedAt ?? ticket.createdAt)} · {ticket.label} ·{' '}
      {ticket.paymentMethod ? t.receipt.methods[ticket.paymentMethod] : ''}
      {ticket.status === 'void' && (
        <strong className={styles.void}>
          {' '}
          · {t.history.status.void}: {ticket.voidReason}
        </strong>
      )}
    </div>
  );
}
