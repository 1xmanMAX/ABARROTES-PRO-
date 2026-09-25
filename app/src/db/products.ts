import type { Cents } from '../domain/money';
import type { Qty } from '../domain/qty';
import { tileColorFor } from '../domain/tileColor';
import { BusinessError } from './errors';
import { newId } from './ids';
import { db } from './schema';
import type { ProductUnit } from './types';

export interface ProductInput {
  name: string;
  baseName: string;
  unit: ProductUnit;
  allowsFraction: boolean;
  category: string;
  salePrice: Cents;
  costPrice: Cents;
  sellerPrice: Cents | null;
  minStock: Qty;
  photo: Blob | null;
  pinnedPosition: number | null;
  active: boolean;
}

function validate(input: ProductInput): void {
  if (!input.name.trim()) throw new BusinessError('name_required', 'El nombre es obligatorio.');
  for (const v of [input.salePrice, input.costPrice, input.minStock]) {
    if (!Number.isSafeInteger(v) || v < 0) throw new BusinessError('invalid_amount', 'Revisa los montos y cantidades.');
  }
  if (input.salePrice <= 0) throw new BusinessError('price_required', 'El precio de venta debe ser mayor a cero.');
  if (input.pinnedPosition != null && (!Number.isInteger(input.pinnedPosition) || input.pinnedPosition < 1)) {
    throw new BusinessError('invalid_pin_position', 'La posición fijada debe ser 1 o más.');
  }
}

/** Crea el producto y registra su stock inicial como movimiento. */
export async function createProduct(input: ProductInput, initialStock: Qty = 0): Promise<string> {
  validate(input);
  if (!Number.isSafeInteger(initialStock) || initialStock < 0) {
    throw new BusinessError('invalid_stock', 'El stock inicial no es válido.');
  }
  const now = Date.now();
  const id = newId();
  await db.transaction('rw', [db.products, db.stockMovements], async () => {
    await db.products.add({
      ...input,
      name: input.name.trim(),
      baseName: input.baseName.trim() || input.name.trim(),
      id,
      stock: initialStock,
      consignedQty: 0,
      tileColor: tileColorFor(id),
      createdAt: now,
      updatedAt: now,
    });
    if (initialStock > 0) {
      await db.stockMovements.add({
        id: newId(),
        productId: id,
        delta: initialStock,
        reason: 'adjustment',
        refType: null,
        refId: null,
        note: 'Stock inicial',
        createdAt: now,
      });
    }
  });
  return id;
}

/** Edita los datos del producto. El stock no se edita aquí (usar adjustStock). */
export async function updateProduct(id: string, input: ProductInput): Promise<void> {
  validate(input);
  await db.transaction('rw', db.products, async () => {
    const p = await db.products.get(id);
    if (!p) throw new BusinessError('not_found', 'Producto no encontrado.');
    await db.products.put({
      ...p,
      ...input,
      name: input.name.trim(),
      baseName: input.baseName.trim() || input.name.trim(),
      updatedAt: Date.now(),
    });
  });
}

export type AdjustReason = 'conteo' | 'merma' | 'regalo' | 'otro';

/**
 * Ajuste de stock con motivo. Queda como movimiento y en el registro de auditoría.
 * `delta` con signo: + entra, − sale.
 */
export async function adjustStock(productId: string, delta: Qty, reason: AdjustReason, note = ''): Promise<void> {
  if (!Number.isSafeInteger(delta) || delta === 0) throw new BusinessError('invalid_delta', 'La cantidad no es válida.');
  const now = Date.now();
  await db.transaction('rw', [db.products, db.stockMovements, db.auditLog], async () => {
    const p = await db.products.get(productId);
    if (!p) throw new BusinessError('not_found', 'Producto no encontrado.');
    if (p.stock + delta < 0) throw new BusinessError('negative_stock', 'El stock no puede quedar negativo.');
    await db.products.update(productId, { stock: p.stock + delta, updatedAt: now });
    const movementId = newId();
    await db.stockMovements.add({
      id: movementId,
      productId,
      delta,
      reason: 'adjustment',
      refType: 'adjustment',
      refId: reason,
      note: note || reason,
      createdAt: now,
    });
    await db.auditLog.add({
      id: newId(),
      action: 'stock_adjustment',
      entity: 'product',
      entityId: productId,
      detail: JSON.stringify({ delta, reason, note, before: p.stock, after: p.stock + delta }),
      createdAt: now,
    });
  });
}
