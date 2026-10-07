import { describe, expect, it } from 'bun:test';
import { normalisePairingCode } from './pairing';

describe('normalisePairingCode', () => {
  it('uppercases and drops the spaces and dashes a person types', () => {
    expect(normalisePairingCode(' ab3d-7fgh ')).toBe('AB3D7FGH');
  });

  it("reads the letters O, I and L as the digits they look like (Crockford's base32)", () => {
    expect(normalisePairingCode('kOmI-2l4o')).toBe('K0M12140');
  });

  it('leaves a code already in canonical form unchanged', () => {
    expect(normalisePairingCode('8G0WTQV9')).toBe('8G0WTQV9');
  });
});
