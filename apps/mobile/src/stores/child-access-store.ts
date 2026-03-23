import { create } from 'zustand';
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware';
import { createMMKV } from 'react-native-mmkv';
import * as Crypto from 'expo-crypto';

let mmkvInstance: ReturnType<typeof createMMKV> | null = null;

function getMMKV() {
  if (!mmkvInstance) {
    mmkvInstance = createMMKV({ id: 'child-access' });
  }
  return mmkvInstance;
}

const mmkvStorage: StateStorage = {
  getItem: (name: string) => getMMKV().getString(name) ?? null,
  setItem: (name: string, value: string) => getMMKV().set(name, value),
  removeItem: (name: string) => { getMMKV().remove(name); },
};

interface ChildAccessCredential {
  childId: string;
  type: 'pin' | 'password';
  hash: string;
  salt: string;
}

interface ParentAccessCredential {
  type: 'pin';
  hash: string;
  salt: string;
}

interface ChildAccessState {
  credentials: ChildAccessCredential[];
  parentCredential: ParentAccessCredential | null;
  setCredential: (childId: string, type: 'pin' | 'password', value: string) => Promise<void>;
  setParentCredential: (value: string) => Promise<void>;
  verifyCredential: (childId: string, value: string) => Promise<boolean>;
  verifyParentCredential: (value: string) => Promise<boolean>;
  removeCredential: (childId: string) => void;
  resetCredential: (childId: string, type: 'pin' | 'password', value: string) => Promise<void>;
  hasCredential: (childId: string) => boolean;
  reset: () => void;
}

async function generateSalt(): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(16);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function hashValue(salt: string, value: string): Promise<string> {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    salt + value,
  );
}

const initialState = {
  credentials: [] as ChildAccessCredential[],
  parentCredential: null as ParentAccessCredential | null,
};

export const useChildAccessStore = create<ChildAccessState>()(
  persist(
    (set, get) => ({
      ...initialState,

      setCredential: async (childId, type, value) => {
        const salt = await generateSalt();
        const hash = await hashValue(salt, value);
        set((state) => ({
          credentials: [
            ...state.credentials.filter((c) => c.childId !== childId),
            { childId, type, hash, salt },
          ],
        }));
      },

      setParentCredential: async (value) => {
        const salt = await generateSalt();
        const hash = await hashValue(salt, value);
        set({ parentCredential: { type: 'pin', hash, salt } });
      },

      verifyCredential: async (childId, value) => {
        const credential = get().credentials.find((c) => c.childId === childId);
        if (!credential) return false;
        const hash = await hashValue(credential.salt, value);
        return hash === credential.hash;
      },

      verifyParentCredential: async (value) => {
        const { parentCredential } = get();
        if (!parentCredential) return false;
        const hash = await hashValue(parentCredential.salt, value);
        return hash === parentCredential.hash;
      },

      removeCredential: (childId) => {
        set((state) => ({
          credentials: state.credentials.filter((c) => c.childId !== childId),
        }));
      },

      resetCredential: async (childId, type, value) => {
        const salt = await generateSalt();
        const hash = await hashValue(salt, value);
        set((state) => ({
          credentials: [
            ...state.credentials.filter((c) => c.childId !== childId),
            { childId, type, hash, salt },
          ],
        }));
      },

      hasCredential: (childId) => {
        return get().credentials.some((c) => c.childId === childId);
      },

      reset: () => set(initialState),
    }),
    {
      name: 'child-access-state',
      storage: createJSONStorage(() => mmkvStorage),
      partialize: (state) => ({
        credentials: state.credentials,
        parentCredential: state.parentCredential,
      }),
    },
  ),
);
