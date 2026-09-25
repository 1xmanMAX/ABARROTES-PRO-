import { describe, expect, it } from 'vitest';
import { checkCredit, computeBalance, whatsappNumber } from './balances';
import { canonicalJson, generateOperationCode, isOperationCode, payloadHash } from './operationCode';

describe('n.º de operación y firma', () => {
  it('formato MB-MMDD-XXXX sin I, L, O, U', () => {
    for (let i = 0; i < 200; i++) {
      const c = generateOperationCode('0926');
      expect(isOperationCode(c)).toBe(true);
      expect(c.slice(8)).not.toMatch(/[ILOU]/);
    }
    expect(generateOperationCode('0101', () => new Uint8Array([0, 31, 18, 27]))).toBe('MB-0101-0ZJV');
  });
  it('JSON canónico y hash estable', async () => {
    expect(canonicalJson({ b: 1, a: [2, { d: 1, c: 2 }] })).toBe('{"a":[2,{"c":2,"d":1}],"b":1}');
    const p = { purpose: 'credit_sale', partyId: 'x', amount: 100, lines: [], createdAt: 1, operationCode: 'MB-0101-0000' };
    const h1 = await payloadHash(p);
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
    expect(await payloadHash({ ...p })).toBe(h1);
    expect(await payloadHash({ ...p, amount: 101 })).not.toBe(h1);
  });
});

describe('saldos', () => {
  it('cargos, pagos, ajustes y anulados', () => {
    expect(
      computeBalance([
        { type: 'charge', amount: 1000 },
        { type: 'payment', amount: 300 },
        { type: 'adjustment', amount: -50 },
        { type: 'charge', amount: 999, voidedAt: 5 },
      ]),
    ).toBe(650);
  });
  it('límite de crédito', () => {
    expect(checkCredit(24000, 100000, 47800)).toEqual({ newBalance: 71800, overLimit: false, excess: 0 });
    expect(checkCredit(70000, 100000, 47800)).toEqual({ newBalance: 117800, overLimit: true, excess: 17800 });
    expect(checkCredit(0, 0, 100).overLimit).toBe(true);
  });
  it('WhatsApp con código de Perú', () => {
    expect(whatsappNumber('987 654 321')).toBe('51987654321');
    expect(whatsappNumber('+51 987654321')).toBe('51987654321');
    expect(whatsappNumber('')).toBeNull();
  });
});
