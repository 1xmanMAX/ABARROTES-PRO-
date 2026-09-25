import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { create } from 'zustand';
import { applyGridOrder, computeGridOrder } from '../domain/gridOrder';
import { decayed } from '../domain/stats';
import { dayKeyOf } from '../domain/time';
import { db } from '../db/schema';
import { DEFAULT_SETTINGS, getSettings, updateSettings } from '../db/settings';
import type { Product, Settings } from '../db/types';

const NO_PRODUCTS: Product[] = [];

export function useProducts(): Product[] {
  return useLiveQuery(() => db.products.toArray(), []) ?? NO_PRODUCTS;
}

export function useProductMap(products: Product[]): Map<string, Product> {
  return useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
}

export function useSettings(): Settings {
  return useLiveQuery(() => db.settings.get('main'), []) ?? DEFAULT_SETTINGS;
}

/**
 * Snapshot del orden de la cuadrícula. La UI lo lee y NO lo recalcula en caliente
 * (SPEC §2.2). Los productos nuevos van al final hasta el próximo recálculo.
 */
export const useGridOrder = create<{ order: string[] }>(() => ({ order: [] }));

/**
 * Recalcula el orden por unidades vendidas con decaimiento (DATA_MODEL §4.1) y
 * lo guarda. Solo se llama cuando ningún ticket tiene productos (SPEC §2.2).
 */
export async function recomputeGridOrder(now = Date.now()): Promise<void> {
  const products = await db.products.filter((p) => p.active).toArray();
  const stats = new Map((await db.productStats.toArray()).map((s) => [s.productId, s]));
  const order = computeGridOrder(
    products.map((p) => {
      const s = stats.get(p.id);
      return { ...p, score: s ? decayed(s.decayedQty, s.lastSoldAt, now) : 0 };
    }),
  );
  await updateSettings({ gridOrder: order, gridOrderComputedAt: now });
  useGridOrder.setState({ order });
}

/** SPEC §2.2 (b): al empezar un día nuevo, reordenar en cuanto no haya tickets con productos. */
export async function recomputeIfNewDay(ticketsBusy: boolean, now = Date.now()): Promise<boolean> {
  if (ticketsBusy) return false;
  const s = await getSettings();
  if (s.gridOrderComputedAt !== null && dayKeyOf(s.gridOrderComputedAt) === dayKeyOf(now)) return false;
  await recomputeGridOrder(now);
  return true;
}

export async function loadGridOrder(): Promise<void> {
  const s = await getSettings();
  useGridOrder.setState({ order: s.gridOrder });
}

export function useOrderedSellProducts(products: Product[]): Product[] {
  const order = useGridOrder((s) => s.order);
  return useMemo(
    () =>
      applyGridOrder(
        order,
        products.filter((p) => p.active),
      ),
    [order, products],
  );
}
