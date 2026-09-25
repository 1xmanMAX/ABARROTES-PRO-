import { useState } from 'react';
import { PIN_LENGTH } from '../domain/pin';
import { t } from '../i18n/es-PE';
import styles from './PinPad.module.css';
import { vibrate } from './toast';

interface Props {
  /** Qué se está firmando: "Rosa acepta deber S/ 478.00". */
  title: string;
  hint?: string;
  submitLabel?: string;
  /** Mensaje a mostrar al abrir (por ejemplo, después de reiniciar). */
  initialError?: string | null;
  /** Lanza un error con mensaje listo para mostrar si el código no sirve. */
  onSubmit: (pin: string) => Promise<void>;
}

/** Teclado PIN propio 3×4 con 4 puntos. Nunca muestra los dígitos. */
export function PinPad({ title, hint, submitLabel = t.pin.sign, initialError = null, onSubmit }: Props) {
  const [digits, setDigits] = useState('');
  const [error, setError] = useState<string | null>(initialError);
  const [busy, setBusy] = useState(false);

  const press = (k: string) => {
    if (busy) return;
    setError(null);
    if (k === 'del') return setDigits((d) => d.slice(0, -1));
    setDigits((d) => (d.length < PIN_LENGTH ? d + k : d));
  };

  const submit = async () => {
    if (digits.length !== PIN_LENGTH || busy) return;
    setBusy(true);
    try {
      await onSubmit(digits);
    } catch (err) {
      vibrate([60, 40, 60]);
      setError(err instanceof Error && 'code' in err ? err.message : t.errors.generic);
      if (!(err instanceof Error && 'code' in err)) console.error(err);
    } finally {
      setDigits('');
      setBusy(false);
    }
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.head}>
        <div className={styles.title}>{title}</div>
        {hint && <div className={styles.hint}>{hint}</div>}
      </div>
      <div className={`${styles.dots} ${error ? styles.dotsError : ''}`} aria-label={`${digits.length} de ${PIN_LENGTH} dígitos`}>
        {Array.from({ length: PIN_LENGTH }, (_, i) => (
          <span key={i} className={i < digits.length ? styles.dotOn : styles.dot} />
        ))}
      </div>
      <div className={styles.msg} role="alert">
        {busy ? t.pin.checking : error}
      </div>
      <div className={styles.keys}>
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((k) => (
          <button key={k} type="button" className={styles.key} onClick={() => press(k)}>
            {k}
          </button>
        ))}
        <button type="button" className={`${styles.key} ${styles.small}`} aria-label={t.pin.delete} onClick={() => press('del')}>
          {t.pin.delete}
        </button>
        <button type="button" className={styles.key} onClick={() => press('0')}>
          0
        </button>
        <button
          type="button"
          className={`${styles.key} ${styles.sign}`}
          disabled={digits.length !== PIN_LENGTH || busy}
          onClick={submit}
        >
          {submitLabel}
        </button>
      </div>
    </div>
  );
}
