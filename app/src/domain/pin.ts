/**
 * Código personal de 4 dígitos (SPEC §9, DATA_MODEL §5).
 *
 * Nota de seguridad: 4 dígitos son 10 000 combinaciones. La protección real
 * viene del bloqueo por intentos y de que la operación ocurre delante del
 * dueño. No es criptografía fuerte contra alguien con acceso al archivo de la
 * BD; es aceptable para este uso. Nunca se guarda ni se registra el código.
 */
export interface PinRecord {
  hash: string;
  salt: string;
  iterations: number;
  failedCount: number;
  failedWindowStart: number | null;
  lockedUntil: number | null;
  requiresOwnerReset: boolean;
  setAt: number;
}

export const PIN_LENGTH = 4;
export const DEFAULT_ITERATIONS = 210_000;
export const LOCK_AFTER = 3;
export const LOCK_MS = 5 * 60_000;
export const OWNER_RESET_AFTER = 6;
export const FAIL_WINDOW_MS = 24 * 3_600_000;

const TRIVIAL = new Set([
  '0123',
  '1234',
  '2345',
  '3456',
  '4567',
  '5678',
  '6789',
  '9876',
  '8765',
  '7654',
  '6543',
  '5432',
  '4321',
  '3210',
]);

export type PinRejection = 'length' | 'trivial' | 'birth_year';

/** Rechaza códigos triviales: 0000, 1111…, secuencias y el año de nacimiento. */
export function validateNewPin(pin: string, birthYear?: number | null): PinRejection | null {
  if (!/^\d{4}$/.test(pin)) return 'length';
  if (/^(\d)\1{3}$/.test(pin) || TRIVIAL.has(pin)) return 'trivial';
  if (birthYear && String(birthYear) === pin) return 'birth_year';
  return null;
}

function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}
function fromBase64(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

async function derive(pin: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations },
    key,
    256,
  );
  return new Uint8Array(bits);
}

export async function createPinRecord(pin: string, now: number, iterations = DEFAULT_ITERATIONS): Promise<PinRecord> {
  if (validateNewPin(pin) === 'length') throw new Error('El código debe tener 4 dígitos');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(pin, salt, iterations);
  return {
    hash: toBase64(hash),
    salt: toBase64(salt),
    iterations,
    failedCount: 0,
    failedWindowStart: null,
    lockedUntil: null,
    requiresOwnerReset: false,
    setAt: now,
  };
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}

/** Recalcula PBKDF2 y compara en tiempo constante. No mira bloqueos. */
export async function pinMatches(record: PinRecord, attempt: string): Promise<boolean> {
  if (!/^\d{4}$/.test(attempt)) return false;
  const hash = await derive(attempt, fromBase64(record.salt), record.iterations);
  return constantTimeEqual(hash, fromBase64(record.hash));
}

export type PinStatus = { kind: 'ok' } | { kind: 'locked'; until: number } | { kind: 'owner_reset' };

export function pinStatus(record: PinRecord, now: number): PinStatus {
  if (record.requiresOwnerReset) return { kind: 'owner_reset' };
  if (record.lockedUntil !== null && record.lockedUntil > now) return { kind: 'locked', until: record.lockedUntil };
  return { kind: 'ok' };
}

/** Registra un fallo: 3 seguidos bloquean 5 min; 6 en 24 h exigen al dueño. */
export function registerFailure(record: PinRecord, now: number): PinRecord {
  const windowStart =
    record.failedWindowStart !== null && now - record.failedWindowStart < FAIL_WINDOW_MS ? record.failedWindowStart : now;
  const failedCount = (windowStart === record.failedWindowStart ? record.failedCount : 0) + 1;
  return {
    ...record,
    failedCount,
    failedWindowStart: windowStart,
    lockedUntil: failedCount % LOCK_AFTER === 0 ? now + LOCK_MS : record.lockedUntil,
    requiresOwnerReset: record.requiresOwnerReset || failedCount >= OWNER_RESET_AFTER,
  };
}

/** Un acierto reinicia los contadores. */
export function registerSuccess(record: PinRecord): PinRecord {
  return { ...record, failedCount: 0, failedWindowStart: null, lockedUntil: null };
}

/** Intentos que quedan antes del próximo bloqueo. */
export function attemptsLeft(record: PinRecord): number {
  return LOCK_AFTER - (record.failedCount % LOCK_AFTER);
}

/** El dueño desbloquea: reinicia contadores y bloqueos. */
export function ownerUnlock(record: PinRecord): PinRecord {
  return { ...record, failedCount: 0, failedWindowStart: null, lockedUntil: null, requiresOwnerReset: false };
}
