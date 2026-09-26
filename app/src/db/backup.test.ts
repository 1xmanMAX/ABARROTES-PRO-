import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createBackup, inspectBackup, restoreBackup, revive, serialize } from './backup';
import { setOwnerPin, setPinIterationsForTests } from './pins';
import { createProduct, type ProductInput } from './products';
import { db, resetDbForTests } from './schema';
import { seedDemo } from './seed';

beforeAll(() => setPinIterationsForTests(1000));
let n = 0;
beforeEach(async () => {
  resetDbForTests(`backup-${++n}`);
  await setOwnerPin('9753');
});

describe('copia de seguridad', () => {
  it('las fotos (Blob) pasan a base64 y vuelven igual', async () => {
    const photo = new Blob([new Uint8Array([1, 2, 3, 250])], { type: 'image/jpeg' });
    const json = JSON.parse(JSON.stringify(await serialize([{ id: 'p', photo, n: 1 }])));
    const [row] = revive(json) as [{ photo: Blob; n: number }];
    expect(row.photo).toBeInstanceOf(Blob);
    expect(row.photo.type).toBe('image/jpeg');
    expect([...new Uint8Array(await row.photo.arrayBuffer())]).toEqual([1, 2, 3, 250]);
    expect(row.n).toBe(1);
  });

  it('exporta cifrado y restaura todo', async () => {
    await seedDemo();
    const extra = await createProduct(
      {
        name: 'Otro',
        baseName: 'Otro',
        unit: 'unidad',
        allowsFraction: false,
        category: '',
        salePrice: 100,
        costPrice: 50,
        sellerPrice: null,
        minStock: 0,
        photo: null,
        pinnedPosition: null,
        active: true,
      } satisfies ProductInput,
      7,
    );
    const before = {
      products: await db.products.count(),
      tickets: await db.tickets.count(),
      lines: await db.ticketLines.count(),
    };

    await expect(createBackup('0000')).rejects.toThrow('incorrecto');
    const { fileName, text } = await createBackup('9753', Date.now(), 1000);
    expect(fileName).toMatch(/^mi-bodega-respaldo-\d{4}-\d{2}-\d{2}\.json$/);
    expect(text).not.toContain('Arroz');
    expect(inspectBackup(text).summary.sales).toBe(300);
    expect((await db.settings.get('main'))!.lastBackupAt).not.toBeNull();

    // Se pierden los datos (teléfono nuevo con otro código de dueño).
    resetDbForTests(`backup-new-${n}`);
    await setOwnerPin('1357');
    await expect(restoreBackup(text, '9753')).rejects.toThrow('código de dueño actual');
    await expect(restoreBackup(text, '0000', '1357')).rejects.toThrow('Código incorrecto');
    await restoreBackup(text, '9753', '1357');

    expect(await db.products.count()).toBe(before.products);
    expect(await db.tickets.count()).toBe(before.tickets);
    expect(await db.ticketLines.count()).toBe(before.lines);
    expect((await db.products.get(extra))!.stock).toBe(7);
    expect(await db.productStats.count()).toBeGreaterThan(0);
    // El código de dueño vuelve a ser el del respaldo.
    await expect(createBackup('1357')).rejects.toThrow('incorrecto');
    await createBackup('9753', Date.now(), 1000);
  });
});
