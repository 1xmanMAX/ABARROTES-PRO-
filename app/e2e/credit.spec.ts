import { expect, test } from '@playwright/test';
import { DEMO_PIN, freshWithDemo, OWNER_PIN, tile, typePin } from './helpers';

test('fiado firmado con código y cobro de la deuda con comprobante', async ({ page }) => {
  await freshWithDemo(page);
  await tile(page, 'Arroz saco 50kg').click();
  await tile(page, 'Arroz saco 50kg').click();
  await page.getByRole('button', { name: 'Cobrar', exact: true }).click();
  await page.getByRole('button', { name: 'Fiado', exact: true }).click();
  await page.getByRole('button', { name: /^Rosa Mamani/ }).click();
  await expect(page.getByTestId('new-balance')).toHaveText('S/ 370.00');
  await page.getByRole('button', { name: 'Firmar fiado' }).click();
  await expect(page.getByText('Rosa acepta deber S/ 370.00')).toBeVisible();

  // Código incorrecto: no se guarda.
  await typePin(page, '1111');
  await expect(page.getByRole('alert')).toContainText('Código incorrecto (quedan 2 intentos)');
  await typePin(page, DEMO_PIN);

  // Comprobante FIADO con n.º de operación.
  const voucher = page.getByTestId('voucher');
  await expect(voucher).toContainText('Rosa Mamani');
  await expect(voucher).toContainText(/MB-\d{4}-[0-9A-Z]{4}/);
  await expect(voucher).toContainText('Íntegro');
  await expect(page.getByLabel('FIADO')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Enviar por WhatsApp' })).toHaveAttribute('href', /wa\.me\/51987654321/);
  await page.getByRole('button', { name: 'Listo' }).click();
  await expect(page.getByTestId('ticket-total')).toHaveText('S/ 0.00');

  // Cobrar la deuda desde la ficha.
  await page.getByRole('button', { name: 'Menú' }).click();
  await page.getByRole('button', { name: 'Clientes y vendedores' }).click();
  await page.getByRole('button', { name: /^Rosa Mamani/ }).click();
  await expect(page.getByTestId('party-balance')).toHaveText('S/ 370.00');
  await page.getByRole('button', { name: 'Cobrar deuda' }).click();
  await page.getByRole('button', { name: 'Otro monto' }).click();
  for (const d of '200') await page.getByRole('dialog').getByRole('button', { name: d, exact: true }).click();
  await page.getByRole('button', { name: /^Firmar · S\/ 200.00/ }).click();
  await expect(page.getByText('Rosa paga S/ 200.00')).toBeVisible();
  await typePin(page, DEMO_PIN);
  await expect(page.getByLabel('PAGADO')).toBeVisible();
  await expect(page.getByTestId('voucher')).toContainText('S/ 170.00');
});

test('fiado sobre el límite exige el código de dueño', async ({ page }) => {
  await freshWithDemo(page);
  // Juan: límite S/ 800. 5 sacos de arroz = S/ 925.
  await page.getByRole('button', { name: '×5', exact: true }).click();
  await tile(page, 'Arroz saco 50kg').click();
  await page.getByRole('button', { name: 'Cobrar', exact: true }).click();
  await page.getByRole('button', { name: 'Fiado', exact: true }).click();
  await page.getByRole('button', { name: /^Juan Quispe/ }).click();
  await expect(page.getByText(/Pasa su límite por S\/ 125.00/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Firmar fiado' })).toBeDisabled();
  await page.getByRole('button', { name: 'Autorizar con código de dueño' }).click();
  await typePin(page, OWNER_PIN, 'Aceptar');
  await expect(page.getByText('Autorizado por el dueño')).toBeVisible();
  await page.getByRole('button', { name: 'Firmar fiado' }).click();
  await typePin(page, DEMO_PIN);
  await expect(page.getByLabel('FIADO')).toBeVisible();
  await expect(page.getByTestId('voucher')).toContainText('S/ 925.00');
});
