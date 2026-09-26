import type { Cents } from './money';
import { lineAmount, type Qty } from './qty';

/** Línea de un ticket abierto (borrador). Los snapshots se toman al cobrar. */
export interface CartLine {
  productId: string;
  qty: Qty;
  /** Precio cambiado a mano para esta línea; null = precio del producto. */
  priceOverride: Cents | null;
  priceOverrideReason: string | null;
}

/** Estado anterior de la línea tocada, para poder deshacer con exactitud. */
export interface UndoEntry {
  productId: string;
  /** null = la línea no existía. */
  previous: CartLine | null;
  /** Posición de la línea en el ticket antes del cambio. */
  index: number;
}

export interface CartState {
  lines: CartLine[];
  undo: UndoEntry[];
}

export const EMPTY_CART: CartState = { lines: [], undo: [] };
const MAX_UNDO = 50;

function pushUndo(state: CartState, productId: string): UndoEntry[] {
  const index = state.lines.findIndex((l) => l.productId === productId);
  const entry: UndoEntry = { productId, previous: index >= 0 ? { ...state.lines[index]! } : null, index };
  const undo = [...state.undo, entry];
  return undo.length > MAX_UNDO ? undo.slice(undo.length - MAX_UNDO) : undo;
}

/** Reemplaza (o quita si line = null) la línea del producto. */
function replaceLine(lines: CartLine[], productId: string, line: CartLine | null): CartLine[] {
  const index = lines.findIndex((l) => l.productId === productId);
  if (index < 0) return line ? [...lines, line] : lines;
  const next = [...lines];
  if (line) next[index] = line;
  else next.splice(index, 1);
  return next;
}

/** Suma `qty` al producto (toque en tile o sugerencia). */
export function addQty(state: CartState, productId: string, qty: Qty): CartState {
  if (qty <= 0) return state;
  const current = state.lines.find((l) => l.productId === productId);
  const line: CartLine = current
    ? { ...current, qty: current.qty + qty }
    : { productId, qty, priceOverride: null, priceOverrideReason: null };
  return { lines: replaceLine(state.lines, productId, line), undo: pushUndo(state, productId) };
}

/** Fija la cantidad exacta. qty ≤ 0 quita la línea. */
export function setQty(state: CartState, productId: string, qty: Qty): CartState {
  const current = state.lines.find((l) => l.productId === productId);
  if (current && current.qty === qty) return state;
  if (!current && qty <= 0) return state;
  const line: CartLine | null =
    qty <= 0 ? null : current ? { ...current, qty } : { productId, qty, priceOverride: null, priceOverrideReason: null };
  return { lines: replaceLine(state.lines, productId, line), undo: pushUndo(state, productId) };
}

/** Cambia el precio de la línea (descuento). null vuelve al precio normal. */
export function setPrice(state: CartState, productId: string, price: Cents | null, reason: string | null): CartState {
  const current = state.lines.find((l) => l.productId === productId);
  if (!current) return state;
  const line: CartLine = { ...current, priceOverride: price, priceOverrideReason: price === null ? null : reason };
  return { lines: replaceLine(state.lines, productId, line), undo: pushUndo(state, productId) };
}

export function removeLine(state: CartState, productId: string): CartState {
  return setQty(state, productId, 0);
}

/** Revierte el último cambio. */
export function undo(state: CartState): CartState {
  const entry = state.undo[state.undo.length - 1];
  if (!entry) return state;
  let lines = state.lines.filter((l) => l.productId !== entry.productId);
  if (entry.previous) {
    lines = [...lines];
    lines.splice(Math.min(entry.index, lines.length), 0, entry.previous);
  }
  return { lines, undo: state.undo.slice(0, -1) };
}

export interface PricedProduct {
  id: string;
  salePrice: Cents;
  allowsFraction: boolean;
}

export function effectivePrice(line: CartLine, product: PricedProduct): Cents {
  return line.priceOverride ?? product.salePrice;
}

export function cartTotal(lines: CartLine[], products: ReadonlyMap<string, PricedProduct>): Cents {
  let total = 0;
  for (const line of lines) {
    const p = products.get(line.productId);
    if (!p) continue;
    total += lineAmount(p, line.qty, effectivePrice(line, p));
  }
  return total;
}

/** "Cantidad de productos" de la barra de cobro: unidades enteras; fracciones cuentan 1 por línea. */
export function cartItemCount(lines: CartLine[], products: ReadonlyMap<string, { allowsFraction: boolean }>): number {
  let n = 0;
  for (const line of lines) n += products.get(line.productId)?.allowsFraction ? 1 : line.qty;
  return n;
}

/**
 * Stock disponible = stock − lo que ya está en todos los tickets abiertos.
 */
export function reservedByProduct(tickets: Iterable<{ lines: CartLine[] }>): Map<string, Qty> {
  const reserved = new Map<string, Qty>();
  for (const t of tickets) {
    for (const l of t.lines) reserved.set(l.productId, (reserved.get(l.productId) ?? 0) + l.qty);
  }
  return reserved;
}
