import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createProduct } from '../../db/products';
import { db, resetDbForTests } from '../../db/schema';
import { loadOpenTickets } from '../../db/tickets';
import { flushAllTickets, useSell } from './sellStore';

let n = 0;
beforeEach(async () => {
  resetDbForTests(`store-${++n}`);
  useSell.setState({ loaded: false, tickets: [], activeId: null });
});

// Que ningún guardado en segundo plano siga corriendo cuando el siguiente test cambie de BD.
afterEach(() => flushAllTickets());

const product = () =>
  createProduct(
    {
      name: 'Arroz saco 50kg',
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
    },
    20,
  );

describe('sellStore', () => {
  it('cobra justo después de tocar (espera el guardado en segundo plano)', async () => {
    const id = await product();
    await useSell.getState().init();
    const s = useSell.getState();
    s.tap(id, 1, 20);
    s.pressMultiplier(5);
    s.tap(id, 1, 20);
    const closed = await useSell.getState().checkout({ method: 'cash', cashReceived: 111000 });
    expect(closed.total).toBe(6 * 18500);
    expect((await db.products.get(id))!.stock).toBe(14);
    // Queda un ticket nuevo vacío activo
    const st = useSell.getState();
    expect(st.tickets).toHaveLength(1);
    expect(st.tickets[0]!.lines).toEqual([]);
    expect(st.multiplier).toEqual({ value: 1, locked: false });
  });

  it('el toque no pasa del disponible', async () => {
    const id = await product();
    await useSell.getState().init();
    useSell.getState().pressMultiplier(10);
    useSell.getState().pressMultiplier(10); // candado
    expect(useSell.getState().tap(id, 1, 15)).toBe(10);
    expect(useSell.getState().tap(id, 1, 5)).toBe(5);
    expect(useSell.getState().tap(id, 1, 0)).toBe(0);
  });

  it('al cobrar, el siguiente ticket en espera queda activo y los borradores persisten', async () => {
    const id = await product();
    await useSell.getState().init();
    const first = useSell.getState().activeId!;
    useSell.getState().tap(id, 1, 20);
    await useSell.getState().newTicket();
    const second = useSell.getState().activeId!;
    useSell.getState().tap(id, 1, 19);
    useSell.getState().tap(id, 1, 18);
    useSell.getState().setActive(first);
    await useSell.getState().checkout({ method: 'digital', digitalRef: null });
    expect(useSell.getState().activeId).toBe(second);

    await flushAllTickets();
    const open = await loadOpenTickets();
    expect(open).toHaveLength(1);
    expect(open[0]!.lines[0]!.qty).toBe(2);
  });
});
