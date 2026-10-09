import { z } from './zod';

/** The code as the guardian reads it out: two groups of four. */
export const formatCode = (code: string) => `${code.slice(0, 4)}-${code.slice(4)}`;

/** The code as the child types it: the server reads it with or without its dash and spaces. */
export const pairingSchema = z.object({ code: z.string().trim().min(8, 'Les 8 caractères du code.').max(32, 'Le code a 8 caractères.') });

/** What the QR code holds: the pairing page of this origin, the code filled in. */
export const pairingLink = (origin: string, code: string) => `${origin}/jumeler?code=${encodeURIComponent(code)}`;

/** The dark modules of a QR matrix as one SVG path, a unit square each: no markup of a library's. */
export const qrPath = (matrix: readonly (readonly boolean[])[]) =>
  matrix.flatMap((row, y) => row.flatMap((dark, x) => (dark ? [`M${String(x)} ${String(y)}h1v1h-1z`] : []))).join('');
