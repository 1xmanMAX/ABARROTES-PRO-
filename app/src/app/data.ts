import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { create } from 'zustand';
import { applyGridOrder, computeGridOrder } from '../domain/gridOrder';
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

/** Recalcula el orden y lo guarda (al abrir la app o con "Reordenar"). */
export async function recomputeGridOrder(): Promise<void> {
  const products = await db.products.filter((p) => p.active).toArray();
  const order = computeGridOrder(products);
  await updateSettings({ gridOrder: order, gridOrderComputedAt: Date.now() });
  useGridOrder.setState({ order });
}

export async function loadGridOrder(): Promise<void> {
  const s = await getSettings();
  useGridOrder.setState({ order: s.gridOrder });
}

export function useOrderedSellProducts(products: Product[]): Product[] {
  const order = useGridOrder((s) => s.order);
  return useMemo(() => applyGridOrder(order, products.filter((p) => p.active)), [order, products]);
}
