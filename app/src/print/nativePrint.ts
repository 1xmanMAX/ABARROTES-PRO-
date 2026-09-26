import { Capacitor, registerPlugin } from '@capacitor/core';

interface PrinterPlugin {
  print(options: { html: string; name: string }): Promise<void>;
}

const Printer = registerPlugin<PrinterPlugin>('Printer');

export const isNativeApp = () => Capacitor.isNativePlatform();

/** Todas las reglas CSS de la página (los estilos del recibo, fichas y tipografías). */
function collectCss(): string {
  let css = '';
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      for (const rule of Array.from(sheet.cssRules)) css += `${rule.cssText}\n`;
    } catch {
      /* hoja de otro origen: se omite */
    }
  }
  return css;
}

/** Documento HTML completo e independiente con el contenido a imprimir. */
export function buildPrintHtml(content: string, css: string, paperWidthMm: number): string {
  return `<!doctype html><html lang="es-PE"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>${css}</style>
<style>@page { size: ${paperWidthMm}mm auto; margin: 0; } html, body { margin: 0; background: #fff; } #print-root { display: block !important; }</style>
</head><body><div id="print-root">${content}</div></body></html>`;
}

/** Imprime en el APK con el sistema de impresión de Android. */
export async function printNative(root: HTMLElement, paperWidthMm: number, name: string): Promise<void> {
  await Printer.print({ html: buildPrintHtml(root.innerHTML, collectCss(), paperWidthMm), name });
}
