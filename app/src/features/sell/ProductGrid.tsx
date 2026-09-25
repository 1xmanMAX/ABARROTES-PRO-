import { useLayoutEffect, useRef, useState } from 'react';
import { formatQty } from '../../domain/qty';
import type { Product } from '../../db/types';
import { t } from '../../i18n/es-PE';
import { TileButton } from './TileButton';
import styles from './Sell.module.css';

interface Props {
  products: Product[];
  qtyInActive: Map<string, number>;
  available: (p: Product) => number;
  onTap: (p: Product) => void;
  onLongPress: (p: Product) => void;
  onSearch: () => void;
}

const COLS = 3;
const GAP = 8;

/** Cuántos tiles caben sin scroll (el último siempre es "Buscar"). */
function useCapacity(ref: React.RefObject<HTMLDivElement | null>): number {
  const [capacity, setCapacity] = useState(8);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const { width, height } = el.getBoundingClientRect();
      if (!width || !height) return;
      const tile = (width - GAP * (COLS - 1)) / COLS;
      const rows = Math.max(2, Math.floor((height + GAP) / (tile + GAP)));
      setCapacity(rows * COLS - 1);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return capacity;
}

export function ProductGrid({ products, qtyInActive, available, onTap, onLongPress, onSearch }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const capacity = useCapacity(ref);
  const visible = products.slice(0, capacity);

  return (
    <div ref={ref} className={styles.gridArea}>
      <div className={styles.grid} data-testid="product-grid">
        {visible.map((p) => {
          const q = qtyInActive.get(p.id);
          return (
            <TileButton
              key={p.id}
              product={p}
              count={q ? formatQty(p, q) : ''}
              disabled={available(p) <= 0}
              onTap={onTap}
              onLongPress={onLongPress}
            />
          );
        })}
        <button type="button" className={styles.searchTile} aria-label={t.sell.searchOther} onClick={onSearch}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-4-4" />
          </svg>
          {t.sell.search}
        </button>
      </div>
    </div>
  );
}
