import { describe, expect, it } from 'vitest';
import { defaultAgreedPrice, pendingQty, pendingValue, previewSettlement, type ConsignedLine } from './consignment';

const l = (id: string, delivered: number, price: number, returned = 0, sold = 0): ConsignedLine => ({
  id,
  fractional: false,
  qtyDelivered: delivered,
  qtyReturned: returned,
  qtySold: sold,
  agreedPrice: price,
});

describe('consignación', () => {
  it('pendiente y valor en poder del vendedor', () => {
    expect(pendingQty(l('a', 10, 100, 2, 3))).toBe(5);
    expect(pendingValue([l('a', 10, 100, 2, 3), l('b', 4, 250)])).toBe(1500);
  });
  it('liquidar: vendido = entregado − devuelto; total = vendido + deuda anterior', () => {
    const p = previewSettlement([l('a', 10, 17500), l('b', 6, 10000)], { a: 2 }, 15200);
    expect(p.lines.map((x) => [x.sold, x.lineTotal])).toEqual([
      [8, 140000],
      [6, 60000],
    ]);
    expect(p.soldValue).toBe(200000);
    expect(p.totalDue).toBe(215200);
  });
  it('no se devuelve más de lo entregado', () => {
    expect(() => previewSettlement([l('a', 3, 100)], { a: 4 }, 0)).toThrow('superar');
    expect(() => previewSettlement([l('a', 3, 100)], { a: -1 }, 0)).toThrow();
  });
  it('precio pactado por defecto', () => {
    const p = { id: 'x', salePrice: 18500, sellerPrice: 17500 };
    expect(defaultAgreedPrice(p, {})).toBe(17500);
    expect(defaultAgreedPrice(p, { x: 17000 })).toBe(17000);
    expect(defaultAgreedPrice({ ...p, sellerPrice: null }, {})).toBe(18500);
  });
});
