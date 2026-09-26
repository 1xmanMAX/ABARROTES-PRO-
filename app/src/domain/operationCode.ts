/** Crockford base32 sin I, L, O ni U. */
export const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** N.º de operación `MB-MMDD-XXXX` (DATA_MODEL §5.3). `monthDay` en hora de Lima, p. ej. '0926'. */
export function generateOperationCode(
  monthDay: string,
  random: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n)),
): string {
  const bytes = random(4);
  let code = '';
  for (const b of bytes) code += CROCKFORD[b % 32];
  return `MB-${monthDay}-${code}`;
}

export function isOperationCode(s: string): boolean {
  return /^MB-\d{4}-[0-9A-HJKMNP-TV-Z]{4}$/.test(s);
}

/** JSON canónico: claves ordenadas, sin espacios. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`;
}

export interface SignedPayload {
  purpose: string;
  partyId: string;
  amount: number;
  lines: unknown[];
  createdAt: number;
  operationCode: string;
}

/** SHA-256 (hex) del payload canónico (DATA_MODEL §5.4). */
export async function payloadHash(payload: SignedPayload): Promise<string> {
  const data = new TextEncoder().encode(canonicalJson(payload));
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', data));
  return [...digest].map((b) => b.toString(16).padStart(2, '0')).join('');
}
