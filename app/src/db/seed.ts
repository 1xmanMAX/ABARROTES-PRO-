import { createProduct, type ProductInput } from './products';
import { db } from './schema';
import type { ProductUnit } from './types';

type SeedRow = [name: string, baseName: string, unit: ProductUnit, category: string, sale: number, cost: number, stock: number];

/** Datos de ejemplo (DATA_MODEL §7). Precios en céntimos. */
const PRODUCTS: SeedRow[] = [
  ['Arroz saco 50kg', 'Arroz', 'saco', 'Granos', 18500, 16500, 40],
  ['Azúcar saco 50kg', 'Azúcar', 'saco', 'Granos', 16000, 14200, 30],
  ['Harina saco 50kg', 'Harina', 'saco', 'Harinas', 12800, 11200, 25],
  ['Aceite caja ×12', 'Aceite', 'caja', 'Aceites', 10800, 9600, 30],
  ['Avena bolsa ×24', 'Avena', 'bolsa', 'Cereales', 5800, 5000, 40],
  ['Fideos caja ×20', 'Fideos', 'caja', 'Pastas', 6200, 5400, 35],
  ['Leche caja ×48', 'Leche', 'caja', 'Lácteos', 17280, 15600, 20],
  ['Atún caja ×48', 'Atún', 'caja', 'Conservas', 24000, 21500, 15],
  ['Menestra saco 25kg', 'Menestra', 'saco', 'Granos', 14000, 12200, 20],
  ['Sal bolsa ×50', 'Sal', 'bolsa', 'Condimentos', 3500, 2800, 50],
];

/** Carga los productos de ejemplo si el inventario está vacío. Devuelve cuántos creó. */
export async function seedDemoProducts(): Promise<number> {
  if ((await db.products.count()) > 0) return 0;
  for (const [name, baseName, unit, category, salePrice, costPrice, stock] of PRODUCTS) {
    const input: ProductInput = {
      name,
      baseName,
      unit,
      allowsFraction: false,
      category,
      salePrice,
      costPrice,
      sellerPrice: null,
      minStock: 5,
      photo: null,
      pinnedPosition: null,
      active: true,
    };
    await createProduct(input, stock);
  }
  return PRODUCTS.length;
}
