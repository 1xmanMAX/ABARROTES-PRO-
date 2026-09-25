import { useState } from 'react';
import type { CartLine } from '../../domain/cart';
import { formatPEN } from '../../domain/money';
import { formatQty, lineAmount, unitStep } from '../../domain/qty';
import type { Product } from '../../db/types';
import { t } from '../../i18n/es-PE';
import { Button } from '../../ui/Button';
import { Sheet } from '../../ui/Sheet';
import styles from './Sell.module.css';

interface Props {
  lines: CartLine[];
  products: Map<string, Product>;
  available: (p: Product) => number;
  total: number;
  onSetQty: (productId: string, qty: number) => void;
  onEdit: (p: Product) => void;
  onClear: () => void;
  onClose: () => void;
}

export function CartSheet({ lines, products, available, total, onSetQty, onEdit, onClear, onClose }: Props) {
  const [confirming, setConfirming] = useState(false);
  const clear = () => {
    if (lines.length > 3 && !confirming) return setConfirming(true);
    onClear();
    onClose();
  };
  return (
    <Sheet
      title={t.sell.detail}
      onClose={onClose}
      footer={
        <div className={styles.cartFooter}>
          <Button variant="danger" onClick={clear}>
            {confirming ? t.common.yes + ', ' + t.sell.clear.toLowerCase() : t.sell.clear}
          </Button>
          <span className={styles.cartTotal}>{formatPEN(total)}</span>
        </div>
      }
    >
      {confirming && <p className={styles.warn}>{t.sell.clearConfirm}</p>}
      {lines.map((l) => {
        const p = products.get(l.productId);
        if (!p) return null;
        const step = unitStep(p);
        const price = l.priceOverride ?? p.salePrice;
        return (
          <div key={l.productId} className={styles.cartLine}>
            <button type="button" className={styles.cartInfo} onClick={() => onEdit(p)}>
              <span className={styles.cartName}>{p.name}</span>
              <span className="mono">
                {formatPEN(price)} {l.priceOverride !== null && `(${t.sell.discountReason})`}
              </span>
              <span className={`mono ${styles.cartLineTotal}`}>{formatPEN(lineAmount(p, l.qty, price))}</span>
            </button>
            <div className={styles.stepper}>
              <button type="button" aria-label={`${t.sell.remove} 1 ${p.name}`} onClick={() => onSetQty(p.id, l.qty - step)}>
                −
              </button>
              <button type="button" className={styles.stepQty} aria-label={t.sell.lineEdit} onClick={() => onEdit(p)}>
                {formatQty(p, l.qty)}
              </button>
              <button
                type="button"
                aria-label={`Agregar 1 ${p.name}`}
                disabled={available(p) < step}
                onClick={() => onSetQty(p.id, l.qty + step)}
              >
                +
              </button>
            </div>
            <button type="button" className={styles.removeBtn} aria-label={`${t.sell.remove} ${p.name}`} onClick={() => onSetQty(p.id, 0)}>
              ✕
            </button>
          </div>
        );
      })}
    </Sheet>
  );
}
