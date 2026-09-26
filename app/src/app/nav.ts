import { create } from 'zustand';

export type Route =
  | { name: 'sell' }
  | { name: 'checkout' }
  | { name: 'inventory' }
  | { name: 'product'; id: string | null }
  | { name: 'history' }
  | { name: 'settings' }
  | { name: 'parties' }
  | { name: 'party'; id: string }
  | { name: 'partyEdit'; id: string | null }
  | { name: 'voucher'; signatureId: string }
  | { name: 'today' }
  | { name: 'cash' }
  | { name: 'backup' }
  | { name: 'purchase' }
  | { name: 'deliver'; partyId: string }
  | { name: 'settle'; partyId: string }
  | { name: 'profit' };

interface NavState {
  stack: Route[];
  push: (route: Route) => void;
  back: () => void;
  /** Vuelve a Vender (limpia la pila). */
  home: () => void;
  /** Reemplaza la pantalla actual (no agrega un paso al botón atrás). */
  replace: (route: Route) => void;
}

/**
 * Navegación en memoria sincronizada con el historial del navegador para que el
 * botón "atrás" de Android funcione.
 */
export const useNav = create<NavState>((set, get) => ({
  stack: [{ name: 'sell' }],
  push: (route) => {
    set({ stack: [...get().stack, route] });
    history.pushState({ depth: get().stack.length }, '');
  },
  back: () => {
    if (get().stack.length > 1) history.back();
  },
  replace: (route) => set({ stack: [...get().stack.slice(0, -1), route] }),
  home: () => {
    const extra = get().stack.length - 1;
    if (extra > 0) history.go(-extra);
  },
}));

export function installBackHandler(): () => void {
  history.replaceState({ depth: 1 }, '');
  const onPop = (e: PopStateEvent) => {
    const depth = typeof e.state?.depth === 'number' ? e.state.depth : 1;
    const { stack } = useNav.getState();
    if (depth < stack.length) useNav.setState({ stack: stack.slice(0, Math.max(1, depth)) });
  };
  window.addEventListener('popstate', onPop);
  return () => window.removeEventListener('popstate', onPop);
}

export const currentRoute = (s: NavState): Route => s.stack[s.stack.length - 1]!;
