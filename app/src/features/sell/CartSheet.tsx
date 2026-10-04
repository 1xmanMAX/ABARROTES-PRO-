import { useState } from 'react';
import type { CartLine } from '../../domain/cart';
import { formatPEN } from '../../domain/money';
import type { Product } from '../../db/types';
import { t } from '../../i18n/es-PE';
import { Button } from '../../ui/Button';
import { Sheet } from '../../ui/Sheet';
import { CartLines } from './CartLines';
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
      <CartLines lines={lines} products={products} available={available} onSetQty={onSetQty} onEdit={onEdit} />
    </Sheet>
  );
}
