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

const GAP = 8;
/** En pantallas anchas (PC, tablet) el tile no pasa de este tamaño: entran más columnas. */
const MAX_TILE = 150;

/**
 * Columnas y cuántos tiles caben sin scroll (el último siempre es "Buscar").
 * En el teléfono son 3 columnas (SPEC §2.1); en pantallas anchas, las que entren.
 */
export function gridLayout(width: number, height: number): { cols: number; capacity: number } {
  const cols = Math.max(3, Math.floor((width + GAP) / (MAX_TILE + GAP)));
  const tile = (width - GAP * (cols - 1)) / cols;
  const rows = Math.max(2, Math.floor((height + GAP) / (tile + GAP)));
  return { cols, capacity: rows * cols - 1 };
}

function useCapacity(ref: React.RefObject<HTMLDivElement | null>): { cols: number; capacity: number } {
  const [layout, setLayout] = useState({ cols: 3, capacity: 8 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const { width, height } = el.getBoundingClientRect();
      if (!width || !height) return;
      const next = gridLayout(width, height);
      setLayout((cur) => (cur.cols === next.cols && cur.capacity === next.capacity ? cur : next));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return layout;
}

export function ProductGrid({ products, qtyInActive, available, onTap, onLongPress, onSearch }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const { cols, capacity } = useCapacity(ref);
  const visible = products.slice(0, capacity);

  return (
    <div ref={ref} className={styles.gridArea}>
      <div className={styles.grid} style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }} data-testid="product-grid">
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
