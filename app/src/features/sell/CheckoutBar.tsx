import { formatPEN } from '../../domain/money';
import { t } from '../../i18n/es-PE';
import styles from './Sell.module.css';

interface Props {
  count: number;
  label: string;
  total: number;
  onDetail: () => void;
  onCharge: () => void;
}

export function CheckoutBar({ count, label, total, onDetail, onCharge }: Props) {
  const empty = count === 0;
  return (
    <div className={styles.checkoutBar}>
      <button type="button" className={styles.totalBtn} onClick={onDetail} disabled={empty} aria-label={t.sell.detail}>
        <span className={styles.totalMeta}>
          {empty ? t.sell.emptyTicket : `${t.sell.products(count)} · ${label}`}
        </span>
        <span className={styles.totalValue} data-testid="ticket-total">
          {formatPEN(total)}
        </span>
      </button>
      <button type="button" className={styles.chargeBtn} onClick={onCharge} disabled={empty}>
        {t.sell.charge}
      </button>
    </div>
  );
}
