import type { Cents } from './money';

export type Stamp = 'PAGADO' | 'FIADO' | 'RECIBIDO';

/** Sello del comprobante según lo que se firmó (SPEC §9.4). */
export function stampFor(purpose: string, paid: Cents = 0): Stamp {
  if (purpose === 'credit_sale') return 'FIADO';
  if (purpose === 'consignment_receipt') return 'RECIBIDO';
  if (purpose === 'settlement') return paid > 0 ? 'PAGADO' : 'FIADO';
  return 'PAGADO';
}
