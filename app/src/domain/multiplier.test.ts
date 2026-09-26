import { describe, expect, it } from 'vitest';
import { consumeMultiplier, MULTIPLIER_DEFAULT, pressMultiplier } from './multiplier';

describe('multiplier', () => {
  it('×5 aplica una vez y vuelve a ×1', () => {
    const s = pressMultiplier(MULTIPLIER_DEFAULT, 5);
    expect(s).toEqual({ value: 5, locked: false });
    expect(consumeMultiplier(s)).toEqual(MULTIPLIER_DEFAULT);
  });
  it('dos toques fijan el candado y un tercero lo suelta', () => {
    let s = pressMultiplier(pressMultiplier(MULTIPLIER_DEFAULT, 10), 10);
    expect(s).toEqual({ value: 10, locked: true });
    expect(consumeMultiplier(s)).toEqual(s);
    s = pressMultiplier(s, 10);
    expect(s).toEqual(MULTIPLIER_DEFAULT);
  });
  it('cambiar de valor quita el candado', () => {
    const locked = pressMultiplier(pressMultiplier(MULTIPLIER_DEFAULT, 5), 5);
    expect(pressMultiplier(locked, 10)).toEqual({ value: 10, locked: false });
    expect(pressMultiplier(locked, 1)).toEqual(MULTIPLIER_DEFAULT);
  });
});
