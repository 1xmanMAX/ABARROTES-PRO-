import { useMemo, useState } from 'react';
import { useProducts } from '../../app/data';
import { useNav } from '../../app/nav';
import { searchProducts } from '../../domain/gridOrder';
import { formatPEN } from '../../domain/money';
import { formatQty } from '../../domain/qty';
import { t } from '../../i18n/es-PE';
import { Button } from '../../ui/Button';
import { ScreenHeader } from '../../ui/ScreenHeader';
import s from '../../ui/Screen.module.css';
import styles from './Inventory.module.css';

const collator = new Intl.Collator('es-PE', { sensitivity: 'base', numeric: true });

export default function InventoryScreen() {
  const products = useProducts();
  const push = useNav((st) => st.push);
  const [q, setQ] = useState('');
  const list = useMemo(
    () => searchProducts([...products].sort((a, b) => collator.compare(a.name, b.name)), q),
    [products, q],
  );

  return (
    <div className={s.screen}>
      <ScreenHeader title={t.inventory.title} />
      <div className={s.content}>
        <Button variant="primary" block onClick={() => push({ name: 'product', id: null })}>
          + {t.inventory.newProduct}
        </Button>
        <input
          className={s.input}
          type="search"
          placeholder={t.inventory.searchPlaceholder}
          aria-label={t.inventory.searchPlaceholder}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {list.length === 0 && <p className={s.empty}>{t.inventory.empty}</p>}
        {list.map((p) => {
          const low = p.stock <= p.minStock;
          return (
            <button key={p.id} type="button" className={styles.row} onClick={() => push({ name: 'product', id: p.id })}>
              <span className={styles.rowMain}>
                <span className={styles.name}>
                  {p.name}
                  {!p.active && <span className={styles.badge}>{t.inventory.inactive}</span>}
                  {p.active && low && <span className={`${styles.badge} ${styles.badgeLow}`}>{t.inventory.lowStock}</span>}
                </span>
                <span className={styles.stock}>
                  {t.inventory.inStore(formatQty(p, p.stock))}
                  {p.consignedQty > 0 && ` · ${t.inventory.withSellers(formatQty(p, p.consignedQty))}`}
                </span>
              </span>
              <span className="mono">{formatPEN(p.salePrice)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
