import { describe, expect, it } from 'vitest';
import { distributeDiscount, haggleOptions } from './haggle';

describe('rebaja por regateo', () => {
  it('opciones de S/ 1 a S/ 5 sin pasar el total rebajable', () => {
    expect(haggleOptions(500, 47800)).toEqual([100, 200, 300, 400, 500]);
    expect(haggleOptions(300, 47800)).toEqual([100, 200, 300]);
    expect(haggleOptions(500, 350)).toEqual([100, 200, 300]);
  });
  it('reparte en céntimos exactos solo entre las líneas que admiten rebaja', () => {
    const shares = distributeDiscount(
      [
        { lineTotal: 37000, eligible: true },
        { lineTotal: 10800, eligible: false },
        { lineTotal: 16000, eligible: true },
      ],
      500,
    );
    expect(shares.reduce((a, b) => a + b, 0)).toBe(500);
    expect(shares[1]).toBe(0);
    expect(shares).toEqual([350, 0, 150]);
    expect(() => distributeDiscount([{ lineTotal: 100, eligible: true }], 100)).toThrow();
  });
});
