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

describe('rangos de días', () => {
  it('últimos días y días entre fechas', async () => {
    const { lastDayKeys, daysBetween } = await import('./time');
    const t = Date.UTC(2026, 2, 2, 3, 0); // 1 de marzo, 22:00 en Lima
    expect(lastDayKeys(3, t)).toEqual(['2026-02-27', '2026-02-28', '2026-03-01']);
    expect(daysBetween('2026-02-27', '2026-03-01')).toBe(3);
  });
});
