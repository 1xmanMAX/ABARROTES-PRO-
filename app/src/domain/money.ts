/** Dinero en céntimos enteros de sol. Nunca decimales flotantes. */
export type Cents = number;

const formatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function assertCents(value: number): asserts value is Cents {
  if (!Number.isSafeInteger(value)) throw new Error(`Monto inválido (no es entero en céntimos): ${value}`);
}

/** 123450 → "S/ 1,234.50". Con signo: "+S/ 1.00" / "−S/ 1.00". */
export function formatPEN(cents: Cents, opts: { sign?: boolean } = {}): string {
  assertCents(cents);
  const abs = formatter.format(Math.abs(cents) / 100);
  if (opts.sign) return `${cents < 0 ? '−' : '+'}S/ ${abs}`;
  return `${cents < 0 ? '−' : ''}S/ ${abs}`;
}

/** Formato sin símbolo para campos de edición: 18500 → "185.00". */
export function centsToInput(cents: Cents): string {
  assertCents(cents);
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

/**
 * Convierte texto escrito por el usuario ("185", "185.5", "1,234.50") a céntimos
 * sin pasar por flotantes. Devuelve null si no es un monto válido.
 */
export function parseSolesToCents(text: string): Cents | null {
  const clean = text.trim().replace(/,/g, '').replace(/^S\/\s*/i, '');
  const m = /^(\d+)(?:\.(\d{0,2}))?$/.exec(clean);
  if (!m) return null;
  const soles = Number(m[1]);
  const frac = (m[2] ?? '').padEnd(2, '0');
  const cents = soles * 100 + Number(frac);
  return Number.isSafeInteger(cents) ? cents : null;
}

/** Vuelto = recibido − total. Negativo significa que falta dinero. */
export function computeChange(total: Cents, received: Cents): Cents {
  assertCents(total);
  assertCents(received);
  return received - total;
}

const BILL_STEPS: Cents[] = [1000, 5000, 10000, 20000];

/**
 * Billetes rápidos: siguiente múltiplo de 10, 50, 100 y 200 soles ≥ total,
 * sin duplicados ni el propio total (eso es "Exacto"), máximo 3.
 */
export function billSuggestions(total: Cents): Cents[] {
  assertCents(total);
  if (total <= 0) return [];
  const out: Cents[] = [];
  for (const step of BILL_STEPS) {
    const v = Math.ceil(total / step) * step;
    if (v !== total && !out.includes(v)) out.push(v);
  }
  return out.sort((a, b) => a - b).slice(0, 3);
}
