import { describe, expect, it } from 'vitest';
import {
  attemptsLeft,
  createPinRecord,
  ownerUnlock,
  pinMatches,
  pinStatus,
  registerFailure,
  registerSuccess,
  validateNewPin,
} from './pin';

const NOW = Date.UTC(2026, 8, 25, 15);

describe('código personal', () => {
  it('rechaza códigos triviales y el año de nacimiento', () => {
    for (const p of ['0000', '1111', '9999', '1234', '4321', '0123']) expect(validateNewPin(p)).toBe('trivial');
    expect(validateNewPin('123')).toBe('length');
    expect(validateNewPin('12a4')).toBe('length');
    expect(validateNewPin('1985', 1985)).toBe('birth_year');
    expect(validateNewPin('2580')).toBeNull();
  });

  it('guarda solo el hash y verifica', async () => {
    const r = await createPinRecord('2580', NOW, 1000);
    expect(JSON.stringify(r)).not.toContain('2580');
    expect(r.salt).toHaveLength(24);
    expect(await pinMatches(r, '2580')).toBe(true);
    expect(await pinMatches(r, '2581')).toBe(false);
    expect(await pinMatches(r, '25')).toBe(false);
    const r2 = await createPinRecord('2580', NOW, 1000);
    expect(r2.hash).not.toBe(r.hash); // sal distinta
  });

  it('3 fallos bloquean 5 minutos; 6 en 24 h exigen al dueño; un acierto reinicia', async () => {
    let r = await createPinRecord('2580', NOW, 1000);
    r = registerFailure(r, NOW);
    expect(attemptsLeft(r)).toBe(2);
    r = registerFailure(registerFailure(r, NOW), NOW);
    expect(pinStatus(r, NOW + 1000)).toEqual({ kind: 'locked', until: NOW + 5 * 60_000 });
    expect(pinStatus(r, NOW + 5 * 60_000 + 1).kind).toBe('ok');
    r = registerFailure(registerFailure(registerFailure(r, NOW + 400_000), NOW + 400_000), NOW + 400_000);
    expect(pinStatus(r, NOW + 10 * 3_600_000)).toEqual({ kind: 'owner_reset' });
    expect(pinStatus(ownerUnlock(r), NOW).kind).toBe('ok');

    let s = registerFailure(registerFailure(await createPinRecord('2580', NOW, 1000), NOW), NOW);
    s = registerSuccess(s);
    expect(s.failedCount).toBe(0);
    expect(attemptsLeft(s)).toBe(3);
  });

  it('los fallos de hace más de 24 h no cuentan', async () => {
    let r = await createPinRecord('2580', NOW, 1000);
    for (let i = 0; i < 5; i++) r = registerFailure(r, NOW);
    r = registerFailure(r, NOW + 25 * 3_600_000);
    expect(r.failedCount).toBe(1);
    expect(r.requiresOwnerReset).toBe(false);
  });
});
