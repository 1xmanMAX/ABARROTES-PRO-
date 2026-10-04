/**
 * Conexión cifrada con el servidor de sincronización de la PC (pc/). Adaptado de Canvas de Citas
 * (app/src/lib/sincro-http.js).
 */
import { decryptJson, encryptJson, importKey } from './crypto';
import type { Op } from './patch';
import type { SyncData } from './merge';

/** "mibodega-sync://192.168.1.5:47482/#<clave>" → { url, key } */
export function parseCode(code: string): { url: string; key: string } {
  const m = /^mibodega-sync:\/\/([^/#\s]+)\/?#(\S+)$/.exec(String(code || '').trim());
  if (!m) throw new Error('Código de vinculación no válido');
  return { url: `http://${m[1]}`, key: decodeURIComponent(m[2]!) };
}

export class SyncHttpError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    /** Sin respuesta: la PC no está en esta red, apagada o con otra IP. */
    readonly network = false,
  ) {
    super(message);
  }
}

function httpError(status: number): SyncHttpError {
  const msg =
    status === 401
      ? 'La PC no reconoce este aparato: vuelve a vincularlo'
      : status === 409
        ? 'La PC cambió durante la sincronización'
        : status === 422
          ? 'La PC no pudo aplicar los cambios'
          : `La PC respondió ${status}`;
  return new SyncHttpError(msg, status);
}

export interface Device {
  id: string;
  name: string;
}
export interface GroupMember {
  id: string;
  nombre?: string;
  visto?: number;
  sincronizado?: number;
}
export interface ReadResponse {
  modo: 'parche' | 'completo';
  parche?: Op[];
  datos?: SyncData;
  etiqueta: string;
  huella: string;
  grupo: GroupMember[];
}
export interface WriteRequest {
  dispositivo: string;
  etiqueta: string;
  parche?: Op[];
  huella?: string;
  datos?: SyncData;
}

export interface Connection {
  hello(): Promise<{ app: string }>;
  read(req: { dispositivo: string; nombre: string; base: string | null }): Promise<ReadResponse>;
  write(req: WriteRequest): Promise<{ grupo?: GroupMember[] }>;
}

/** Tiempos máximos por petición (ms). */
export const TIMEOUTS = { hello: 1500, data: 60_000 };

export async function connect({
  url,
  key,
  fetchFn = fetch,
  timeouts = TIMEOUTS,
}: {
  url: string;
  key: string;
  fetchFn?: typeof fetch;
  timeouts?: { hello: number; data?: number };
}): Promise<Connection> {
  const k = await importKey(key);
  // Chrome pide permiso de "red local" para llamar a la PC desde otra página; con esto sabe a qué
  // espacio va la petición. Los navegadores que no lo conocen lo ignoran.
  const space = /^http:\/\/(127\.|localhost|\[::1\])/.test(url) ? 'loopback' : 'local';
  async function call(method: string, path: string, body: string | undefined, timeout: number): Promise<string> {
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), timeout);
    try {
      let r: Response;
      try {
        r = await fetchFn(url + path, {
          method,
          headers: { 'x-bodega-prueba': await encryptJson(k, { ruta: path }), 'content-type': 'text/plain' },
          body,
          signal: abort.signal,
          targetAddressSpace: space,
        } as RequestInit);
      } catch {
        throw new SyncHttpError('No se pudo conectar con la PC: ¿están en el mismo Wi-Fi y la PC está prendida?', undefined, true);
      }
      if (!r.ok) throw httpError(r.status);
      return await r.text();
    } finally {
      clearTimeout(timer);
    }
  }
  const data = timeouts.data ?? TIMEOUTS.data;
  return {
    hello: async () => decryptJson(k, await call('GET', '/sync/hola', undefined, timeouts.hello)),
    read: async (req) => decryptJson(k, await call('POST', '/sync/v2/leer', await encryptJson(k, req), data)),
    write: async (req) => decryptJson(k, await call('POST', '/sync/v2/escribir', await encryptJson(k, req), data)),
  };
}

const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

/** El mismo código con otra IP. */
export function codeWithIp(code: string, ip: string): string {
  const { url, key } = parseCode(code);
  const port = url.split(':')[2] ?? '47482';
  return `mibodega-sync://${ip}:${port}/#${key}`;
}

/** Direcciones a probar: la anterior primero, luego el resto de su red /24. */
export function candidates(ip: string): string[] {
  const m = IPV4.exec(ip);
  if (!m) return [];
  const net = `${m[1]}.${m[2]}.${m[3]}.`;
  return [ip, ...Array.from({ length: 254 }, (_, i) => net + (i + 1)).filter((x) => x !== ip)];
}

/**
 * Encontrar la PC si cambió su IP (el router le dio otra): se prueba cada dirección de la red con
 * /sync/hola; solo responde bien quien tiene la clave. Devuelve el código con la IP nueva o null.
 */
export async function findPc({
  code,
  fetchFn = fetch,
  timeout = 1500,
  parallel = 32,
  onProgress = () => {},
}: {
  code: string;
  fetchFn?: typeof fetch;
  timeout?: number;
  parallel?: number;
  onProgress?: (text: string) => void;
}): Promise<string | null> {
  const { url, key } = parseCode(code);
  const [ip = '', port = '47482'] = url.replace(/^http:\/\//, '').split(':');
  const queue = candidates(ip);
  let found: string | null = null;
  let tried = 0;
  async function worker() {
    while (!found && queue.length) {
      const c = queue.shift()!;
      try {
        const conn = await connect({ url: `http://${c}:${port}`, key, fetchFn, timeouts: { hello: timeout } });
        if ((await conn.hello()).app === 'mibodega-sincro') found ??= c;
      } catch {
        // no es la PC
      }
      if (++tried % 32 === 0) onProgress(`Buscando la PC en la red… (${tried}/254)`);
    }
  }
  await Promise.all(Array.from({ length: parallel }, worker));
  return found ? codeWithIp(code, found) : null;
}
