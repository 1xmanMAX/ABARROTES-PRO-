import type { CartLine } from '../../domain/cart';
import { formatPEN } from '../../domain/money';
import { formatQty, lineAmount, unitStep } from '../../domain/qty';
import type { Product } from '../../db/types';
import { t } from '../../i18n/es-PE';
import styles from './Sell.module.css';

interface Props {
  lines: CartLine[];
  products: Map<string, Product>;
  available: (p: Product) => number;
  onSetQty: (productId: string, qty: number) => void;
  onEdit: (p: Product) => void;
}

/** Líneas del ticket con − / + y quitar. En la hoja "Detalle" y en el panel fijo de la PC. */
export function CartLines({ lines, products, available, onSetQty, onEdit }: Props) {
  return (
    <>
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
            <button
              type="button"
              className={styles.removeBtn}
              aria-label={`${t.sell.remove} ${p.name}`}
              onClick={() => onSetQty(p.id, 0)}
            >
              ✕
            </button>
          </div>
        );
      })}
    </>
  );
}
