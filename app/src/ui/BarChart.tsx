import { useState } from 'react';
import { formatPEN } from '../domain/money';
import { t } from '../i18n/es-PE';
import styles from './BarChart.module.css';

export interface BarPoint {
  key: string;
  /** Etiqueta corta del eje ("25"). */
  label: string;
  /** Etiqueta larga para el detalle ("jue 25/09"). */
  title: string;
  value: number;
  /** Detalle extra al tocar la barra. */
  detail?: string;
}

interface Props {
  points: BarPoint[];
  /** Nombre de la serie (título accesible). */
  name: string;
  height?: number;
}

/**
 * Barras de una sola serie con línea de cero. Lo positivo va arriba y lo
 * negativo abajo (la posición y el signo dicen si se ganó o se perdió; el color
 * solo acompaña). Tocar una barra muestra su valor.
 */
export function BarChart({ points, name, height = 150 }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const [showTable, setShowTable] = useState(false);
  const max = Math.max(0, ...points.map((p) => p.value));
  const min = Math.min(0, ...points.map((p) => p.value));
  const span = max - min || 1;
  const width = 320;
  const padTop = 6;
  const padBottom = 18;
  const plotH = height - padTop - padBottom;
  const zeroY = padTop + (max / span) * plotH;
  const slot = width / Math.max(1, points.length);
  const barW = Math.max(3, Math.min(22, slot - 2));
  const labelEvery = Math.ceil(points.length / 8);
  const sel = points.find((p) => p.key === selected) ?? null;

  return (
    <figure className={styles.figure}>
      <div className={styles.readout} aria-live="polite">
        {sel ? (
          <>
            <strong>{sel.title}</strong> · <span className="mono">{formatPEN(sel.value, { sign: true })}</span>
            {sel.detail && <span className={styles.detail}> · {sel.detail}</span>}
          </>
        ) : (
          <span className={styles.hint}>{t.stats.chartHint}</span>
        )}
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className={styles.svg} role="img" aria-label={name}>
        <line x1={0} x2={width} y1={zeroY} y2={zeroY} className={styles.zero} />
        {points.map((p, i) => {
          const h = (Math.abs(p.value) / span) * plotH;
          const x = i * slot + (slot - barW) / 2;
          const y = p.value >= 0 ? zeroY - h : zeroY;
          const r = Math.min(4, barW / 2, h / 2);
          const positive = p.value >= 0;
          // Esquinas redondeadas solo en el extremo del dato; la base queda recta sobre el cero.
          const d = positive
            ? `M${x},${zeroY} V${y + r} Q${x},${y} ${x + r},${y} H${x + barW - r} Q${x + barW},${y} ${x + barW},${y + r} V${zeroY} Z`
            : `M${x},${zeroY} V${y + h - r} Q${x},${y + h} ${x + r},${y + h} H${x + barW - r} Q${x + barW},${y + h} ${x + barW},${y + h - r} V${zeroY} Z`;
          return (
            <g
              key={p.key}
              role="button"
              tabIndex={0}
              aria-label={`${p.title}: ${formatPEN(p.value, { sign: true })}`}
              className={styles.col}
              onClick={() => setSelected(p.key === selected ? null : p.key)}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setSelected(p.key)}
            >
              {/* Zona de toque más grande que la barra. */}
              <rect x={i * slot} y={0} width={slot} height={height - padBottom} fill="transparent" />
              {h > 0 && (
                <path d={d} className={`${positive ? styles.pos : styles.neg} ${p.key === selected ? styles.active : ''}`} />
              )}
              {i % labelEvery === 0 && (
                <text x={x + barW / 2} y={height - 4} className={styles.axis} textAnchor="middle">
                  {p.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <button type="button" className={styles.tableToggle} onClick={() => setShowTable((v) => !v)}>
        {showTable ? t.stats.hideTable : t.stats.showTable}
      </button>
      {showTable && (
        <table className={styles.table}>
          <tbody>
            {points.map((p) => (
              <tr key={p.key}>
                <td>{p.title}</td>
                <td className="mono">{formatPEN(p.value, { sign: true })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </figure>
  );
}
