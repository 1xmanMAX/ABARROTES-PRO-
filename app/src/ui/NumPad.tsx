import { t } from '../i18n/es-PE';
import { useKeypadKeys } from './keypadKeys';
import styles from './NumPad.module.css';

interface Props {
  value: string;
  onChange: (value: string) => void;
  /** Decimales permitidos (0 = solo enteros). */
  decimals?: number;
  maxLength?: number;
}

/** Teclado numérico propio (no el del sistema). */
export function NumPad({ value, onChange, decimals = 2, maxLength = 9 }: Props) {
  const press = (key: string) => {
    if (key === 'del') return onChange(value.slice(0, -1));
    if (key === '.') {
      if (decimals === 0 || value.includes('.')) return;
      return onChange((value || '0') + '.');
    }
    const [, frac] = value.split('.');
    if (frac !== undefined && frac.length >= decimals) return;
    if (value.replace('.', '').length >= maxLength) return;
    onChange(value === '0' ? key : value + key);
  };
  // En PC también se puede escribir con el teclado.
  useKeypadKeys((k) => {
    if (/^\d$/.test(k) || k === '.') {
      press(k);
      return true;
    }
    if (k === 'Backspace') {
      press('del');
      return true;
    }
    return false;
  });
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', decimals > 0 ? '.' : '', '0', 'del'];
  return (
    <div className={styles.pad}>
      {keys.map((k, i) =>
        k === '' ? (
          <span key={i} />
        ) : (
          <button
            key={k}
            type="button"
            className={k === 'del' ? `${styles.key} ${styles.del}` : styles.key}
            aria-label={k === 'del' ? t.common.delete : k === '.' ? 'punto decimal' : k}
            onClick={() => press(k)}
          >
            {k === 'del' ? '⌫' : k}
          </button>
        ),
      )}
    </div>
  );
}
