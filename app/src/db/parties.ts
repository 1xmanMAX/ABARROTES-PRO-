import { assertCents, formatPEN, type Cents } from '../domain/money';
import { dayKeyOf } from '../domain/time';
import { BusinessError } from './errors';
import { newId } from './ids';
import { verifyPartyPin } from './pins';
import { db } from './schema';
import { prepareSignature } from './signatures';
import type { Party, PartyRole, Signature } from './types';

export interface PartyInput {
  name: string;
  phone: string;
  roles: PartyRole[];
  creditLimit: Cents;
  birthYear: number | null;
}

function validate(input: PartyInput) {
  if (!input.name.trim()) throw new BusinessError('name_required', 'El nombre es obligatorio.');
  if (input.roles.length === 0) throw new BusinessError('role_required', 'Elige si es cliente, vendedor o ambos.');
  if (!Number.isSafeInteger(input.creditLimit) || input.creditLimit < 0) {
    throw new BusinessError('invalid_limit', 'El límite de crédito no es válido.');
  }
}

export async function createParty(input: PartyInput, now = Date.now()): Promise<string> {
  validate(input);
  const id = newId();
  await db.parties.add({
    id,
    name: input.name.trim(),
    phone: input.phone.trim(),
    roles: [...new Set(input.roles)],
    creditLimit: input.creditLimit,
    balance: 0,
    pin: null,
    birthYear: input.birthYear,
    specialPrices: {},
    active: true,
    lastUsedAt: now,
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

export async function updateParty(id: string, input: PartyInput & { specialPrices?: Record<string, Cents>; active?: boolean }) {
  validate(input);
  await db.transaction('rw', db.parties, async () => {
    const p = await db.parties.get(id);
    if (!p) throw new BusinessError('not_found', 'Persona no encontrada.');
    await db.parties.put({
      ...p,
      name: input.name.trim(),
      phone: input.phone.trim(),
      roles: [...new Set(input.roles)],
      creditLimit: input.creditLimit,
      birthYear: input.birthYear,
      specialPrices: input.specialPrices ?? p.specialPrices,
      active: input.active ?? p.active,
      updatedAt: Date.now(),
    });
  });
}

/**
 * Cobra una deuda (SPEC §7). La persona firma con su código ANTES de abrir la
 * transacción. Registra el abono, el movimiento de caja y la firma.
 */
export async function receiveDebtPayment(
  partyId: string,
  amount: Cents,
  method: 'cash' | 'digital',
  pinAttempt: string,
  now = Date.now(),
): Promise<Signature> {
  assertCents(amount);
  if (amount <= 0) throw new BusinessError('invalid_amount', 'El monto debe ser mayor a cero.');
  const party = await db.parties.get(partyId);
  if (!party) throw new BusinessError('not_found', 'Persona no encontrada.');
  if (amount > party.balance)
    throw new BusinessError('over_balance', `No puede pagar más de lo que debe (${formatPEN(party.balance)}).`);

  await verifyPartyPin(partyId, pinAttempt, now);
  const sig = await prepareSignature({
    partyId,
    partyName: party.name,
    purpose: 'debt_payment',
    amount,
    concept: 'Pago de deuda',
    lines: [],
    previousBalance: party.balance,
    newBalance: party.balance - amount,
    refType: 'ledger',
    refId: newId(),
    createdAt: now,
  });

  await db.transaction('rw', [db.parties, db.ledgerEntries, db.signatures, db.cashMovements], async () => {
    const p = await db.parties.get(partyId);
    if (!p || p.balance !== sig.previousBalance) throw new BusinessError('balance_changed', 'El saldo cambió. Intenta otra vez.');
    await db.signatures.add(sig);
    await db.ledgerEntries.add({
      id: sig.refId,
      partyId,
      type: 'payment',
      amount,
      method,
      sourceType: 'payment',
      sourceId: null,
      signatureId: sig.id,
      note: `Pago ${method === 'cash' ? 'en efectivo' : 'por Yape/Plin'}`,
      createdAt: now,
      voidedAt: null,
    });
    await db.parties.update(partyId, { balance: sig.newBalance, lastUsedAt: now, updatedAt: now });
    await db.cashMovements.add({
      id: newId(),
      type: 'debt_payment',
      method,
      amount,
      refType: 'ledger',
      refId: sig.refId,
      note: `Cobro de deuda · ${p.name}`,
      dayKey: dayKeyOf(now),
      createdAt: now,
      voidedAt: null,
    });
  });
  return sig;
}

export interface HistoryItem {
  id: string;
  at: number;
  kind: 'charge' | 'payment' | 'adjustment' | 'event';
  label: string;
  amount: Cents | null;
  signatureId: string | null;
  voided: boolean;
}

/** Historial cronológico: cuenta corriente y eventos del código. */
export async function getPartyHistory(partyId: string): Promise<HistoryItem[]> {
  const [entries, audit, receipts] = await Promise.all([
    db.ledgerEntries.where('partyId').equals(partyId).toArray(),
    db.auditLog.where('entityId').equals(partyId).toArray(),
    db.signatures
      .where('partyId')
      .equals(partyId)
      .filter((sg) => sg.purpose === 'consignment_receipt')
      .toArray(),
  ]);
  const items: HistoryItem[] = [
    ...entries.map((e) => ({
      id: e.id,
      at: e.createdAt,
      kind: e.type,
      label: e.note,
      amount: e.amount,
      signatureId: e.signatureId,
      voided: !!e.voidedAt,
    })),
    ...audit.map((a) => ({
      id: a.id,
      at: a.createdAt,
      kind: 'event' as const,
      label: a.detail,
      amount: null,
      signatureId: null,
      voided: false,
    })),
    // Entregas de mercadería: no son deuda, pero quedan en el historial con su comprobante.
    ...receipts.map((sg) => ({
      id: sg.id,
      at: sg.createdAt,
      kind: 'event' as const,
      label: 'Recibió mercadería',
      amount: sg.amount,
      signatureId: sg.id,
      voided: false,
    })),
  ];
  return items.sort((a, b) => b.at - a.at);
}

export function isSeller(p: Pick<Party, 'roles'>) {
  return p.roles.includes('seller');
}
