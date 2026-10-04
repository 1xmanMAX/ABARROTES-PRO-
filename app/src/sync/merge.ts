/**
 * Fusión a tres vías (adaptada de Canvas de Citas, app/src/lib/sincro.js). `base` es cómo quedaron
 * los datos en la última sincronización; se compara registro por registro (por `id`) y campo por
 * campo. Si solo un lado cambió algo, gana ese lado; si ambos cambiaron lo mismo, gana el local
 * (quien sincroniza) y se cuenta el conflicto.
 *
 * Diferencia con Canvas: aquí nada se borra (las ventas se anulan), así que si un registro falta
 * en un lado se conserva el del otro. Un aparato con la base perdida nunca borra datos de la PC.
 */
export type Rec = Record<string, unknown> & { id: string };
export type SyncData = Record<string, Rec[]>;
/**
 * Reglas por nombre de campo cuando ambos lados lo cambiaron: 'max' se queda con el mayor (fechas
 * de modificación) y 'derived' no cuenta como conflicto (son cachés que se recalculan después).
 */
export type MergeRules = Record<string, 'max' | 'derived'>;

export function equal(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) return a.length === (b as unknown[]).length && a.every((x, i) => equal(x, (b as unknown[])[i]));
  const oa = a as Record<string, unknown>,
    ob = b as Record<string, unknown>;
  const ka = Object.keys(oa).filter((k) => oa[k] !== undefined);
  const kb = Object.keys(ob).filter((k) => ob[k] !== undefined);
  return ka.length === kb.length && ka.every((k) => equal(oa[k], ob[k]));
}

const isObject = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);

interface Ctx {
  conflicts: number;
  rules: MergeRules;
}

function mergeValue(b: unknown, l: unknown, r: unknown, ctx: Ctx, key?: string): unknown {
  if (equal(l, r)) return l;
  if (equal(b, l)) return r;
  if (equal(b, r)) return l;
  // Ambos lados cambiaron.
  const rule = key ? ctx.rules[key] : undefined;
  if (rule === 'max' && typeof l === 'number' && typeof r === 'number') return Math.max(l, r);
  if (rule === 'derived') return l;
  if (isObject(l) && isObject(r) && (b === undefined || isObject(b))) {
    const out: Record<string, unknown> = {};
    for (const k of new Set([...Object.keys(l), ...Object.keys(r)])) {
      const v = mergeValue(isObject(b) ? b[k] : undefined, l[k], r[k], ctx, k);
      if (v !== undefined) out[k] = v;
    }
    return out;
  }
  ctx.conflicts++;
  return l;
}

/** Une dos listas por id, ordenadas por id (ULID: en orden de creación). */
function mergeList(b: Rec[], l: Rec[], r: Rec[], ctx: Ctx): Rec[] {
  const mb = new Map(b.map((x) => [x.id, x]));
  const ml = new Map(l.map((x) => [x.id, x]));
  const mr = new Map(r.map((x) => [x.id, x]));
  const ids = [...new Set([...ml.keys(), ...mr.keys()])].sort();
  return ids.map((id) => {
    const lo = ml.get(id),
      re = mr.get(id);
    if (!lo) return re!;
    if (!re) return lo;
    return mergeValue(mb.get(id), lo, re, ctx) as Rec;
  });
}

export function merge3(base: SyncData | null, local: SyncData, remote: SyncData, tables: readonly string[], rules: MergeRules = {}) {
  const ctx: Ctx = { conflicts: 0, rules };
  const result: SyncData = {};
  for (const t of tables) result[t] = mergeList(base?.[t] ?? [], local[t] ?? [], remote[t] ?? [], ctx);
  return { result, conflicts: ctx.conflicts };
}
