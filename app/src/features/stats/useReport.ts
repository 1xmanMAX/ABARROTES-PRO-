import { useLiveQuery } from 'dexie-react-hooks';
import type { CashMovement } from '../../db/types';
import type { SaleTicket } from '../../domain/profit';
import { loadExpenseMovements, loadSales } from '../../db/reports';

/** Ventas y gastos desde un día (se actualiza sola al vender o registrar gastos). */
export function useSalesSince(fromDayKey: string | null): { sales: SaleTicket[]; expenses: CashMovement[] } | undefined {
  return useLiveQuery(async () => {
    const [sales, expenses] = await Promise.all([loadSales(fromDayKey), loadExpenseMovements(fromDayKey)]);
    return { sales, expenses };
  }, [fromDayKey]);
}

export const fmtPct = (n: number) => n.toLocaleString('es-PE', { maximumFractionDigits: 1, minimumFractionDigits: 0 });

export function signedPct(n: number | null): string | null {
  if (n === null || !Number.isFinite(n)) return null;
  return `${n >= 0 ? '+' : '−'}${fmtPct(Math.abs(n))} %`;
}
