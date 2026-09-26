import type { Cents } from './money';
import { lineAmount } from './qty';

/** Línea entregada a un vendedor (SPEC §8). Cantidades como en productos (milésimas si fracción). */
export interface ConsignedLine {
  id: string;
  fractional: boolean;
  qtyDelivered: number;
  qtyReturned: number;
  qtySold: number;
  agreedPrice: Cents;
}

/** Lo que todavía está en manos del vendedor. */
export function pendingQty(l: ConsignedLine): number {
  return l.qtyDelivered - l.qtyReturned - l.qtySold;
}

/** Valor (a precio pactado) de la mercadería en su poder. */
export function pendingValue(lines: ConsignedLine[]): Cents {
  return lines.reduce((a, l) => a + lineAmount({ allowsFraction: l.fractional }, pendingQty(l), l.agreedPrice), 0);
}

export interface SettleLine {
  lineId: string;
  pending: number;
  returned: number;
  sold: number;
  lineTotal: Cents;
}

export interface SettlePreview {
  lines: SettleLine[];
  soldValue: Cents;
  previousBalance: Cents;
  totalDue: Cents;
}

/**
 * Liquidación (SPEC §8.2): por línea, vendido = pendiente − devuelto, a precio
 * pactado. Total a pagar = vendido esta vez + deuda anterior.
 */
export function previewSettlement(
  lines: ConsignedLine[],
  returns: Record<string, number>,
  previousBalance: Cents,
): SettlePreview {
  const out: SettleLine[] = lines.map((l) => {
    const pending = pendingQty(l);
    const returned = returns[l.id] ?? 0;
    if (!Number.isSafeInteger(returned) || returned < 0) throw new Error('Devolución inválida');
    if (returned > pending) throw new Error('La devolución no puede superar lo entregado');
    const sold = pending - returned;
    return {
      lineId: l.id,
      pending,
      returned,
      sold,
      lineTotal: lineAmount({ allowsFraction: l.fractional }, sold, l.agreedPrice),
    };
  });
  const soldValue = out.reduce((a, l) => a + l.lineTotal, 0);
  return { lines: out, soldValue, previousBalance, totalDue: previousBalance + soldValue };
}

/** Precio pactado por defecto: el especial del vendedor, si no el de vendedores, si no el de venta. */
export function defaultAgreedPrice(
  p: { id: string; salePrice: Cents; sellerPrice: Cents | null },
  specialPrices: Record<string, Cents>,
): Cents {
  return specialPrices[p.id] ?? p.sellerPrice ?? p.salePrice;
}

/** ¿La entrega ya pasó su fecha de liquidación? */
export function isOverdue(dueDate: number, now: number): boolean {
  return dueDate < now;
}
