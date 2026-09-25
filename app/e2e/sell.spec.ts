import { expect, test } from '@playwright/test';
import { freshWithDemo, gridNames, gridPositions, tapProduct, tile } from './helpers';

test('venta de 3 productos en efectivo exacto en 5 toques, sin cambiar el orden', async ({ page }) => {
  await freshWithDemo(page);
  const before = await gridPositions(page);
  expect(before.length).toBeGreaterThanOrEqual(8);
  const names = await gridNames(page);
  expect(names).toEqual(expect.arrayContaining(['Arroz saco 50kg', 'Aceite caja ×12', 'Azúcar saco 50kg']));

  await tile(page, 'Arroz saco 50kg').click(); // 1
  await tile(page, 'Aceite caja ×12').click(); // 2
  await tile(page, 'Azúcar saco 50kg').click(); // 3
  await expect(page.getByTestId('ticket-total')).toHaveText('S/ 453.00');
  await tile(page, 'Arroz saco 50kg').click();
  await tile(page, 'Arroz saco 50kg').click();
  expect(await gridPositions(page)).toEqual(before);
  await page.getByRole('button', { name: 'Deshacer' }).click();
  await page.getByRole('button', { name: 'Deshacer' }).click();
  await expect(page.getByTestId('ticket-total')).toHaveText('S/ 453.00');

  await page.getByRole('button', { name: 'Cobrar', exact: true }).click(); // 4
  await expect(page.getByTestId('checkout-total')).toHaveText('S/ 453.00');
  await page.getByRole('button', { name: 'Cobrar sin ticket' }).click(); // 5

  await expect(page.getByRole('status')).toContainText('Venta S/ 453.00 registrada');
  await expect(page.getByTestId('ticket-total')).toHaveText('S/ 0.00');
  expect(await gridPositions(page)).toEqual(before);
});

test('vuelto y "Falta" en efectivo', async ({ page }) => {
  await freshWithDemo(page);
  await tile(page, 'Arroz saco 50kg').click();
  await tile(page, 'Aceite caja ×12').click();
  await tile(page, 'Arroz saco 50kg').click();
  await page.getByRole('button', { name: 'Cobrar', exact: true }).click();
  await expect(page.getByTestId('checkout-total')).toHaveText('S/ 478.00');
  await page.getByRole('button', { name: 'S/ 500' }).click();
  await expect(page.getByTestId('change')).toHaveText('S/ 22.00');

  await page.getByRole('button', { name: 'Otro monto' }).click();
  for (const k of ['4', '0', '0']) await page.getByRole('button', { name: k, exact: true }).click();
  await expect(page.getByRole('dialog').getByText('Falta S/ 78.00')).toBeVisible();
  await page.getByRole('button', { name: 'Aceptar' }).click();
  await expect(page.getByText('Falta S/ 78.00')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cobrar sin ticket' })).toBeDisabled();
});

test('multiplicador, deshacer y límite de stock entre tickets', async ({ page }) => {
  await freshWithDemo(page);
  // Atún: stock 15
  await page.getByRole('button', { name: '×10', exact: true }).click();
  await tapProduct(page, 'Atún caja ×48');
  await expect(page.getByTestId('ticket-total')).toHaveText('S/ 2,400.00');
  // El ×10 ya volvió a ×1
  await tapProduct(page, 'Atún caja ×48');
  await expect(page.getByTestId('ticket-total')).toHaveText('S/ 2,640.00');
  await page.getByRole('button', { name: 'Deshacer' }).click();
  await expect(page.getByTestId('ticket-total')).toHaveText('S/ 2,400.00');

  // Segundo cliente: solo quedan 5 disponibles
  await page.getByRole('button', { name: 'Nuevo cliente en espera' }).click();
  await page.getByRole('button', { name: '×10', exact: true }).click();
  await tapProduct(page, 'Atún caja ×48');
  await expect(page.getByRole('status')).toContainText('Solo quedan 5');
  await expect(page.getByTestId('ticket-total')).toHaveText('S/ 1,200.00');
  await page.getByRole('button', { name: 'Buscar otro producto' }).click();
  await expect(page.getByRole('dialog').getByRole('button', { name: /^Atún caja/ })).toBeDisabled();
});

test('los tickets en espera sobreviven a una recarga', async ({ page }) => {
  await freshWithDemo(page);
  await tile(page, 'Arroz saco 50kg').click();
  await page.getByRole('button', { name: 'Nuevo cliente en espera' }).click();
  await tapProduct(page, 'Sal bolsa ×50');
  await tapProduct(page, 'Sal bolsa ×50');
  await expect(page.getByTestId('ticket-total')).toHaveText('S/ 70.00');
  // Dar tiempo al guardado en segundo plano.
  await page.waitForTimeout(300);
  await page.reload();
  await expect(page.getByRole('button', { name: /Cliente 1 · S\/ 185.00/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Cliente 2 · S\/ 70.00/ })).toBeVisible();
});

test('funciona sin internet después de la primera carga', async ({ page, context }) => {
  await freshWithDemo(page);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload(); // la página queda controlada por el service worker
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await context.setOffline(true);
  await page.reload();
  await tile(page, 'Arroz saco 50kg').click();
  await expect(page.getByTestId('ticket-total')).toHaveText('S/ 185.00');
  await context.setOffline(false);
});
