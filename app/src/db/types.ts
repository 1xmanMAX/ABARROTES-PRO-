import type { Cents } from '../domain/money';
import type { Qty } from '../domain/qty';

export type ProductUnit = 'saco' | 'caja' | 'bolsa' | 'unidad' | 'kg' | 'litro' | 'paquete';

interface Timestamps {
  createdAt: number;
  updatedAt: number;
}

export interface Product extends Timestamps {
  id: string;
  name: string;
  baseName: string;
  unit: ProductUnit;
  allowsFraction: boolean;
  category: string;
  salePrice: Cents;
  costPrice: Cents;
  sellerPrice: Cents | null;
  /** Caché derivado de stockMovements (se actualiza en la misma transacción). */
  stock: Qty;
  consignedQty: Qty;
  minStock: Qty;
  photo: Blob | null;
  tileColor: number;
  pinnedPosition: number | null;
  active: boolean;
}

export type TicketStatus = 'open' | 'paid' | 'credit' | 'void';
export type PaymentMethod = 'cash' | 'digital' | 'credit';

export interface Ticket extends Timestamps {
  id: string;
  /** Correlativo por día; 0 mientras está abierto. */
  number: number;
  label: string;
  status: TicketStatus;
  paymentMethod: PaymentMethod | null;
  partyId: string | null;
  subtotal: Cents;
  discount: Cents;
  total: Cents;
  cashReceived: Cents | null;
  change: Cents | null;
  digitalRef: string | null;
  signatureId: string | null;
  dayKey: string;
  closedAt: number | null;
  voidReason: string | null;
  voidedAt: number | null;
  /** Posición de la pestaña entre los tickets abiertos. */
  tabOrder: number;
}

export interface TicketLine {
  id: string;
  ticketId: string;
  productId: string;
  /** Orden de la línea dentro del ticket. */
  seq: number;
  qty: Qty;
  /** Solo en tickets abiertos: precio cambiado a mano, o null. */
  priceOverride: Cents | null;
  priceOverrideReason: string | null;
  /** Snapshots: se completan al cobrar. */
  productName: string;
  /** La cantidad está en milésimas (producto con fracciones). */
  fractional: boolean;
  unitPrice: Cents;
  unitCost: Cents;
  lineTotal: Cents;
  lineProfit: Cents;
}

export type StockReason = 'sale' | 'sale_void' | 'purchase' | 'consign_out' | 'consign_return' | 'adjustment';

export interface StockMovement {
  id: string;
  productId: string;
  delta: Qty;
  reason: StockReason;
  refType: string | null;
  refId: string | null;
  note: string;
  createdAt: number;
}

export type CashMovementType =
  | 'sale'
  | 'debt_payment'
  | 'settlement_payment'
  | 'purchase'
  | 'expense'
  | 'withdrawal'
  | 'contribution'
  | 'opening'
  | 'close_diff';

export interface CashMovement {
  id: string;
  type: CashMovementType;
  method: 'cash' | 'digital';
  /** Con signo: + entra, − sale. */
  amount: Cents;
  refType: string | null;
  refId: string | null;
  note: string;
  dayKey: string;
  createdAt: number;
  voidedAt: number | null;
}

export interface AuditEntry {
  id: string;
  action: string;
  entity: string;
  entityId: string;
  detail: string;
  createdAt: number;
}

export type ThemePref = 'light' | 'dark' | 'system';

export interface Settings {
  id: 'main';
  shopName: string;
  receiptFooter: string;
  paperWidth: 58 | 80;
  gridOrder: string[];
  gridOrderComputedAt: number | null;
  openingCash: Cents;
  theme: ThemePref;
  lastBackupAt: number | null;
}
