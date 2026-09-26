import { create } from 'zustand';
import type { PairStat, ProductStat } from '../domain/stats';
import { loadAllStats } from '../db/stats';

interface StatsState {
  products: ReadonlyMap<string, ProductStat>;
  pairs: ReadonlyMap<string, PairStat>;
  closedTickets: number;
}

/**
 * Caché de predicción en memoria (DATA_MODEL §4.2). Se carga al iniciar y se
 * refresca después de cada venta o anulación; el cálculo en cada toque no
 * toca la BD.
 */
export const useStats = create<StatsState>(() => ({ products: new Map(), pairs: new Map(), closedTickets: 0 }));

export async function refreshStats(): Promise<void> {
  useStats.setState(await loadAllStats());
}
