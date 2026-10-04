import { expect, test, type Page } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { OWNER_PIN, tile, typePin } from './helpers';

/**
 * Dos aparatos con Nexo, de punta a punta: cada uno es la app servida por su propia copia local
 * (pc/examples/nodo_prueba.rs). Uno crea el grupo, el otro se une con el código, y lo que se
 * vende en uno aparece en el otro.
 *
 * Necesita el ejecutable de prueba compilado:
 *   cd pc && cargo build --example nodo_prueba
 *   NEXO_PRUEBA=<ruta a nodo_prueba(.exe)> npx playwright test nexo
 */
const EXE = process.env.NEXO_PRUEBA;
test.skip(!EXE, 'solo con NEXO_PRUEBA=<nodo_prueba>');

const procesos: ChildProcess[] = [];

function aparato(dir: string, puerto: number, nombre: string, anuncios: string): Promise<void> {
  return new Promise((ok, mal) => {
    const p = spawn(EXE!, [dir, resolve('dist'), String(puerto), nombre, anuncios]);
    procesos.push(p);
    p.stdout.on('data', (d: Buffer) => d.toString().includes('listo') && ok());
    p.on('exit', (c) => mal(new Error(`nodo_prueba salió con ${c}`)));
  });
}

test.afterAll(() => procesos.forEach((p) => p.kill()));

async function crearDueno(page: Page, url: string) {
  await page.goto(url);
  await expect(page.getByText('Crea tu código de dueño')).toBeVisible();
  await typePin(page, OWNER_PIN, 'Aceptar');
  await typePin(page, OWNER_PIN, 'Guardar');
}

async function abrirSincronizar(page: Page) {
  await page.getByRole('button', { name: 'Menú' }).click();
  await page.getByRole('button', { name: /Sincronizar aparatos/ }).click();
}

test('dos aparatos en grupo: unirse con el código y ver la venta del otro', async ({ browser }) => {
  test.setTimeout(180_000);
  const tmp = mkdtempSync(join(tmpdir(), 'nexo-e2e-'));
  await Promise.all([
    aparato(join(tmp, 'pc'), 47601, 'PC de prueba', join(tmp, 'anuncios')),
    aparato(join(tmp, 'cel'), 47602, 'Celular de prueba', join(tmp, 'anuncios')),
  ]);
  const pc = await (await browser.newContext()).newPage();
  const cel = await (await browser.newContext()).newPage();

  // La PC tiene los datos: crea el grupo.
  await crearDueno(pc, 'http://127.0.0.1:47601/');
  await pc.getByRole('button', { name: 'Cargar datos de ejemplo' }).click();
  await expect(tile(pc, 'Arroz saco 50kg')).toBeVisible({ timeout: 15_000 });
  await abrirSincronizar(pc);
  await pc.getByRole('button', { name: /Crear un grupo nuevo/ }).click();
  const codigo = (await pc.getByTestId('group-code').textContent({ timeout: 20_000 }))!.trim();
  expect(codigo).toMatch(/^[0-9A-Z]{5}-[0-9A-Z]{5}$/);
  if (process.env.CAPTURAS) await pc.screenshot({ path: '../docs/capturas/26-grupo-creado.png' });

  // El celular nuevo se une tecleando el código (en minúsculas y sin guion: da igual).
  await crearDueno(cel, 'http://127.0.0.1:47602/');
  await abrirSincronizar(cel);
  await cel.getByTestId('group-code-input').fill(codigo.toLowerCase().replace('-', ''));
  await cel.getByRole('button', { name: /Unirme al grupo/ }).click();
  await expect(cel.getByTestId('group-code')).toHaveText(codigo, { timeout: 30_000 });
  await expect(cel.getByText('PC de prueba')).toBeVisible();
  if (process.env.CAPTURAS) await cel.screenshot({ path: '../docs/capturas/27-grupo-unido.png' });

  // Los productos de la PC llegan solos al celular.
  await cel.getByRole('button', { name: 'Volver' }).click();
  await expect(tile(cel, 'Arroz saco 50kg')).toBeVisible({ timeout: 40_000 });

  // Una venta en la PC aparece en el historial del celular.
  await pc.getByRole('button', { name: 'Volver' }).click();
  await tile(pc, 'Aceite caja ×12').click();
  await pc.getByRole('button', { name: 'Cobrar', exact: true }).click();
  await pc.getByRole('button', { name: 'Cobrar sin ticket' }).click();
  await expect(pc.getByRole('status')).toContainText('Venta S/ 108.00 registrada');

  await cel.getByRole('button', { name: 'Menú' }).click();
  await cel.getByRole('button', { name: /Historial de ventas/ }).click();
  await expect(cel.getByText('S/ 108.00').first()).toBeVisible({ timeout: 40_000 });
});
