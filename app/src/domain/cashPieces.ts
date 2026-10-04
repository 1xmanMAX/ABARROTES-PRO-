import { assertCents, type Cents } from './money';

/** Billetes y monedas del sol en circulación (BCRP). Las de 1 y 5 céntimos ya no circulan. */
export interface Piece {
  value: Cents;
  kind: 'bill' | 'coin';
}

export const PEN_PIECES: readonly Piece[] = [
  { value: 20000, kind: 'bill' },
  { value: 10000, kind: 'bill' },
  { value: 5000, kind: 'bill' },
  { value: 2000, kind: 'bill' },
  { value: 1000, kind: 'bill' },
  { value: 500, kind: 'coin' },
  { value: 200, kind: 'coin' },
  { value: 100, kind: 'coin' },
  { value: 50, kind: 'coin' },
  { value: 20, kind: 'coin' },
  { value: 10, kind: 'coin' },
];

/** Billetes que el cliente suele entregar (para contarlos tocándolos). */
export const TENDER_BILLS: readonly Cents[] = [20000, 10000, 5000, 2000, 1000];

export interface ChangePart extends Piece {
  count: number;
}

export interface ChangeBreakdown {
  parts: ChangePart[];
  /** Céntimos que no se pueden dar con monedas en circulación (menos de 10). */
  rest: Cents;
}

/**
 * Cómo dar el vuelto con la menor cantidad de billetes y monedas.
 * Con las denominaciones del sol, el método codicioso da siempre el mínimo.
 */
export function changeBreakdown(change: Cents): ChangeBreakdown {
  assertCents(change);
  if (change <= 0) return { parts: [], rest: 0 };
  let left = change;
  const parts: ChangePart[] = [];
  for (const p of PEN_PIECES) {
    const count = Math.floor(left / p.value);
    if (count > 0) {
      parts.push({ ...p, count });
      left -= count * p.value;
    }
  }
  return { parts, rest: left };
}

/** Texto corto para leer en voz alta: "un billete de 20 y una moneda de 5". */
export function describeBreakdown(b: ChangeBreakdown): string {
  const words = b.parts.map((p) => {
    const noun = p.kind === 'bill' ? (p.count === 1 ? 'billete' : 'billetes') : p.count === 1 ? 'moneda' : 'monedas';
    const article = p.count === 1 ? (p.kind === 'bill' ? 'un' : 'una') : String(p.count);
    return `${article} ${noun} de ${pieceLabel(p.value)}`;
  });
  if (words.length === 0) return '';
  if (words.length === 1) return words[0]!;
  return `${words.slice(0, -1).join(', ')} y ${words.at(-1)}`;
}

/** 2000 → "20 soles", 50 → "50 céntimos", 100 → "1 sol". */
export function pieceLabel(value: Cents): string {
  if (value < 100) return `${value} céntimos`;
  const soles = value / 100;
  return soles === 1 ? '1 sol' : `${soles} soles`;
}

/** Monto en palabras para la voz: 47550 → "475 soles con 50 céntimos". */
export function spokenAmount(cents: Cents): string {
  assertCents(cents);
  const soles = Math.floor(Math.abs(cents) / 100);
  const cts = Math.abs(cents) % 100;
  const solesText = soles === 1 ? '1 sol' : `${soles} soles`;
  if (cts === 0) return solesText;
  if (soles === 0) return `${cts} céntimos`;
  return `${solesText} con ${cts} céntimos`;
}
