export const SHOP_TIME_ZONE = 'America/Lima';

const dayFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: SHOP_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
const hourFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: SHOP_TIME_ZONE,
  hour: '2-digit',
  hourCycle: 'h23',
});

/** 'YYYY-MM-DD' en hora de Lima. */
export function dayKeyOf(epochMs: number): string {
  return dayFmt.format(new Date(epochMs));
}

/** Hora del día (0–23) en Lima. */
export function hourOf(epochMs: number): number {
  return Number(hourFmt.format(new Date(epochMs))) % 24;
}

const displayFmt = new Intl.DateTimeFormat('es-PE', {
  timeZone: SHOP_TIME_ZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export function formatDateTime(epochMs: number): string {
  return displayFmt.format(new Date(epochMs));
}

/** Los últimos `n` días (hora de Lima), del más antiguo a hoy. */
export function lastDayKeys(n: number, now: number): string[] {
  const noon = Date.parse(`${dayKeyOf(now)}T12:00:00-05:00`);
  return Array.from({ length: n }, (_, i) => dayKeyOf(noon - (n - 1 - i) * 86_400_000));
}

/** Días entre dos dayKey, contando ambos. */
export function daysBetween(fromKey: string, toKey: string): number {
  return Math.round((Date.parse(`${toKey}T12:00:00-05:00`) - Date.parse(`${fromKey}T12:00:00-05:00`)) / 86_400_000) + 1;
}

const timeFmt = new Intl.DateTimeFormat('es-PE', { timeZone: SHOP_TIME_ZONE, hour: '2-digit', minute: '2-digit' });
export function formatTime(epochMs: number): string {
  return timeFmt.format(new Date(epochMs));
}

const shortDayFmt = new Intl.DateTimeFormat('es-PE', {
  timeZone: SHOP_TIME_ZONE,
  weekday: 'short',
  day: '2-digit',
  month: '2-digit',
});
/** 'YYYY-MM-DD' → "jue., 25/09". */
export function formatDayKey(dayKey: string): string {
  return shortDayFmt.format(new Date(Date.parse(`${dayKey}T12:00:00-05:00`)));
}
