import { describe, expect, it } from 'bun:test';
import encodeQR from 'qr';
import decodeQR from 'qr/decode.js';
import { formatCode, pairingLink, pairingSchema, QR_BORDER, qrPath } from './pairing';

/** The matrix as the QR component draws it, its quiet zone included by the encoder, in RGBA pixels. */
function raster(matrix: boolean[][], scale = 4) {
  const size = matrix.length * scale;
  const data = new Uint8ClampedArray(size * size * 4).fill(255);
  matrix.forEach((row, y) => {
    row.forEach((dark, x) => {
      if (!dark) return;
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const offset = ((y * scale + dy) * size + x * scale + dx) * 4;
          data.fill(0, offset, offset + 3);
        }
      }
    });
  });
  return { width: size, height: size, data };
}

describe('formatCode', () => {
  it('splits the eight characters in two groups', () => {
    expect(formatCode('ABCD2345')).toBe('ABCD-2345');
  });
});

describe('pairingSchema', () => {
  it('takes the code with or without its dash, trimmed', () => {
    expect(pairingSchema.parse({ code: ' ABCD-2345 ' }).code).toBe('ABCD-2345');
    expect(pairingSchema.safeParse({ code: 'ABCD2345' }).success).toBe(true);
  });

  it('refuses a code too short, or far too long', () => {
    expect(pairingSchema.safeParse({ code: 'ABCD234' }).success).toBe(false);
    expect(pairingSchema.safeParse({ code: 'A'.repeat(33) }).success).toBe(false);
  });
});

describe('pairingLink', () => {
  it('opens the pairing page of this origin with the code filled in, its dash kept', () => {
    expect(pairingLink('https://staging.tomia.fr', 'ABCD1234')).toBe('https://staging.tomia.fr/jumeler?code=ABCD-1234');
  });

  it('keeps a code of digits from reading as a number in the router’s search, as JSON would read it', () => {
    const code = new URL(pairingLink('https://staging.tomia.fr', '48213907')).searchParams.get('code') ?? '';
    expect(() => JSON.parse(code) as unknown).toThrow();
  });
});

describe('the QR code of a pairing', () => {
  it('reads back as the link, as a phone camera reads it', () => {
    const link = pairingLink('https://staging.tomia.fr', 'ABCD1234');
    expect(decodeQR(raster(encodeQR(link, 'raw', { border: QR_BORDER })))).toBe(link);
  });
});

describe('qrPath', () => {
  it('draws each run of dark modules of a row as one rectangle, and nothing for a light one', () => {
    expect(
      qrPath([
        [true, true, false, true],
        [false, true, false, false],
      ]),
    ).toBe('M0 0h2v1h-2zM3 0h1v1h-1zM1 1h1v1h-1z');
  });
});
