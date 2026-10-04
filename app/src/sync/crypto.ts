/**
 * Cifrado de la sincronización: AES-256-GCM (WebCrypto). Sobre = IV (12 bytes) + texto cifrado
 * con etiqueta. El contenido lleva delante la hora (8 bytes, ms, big-endian): se rechaza lo que
 * tenga más de EDAD_MAX de diferencia (contra repeticiones). Mismo formato que pc/src/cifrado.rs.
 * Copiado de Canvas de Citas (app/src/lib/cifrado.js).
 */
import { fromBase64, toBase64 } from '../domain/backup';

const AAD = new TextEncoder().encode('mibodega-sincro-v1');
export const EDAD_MAX = 5 * 60 * 1000;

export async function importKey(keyB64: string): Promise<CryptoKey> {
  const raw = fromBase64(keyB64.trim());
  if (raw.length !== 32) throw new Error('La clave debe tener 32 bytes');
  return crypto.subtle.importKey('raw', raw as BufferSource, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

export async function encryptBytes(
  key: CryptoKey,
  bytes: Uint8Array,
  iv: Uint8Array = crypto.getRandomValues(new Uint8Array(12)),
  now = Date.now(),
): Promise<Uint8Array> {
  const plain = new Uint8Array(8 + bytes.length);
  new DataView(plain.buffer).setBigUint64(0, BigInt(now));
  plain.set(bytes, 8);
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource, additionalData: AAD }, key, plain),
  );
  const out = new Uint8Array(12 + ct.length);
  out.set(iv);
  out.set(ct, 12);
  return out;
}

export async function decryptBytes(key: CryptoKey, envelope: Uint8Array, now = Date.now()): Promise<Uint8Array> {
  if (envelope.length < 12 + 8 + 16) throw new Error('Clave incorrecta o mensaje alterado');
  let plain: Uint8Array;
  try {
    plain = new Uint8Array(
      await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: envelope.subarray(0, 12) as BufferSource, additionalData: AAD },
        key,
        envelope.subarray(12) as BufferSource,
      ),
    );
  } catch {
    throw new Error('Clave incorrecta o mensaje alterado');
  }
  const t = Number(new DataView(plain.buffer, plain.byteOffset).getBigUint64(0));
  if (Math.abs(now - t) > EDAD_MAX) throw new Error('Mensaje vencido (revisa la hora del celular y de la PC)');
  return plain.subarray(8);
}

export const encryptJson = async (key: CryptoKey, obj: unknown, iv?: Uint8Array, now?: number) =>
  toBase64(await encryptBytes(key, new TextEncoder().encode(JSON.stringify(obj)), iv, now));

export const decryptJson = async <T = unknown>(key: CryptoKey, text: string, now?: number): Promise<T> =>
  JSON.parse(new TextDecoder().decode(await decryptBytes(key, fromBase64(text.trim()), now))) as T;
