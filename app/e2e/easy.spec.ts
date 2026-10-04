import { expect, test } from '@playwright/test';
import { freshWithDemo, OWNER_PIN, tile, typePin } from './helpers';

test('contar billetes, ver el vuelto en billetes y monedas, y "Listo"', async ({ page }) => {
  await freshWithDemo(page);
  await tile(page, 'Arroz saco 50kg').click();
  await tile(page, 'Aceite caja ×12').click();
  await page.getByRole('button', { name: 'Cobrar', exact: true }).click();
  await expect(page.getByTestId('checkout-total')).toHaveText('S/ 293.00');

  // El cliente da 200 + 100: se tocan los dos billetes.
  await page.getByRole('button', { name: '+ S/ 200' }).click();
  await page.getByRole('button', { name: '+ S/ 100' }).click();
  await expect(page.getByTestId('counted')).toHaveText('Recibido: 200 + 100');
  await expect(page.getByTestId('change')).toHaveText('S/ 7.00');
  await expect(page.getByTestId('change-pieces')).toHaveAttribute('aria-label', 'Dar una moneda de 5 soles y una moneda de 2 soles');

  await page.getByRole('button', { name: 'Cobrar sin ticket' }).click();
  // Pantalla de vuelto: se queda hasta tocar "Listo".
  await expect(page.getByTestId('done-change')).toHaveText('S/ 7.00');
  await page.waitForTimeout(500);
  await expect(page.getByTestId('done-change')).toBeVisible();
  await page.getByRole('button', { name: 'Listo, ya di el vuelto' }).click();
  await expect(page.getByTestId('done-change')).toHaveCount(0);
  await expect(page.getByTestId('ticket-total')).toHaveText('S/ 0.00');
});

test('Yape: recuerda mirar el aviso en el celular propio', async ({ page }) => {
  await freshWithDemo(page);
  await tile(page, 'Arroz saco 50kg').click();
  await page.getByRole('button', { name: 'Cobrar', exact: true }).click();
  await page.getByRole('button', { name: /Yape/ }).click();
  await expect(page.getByRole('note')).toContainText('No aceptes capturas');
  await page.getByRole('button', { name: 'Sí llegó · Cobrar', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Venta S/ 185.00 registrada');
});

test('modo ayudante: solo vender, sin fiado ni rebaja; salir pide el código de dueño', async ({ page }) => {
  await freshWithDemo(page);
  await page.getByRole('button', { name: 'Menú' }).click();
  await page.getByRole('button', { name: /Ajustes/ }).click();
  await page.getByRole('button', { name: /Activar modo ayudante/ }).click();

  // De vuelta en Vender: el menú ya no muestra Caja ni Inventario.
  await page.getByRole('button', { name: 'Menú' }).click();
  await expect(page.getByRole('button', { name: /Caja/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Inventario/ })).toHaveCount(0);
  await page.getByRole('button', { name: /Vender/ }).click();

  await tile(page, 'Arroz saco 50kg').click();
  await page.getByRole('button', { name: 'Cobrar', exact: true }).click();
  await expect(page.getByRole('button', { name: /Fiado/ })).toHaveCount(0);
  await expect(page.getByText('REBAJA POR REGATEO')).toHaveCount(0);
  await page.getByRole('button', { name: 'Cobrar sin ticket' }).click();
  await expect(page.getByRole('status')).toContainText('registrada');

  await page.getByRole('button', { name: 'Menú' }).click();
  await page.getByRole('button', { name: /Salir del modo ayudante/ }).click();
  await typePin(page, OWNER_PIN, 'Aceptar');
  await expect(page.getByRole('status')).toContainText('Modo ayudante desactivado');
  await page.getByRole('button', { name: 'Menú' }).click();
  await expect(page.getByRole('button', { name: /Inventario/ })).toBeVisible();
});

test('letra grande y modo Sol se aplican al instante', async ({ page }) => {
  await freshWithDemo(page);
  await page.getByRole('button', { name: 'Menú' }).click();
  await page.getByRole('button', { name: /Ajustes/ }).click();
  await page.getByRole('button', { name: 'Muy grande' }).click();
  await page.getByRole('button', { name: /^Sol/ }).click();
  await expect(page.locator('html')).toHaveAttribute('data-text', 'muy-grande');
  await expect(page.locator('html')).toHaveAttribute('data-contrast', 'sol');
  const size = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize));
  expect(size).toBeGreaterThan(20);
  await page.getByRole('button', { name: 'Volver' }).click();
  // Con letra muy grande, el teléfono pasa a 2 columnas.
  const cols = await page.getByTestId('product-grid').evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length);
  expect(cols).toBe(2);
});
