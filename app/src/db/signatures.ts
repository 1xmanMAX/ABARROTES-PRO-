import { generateOperationCode, payloadHash } from '../domain/operationCode';
import { dayKeyOf } from '../domain/time';
import { newId } from './ids';
import { db } from './schema';
import type { Signature } from './types';

export type SignatureInput = Omit<Signature, 'id' | 'operationCode' | 'payloadHash'>;

function hashInput(sig: Omit<Signature, 'id' | 'payloadHash'>) {
  return payloadHash({
    purpose: sig.purpose,
    partyId: sig.partyId,
    amount: sig.amount,
    lines: [...sig.lines, { previousBalance: sig.previousBalance, newBalance: sig.newBalance, concept: sig.concept }],
    createdAt: sig.createdAt,
    operationCode: sig.operationCode,
  });
}

/**
 * Prepara una firma (n.º de operación único + hash). Se llama ANTES de abrir la
 * transacción, porque el hash usa WebCrypto (asíncrono). El n.º de operación se
 * vuelve a comprobar dentro de la transacción con el índice único.
 */
export async function prepareSignature(input: SignatureInput): Promise<Signature> {
  const monthDay = dayKeyOf(input.createdAt).slice(5).replace('-', '');
  for (let attempt = 0; attempt < 10; attempt++) {
    const operationCode = generateOperationCode(monthDay);
    if (await db.signatures.where('operationCode').equals(operationCode).count()) continue;
    const base = { ...input, operationCode };
    return { ...base, id: newId(), payloadHash: await hashInput(base) };
  }
  throw new Error('No se pudo generar un n.º de operación único');
}

/** Recalcula el hash para mostrar "Íntegro" o "Modificado" en el comprobante. */
export async function verifySignature(sig: Signature): Promise<boolean> {
  const { id: _id, payloadHash: stored, ...rest } = sig;
  void _id;
  return (await hashInput(rest)) === stored;
}
