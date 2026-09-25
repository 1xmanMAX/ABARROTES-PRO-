import { beforeEach, describe, expect, it } from 'vitest';
import { db, resetDbForTests } from './schema';
import { seedDemo } from './seed';
import { loadAllStats } from './stats';

beforeEach(() => {
  resetDbForTests(`seed-${Math.random()}`);
});

describe('datos de ejemplo', () => {
  it('300 tickets en 30 días, stock final sin cambios y pares frecuentes', async () => {
    expect(await seedDemo()).toBe(10);
    expect(await db.tickets.count()).toBe(300);
    const arroz = (await db.products.toArray()).find((p) => p.baseName === 'Arroz')!;
    expect(arroz.stock).toBe(40);
    const moves = await db.stockMovements.where('productId').equals(arroz.id).toArray();
    expect(moves.reduce((a, m) => a + m.delta, 0)).toBe(40);

    const { pairs, closedTickets } = await loadAllStats();
    expect(closedTickets).toBe(300);
    const names = new Map((await db.products.toArray()).map((p) => [p.id, p.baseName]));
    const top3 = [...pairs.values()]
      .sort((x, y) => y.decayedCount - x.decayedCount)
      .slice(0, 3)
      .map((p) => [names.get(p.a), names.get(p.b)].sort().join('+'))
      .sort();
    expect(top3).toEqual(['Aceite+Arroz', 'Arroz+Avena', 'Azúcar+Harina']);
    // Ningún ticket de ejemplo cae hoy.
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(new Date());
    expect(await db.tickets.where('dayKey').equals(today).count()).toBe(0);
    // Segunda carga no duplica
    expect(await seedDemo()).toBe(0);
  });
});
