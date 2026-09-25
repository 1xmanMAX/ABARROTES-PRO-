import { expect, test } from '@playwright/test';
import { freshWithDemo, tile } from './helpers';

test('caja: saldo inicial, venta, compra, retiro y cierre del día con faltante', async ({ page }) => {
  await freshWithDemo(page);
  const menu = async (name: string) => {
    await page.getByRole('button', { name: 'Menú' }).click();
    await page.getByRole('button', { name, exact: true }).click();
  };
  // Los datos de ejemplo ya traen ventas en efectivo: se comparan diferencias.
  const cash = async () => {
    const txt = (await page.getByTestId('cash-expected').textContent()) ?? '';
    return Math.round(Number(txt.replace(/[^\d.]/g, '')) * 100);
  };
  const fmt = (c: number) => `S/ ${(c / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  const keys = async (digits: string) => {
    for (const d of digits) await page.getByRole('dialog').getByRole('button', { name: d === '.' ? 'punto decimal' : d, exact: true }).click();
  };

  await menu('Caja');
  // Esperar a que carguen los movimientos (al inicio muestra S/ 0.00).
  await expect(page.getByTestId('cash-expected')).not.toHaveText('S/ 0.00');
  const start = await cash();
  await page.getByRole('button', { name: 'Saldo inicial' }).click();
  await keys('500');
  await page.getByRole('button', { name: /^Guardar · S\/ 500.00/ }).click();
  await expect(page.getByTestId('cash-expected')).toHaveText(fmt(start + 50000));
  await page.goBack();

  // Venta en efectivo de S/ 185.
  await tile(page, 'Arroz saco 50kg').click();
  await page.getByRole('button', { name: 'Cobrar', exact: true }).click();
  await page.getByRole('button', { name: 'Cobrar sin ticket' }).click();
  await expect(page.getByRole('status')).toContainText('registrada');

  // Compra de 2 sacos a S/ 160 (actualiza costo) → resta S/ 320.
  await menu('Caja');
  await expect(page.getByTestId('cash-expected')).toHaveText(fmt(start + 68500));
  await page.getByRole('button', { name: 'Compra', exact: true }).first().click();
  await page.getByRole('button', { name: 'Agregar 1 Arroz saco 50kg' }).click();
  await page.getByRole('button', { name: 'Agregar 1 Arroz saco 50kg' }).click();
  await page.getByRole('button', { name: /Costo c\/u: S\/ 165.00/ }).first().click();
  for (let i = 0; i < 6; i++) await page.getByRole('dialog').getByRole('button', { name: 'Borrar' }).click();
  await keys('160');
  await page.getByRole('button', { name: 'Aceptar' }).click();
  await expect(page.getByTestId('purchase-total')).toHaveText('S/ 320.00');
  await page.getByRole('button', { name: 'Guardar compra' }).click();
  await expect(page.getByTestId('cash-expected')).toHaveText(fmt(start + 36500));

  // Retiro del dueño de S/ 50 (no es gasto).
  await page.getByRole('button', { name: 'Retiro', exact: true }).first().click();
  await keys('50');
  await page.getByRole('button', { name: /^Guardar · S\/ 50.00/ }).click();
  await expect(page.getByTestId('cash-expected')).toHaveText(fmt(start + 31500));

  // Cierre: cuenta S/ 310 → falta S/ 5.
  await page.getByRole('button', { name: 'Cierre del día' }).click();
  const counted = start + 31000;
  await keys((counted / 100).toFixed(2));
  await expect(page.getByTestId('close-diff')).toContainText('Falta S/ 5.00');
  await page.getByRole('button', { name: 'Guardar cierre' }).click();
  await expect(page.getByTestId('cash-expected')).toHaveText(fmt(counted));
  await expect(page.getByRole('button', { name: 'Cierre del día' })).toBeDisabled();

  // Inventario: stock y costo actualizados por la compra.
  await page.goBack();
  await menu('Inventario');
  await expect(page.getByRole('button', { name: /^Arroz saco 50kg/ })).toContainText('41 en tienda');

  // Inicio muestra el efectivo en caja.
  await page.goBack();
  await menu('Inicio');
  await expect(page.getByTestId('home-cash')).toHaveText(fmt(counted));
});
