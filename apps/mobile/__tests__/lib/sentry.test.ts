/**
 * Tests for Sentry initialization
 *
 * The DSN is captured at module load time (`const DSN = process.env...`),
 * so we must set the env var BEFORE requiring the module.
 *
 * @see src/lib/sentry.ts
 */

const mockSentryInit = jest.fn();
jest.mock('@sentry/react-native', () => ({
  init: mockSentryInit,
  wrap: jest.fn((c: unknown) => c),
  captureException: jest.fn(),
  captureMessage: jest.fn(),
  setUser: jest.fn(),
  addBreadcrumb: jest.fn(),
  withScope: jest.fn((cb: (scope: { setExtra: jest.Mock }) => void) =>
    cb({ setExtra: jest.fn() })
  ),
}));

jest.mock('expo-constants', () => ({
  expoConfig: {
    version: '2.0.0',
    extra: { eas: { projectId: 'test-project' } },
  },
}));

afterEach(() => {
  jest.resetModules();
  mockSentryInit.mockClear();
});

describe('initializeSentry', () => {
  it('calls init with enabled:false when DSN is not set', () => {
    delete process.env.EXPO_PUBLIC_SENTRY_DSN;

const { initializeSentry } = require('@/lib/sentry');
    initializeSentry();

    expect(mockSentryInit).toHaveBeenCalledTimes(1);
    expect(mockSentryInit).toHaveBeenCalledWith(
      expect.objectContaining({
        dsn: undefined,
        enabled: false,
      })
    );
  });

  it('calls Sentry.init with correct config when DSN is set', () => {
    process.env.EXPO_PUBLIC_SENTRY_DSN = 'https://test@sentry.io/123';

    // Force fresh module load to pick up new env
    jest.resetModules();

    // Re-apply mocks after resetModules
    jest.mock('@sentry/react-native', () => ({
      init: mockSentryInit,
      wrap: jest.fn((c: unknown) => c),
      captureException: jest.fn(),
      captureMessage: jest.fn(),
      setUser: jest.fn(),
      addBreadcrumb: jest.fn(),
      withScope: jest.fn(),
    }));
    jest.mock('expo-constants', () => ({
      expoConfig: {
        version: '2.0.0',
        extra: { eas: { projectId: 'test-project' } },
      },
    }));

const { initializeSentry } = require('@/lib/sentry');
    initializeSentry();

    expect(mockSentryInit).toHaveBeenCalledTimes(1);
    expect(mockSentryInit).toHaveBeenCalledWith(
      expect.objectContaining({
        dsn: 'https://test@sentry.io/123',
        release: '2.0.0',
        tracesSampleRate: expect.any(Number),
      })
    );

    delete process.env.EXPO_PUBLIC_SENTRY_DSN;
  });

  it('exports Sentry namespace for wrapping components', () => {
const sentry = require('@/lib/sentry');
    expect(sentry.Sentry).toBeDefined();
    expect(sentry.Sentry.captureException).toBeDefined();
    expect(sentry.Sentry.wrap).toBeDefined();
  });
});
