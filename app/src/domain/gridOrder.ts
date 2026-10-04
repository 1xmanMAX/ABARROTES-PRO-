export interface GridProduct {
  id: string;
  name: string;
  pinnedPosition: number | null;
  /** Puntaje de popularidad (Fase 2: decayedQty). Mayor primero. */
  score?: number;
}

const collator = new Intl.Collator('es-PE', { sensitivity: 'base', numeric: true });

/**
 * Orden de la cuadrícula: los fijados en su posición (1 = primera) y el resto
 * por puntaje descendente, con desempate por nombre.
 */
export function computeGridOrder(products: GridProduct[]): string[] {
  const free = products
    .filter((p) => p.pinnedPosition == null)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || collator.compare(a.name, b.name));
  const pinned = products
    .filter((p) => p.pinnedPosition != null)
    .sort((a, b) => a.pinnedPosition! - b.pinnedPosition! || collator.compare(a.name, b.name));

  const total = products.length;
  const slots: (string | null)[] = new Array(total).fill(null);
  const overflow: string[] = [];
  for (const p of pinned) {
    const idx = Math.max(0, p.pinnedPosition! - 1);
    if (idx < total && slots[idx] === null) slots[idx] = p.id;
    else overflow.push(p.id);
  }
  const rest = [...overflow, ...free.map((p) => p.id)];
  for (let i = 0; i < total; i++) if (slots[i] === null) slots[i] = rest.shift() ?? null;
  return slots.filter((s): s is string => s !== null);
}

/**
 * Aplica un orden guardado a la lista actual: los ids desconocidos se descartan
 * y los productos nuevos van al final (no se reordena en caliente).
 */
export function applyGridOrder<T extends { id: string; name: string }>(order: string[], products: T[]): T[] {
  const byId = new Map(products.map((p) => [p.id, p]));
  const out: T[] = [];
  for (const id of order) {
    const p = byId.get(id);
    if (p) {
      out.push(p);
      byId.delete(id);
    }
  }
  const rest = [...byId.values()].sort((a, b) => collator.compare(a.name, b.name));
  return [...out, ...rest];
}

export function searchProducts<T extends { name: string; baseName?: string; category?: string }>(
  products: T[],
  query: string,
): T[] {
  const q = normalize(query);
  if (!q) return products;
  const terms = q.split(/\s+/);
  return products.filter((p) => {
    const hay = normalize(`${p.name} ${p.baseName ?? ''} ${p.category ?? ''}`);
    const words = hay.split(/\s+/);
    return terms.every((t) => hay.includes(t) || words.some((w) => nearPrefix(t, w)));
  });
}

/**
 * Tolerancia a errores de escritura (niños, apuro): "arros" encuentra "arroz" y "asucar",
 * "azúcar". Compara el término con el comienzo de la palabra admitiendo 1 letra distinta
 * (2 si el término es largo). Los términos de menos de 3 letras deben coincidir exacto.
 */
export function nearPrefix(term: string, word: string): boolean {
  if (term.length < 3) return false;
  const max = term.length >= 7 ? 2 : 1;
  return Math.min(editDistance(term, word.slice(0, term.length)), editDistance(term, word.slice(0, term.length + 1))) <= max;
}

function editDistance(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length]!;
}

export function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}
