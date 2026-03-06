/**
 * Mock for @repo/api package
 */

const mockTreatyMethods = {
  get: jest.fn().mockResolvedValue({ data: {}, error: null }),
  post: jest.fn().mockResolvedValue({ data: {}, error: null }),
  put: jest.fn().mockResolvedValue({ data: {}, error: null }),
  patch: jest.fn().mockResolvedValue({ data: {}, error: null }),
  delete: jest.fn().mockResolvedValue({ data: {}, error: null }),
};

const createProxy = (): Record<string, unknown> => {
  return new Proxy(mockTreatyMethods, {
    get: (target, prop) => {
      if (prop in target) {
        return target[prop as keyof typeof target];
      }
      if (typeof prop === 'string') {
        return () => createProxy();
      }
      return undefined;
    },
  });
};

export const getTreaty = jest.fn(() => ({
  api: createProxy(),
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function unwrap(response: any) {
  const res = response as { data?: unknown; error?: { status?: unknown; value?: unknown } | null };
  if (res.error) {
    const ev = res.error.value as Record<string, unknown> | undefined;
    const message = ev?.message ?? ev?.error ?? ev?._error ?? `HTTP ${res.error.status ?? 0}`;
    throw new Error(String(message));
  }
  return res.data;
}

export const getBaseUrl = jest.fn(() => 'http://localhost:3000');

export const initializeApi = jest.fn();

export const setUnauthorizedHandler = jest.fn();

export const UPLOAD_CONFIG = {
  maxSize: 10 * 1024 * 1024,
  allowedTypes: [] as string[],
};
