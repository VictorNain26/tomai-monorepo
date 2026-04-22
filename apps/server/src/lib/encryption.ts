/**
 * AES-256-GCM Encryption Utility for Pronote Tokens
 *
 * Uses native Web Crypto API (supported by Bun)
 * - AES-256-GCM for authenticated encryption
 * - Random IV per encryption (prevents pattern detection)
 * - Random salt per encryption so PBKDF2-derived keys differ per record.
 *   If PRONOTE_ENCRYPTION_KEY ever leaks, an attacker still needs to run
 *   PBKDF2 (600K iterations) per record rather than bulk-deriving once.
 * - Base64 encoding for storage
 */

const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12; // 96 bits recommended for GCM
const SALT_LENGTH = 16; // 128 bits of entropy per record
const TAG_LENGTH = 128; // Authentication tag bits
const PBKDF2_ITERATIONS = 600000; // OWASP 2023 recommendation for SHA-256

/**
 * Reads the Pronote encryption secret from env and imports it as PBKDF2 key material.
 * Fails fast if the secret is missing or too short.
 */
async function importSecretKeyMaterial(): Promise<CryptoKey> {
  const secret = process.env['PRONOTE_ENCRYPTION_KEY'];

  if (!secret || secret.length < 32) {
    throw new Error(
      'PRONOTE_ENCRYPTION_KEY must be set and at least 32 characters. ' +
      'Generate with: openssl rand -base64 32'
    );
  }

  const encoder = new TextEncoder();
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );
}

/**
 * Derives a unique AES-256 key from the env secret + a per-record salt.
 *
 * The caller passes a raw byte buffer (ArrayBuffer) so this module stays
 * lib-agnostic (the `@repo/api` Eden Treaty pulls types from this file into
 * the mobile project, whose tsconfig uses Node types instead of DOM types).
 */
async function deriveKey(saltBuffer: ArrayBuffer): Promise<CryptoKey> {
  const keyMaterial = await importSecretKeyMaterial();

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBuffer,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
}

function toArrayBuffer(view: Uint8Array): ArrayBuffer {
  // Copy into a fresh ArrayBuffer to avoid SharedArrayBuffer typing ambiguity
  // surfaced by downstream consumers (mobile tsc pulls Node types).
  const out = new ArrayBuffer(view.byteLength);
  new Uint8Array(out).set(view);
  return out;
}

/**
 * Encrypts plaintext using AES-256-GCM with a per-record random salt.
 *
 * Output layout (base64-encoded): salt(16) || iv(12) || ciphertext+tag
 */
export async function encrypt(plaintext: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const key = await deriveKey(toArrayBuffer(salt));

  const ciphertext = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv: toArrayBuffer(iv), tagLength: TAG_LENGTH },
    key,
    new TextEncoder().encode(plaintext)
  );

  const combined = new Uint8Array(SALT_LENGTH + IV_LENGTH + ciphertext.byteLength);
  combined.set(salt, 0);
  combined.set(iv, SALT_LENGTH);
  combined.set(new Uint8Array(ciphertext), SALT_LENGTH + IV_LENGTH);

  return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypts AES-256-GCM payloads produced by encrypt().
 *
 * @throws Error if decryption fails (tampered data, wrong key, legacy format)
 */
export async function decrypt(encryptedData: string): Promise<string> {
  const combined = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));

  if (combined.byteLength < SALT_LENGTH + IV_LENGTH + 1) {
    throw new Error('Ciphertext too short — possibly corrupted or legacy format');
  }

  const salt = combined.slice(0, SALT_LENGTH);
  const iv = combined.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const ciphertext = combined.slice(SALT_LENGTH + IV_LENGTH);

  const key = await deriveKey(toArrayBuffer(salt));
  const plaintext = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv: toArrayBuffer(iv), tagLength: TAG_LENGTH },
    key,
    toArrayBuffer(ciphertext)
  );

  return new TextDecoder().decode(plaintext);
}

/**
 * Validates that encryption key is properly configured
 * Call this at app startup to fail fast
 */
export async function validateEncryptionSetup(): Promise<boolean> {
  try {
    const testData = 'pronote-encryption-test';
    const encrypted = await encrypt(testData);
    const decrypted = await decrypt(encrypted);
    return decrypted === testData;
  } catch {
    return false;
  }
}
