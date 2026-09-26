import { useMemo, useState } from 'react';
import { useProducts } from '../../app/data';
import { useNav } from '../../app/nav';
import { searchProducts } from '../../domain/gridOrder';
import { centsToInput, formatPEN, parseSolesToCents } from '../../domain/money';
import { formatQty, lineAmount, parseQty, unitStep } from '../../domain/qty';
import { registerPurchase } from '../../db/cash';
import type { Product } from '../../db/types';
import { t } from '../../i18n/es-PE';
import { Button } from '../../ui/Button';
import { NumPad } from '../../ui/NumPad';
import { ScreenHeader } from '../../ui/ScreenHeader';
import { Sheet } from '../../ui/Sheet';
import s from '../../ui/Screen.module.css';
import { toast, toastError } from '../../ui/toast';
import styles from '../consign/Consign.module.css';

interface Item {
  qty: number;
  cost: number;
}

/** Compra de reposición: suma al stock, resta de caja y actualiza el costo. */
export default function PurchaseScreen() {
  const products = useProducts();
  const back = useNav((st) => st.back);
  const [supplier, setSupplier] = useState('');
  const [q, setQ] = useState('');
  const [items, setItems] = useState<Record<string, Item>>({});
  const [updateCost, setUpdateCost] = useState(true);
  const [method, setMethod] = useState<'cash' | 'digital'>('cash');
  const [editing, setEditing] = useState<{ product: Product; field: 'qty' | 'cost' } | null>(null);
  const [saving, setSaving] = useState(false);

  const list = useMemo(
    () =>
      searchProducts(
        [...products].sort((a, b) => a.name.localeCompare(b.name, 'es')),
        q,
      ),
    [products, q],
  );
  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const chosen = Object.entries(items).filter(([, it]) => it.qty > 0);
  const total = chosen.reduce((a, [id, it]) => a + lineAmount(byId.get(id)!, it.qty, it.cost), 0);

  const setQty = (p: Product, qty: number) =>
    setItems((cur) => ({ ...cur, [p.id]: { qty: Math.max(0, qty), cost: cur[p.id]?.cost ?? p.costPrice } }));

  const save = async () => {
    setSaving(true);
    try {
      await registerPurchase(
        supplier,
        chosen.map(([productId, it]) => ({ productId, qty: it.qty, unitCost: it.cost })),
        method,
        updateCost,
      );
      toast(t.cash.purchaseSaved, 'success');
      back();
    } catch (err) {
      setSaving(false);
      toastError(err);
    }
  };

  return (
    <div className={s.screen}>
      <ScreenHeader title={t.cash.purchaseTitle} />
      <div className={s.content}>
        <input
          className={s.input}
          placeholder={t.cash.supplier}
          aria-label={t.cash.supplier}
          value={supplier}
          onChange={(e) => setSupplier(e.target.value)}
        />
        <input
          className={s.input}
          type="search"
          placeholder={t.consign.search}
          aria-label={t.consign.search}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <ul className={styles.list}>
          {list.map((p) => {
            const it = items[p.id];
            const step = unitStep(p);
            return (
              <li key={p.id} className={`${styles.item} ${it?.qty ? styles.itemOn : ''}`}>
                <div className={styles.itemInfo}>
                  <span className={styles.itemName}>{p.name}</span>
                  <button type="button" className={styles.priceBtn} onClick={() => setEditing({ product: p, field: 'cost' })}>
                    {t.cash.unitCost}: {formatPEN(it?.cost ?? p.costPrice)}
                  </button>
                  <span className={s.muted}>{t.inventory.inStore(formatQty(p, p.stock))}</span>
                </div>
                <div className={styles.stepper}>
                  <button
                    type="button"
                    aria-label={`Quitar 1 ${p.name}`}
                    disabled={!it?.qty}
                    onClick={() => setQty(p, (it?.qty ?? 0) - step)}
                  >
                    −
                  </button>
                  <button
                    type="button"
                    className={styles.qty}
                    aria-label={`Cantidad de ${p.name}`}
                    onClick={() => setEditing({ product: p, field: 'qty' })}
                  >
                    {formatQty(p, it?.qty ?? 0)}
                  </button>
                  <button type="button" aria-label={`Agregar 1 ${p.name}`} onClick={() => setQty(p, (it?.qty ?? 0) + step)}>
                    +
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
        <label className={s.check}>
          <input type="checkbox" checked={updateCost} onChange={(e) => setUpdateCost(e.target.checked)} />
          {t.cash.updateCost}
        </label>
        <div className={s.segment} role="group" aria-label="Método">
          <button type="button" aria-pressed={method === 'cash'} onClick={() => setMethod('cash')}>
            {t.checkout.cash}
          </button>
          <button type="button" aria-pressed={method === 'digital'} onClick={() => setMethod('digital')}>
            {t.checkout.digital}
          </button>
        </div>
      </div>
      <div className={styles.bar}>
        <div>
          <div className={styles.barLabel}>{t.cash.purchaseTotal}</div>
          <div className={styles.barTotal} data-testid="purchase-total">
            {formatPEN(total)}
          </div>
        </div>
        <Button variant="primary" disabled={chosen.length === 0 || saving} onClick={save}>
          {t.cash.purchaseSave}
        </Button>
      </div>
      {editing && (
        <EditSheet
          product={editing.product}
          field={editing.field}
          item={items[editing.product.id] ?? { qty: 0, cost: editing.product.costPrice }}
          onSave={(it) => {
            setItems((cur) => ({ ...cur, [editing.product.id]: it }));
            setEditing(null);
          }}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function EditSheet({
  product,
  field,
  item,
  onSave,
  onClose,
}: {
  product: Product;
  field: 'qty' | 'cost';
  item: Item;
  onSave: (it: Item) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState(field === 'qty' ? (item.qty ? formatQty(product, item.qty) : '') : centsToInput(item.cost));
  const value = field === 'qty' ? parseQty(product, text || '0') : parseSolesToCents(text || '0');
  const valid = value !== null && (field === 'qty' ? value >= 0 : value > 0);
  return (
    <Sheet
      title={`${product.name} · ${field === 'qty' ? t.sell.qty : t.cash.unitCost}`}
      onClose={onClose}
      footer={
        <Button
          variant="primary"
          block
          disabled={!valid}
          onClick={() => value !== null && onSave(field === 'qty' ? { ...item, qty: value } : { ...item, cost: value })}
        >
          {t.common.accept}
        </Button>
      }
    >
      <div className={styles.display}>{field === 'cost' ? `S/ ${text || '0'}` : text || '0'}</div>
      <NumPad value={text} onChange={setText} decimals={field === 'cost' ? 2 : product.allowsFraction ? 3 : 0} />
    </Sheet>
  );
}
