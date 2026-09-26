import { expect, test } from '@playwright/test';
import { freshWithDemo, tile } from './helpers';

// Versión de PC: pantalla ancha, mouse y teclado físico.
test.use({ viewport: { width: 1366, height: 768 }, isMobile: false, hasTouch: false });

test('PC: se ven todos los productos y "Buscar", y se escribe con el teclado', async ({ page }) => {
  await freshWithDemo(page);
  const grid = page.getByTestId('product-grid');
  await expect(grid.locator('[data-product-id]')).toHaveCount(10);
  await expect(page.getByRole('button', { name: 'Buscar otro producto' })).toBeInViewport();
  for (const b of await grid.locator('[data-product-id]').all()) await expect(b).toBeInViewport();

  // Venta con "Otro monto" escrito con el teclado.
  await tile(page, 'Arroz saco 50kg').click();
  await tile(page, 'Aceite caja ×12').click();
  await page.getByRole('button', { name: 'Cobrar', exact: true }).click();
  await page.getByRole('button', { name: 'Otro monto' }).click();
  await page.keyboard.type('300');
  await expect(page.getByRole('dialog')).toContainText('Vuelto: S/ 7.00');
  await page.keyboard.press('Backspace');
  await page.keyboard.type('00');
  await page.getByRole('button', { name: 'Aceptar' }).click();
  await expect(page.getByTestId('change')).toHaveText('S/ 2,707.00');

  // Fiado firmado escribiendo el código con el teclado y Enter.
  await page.getByRole('button', { name: 'Fiado', exact: true }).click();
  await page.getByRole('button', { name: /^Rosa Mamani/ }).click();
  await page.getByRole('button', { name: 'Firmar fiado' }).click();
  await page.keyboard.type('2580');
  await page.keyboard.press('Enter');
  await expect(page.getByLabel('FIADO')).toBeVisible();
});
