import { beforeEach, describe, expect, it } from 'vitest';
import { cashBalance } from '../domain/cash';
import { closeDay, registerCashMovement, registerExpense, registerPurchase, voidManualMovement } from './cash';
import { createProduct, type ProductInput } from './products';
import { db, resetDbForTests } from './schema';
import { checkoutTicket, openTicket, saveOpenTicketLines } from './tickets';

const base: ProductInput = {
  name: 'Arroz',
  baseName: 'Arroz',
  unit: 'saco',
  allowsFraction: false,
  category: '',
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
  resetDbForTests(`cashdb-${++n}`);
});
const balance = async () => cashBalance(await db.cashMovements.toArray());

describe('caja', () => {
  it('saldo inicial, venta, gasto, retiro y aporte', async () => {
    const arroz = await createProduct(base, 10);
    await registerCashMovement('opening', 20000, 'cash', 'sencillo');
    const t = await openTicket();
    await saveOpenTicketLines(t.id, [{ productId: arroz, qty: 1, priceOverride: null, priceOverrideReason: null }]);
    await checkoutTicket(t.id, { method: 'cash', cashReceived: 20000 });
    await registerExpense(1000, 'transporte', 'cash');
    await registerCashMovement('withdrawal', 5000, 'cash', 'almuerzo casa');
    await registerCashMovement('contribution', 3000, 'cash');
    expect(await balance()).toBe(20000 + 18500 - 1000 - 5000 + 3000);
    await expect(registerCashMovement('withdrawal', 999999, 'cash')).rejects.toThrow('no alcanza');
  });

  it('compra: suma stock, actualiza costo y resta de caja', async () => {
    const arroz = await createProduct(base, 5);
    await registerCashMovement('opening', 500000, 'cash');
    await registerPurchase('Molino Norte', [{ productId: arroz, qty: 20, unitCost: 16000 }], 'cash', true);
    expect(await db.products.get(arroz)).toMatchObject({ stock: 25, costPrice: 16000 });
    expect(await balance()).toBe(500000 - 320000);
    await registerPurchase('Otro', [{ productId: arroz, qty: 1, unitCost: 17000 }], 'digital', false);
    expect((await db.products.get(arroz))!.costPrice).toBe(16000);
    expect(await balance()).toBe(180000);
    expect(await db.stockMovements.where('reason').equals('purchase').count()).toBe(2);
  });

  it('cierre del día con faltante: ajusta la caja a lo contado y solo una vez', async () => {
    await registerCashMovement('opening', 10000, 'cash');
    const r = await closeDay(9500, 'faltó un sol');
    expect(r).toEqual({ expected: 10000, difference: -500 });
    expect(await balance()).toBe(9500);
    await expect(closeDay(9500)).rejects.toThrow('Ya cerraste');
  });

  it('anular un retiro con motivo', async () => {
    await registerCashMovement('opening', 10000, 'cash');
    const id = await registerCashMovement('withdrawal', 2000, 'cash');
    await voidManualMovement(id, 'me equivoqué');
    expect(await balance()).toBe(10000);
    expect((await db.cashMovements.get(id))!.voidReason).toBe('me equivoqué');
  });
});
