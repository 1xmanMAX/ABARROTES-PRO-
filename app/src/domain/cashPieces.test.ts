import { describe, expect, it } from 'vitest';
import { changeBreakdown, describeBreakdown, spokenAmount } from './cashPieces';

describe('vuelto en billetes y monedas', () => {
  it('usa la menor cantidad de piezas', () => {
    const b = changeBreakdown(2500);
    expect(b.parts.map((p) => [p.value, p.count])).toEqual([
      [2000, 1],
      [500, 1],
    ]);
    expect(b.rest).toBe(0);
  });

  it('repite piezas y baja hasta los céntimos', () => {
    const b = changeBreakdown(48880);
    expect(b.parts.map((p) => [p.value, p.count])).toEqual([
      [20000, 2],
      [5000, 1],
      [2000, 1],
      [1000, 1],
      [500, 1],
      [200, 1],
      [100, 1],
      [50, 1],
      [20, 1],
      [10, 1],
    ]);
    expect(b.rest).toBe(0);
  });

  it('separa lo que no se puede dar en monedas', () => {
    expect(changeBreakdown(15).rest).toBe(5);
    expect(changeBreakdown(0)).toEqual({ parts: [], rest: 0 });
    expect(changeBreakdown(-100)).toEqual({ parts: [], rest: 0 });
  });

  it('se describe para leerlo en voz alta', () => {
    expect(describeBreakdown(changeBreakdown(2500))).toBe('un billete de 20 soles y una moneda de 5 soles');
    expect(describeBreakdown(changeBreakdown(4050))).toBe('2 billetes de 20 soles y una moneda de 50 céntimos');
  });

  it('dice montos en palabras', () => {
    expect(spokenAmount(47550)).toBe('475 soles con 50 céntimos');
    expect(spokenAmount(100)).toBe('1 sol');
    expect(spokenAmount(50)).toBe('50 céntimos');
  });
});
