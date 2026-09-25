import { db } from '../db/schema';
import { DEFAULT_SETTINGS } from '../db/settings';
import { anyTicketHasLines, useSell } from '../features/sell/sellStore';
import { loadGridOrder, recomputeGridOrder, recomputeIfNewDay } from './data';
import { refreshStats } from './stats';

let started: Promise<void> | null = null;

/** Arranque: ajustes por defecto, tickets en espera, estadísticas y orden de la cuadrícula. */
export function bootstrap(): Promise<void> {
  started ??= (async () => {
    await db.open();
    if (!(await db.settings.get('main'))) await db.settings.put(DEFAULT_SETTINGS);
    await useSell.getState().init();
    await refreshStats();
    // SPEC §2.2 (a): reordenar al abrir, salvo que un ticket en espera tenga productos.
    if (anyTicketHasLines(useSell.getState())) await loadGridOrder();
    else await recomputeGridOrder();
    // App abierta de un día para otro.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void recomputeIfNewDay(anyTicketHasLines(useSell.getState()));
    });
    // Pedir almacenamiento persistente para que el navegador no borre los datos.
    navigator.storage?.persist?.().catch(() => undefined);
  })();
  return started;
}
