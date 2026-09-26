import { expect, test } from '@playwright/test';
import { freshWithDemo, tapProduct, tile } from './helpers';

test('rebaja por regateo de S/ 1 a S/ 5 y lista clara al cobrar', async ({ page }) => {
  await freshWithDemo(page);
  await tile(page, 'Arroz saco 50kg').click();
  await tile(page, 'Arroz saco 50kg').click();
  await tapProduct(page, 'Sal bolsa ×50');
  await page.getByRole('button', { name: 'Cobrar', exact: true }).click();

  // La lista muestra cantidades y productos.
  const list = page.getByRole('list', { name: 'Lo que lleva el cliente' });
  await expect(list.getByRole('listitem')).toHaveCount(2);
  await expect(list).toContainText('Arroz saco 50kg');
  await expect(page.getByTestId('checkout-total')).toHaveText('S/ 405.00');

  // Solo hasta S/ 5.
  await expect(page.getByRole('button', { name: /^Rebaja S\/ / })).toHaveCount(5);
  await page.getByRole('button', { name: 'Rebaja S/ 5.00' }).click();
  await expect(page.getByTestId('checkout-total')).toHaveText('S/ 400.00');
  await page.getByRole('button', { name: 'Cobrar sin ticket' }).click();
  await expect(page.getByRole('status')).toContainText('Venta S/ 400.00 registrada');

  // Sin productos que admitan rebaja no aparece la fila.
  await tapProduct(page, 'Sal bolsa ×50');
  await page.getByRole('button', { name: 'Cobrar', exact: true }).click();
  await expect(page.getByRole('button', { name: /^Rebaja S\/ / })).toHaveCount(0);
});

test('precio bajo costo pide confirmar', async ({ page }) => {
  await freshWithDemo(page);
  const arroz = tile(page, 'Arroz saco 50kg');
  const box = (await arroz.boundingBox())!;
  await page.mouse.move(box.x + 30, box.y + 30);
  await page.mouse.down();
  await page.waitForTimeout(650);
  await page.mouse.up();
  const dialog = page.getByRole('dialog');
  for (const k of ['1']) await dialog.getByRole('button', { name: k, exact: true }).click();
  await dialog.getByRole('button', { name: 'Precio', exact: true }).click();
  for (let i = 0; i < 6; i++) await dialog.getByRole('button', { name: 'Borrar' }).click();
  for (const k of ['1', '5', '0']) await dialog.getByRole('button', { name: k, exact: true }).click();
  await expect(dialog).toContainText('por debajo del costo');
  await dialog.getByRole('button', { name: /^Aceptar/ }).click();
  await expect(dialog).toBeVisible(); // primer toque solo avisa
  await dialog.getByRole('button', { name: /^Aceptar/ }).click();
  await expect(page.getByTestId('ticket-total')).toHaveText('S/ 150.00');
});
