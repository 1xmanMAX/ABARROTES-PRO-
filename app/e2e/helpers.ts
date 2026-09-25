import { expect, type Page } from '@playwright/test';

export async function freshWithDemo(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Cargar datos de ejemplo' }).click();
  // Con historial cargado aparecen las 3 sugerencias.
  await expect(page.getByTestId('suggestions').getByRole('button')).toHaveCount(3, { timeout: 15_000 });
}

export const tile = (page: Page, name: string) => page.getByTestId('product-grid').getByRole('button', { name: new RegExp(`^${name}`) });

export async function gridPositions(page: Page) {
  return page
    .getByTestId('product-grid')
    .locator('[data-product-id]')
    .evaluateAll((els) => els.map((e) => e.getAttribute('data-product-id')));
}

export async function gridNames(page: Page) {
  return page
    .getByTestId('product-grid')
    .locator('[data-product-id]')
    .evaluateAll((els) => els.map((e) => (e.getAttribute('aria-label') ?? '').split(',')[0]));
}

/** Toca el tile si está en pantalla; si no, lo agrega desde "Buscar". */
export async function tapProduct(page: Page, name: string) {
  const t = tile(page, name);
  if (await t.count()) return t.click();
  await page.getByRole('button', { name: 'Buscar otro producto' }).click();
  await page.getByRole('dialog').getByRole('button', { name: new RegExp(`^${name}`) }).click();
}
