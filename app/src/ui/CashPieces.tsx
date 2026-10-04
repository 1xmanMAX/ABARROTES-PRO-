import { changeBreakdown, describeBreakdown, type ChangeBreakdown } from '../domain/cashPieces';
import type { Cents } from '../domain/money';
import styles from './CashPieces.module.css';

/** Etiqueta corta de una pieza: 2000 → "20", 50 → "0.50". */
export function shortPiece(value: Cents): string {
  return value >= 100 ? String(value / 100) : `0.${String(value).padStart(2, '0')}`;
}

/** Clase de color por denominación (dibujos esquemáticos, no reproducen los billetes reales). */
export function pieceClass(value: Cents): string {
  return styles[`p${value}`] ?? '';
}

/** Un billete o moneda dibujado, con su valor grande. */
export function Piece({ value, count }: { value: Cents; count?: number }) {
  const bill = value >= 1000;
  return (
    <span className={`${bill ? styles.bill : styles.coin} ${pieceClass(value)}`}>
      <span className={styles.value}>
        <small>S/</small>
        {shortPiece(value)}
      </span>
      {count !== undefined && count > 1 && <span className={styles.count}>×{count}</span>}
    </span>
  );
}

/** El vuelto dibujado: qué billetes y monedas dar, de mayor a menor. */
export function ChangePieces({ change, breakdown }: { change: Cents; breakdown?: ChangeBreakdown }) {
  const b = breakdown ?? changeBreakdown(change);
  if (b.parts.length === 0) return null;
  return (
    <div className={styles.pieces} role="img" aria-label={`Dar ${describeBreakdown(b)}`} data-testid="change-pieces">
      {b.parts.map((p) => (
        <Piece key={p.value} value={p.value} count={p.count} />
      ))}
      {b.rest > 0 && <span className={styles.rest}>+ {b.rest} cént.</span>}
    </div>
  );
}
