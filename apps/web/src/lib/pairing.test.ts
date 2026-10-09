import { describe, expect, it } from 'bun:test';
import encodeQR from 'qr';
import decodeQR from 'qr/decode.js';
import { pairingLink, qrPath } from './pairing';

/** The matrix drawn as the QR component draws it, four modules of quiet zone, in RGBA pixels. */
function raster(matrix: boolean[][], scale = 4, margin = 4) {
  const size = (matrix.length + 2 * margin) * scale;
  const data = new Uint8ClampedArray(size * size * 4).fill(255);
  matrix.forEach((row, y) => {
    row.forEach((dark, x) => {
      if (!dark) return;
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const offset = (((y + margin) * scale + dy) * size + (x + margin) * scale + dx) * 4;
          data.fill(0, offset, offset + 3);
        }
      }
    });
  });
  return { width: size, height: size, data };
}

describe('pairingLink', () => {
  it('opens the pairing page of this origin with the code filled in', () => {
    expect(pairingLink('https://staging.tomia.fr', 'ABCD1234')).toBe('https://staging.tomia.fr/jumeler?code=ABCD1234');
  });
});

describe('the QR code of a pairing', () => {
  it('reads back as the link, as a phone camera reads it', () => {
    const link = pairingLink('https://staging.tomia.fr', 'ABCD1234');
    expect(decodeQR(raster(encodeQR(link, 'raw')))).toBe(link);
  });
});

describe('qrPath', () => {
  it('draws each dark module as a one-unit square, row by row, and nothing for a light one', () => {
    expect(
      qrPath([
        [true, false],
        [false, true],
      ]),
    ).toBe('M0 0h1v1h-1zM1 1h1v1h-1z');
  });
});
