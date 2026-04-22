/**
 * Encrypted Storage Tests
 *
 * Validates AES-256-GCM-equivalent (ChaCha20-Poly1305 AEAD) wrapper around
 * AsyncStorage used by the TanStack Query persister. Critical properties:
 * - roundtrip setItem/getItem preserves the original value
 * - corrupted or legacy plaintext caches degrade gracefully to null (migration)
 * - each setItem uses a fresh nonce → identical plaintext yields distinct ciphertexts
 * - key is generated once in SecureStore, then reused across calls
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';

import { CACHE_KEY_SECURE_STORE_NAME, createEncryptedStorage } from '@/lib/encrypted-storage';

// ---------------------------------------------------------------------------
// expo-crypto mock — random bytes must be deterministic-per-call but vary
// across calls so we can assert unique nonces.
// ---------------------------------------------------------------------------

jest.mock('expo-crypto', () => ({
  getRandomBytesAsync: jest.fn(async (length: number) => {
    const out = new Uint8Array(length);
    for (let i = 0; i < length; i += 1) {
      out[i] = Math.floor(Math.random() * 256);
    }
    return out;
  }),
}));

const asyncStorageMock = AsyncStorage as jest.Mocked<typeof AsyncStorage>;
const secureStoreMock = SecureStore as jest.Mocked<typeof SecureStore>;

function resetMocks(): void {
  asyncStorageMock.getItem.mockReset();
  asyncStorageMock.setItem.mockReset();
  asyncStorageMock.removeItem.mockReset();
  asyncStorageMock.getItem.mockResolvedValue(null);
  asyncStorageMock.setItem.mockResolvedValue();
  asyncStorageMock.removeItem.mockResolvedValue();

  secureStoreMock.getItemAsync.mockReset();
  secureStoreMock.setItemAsync.mockReset();
  secureStoreMock.deleteItemAsync.mockReset();
  secureStoreMock.getItemAsync.mockResolvedValue(null);
  secureStoreMock.setItemAsync.mockResolvedValue();
  secureStoreMock.deleteItemAsync.mockResolvedValue();
}

/**
 * In-memory AsyncStorage: routes setItem → getItem so roundtrip tests work.
 */
function installAsyncStorageBackend(): void {
  const store = new Map<string, string>();
  asyncStorageMock.setItem.mockImplementation(async (key, value) => {
    store.set(key, value);
  });
  asyncStorageMock.getItem.mockImplementation(async (key) => store.get(key) ?? null);
  asyncStorageMock.removeItem.mockImplementation(async (key) => {
    store.delete(key);
  });
}

/**
 * SecureStore that remembers a single key so the second setItem round
 * reuses the AES key generated on the first call.
 */
function installSecureStoreBackend(): void {
  const store = new Map<string, string>();
  secureStoreMock.setItemAsync.mockImplementation(async (key, value) => {
    store.set(key, value);
  });
  secureStoreMock.getItemAsync.mockImplementation(async (key) => store.get(key) ?? null);
  secureStoreMock.deleteItemAsync.mockImplementation(async (key) => {
    store.delete(key);
  });
}

describe('encrypted-storage', () => {
  beforeEach(() => {
    resetMocks();
    installAsyncStorageBackend();
    installSecureStoreBackend();
  });

  it('roundtrips setItem → getItem and returns the original value', async () => {
    const storage = createEncryptedStorage();
    const value = JSON.stringify({ hello: 'world', n: 42 });

    await storage.setItem('cache', value);
    const roundtrip = await storage.getItem('cache');

    expect(roundtrip).toBe(value);
  });

  it('returns null for missing keys without throwing', async () => {
    const storage = createEncryptedStorage();
    const result = await storage.getItem('never-written');
    expect(result).toBeNull();
  });

  it('returns null (not throws) when the stored value is corrupted or legacy plaintext', async () => {
    const storage = createEncryptedStorage();

    // Simulate an old pre-encryption cache: raw JSON never produced by us.
    await asyncStorageMock.setItem('legacy-cache', '{"queries":[]}');

    const result = await storage.getItem('legacy-cache');
    expect(result).toBeNull();

    // Completely random base64 should also decrypt to null, not crash.
    await asyncStorageMock.setItem('garbage', 'bm90LXJlYWxseS1jaXBoZXJ0ZXh0');
    const garbage = await storage.getItem('garbage');
    expect(garbage).toBeNull();
  });

  it('produces different ciphertexts for identical plaintext (random nonce)', async () => {
    const storage = createEncryptedStorage();
    const value = 'same payload twice';

    await storage.setItem('slot', value);
    const firstCiphertext = await asyncStorageMock.getItem('slot');

    await storage.setItem('slot', value);
    const secondCiphertext = await asyncStorageMock.getItem('slot');

    expect(firstCiphertext).not.toBeNull();
    expect(secondCiphertext).not.toBeNull();
    expect(firstCiphertext).not.toBe(secondCiphertext);
    // Both must still decrypt back to the original plaintext.
    expect(await storage.getItem('slot')).toBe(value);
  });

  it('generates the encryption key on the first setItem and persists it in SecureStore', async () => {
    const storage = createEncryptedStorage();
    await storage.setItem('first', 'payload');

    expect(secureStoreMock.setItemAsync).toHaveBeenCalledTimes(1);
    const [keyName, keyValue] = secureStoreMock.setItemAsync.mock.calls[0] ?? [];
    expect(keyName).toBe(CACHE_KEY_SECURE_STORE_NAME);
    expect(typeof keyValue).toBe('string');
    expect((keyValue ?? '').length).toBeGreaterThan(0);
    // Exactly one secure random fetch for the key (32B) + one per setItem for the nonce (12B).
    expect(Crypto.getRandomBytesAsync).toHaveBeenCalledWith(32);
  });

  it('reuses the encryption key across setItem calls instead of regenerating it', async () => {
    const storage = createEncryptedStorage();
    await storage.setItem('a', 'one');

    // Fresh storage instance → must read the existing key rather than make a new one.
    const storage2 = createEncryptedStorage();
    await storage2.setItem('b', 'two');

    expect(secureStoreMock.setItemAsync).toHaveBeenCalledTimes(1);
    expect(secureStoreMock.getItemAsync).toHaveBeenCalled();
    // Roundtrip across instances must still work with the shared key.
    expect(await storage2.getItem('a')).toBe('one');
    expect(await storage2.getItem('b')).toBe('two');
  });

  it('removeItem delegates to AsyncStorage', async () => {
    const storage = createEncryptedStorage();
    await storage.setItem('temp', 'v');
    await storage.removeItem('temp');
    expect(asyncStorageMock.removeItem).toHaveBeenCalledWith('temp');
    expect(await storage.getItem('temp')).toBeNull();
  });
});
