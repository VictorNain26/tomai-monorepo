/**
 * AES-256-GCM Encryption Utility for Pronote Tokens
 *
 * Uses native Web Crypto API (supported by Bun)
 * - AES-256-GCM for authenticated encryption
 * - Random IV per encryption (prevents pattern detection)
 * - Base64 encoding for storage
 */

const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12; // 96 bits recommended for GCM
const TAG_LENGTH = 128; // Authentication tag bits

/**
 * Derives a CryptoKey from the environment secret
 * Uses PBKDF2 for key derivation from passphrase
 */
async function deriveKey(): Promise<CryptoKey> {
  const secret = process.env['PRONOTE_ENCRYPTION_KEY'];

  if (!secret || secret.length < 32) {
    throw new Error(
      'PRONOTE_ENCRYPTION_KEY must be set and at least 32 characters. ' +
      'Generate with: openssl rand -base64 32'
    );
  }

  // Import the secret as a raw key material
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );

  // Derive AES-256 key using PBKDF2
  // Salt is fixed (derived from app name) - acceptable since secret is high-entropy
  // OWASP 2023: 600,000 iterations minimum for SHA-256
  const salt = encoder.encode('tomai-pronote-v2'); // v2 for new iteration count

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 600000, // OWASP 2023 recommendation
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts plaintext using AES-256-GCM
 *
 * @param plaintext - The data to encrypt
 * @returns Base64 encoded string: IV + ciphertext + tag
 */
export async function encrypt(plaintext: string): Promise<string> {
  const key = await deriveKey();
  const encoder = new TextEncoder();

  // Generate random IV
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

  // Encrypt
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: ALGORITHM,
      iv,
      tagLength: TAG_LENGTH
    },
    key,
    encoder.encode(plaintext)
  );

  // Combine IV + ciphertext (tag is appended by GCM)
  const combined = new Uint8Array(IV_LENGTH + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), IV_LENGTH);

  // Base64 encode for storage
  return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypts AES-256-GCM encrypted data
 *
 * @param encryptedData - Base64 encoded string from encrypt()
 * @returns Original plaintext
 * @throws Error if decryption fails (tampered data, wrong key)
 */
export async function decrypt(encryptedData: string): Promise<string> {
  const key = await deriveKey();

  // Base64 decode
  const combined = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));

  // Extract IV and ciphertext
  const iv = combined.slice(0, IV_LENGTH);
  const ciphertext = combined.slice(IV_LENGTH);

  // Decrypt
  const plaintext = await crypto.subtle.decrypt(
    {
      name: ALGORITHM,
      iv,
      tagLength: TAG_LENGTH
    },
    key,
    ciphertext
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
