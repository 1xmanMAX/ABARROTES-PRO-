import { describe, expect, it } from 'vitest';
import { billSuggestions, centsToInput, computeChange, formatPEN, parseSolesToCents } from './money';

describe('money', () => {
  it('formatea soles', () => {
    expect(formatPEN(123450)).toBe('S/ 1,234.50');
    expect(formatPEN(5)).toBe('S/ 0.05');
    expect(formatPEN(-2000)).toBe('−S/ 20.00');
    expect(formatPEN(100, { sign: true })).toBe('+S/ 1.00');
  });

  it('rechaza montos no enteros', () => {
    expect(() => formatPEN(1.5)).toThrow();
  });

  it('convierte texto a céntimos sin flotantes', () => {
    expect(parseSolesToCents('185')).toBe(18500);
    expect(parseSolesToCents('172.8')).toBe(17280);
    expect(parseSolesToCents('0.10')).toBe(10);
    expect(parseSolesToCents('1,234.56')).toBe(123456);
    expect(parseSolesToCents('S/ 5.5')).toBe(550);
    expect(parseSolesToCents('1.234')).toBeNull();
    expect(parseSolesToCents('abc')).toBeNull();
    expect(parseSolesToCents('')).toBeNull();
    expect(centsToInput(17280)).toBe('172.80');
  });

  it('calcula vuelto', () => {
    expect(computeChange(47800, 50000)).toBe(2200);
    expect(computeChange(47800, 47000)).toBe(-800);
  });

  it('sugiere billetes', () => {
    expect(billSuggestions(47800)).toEqual([48000, 50000, 60000]);
    expect(billSuggestions(3240)).toEqual([4000, 5000, 10000]);
    expect(billSuggestions(10000)).toEqual([20000]);
    expect(billSuggestions(20000)).toEqual([]);
    expect(billSuggestions(0)).toEqual([]);
  });
});
