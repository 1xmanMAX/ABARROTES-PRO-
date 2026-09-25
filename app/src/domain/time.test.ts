import { describe, expect, it } from 'vitest';
import { dayKeyOf, hourOf } from './time';

describe('time (Lima, UTC−5)', () => {
  it('usa la fecha local de Lima', () => {
    // 2026-09-26 03:00 UTC = 2026-09-25 22:00 en Lima
    const t = Date.UTC(2026, 8, 26, 3, 0);
    expect(dayKeyOf(t)).toBe('2026-09-25');
    expect(hourOf(t)).toBe(22);
  });
});
