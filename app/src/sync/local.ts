/**
 * La base de datos de la app vista por la sincronización: qué se sincroniza, cómo se lee y cómo se
 * escribe lo que llega de la PC.
 *
 * - No viajan: las pestañas abiertas (tickets 'open' y sus líneas, son de cada aparato) ni la caché
 *   de predicción (se reconstruye). De Ajustes solo viajan los datos del negocio.
 * - Las fotos (Blob) viajan en base64, como en la copia de seguridad.
 * - La base de la última sincronización se guarda aparte, en la BD 'mi-bodega-sync'.
 */
import Dexie, { type Table } from 'dexie';
import { revive, serialize } from '../db/backup';
import { db } from '../db/schema';
import { DEFAULT_SETTINGS } from '../db/settings';
import type { Consignment, ConsignmentLine, DayClose, LedgerEntry, Party, Product, SettlementLine, StockMovement } from '../db/types';
import { recomputeCaches } from './caches';
import type { LocalStore } from './client';
import { equal, type Rec, type SyncData } from './merge';

export const SYNC_TABLES = [
  'products',
  'tickets',
  'ticketLines',
  'stockMovements',
  'cashMovements',
  'auditLog',
  'parties',
  'ledgerEntries',
  'signatures',
  'consignments',
  'consignmentLines',
  'settlements',
  'settlementLines',
  'purchases',
  'purchaseLines',
  'dayCloses',
  'settings',
] as const;

/** Lo de Ajustes que es del negocio (el tema, el orden de la cuadrícula… son de cada aparato). */
export const SYNC_SETTINGS = ['shopName', 'receiptFooter', 'paperWidth', 'openingCash', 'ownerPin', 'fixedMonthlyCosts', 'maxHaggle'] as const;

// --- Contador de cambios locales (para no pisar una venta hecha durante la sincronización) ---

let changes = 0;
let applying = false;
const listeners = new Set<() => void>();
const hooked = new WeakSet<Dexie>();

/** Engancha el contador a la BD actual (una vez por instancia; los tests cambian la BD). */
function ensureHooks() {
  if (hooked.has(db)) return;
  hooked.add(db);
  const bump = () => {
    changes++;
    if (!applying) for (const fn of listeners) fn();
  };
  for (const name of SYNC_TABLES) {
    const t = db.table(name);
    t.hook('creating', bump);
    t.hook('updating', bump);
    t.hook('deleting', bump);
  }
}

/** Avisa de cada cambio hecho en este aparato (no de los que trae la sincronización). */
export function onLocalChange(fn: () => void): () => void {
  ensureHooks();
  listeners.add(fn);
  return () => listeners.delete(fn);
}

const byId = (a: Rec, b: Rec) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

async function readTables(): Promise<{ data: SyncData; seq: number }> {
  ensureHooks();
  const { raw, seq } = await db.transaction('r', [...SYNC_TABLES], async () => {
    const raw: Record<string, Rec[]> = {};
    for (const name of SYNC_TABLES) raw[name] = (await db.table(name).toArray()) as Rec[];
    return { raw, seq: changes };
  });
  const open = new Set(raw.tickets!.filter((t) => t.status === 'open').map((t) => t.id));
  raw.tickets = raw.tickets!.filter((t) => !open.has(t.id));
  raw.ticketLines = raw.ticketLines!.filter((l) => !open.has(l.ticketId as string));
  raw.settings = raw.settings!.map((s) => ({ id: s.id, ...Object.fromEntries(SYNC_SETTINGS.map((k) => [k, s[k] ?? null])) }));
  const data: SyncData = {};
  for (const name of SYNC_TABLES) data[name] = ((await serialize(raw[name])) as Rec[]).sort(byId);
  return { data, seq };
}

