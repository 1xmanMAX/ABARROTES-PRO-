import { expect, test } from '@playwright/test';
import { freshWithDemo, OWNER_PIN, typePin } from './helpers';

test('copia de seguridad: crear, perder el teléfono y restaurar en otro', async ({ page, browser }) => {
  test.setTimeout(90_000); // el cifrado es lento a propósito
  await freshWithDemo(page);
  // Recordatorio semanal: nunca se hizo copia.
  await page.getByRole('button', { name: 'Menú' }).click();
  await expect(page.getByRole('button', { name: /Haz tu copia de seguridad \(nunca la hiciste\)/ })).toBeVisible();
  await page.getByRole('button', { name: /Haz tu copia de seguridad/ }).click();

  await page.getByRole('button', { name: 'Crear copia de seguridad' }).click();
  const downloadPromise = page.waitForEvent('download');
  await typePin(page, OWNER_PIN, 'Aceptar');
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^mi-bodega-respaldo-.*\.json$/);
  const path = await download.path();
  await expect(page.getByTestId('last-backup')).toContainText('hoy');

  // "Teléfono nuevo": otro navegador limpio, con otro código de dueño.
  const other = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const p2 = await other.newPage();
  await p2.goto('/');
  await typePin(p2, '1357', 'Aceptar');
  await typePin(p2, '1357', 'Guardar');
  await p2.getByRole('button', { name: 'Menú' }).click();
  await p2.getByRole('button', { name: 'Copia de seguridad' }).click();
  await p2.getByTestId('restore-file').setInputFiles(path);
  await expect(p2.getByText(/10 productos, 300 ventas, 2 personas/)).toBeVisible();
  await p2.getByRole('button', { name: 'Sí, reemplazar mis datos' }).click();
  await typePin(p2, '1357', 'Aceptar'); // código actual
  await expect(p2.getByText('Paso 2: código de dueño con el que se hizo la copia')).toBeVisible();
  await typePin(p2, '0000', 'Aceptar'); // código de la copia, mal
  await expect(p2.getByRole('alert')).toContainText('Código incorrecto');
  await typePin(p2, OWNER_PIN, 'Aceptar');

  // Después de reiniciar, están los productos y el código de dueño es el de la copia.
  await expect(p2.getByTestId('product-grid').locator('[data-product-id]').first()).toBeVisible({ timeout: 15_000 });
  await p2.getByRole('button', { name: 'Menú' }).click();
  await p2.getByRole('button', { name: 'Clientes y vendedores' }).click();
  await expect(p2.getByRole('button', { name: /^Rosa Mamani/ })).toBeVisible();
  await other.close();
});
