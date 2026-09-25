import { expect, test } from '@playwright/test';
import { freshWithDemo, tile } from './helpers';

test('ganancias de hoy con gastos y rentabilidad por producto', async ({ page }) => {
  await freshWithDemo(page);
  // Venta: 2 sacos de arroz (costo 165, precio 185) → ganancia S/ 40.
  await tile(page, 'Arroz saco 50kg').click();
  await tile(page, 'Arroz saco 50kg').click();
  await page.getByRole('button', { name: 'Cobrar', exact: true }).click();
  await page.getByRole('button', { name: 'Cobrar sin ticket' }).click();
  await expect(page.getByRole('status')).toContainText('registrada');

  await page.getByRole('button', { name: 'Menú' }).click();
  await page.getByRole('button', { name: 'Inicio', exact: true }).click();
  await expect(page.getByTestId('sold-today')).toHaveText('S/ 370.00');
  await expect(page.getByTestId('net-today')).toHaveText('+S/ 40.00');

  // Un gasto de S/ 5 (mototaxi) baja la ganancia neta.
  await page.getByRole('button', { name: '+ Registrar gasto' }).click();
  await page.getByRole('dialog').getByRole('button', { name: '5', exact: true }).click();
  await page.getByRole('button', { name: /^Guardar · S\/ 5.00/ }).click();
  await expect(page.getByTestId('net-today')).toHaveText('+S/ 35.00');

  // Rentabilidad: veredicto del negocio y productos.
  await page.getByRole('button', { name: 'Ver rentabilidad de productos y del negocio' }).click();
  await expect(page.getByTestId('business-verdict')).toContainText('rentable');
  const list = page.getByRole('list', { name: 'Productos' });
  await expect(list.getByRole('listitem').first()).toContainText('Arroz saco 50kg');
  await expect(list.getByRole('listitem').first()).toContainText('Estrella');
  await list.getByRole('button', { name: /Arroz saco 50kg/ }).click();
  await expect(list).toContainText('Que nunca te falte');
  await page.getByRole('button', { name: /Para revisar/ }).click();
  await page.getByRole('button', { name: '7 días' }).click();
  await expect(page.getByRole('img', { name: 'Ganancia neta por día' })).toBeVisible();

  // Análisis económico.
  await expect(page.getByTestId('break-even')).toContainText('Necesitas vender');
  await expect(page.getByTestId('abc')).toContainText('clase A');
  await expect(page.getByTestId('bcg')).toContainText('estrella');
  await expect(page.getByRole('img', { name: 'Matriz BCG' })).toBeVisible();
  await page.getByTestId('abc').getByRole('button', { name: '¿Qué es?' }).click();
  await expect(page.getByTestId('abc')).toContainText('regla 80/20');
  await expect(page.getByTestId('gmroi')).toContainText('rota');
});
