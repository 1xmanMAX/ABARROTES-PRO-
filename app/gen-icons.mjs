// Genera los PNG del manifiesto a partir de public/icon.svg (uso: node gen-icons.mjs)
import { chromium } from '@playwright/test';
import { readFileSync, existsSync } from 'node:fs';
const local = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const svg = readFileSync('public/icon.svg', 'utf8');
const browser = await chromium.launch(existsSync(local) ? { executablePath: local } : {});
for (const size of [192, 512]) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(`<style>body{margin:0}svg{width:${size}px;height:${size}px;display:block}</style>${svg}`);
  await page.screenshot({ path: `public/icon-${size}.png`, omitBackground: true });
}
await browser.close();
