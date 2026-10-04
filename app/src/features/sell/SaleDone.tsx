import { useEffect, useRef } from 'react';
import { create } from 'zustand';
import { changeBreakdown } from '../../domain/cashPieces';
import { formatPEN, type Cents } from '../../domain/money';
import { voidTicket } from '../../db/tickets';
import { t } from '../../i18n/es-PE';
import { ChangePieces } from '../../ui/CashPieces';
import { toast, toastError, vibrate } from '../../ui/toast';
import { afterSalesChange } from './sellStore';
import styles from './SaleDone.module.css';

export interface DoneSale {
  ticketId: string;
  total: Cents;
  received: Cents;
  change: Cents;
}

interface SaleDoneState {
  sale: DoneSale | null;
  show: (sale: DoneSale) => void;
  close: () => void;
}

export const useSaleDone = create<SaleDoneState>((set) => ({
  sale: null,
  show: (sale) => set({ sale }),
  close: () => set({ sale: null }),
}));

/**
 * Pantalla de vuelto: se queda hasta tocar "Listo". Evita el error más común al cobrar
 * en efectivo (dar mal el vuelto con apuro) y le dice a un niño qué billetes entregar.
 */
export function SaleDone() {
  const sale = useSaleDone((s) => s.sale);
  const close = useSaleDone((s) => s.close);
  const doneRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!sale) return;
    doneRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === 'Escape') {
        e.preventDefault();
        close();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sale, close]);

  if (!sale) return null;
  const breakdown = changeBreakdown(sale.change);

  const undo = () => {
    close();
    voidTicket(sale.ticketId, t.checkout.undoneReason).then(() => {
      vibrate([30, 40, 30]);
      toast(t.checkout.undone);
      void afterSalesChange();
    }, toastError);
  };

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true" aria-labelledby="sale-done-title">
      <div className={styles.card}>
        <div className={styles.head}>
          <span className={styles.check} aria-hidden="true">
            ✓
          </span>
          <h2 id="sale-done-title" className={styles.title}>
            {t.saleDone.title}
          </h2>
        </div>

        <dl className={styles.amounts}>
          <div>
            <dt>{t.saleDone.total}</dt>
            <dd className="mono">{formatPEN(sale.total)}</dd>
          </div>
          <div>
            <dt>{t.saleDone.received}</dt>
            <dd className="mono">{formatPEN(sale.received)}</dd>
          </div>
        </dl>

        <div className={styles.changeBox}>
          <div className={styles.changeLabel}>{t.saleDone.change}</div>
          <div className={styles.change} data-testid="done-change">
            {formatPEN(sale.change)}
          </div>
        </div>
        <ChangePieces change={sale.change} breakdown={breakdown} />

        <button ref={doneRef} type="button" className={styles.done} onClick={close}>
          {t.saleDone.done}
        </button>
        <button type="button" className={styles.undo} onClick={undo}>
          {t.saleDone.undo}
        </button>
      </div>
    </div>
  );
}
