import Dexie from 'dexie';
import { beforeEach, describe, expect, it } from 'vitest';
import { createProduct, type ProductInput } from './products';
import { BodegaDB, db, resetDbForTests } from './schema';
import { loadAllStats } from './stats';
import { checkoutTicket, openTicket, saveOpenTicketLines, voidTicket } from './tickets';

const base: ProductInput = {
  name: 'Arroz',
  baseName: 'Arroz',
  unit: 'saco',
  allowsFraction: false,
  category: '',
  salePrice: 1000,
  costPrice: 800,
  sellerPrice: null,
  minStock: 0,
  photo: null,
  pinnedPosition: null,
  active: true,
};
const line = (productId: string, qty: number) => ({ productId, qty, priceOverride: null, priceOverrideReason: null });

let n = 0;
beforeEach(() => {
  resetDbForTests(`stats-${++n}`);
});

async function sell(lines: ReturnType<typeof line>[]) {
  const t = await openTicket();
  await saveOpenTicketLines(t.id, lines);
  return checkoutTicket(t.id, { method: 'digital', digitalRef: null });
}

describe('estadísticas en la transacción de venta', () => {
  it('cobrar suma y anular resta', async () => {
    const a = await createProduct(base, 50);
    const b = await createProduct({ ...base, name: 'Aceite' }, 50);
    const kg = await createProduct({ ...base, name: 'Azúcar kg', allowsFraction: true }, 50_000);
    await sell([line(a, 2), line(b, 1), line(kg, 1500)]);
    const t2 = await sell([line(a, 1), line(b, 3)]);

    let s = await loadAllStats();
    expect(s.closedTickets).toBe(2);
    expect(s.products.get(a)!.decayedQty).toBeCloseTo(3, 5);
    expect(s.products.get(kg)!.decayedQty).toBeCloseTo(1.5, 5); // en kg, no en milésimas
    expect(s.pairs.size).toBe(3);
    const ab = [...s.pairs.values()].find((p) => p.key.includes(a) && p.key.includes(b))!;
    expect(ab.decayedCount).toBeCloseTo(2, 5);

    await voidTicket(t2.id, 'error');
    s = await loadAllStats();
    expect(s.closedTickets).toBe(1);
    expect(s.products.get(b)!.decayedQty).toBeCloseTo(1, 5);
    expect([...s.pairs.values()].find((p) => p.key === ab.key)!.decayedCount).toBeCloseTo(1, 5);
  });

  it('la migración a la versión 2 reconstruye las estadísticas desde el historial', async () => {
    const name = `migr-${n}`;
    db.close();
    // Base de datos de la Fase 1 (solo versión 1).
    const v1 = new Dexie(name);
    v1.version(1).stores({
      products: 'id',
      tickets: 'id, status, dayKey, partyId, closedAt, [dayKey+number]',
      ticketLines: 'id, ticketId, productId',
      stockMovements: 'id',
      cashMovements: 'id',
      auditLog: 'id',
      settings: 'id',
    });
    const at = Date.now() - 1000;
    await v1.table('tickets').bulkAdd([
      { id: 't1', status: 'paid', closedAt: at, createdAt: at },
      { id: 't2', status: 'void', closedAt: at, createdAt: at },
    ]);
    await v1.table('ticketLines').bulkAdd([
      { id: 'l1', ticketId: 't1', productId: 'x', qty: 2, fractional: false },
      { id: 'l2', ticketId: 't1', productId: 'y', qty: 1, fractional: false },
      { id: 'l3', ticketId: 't2', productId: 'x', qty: 9, fractional: false },
    ]);
    v1.close();

    const v2 = new BodegaDB(name);
    const px = await v2.productStats.get('x');
    expect(px!.decayedQty).toBeCloseTo(2, 5);
    expect(await v2.pairStats.get('x|y')).toMatchObject({ decayedCount: 1 });
    v2.close();
  });
});
