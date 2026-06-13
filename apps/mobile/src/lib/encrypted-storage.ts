/**
 * Encrypted AsyncStorage wrapper for the TanStack Query persister.
 *
 * The mobile cache holds conversations, notes, and progression — all
 * personal data covered by GDPR. We keep the bulk store (AsyncStorage)
 * unchanged but encrypt every value at rest with ChaCha20-Poly1305 AEAD.
 * The symmetric key is generated once per install and sealed in
 * expo-secure-store (iOS Keychain / Android Keystore), so uninstalling
 * the app makes the persisted cache unrecoverable.
 *
 * Trade-off: ChaCha20-Poly1305 (AEAD) is preferred over AES-256-GCM here
 * because @stablelib is pure JS (no native rebuild) and ChaCha20 is
 * materially faster than software AES on ARM without AES-NI. Both offer
 * equivalent 256-bit authenticated encryption guarantees; ChaCha20 is
 * the RFC 8439 standard recommended by Google, Cloudflare, and the IETF
 * for constant-time software implementations.
 *
 * Layout of each persisted value (before base64 encoding):
 *   nonce(12) || ciphertext+tag(N + 16)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { ChaCha20Poly1305, KEY_LENGTH, NONCE_LENGTH } from '@stablelib/chacha20poly1305';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

export const CACHE_KEY_SECURE_STORE_NAME = 'TOMIA_CACHE_KEY';

interface EncryptedStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// Base64 helpers — avoids depending on Buffer (not available in RN by default).
// ---------------------------------------------------------------------------

const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

const BASE64_LOOKUP: Record<string, number> = (() => {
  const table: Record<string, number> = {};
  for (let i = 0; i < BASE64_ALPHABET.length; i += 1) {
    table[BASE64_ALPHABET[i] as string] = i;
  }
  return table;
})();

function bytesToBase64(bytes: Uint8Array): string {
  let output = '';
  const len = bytes.length;
  let i = 0;
  while (i + 3 <= len) {
    const a = bytes[i] as number;
    const b = bytes[i + 1] as number;
    const c = bytes[i + 2] as number;
    output += BASE64_ALPHABET[a >> 2];
    output += BASE64_ALPHABET[((a & 0x03) << 4) | (b >> 4)];
    output += BASE64_ALPHABET[((b & 0x0f) << 2) | (c >> 6)];
    output += BASE64_ALPHABET[c & 0x3f];
    i += 3;
  }
  const remaining = len - i;
  if (remaining === 1) {
    const a = bytes[i] as number;
    output += BASE64_ALPHABET[a >> 2];
    output += BASE64_ALPHABET[(a & 0x03) << 4];
    output += '==';
  } else if (remaining === 2) {
    const a = bytes[i] as number;
    const b = bytes[i + 1] as number;
    output += BASE64_ALPHABET[a >> 2];
    output += BASE64_ALPHABET[((a & 0x03) << 4) | (b >> 4)];
    output += BASE64_ALPHABET[(b & 0x0f) << 2];
    output += '=';
  }
  return output;
}

function base64ToBytes(input: string): Uint8Array {
  // Strip any whitespace then split off padding so we can validate characters.
  const trimmed = input.replace(/\s+/g, '');
  const padStripped = trimmed.replace(/=+$/, '');
  if (!/^[A-Za-z0-9+/]*$/.test(padStripped)) {
    throw new Error('Invalid base64 input');
  }

  const byteLength = Math.floor((padStripped.length * 6) / 8);
  const out = new Uint8Array(byteLength);
  let outIndex = 0;
  let buffer = 0;
  let bitsCollected = 0;
  for (let i = 0; i < padStripped.length; i += 1) {
    const value = BASE64_LOOKUP[padStripped[i] as string];
    if (value === undefined) throw new Error('Invalid base64 input');
    buffer = (buffer << 6) | value;
    bitsCollected += 6;
    if (bitsCollected >= 8) {
      bitsCollected -= 8;
      out[outIndex++] = (buffer >> bitsCollected) & 0xff;
    }
  }
  return out;
}

const utf8Encoder = new TextEncoder();
const utf8Decoder = new TextDecoder();

// ---------------------------------------------------------------------------
// Key management
// ---------------------------------------------------------------------------

async function loadOrCreateKey(): Promise<Uint8Array> {
  const existing = await SecureStore.getItemAsync(CACHE_KEY_SECURE_STORE_NAME);
  if (existing) {
    const bytes = base64ToBytes(existing);
    if (bytes.length === KEY_LENGTH) return bytes;
    // Corrupted key material — regenerate rather than fail loudly, since the
    // worst case is the cache being invalidated (not a data-loss event).
  }

  const fresh = await Crypto.getRandomBytesAsync(KEY_LENGTH);
  const keyBytes = fresh instanceof Uint8Array ? fresh : new Uint8Array(fresh);
  await SecureStore.setItemAsync(CACHE_KEY_SECURE_STORE_NAME, bytesToBase64(keyBytes));
  return keyBytes;
}

// ---------------------------------------------------------------------------
// AEAD helpers
// ---------------------------------------------------------------------------

async function encryptValue(plaintext: string, key: Uint8Array): Promise<string> {
  const cipher = new ChaCha20Poly1305(key);
  const nonceRaw = await Crypto.getRandomBytesAsync(NONCE_LENGTH);
  const nonce = nonceRaw instanceof Uint8Array ? nonceRaw : new Uint8Array(nonceRaw);
  const sealed = cipher.seal(nonce, utf8Encoder.encode(plaintext));

  const combined = new Uint8Array(NONCE_LENGTH + sealed.length);
  combined.set(nonce, 0);
  combined.set(sealed, NONCE_LENGTH);
  return bytesToBase64(combined);
}

function decryptValue(payload: string, key: Uint8Array): string | null {
  let combined: Uint8Array;
  try {
    combined = base64ToBytes(payload);
  } catch {
    return null;
  }
  if (combined.length <= NONCE_LENGTH) return null;

  const nonce = combined.subarray(0, NONCE_LENGTH);
  const sealed = combined.subarray(NONCE_LENGTH);

  try {
    const cipher = new ChaCha20Poly1305(key);
    const plaintext = cipher.open(nonce, sealed);
    if (!plaintext) return null;
    return utf8Decoder.decode(plaintext);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Public factory
// ---------------------------------------------------------------------------

/**
 * Builds an AsyncStorage-compatible object that transparently encrypts values
 * using a device-local ChaCha20-Poly1305 key pinned in SecureStore.
 *
 * Safe to call multiple times: the key is loaded lazily on first use and
 * cached per factory instance. Fresh instances share the same on-device key
 * because SecureStore is the single source of truth.
 */
export function createEncryptedStorage(): EncryptedStorage {
  let keyPromise: Promise<Uint8Array> | null = null;

  function getKey(): Promise<Uint8Array> {
    if (!keyPromise) keyPromise = loadOrCreateKey();
    return keyPromise;
  }

  return {
    async getItem(key: string): Promise<string | null> {
      const stored = await AsyncStorage.getItem(key);
      if (stored === null) return null;
      try {
        const symmetricKey = await getKey();
        return decryptValue(stored, symmetricKey);
      } catch (error) {
        // Any failure (corrupted key, legacy cache, tampered payload) must
        // degrade gracefully — the persister will simply repopulate from the
        // network rather than crash the app on startup.
        console.warn('[encrypted-storage] getItem decrypt failed, returning null', error);
        return null;
      }
    },

    async setItem(key: string, value: string): Promise<void> {
      const symmetricKey = await getKey();
      const ciphertext = await encryptValue(value, symmetricKey);
      await AsyncStorage.setItem(key, ciphertext);
    },

    async removeItem(key: string): Promise<void> {
      await AsyncStorage.removeItem(key);
    },
  };
}