/** Registros nuevos o cambiados de `next` respecto de `current`, por tabla. */
function changed(current: SyncData, next: SyncData): Record<string, Rec[]> {
  const out: Record<string, Rec[]> = {};
  for (const name of SYNC_TABLES) {
    const cur = new Map((current[name] ?? []).map((x) => [x.id, x]));
    const rows = (next[name] ?? []).filter((x) => !equal(cur.get(x.id), x));
    if (rows.length) out[name] = rows;
  }
  return out;
}

async function writeTables(current: SyncData, next: SyncData, seq: number): Promise<boolean> {
  const rows = changed(current, next);
  const names = Object.keys(rows);
  if (!names.length) return true; // nada que escribir: no se pisa nada
  const revived = Object.fromEntries(names.map((n) => [n, revive(rows[n]) as Rec[]]));
  return db.transaction('rw', names, async () => {
    if (changes !== seq) return false;
    applying = true;
    try {
      for (const name of names) {
        if (name === 'settings') {
          for (const s of revived[name]!) {
            const { id, ...fields } = s;
            const prev = (await db.settings.get(id as 'main')) ?? DEFAULT_SETTINGS;
            await db.settings.put({ ...prev, ...fields, id: 'main' });
          }
        } else {
          await db.table(name).bulkPut(revived[name]!);
        }
      }
    } finally {
      applying = false;
    }
    return true;
  });
}

/** Recalcula stock, mercadería en consignación, saldos y lo liquidado; un solo cierre por día. */
export function finalize(data: SyncData): SyncData {
  const t = <T>(name: string) => (data[name] ?? []) as unknown as T[];
  const fixed = recomputeCaches(
    {
      stockMovements: t<StockMovement>('stockMovements'),
      ledgerEntries: t<LedgerEntry>('ledgerEntries'),
      consignments: t<Consignment>('consignments'),
      consignmentLines: t<ConsignmentLine>('consignmentLines'),
      settlementLines: t<SettlementLine>('settlementLines'),
    },
    t<Product>('products'),
    t<Party>('parties'),
  );
  const replace = (name: string, rows: { id: string }[]) => {
    if (!rows.length) return data[name] ?? [];
    const m = new Map(rows.map((r) => [r.id, r as unknown as Rec]));
    return (data[name] ?? []).map((r) => m.get(r.id) ?? r);
  };
  // Si se cerró el mismo día en dos aparatos, vale el primer cierre.
  const firstClose = new Map<string, DayClose>();
  for (const c of t<DayClose>('dayCloses')) {
    const prev = firstClose.get(c.dayKey);
    if (!prev || c.createdAt < prev.createdAt || (c.createdAt === prev.createdAt && c.id < prev.id)) firstClose.set(c.dayKey, c);
  }
  const keep = new Set([...firstClose.values()].map((c) => c.id));
  return {
    ...data,
    products: replace('products', fixed.products),
    parties: replace('parties', fixed.parties),
    consignmentLines: replace('consignmentLines', fixed.consignmentLines),
    dayCloses: (data.dayCloses ?? []).filter((c) => keep.has(c.id)),
  };
}

// --- Datos propios de la sincronización: código, este aparato, base, última vez ---

class SyncMetaDB extends Dexie {
  kv!: Table<{ key: string; value: unknown }, string>;
  constructor() {
    super('mi-bodega-sync');
    this.version(1).stores({ kv: 'key' });
  }
}
const meta = new SyncMetaDB();

export async function getMeta<T>(key: string): Promise<T | undefined> {
  return (await meta.kv.get(key))?.value as T | undefined;
}
export async function setMeta(key: string, value: unknown): Promise<void> {
  await meta.kv.put({ key, value });
}

export const localStore: LocalStore = {
  tables: SYNC_TABLES,
  rules: {
    updatedAt: 'max',
    lastUsedAt: 'max',
    stock: 'derived',
    consignedQty: 'derived',
    balance: 'derived',
    qtyReturned: 'derived',
    qtySold: 'derived',
  },
  read: readTables,
  seq: () => changes,
  write: writeTables,
  finalize,
  readBase: async () => (await getMeta<SyncData>('base')) ?? null,
  saveBase: (data) => setMeta('base', data),
};
