import { create } from 'zustand';
import type { Ticket, TicketLine } from '../db/types';

interface PrintState {
  job: { ticket: Ticket; lines: TicketLine[]; nonce: number } | null;
  print: (ticket: Ticket, lines: TicketLine[]) => void;
}

let nonce = 0;

/** El ticket ya está guardado cuando se llama; la impresión no bloquea la venta. */
export const usePrint = create<PrintState>((set) => ({
  job: null,
  print: (ticket, lines) => set({ job: { ticket, lines, nonce: ++nonce } }),
}));
