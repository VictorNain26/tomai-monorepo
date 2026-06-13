/**
 * usePronoteReconnect — import loop regression guard
 *
 * Covers handleImport: the loop that runs splitPronoteName → generateTempPassword
 * → createChild → setResourceMapping per resource, then advances to 'pin-setup'.
 * Also covers the empty-selection path (router.back()).
 *
 * Note: reconnect generates a timestamped username (`${baseUsername}.${Date.now() % 10000}`)
 * so we assert only on firstName/lastName/password shape, not exact username.
 */

import { renderHook, act } from '@testing-library/react-native';

// ---- Mocks ----

const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, replace: jest.fn() }),
}));

jest.mock('../../src/lib/auth', () => ({
  useUser: () => ({ id: 'parent-1' }),
}));

const mockCreateChild = jest.fn();
const mockSetResourceMapping = jest.fn();
const mockConnect = jest.fn();
jest.mock('../../src/hooks', () => ({
  usePronote: () => ({ connect: mockConnect, setResourceMapping: mockSetResourceMapping }),
  useParentDashboard: () => ({ createChild: mockCreateChild, children: [] }),
}));

const mockSetCredential = jest.fn();
jest.mock('../../src/stores/child-access-store', () => ({
  useChildAccessStore: (sel: (s: { setCredential: jest.Mock }) => unknown) =>
    sel({ setCredential: mockSetCredential }),
}));

const mockToast = { success: jest.fn(), error: jest.fn(), warning: jest.fn(), info: jest.fn() };
jest.mock('../../src/components/ui/toast', () => ({
  useToast: () => mockToast,
}));

// expo-crypto: mock getRandomBytesAsync to return deterministic bytes
jest.mock('expo-crypto', () => ({
  getRandomBytesAsync: jest.fn(async (n: number) => new Uint8Array(n).fill(0xab)),
}));

import { usePronoteReconnect } from '../../src/hooks/usePronoteReconnect';
import type { PronoteResource } from '../../src/services/pronote/pronote-types';

// ---- Fixtures ----

const RESOURCES: PronoteResource[] = [
  { id: 'r1', name: 'Marie Dupont' },
  { id: 'r2', name: 'Léo Martin' },
] as never[];

// ---- Tests ----

describe('usePronoteReconnect import loop', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateChild.mockImplementation(async () => ({ id: `child-${Math.random()}` }));
    mockSetCredential.mockResolvedValue(undefined);
    // Default: connect succeeds and returns both resources so handleImport can
    // find them via indexOf and call setResourceMapping.
    mockConnect.mockResolvedValue({ resources: RESOURCES });
  });

  it('creates one account per resource with a non-empty temp password, then goes to pin-setup', async () => {
    const { result } = renderHook(() => usePronoteReconnect());

    // Scan a valid QR code so qrData is set, then submit pin to populate
    // internal `resources` state via pronote.connect. This is required so
    // handleImport can find each resource via indexOf and call setResourceMapping.
    await act(async () => {
      result.current.handleBarCodeScanned({
        data: JSON.stringify({ jeton: 'tok', login: 'log', url: 'https://pronote.example.fr' }),
      });
    });
    await act(async () => {
      result.current.setPin('1234');
    });
    await act(async () => {
      await result.current.handlePinSubmit();
    });

    await act(async () => {
      await result.current.handleImport(RESOURCES);
    });

    expect(mockCreateChild).toHaveBeenCalledTimes(2);

    // splitPronoteName('Marie Dupont') → lastName:'Marie', firstName:'Dupont'
    expect(mockCreateChild).toHaveBeenCalledWith(
      expect.objectContaining({ firstName: 'Dupont', lastName: 'Marie' }),
    );

    // Password is a non-empty hex-prefixed string from generateTempPassword
    const firstArg = mockCreateChild.mock.calls[0][0] as { password: string };
    expect(typeof firstArg.password).toBe('string');
    expect(firstArg.password.length).toBeGreaterThan(0);
    // Temp password is prefixed with 'tmp-' (see generateTempPassword in usePronoteReconnect.ts:81)
    expect(firstArg.password).toMatch(/^tmp-/);

    // setResourceMapping is called once per resource with (childId, resourceIndex).
    // resourceIndex is the position of the resource in the array returned by connect,
    // which matches RESOURCES order: r1 → 0, r2 → 1.
    expect(mockSetResourceMapping).toHaveBeenCalledTimes(2);
    const child0Id = (mockCreateChild.mock.results[0]!.value as Promise<{ id: string }>);
    const child1Id = (mockCreateChild.mock.results[1]!.value as Promise<{ id: string }>);
    const resolvedChild0 = await child0Id;
    const resolvedChild1 = await child1Id;
    expect(mockSetResourceMapping).toHaveBeenNthCalledWith(1, resolvedChild0.id, 0);
    expect(mockSetResourceMapping).toHaveBeenNthCalledWith(2, resolvedChild1.id, 1);

    expect(result.current.step).toBe('pin-setup');
    expect(result.current.error).toBeNull();
  });

  it('navigates back when no resource is selected', async () => {
    const { result } = renderHook(() => usePronoteReconnect());

    await act(async () => {
      await result.current.handleImport([]);
    });

    expect(mockBack).toHaveBeenCalled();
    expect(mockCreateChild).not.toHaveBeenCalled();
    // Step stays at 'scan' (initial)
    expect(result.current.step).toBe('scan');
  });

  it('shows a toast error and does not advance when createChild rejects', async () => {
    mockCreateChild.mockRejectedValueOnce(new Error('network'));

    const { result } = renderHook(() => usePronoteReconnect());

    await act(async () => {
      await result.current.handleImport([RESOURCES[0]!]);
    });

    expect(mockToast.error).toHaveBeenCalled();
    // isImporting returns to false, proving the finally block ran after the throw.
    expect(result.current.isImporting).toBe(false);
  });
});
