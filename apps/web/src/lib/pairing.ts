import { z } from './zod';

/** The code as the guardian reads it out: two groups of four. */
export const formatCode = (code: string) => `${code.slice(0, 4)}-${code.slice(4)}`;

/** The code as the child types it: the server reads it with or without its dash and spaces. */
export const pairingSchema = z.object({ code: z.string().trim().min(8, 'Les 8 caractères du code.').max(32, 'Le code a 8 caractères.') });

/**
 * What the QR code holds: the pairing page of this origin, the code filled in. With its dash: the
 * router JSON-parses a search value that starts with a digit, and « 48213907 » would arrive as a
 * number, « 4821-3907 » stays text.
 */
export const pairingLink = (origin: string, code: string) => `${origin}/jumeler?code=${encodeURIComponent(formatCode(code))}`;

/** The quiet zone a reader needs around a QR code, in modules (ISO/IEC 18004). */
export const QR_BORDER = 4;

/** The dark modules of a QR matrix as one SVG path, a rectangle per run in a row: no markup of a library's. */
export function qrPath(matrix: readonly (readonly boolean[])[]): string {
  return matrix
    .flatMap((row, y) => {
      const runs: string[] = [];
      let start = -1;
      row.forEach((dark, x) => {
        if (dark && start === -1) start = x;
        if (start !== -1 && (!dark || x === row.length - 1)) {
          const width = (dark ? x + 1 : x) - start;
          runs.push(`M${String(start)} ${String(y)}h${String(width)}v1h-${String(width)}z`);
          start = -1;
        }
      });
      return runs;
    })
    .join('');
}
