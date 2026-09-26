import { create } from 'zustand';
import { addQty, EMPTY_CART, setPrice, setQty, undo as undoCart, type CartLine, type CartState } from '../../domain/cart';
import type { Cents } from '../../domain/money';
import {
  consumeMultiplier,
  MULTIPLIER_DEFAULT,
  pressMultiplier,
  type MultiplierState,
  type MultiplierValue,
} from '../../domain/multiplier';
import type { Qty } from '../../domain/qty';
import {
  checkoutOnCredit,
  checkoutTicket,
  discardEmptyTicket,
  loadOpenTickets,
  MAX_OPEN_TICKETS,
  openTicket,
  renameTicket,
  saveOpenTicketLines,
  type Payment,
} from '../../db/tickets';
import type { Signature, Ticket } from '../../db/types';
import { recomputeIfNewDay } from '../../app/data';
import { refreshStats } from '../../app/stats';

export interface OpenTicket extends CartState {
  id: string;
  label: string;
}

interface SellState {
  loaded: boolean;
  tickets: OpenTicket[];
  activeId: string | null;
  multiplier: MultiplierState;
  init: () => Promise<void>;
  setActive: (id: string) => void;
  newTicket: () => Promise<void>;
  rename: (id: string, label: string) => Promise<void>;
  closeEmpty: (id: string) => Promise<void>;
  /** Toque en un tile: suma multiplicador × unidad, sin pasar del disponible. Devuelve lo agregado. */
  tap: (productId: string, unit: Qty, available: Qty) => Qty;
  setLineQty: (productId: string, qty: Qty) => void;
  setLinePrice: (productId: string, price: Cents | null) => void;
  clear: () => void;
  undo: () => void;
  pressMultiplier: (v: MultiplierValue) => void;
  checkout: (payment: Payment) => Promise<Ticket>;
  /** Venta al fiado firmada (SPEC §6). Devuelve la firma para el comprobante. */
  checkoutCredit: (partyId: string, pin: string, opts: { ownerPin?: string; haggle?: number }) => Promise<Signature>;
}

// ---- guardado en segundo plano (no bloquea la UI) ----
const dirty = new Set<string>();
const running = new Map<string, Promise<void>>();

function scheduleSave(ticketId: string) {
  dirty.add(ticketId);
  if (running.has(ticketId)) return;
  const job = (async () => {
    while (dirty.has(ticketId)) {
      dirty.delete(ticketId);
      const t = useSell.getState().tickets.find((x) => x.id === ticketId);
      if (!t) return;
      try {
        await saveOpenTicketLines(ticketId, t.lines);
      } catch (err) {
        console.error('No se pudo guardar el ticket', err);
      }
    }
  })().finally(() => running.delete(ticketId));
  running.set(ticketId, job);
}

/** Espera a que el borrador del ticket esté escrito en la BD. */
export async function flushTicket(ticketId: string): Promise<void> {
  while (running.has(ticketId) || dirty.has(ticketId)) {
    if (!running.has(ticketId)) scheduleSave(ticketId);
    await running.get(ticketId);
  }
}

/** Espera todos los guardados pendientes (se usa en tests y antes de operaciones globales). */
export async function flushAllTickets(): Promise<void> {
  const ids = new Set([...dirty, ...running.keys()]);
  for (const id of ids) await flushTicket(id);
  await afterSalesJob;
}

function toOpen(ticket: Ticket, lines: CartLine[]): OpenTicket {
  return { id: ticket.id, label: ticket.label, lines, undo: [] };
}

