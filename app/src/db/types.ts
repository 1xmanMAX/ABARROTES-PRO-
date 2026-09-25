import type { Cents } from '../domain/money';
import type { PinRecord } from '../domain/pin';
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
  /** Admite rebaja por regateo al cobrar. */
  allowsHaggle?: boolean;
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
  /** Snapshot del nombre de la persona (fiado). */
  partyName?: string | null;
  subtotal: Cents;
  /** Descuento total: cambios de precio por línea + rebaja por regateo. */
  discount: Cents;
  /** Rebaja por regateo (parte de `discount`). */
  haggle?: Cents;
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
  /** Total neto de la línea (ya descontada su parte de la rebaja). */
  lineTotal: Cents;
  lineProfit: Cents;
  /** Parte de la rebaja por regateo que le tocó a esta línea. */
  lineDiscount?: Cents;
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
  /** Código de dueño (SPEC §9.5). Se crea en el primer arranque. */
  ownerPin: PinRecord | null;
  /** Rebaja máxima por regateo por ticket. */
  maxHaggle: Cents;
  theme: ThemePref;
  lastBackupAt: number | null;
}

export type PartyRole = 'client' | 'seller';

export interface Party extends Timestamps {
  id: string;
  name: string;
  phone: string;
  roles: PartyRole[];
  /** 0 = sin fiado (cualquier deuda nueva pide el código de dueño). */
  creditLimit: Cents;
  /** Caché derivado de ledgerEntries (se actualiza en la misma transacción). */
  balance: Cents;
  pin: PinRecord | null;
  /** Para rechazar el año de nacimiento como código. */
  birthYear: number | null;
  /** Precios pactados por defecto (vendedores): productId → precio. */
  specialPrices: Record<string, Cents>;
  active: boolean;
  lastUsedAt: number;
}

export interface LedgerEntry {
  id: string;
  partyId: string;
  type: 'charge' | 'payment' | 'adjustment';
  /** Siempre positivo en cargos y pagos; con signo en ajustes. */
  amount: Cents;
  method: 'cash' | 'digital' | null;
  sourceType: 'ticket' | 'settlement' | 'manual' | 'payment';
  sourceId: string | null;
  signatureId: string | null;
  note: string;
  createdAt: number;
  voidedAt: number | null;
}

export type SignaturePurpose = 'credit_sale' | 'consignment_receipt' | 'debt_payment' | 'settlement';

export interface SignatureLine {
  name: string;
  qty: number;
  amount: Cents;
}

export interface Signature {
  id: string;
  partyId: string;
  partyName: string;
  purpose: SignaturePurpose;
  amount: Cents;
  /** Único: MB-MMDD-XXXX. */
  operationCode: string;
  /** SHA-256 del payload canónico (DATA_MODEL §5.4). */
  payloadHash: string;
  concept: string;
  lines: SignatureLine[];
  previousBalance: Cents;
  newBalance: Cents;
  refType: string;
  refId: string;
  createdAt: number;
}
