import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { act } from '@testing-library/react-native';

// Mock expo-crypto
const mockDigest = jest.fn<(algo: string, input: string) => Promise<string>>();
const mockGetRandomBytes = jest.fn<(size: number) => Promise<Uint8Array>>();

jest.mock('expo-crypto', () => ({
  digestStringAsync: mockDigest,
  getRandomBytesAsync: mockGetRandomBytes,
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
}));

jest.mock('react-native-mmkv', () => {
  const store = new Map<string, string>();
  return {
    createMMKV: () => ({
      set: (key: string, val: string) => store.set(key, val),
      getString: (key: string) => store.get(key),
      remove: (key: string) => store.delete(key),
      contains: (key: string) => store.has(key),
      clearAll: () => store.clear(),
    }),
  };
});

// Helper to produce a deterministic fake hash from input
function fakeHash(input: string): string {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (Math.imul(31, h) + input.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(16).padStart(16, '0');
}

// Setup mocks to behave deterministically
beforeEach(() => {
  mockDigest.mockImplementation(async (_algo: string, input: string) => fakeHash(input));
  mockGetRandomBytes.mockImplementation(async (size: number) => {
    const bytes = new Uint8Array(size);
    for (let i = 0; i < size; i++) bytes[i] = i + 1;
    return bytes;
  });
});

const { useChildAccessStore } = require('@/stores/child-access-store');

type StoreType = {
  getState: () => {
    credentials: { childId: string; type: 'pin' | 'password'; hash: string; salt: string }[];
    parentCredential: { type: 'pin'; hash: string; salt: string } | null;
    setCredential: (childId: string, type: 'pin' | 'password', value: string) => Promise<void>;
    setParentCredential: (value: string) => Promise<void>;
    verifyCredential: (childId: string, value: string) => Promise<boolean>;
    verifyParentCredential: (value: string) => Promise<boolean>;
    removeCredential: (childId: string) => void;
    resetCredential: (childId: string, type: 'pin' | 'password', value: string) => Promise<void>;
    hasCredential: (childId: string) => boolean;
    reset: () => void;
  };
};

const store = useChildAccessStore as unknown as StoreType;

describe('useChildAccessStore', () => {
  beforeEach(() => {
    act(() => {
      store.getState().reset();
    });
    jest.clearAllMocks();
    mockDigest.mockImplementation(async (_algo: string, input: string) => fakeHash(input));
    mockGetRandomBytes.mockImplementation(async (size: number) => {
      const bytes = new Uint8Array(size);
      for (let i = 0; i < size; i++) bytes[i] = i + 1;
      return bytes;
    });
  });

  it('should set and verify a child PIN', async () => {
    await act(async () => {
      await store.getState().setCredential('child-1', 'pin', '1234');
    });

    const correct = await store.getState().verifyCredential('child-1', '1234');
    expect(correct).toBe(true);

    const wrong = await store.getState().verifyCredential('child-1', '0000');
    expect(wrong).toBe(false);
  });

  it('should set and verify a child password', async () => {
    await act(async () => {
      await store.getState().setCredential('child-2', 'password', 'SecurePass!');
    });

    const correct = await store.getState().verifyCredential('child-2', 'SecurePass!');
    expect(correct).toBe(true);

    const wrong = await store.getState().verifyCredential('child-2', 'WrongPass');
    expect(wrong).toBe(false);
  });

  it('should set and verify parent credential', async () => {
    await act(async () => {
      await store.getState().setParentCredential('9999');
    });

    const correct = await store.getState().verifyParentCredential('9999');
    expect(correct).toBe(true);

    const wrong = await store.getState().verifyParentCredential('0000');
    expect(wrong).toBe(false);
  });

  it('should remove a credential', async () => {
    await act(async () => {
      await store.getState().setCredential('child-3', 'pin', '5678');
    });

    expect(store.getState().hasCredential('child-3')).toBe(true);

    act(() => {
      store.getState().removeCredential('child-3');
    });

    expect(store.getState().hasCredential('child-3')).toBe(false);

    const result = await store.getState().verifyCredential('child-3', '5678');
    expect(result).toBe(false);
  });

  it('should reset a credential with new value', async () => {
    await act(async () => {
      await store.getState().setCredential('child-4', 'pin', '1111');
    });

    // Generate different salt on reset
    mockGetRandomBytes.mockImplementation(async (size: number) => {
      const bytes = new Uint8Array(size);
      for (let i = 0; i < size; i++) bytes[i] = i + 100;
      return bytes;
    });

    await act(async () => {
      await store.getState().resetCredential('child-4', 'password', 'NewPass');
    });

    const oldResult = await store.getState().verifyCredential('child-4', '1111');
    expect(oldResult).toBe(false);

    const newResult = await store.getState().verifyCredential('child-4', 'NewPass');
    expect(newResult).toBe(true);
  });

  it('should check hasCredential', async () => {
    await act(async () => {
      await store.getState().setCredential('child-5', 'pin', '4321');
    });

    expect(store.getState().hasCredential('child-5')).toBe(true);
    expect(store.getState().hasCredential('child-999')).toBe(false);
  });
});
