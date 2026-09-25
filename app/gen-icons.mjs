// Genera los íconos del manifiesto PWA y del APK a partir de public/icon.svg.
// Uso: node gen-icons.mjs
import { chromium } from '@playwright/test';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const local = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const svg = readFileSync('public/icon.svg', 'utf8');
// Solo el dibujo (sin el fondo verde redondeado), para el ícono adaptativo.
const glyph = svg.replace(/<rect width="512" height="512"[^>]*\/>/, '');
const browser = await chromium.launch(existsSync(local) ? { executablePath: local } : {});

async function render(path, w, h, html) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.setContent(`<style>html,body{margin:0;width:${w}px;height:${h}px;overflow:hidden}</style>${html}`);
  await page.screenshot({ path, omitBackground: true });
  await page.close();
}
const box = (size, content, bg = 'transparent', radius = 0) =>
  `<div style="width:${size}px;height:${size}px;background:${bg};border-radius:${radius}px;display:flex;align-items:center;justify-content:center">${content}</div>`;
const img = (size, s = svg) => s.replace('<svg ', `<svg width="${size}" height="${size}" `);

// PWA
for (const size of [192, 512]) await render(`public/icon-${size}.png`, size, size, img(size));

// Android
const res = 'android/app/src/main/res';
if (existsSync(res)) {
  const launcher = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
  for (const [d, size] of Object.entries(launcher)) {
    await render(join(res, `mipmap-${d}`, 'ic_launcher.png'), size, size, img(size));
    await render(join(res, `mipmap-${d}`, 'ic_launcher_round.png'), size, size, box(size, img(size * 0.8), '#2B4636', size / 2));
    // Adaptativo: 108dp con zona segura de 66dp.
    const fg = size * 2.25;
    await render(join(res, `mipmap-${d}`, 'ic_launcher_foreground.png'), fg, fg, box(fg, img(fg * 0.72, glyph)));
  }
  for (const dir of readdirSync(res).filter((x) => x.startsWith('drawable'))) {
    const file = join(res, dir, 'splash.png');
    if (!existsSync(file)) continue;
    const b = readFileSync(file);
    const w = b.readUInt32BE(16);
    const h = b.readUInt32BE(20);
    const s = Math.round(Math.min(w, h) * 0.35);
    await render(file, w, h, `<div style="width:${w}px;height:${h}px;background:#F3ECDA;display:flex;align-items:center;justify-content:center">${img(s)}</div>`);
  }
}
await browser.close();
