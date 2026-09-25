import { describe, expect, it } from 'vitest';
import { buildPrintHtml } from './nativePrint';

describe('impresión en el APK', () => {
  it('arma un documento independiente con estilos, papel y contenido visible', () => {
    const html = buildPrintHtml('<div class="r">Ticket #0001</div>', '.r{color:red}', 58);
    expect(html).toContain('Ticket #0001');
    expect(html).toContain('.r{color:red}');
    expect(html).toContain('size: 58mm auto');
    expect(html).toContain('#print-root { display: block !important; }');
    expect(html.startsWith('<!doctype html>')).toBe(true);
  });
});
