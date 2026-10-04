import { Capacitor } from '@capacitor/core';
import { TextToSpeech } from '@capacitor-community/text-to-speech';

/**
 * Lectura en voz alta (opcional, Ajustes → Leer en voz alta). Es un apoyo: la pantalla
 * siempre muestra lo mismo. Nunca se usa para códigos de clientes (CLAUDE.md regla 10).
 * Si el aparato no tiene voz en español, falla en silencio.
 */
const LANGS = ['es-PE', 'es-US', 'es-419', 'es-MX', 'es-ES'];

let nativeLang: string | null | undefined;

async function pickNativeLang(): Promise<string | null> {
  if (nativeLang !== undefined) return nativeLang;
  nativeLang = null;
  for (const lang of LANGS) {
    try {
      if ((await TextToSpeech.isLanguageSupported({ lang })).supported) {
        nativeLang = lang;
        break;
      }
    } catch {
      break;
    }
  }
  return nativeLang;
}

function pickWebVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  const norm = (l: string) => l.replace('_', '-').toLowerCase();
  for (const lang of LANGS) {
    const v = voices.find((x) => norm(x.lang) === lang.toLowerCase() && x.localService) ?? voices.find((x) => norm(x.lang) === lang.toLowerCase());
    if (v) return v;
  }
  return voices.find((x) => norm(x.lang).startsWith('es')) ?? null;
}

export async function speak(text: string): Promise<void> {
  try {
    if (Capacitor.isNativePlatform()) {
      const lang = await pickNativeLang();
      if (!lang) return;
      await TextToSpeech.stop().catch(() => undefined);
      await TextToSpeech.speak({ text, lang, rate: 0.95, volume: 1, queueStrategy: 0 });
      return;
    }
    if (!('speechSynthesis' in window)) return;
    const u = new SpeechSynthesisUtterance(text);
    const voice = pickWebVoice();
    if (voice) u.voice = voice;
    u.lang = voice?.lang ?? 'es-PE';
    u.rate = 0.95;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  } catch {
    /* sin voz: la pantalla basta */
  }
}
