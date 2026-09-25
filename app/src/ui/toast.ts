import { create } from 'zustand';

export interface ToastData {
  id: number;
  message: string;
  tone: 'info' | 'error' | 'success';
  actionLabel?: string;
  onAction?: () => void;
  durationMs: number;
}

interface ToastState {
  toast: ToastData | null;
  show: (t: Omit<ToastData, 'id' | 'durationMs' | 'tone'> & Partial<Pick<ToastData, 'durationMs' | 'tone'>>) => void;
  dismiss: (id?: number) => void;
}

let seq = 0;

export const useToast = create<ToastState>((set, get) => ({
  toast: null,
  show: (t) => set({ toast: { tone: 'info', durationMs: 3000, ...t, id: ++seq } }),
  dismiss: (id) => {
    if (id === undefined || get().toast?.id === id) set({ toast: null });
  },
}));

export const toast = (message: string, tone: ToastData['tone'] = 'info') => useToast.getState().show({ message, tone });

export function toastError(err: unknown) {
  const message = err instanceof Error && err.name === 'BusinessError' ? err.message : 'Algo salió mal. Inténtalo otra vez.';
  if (!(err instanceof Error && err.name === 'BusinessError')) console.error(err);
  useToast.getState().show({ message, tone: 'error', durationMs: 3500 });
}

export function vibrate(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* sin vibración */
  }
}
