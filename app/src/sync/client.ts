/**
 * Una sincronización completa con la PC (la "casa" de los datos): traer lo que cambió en la PC,
 * fusionar a tres vías con la base, recalcular los cachés, enviar solo lo que cambió aquí
 * (reintentando si la PC cambió entre medio), guardar el resultado aquí y la nueva base.
 * Adaptado de Canvas de Citas (app/src/lib/sincro-cliente.js). El almacén y la conexión se inyectan.
 */
import type { Connection, Device, GroupMember } from './http';
import { merge3, type MergeRules, type SyncData } from './merge';
import { apply, diff, fingerprint, sizeOf } from './patch';

export interface LocalStore {
  tables: readonly string[];
  rules: MergeRules;
  /** Los datos de este aparato y un contador de cambios locales. */
  read(): Promise<{ data: SyncData; seq: number }>;
  /** Contador actual de cambios locales (sin leer los datos). */
  seq(): number;
  /**
   * Escribe `next` sobre `current`. Devuelve false, sin escribir nada, si hubo cambios locales
   * después de `seq` (entonces se vuelve a leer y fusionar).
   */
  write(current: SyncData, next: SyncData, seq: number): Promise<boolean>;
  /** Recalcula lo derivado (stock, saldos…) y corrige lo que no puede quedar duplicado. */
  finalize(data: SyncData): SyncData;
  readBase(): Promise<SyncData | null>;
  saveBase(data: SyncData): Promise<void>;
}

export interface SyncSummary {
  conflicts: number;
  retries: number;
  received: number | null;
  sent: number;
  bytes: number;
  group: GroupMember[];
}

export async function synchronize({
  connection,
  store,
  device,
  onProgress = () => {},
}: {
  connection: Connection;
  store: LocalStore;
  device: Device;
  onProgress?: (text: string) => void;
}): Promise<SyncSummary> {
  const tables = store.tables;
  let retries = 0,
    full = false,
    noBase = false;
  for (;;) {
    onProgress('Leyendo la PC…');
    const local = await store.read();
    const base = noBase ? null : await store.readBase();
    const r = await connection.read({ dispositivo: device.id, nombre: device.name, base: base ? await fingerprint(base, tables) : null });
    let remote: SyncData | null;
    try {
      remote = r.modo === 'parche' ? apply(base, r.parche ?? []) : (r.datos ?? null);
    } catch {
      remote = null;
    }
    // Si al aplicar el parche no queda igual que en la PC, se pide todo (base perdida o distinta).
    if (!remote || (await fingerprint(remote, tables)) !== r.huella) {
      if (r.modo === 'parche' && !noBase) {
        noBase = true;
        continue;
      }
      throw new Error('Los datos de la PC no llegaron completos');
    }
    // Sin base (primera vez o base perdida), en lo que difiera gana la PC: un aparato recién
    // vinculado adopta sus datos (p. ej. el código de dueño) y aporta solo lo que la PC no tiene.
    const merged = base ? merge3(base, local.data, remote, tables, store.rules) : merge3(null, remote, local.data, tables, store.rules);
    const result = store.finalize(merged.result);
    const ops = diff(remote, result);
    let w: { grupo?: GroupMember[] };
    try {
      onProgress(ops.length ? `Enviando ${ops.length} cambio${ops.length === 1 ? '' : 's'}…` : 'Sin cambios que enviar…');
      w = await connection.write(
        full
          ? { dispositivo: device.id, etiqueta: r.etiqueta, datos: result }
          : { dispositivo: device.id, etiqueta: r.etiqueta, parche: ops, huella: await fingerprint(result, tables) },
      );
    } catch (e) {
      const status = (e as { status?: number }).status;
      if (status === 409 && retries < 3) {
        retries++;
        continue;
      }
      if (status === 422 && !full) {
        full = true;
        continue;
      }
      throw e;
    }
    // Si mientras tanto hubo ventas en este aparato, se vuelven a fusionar (lo leído al empezar hace
    // de base): no se pierden y viajan a la PC en la próxima sincronización.
    onProgress('Guardando…');
    let current = local;
    for (let i = 0; ; i++) {
      if (store.seq() !== current.seq) current = await store.read();
      const next = current === local ? result : store.finalize(merge3(local.data, current.data, result, tables, store.rules).result);
      if (await store.write(current.data, next, current.seq)) break;
      if (i > 10) throw new Error('Hubo demasiados cambios a la vez; se sincronizará en un momento');
    }
    await store.saveBase(result);
    return {
      conflicts: merged.conflicts,
      retries,
      received: r.modo === 'parche' ? (r.parche?.length ?? 0) : null,
      sent: ops.length,
      bytes: sizeOf(r.modo === 'parche' ? r.parche : r.datos) + sizeOf(full ? result : ops),
      group: w.grupo ?? r.grupo ?? [],
    };
  }
}
