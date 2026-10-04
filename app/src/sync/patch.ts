/**
 * Parches: solo lo que cambió entre dos versiones de los datos. Mismo algoritmo que
 * pc/src/parche.rs (copiado de Canvas de Citas, app/src/lib/parche.js).
 *
 * Un parche es una lista de operaciones sobre una ruta. Cada paso de la ruta es una clave de
 * objeto ("products") o un registro de una lista por su id ({ id: "01J…" }):
 *   { r: [...], v: valor }      poner (reemplaza o agrega)
 *   { r: [...], x: 1 }          quitar
 *   { r: [...], orden: [ids] }  reordenar una lista con ids
 */
import { equal, type SyncData } from './merge';

type Step = string | { id: string };
export type Op = { r: Step[]; v?: unknown; x?: 1; orden?: string[] };

const isObject = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
function withIds(v: unknown): v is { id: string }[] {
  if (!Array.isArray(v)) return false;
  const seen = new Set<string>();
  for (const x of v) {
    if (!isObject(x) || typeof x.id !== 'string' || seen.has(x.id)) return false;
    seen.add(x.id);
  }
  return true;
}

/** Operaciones que convierten `a` en `b`. */
export function diff(a: unknown, b: unknown, path: Step[] = [], ops: Op[] = []): Op[] {
  if (equal(a, b)) return ops;
  if (isObject(a) && isObject(b)) {
    for (const k of Object.keys(b)) {
      if (b[k] === undefined) continue;
      if (!(k in a) || a[k] === undefined) ops.push({ r: [...path, k], v: b[k] });
      else diff(a[k], b[k], [...path, k], ops);
    }
    for (const k of Object.keys(a)) if (a[k] !== undefined && (!(k in b) || b[k] === undefined)) ops.push({ r: [...path, k], x: 1 });
    return ops;
  }
  if (withIds(a) && withIds(b)) {
    const ma = new Map(a.map((x) => [x.id, x]));
    const mb = new Set(b.map((x) => x.id));
    for (const x of a) if (!mb.has(x.id)) ops.push({ r: [...path, { id: x.id }], x: 1 });
    for (const x of b) {
      if (!ma.has(x.id)) ops.push({ r: [...path, { id: x.id }], v: x });
      else diff(ma.get(x.id), x, [...path, { id: x.id }], ops);
    }
    const kept = [...a.filter((x) => mb.has(x.id)).map((x) => x.id), ...b.filter((x) => !ma.has(x.id)).map((x) => x.id)];
    if (kept.some((id, i) => id !== b[i]!.id)) ops.push({ r: path, orden: b.map((x) => x.id) });
    return ops;
  }
  ops.push({ r: path, v: b });
  return ops;
}

const copy = <T>(v: T): T => (v === undefined ? v : (JSON.parse(JSON.stringify(v)) as T));

function child(container: unknown, step: Step): unknown {
  if (typeof step === 'string') return isObject(container) ? container[step] : undefined;
  return Array.isArray(container) ? container.find((x) => isObject(x) && x.id === step.id) : undefined;
}

const foreign = () => new Error('El parche no corresponde a esta versión de los datos');

/** Aplica un parche a una copia de `a` y la devuelve. */
export function apply<T>(a: T, ops: Op[]): T {
  let root: unknown = copy(a);
  for (const op of ops) {
    if (!op.r.length) {
      if ('v' in op) root = copy(op.v);
      continue;
    }
    let c: unknown = root;
    for (const step of op.r.slice(0, -1)) {
      c = child(c, step);
      if (c === undefined) throw foreign();
    }
    const last = op.r[op.r.length - 1]!;
    if (op.orden) {
      const list = child(c, last);
      if (!Array.isArray(list)) throw foreign();
      const pos = new Map(op.orden.map((id, i) => [id, i]));
      const sorted = [...list].sort((x, y) => (pos.get(x.id) ?? Infinity) - (pos.get(y.id) ?? Infinity));
      list.splice(0, list.length, ...sorted);
    } else if (typeof last === 'string') {
      if (!isObject(c)) throw foreign();
      if (op.x) delete c[last];
      else c[last] = copy(op.v);
    } else {
      if (!Array.isArray(c)) throw foreign();
      const i = c.findIndex((x) => isObject(x) && x.id === last.id);
      if (op.x) {
        if (i >= 0) c.splice(i, 1);
      } else if (i >= 0) c[i] = copy(op.v);
      else c.push(copy(op.v));
    }
  }
  return root as T;
}

/** JSON con las claves ordenadas: el mismo texto en JS y en Rust para los mismos datos. */
export function canonical(v: unknown): string {
  if (Array.isArray(v)) return '[' + v.map((x) => (x === undefined ? 'null' : canonical(x))).join(',') + ']';
  if (isObject(v)) {
    const ks = Object.keys(v)
      .filter((k) => v[k] !== undefined)
      .sort();
    return '{' + ks.map((k) => JSON.stringify(k) + ':' + canonical(v[k])).join(',') + '}';
  }
  return JSON.stringify(v);
}

/** Huella (sha-256, 32 hex) de los datos: ambos lados la comparan para saber si tienen la misma base. */
export async function fingerprint(data: SyncData | null, tables: readonly string[]): Promise<string> {
  const v = Object.fromEntries(tables.map((t) => [t, data?.[t] ?? []]));
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical(v))));
  return [...h.subarray(0, 16)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Tamaño aproximado (bytes) de un valor, para mostrar cuánto viajó. */
export const sizeOf = (v: unknown) => new TextEncoder().encode(JSON.stringify(v)).length;
