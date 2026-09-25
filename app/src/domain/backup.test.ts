import { describe, expect, it } from 'vitest';
import { backupDue, decryptBackup, encryptBackup, parseEnvelope } from './backup';

const meta = { schemaVersion: 5, createdAt: 1, summary: { products: 2 } };

describe('respaldo cifrado', () => {
  it('ida y vuelta con el código correcto', async () => {
    const data = { products: [{ id: 'a', name: 'Arroz', price: 18500 }], text: 'ñandú ✓' };
    const env = await encryptBackup(data, '9753', meta, 1000);
    const text = JSON.stringify(env);
    expect(text).not.toContain('Arroz');
    expect(await decryptBackup(parseEnvelope(text), '9753')).toEqual(data);
  });

  it('código incorrecto o archivo alterado fallan', async () => {
    const env = await encryptBackup({ a: 1 }, '9753', meta, 1000);
    await expect(decryptBackup(env, '1111')).rejects.toThrow('Código incorrecto');
    const tampered = { ...env, data: env.data.slice(0, -4) + (env.data.endsWith('AAAA') ? 'BBBB' : 'AAAA') };
    await expect(decryptBackup(tampered, '9753')).rejects.toThrow();
  });

  it('rechaza archivos que no son respaldos o de un formato más nuevo', () => {
    expect(() => parseEnvelope('hola')).toThrow('no es un respaldo');
    expect(() => parseEnvelope('{"app":"otra"}')).toThrow('no es un respaldo');
    expect(() => parseEnvelope(JSON.stringify({ app: 'mi-bodega', format: 99, data: 'x', kdf: {}, cipher: {} }))).toThrow(
      'más nueva',
    );
  });

  it('recordatorio semanal', () => {
    const now = 100 * 86_400_000;
    expect(backupDue(null, true, now)).toBe(true);
    expect(backupDue(null, false, now)).toBe(false);
    expect(backupDue(now - 3 * 86_400_000, true, now)).toBe(false);
    expect(backupDue(now - 8 * 86_400_000, true, now)).toBe(true);
  });
});