export const useSell = create<SellState>((set, get) => {
  /** Aplica un cambio al ticket activo y lo agenda para guardarse. */
  const mutateActive = (fn: (c: CartState) => CartState) => {
    const { tickets, activeId } = get();
    const idx = tickets.findIndex((t) => t.id === activeId);
    if (idx < 0) return;
    const current = tickets[idx]!;
    const next = fn(current);
    if (next === current || (next.lines === current.lines && next.undo === current.undo)) return;
    const copy = [...tickets];
    copy[idx] = { ...current, lines: next.lines, undo: next.undo };
    set({ tickets: copy });
    scheduleSave(current.id);
  };

  return {
    loaded: false,
    tickets: [],
    activeId: null,
    multiplier: MULTIPLIER_DEFAULT,

    init: async () => {
      let open = await loadOpenTickets();
      if (open.length === 0) {
        const t = await openTicket();
        open = [{ ticket: t, lines: [] }];
      }
      const tickets = open.map((o) => toOpen(o.ticket, o.lines));
      set({ loaded: true, tickets, activeId: tickets[0]!.id });
    },

    setActive: (id) => set({ activeId: id, multiplier: MULTIPLIER_DEFAULT }),

    newTicket: async () => {
      if (get().tickets.length >= MAX_OPEN_TICKETS) throw new Error('max');
      const t = await openTicket();
      set({ tickets: [...get().tickets, toOpen(t, [])], activeId: t.id, multiplier: MULTIPLIER_DEFAULT });
    },

    rename: async (id, label) => {
      await renameTicket(id, label);
      set({ tickets: get().tickets.map((t) => (t.id === id ? { ...t, label: label.trim().slice(0, 40) } : t)) });
    },

    closeEmpty: async (id) => {
      const { tickets } = get();
      if (tickets.length <= 1) return;
      await flushTicket(id);
      await discardEmptyTicket(id);
      const rest = tickets.filter((t) => t.id !== id);
      set({ tickets: rest, activeId: get().activeId === id ? rest[0]!.id : get().activeId });
    },

    tap: (productId, unit, available) => {
      const m = get().multiplier;
      const qty = Math.min(m.value * unit, available);
      set({ multiplier: consumeMultiplier(m) });
      if (qty <= 0) return 0;
      mutateActive((c) => addQty(c, productId, qty));
      return qty;
    },

    setLineQty: (productId, qty) => mutateActive((c) => setQty(c, productId, qty)),
    setLinePrice: (productId, price) => mutateActive((c) => setPrice(c, productId, price, price === null ? null : 'descuento')),
    clear: () =>
      mutateActive((c) => {
        let s = c;
        for (const l of c.lines) s = setQty(s, l.productId, 0);
        return s;
      }),
    undo: () => mutateActive(undoCart),
    pressMultiplier: (v) => set({ multiplier: pressMultiplier(get().multiplier, v) }),

    checkout: async (payment) => {
      const id = get().activeId;
      if (!id) throw new Error('Sin ticket activo');
      await flushTicket(id);
      const closed = await checkoutTicket(id, payment);
      await removeClosed(id);
      return closed;
    },

    checkoutCredit: async (partyId, pin, opts) => {
      const id = get().activeId;
      if (!id) throw new Error('Sin ticket activo');
      await flushTicket(id);
      const { signature } = await checkoutOnCredit(id, partyId, pin, opts);
      await removeClosed(id);
      return signature;
    },
  };

  /** Quita el ticket cerrado y deja activo el siguiente (o uno nuevo vacío). */
  async function removeClosed(id: string) {
    const before = get().tickets;
    const idx = before.findIndex((t) => t.id === id);
    let rest = before.filter((t) => t.id !== id);
    if (rest.length === 0) {
      const t = await openTicket();
      rest = [toOpen(t, [])];
    }
    const nextActive = rest[Math.min(Math.max(idx, 0), rest.length - 1)]!;
    set({ tickets: rest, activeId: nextActive.id, multiplier: MULTIPLIER_DEFAULT });
    void afterSalesChange();
  }
});

const NO_TICKET: OpenTicket = { ...EMPTY_CART, id: '', label: '' };
export const activeTicket = (s: SellState): OpenTicket => s.tickets.find((t) => t.id === s.activeId) ?? NO_TICKET;
export const anyTicketHasLines = (s: SellState): boolean => s.tickets.some((t) => t.lines.length > 0);

let afterSalesJob: Promise<void> = Promise.resolve();

/**
 * Después de una venta o anulación: refrescar la predicción y, si empezó un día
 * nuevo, reordenar. No bloquea al que llama; los errores se registran.
 */
export function afterSalesChange(): Promise<void> {
  afterSalesJob = afterSalesJob
    .then(async () => {
      await refreshStats();
      await recomputeIfNewDay(anyTicketHasLines(useSell.getState()));
    })
    .catch((err) => console.error('No se pudo actualizar la predicción', err));
  return afterSalesJob;
}
