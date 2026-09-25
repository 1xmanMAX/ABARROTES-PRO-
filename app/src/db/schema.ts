import Dexie, { type EntityTable, type Transaction } from 'dexie';
import { replayStats, type PairStat, type ProductStat } from '../domain/stats';
import type {
  AuditEntry,
  CashMovement,
  Consignment,
  ConsignmentLine,
  LedgerEntry,
  Party,
  Product,
  Settings,
  Settlement,
  SettlementLine,
  Signature,
  StockMovement,
  Ticket,
  TicketLine,
} from './types';

export class BodegaDB extends Dexie {
  products!: EntityTable<Product, 'id'>;
  tickets!: EntityTable<Ticket, 'id'>;
  ticketLines!: EntityTable<TicketLine, 'id'>;
  stockMovements!: EntityTable<StockMovement, 'id'>;
  cashMovements!: EntityTable<CashMovement, 'id'>;
  auditLog!: EntityTable<AuditEntry, 'id'>;
  settings!: EntityTable<Settings, 'id'>;
  productStats!: EntityTable<ProductStat, 'productId'>;
  pairStats!: EntityTable<PairStat, 'key'>;
  parties!: EntityTable<Party, 'id'>;
  ledgerEntries!: EntityTable<LedgerEntry, 'id'>;
  signatures!: EntityTable<Signature, 'id'>;
  consignments!: EntityTable<Consignment, 'id'>;
  consignmentLines!: EntityTable<ConsignmentLine, 'id'>;
  settlements!: EntityTable<Settlement, 'id'>;
  settlementLines!: EntityTable<SettlementLine, 'id'>;

  constructor(name = 'mi-bodega') {
    super(name);
    // Fase 1. Las tablas de personas, consignación, compras y estadísticas
    // se agregan como nuevas versiones en sus fases.
    this.version(1).stores({
      products: 'id, baseName, category, active, pinnedPosition',
      tickets: 'id, status, dayKey, partyId, closedAt, [dayKey+number]',
      ticketLines: 'id, ticketId, productId',
      stockMovements: 'id, productId, reason, createdAt, [refType+refId]',
      cashMovements: 'id, type, dayKey, createdAt, [refType+refId]',
      auditLog: 'id, entity, entityId, createdAt',
      settings: 'id',
    });
    // Fase 2: caché de predicción (DATA_MODEL §4), reconstruida desde el historial.
    this.version(2)
      .stores({
        productStats: 'productId',
        pairStats: 'key, a, b',
      })
      .upgrade((tx) => rebuildStatsIn(tx));
    // Fase 3: personas, cuenta corriente y firmas.
    this.version(3).stores({
      parties: 'id, name, active, lastUsedAt',
      ledgerEntries: 'id, partyId, createdAt, [sourceType+sourceId]',
      signatures: 'id, partyId, &operationCode, createdAt, [refType+refId]',
      auditLog: 'id, entity, entityId, action, createdAt',
    });
    // Fase 4: consignación (entregas a vendedores y liquidaciones).
    this.version(4).stores({
      consignments: 'id, partyId, status, dueDate, createdAt',
      consignmentLines: 'id, consignmentId, productId',
      settlements: 'id, partyId, createdAt',
      settlementLines: 'id, settlementId, consignmentLineId, productId',
    });
  }
}

export let db = new BodegaDB();

/** Solo para tests: usa una BD nueva y aislada. */
export function resetDbForTests(name: string): BodegaDB {
  db.close();
  db = new BodegaDB(name);
  return db;
}

/** Reconstruye productStats y pairStats desde los tickets cerrados no anulados. */
export async function rebuildStatsIn(tx: Transaction): Promise<void> {
  const tickets = await tx.table<Ticket>('tickets').where('status').anyOf('paid', 'credit').toArray();
  const lines = await tx.table<TicketLine>('ticketLines').toArray();
  const byTicket = new Map<string, TicketLine[]>();
  for (const l of lines) {
    const list = byTicket.get(l.ticketId);
    if (list) list.push(l);
    else byTicket.set(l.ticketId, [l]);
  }
  const { products, pairs } = replayStats(
    tickets.map((t) => ({
      closedAt: t.closedAt ?? t.createdAt,
      lines: (byTicket.get(t.id) ?? []).map(toStatLine),
    })),
  );
  await tx.table('productStats').clear();
  await tx.table('pairStats').clear();
  await tx.table('productStats').bulkPut([...products.values()]);
  await tx.table('pairStats').bulkPut([...pairs.values()]);
}

export function toStatLine(l: Pick<TicketLine, 'productId' | 'qty' | 'fractional'>) {
  return { productId: l.productId, units: l.fractional ? l.qty / 1000 : l.qty };
}
