import {
  addTicketToStats,
  pairKey,
  removeTicketFromStats,
  type PairStat,
  type ProductStat,
  type StatUpdates,
} from '../domain/stats';
import { db, rebuildStatsIn, toStatLine } from './schema';
import type { TicketLine } from './types';

/**
 * Aplica un ticket a la caché de predicción. Debe llamarse DENTRO de la
 * transacción de la operación (checkout/anulación), que ya incluye estas tablas.
 */
export async function applyTicketStats(
  lines: Pick<TicketLine, 'productId' | 'qty' | 'fractional'>[],
  mode: { kind: 'add'; at: number } | { kind: 'remove'; soldAt: number; now: number },
): Promise<StatUpdates> {
  const statLines = lines.map(toStatLine);
  const ids = [...new Set(statLines.map((l) => l.productId))];
  const pairKeys: string[] = [];
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) pairKeys.push(pairKey(ids[i]!, ids[j]!).key);

  const products = new Map(
    (await db.productStats.bulkGet(ids)).filter((s): s is ProductStat => !!s).map((s) => [s.productId, s]),
  );
  const pairs = new Map((await db.pairStats.bulkGet(pairKeys)).filter((s): s is PairStat => !!s).map((s) => [s.key, s]));
  const get = [(id: string) => products.get(id), (k: string) => pairs.get(k)] as const;
  const upd =
    mode.kind === 'add'
      ? addTicketToStats(...get, statLines, mode.at)
      : removeTicketFromStats(...get, statLines, mode.soldAt, mode.now);
  await db.productStats.bulkPut(upd.products);
  await db.pairStats.bulkPut(upd.pairs);
  return upd;
}

export async function loadAllStats(): Promise<{
  products: Map<string, ProductStat>;
  pairs: Map<string, PairStat>;
  closedTickets: number;
}> {
  return db.transaction('r', [db.productStats, db.pairStats, db.tickets], async () => ({
    products: new Map((await db.productStats.toArray()).map((s) => [s.productId, s])),
    pairs: new Map((await db.pairStats.toArray()).map((s) => [s.key, s])),
    closedTickets: await db.tickets.where('status').anyOf('paid', 'credit').count(),
  }));
}

/** Reconstruye la caché completa desde el historial. */
export async function rebuildStats(): Promise<void> {
  await db.transaction('rw', [db.tickets, db.ticketLines, db.productStats, db.pairStats], (tx) => rebuildStatsIn(tx));
}
