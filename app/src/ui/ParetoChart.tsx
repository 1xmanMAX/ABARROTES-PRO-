import { useState } from 'react';
import { t } from '../i18n/es-PE';
import styles from './Charts.module.css';

export interface ParetoRow {
  id: string;
  name: string;
  sharePct: number;
  cumulativePct: number;
  cls: 'A' | 'B' | 'C';
  valueLabel: string;
}

const pct = (n: number) => n.toLocaleString('es-PE', { maximumFractionDigits: 0 });

/**
 * Pareto sin doble eje: barras horizontales ordenadas por su parte de la
 * ganancia. Énfasis: la clase A en el tono principal, B y C en gris, y la letra
 * de clase siempre escrita.
 */
export function ParetoChart({ rows, name }: { rows: ParetoRow[]; name: string }) {
  const [sel, setSel] = useState<string | null>(null);
  const max = Math.max(1, ...rows.map((r) => r.sharePct));
  const selected = rows.find((r) => r.id === sel);
  return (
    <figure className={styles.figure} aria-label={name}>
      <div className={styles.readout} aria-live="polite">
        {selected ? (
          <>
            <strong>{selected.name}</strong> · {selected.valueLabel} · {t.econ.cumulative(pct(selected.cumulativePct))}
          </>
        ) : (
          <span className={styles.hint}>{t.econ.tapRow}</span>
        )}
      </div>
      <ul className={styles.pareto}>
        {rows.map((r) => (
          <li key={r.id}>
            <button
              type="button"
              className={`${styles.paretoRow} ${sel === r.id ? styles.paretoActive : ''}`}
              onClick={() => setSel(sel === r.id ? null : r.id)}
              aria-label={`${r.name}: clase ${r.cls}, ${pct(r.sharePct)} % de la ganancia`}
            >
              <span className={styles.paretoName}>{r.name}</span>
              <span className={styles.paretoTrack}>
                <span
                  className={`${styles.paretoBar} ${r.cls === 'A' ? styles.barA : styles.barOther}`}
                  style={{ width: `${(r.sharePct * 100) / max}%` }}
                />
              </span>
              <span className={styles.paretoValue}>
                {pct(r.sharePct)} % <b className={styles.cls}>{r.cls}</b>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </figure>
  );
}
