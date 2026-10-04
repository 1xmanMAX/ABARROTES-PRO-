import type { ConsignmentLine, Consignment, LedgerEntry, Party, Product, SettlementLine, StockMovement } from '../db/types';

/**
 * Los cachés derivados (stock, mercadería en consignación, saldo de cada persona y lo devuelto o
 * vendido de cada entrega) se recalculan desde los registros que nunca se borran. Así, al juntar
 * los datos de dos aparatos, una venta hecha en cada uno a la vez descuenta las dos.
 */
export interface CacheSources {
  stockMovements: StockMovement[];
  ledgerEntries: LedgerEntry[];
  consignments: Consignment[];
  consignmentLines: ConsignmentLine[];
  settlementLines: SettlementLine[];
}

const add = (m: Map<string, number>, k: string, v: number) => m.set(k, (m.get(k) ?? 0) + v);

/** Stock = suma de los movimientos de stock (el stock inicial también es un movimiento). */
export function stockByProduct(moves: StockMovement[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const x of moves) add(m, x.productId, x.delta);
  return m;
}

/** Saldo = cargos − pagos ± ajustes, sin los anulados. */
export function balanceByParty(entries: LedgerEntry[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const e of entries) {
    if (e.voidedAt) continue;
    add(m, e.partyId, e.type === 'payment' ? -e.amount : e.amount);
  }
  return m;
}

/** Devuelto y vendido de cada línea de entrega = suma de sus liquidaciones. */
export function settledByLine(lines: SettlementLine[]): Map<string, { returned: number; sold: number }> {
  const m = new Map<string, { returned: number; sold: number }>();
  for (const l of lines) {
    const cur = m.get(l.consignmentLineId) ?? { returned: 0, sold: 0 };
    m.set(l.consignmentLineId, { returned: cur.returned + l.qtyReturned, sold: cur.sold + l.qtySold });
  }
  return m;
}

/** Lo que está en manos de vendedores: entregado − devuelto − vendido, de entregas no anuladas. */
export function consignedByProduct(
  consignments: Consignment[],
  lines: ConsignmentLine[],
  settled: Map<string, { returned: number; sold: number }>,
): Map<string, number> {
  const voided = new Set(consignments.filter((c) => c.status === 'void').map((c) => c.id));
  const m = new Map<string, number>();
  for (const l of lines) {
    if (voided.has(l.consignmentId)) continue;
    const s = settled.get(l.id) ?? { returned: 0, sold: 0 };
    add(m, l.productId, Math.max(0, l.qtyDelivered - s.returned - s.sold));
  }
  return m;
}

/** Productos, personas y líneas de entrega con los cachés corregidos (solo los que cambian). */
export function recomputeCaches(
  src: CacheSources,
  products: Product[],
  parties: Party[],
): { products: Product[]; parties: Party[]; consignmentLines: ConsignmentLine[] } {
  const stock = stockByProduct(src.stockMovements);
  const balance = balanceByParty(src.ledgerEntries);
  const settled = settledByLine(src.settlementLines);
  const consigned = consignedByProduct(src.consignments, src.consignmentLines, settled);
  return {
    products: products
      .filter((p) => p.stock !== (stock.get(p.id) ?? 0) || p.consignedQty !== (consigned.get(p.id) ?? 0))
      .map((p) => ({ ...p, stock: stock.get(p.id) ?? 0, consignedQty: consigned.get(p.id) ?? 0 })),
    parties: parties.filter((p) => p.balance !== (balance.get(p.id) ?? 0)).map((p) => ({ ...p, balance: balance.get(p.id) ?? 0 })),
    consignmentLines: src.consignmentLines
      .filter((l) => {
        const s = settled.get(l.id) ?? { returned: 0, sold: 0 };
        return l.qtyReturned !== s.returned || l.qtySold !== s.sold;
      })
      .map((l) => {
        const s = settled.get(l.id) ?? { returned: 0, sold: 0 };
        return { ...l, qtyReturned: s.returned, qtySold: s.sold };
      }),
  };
}
