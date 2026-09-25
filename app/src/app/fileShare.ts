import { Capacitor } from '@capacitor/core';

export type SaveResult = 'shared' | 'downloaded';

/**
 * Entrega un archivo de texto al usuario para que lo guarde fuera del teléfono:
 * en el APK, con el menú "Compartir" de Android (WhatsApp, Drive, correo…);
 * en Chrome, con compartir nativo o descarga.
 */
export async function saveOrShareFile(fileName: string, text: string, title: string): Promise<SaveResult> {
  if (Capacitor.isNativePlatform()) {
    const [{ Filesystem, Directory, Encoding }, { Share }] = await Promise.all([
      import('@capacitor/filesystem'),
      import('@capacitor/share'),
    ]);
    const { uri } = await Filesystem.writeFile({
      path: fileName,
      data: text,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    });
    await Share.share({ title, files: [uri] });
    return 'shared';
  }
  const file = new File([text], fileName, { type: 'application/json' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title });
      return 'shared';
    } catch (err) {
      // Cancelado por el usuario o sin gesto reciente: se descarga igual.
      if (err instanceof DOMException && err.name === 'AbortError') throw err;
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return 'downloaded';
}
