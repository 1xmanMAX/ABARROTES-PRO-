/**
 * Formato del respaldo (SPEC §13): JSON cifrado con AES-GCM 256. La clave sale del
 * código de dueño con PBKDF2-SHA256 y una sal aleatoria.
 *
 * Nota de seguridad: con un código de 4 dígitos, quien robe el archivo podría
 * probar las 10 000 combinaciones en su computadora (el bloqueo por intentos solo
 * existe dentro de la app). Las muchas iteraciones lo hacen lento, no imposible.
 */
export const BACKUP_APP = 'mi-bodega';
export const BACKUP_FORMAT = 1;
export const BACKUP_ITERATIONS = 600_000;

export interface BackupEnvelope {
  app: typeof BACKUP_APP;
  format: number;
  /** Versión del esquema de la BD que hizo el respaldo. */
  schemaVersion: number;
  createdAt: number;
  /** Resumen visible sin descifrar (para confirmar antes de restaurar). */
  summary: Record<string, number>;
  kdf: { name: 'PBKDF2-SHA256'; iterations: number; salt: string };
  cipher: { name: 'AES-GCM'; iv: string };
  data: string;
}

export function toBase64(bytes: Uint8Array): string {
  let s = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) s += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(s);
}

export function fromBase64(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

async function deriveKey(pin: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptBackup(
  plain: unknown,
  pin: string,
  meta: { schemaVersion: number; createdAt: number; summary: Record<string, number> },
  iterations = BACKUP_ITERATIONS,
): Promise<BackupEnvelope> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(pin, salt, iterations);
  const bytes = new TextEncoder().encode(JSON.stringify(plain));
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, bytes));
  return {
    app: BACKUP_APP,
    format: BACKUP_FORMAT,
    ...meta,
    kdf: { name: 'PBKDF2-SHA256', iterations, salt: toBase64(salt) },
    cipher: { name: 'AES-GCM', iv: toBase64(iv) },
    data: toBase64(cipher),
  };
}

export class BackupError extends Error {
  constructor(
    public readonly code: 'not_backup' | 'newer_format' | 'wrong_pin',
    message: string,
  ) {
    super(message);
    this.name = 'BusinessError';
  }
}

/** Lee y valida el archivo sin descifrar. */
export function parseEnvelope(text: string): BackupEnvelope {
  let obj: unknown;
  try {
    obj = JSON.parse(text);
  } catch {
    throw new BackupError('not_backup', 'Este archivo no es un respaldo de Mi Bodega.');
  }
  const e = obj as Partial<BackupEnvelope>;
  if (!e || e.app !== BACKUP_APP || typeof e.data !== 'string' || !e.kdf || !e.cipher) {
    throw new BackupError('not_backup', 'Este archivo no es un respaldo de Mi Bodega.');
  }
  if ((e.format ?? 0) > BACKUP_FORMAT) {
    throw new BackupError('newer_format', 'El respaldo es de una versión más nueva de la app. Actualiza la app primero.');
  }
  return e as BackupEnvelope;
}

/** Descifra; con un código equivocado AES-GCM falla (también si el archivo fue alterado). */
export async function decryptBackup(envelope: BackupEnvelope, pin: string): Promise<unknown> {
  const key = await deriveKey(pin, fromBase64(envelope.kdf.salt), envelope.kdf.iterations);
  try {
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromBase64(envelope.cipher.iv) as BufferSource },
      key,
      fromBase64(envelope.data) as BufferSource,
    );
    return JSON.parse(new TextDecoder().decode(plain));
  } catch {
    throw new BackupError('wrong_pin', 'Código incorrecto, o el archivo está dañado.');
  }
}

/** ¿Toca recordar el respaldo? (semanal). */
export const BACKUP_REMINDER_DAYS = 7;
export function backupDue(lastBackupAt: number | null, hasData: boolean, now: number): boolean {
  if (!hasData) return false;
  return lastBackupAt === null || now - lastBackupAt > BACKUP_REMINDER_DAYS * 86_400_000;
}

export function daysSince(ts: number, now: number): number {
  return Math.floor((now - ts) / 86_400_000);
}
