import { decryptBackup, encryptBackup, fromBase64, parseEnvelope, toBase64, type BackupEnvelope } from '../domain/backup';
import { dayKeyOf } from '../domain/time';
import { BusinessError } from './errors';
import { newId } from './ids';
import { hasOwnerPin, verifyOwnerPin } from './pins';
import { db } from './schema';
import { rebuildStats } from './stats';

interface BlobRef {
  __blob: string;
  type: string;
}

/** Convierte Blobs (fotos) a base64 para poder guardarlos en JSON. */
export async function serialize(value: unknown): Promise<unknown> {
  if (value instanceof Blob) {
    return { __blob: toBase64(new Uint8Array(await value.arrayBuffer())), type: value.type } satisfies BlobRef;
  }
  if (Array.isArray(value)) return Promise.all(value.map(serialize));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = await serialize(v);
    return out;
  }
  return value;
}

export function revive(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(revive);
  if (value && typeof value === 'object') {
    const ref = value as Partial<BlobRef>;
    if (typeof ref.__blob === 'string') return new Blob([fromBase64(ref.__blob) as BlobPart], { type: ref.type ?? '' });
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = revive(v);
    return out;
  }
  return value;
}

interface BackupData {
  tables: Record<string, unknown[]>;
}

const SUMMARY_TABLES = ['products', 'tickets', 'parties', 'cashMovements'] as const;

/**
 * Crea el respaldo cifrado. Exige el código de dueño (SPEC §9.5) y lo usa como
 * clave del cifrado.
 */
export async function createBackup(
  ownerPin: string,
  now = Date.now(),
  iterations?: number,
): Promise<{ fileName: string; text: string }> {
  await verifyOwnerPin(ownerPin, now);
  const raw = await db.transaction('r', db.tables, async () => {
    const tables: Record<string, unknown[]> = {};
    for (const table of db.tables) tables[table.name] = await table.toArray();
    return tables;
  });
  const tables: Record<string, unknown[]> = {};
  for (const [name, rows] of Object.entries(raw)) tables[name] = (await serialize(rows)) as unknown[];
  const summary: Record<string, number> = Object.fromEntries(SUMMARY_TABLES.map((n) => [n, tables[n]?.length ?? 0]));
  // Ventas = tickets cerrados (los abiertos son pestañas en espera).
  summary.sales =
    (raw.tickets as { status: string }[] | undefined)?.filter((x) => x.status === 'paid' || x.status === 'credit').length ?? 0;
  const envelope = await encryptBackup(
    { tables } satisfies BackupData,
    ownerPin,
    { schemaVersion: db.verno, createdAt: now, summary },
    iterations,
  );
  await db.settings.update('main', { lastBackupAt: now });
  return { fileName: `mi-bodega-respaldo-${dayKeyOf(now)}.json`, text: JSON.stringify(envelope) };
}

/** Lee el archivo sin descifrar, para mostrar fecha y contenido antes de restaurar. */
export function inspectBackup(text: string): BackupEnvelope {
  return parseEnvelope(text);
}

/**
 * Restaura un respaldo: REEMPLAZA todos los datos del teléfono, en una sola
 * transacción. Pide el código de dueño actual (si hay) y el código con el que se
 * hizo el respaldo (para descifrarlo).
 */
export async function restoreBackup(text: string, backupPin: string, currentOwnerPin?: string, now = Date.now()): Promise<void> {
  if (await hasOwnerPin()) {
    if (!currentOwnerPin) throw new BusinessError('owner_pin_required', 'Se necesita tu código de dueño actual.');
    await verifyOwnerPin(currentOwnerPin, now);
  }
  const envelope = parseEnvelope(text);
  if (envelope.schemaVersion > db.verno) {
    throw new BusinessError('newer_schema', 'El respaldo es de una versión más nueva de la app. Actualiza la app primero.');
  }
  const data = (await decryptBackup(envelope, backupPin)) as Partial<BackupData>;
  if (!data || typeof data.tables !== 'object' || !data.tables)
    throw new BusinessError('invalid', 'El respaldo está incompleto.');
  const incoming = data.tables;

  await db.transaction('rw', db.tables, async () => {
    for (const table of db.tables) {
      await table.clear();
      const rows = incoming[table.name];
      if (Array.isArray(rows) && rows.length) await table.bulkAdd(revive(rows) as never[]);
    }
    await db.auditLog.add({
      id: newId(),
      action: 'backup_restored',
      entity: 'settings',
      entityId: 'main',
      detail: `Respaldo del ${new Date(envelope.createdAt).toISOString()} restaurado`,
      createdAt: now,
    });
  });
  // Respaldos de versiones anteriores pueden no traer la caché de predicción.
  await rebuildStats();
}
