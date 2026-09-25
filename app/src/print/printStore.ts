import { create } from 'zustand';
import type { Signature, Ticket, TicketLine } from '../db/types';

export type PrintJob =
  | { kind: 'ticket'; ticket: Ticket; lines: TicketLine[]; nonce: number }
  | { kind: 'voucher'; signature: Signature; nonce: number };

interface PrintState {
  job: PrintJob | null;
  print: (ticket: Ticket, lines: TicketLine[]) => void;
  printVoucher: (signature: Signature) => void;
}

let nonce = 0;

/** Lo que se imprime ya está guardado cuando se llama; la impresión no bloquea la venta. */
export const usePrint = create<PrintState>((set) => ({
  job: null,
  print: (ticket, lines) => set({ job: { kind: 'ticket', ticket, lines, nonce: ++nonce } }),
  printVoucher: (signature) => set({ job: { kind: 'voucher', signature, nonce: ++nonce } }),
}));
