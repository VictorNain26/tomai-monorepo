/**
 * Tests unitaires - AES-256-GCM Encryption (lib/encryption.ts)
 * 0 mocks — tests la vraie implémentation crypto (except config/env module)
 */

import { describe, it, expect, mock, afterEach } from 'bun:test';

// Mock env module BEFORE importing encryption.ts
// encryption.ts reads env.PRONOTE_ENCRYPTION_KEY at runtime (in importSecretKeyMaterial)
const TEST_KEY = 'a'.repeat(32) + 'b'.repeat(8); // 40 chars, > 32 min

// Make env mutable so tests can change PRONOTE_ENCRYPTION_KEY per case
const mockEnv: { PRONOTE_ENCRYPTION_KEY?: string; NODE_ENV: string } = {
  PRONOTE_ENCRYPTION_KEY: TEST_KEY,
  NODE_ENV: 'test',
};

mock.module('../config/env', () => ({
  env: mockEnv,
}));

// Import after mock is set
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

    it('should produce different salt prefixes for the same plaintext', async () => {
      // With a per-record random salt, the first 16 bytes of the ciphertext
      // (the salt) must differ between two encryptions of the same plaintext.
      const plaintext = 'same input';
      const enc1 = await encrypt(plaintext);
      const enc2 = await encrypt(plaintext);

      const bytes1 = Uint8Array.from(atob(enc1), c => c.charCodeAt(0));
      const bytes2 = Uint8Array.from(atob(enc2), c => c.charCodeAt(0));
      const salt1 = Array.from(bytes1.slice(0, 16)).join(',');
      const salt2 = Array.from(bytes2.slice(0, 16)).join(',');
      expect(salt1).not.toBe(salt2);
    });
  });

  describe('Corrupted/tampered data', () => {
    it('should throw on corrupted ciphertext', async () => {
      const encrypted = await encrypt('test data');
      const corrupted = encrypted.slice(0, -4) + 'XXXX';
      expect(decrypt(corrupted)).rejects.toThrow();
    });

    it('should throw on truncated data', async () => {
      const encrypted = await encrypt('test data');
      const truncated = encrypted.slice(0, 10);
      expect(decrypt(truncated)).rejects.toThrow();
    });

    it('should throw on completely invalid base64', async () => {
      expect(decrypt('not-valid-base64!!!')).rejects.toThrow();
    });
  });


  describe('validateEncryptionSetup', () => {
    it('should return true when properly configured', async () => {
      const result = await validateEncryptionSetup();
      expect(result).toBe(true);
    });
  });

  describe('Key validation', () => {
    afterEach(() => {
      // Restore valid key for subsequent tests
      mockEnv.PRONOTE_ENCRYPTION_KEY = TEST_KEY;
    });

    it('should throw when key is missing', async () => {
      mockEnv.PRONOTE_ENCRYPTION_KEY = undefined;
      expect(encrypt('data')).rejects.toThrow(/at least 32 characters/);
    });

    it('should throw when key is too short', async () => {
      mockEnv.PRONOTE_ENCRYPTION_KEY = 'short';
      expect(encrypt('data')).rejects.toThrow(/at least 32 characters/);
    });
  });
});
