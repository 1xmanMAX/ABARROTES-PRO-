import { useState } from 'react';
import { formatQty, parseQty } from '../../domain/qty';
import { adjustStock, type AdjustReason } from '../../db/products';
import type { Product } from '../../db/types';
import { t } from '../../i18n/es-PE';
import { Button } from '../../ui/Button';
import { Sheet } from '../../ui/Sheet';
import s from '../../ui/Screen.module.css';
import { toast, toastError } from '../../ui/toast';

const REASONS: AdjustReason[] = ['conteo', 'merma', 'regalo', 'otro'];

/** Ajuste de stock con motivo: queda como movimiento, no como edición directa. */
export function AdjustStockSheet({ product, onClose }: { product: Product; onClose: () => void }) {
  const [reason, setReason] = useState<AdjustReason>('conteo');
  const [qtyText, setQtyText] = useState('');
  const [sign, setSign] = useState<1 | -1>(1);
  const [note, setNote] = useState('');

  const qty = parseQty(product, qtyText);
  let delta: number | null = null;
  if (qty !== null) {
    if (reason === 'conteo') delta = qty - product.stock;
    else if (reason === 'otro') delta = sign * qty;
    else delta = -qty;
  }

  const save = async () => {
    if (delta === null) return toast(t.errors.invalidQty, 'error');
    if (delta === 0) return toast(t.inventory.noChange);
    try {
      await adjustStock(product.id, delta, reason, note.trim());
      toast(t.inventory.adjusted, 'success');
      onClose();
    } catch (err) {
      toastError(err);
    }
  };

  const label = reason === 'conteo' ? t.inventory.countedQty : reason === 'otro' ? t.inventory.deltaQty : t.inventory.removeQty;

  return (
    <Sheet
      title={t.inventory.adjustTitle(product.name)}
      onClose={onClose}
      footer={
        <Button variant="primary" block disabled={delta === null || delta === 0} onClick={save}>
          {t.common.save}
          {delta !== null && delta !== 0 && ` (${delta > 0 ? '+' : '−'}${formatQty(product, Math.abs(delta))})`}
        </Button>
      }
    >
      <p className={s.muted}>{t.inventory.current(formatQty(product, product.stock))}</p>
      <div className={s.segment} role="group">
        {REASONS.map((r) => (
          <button key={r} type="button" aria-pressed={reason === r} onClick={() => setReason(r)}>
            {t.inventory.reasons[r]}
          </button>
        ))}
      </div>
      <label className={s.field}>
        {label}
        <div className={s.row} style={{ flex: 'none' }}>
          {reason === 'otro' && (
            <div className={s.segment} style={{ flex: '0 0 110px' }}>
              <button type="button" aria-pressed={sign === 1} onClick={() => setSign(1)}>
                +
              </button>
              <button type="button" aria-pressed={sign === -1} onClick={() => setSign(-1)}>
                −
              </button>
            </div>
          )}
          <input className={`${s.input} mono`} inputMode="decimal" autoFocus value={qtyText} onChange={(e) => setQtyText(e.target.value)} />
        </div>
      </label>
      <label className={s.field}>
        {t.inventory.note}
        <input className={s.input} value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
    </Sheet>
  );
}
