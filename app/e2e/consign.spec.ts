import { expect, test } from '@playwright/test';
import { DEMO_PIN, freshWithDemo, typePin } from './helpers';

test('entregar mercadería a un vendedor con firma y liquidar con devolución y pago parcial', async ({ page }) => {
  await freshWithDemo(page);
  await page.getByRole('button', { name: 'Menú' }).click();
  await page.getByRole('button', { name: 'Clientes y vendedores' }).click();
  await page.getByRole('button', { name: /^Juan Quispe/ }).click();
  await page.getByRole('button', { name: 'Entregar mercadería' }).click();

  // 10 sacos de arroz (tocando la cantidad) + 2 cajas de aceite (con +).
  await page.getByRole('button', { name: 'Cantidad de Arroz saco 50kg' }).click();
  for (const d of '10') await page.getByRole('dialog').getByRole('button', { name: d, exact: true }).click();
  await page.getByRole('button', { name: 'Aceptar' }).click();
  await page.getByRole('button', { name: 'Agregar 1 Aceite caja ×12' }).click();
  await page.getByRole('button', { name: 'Agregar 1 Aceite caja ×12' }).click();
  await expect(page.getByTestId('deliver-total')).toHaveText('S/ 2,066.00');
  await page.getByRole('button', { name: 'Firmar recepción' }).click();
  await expect(page.getByText('Juan recibe mercadería por S/ 2,066.00')).toBeVisible();
  await typePin(page, DEMO_PIN);
  await expect(page.getByLabel('RECIBIDO')).toBeVisible();
  await page.getByRole('button', { name: 'Listo' }).click();

  // En Inventario se ve lo que está con vendedores.
  await page.getByRole('button', { name: 'Menú' }).click();
  await page.getByRole('button', { name: 'Inventario' }).click();
  await expect(page.getByRole('button', { name: /^Arroz saco 50kg/ })).toContainText('30 en tienda · 10 con vendedores');
  await page.goBack();

  // Liquidar: devuelve 2 sacos → vendió 8 arroz (S/ 1,480) + 2 aceite (S/ 216) = S/ 1,696.
  await page.getByRole('button', { name: 'Menú' }).click();
  await page.getByRole('button', { name: 'Clientes y vendedores' }).click();
  await page.getByRole('button', { name: /^Juan Quispe/ }).click();
  await expect(page.getByTestId('in-hands')).toHaveText('S/ 2,066.00');
  await page.getByRole('button', { name: 'Liquidar' }).click();
  await page.getByRole('button', { name: 'Devuelve uno más de Arroz saco 50kg' }).click();
  await page.getByRole('button', { name: 'Devuelve uno más de Arroz saco 50kg' }).click();
  await expect(page.getByTestId('settle-total')).toHaveText('S/ 1,696.00');
  await page.getByRole('button', { name: 'Otro monto' }).click();
  for (const d of '1000') await page.getByRole('button', { name: d, exact: true }).first().click();
  await expect(page.getByText('Queda debiendo S/ 696.00')).toBeVisible();
  await page.getByRole('button', { name: /^Firmar liquidación · S\/ 1,000.00/ }).click();
  await expect(page.getByText('Juan paga S/ 1,000.00')).toBeVisible();
  await typePin(page, DEMO_PIN);
  await expect(page.getByLabel('PAGADO')).toBeVisible();
  await expect(page.getByTestId('voucher')).toContainText('S/ 696.00');
  await page.getByRole('button', { name: 'Listo' }).click();

  await page.getByRole('button', { name: 'Menú' }).click();
  await page.getByRole('button', { name: 'Clientes y vendedores' }).click();
  await page.getByRole('button', { name: /^Juan Quispe/ }).click();
  await expect(page.getByTestId('party-balance')).toHaveText('S/ 696.00');
  await expect(page.getByTestId('in-hands')).toHaveText('S/ 0.00');
});
