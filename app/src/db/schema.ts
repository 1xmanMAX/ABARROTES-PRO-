import Dexie, { type EntityTable } from 'dexie';
import type { AuditEntry, CashMovement, Product, Settings, StockMovement, Ticket, TicketLine } from './types';

export class BodegaDB extends Dexie {
  products!: EntityTable<Product, 'id'>;
  tickets!: EntityTable<Ticket, 'id'>;
  ticketLines!: EntityTable<TicketLine, 'id'>;
  stockMovements!: EntityTable<StockMovement, 'id'>;
  cashMovements!: EntityTable<CashMovement, 'id'>;
  auditLog!: EntityTable<AuditEntry, 'id'>;
  settings!: EntityTable<Settings, 'id'>;

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
  }
}

export let db = new BodegaDB();

/** Solo para tests: usa una BD nueva y aislada. */
export function resetDbForTests(name: string): BodegaDB {
  db.close();
  db = new BodegaDB(name);
  return db;
}
