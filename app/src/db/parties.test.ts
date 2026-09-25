import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createParty, getPartyHistory, receiveDebtPayment } from './parties';
import { setOwnerPin, setPartyPin, setPinIterationsForTests, unlockPartyPin, verifyPartyPin } from './pins';
import { createProduct, type ProductInput } from './products';
import { db, resetDbForTests } from './schema';
import { verifySignature } from './signatures';
import { checkoutOnCredit, checkoutTicket, openTicket, saveOpenTicketLines, voidTicket } from './tickets';

const base: ProductInput = {
  name: 'Arroz',
  baseName: 'Arroz',
  unit: 'saco',
  allowsFraction: false,
  category: '',
  salePrice: 18500,
  costPrice: 16500,
  sellerPrice: null,
  minStock: 0,
  photo: null,
  pinnedPosition: null,
  active: true,
};
const line = (productId: string, qty: number) => ({ productId, qty, priceOverride: null, priceOverrideReason: null });

beforeAll(() => setPinIterationsForTests(1000));
let n = 0;
beforeEach(async () => {
  resetDbForTests(`parties-${++n}`);
  await setOwnerPin('9753');
});

async function rosa(limit = 100000) {
  const id = await createParty({
    name: 'Rosa Mamani',
    phone: '987654321',
    roles: ['client'],
    creditLimit: limit,
    birthYear: 1985,
  });
  await setPartyPin(id, '2580');
  return id;
}
async function ticketWith(productId: string, qty: number) {
  const t = await openTicket();
  await saveOpenTicketLines(t.id, [line(productId, qty)]);
  return t.id;
}

describe('fiado', () => {
  it('con código correcto: ticket credit, stock, cargo, saldo, firma; no entra a caja', async () => {
    const arroz = await createProduct(base, 10);
    const r = await rosa();
    const tid = await ticketWith(arroz, 2);
    const { ticket, signature } = await checkoutOnCredit(tid, r, '2580');
    expect(ticket).toMatchObject({ status: 'credit', partyId: r, partyName: 'Rosa Mamani', total: 37000 });
    expect((await db.products.get(arroz))!.stock).toBe(8);
    expect((await db.parties.get(r))!.balance).toBe(37000);
    expect(await db.cashMovements.count()).toBe(0);
    expect(signature).toMatchObject({ purpose: 'credit_sale', amount: 37000, previousBalance: 0, newBalance: 37000 });
    expect(signature.operationCode).toMatch(/^MB-\d{4}-[0-9A-Z]{4}$/);
    expect(await verifySignature((await db.signatures.get(signature.id))!)).toBe(true);
    // Si alguien altera el registro firmado, se detecta.
    await db.signatures.update(signature.id, { amount: 100 });
    expect(await verifySignature((await db.signatures.get(signature.id))!)).toBe(false);
  });

  it('código incorrecto: no se guarda nada y dice cuántos intentos quedan', async () => {
    const arroz = await createProduct(base, 10);
    const r = await rosa();
    const tid = await ticketWith(arroz, 1);
    await expect(checkoutOnCredit(tid, r, '1111')).rejects.toThrow('quedan 2 intentos');
    expect((await db.tickets.get(tid))!.status).toBe('open');
    expect((await db.parties.get(r))!.balance).toBe(0);
    expect(await db.signatures.count()).toBe(0);
  });

  it('sobre el límite exige el código de dueño y queda en auditoría', async () => {
    const arroz = await createProduct(base, 10);
    const r = await rosa(20000);
    const tid = await ticketWith(arroz, 2);
    await expect(checkoutOnCredit(tid, r, '2580')).rejects.toThrow('código de dueño');
    await expect(checkoutOnCredit(tid, r, '2580', { ownerPin: '0000' })).rejects.toThrow('incorrecto');
    await checkoutOnCredit(tid, r, '2580', { ownerPin: '9753' });
    expect(await db.auditLog.where('action').equals('credit_limit_override').count()).toBe(1);
  });

  it('sin código la persona no puede recibir fiado', async () => {
    const arroz = await createProduct(base, 10);
    const id = await createParty({ name: 'Sin código', phone: '', roles: ['client'], creditLimit: 100000, birthYear: null });
    await expect(checkoutOnCredit(await ticketWith(arroz, 1), id, '2580')).rejects.toThrow('todavía no tiene código');
  });

  it('anular un fiado repone stock y quita la deuda', async () => {
    const arroz = await createProduct(base, 10);
    const r = await rosa();
    const tid = await ticketWith(arroz, 2);
    await checkoutOnCredit(tid, r, '2580');
    await voidTicket(tid, 'error de cliente');
    expect((await db.parties.get(r))!.balance).toBe(0);
    expect((await db.products.get(arroz))!.stock).toBe(10);
    const entries = await db.ledgerEntries.toArray();
    expect(entries[0]!.voidedAt).not.toBeNull();
  });

  it('anular ventas de días anteriores pide el código de dueño', async () => {
    const arroz = await createProduct(base, 10);
    const tid = await ticketWith(arroz, 1);
    await checkoutTicket(tid, { method: 'cash', cashReceived: 18500 }, Date.now() - 3 * 86_400_000);
    await expect(voidTicket(tid, 'x')).rejects.toThrow('código de dueño');
    await expect(voidTicket(tid, 'x', '1357')).rejects.toThrow('incorrecto');
    await voidTicket(tid, 'x', '9753');
    expect((await db.tickets.get(tid))!.status).toBe('void');
  });
});

