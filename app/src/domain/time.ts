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
