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
  theme: 'light',
  lastBackupAt: null,
};

export async function getSettings(): Promise<Settings> {
  return (await db.settings.get('main')) ?? DEFAULT_SETTINGS;
}

export async function updateSettings(patch: Partial<Omit<Settings, 'id'>>): Promise<void> {
  await db.transaction('rw', db.settings, async () => {
    const current = (await db.settings.get('main')) ?? DEFAULT_SETTINGS;
    await db.settings.put({ ...current, ...patch, id: 'main' });
  });
}