describe('cobro de deuda', () => {
  it('abono firmado, caja y comprobante; no más que el saldo', async () => {
    const arroz = await createProduct(base, 10);
    const r = await rosa();
    await checkoutOnCredit(await ticketWith(arroz, 2), r, '2580');
    await expect(receiveDebtPayment(r, 40000, 'cash', '2580')).rejects.toThrow('más de lo que debe');
    await expect(receiveDebtPayment(r, 10000, 'cash', '0001')).rejects.toThrow('incorrecto');
    const sig = await receiveDebtPayment(r, 10000, 'cash', '2580');
    expect(sig).toMatchObject({ purpose: 'debt_payment', amount: 10000, previousBalance: 37000, newBalance: 27000 });
    expect((await db.parties.get(r))!.balance).toBe(27000);
    const cash = await db.cashMovements.toArray();
    expect(cash).toHaveLength(1);
    expect(cash[0]).toMatchObject({ type: 'debt_payment', amount: 10000, method: 'cash' });
    const history = await getPartyHistory(r);
    expect(history.map((h) => h.kind)).toEqual(['payment', 'charge', 'event']);
  });
});

describe('código personal', () => {
  it('rechaza triviales y el año de nacimiento; cambiarlo exige el código de dueño', async () => {
    const id = await createParty({ name: 'Juan', phone: '', roles: ['seller'], creditLimit: 0, birthYear: 1990 });
    await expect(setPartyPin(id, '1111')).rejects.toThrow('fácil');
    await expect(setPartyPin(id, '1990')).rejects.toThrow('nacimiento');
    await setPartyPin(id, '4826');
    await expect(setPartyPin(id, '7391')).rejects.toThrow('código de dueño');
    await setPartyPin(id, '7391', '9753');
    await verifyPartyPin(id, '7391');
    const stored = JSON.stringify(await db.parties.get(id));
    expect(stored).not.toContain('7391');
    expect(await db.auditLog.where('action').equals('pin_changed').count()).toBe(1);
  });

  it('3 fallos bloquean; 6 exigen al dueño, que puede desbloquear', async () => {
    const r = await rosa();
    const t0 = Date.now();
    for (let i = 0; i < 2; i++) await expect(verifyPartyPin(r, '0001', t0)).rejects.toThrow('incorrecto');
    await expect(verifyPartyPin(r, '0001', t0)).rejects.toThrow('Bloqueado por 5 minutos');
    await expect(verifyPartyPin(r, '2580', t0 + 1000)).rejects.toThrow('bloqueado');
    const later = t0 + 6 * 60_000;
    for (let i = 0; i < 2; i++) await expect(verifyPartyPin(r, '0001', later)).rejects.toThrow('incorrecto');
    await expect(verifyPartyPin(r, '0001', later)).rejects.toThrow('Solo el dueño');
    await expect(verifyPartyPin(r, '2580', later + 3_600_000)).rejects.toThrow('Solo el dueño');
    await unlockPartyPin(r, '9753');
    await verifyPartyPin(r, '2580');
  });
});
