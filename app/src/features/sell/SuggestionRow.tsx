import { memo } from 'react';
import { SUGGESTION_COUNT } from '../../domain/prediction';
import type { Product } from '../../db/types';
import { t } from '../../i18n/es-PE';
import styles from './Sell.module.css';

interface Props {
  products: Product[];
  onTap: (p: Product) => void;
}

/**
 * Fila "Siguiente probable" (SPEC §2.3). Siempre ocupa el mismo alto, aunque
 * no haya sugerencias, para que la cuadrícula no se mueva.
 */
export const SuggestionRow = memo(function SuggestionRow({ products, onTap }: Props) {
  const slots: (Product | null)[] = [...products.slice(0, SUGGESTION_COUNT)];
  while (slots.length < SUGGESTION_COUNT) slots.push(null);
  return (
    <section className={styles.suggest} aria-label={t.sell.suggestions}>
      <div className={styles.suggestTitle} aria-hidden="true">
        {t.sell.suggestions.toUpperCase()}
      </div>
      <div className={styles.suggestRow} data-testid="suggestions">
        {slots.map((p, i) =>
          p ? (
            <button
              key={p.id}
              type="button"
              className={styles.chip}
              aria-label={`${t.sell.addOne} ${p.name}`}
              data-product-id={p.id}
              onClick={() => onTap(p)}
            >
              <span className={styles.chipText}>+ {p.name}</span>
            </button>
          ) : (
            <span key={`empty-${i}`} className={`${styles.chip} ${styles.chipEmpty}`} aria-hidden="true" />
          ),
        )}
      </div>
    </section>
  );
});
