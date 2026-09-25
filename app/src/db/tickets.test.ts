import { beforeEach, describe, expect, it } from 'vitest';
import { adjustStock, createProduct, type ProductInput } from './products';
import { db, resetDbForTests } from './schema';
import { checkoutTicket, loadOpenTickets, MAX_OPEN_TICKETS, openTicket, saveOpenTicketLines, voidTicket } from './tickets';

const base: ProductInput = {
  name: 'Arroz saco 50kg',
  baseName: 'Arroz',
  unit: 'saco',
  allowsFraction: false,
  category: 'Granos',
  salePrice: 18500,
  costPrice: 16500,
  sellerPrice: null,
  minStock: 0,
  photo: null,
  pinnedPosition: null,
  active: true,
};

let n = 0;
beforeEach(() => {
  resetDbForTests(`test-${++n}`);
});

const line = (productId: string, qty: number, priceOverride: number | null = null) => ({
  productId,
  qty,
  priceOverride,
  priceOverrideReason: priceOverride ? 'descuento' : null,
});

describe('tickets', () => {
  it('cobra en efectivo: stock, caja, snapshots y correlativo', async () => {
    const arroz = await createProduct(base, 10);
    const aceite = await createProduct({ ...base, name: 'Aceite caja ×12', salePrice: 10800, costPrice: 9600 }, 5);
    const t = await openTicket();
    await saveOpenTicketLines(t.id, [line(arroz, 2), line(aceite, 1)]);

    const closed = await checkoutTicket(t.id, { method: 'cash', cashReceived: 50000 });
    expect(closed.status).toBe('paid');
    expect(closed.total).toBe(47800);
    expect(closed.change).toBe(2200);
    expect(closed.number).toBe(1);

    expect((await db.products.get(arroz))!.stock).toBe(8);
    expect((await db.products.get(aceite))!.stock).toBe(4);
    const lines = await db.ticketLines.where('ticketId').equals(t.id).toArray();
    const arrozLine = lines.find((l) => l.productId === arroz)!;
    expect(arrozLine).toMatchObject({
      productName: 'Arroz saco 50kg',
      unitPrice: 18500,
      unitCost: 16500,
      lineTotal: 37000,
      lineProfit: 4000,
    });
    const cash = await db.cashMovements.toArray();
    expect(cash).toHaveLength(1);
    expect(cash[0]).toMatchObject({ type: 'sale', method: 'cash', amount: 47800 });

    const t2 = await openTicket();
    await saveOpenTicketLines(t2.id, [line(arroz, 1, 18000)]);
    const closed2 = await checkoutTicket(t2.id, { method: 'digital', digitalRef: '123456' });
    expect(closed2.number).toBe(2);
    expect(closed2.total).toBe(18000);
    expect(closed2.discount).toBe(500);
    expect(closed2.digitalRef).toBe('456');
  });

  it('no deja cobrar con efectivo insuficiente ni sin stock, y no escribe nada', async () => {
    const arroz = await createProduct(base, 1);
    const t = await openTicket();
    await saveOpenTicketLines(t.id, [line(arroz, 1)]);
    await expect(checkoutTicket(t.id, { method: 'cash', cashReceived: 100 })).rejects.toThrow('no alcanza');

    await saveOpenTicketLines(t.id, [line(arroz, 2)]);
    await expect(checkoutTicket(t.id, { method: 'cash', cashReceived: 100000 })).rejects.toThrow('stock');
    expect((await db.products.get(arroz))!.stock).toBe(1);
    expect(await db.cashMovements.count()).toBe(0);
    expect((await db.tickets.get(t.id))!.status).toBe('open');
  });

  it('no cobra dos veces el mismo ticket', async () => {
    const arroz = await createProduct(base, 5);
    const t = await openTicket();
    await saveOpenTicketLines(t.id, [line(arroz, 1)]);
    await checkoutTicket(t.id, { method: 'cash', cashReceived: 18500 });
    await expect(checkoutTicket(t.id, { method: 'cash', cashReceived: 18500 })).rejects.toThrow('ya fue cobrado');
    expect((await db.products.get(arroz))!.stock).toBe(4);
  });

  it('anular repone stock, marca la caja y deja rastro', async () => {
    const arroz = await createProduct(base, 5);
    const t = await openTicket();
    await saveOpenTicketLines(t.id, [line(arroz, 3)]);
    await checkoutTicket(t.id, { method: 'cash', cashReceived: 55500 });
    await voidTicket(t.id, 'Deshacer');

    expect((await db.products.get(arroz))!.stock).toBe(5);
    expect((await db.tickets.get(t.id))!).toMatchObject({ status: 'void', voidReason: 'Deshacer' });
    const cash = await db.cashMovements.toArray();
    expect(cash[0]!.voidedAt).not.toBeNull();
    expect(await db.auditLog.where('entityId').equals(t.id).count()).toBe(1);
    // nada se borra
    expect(await db.ticketLines.where('ticketId').equals(t.id).count()).toBe(1);
  });

  it('no anula tickets de otros días sin código de dueño', async () => {
    const arroz = await createProduct(base, 5);
    const t = await openTicket();
    await saveOpenTicketLines(t.id, [line(arroz, 1)]);
    const yesterday = Date.now() - 86_400_000 * 2;
    await checkoutTicket(t.id, { method: 'cash', cashReceived: 18500 }, yesterday);
    await expect(voidTicket(t.id, 'error')).rejects.toThrow('código de dueño');
  });

  it('los tickets abiertos persisten y se limitan a 6', async () => {
    const arroz = await createProduct(base, 5);
    const t = await openTicket();
    await saveOpenTicketLines(t.id, [line(arroz, 2, 18000)]);
    for (let i = 1; i < MAX_OPEN_TICKETS; i++) await openTicket();
    await expect(openTicket()).rejects.toThrow('Máximo');

    const open = await loadOpenTickets();
    expect(open).toHaveLength(MAX_OPEN_TICKETS);
    expect(open[0]!.ticket.label).toBe('Cliente 1');
    expect(open[5]!.ticket.label).toBe('Cliente 6');
    expect(open[0]!.lines).toEqual([line(arroz, 2, 18000)]);
  });

  it('ajuste de stock queda como movimiento y no permite negativo', async () => {
    const arroz = await createProduct(base, 5);
    await adjustStock(arroz, -2, 'merma', 'saco roto');
    expect((await db.products.get(arroz))!.stock).toBe(3);
    await expect(adjustStock(arroz, -4, 'merma')).rejects.toThrow('negativo');
    const moves = await db.stockMovements.where('productId').equals(arroz).toArray();
    expect(moves.map((m) => m.delta).sort()).toEqual([-2, 5]);
  });
});
