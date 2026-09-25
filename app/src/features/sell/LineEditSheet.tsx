import { useState } from 'react';
import { centsToInput, formatPEN, parseSolesToCents } from '../../domain/money';
import { formatQty, lineAmount, parseQty } from '../../domain/qty';
import type { CartLine } from '../../domain/cart';
import type { Product } from '../../db/types';
import { t } from '../../i18n/es-PE';
import { Button } from '../../ui/Button';
import { NumPad } from '../../ui/NumPad';
import { Sheet } from '../../ui/Sheet';
import s from '../../ui/Screen.module.css';
import { toast } from '../../ui/toast';
import styles from './Sell.module.css';

interface Props {
  product: Product;
  line: CartLine | undefined;
  /** Disponible sumando lo que ya lleva esta línea. */
  maxQty: number;
  onSave: (qty: number, price: number | null) => void;
  onClose: () => void;
}

/** Toque largo en un tile: cantidad exacta y precio de la línea (descuento). */
export function LineEditSheet({ product, line, maxQty, onSave, onClose }: Props) {
  const [field, setField] = useState<'qty' | 'price'>('qty');
  const [qtyText, setQtyText] = useState(line ? formatQty(product, line.qty) : '');
  const [priceText, setPriceText] = useState(centsToInput(line?.priceOverride ?? product.salePrice));

  const qty = qtyText === '' ? 0 : parseQty(product, qtyText);
  const price = parseSolesToCents(priceText);
  const valid = qty !== null && price !== null && qty <= maxQty;
  const total = valid ? lineAmount(product, qty, price) : 0;

  const save = () => {
    if (qty === null) return toast(t.errors.invalidQty, 'error');
    if (qty > maxQty) return toast(t.sell.onlyLeft(formatQty(product, maxQty)), 'error');
    if (price === null) return toast(t.errors.invalidAmount, 'error');
    onSave(qty, price === product.salePrice ? null : price);
  };

  return (
    <Sheet
      title={product.name}
      onClose={onClose}
      footer={
        <Button variant="primary" block disabled={!valid} onClick={save}>
          {t.common.accept} · {formatPEN(total)}
        </Button>
      }
    >
      <div className={s.segment} role="group">
        <button type="button" aria-pressed={field === 'qty'} onClick={() => setField('qty')}>
          {t.sell.qty}
        </button>
        <button type="button" aria-pressed={field === 'price'} onClick={() => setField('price')}>
          {t.sell.price}
        </button>
      </div>
      <div className={styles.editDisplay}>
        <button type="button" className={field === 'qty' ? styles.editActive : ''} onClick={() => setField('qty')}>
          <span className={s.label}>{t.sell.qty}</span>
          <span className="mono">{qtyText || '0'}</span>
        </button>
        <button type="button" className={field === 'price' ? styles.editActive : ''} onClick={() => setField('price')}>
          <span className={s.label}>
            {t.sell.price} {t.sell.each}
          </span>
          <span className="mono">S/ {priceText || '0'}</span>
        </button>
      </div>
      {qty !== null && qty > maxQty && <p className={styles.warn}>{t.sell.onlyLeft(formatQty(product, maxQty))}</p>}
      {field === 'price' && (
        <p className={s.muted}>
          {t.sell.discountNote}{' '}
          {price !== product.salePrice && (
            <button type="button" className={styles.linkBtn} onClick={() => setPriceText(centsToInput(product.salePrice))}>
              {t.sell.resetPrice}
            </button>
          )}
        </p>
      )}
      {field === 'qty' ? (
        <NumPad value={qtyText} onChange={setQtyText} decimals={product.allowsFraction ? 3 : 0} maxLength={7} />
      ) : (
        <NumPad value={priceText} onChange={setPriceText} decimals={2} />
      )}
    </Sheet>
  );
}
