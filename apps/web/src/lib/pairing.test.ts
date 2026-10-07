import { describe, expect, it } from 'bun:test';
import { formatCode, pairingSchema } from './pairing';

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
