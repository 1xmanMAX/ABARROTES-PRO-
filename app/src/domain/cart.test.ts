import { describe, expect, it } from 'vitest';
import { addQty, cartItemCount, cartTotal, EMPTY_CART, reservedByProduct, setPrice, setQty, undo } from './cart';

const products = new Map([
  ['a', { id: 'a', salePrice: 18500, allowsFraction: false }],
  ['b', { id: 'b', salePrice: 10800, allowsFraction: false }],
  ['k', { id: 'k', salePrice: 400, allowsFraction: true }],
]);

describe('cart', () => {
  it('suma cantidades y calcula total', () => {
    let s = addQty(EMPTY_CART, 'a', 1);
    s = addQty(s, 'a', 1);
    s = addQty(s, 'b', 1);
    expect(s.lines).toHaveLength(2);
    expect(cartTotal(s.lines, products)).toBe(47800);
    expect(cartItemCount(s.lines, products)).toBe(3);
  });

  it('deshacer revierte con exactitud multiplicadores, líneas nuevas y cantidades', () => {
    let s = addQty(EMPTY_CART, 'a', 1);
    s = addQty(s, 'b', 5); // ×5
    s = addQty(s, 'a', 10); // ×10
    s = setQty(s, 'b', 2);
    expect(s.lines).toEqual([
      expect.objectContaining({ productId: 'a', qty: 11 }),
      expect.objectContaining({ productId: 'b', qty: 2 }),
    ]);
    s = undo(s);
    expect(s.lines.find((l) => l.productId === 'b')?.qty).toBe(5);
    s = undo(s);
    expect(s.lines.find((l) => l.productId === 'a')?.qty).toBe(1);
    s = undo(s);
    expect(s.lines.map((l) => l.productId)).toEqual(['a']);
    s = undo(s);
    expect(s.lines).toEqual([]);
    expect(undo(s)).toBe(s);
  });

  it('deshacer una línea quitada la devuelve a su lugar', () => {
    let s = addQty(EMPTY_CART, 'a', 1);
    s = addQty(s, 'b', 1);
    s = addQty(s, 'k', 1000);
    s = setQty(s, 'b', 0);
    expect(s.lines.map((l) => l.productId)).toEqual(['a', 'k']);
    s = undo(s);
    expect(s.lines.map((l) => l.productId)).toEqual(['a', 'b', 'k']);
  });

  it('precio con descuento y deshacer', () => {
    let s = addQty(EMPTY_CART, 'a', 2);
    s = setPrice(s, 'a', 18000, 'descuento');
    expect(cartTotal(s.lines, products)).toBe(36000);
    s = undo(s);
    expect(cartTotal(s.lines, products)).toBe(37000);
  });

  it('reservado suma todos los tickets abiertos', () => {
    const r = reservedByProduct([
      { lines: addQty(EMPTY_CART, 'a', 2).lines },
      { lines: addQty(addQty(EMPTY_CART, 'a', 3), 'b', 1).lines },
    ]);
    expect(r.get('a')).toBe(5);
    expect(r.get('b')).toBe(1);
  });
});
