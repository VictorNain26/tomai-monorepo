/** A photo of the homework, cut down on the phone before it goes: the server takes 3 MB at most. */

import type { TurnBody } from './chat';

export type PhotoUpload = NonNullable<TurnBody['image']>;

/** What the conversation shows of a photo sent without a word, as the server stores it. */
export const PHOTO_ONLY = 'Photo envoyée';

// Wide enough for a page of handwriting, small enough to send in a second on a phone's network.
const MAX_SIDE = 1600;
const QUALITY = 0.85;

/** The photo as JPEG, its longest side at most 1 600 px, in base64. */
export async function preparePhoto(file: Blob): Promise<PhotoUpload> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('No 2D canvas to cut the photo down');
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const jpeg = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('The photo could not be encoded'));
      },
      'image/jpeg',
      QUALITY,
    );
  });
  const bytes = new Uint8Array(await jpeg.arrayBuffer());
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return { mediaType: 'image/jpeg', data: btoa(binary) };
}
