import { useState } from 'react';
import { t } from '../i18n/es-PE';
import styles from './Charts.module.css';

export interface ScatterPoint {
  id: string;
  label: string;
  x: number;
  /** null = sin dato anterior (se dibuja arriba, como "nuevo"). */
  y: number | null;
  detail: string;
}

interface Props {
  points: ScatterPoint[];
  xThreshold: number;
  xLabel: string;
  yLabel: string;
  /** Etiquetas de cuadrante: [arriba-izq, arriba-der, abajo-izq, abajo-der]. */
  quadrants: [string, string, string, string];
  name: string;
}

const W = 320;
const H = 240;
const PAD = { l: 42, r: 10, t: 12, b: 26 };
const Y_MIN = -100;
const Y_MAX = 150;

/** Dispersión con 4 cuadrantes (matriz BCG). Una sola serie; los puntos se tocan para ver el detalle. */
export function ScatterChart({ points, xThreshold, xLabel, yLabel, quadrants, name }: Props) {
  const [sel, setSel] = useState<string | null>(null);
  const xMax = Math.max(xThreshold * 2, ...points.map((p) => p.x)) * 1.08 || 1;
  const sx = (x: number) => PAD.l + (x / xMax) * (W - PAD.l - PAD.r);
  const clampY = (y: number) => Math.max(Y_MIN, Math.min(Y_MAX, y));
  const sy = (y: number) => PAD.t + ((Y_MAX - clampY(y)) / (Y_MAX - Y_MIN)) * (H - PAD.t - PAD.b);
  const selected = points.find((p) => p.id === sel);
  const qx = sx(xThreshold);
  const qy = sy(0);

  return (
    <figure className={styles.figure}>
      <div className={styles.readout} aria-live="polite">
        {selected ? (
          <>
            <strong>{selected.label}</strong> · {selected.detail}
          </>
        ) : (
          <span className={styles.hint}>{t.econ.tapDot}</span>
        )}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className={styles.svg} role="img" aria-label={name}>
        {/* Cuadrantes */}
        <line x1={qx} x2={qx} y1={PAD.t} y2={H - PAD.b} className={styles.quadLine} />
        <line x1={PAD.l} x2={W - PAD.r} y1={qy} y2={qy} className={styles.quadLine} />
        <text x={PAD.l + 4} y={PAD.t + 10} className={styles.quadText}>
          {quadrants[0]}
        </text>
        <text x={W - PAD.r - 4} y={PAD.t + 10} className={styles.quadText} textAnchor="end">
          {quadrants[1]}
        </text>
        <text x={PAD.l + 4} y={H - PAD.b - 6} className={styles.quadText}>
          {quadrants[2]}
        </text>
        <text x={W - PAD.r - 4} y={H - PAD.b - 6} className={styles.quadText} textAnchor="end">
          {quadrants[3]}
        </text>
        {/* Ejes */}
        <text x={(W + PAD.l) / 2} y={H - 6} className={styles.axisText} textAnchor="middle">
          {xLabel} →
        </text>
        <text
          x={10}
          y={(H - PAD.b + PAD.t) / 2}
          className={styles.axisText}
          textAnchor="middle"
          transform={`rotate(-90 8 ${(H - PAD.b + PAD.t) / 2})`}
        >
          {yLabel} →
        </text>
        <text x={PAD.l - 4} y={qy + 3} className={styles.tick} textAnchor="end">
          0 %
        </text>
        {points.map((p) => {
          const cx = sx(p.x);
          const cy = sy(p.y ?? Y_MAX * 0.6);
          const active = p.id === sel;
          return (
            <g
              key={p.id}
              role="button"
              tabIndex={0}
              aria-label={`${p.label}: ${p.detail}`}
              className={styles.dot}
              onClick={() => setSel(active ? null : p.id)}
            >
              <circle cx={cx} cy={cy} r={14} fill="transparent" />
              <circle cx={cx} cy={cy} r={active ? 7 : 5} className={`${styles.dotMark} ${p.y === null ? styles.dotNew : ''}`} />
              <text x={cx + 8} y={cy - 7} className={styles.dotLabel}>
                {p.label}
              </text>
            </g>
          );
        })}
      </svg>
    </figure>
  );
}
