import { useMemo, useState } from 'react';
import { searchProducts } from '../../domain/gridOrder';
import { formatPEN } from '../../domain/money';
import { formatQty } from '../../domain/qty';
import type { Product } from '../../db/types';
import { t } from '../../i18n/es-PE';
import { Sheet } from '../../ui/Sheet';
import s from '../../ui/Screen.module.css';
import styles from './Sell.module.css';

interface Props {
  products: Product[];
  available: (p: Product) => number;
  onPick: (p: Product) => void;
  onClose: () => void;
}

export function SearchSheet({ products, available, onPick, onClose }: Props) {
  const [q, setQ] = useState('');
  const results = useMemo(() => searchProducts(products, q), [products, q]);
  return (
    <Sheet title={t.sell.search} onClose={onClose}>
      <input
        className={s.input}
        type="search"
        autoFocus
        placeholder={t.sell.searchPlaceholder}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        aria-label={t.sell.searchPlaceholder}
      />
      <div className={styles.searchList}>
        {results.length === 0 && <p className={s.empty}>{t.sell.noResults}</p>}
        {results.map((p) => {
          const avail = available(p);
          return (
            <button key={p.id} type="button" className={styles.searchRow} disabled={avail <= 0} onClick={() => onPick(p)}>
              <span className={styles.searchName}>{p.name}</span>
              <span className={styles.searchMeta}>
                <span className="mono">{formatPEN(p.salePrice)}</span>
                <span>{avail > 0 ? formatQty(p, avail) : t.sell.noStock}</span>
              </span>
            </button>
          );
        })}
      </div>
    </Sheet>
  );
}
