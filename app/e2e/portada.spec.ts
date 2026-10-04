import { test } from '@playwright/test';
import { readFileSync } from 'node:fs';

/**
 * Genera las imágenes de presentación del README (portada y galería) a partir de
 * las capturas de docs/capturas. Solo corre con `npm run capturas`.
 */
test.skip(!process.env.CAPTURAS, 'solo con npm run capturas');

const SHOTS = '../docs/capturas';
const OUT = '../docs/presentacion';
const img = (name: string) => `data:image/png;base64,${readFileSync(`${SHOTS}/${name}.png`).toString('base64')}`;
const font = (pkg: string, file: string) =>
  `data:font/woff2;base64,${readFileSync(`node_modules/@fontsource/${pkg}/files/${file}`).toString('base64')}`;

const FONTS = `
@font-face { font-family: 'AHN'; font-weight: 500; src: url(${font('atkinson-hyperlegible-next', 'atkinson-hyperlegible-next-latin-500-normal.woff2')}); }
@font-face { font-family: 'AHN'; font-weight: 800; src: url(${font('atkinson-hyperlegible-next', 'atkinson-hyperlegible-next-latin-800-normal.woff2')}); }
* { box-sizing: border-box; margin: 0; }
body { font-family: 'AHN', sans-serif; }
.phone { border-radius: 38px; background: #0b0f0c; padding: 10px; box-shadow: 0 30px 60px rgba(0,0,0,.45), 0 0 0 2px #3c4a40 inset; }
.phone img { display: block; width: 100%; border-radius: 28px; }
`;

const pill = (text: string) => `<span class="pill">${text}</span>`;

test('portada y galería del README', async ({ browser }) => {
  test.setTimeout(120_000);
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 640 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();

  await page.setContent(`<!doctype html><html><head><style>${FONTS}
    body { width: 1280px; height: 640px; overflow: hidden; color: #fff;
      background: radial-gradient(circle at 78% 40%, #2c5a41 0, #1e3a2b 38%, #12241a 100%); position: relative; }
    .stripe { position: absolute; left: 0; right: 0; bottom: 0; height: 10px; background: #e0b04a; }
    .left { position: absolute; left: 72px; top: 92px; width: 560px; }
    .brand { display: flex; align-items: center; gap: 16px; }
    .logo { width: 64px; height: 64px; border-radius: 18px; background: #e0b04a; display: grid; place-items: center; }
    h1 { font-size: 64px; font-weight: 800; letter-spacing: -1px; }
    .tag { margin-top: 18px; font-size: 30px; line-height: 1.25; color: #f3ead2; font-weight: 500; }
    .tag b { color: #f0c35c; font-weight: 800; }
    .pills { margin-top: 30px; display: flex; flex-wrap: wrap; gap: 12px; max-width: 540px; }
    .pill { padding: 10px 18px; border-radius: 999px; border: 2px solid rgba(255,255,255,.5); font-size: 20px; font-weight: 800; }
    .phones { position: absolute; right: 40px; top: 60px; width: 600px; height: 600px; }
    .phones .phone { position: absolute; width: 230px; }
    .p1 { left: 0; top: 70px; transform: rotate(-7deg); }
    .p2 { left: 185px; top: 10px; z-index: 2; width: 250px !important; }
    .p3 { left: 380px; top: 70px; transform: rotate(7deg); }
  </style></head><body>
    <div class="left">
      <div class="brand">
        <div class="logo"><svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="#14281d" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 1.9-1.4L21 8H6.2"/><circle cx="10" cy="20.5" r="1.2"/><circle cx="17" cy="20.5" r="1.2"/></svg></div>
        <h1>Mi Bodega</h1>
      </div>
      <p class="tag">Punto de venta para <b>abarrotes por mayor</b>.<br>Vende en 5 toques, cobra sin errores y sabe si tu negocio gana.</p>
      <div class="pills">${['Sin internet', 'Android + PC', 'Fiado con firma', 'Fácil para niños', 'Letra grande y modo Sol'].map(pill).join('')}</div>
    </div>
    <div class="phones">
      <div class="phone p1"><img src="${img('02-cobrar')}"></div>
      <div class="phone p2"><img src="${img('01-vender')}"></div>
      <div class="phone p3"><img src="${img('22-vuelto')}"></div>
    </div>
    <div class="stripe"></div>
  </body></html>`);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/portada.png` });

  // Galería: el recorrido de una venta, de izquierda a derecha.
  const steps: [string, string, string][] = [
    ['01-vender', '1. Toca y suma', 'Se suman al ticket al instante'],
    ['21-contar-billetes', '2. Cobra', 'Toca los billetes que te dan'],
    ['22-vuelto', '3. Da el vuelto', 'Con dibujos de billetes y monedas'],
    ['03-fiado', '4. O fía con firma', 'El cliente firma con su código'],
    ['13-rentabilidad', '5. Mira tu ganancia', 'Qué producto gana y cuál pierde'],
  ];
  await page.setViewportSize({ width: 1280, height: 600 });
  await page.setContent(`<!doctype html><html><head><style>${FONTS}
    body { width: 1280px; height: 600px; background: #fbf7ee; color: #14110c; display: flex; gap: 22px; padding: 34px 40px; }
    .step { flex: 1; display: flex; flex-direction: column; align-items: center; text-align: center; }
    .step .phone { width: 210px; height: 430px; overflow: hidden; }
    .step .phone img { height: 100%; object-fit: cover; object-position: top; }
    h2 { margin-top: 20px; font-size: 22px; font-weight: 800; white-space: nowrap; }
    p { margin-top: 6px; font-size: 18px; color: #3d372c; font-weight: 500; }
  </style></head><body>
    ${steps.map(([s, h, p]) => `<div class="step"><div class="phone"><img src="${img(s)}"></div><h2>${h}</h2><p>${p}</p></div>`).join('')}
  </body></html>`);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/recorrido.png` });

  // Accesibilidad: Normal, letra grande + Sol, modo ayudante.
  const access: [string, string][] = [
    ['01-vender', 'Normal'],
    ['24-sol-letra-grande', 'Sol + letra grande'],
    ['19-oscuro', 'Modo oscuro'],
    ['25-ayudante', 'Modo ayudante (niños)'],
  ];
  await page.setContent(`<!doctype html><html><head><style>${FONTS}
    body { width: 1280px; height: 600px; background: #1e3a2b; color: #fff; display: flex; gap: 30px; padding: 34px 60px; }
    .step { flex: 1; display: flex; flex-direction: column; align-items: center; }
    .step .phone { width: 230px; height: 470px; overflow: hidden; }
    .step .phone img { height: 100%; object-fit: cover; object-position: top; }
    h2 { margin-top: 22px; font-size: 24px; font-weight: 800; }
  </style></head><body>
    ${access.map(([s, h]) => `<div class="step"><div class="phone"><img src="${img(s)}"></div><h2>${h}</h2></div>`).join('')}
  </body></html>`);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/accesible.png` });
  await ctx.close();
});
