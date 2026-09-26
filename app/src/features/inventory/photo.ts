/** Comprime una foto a JPEG de ~200 KB como máximo (lado mayor 640 px). */
export async function compressPhoto(file: File, maxBytes = 200_000): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  let side = 640;
  let quality = 0.82;
  for (let attempt = 0; attempt < 6; attempt++) {
    const scale = Math.min(1, side / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', quality));
    if (blob && (blob.size <= maxBytes || attempt === 5)) return blob;
    quality -= 0.12;
    side = Math.round(side * 0.85);
  }
  throw new Error('No se pudo comprimir la foto');
}
