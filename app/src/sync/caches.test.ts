import { beforeAll, beforeEach, expect, it } from 'vitest';
import { registerPurchase } from '../db/cash';
import { deliverConsignment, getOpenConsignments, settleConsignments } from '../db/consignments';
import { createParty, receiveDebtPayment } from '../db/parties';
import { setOwnerPin, setPartyPin, setPinIterationsForTests } from '../db/pins';
import { adjustStock, createProduct, type ProductInput } from '../db/products';
import { db, resetDbForTests } from '../db/schema';
import { checkoutOnCredit, checkoutTicket, openTicket, saveOpenTicketLines, voidTicket } from '../db/tickets';
import { recomputeCaches } from './caches';

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
beforeEach(() => {
  resetDbForTests(`caches-${++n}`);
});

async function sell(lines: { productId: string; qty: number }[]) {
  const t = await openTicket();
  await saveOpenTicketLines(t.id, lines.map((l) => ({ ...l, priceOverride: null, priceOverrideReason: null })));
  return t.id;
}

async function recomputed() {
  return recomputeCaches(
    {
      stockMovements: await db.stockMovements.toArray(),
      ledgerEntries: await db.ledgerEntries.toArray(),
      consignments: await db.consignments.toArray(),
      consignmentLines: await db.consignmentLines.toArray(),
      settlementLines: await db.settlementLines.toArray(),
    },
    await db.products.toArray(),
    await db.parties.toArray(),
  );
}

it('recalcular desde los registros da lo mismo que guarda la app, tras todo tipo de operaciones', async () => {
  await setOwnerPin('9753');
  const arroz = await createProduct(base, 40);
  const aceite = await createProduct({ ...base, name: 'Aceite caja ×12', salePrice: 10800, costPrice: 9600 }, 20);
  const vacio = await createProduct({ ...base, name: 'Sal' }, 0);
  const rosa = await createParty({ name: 'Rosa', phone: '', roles: ['client'], creditLimit: 500000, birthYear: null });
  const juan = await createParty({ name: 'Juan', phone: '', roles: ['client', 'seller'], creditLimit: 500000, birthYear: null });
  await setPartyPin(rosa, '2580');
  await setPartyPin(juan, '1470');

  await checkoutTicket(await sell([{ productId: arroz, qty: 3 }]), { method: 'cash', cashReceived: 55500 });
  const anulada = await checkoutTicket(await sell([{ productId: aceite, qty: 2 }]), { method: 'digital', digitalRef: '123' });
  await voidTicket(anulada.id, 'error');
  await checkoutOnCredit(await sell([{ productId: arroz, qty: 2 }, { productId: aceite, qty: 1 }]), rosa, '2580');
  const fiadoAnulado = await checkoutOnCredit(await sell([{ productId: aceite, qty: 1 }]), rosa, '2580');
  await voidTicket(fiadoAnulado.ticket.id, 'se arrepintió');
  await receiveDebtPayment(rosa, 10000, 'cash', '2580');
  await registerPurchase('Distribuidora', [{ productId: arroz, qty: 10, unitCost: 16000 }], 'cash');
  await adjustStock(aceite, -1, 'merma');
  await adjustStock(vacio, 5, 'conteo');
  await deliverConsignment(juan, [{ productId: arroz, qty: 8, agreedPrice: 17500 }, { productId: aceite, qty: 4, agreedPrice: 10000 }], Date.now() + 86_400_000, '1470');
  const [entrega] = await getOpenConsignments(juan);
  const [lArroz, lAceite] = entrega!.lines;
  await settleConsignments(juan, [entrega!.consignment.id], { [lArroz!.id]: 3, [lAceite!.id]: 0 }, 20000, 'cash', '1470');
  await deliverConsignment(juan, [{ productId: arroz, qty: 2, agreedPrice: 17500 }], Date.now() + 86_400_000, '1470');

  // La app dejó cachés consistentes: el recálculo no cambia nada.
  const r = await recomputed();
  expect(r).toEqual({ products: [], parties: [], consignmentLines: [] });
  // Y los valores son los esperados (no es que ambos lados estén mal igual).
  expect((await db.products.get(arroz))!.stock).toBe(40 - 3 - 2 + 10 - 8 + 3 - 2);
  expect((await db.products.get(arroz))!.consignedQty).toBe(2);
  expect((await db.parties.get(rosa))!.balance).toBe(18500 * 2 + 10800 - 10000);
});

it('corrige los cachés que no cuadran con los registros', async () => {
  const arroz = await createProduct(base, 10);
  await db.products.update(arroz, { stock: 99 });
  const r = await recomputed();
  expect(r.products).toHaveLength(1);
  expect(r.products[0]).toMatchObject({ id: arroz, stock: 10, consignedQty: 0 });
});
