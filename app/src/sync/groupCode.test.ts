import { describe, expect, it } from 'vitest';
import { cleanGroupCode, isGroupCode } from './groupCode';

describe('código del grupo', () => {
  it('acepta minúsculas, espacios y guiones', () => {
    expect(cleanGroupCode('k7q2m 9xmpa')).toBe('K7Q2M-9XMPA');
    expect(cleanGroupCode('K7Q2M-9XMPA')).toBe('K7Q2M-9XMPA');
    expect(cleanGroupCode('k7q2m9xmpa')).toBe('K7Q2M-9XMPA');
  });
  it('se arma mientras se escribe y no pasa de 10 caracteres', () => {
    expect(cleanGroupCode('k7q')).toBe('K7Q');
    expect(cleanGroupCode('k7q2m9')).toBe('K7Q2M-9');
    expect(cleanGroupCode('k7q2m9xmpaZZZ')).toBe('K7Q2M-9XMPA');
  });
  it('solo vale completo', () => {
    expect(isGroupCode('K7Q2M-9XMPA')).toBe(true);
    expect(isGroupCode('K7Q2M-9XMP')).toBe(false);
  });
});
