import type { Cents } from './money';

export interface LedgerLike {
  type: 'charge' | 'payment' | 'adjustment';
  amount: Cents;
  voidedAt?: number | null;
}

/** Saldo = Σ cargos − Σ pagos ± ajustes (los ajustes llevan signo). Ignora anulados. */
export function computeBalance(entries: LedgerLike[]): Cents {
  let b = 0;
  for (const e of entries) {
    if (e.voidedAt) continue;
    if (e.type === 'charge') b += e.amount;
    else if (e.type === 'payment') b -= e.amount;
    else b += e.amount;
  }
  return b;
}

export interface CreditCheck {
  newBalance: Cents;
  overLimit: boolean;
  /** Cuánto se pasa del límite (0 si no se pasa). */
  excess: Cents;
}

/** Límite 0 = sin fiado: cualquier deuda nueva pasa el límite. */
export function checkCredit(balance: Cents, limit: Cents, amount: Cents): CreditCheck {
  const newBalance = balance + amount;
  const excess = Math.max(0, newBalance - limit);
  return { newBalance, overLimit: excess > 0, excess };
}

/** Normaliza un teléfono peruano para wa.me: 9 dígitos que empiezan en 9 → 51XXXXXXXXX. */
export function whatsappNumber(phone: string | null | undefined): string | null {
  const digits = (phone ?? '').replace(/\D/g, '');
  if (/^9\d{8}$/.test(digits)) return `51${digits}`;
  if (/^519\d{8}$/.test(digits)) return digits;
  return digits.length >= 8 ? digits : null;
}
