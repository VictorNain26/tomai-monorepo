let mockHostUri: string | undefined = '192.168.1.42:8081';

jest.mock('expo-constants', () => ({
  __esModule: true,
  get default() {
    return { expoConfig: { hostUri: mockHostUri } };
  },
}));

const setHostUri = (value: string | undefined) => {
  mockHostUri = value;
};
const setDev = (value: boolean) => {
  (globalThis as unknown as { __DEV__: boolean }).__DEV__ = value;
};

describe('resolveApiUrl', () => {
  const originalEnv = process.env.EXPO_PUBLIC_API_URL;

  beforeEach(() => {
    mockHostUri = '192.168.1.42:8081';
    setDev(true);
  });

  afterEach(() => {
    if (originalEnv === undefined) delete process.env.EXPO_PUBLIC_API_URL;
    else process.env.EXPO_PUBLIC_API_URL = originalEnv;
    jest.resetModules();
  });

  it('returns the explicit override when EXPO_PUBLIC_API_URL is set', () => {
    process.env.EXPO_PUBLIC_API_URL = 'https://tunnel.example.dev';
    const { resolveApiUrl } = require('@/lib/api-url');
    expect(resolveApiUrl()).toBe('https://tunnel.example.dev');
  });

  it('derives http://<host>:3000 from hostUri on a physical device in dev', () => {
    delete process.env.EXPO_PUBLIC_API_URL;
    setHostUri('192.168.1.42:8081');
    const { resolveApiUrl } = require('@/lib/api-url');
    expect(resolveApiUrl()).toBe('http://192.168.1.42:3000');
  });

  it('derives the Android emulator gateway from hostUri', () => {
    delete process.env.EXPO_PUBLIC_API_URL;
    setHostUri('10.0.2.2:8081');
    const { resolveApiUrl } = require('@/lib/api-url');
    expect(resolveApiUrl()).toBe('http://10.0.2.2:3000');
  });

  it('falls back to localhost (with a warning) when hostUri is missing in dev', () => {
    delete process.env.EXPO_PUBLIC_API_URL;
    setHostUri(undefined);
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const { resolveApiUrl } = require('@/lib/api-url');
    expect(resolveApiUrl()).toBe('http://localhost:3000');
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('returns the production URL outside dev with no override', () => {
    delete process.env.EXPO_PUBLIC_API_URL;
    setDev(false);
    const { resolveApiUrl } = require('@/lib/api-url');
    expect(resolveApiUrl()).toBe('https://api.tomia.fr');
  });
});
