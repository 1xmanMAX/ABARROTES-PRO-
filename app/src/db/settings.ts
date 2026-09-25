import { DEFAULT_MAX_HAGGLE } from '../domain/haggle';
import { db } from './schema';
import type { Settings } from './types';

export const DEFAULT_SETTINGS: Settings = {
  id: 'main',
  shopName: 'Mi Bodega',
  receiptFooter: '¡Gracias por su compra!',
  paperWidth: 58,
  gridOrder: [],
  gridOrderComputedAt: null,
  openingCash: 0,
  maxHaggle: DEFAULT_MAX_HAGGLE,
  theme: 'light',
  lastBackupAt: null,
};

export async function getSettings(): Promise<Settings> {
  // Completar campos nuevos en ajustes guardados por versiones anteriores.
  return { ...DEFAULT_SETTINGS, ...(await db.settings.get('main')) };
}

export async function updateSettings(patch: Partial<Omit<Settings, 'id'>>): Promise<void> {
  await db.transaction('rw', db.settings, async () => {
    const current = (await db.settings.get('main')) ?? DEFAULT_SETTINGS;
    await db.settings.put({ ...current, ...patch, id: 'main' });
  });
}
