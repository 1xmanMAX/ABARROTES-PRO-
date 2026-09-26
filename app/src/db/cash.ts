import { cashBalance, closeDifference } from '../domain/cash';
import { assertCents, formatPEN, type Cents } from '../domain/money';
import { lineAmount } from '../domain/qty';
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

export type ManualCashType = 'withdrawal' | 'contribution' | 'opening';

/**
 * Retiro del dueño (sale), aporte o reinversión (entra) y saldo inicial (entra).
 * Un retiro no es un gasto: no baja la ganancia, solo el efectivo.
 */
export async function registerCashMovement(
  type: ManualCashType,
  amount: Cents,
  method: 'cash' | 'digital',
  note = '',
  now = Date.now(),
): Promise<string> {
  assertCents(amount);
  if (amount <= 0) throw new BusinessError('invalid_amount', 'El monto debe ser mayor a cero.');
  const id = newId();
  await db.transaction('rw', db.cashMovements, async () => {
    if (type === 'withdrawal' && method === 'cash') {
      const balance = cashBalance(await db.cashMovements.toArray(), 'cash');
      if (amount > balance) throw new BusinessError('no_cash', `En caja hay ${formatPEN(balance)}: no alcanza para ese retiro.`);
    }
    await db.cashMovements.add({
      id,
      type,
      method,
      amount: type === 'withdrawal' ? -amount : amount,
      refType: null,
      refId: null,
      note: note.trim(),
      dayKey: dayKeyOf(now),
      createdAt: now,
      voidedAt: null,
    });
  });
  return id;
}

/** Anula un movimiento manual (gasto, retiro, aporte o saldo inicial) con motivo. */
export async function voidManualMovement(id: string, reason: string, now = Date.now()): Promise<void> {
  const m = await db.cashMovements.get(id);
  if (m?.type === 'expense') return voidExpense(id, reason, now);
  const clean = reason.trim();
  if (!clean) throw new BusinessError('reason_required', 'Escribe el motivo.');
  await db.transaction('rw', [db.cashMovements, db.auditLog], async () => {
    const cur = await db.cashMovements.get(id);
    if (!cur || !['withdrawal', 'contribution', 'opening'].includes(cur.type)) {
      throw new BusinessError('not_manual', 'Este movimiento se anula desde su venta, cobro o compra.');
    }
    if (cur.voidedAt) throw new BusinessError('already_void', 'Ya está anulado.');
    await db.cashMovements.update(id, { voidedAt: now, voidReason: clean });
    await db.auditLog.add({
      id: newId(),
      action: 'void_cash_movement',
      entity: 'cashMovement',
      entityId: id,
      detail: JSON.stringify({ reason: clean, type: cur.type, amount: cur.amount }),
      createdAt: now,
    });
  });
}

export interface PurchaseLineInput {
  productId: string;
  qty: number;
  unitCost: Cents;
}

/**
 * Compra de reposición (SPEC §11): suma al stock, resta de la caja y, si se pide
 * (por defecto sí), actualiza el costo del producto. Una transacción.
 */
export async function registerPurchase(
  supplier: string,
  input: PurchaseLineInput[],
  method: 'cash' | 'digital',
  updateCost = true,
  now = Date.now(),
): Promise<string> {
  const lines = input.filter((l) => l.qty > 0);
  if (lines.length === 0) throw new BusinessError('empty', 'Agrega al menos un producto.');
  const purchaseId = newId();
  const dayKey = dayKeyOf(now);
  await db.transaction('rw', [db.products, db.stockMovements, db.purchases, db.purchaseLines, db.cashMovements], async () => {
    let total = 0;
    for (const l of lines) {
      assertCents(l.unitCost);
      if (!Number.isSafeInteger(l.qty) || l.qty <= 0) throw new BusinessError('invalid_qty', 'Cantidad inválida.');
      if (l.unitCost <= 0) throw new BusinessError('invalid_cost', 'Pon el costo de cada producto.');
      const p = await db.products.get(l.productId);
      if (!p) throw new BusinessError('not_found', 'Un producto ya no existe.');
      const lineTotal = lineAmount(p, l.qty, l.unitCost);
      total += lineTotal;
      await db.products.update(p.id, {
        stock: p.stock + l.qty,
        ...(updateCost ? { costPrice: l.unitCost } : {}),
        updatedAt: now,
      });
      await db.stockMovements.add({
        id: newId(),
        productId: p.id,
        delta: l.qty,
        reason: 'purchase',
        refType: 'purchase',
        refId: purchaseId,
        note: supplier.trim(),
        createdAt: now,
      });
      await db.purchaseLines.add({
        id: newId(),
        purchaseId,
        productId: p.id,
        productName: p.name,
        fractional: p.allowsFraction,
        qty: l.qty,
        unitCost: l.unitCost,
        lineTotal,
      });
    }
    await db.purchases.add({
      id: purchaseId,
      supplier: supplier.trim(),
      total,
      method,
      updatedCost: updateCost,
      dayKey,
      createdAt: now,
    });
    await db.cashMovements.add({
      id: newId(),
      type: 'purchase',
      method,
      amount: -total,
      refType: 'purchase',
      refId: purchaseId,
      note: supplier.trim() ? `Compra · ${supplier.trim()}` : 'Compra',
      dayKey,
      createdAt: now,
      voidedAt: null,
    });
  });
  return purchaseId;
}

/**
 * Cierre del día (SPEC §11): el dueño cuenta el efectivo; se guarda la diferencia
 * con lo esperado y un movimiento de ajuste para que la caja quede igual a lo contado.
 */
export async function closeDay(countedCash: Cents, note = '', now = Date.now()): Promise<{ expected: Cents; difference: Cents }> {
  assertCents(countedCash);
  if (countedCash < 0) throw new BusinessError('invalid_amount', 'El monto no puede ser negativo.');
  const dayKey = dayKeyOf(now);
  return db.transaction('rw', [db.cashMovements, db.dayCloses], async () => {
    if (await db.dayCloses.where('dayKey').equals(dayKey).count())
      throw new BusinessError('already_closed', 'Ya cerraste la caja de hoy.');
    const expected = cashBalance(await db.cashMovements.toArray(), 'cash');
    const difference = closeDifference(expected, countedCash);
    const id = newId();
    await db.dayCloses.add({ id, dayKey, expectedCash: expected, countedCash, difference, note: note.trim(), createdAt: now });
    if (difference !== 0) {
      await db.cashMovements.add({
        id: newId(),
        type: 'close_diff',
        method: 'cash',
        amount: difference,
        refType: 'dayClose',
        refId: id,
        note: difference > 0 ? 'Sobrante al cerrar' : 'Faltante al cerrar',
        dayKey,
        createdAt: now,
        voidedAt: null,
      });
    }
    return { expected, difference };
  });
}
