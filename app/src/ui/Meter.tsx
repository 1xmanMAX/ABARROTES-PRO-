import styles from './Charts.module.css';

interface Props {
  /** Valor actual (se dibuja como relleno). */
  value: number;
  /** Meta o límite (se dibuja como marca). */
  target: number;
  valueLabel: string;
  targetLabel: string;
  name: string;
}

/**
 * Medidor de un valor contra un límite: relleno = valor actual, marca vertical =
 * meta. Los dos números van escritos: el color no es la única pista.
 */
export function Meter({ value, target, valueLabel, targetLabel, name }: Props) {
  const max = Math.max(value, target) * 1.15 || 1;
  const valuePct = Math.max(0, Math.min(100, (value * 100) / max));
  const targetPct = Math.max(0, Math.min(100, (target * 100) / max));
  const ok = value >= target;
  return (
    <figure className={styles.meter} role="img" aria-label={`${name}: ${valueLabel}; ${targetLabel}`}>
      <div className={styles.meterTrack}>
        <div className={`${styles.meterFill} ${ok ? styles.fillGood : styles.fillBad}`} style={{ width: `${valuePct}%` }} />
        <div className={styles.meterTarget} style={{ left: `${targetPct}%` }} />
      </div>
      <div className={styles.meterLabels}>
        <span>{valueLabel}</span>
        {/* Cerca de los bordes, la etiqueta se ancla hacia adentro para no cortarse. */}
        <span
          className={styles.meterTargetLabel}
          style={
            targetPct < 30
              ? { left: `${targetPct}%`, transform: 'translateX(-6px)' }
              : targetPct > 70
                ? { right: `${100 - targetPct}%`, transform: 'translateX(6px)' }
                : { left: `${targetPct}%`, transform: 'translateX(-50%)' }
          }
        >
          {targetPct > 70 ? `${targetLabel} ▲` : `▲ ${targetLabel}`}
        </span>
      </div>
    </figure>
  );
}
