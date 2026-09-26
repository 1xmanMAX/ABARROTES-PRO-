import type { MultiplierState, MultiplierValue } from '../../domain/multiplier';
import { t } from '../../i18n/es-PE';
import styles from './Sell.module.css';

interface Props {
  state: MultiplierState;
  canUndo: boolean;
  onPress: (v: MultiplierValue) => void;
  onUndo: () => void;
}

const VALUES: MultiplierValue[] = [1, 5, 10];

export function MultiplierBar({ state, canUndo, onPress, onUndo }: Props) {
  return (
    <div className={styles.multBar}>
      <span className={styles.multLabel}>{t.sell.quantity}</span>
      {VALUES.map((v) => {
        const active = state.value === v;
        return (
          <button
            key={v}
            type="button"
            className={`${styles.multBtn} ${active ? styles.multActive : ''}`}
            aria-pressed={active}
            aria-label={`×${v}${active && state.locked ? ` (${t.sell.locked})` : ''}`}
            onClick={() => onPress(v)}
          >
            ×{v}
            {active && state.locked && <span aria-hidden="true"> 🔒</span>}
          </button>
        );
      })}
      <button type="button" className={`${styles.multBtn} ${styles.undoBtn}`} disabled={!canUndo} onClick={onUndo}>
        {t.sell.undo}
      </button>
    </div>
  );
}
