import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { loadSales } from './reports';
import { deliverConsignment, getOpenConsignments, settleConsignments } from './consignments';
import { createParty } from './parties';
import { setOwnerPin, setPartyPin, setPinIterationsForTests } from './pins';
import { createProduct, type ProductInput } from './products';
import { db, resetDbForTests } from './schema';
import { voidTicket } from './tickets';

const base: ProductInput = {
  name: 'Arroz saco 50kg',
  baseName: 'Arroz',
  unit: 'saco',
  allowsFraction: false,
  category: '',
  salePrice: 18500,
  costPrice: 16500,
  sellerPrice: 17500,
  minStock: 0,
  photo: null,
  pinnedPosition: null,
  active: true,
};

beforeAll(() => setPinIterationsForTests(1000));
let n = 0;
let arroz = '';
let aceite = '';
let juan = '';
beforeEach(async () => {
  resetDbForTests(`consign-${++n}`);
  await setOwnerPin('9753');
  arroz = await createProduct(base, 20);
  aceite = await createProduct({ ...base, name: 'Aceite caja ×12', salePrice: 10800, costPrice: 9600, sellerPrice: null }, 10);
  juan = await createParty({ name: 'Juan Quispe', phone: '', roles: ['seller'], creditLimit: 80000, birthYear: null });
  await setPartyPin(juan, '2580');
});

async function deliver() {
  return deliverConsignment(
    juan,
    [
      { productId: arroz, qty: 10, agreedPrice: 17500 },
      { productId: aceite, qty: 6, agreedPrice: 10000 },
    ],
    Date.now() + 3 * 86_400_000,
    '2580',
  );
}

describe('entregar a vendedor', () => {
  it('saca el stock como consignación, firma RECIBIDO, sin deuda y recuerda el precio', async () => {
    const sig = await deliver();
    expect(sig).toMatchObject({ purpose: 'consignment_receipt', amount: 235000, previousBalance: 0, newBalance: 0 });
    expect(await db.products.get(arroz)).toMatchObject({ stock: 10, consignedQty: 10 });
    expect((await db.parties.get(juan))!.balance).toBe(0);
    expect((await db.parties.get(juan))!.specialPrices[aceite]).toBe(10000);
    const moves = await db.stockMovements.where('reason').equals('consign_out').toArray();
    expect(moves.map((m) => m.delta).sort()).toEqual([-10, -6]);
    expect(await getOpenConsignments(juan)).toHaveLength(1);
  });

  it('sin código correcto o sin stock no se entrega nada', async () => {
    await expect(
      deliverConsignment(juan, [{ productId: arroz, qty: 1, agreedPrice: 17500 }], Date.now(), '1111'),
    ).rejects.toThrow('incorrecto');
    await expect(
      deliverConsignment(juan, [{ productId: arroz, qty: 99, agreedPrice: 17500 }], Date.now(), '2580'),
    ).rejects.toThrow('stock');
    expect((await db.products.get(arroz))!.stock).toBe(20);
    expect(await db.consignments.count()).toBe(0);
  });
});

describe('liquidar', () => {
  it('devuelto al stock, vendido como venta con ganancia, cargo, pago parcial y caja', async () => {
    await deliver();
    const [open] = await getOpenConsignments(juan);
    const arrozLine = open!.lines.find((l) => l.productId === arroz)!;
    // Devuelve 2 sacos: vendió 8 arroz (8×175 = 1400) + 6 aceite (6×100 = 600) = S/ 2,000.
    const sig = await settleConsignments(juan, [open!.consignment.id], { [arrozLine.id]: 2 }, 150000, 'cash', '2580');
    expect(sig).toMatchObject({ purpose: 'settlement', amount: 150000, previousBalance: 200000, newBalance: 50000 });

    expect(await db.products.get(arroz)).toMatchObject({ stock: 12, consignedQty: 0 });
    expect(await db.products.get(aceite)).toMatchObject({ stock: 4, consignedQty: 0 });
    expect((await db.parties.get(juan))!.balance).toBe(50000);
    expect((await db.consignments.get(open!.consignment.id))!.status).toBe('settled');
    const cash = await db.cashMovements.toArray();
    expect(cash).toEqual([expect.objectContaining({ type: 'settlement_payment', amount: 150000, method: 'cash' })]);

    // La venta cuenta en ganancias: 8×(175−165) + 6×(100−96) = 80 + 24 = S/ 104.
    const sales = await loadSales(null);
    expect(sales).toHaveLength(1);
    expect(sales[0]!.lines.reduce((a, l) => a + l.lineProfit, 0)).toBe(10400);

    // No se puede anular desde Historial.
    const ticket = (await db.tickets.toArray())[0]!;
    await expect(voidTicket(ticket.id, 'x')).rejects.toThrow('liquidación');
  });

  it('no deja devolver más de lo entregado ni pagar más del total', async () => {
    await deliver();
    const [open] = await getOpenConsignments(juan);
    const line = open!.lines[0]!;
    await expect(settleConsignments(juan, [open!.consignment.id], { [line.id]: 99 }, 0, 'cash', '2580')).rejects.toThrow(
      'superar',
    );
    await expect(settleConsignments(juan, [open!.consignment.id], {}, 999999, 'cash', '2580')).rejects.toThrow(
      'No puede pagar más',
    );
    expect((await db.parties.get(juan))!.balance).toBe(0);
  });

  it('liquidar sin pagar deja todo como deuda', async () => {
    await deliver();
    const [open] = await getOpenConsignments(juan);
    const sig = await settleConsignments(juan, [open!.consignment.id], {}, 0, 'cash', '2580');
    expect(sig.newBalance).toBe(235000);
    expect(await db.cashMovements.count()).toBe(0);
  });
});
