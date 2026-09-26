import { describe, expect, it } from 'vitest';
import { formatQty, lineAmount, parseQty, unitStep } from './qty';

const whole = { allowsFraction: false };
const frac = { allowsFraction: true };

describe('qty', () => {
  it('paso de unidad', () => {
    expect(unitStep(whole)).toBe(1);
    expect(unitStep(frac)).toBe(1000);
  });
  it('total de línea', () => {
    expect(lineAmount(whole, 3, 18500)).toBe(55500);
    expect(lineAmount(frac, 1500, 399)).toBe(599); // 1.5 kg × 3.99 = 5.985 → 5.99
  });
  it('formatea y lee cantidades', () => {
    expect(formatQty(frac, 1500)).toBe('1.5');
    expect(formatQty(frac, 2000)).toBe('2');
    expect(formatQty(whole, 7)).toBe('7');
    expect(parseQty(frac, '1,25')).toBe(1250);
    expect(parseQty(whole, '1.5')).toBeNull();
    expect(parseQty(whole, '12')).toBe(12);
  });
});
