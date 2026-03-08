/**
 * Tests unitaires - AES-256-GCM Encryption (lib/encryption.ts)
 * 0 mocks — tests la vraie implémentation crypto
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';

// Set encryption key for tests
const TEST_KEY = 'a'.repeat(32) + 'b'.repeat(8); // 40 chars, > 32 min
const originalKey = process.env['PRONOTE_ENCRYPTION_KEY'];

beforeAll(() => {
  process.env['PRONOTE_ENCRYPTION_KEY'] = TEST_KEY;
});

afterAll(() => {
  if (originalKey !== undefined) {
    process.env['PRONOTE_ENCRYPTION_KEY'] = originalKey;
  } else {
    delete process.env['PRONOTE_ENCRYPTION_KEY'];
  }
});

// Import after env setup
const { encrypt, decrypt, validateEncryptionSetup } = await import('../lib/encryption');

describe('Encryption Service', () => {
  describe('Roundtrip encrypt/decrypt', () => {
    it('should encrypt and decrypt plain text', async () => {
      const plaintext = 'hello world';
      const encrypted = await encrypt(plaintext);
      const decrypted = await decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it('should encrypt and decrypt unicode/accents', async () => {
      const plaintext = 'Bonjour les élèves ! Ça va ? É à ü ñ 日本語';
      const encrypted = await encrypt(plaintext);
      const decrypted = await decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it('should encrypt and decrypt empty string', async () => {
      const encrypted = await encrypt('');
      const decrypted = await decrypt(encrypted);
      expect(decrypted).toBe('');
    });

    it('should encrypt and decrypt long text', async () => {
      const plaintext = 'x'.repeat(10_000);
      const encrypted = await encrypt(plaintext);
      const decrypted = await decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });
  });

  describe('Random IV (unique ciphertexts)', () => {
    it('should produce different ciphertexts for the same plaintext', async () => {
      const plaintext = 'same input';
      const encrypted1 = await encrypt(plaintext);
      const encrypted2 = await encrypt(plaintext);
      expect(encrypted1).not.toBe(encrypted2);

      // Both should decrypt to the same value
      expect(await decrypt(encrypted1)).toBe(plaintext);
      expect(await decrypt(encrypted2)).toBe(plaintext);
    });
  });

  describe('Corrupted/tampered data', () => {
    it('should throw on corrupted ciphertext', async () => {
      const encrypted = await encrypt('test data');
      const corrupted = encrypted.slice(0, -4) + 'XXXX';
      await expect(decrypt(corrupted)).rejects.toThrow();
    });

    it('should throw on truncated data', async () => {
      const encrypted = await encrypt('test data');
      const truncated = encrypted.slice(0, 10);
      await expect(decrypt(truncated)).rejects.toThrow();
    });

    it('should throw on completely invalid base64', async () => {
      await expect(decrypt('not-valid-base64!!!')).rejects.toThrow();
    });
  });

  describe('Key validation', () => {
    it('should throw when key is missing', async () => {
      const saved = process.env['PRONOTE_ENCRYPTION_KEY'];
      delete process.env['PRONOTE_ENCRYPTION_KEY'];

      // Need to re-import to pick up env change — test via validateEncryptionSetup
      // Since deriveKey() is called inside encrypt, calling encrypt directly tests it
      try {
        // validateEncryptionSetup catches errors and returns false
        const result = await validateEncryptionSetup();
        expect(result).toBe(false);
      } finally {
        process.env['PRONOTE_ENCRYPTION_KEY'] = saved;
      }
    });

    it('should throw when key is too short', async () => {
      const saved = process.env['PRONOTE_ENCRYPTION_KEY'];
      process.env['PRONOTE_ENCRYPTION_KEY'] = 'short';

      try {
        const result = await validateEncryptionSetup();
        expect(result).toBe(false);
      } finally {
        process.env['PRONOTE_ENCRYPTION_KEY'] = saved;
      }
    });
  });

  describe('validateEncryptionSetup', () => {
    it('should return true when properly configured', async () => {
      const result = await validateEncryptionSetup();
      expect(result).toBe(true);
    });
  });
});
