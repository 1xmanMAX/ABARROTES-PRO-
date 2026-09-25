import { expect, test, type Page } from '@playwright/test';
import { DEMO_PIN, freshWithDemo, tile, typePin } from './helpers';

/**
 * Genera las capturas del README en docs/capturas. No es un test de la app:
 * solo corre con `npm run capturas`.
 */
test.skip(!process.env.CAPTURAS, 'solo con npm run capturas');

const DIR = '../docs/capturas';
const shot = (page: Page, name: string, full = false) => page.screenshot({ path: `${DIR}/${name}.png`, fullPage: full });
const quiet = (page: Page) => page.waitForTimeout(3300); // que desaparezcan los avisos
const menu = async (page: Page, name: string) => {
  await page.getByRole('button', { name: 'Menú' }).click();
  await page.getByRole('button', { name, exact: true }).click();
};

test('capturas del README', async ({ page }) => {
  test.setTimeout(240_000);
  await page.goto('/');
  await expect(page.getByText('Crea tu código de dueño')).toBeVisible();
  await shot(page, '00-codigo-dueno');
  await freshWithDemo(page);
  await menu(page, 'Ajustes');
  await page.getByLabel('Gastos fijos del mes (S/)').fill('3000');
  await page.getByLabel('Gastos fijos del mes (S/)').blur();
  await page.goBack();
  await quiet(page);

  // Vender
  await tile(page, 'Arroz saco 50kg').click();
  await tile(page, 'Arroz saco 50kg').click();
  await tile(page, 'Aceite caja ×12').click();
  await page.getByRole('button', { name: 'Nuevo cliente en espera' }).click();
  await page.getByRole('button', { name: /^Cliente 1/ }).click();
  await shot(page, '01-vender');

  // Cobrar con rebaja
  await page.getByRole('button', { name: 'Cobrar', exact: true }).click();
  await page.getByRole('button', { name: 'Rebaja S/ 3.00' }).click();
  await page.getByRole('button', { name: 'S/ 500' }).click();
  await shot(page, '02-cobrar');

  // Fiado + firma
  await page.getByRole('button', { name: 'Fiado', exact: true }).click();
  await page.getByRole('button', { name: /^Rosa Mamani/ }).click();
  await shot(page, '03-fiado');
  await page.getByRole('button', { name: 'Firmar fiado' }).click();
  await page.getByRole('button', { name: '2', exact: true }).last().click();
  await page.getByRole('button', { name: '5', exact: true }).last().click();
  await shot(page, '04-firma');
  await page.getByRole('button', { name: 'Borrar' }).last().click();
  await page.getByRole('button', { name: 'Borrar' }).last().click();
  await typePin(page, DEMO_PIN);
  await expect(page.getByTestId('voucher')).toBeVisible();
  await quiet(page);
  await shot(page, '05-comprobante');
  await page.getByRole('button', { name: 'Listo' }).click();

  // Inventario
  await menu(page, 'Inventario');
  await shot(page, '06-inventario');
  await page.getByRole('button', { name: /^Arroz saco 50kg/ }).click();
  await expect(page.getByText('Precio de venta (S/)')).toBeVisible();
  await shot(page, '07-producto');
  await page.goBack();
  await page.goBack();

  // Vendedor: entregar y liquidar
  await menu(page, 'Clientes y vendedores');
  await shot(page, '08-clientes');
  await page.getByRole('button', { name: /^Juan Quispe/ }).click();
  await page.getByRole('button', { name: 'Entregar mercadería' }).click();
  for (let i = 0; i < 5; i++) await page.getByRole('button', { name: 'Agregar 1 Arroz saco 50kg' }).click();
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Agregar 1 Aceite caja ×12' }).click();
  await shot(page, '09-entregar');
  await page.getByRole('button', { name: 'Firmar recepción' }).click();
  await typePin(page, DEMO_PIN);
  await page.getByRole('button', { name: 'Listo' }).click();
  await menu(page, 'Clientes y vendedores');
  await page.getByRole('button', { name: /^Juan Quispe/ }).click();
  await page.getByRole('button', { name: 'Liquidar' }).click();
  await page.getByRole('button', { name: 'Devuelve uno más de Aceite caja ×12' }).click();
  await quiet(page);
  await shot(page, '10-liquidar');
  await page.goBack();
  await page.goBack();
  await page.goBack();

  // Caja
  await menu(page, 'Caja');
  await expect(page.getByTestId('cash-expected')).not.toHaveText('S/ 0.00');
  await shot(page, '11-caja');
  await page.goBack();

  // Inicio
  await menu(page, 'Inicio');
  await page.waitForTimeout(500);
  await shot(page, '12-inicio', true);

  // Rentabilidad y análisis económico
  await page.getByRole('button', { name: 'Ver rentabilidad de productos y del negocio' }).click();
  await expect(page.getByTestId('business-verdict')).toBeVisible();
  await page.waitForTimeout(500);
  await shot(page, '13-rentabilidad');
  await page.getByTestId('break-even').screenshot({ path: `${DIR}/14-equilibrio.png` });
  await page.getByTestId('abc').screenshot({ path: `${DIR}/15-pareto.png` });
  await page.getByRole('button', { name: '7 días' }).click();
  await page.getByRole('button', { name: /^Arroz:/ }).click();
  await page.getByTestId('bcg').screenshot({ path: `${DIR}/16-bcg.png` });
  await page.getByTestId('gmroi').screenshot({ path: `${DIR}/17-gmroi.png` });
  await page.goBack();
  await page.goBack();

  // Copia de seguridad
  await menu(page, 'Copia de seguridad');
  await shot(page, '18-copia');
  await page.goBack();

  // Modo oscuro
  await menu(page, 'Ajustes');
  await page.getByRole('button', { name: 'Oscuro' }).click();
  await page.goBack();
  await page.waitForTimeout(300);
  await shot(page, '19-oscuro');
});
