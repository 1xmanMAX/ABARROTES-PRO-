import { useEffect, useState } from 'react';
import type { CartLine } from '../../domain/cart';
import { formatPEN } from '../../domain/money';
import type { Product } from '../../db/types';
import { t } from '../../i18n/es-PE';
import { CartLines } from './CartLines';
import styles from './Sell.module.css';

interface Props {
  label: string;
  lines: CartLine[];
  products: Map<string, Product>;
  available: (p: Product) => number;
  total: number;
  onSetQty: (productId: string, qty: number) => void;
  onEdit: (p: Product) => void;
  onClear: () => void;
}

/**
 * Pantallas anchas (PC): el ticket queda siempre a la vista junto a la cuadrícula, para revisar y
 * corregir lo que lleva el cliente sin abrir la hoja "Detalle".
 */
export function TicketPanel({ label, lines, products, available, total, onSetQty, onEdit, onClear }: Props) {
  const [confirming, setConfirming] = useState(false);
  const empty = lines.length === 0;
  useEffect(() => {
    if (empty) setConfirming(false);
  }, [empty]);
  const clear = () => {
    if (lines.length > 3 && !confirming) return setConfirming(true);
    onClear();
    setConfirming(false);
  };
  return (
    <aside className={styles.panel} aria-label={t.sell.detail}>
      <div className={styles.panelHead}>
        <span className={styles.panelTitle}>{label}</span>
        {lines.length > 0 && (
          <button type="button" className={styles.panelClear} onClick={clear}>
            {confirming ? t.common.yes + ', ' + t.sell.clear.toLowerCase() : t.sell.clear}
          </button>
        )}
      </div>
      {confirming && <p className={styles.warn}>{t.sell.clearConfirm}</p>}
      <div className={styles.panelLines} data-testid="ticket-panel">
        {lines.length === 0 ? (
          <p className={styles.panelEmpty}>{t.sell.panelEmpty}</p>
        ) : (
          <CartLines lines={lines} products={products} available={available} onSetQty={onSetQty} onEdit={onEdit} />
        )}
      </div>
      <div className={styles.panelTotal}>
        <span>{t.sell.panelTotal}</span>
        <span className="mono">{formatPEN(total)}</span>
      </div>
    </aside>
  );
}
