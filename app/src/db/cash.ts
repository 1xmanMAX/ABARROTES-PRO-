import { assertCents, type Cents } from '../domain/money';
import { dayKeyOf } from '../domain/time';
import { BusinessError } from './errors';
import { newId } from './ids';
import { db } from './schema';

export const EXPENSE_CATEGORIES = ['transporte', 'estiba', 'bolsas', 'comida', 'servicios', 'otros'] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

/** Registra un gasto: sale de caja (efectivo o Yape). */
export async function registerExpense(
  amount: Cents,
  category: ExpenseCategory,
  method: 'cash' | 'digital',
  note = '',
  now = Date.now(),
): Promise<string> {
  assertCents(amount);
  if (amount <= 0) throw new BusinessError('invalid_amount', 'El monto debe ser mayor a cero.');
  const id = newId();
  await db.cashMovements.add({
    id,
    type: 'expense',
    method,
    amount: -amount,
    refType: null,
    refId: null,
    note: note.trim(),
    category,
    dayKey: dayKeyOf(now),
    createdAt: now,
    voidedAt: null,
  });
  return id;
}

/** Anula un gasto mal registrado (queda el rastro). */
export async function voidExpense(id: string, reason: string, now = Date.now()): Promise<void> {
  const clean = reason.trim();
  if (!clean) throw new BusinessError('reason_required', 'Escribe el motivo.');
  await db.transaction('rw', [db.cashMovements, db.auditLog], async () => {
    const m = await db.cashMovements.get(id);
    if (!m || m.type !== 'expense') throw new BusinessError('not_found', 'Gasto no encontrado.');
    if (m.voidedAt) throw new BusinessError('already_void', 'Ya está anulado.');
    await db.cashMovements.update(id, { voidedAt: now, voidReason: clean });
    await db.auditLog.add({
      id: newId(),
      action: 'void_expense',
      entity: 'cashMovement',
      entityId: id,
      detail: JSON.stringify({ reason: clean, amount: m.amount }),
      createdAt: now,
    });
  });
}
