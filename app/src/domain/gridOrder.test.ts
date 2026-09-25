import { describe, expect, it } from 'vitest';
import { applyGridOrder, computeGridOrder, searchProducts } from './gridOrder';

const p = (id: string, name: string, pinnedPosition: number | null = null, score = 0) => ({ id, name, pinnedPosition, score });

describe('gridOrder', () => {
  it('ordena por puntaje y nombre, respetando fijados', () => {
    const order = computeGridOrder([
      p('c', 'Caja'),
      p('a', 'Arroz', null, 5),
      p('b', 'Beta'),
      p('z', 'Zanahoria', 1),
      p('y', 'Yuca', 3),
    ]);
    expect(order).toEqual(['z', 'a', 'y', 'b', 'c']);
  });
  it('fijados fuera de rango van al inicio de los libres', () => {
    expect(computeGridOrder([p('a', 'A'), p('b', 'B', 9)])).toEqual(['b', 'a']);
  });
  it('aplica orden guardado y pone productos nuevos al final', () => {
    const list = [p('a', 'A'), p('b', 'B'), p('n', 'Nuevo')];
    expect(applyGridOrder(['b', 'x', 'a'], list).map((x) => x.id)).toEqual(['b', 'a', 'n']);
  });
  it('busca sin tildes', () => {
    const list = [{ name: 'Azúcar saco 50kg' }, { name: 'Arroz saco 50kg' }];
    expect(searchProducts(list, 'azucar').map((x) => x.name)).toEqual(['Azúcar saco 50kg']);
    expect(searchProducts(list, 'saco 50').length).toBe(2);
  });
});
