import { dayKeyOf } from '../domain/time';
import { newId } from './ids';
import { createParty } from './parties';
import { setPartyPin } from './pins';
import { createProduct, type ProductInput } from './products';
import { db } from './schema';
import { rebuildStats } from './stats';
import type { CashMovement, Product, ProductUnit, StockMovement, Ticket, TicketLine } from './types';

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
      // Sacos y aceite: productos donde el cliente suele regatear.
      allowsHaggle: unit === 'saco' || baseName === 'Aceite',
    };
    await createProduct(input, stock);
  }
  return PRODUCTS.length;
}

/** PRNG determinista (mulberry32) para que los datos de ejemplo sean siempre iguales. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

/**
 * Historial sintético (DATA_MODEL §7): 300 tickets en los 30 días anteriores a hoy,
 * con pares frecuentes (Arroz+Aceite, Arroz+Avena, Azúcar+Harina). El stock final
 * de cada producto no cambia: se registra una entrada inicial por lo vendido.
 */
export async function seedDemoHistory(ticketCount = 300, now = Date.now()): Promise<number> {
  const products = await db.products.toArray();
  const byBase = new Map(products.map((p) => [p.baseName, p]));
  const pick = (base: string) => byBase.get(base);
  const rand = rng(20260926);
  const all = products.filter((p) => p.active && !p.allowsFraction);
  if (all.length < 3) return 0;

  const baskets: { weight: number; items: (Product | undefined)[] }[] = [
    { weight: 0.3, items: [pick('Arroz'), pick('Aceite')] },
    { weight: 0.2, items: [pick('Arroz'), pick('Avena')] },
    { weight: 0.2, items: [pick('Azúcar'), pick('Harina')] },
  ];
  const randomProduct = () => all[Math.floor(rand() * all.length)]!;
  // Mañana con más movimiento; la avena se vende más por la tarde.
  const hourWeights = [0, 0, 0, 0, 0, 1, 6, 9, 10, 9, 7, 5, 4, 3, 3, 3, 4, 4, 3, 1, 0, 0, 0, 0];
  const pickHour = (eveningBias: boolean) => {
    const w = eveningBias ? hourWeights.map((v, h) => (h >= 15 ? v * 4 : v)) : hourWeights;
    let r = rand() * w.reduce((x, y) => x + y, 0);
    for (let h = 0; h < 24; h++) if ((r -= w[h]!) < 0) return h;
    return 9;
  };

  // Medianoche de hoy en Lima (UTC−5, sin horario de verano).
  const todayStart = Date.parse(`${dayKeyOf(now)}T00:00:00-05:00`);
  const tickets: Ticket[] = [];
  const lines: TicketLine[] = [];
  const stockMoves: StockMovement[] = [];
  const cashMoves: CashMovement[] = [];
  const sold = new Map<string, number>();
  const numberByDay = new Map<string, number>();

  const drafts: { at: number; items: Map<Product, number> }[] = [];
  for (let i = 0; i < ticketCount; i++) {
    const r = rand();
    let acc = 0;
    let items: Product[] = [];
    for (const b of baskets) {
      acc += b.weight;
      if (r < acc && b.items.every(Boolean)) {
        items = b.items as Product[];
        break;
      }
    }
    if (items.length === 0) items = Array.from({ length: 1 + Math.floor(rand() * 3) }, randomProduct);
    if (rand() < 0.3) items = [...items, randomProduct()];
    const qty = new Map<Product, number>();
    for (const p of items) qty.set(p, (qty.get(p) ?? 0) + 1 + Math.floor(rand() * 3));
    const day = 1 + Math.floor(rand() * 30);
    const evening = items.some((p) => p.baseName === 'Avena');
    const at = todayStart - day * DAY_MS + pickHour(evening) * HOUR_MS + Math.floor(rand() * HOUR_MS);
    drafts.push({ at, items: qty });
  }
  drafts.sort((x, y) => x.at - y.at);

  for (const d of drafts) {
    const id = newId();
    const dayKey = dayKeyOf(d.at);
    const number = (numberByDay.get(dayKey) ?? 0) + 1;
    numberByDay.set(dayKey, number);
    let total = 0;
    let seq = 0;
    for (const [p, qty] of d.items) {
      const lineTotal = qty * p.salePrice;
      total += lineTotal;
      sold.set(p.id, (sold.get(p.id) ?? 0) + qty);
      lines.push({
        id: newId(),
        ticketId: id,
        productId: p.id,
        seq: seq++,
        qty,
        priceOverride: null,
        priceOverrideReason: null,
        productName: p.name,
        fractional: false,
        unitPrice: p.salePrice,
        unitCost: p.costPrice,
        lineTotal,
        lineProfit: lineTotal - qty * p.costPrice,
      });
      stockMoves.push({
        id: newId(),
        productId: p.id,
        delta: -qty,
        reason: 'sale',
        refType: 'ticket',
        refId: id,
        note: '',
        createdAt: d.at,
      });
    }
    const method = rand() < 0.75 ? 'cash' : 'digital';
    tickets.push({
      id,
      number,
      label: 'Cliente 1',
      status: 'paid',
      paymentMethod: method,
      partyId: null,
      subtotal: total,
      discount: 0,
      total,
      cashReceived: method === 'cash' ? total : null,
      change: method === 'cash' ? 0 : null,
      digitalRef: null,
      signatureId: null,
      dayKey,
      closedAt: d.at,
      voidReason: null,
      voidedAt: null,
      tabOrder: 0,
      createdAt: d.at,
      updatedAt: d.at,
    });
    cashMoves.push({
      id: newId(),
      type: 'sale',
      method,
      amount: total,
      refType: 'ticket',
      refId: id,
      note: `Venta #${String(number).padStart(4, '0')}`,
      dayKey,
      createdAt: d.at,
      voidedAt: null,
    });
  }

  const first = drafts[0]?.at ?? now;
  await db.transaction('rw', [db.tickets, db.ticketLines, db.stockMovements, db.cashMovements], async () => {
    for (const [productId, qty] of sold) {
      stockMoves.push({
        id: newId(),
        productId,
        delta: qty,
        reason: 'adjustment',
        refType: 'seed',
        refId: null,
        note: 'Entrada inicial (datos de ejemplo)',
        createdAt: first - 1,
      });
    }
    await db.tickets.bulkAdd(tickets);
    await db.ticketLines.bulkAdd(lines);
    await db.stockMovements.bulkAdd(stockMoves);
    await db.cashMovements.bulkAdd(cashMoves);
  });
  await rebuildStats();
  return tickets.length;
}

/** Personas de ejemplo (DATA_MODEL §7) con el código de prueba 2580. */
export async function seedDemoParties(): Promise<void> {
  if ((await db.parties.count()) > 0) return;
  const rosa = await createParty({
    name: 'Rosa Mamani',
    phone: '987654321',
    roles: ['client'],
    creditLimit: 100000,
    birthYear: null,
  });
  const juan = await createParty({
    name: 'Juan Quispe',
    phone: '912345678',
    roles: ['client', 'seller'],
    creditLimit: 80000,
    birthYear: null,
  });
  await setPartyPin(rosa, DEMO_PIN);
  await setPartyPin(juan, DEMO_PIN);
}

export const DEMO_PIN = '2580';

/** Productos, personas e historial de ejemplo, solo si el inventario está vacío. */
export async function seedDemo(): Promise<number> {
  const n = await seedDemoProducts();
  if (n > 0) {
    await seedDemoHistory();
    await seedDemoParties();
  }
  return n;
}
