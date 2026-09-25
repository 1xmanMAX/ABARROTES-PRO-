import { expect, test } from '@playwright/test';
import { freshWithDemo, gridNames, gridPositions, tile } from './helpers';

const chips = (page: import('@playwright/test').Page) => page.getByTestId('suggestions').getByRole('button');

test('la cuadrícula se ordena por lo más vendido y la fila sugiere lo que va junto', async ({ page }) => {
  await freshWithDemo(page);
  // El arroz es lo más vendido en el historial de ejemplo.
  expect((await gridNames(page))[0]).toBe('Arroz saco 50kg');
  const before = await gridPositions(page);

  await tile(page, 'Arroz saco 50kg').click();
  // Con arroz en el ticket: aceite y avena (pares frecuentes), nunca arroz.
  await expect(chips(page)).toHaveCount(3);
  const labels = await chips(page).allTextContents();
  expect(labels.join()).toContain('Aceite');
  expect(labels.join()).toContain('Avena');
  expect(labels.join()).not.toContain('Arroz');

  // Tocar una sugerencia es igual que tocar el tile.
  await page.getByRole('button', { name: 'Agregar Aceite caja ×12' }).click();
  await expect(page.getByTestId('ticket-total')).toHaveText('S/ 293.00');
  await expect(tile(page, 'Aceite caja ×12')).toContainText('1');
  await expect(chips(page).filter({ hasText: 'Aceite' })).toHaveCount(0);

  // Otro producto inusual también recalcula; el orden de la cuadrícula no cambia.
  await tile(page, 'Harina saco 50kg').click();
  await expect(chips(page).filter({ hasText: 'Azúcar' })).toHaveCount(1);
  expect(await gridPositions(page)).toEqual(before);
});
