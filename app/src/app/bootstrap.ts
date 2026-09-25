import { db } from '../db/schema';
import { DEFAULT_SETTINGS } from '../db/settings';
import { useSell } from '../features/sell/sellStore';
import { recomputeGridOrder } from './data';

let started: Promise<void> | null = null;

/** Arranque: ajustes por defecto, orden de cuadrícula (SPEC §2.2a) y tickets en espera. */
export function bootstrap(): Promise<void> {
  started ??= (async () => {
    await db.open();
    if (!(await db.settings.get('main'))) await db.settings.put(DEFAULT_SETTINGS);
    await recomputeGridOrder();
    await useSell.getState().init();
    // Pedir almacenamiento persistente para que el navegador no borre los datos.
    navigator.storage?.persist?.().catch(() => undefined);
  })();
  return started;
}
