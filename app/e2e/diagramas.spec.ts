import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

/**
 * Comprueba que los diagramas Mermaid del README se dibujan (GitHub usa la misma biblioteca) y
 * guarda una imagen de cada uno para revisarlos. Solo con `CAPTURAS=1`.
 */
test.skip(!process.env.CAPTURAS, 'solo con npm run capturas');

test('los diagramas del README se dibujan sin errores', async ({ browser }) => {
  const md = readFileSync('../README.md', 'utf8');
  const bloques = [...md.matchAll(/```mermaid\r?\n([\s\S]*?)```/g)].map((m) => m[1]!);
  expect(bloques.length).toBeGreaterThan(0);
  const page = await (await browser.newContext({ viewport: { width: 1000, height: 800 } })).newPage();
  await page.setContent(`<!doctype html><html><body style="background:#fff">
    ${bloques.map((b, i) => `<pre class="mermaid" id="d${i}">${b.replace(/</g, '&lt;')}</pre>`).join('\n')}
    <script type="module">
      import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';
      mermaid.initialize({ startOnLoad: false });
      try { await mermaid.run(); window.listo = 'ok'; } catch (e) { window.listo = String(e); }
    </script></body></html>`);
  await page.waitForFunction(() => (window as { listo?: string }).listo, null, { timeout: 30_000 });
  expect(await page.evaluate(() => (window as { listo?: string }).listo)).toBe('ok');
  for (let i = 0; i < bloques.length; i++) {
    await expect(page.locator(`#d${i} svg`)).toBeVisible();
    await page.locator(`#d${i}`).screenshot({ path: `test-results/diagrama-${i}.png` });
  }
});
