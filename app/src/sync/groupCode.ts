/** "k7q2m 9xmpa" → "K7Q2M-9XMPA": el código del grupo de Nexo se teclea como venga. */
export function cleanGroupCode(text: string): string {
  const raw = text.toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 10);
  return raw.length > 5 ? `${raw.slice(0, 5)}-${raw.slice(5)}` : raw;
}

/** Completo: 5 + guion + 5. */
export const isGroupCode = (code: string): boolean => /^[0-9A-Z]{5}-[0-9A-Z]{5}$/.test(code);
