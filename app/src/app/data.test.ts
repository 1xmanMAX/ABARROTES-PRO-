import { beforeEach, describe, expect, it } from 'vitest';
import { createProduct, type ProductInput } from '../db/products';
import { resetDbForTests } from '../db/schema';
import { getSettings, updateSettings } from '../db/settings';
import { checkoutTicket, openTicket, saveOpenTicketLines } from '../db/tickets';
import { recomputeGridOrder, recomputeIfNewDay, useGridOrder } from './data';

const base: ProductInput = {
  name: 'A',
  baseName: 'A',
  unit: 'saco',
  allowsFraction: false,
  category: '',
  salePrice: 100,
  costPrice: 50,
  sellerPrice: null,
  minStock: 0,
  photo: null,
  pinnedPosition: null,
  active: true,
};

let n = 0;
beforeEach(() => {
  resetDbForTests(`data-${++n}`);
});

describe('orden de la cuadrícula', () => {
  it('ordena por lo vendido, respeta fijados y solo reordena en día nuevo sin tickets ocupados', async () => {
    const a = await createProduct({ ...base, name: 'Aceite' }, 50);
    const b = await createProduct({ ...base, name: 'Brócoli' }, 50);
    const c = await createProduct({ ...base, name: 'Café', pinnedPosition: 1 }, 50);
    await recomputeGridOrder();
    expect(useGridOrder.getState().order).toEqual([c, a, b]);

    const t = await openTicket();
    await saveOpenTicketLines(t.id, [{ productId: b, qty: 5, priceOverride: null, priceOverrideReason: null }]);
    await checkoutTicket(t.id, { method: 'digital', digitalRef: null });

    // Mismo día: no cambia.
    expect(await recomputeIfNewDay(false)).toBe(false);
    expect(useGridOrder.getState().order).toEqual([c, a, b]);

    await updateSettings({ gridOrderComputedAt: Date.now() - 2 * 86_400_000 });
    // Día nuevo pero con un ticket con productos: espera.
    expect(await recomputeIfNewDay(true)).toBe(false);
    // Día nuevo y tickets vacíos: reordena.
    expect(await recomputeIfNewDay(false)).toBe(true);
    expect(useGridOrder.getState().order).toEqual([c, b, a]);
    expect((await getSettings()).gridOrder).toEqual([c, b, a]);
  });
});
