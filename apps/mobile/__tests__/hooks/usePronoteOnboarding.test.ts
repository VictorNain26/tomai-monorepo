/**
 * usePronoteOnboarding — child-creation loop regression guard
 *
 * Covers handleChildPinComplete: the loop that runs splitPronoteName →
 * createChild → setCredential → setResourceMapping for each selected child,
 * then advances to 'parent-pin'. Also covers the error path.
 *
 * splitPronoteName('Marie Dupont') → { firstName: 'Dupont', lastName: 'Marie' }
 * (parts[0] is the family name per Pronote convention; see pronote-helpers.ts:168)
 */

import { renderHook, act } from '@testing-library/react-native';

// ---- Mocks (must precede the import under test) ----

const mockRouterReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockRouterReplace, back: jest.fn() }),
}));

jest.mock('../../src/lib/auth', () => ({
  useUser: () => ({ id: 'parent-1' }),
}));

const mockCreateChild = jest.fn();
const mockSetResourceMapping = jest.fn();
jest.mock('../../src/hooks', () => ({
  usePronote: () => ({ connect: jest.fn(), setResourceMapping: mockSetResourceMapping }),
  useParentDashboard: () => ({ createChild: mockCreateChild, children: [] }),
}));

const mockSetCredential = jest.fn();
const mockSetParentCredential = jest.fn();
jest.mock('../../src/stores/child-access-store', () => ({
  useChildAccessStore: (sel: (s: { setCredential: jest.Mock; setParentCredential: jest.Mock }) => unknown) =>
    sel({ setCredential: mockSetCredential, setParentCredential: mockSetParentCredential }),
}));

// pronote-helpers are pure — no mock needed; they run for real.

import { usePronoteOnboarding } from '../../src/hooks/usePronoteOnboarding';
import type { ChildPinData } from '../../src/hooks/usePronoteOnboarding';
import type { PronoteResource } from '../../src/services/pronote/pronote-types';

// ---- Fixtures ----

const RESOURCES: PronoteResource[] = [
  { id: 'r1', name: 'Marie Dupont' },
  { id: 'r2', name: 'Léo Martin' },
] as never[];

function PIN(resource: PronoteResource): ChildPinData {
  return {
    resource,
    schoolLevel: 'sixieme' as const,
    pinType: 'pin' as const,
    pinValue: '1234',
  };
}

// ---- Tests ----

describe('usePronoteOnboarding child-creation loop', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateChild.mockImplementation(async (d: { username: string }) => ({
      id: `id-${d.username}`,
    }));
    mockSetCredential.mockResolvedValue(undefined);
  });

  it('creates one account per selected child then advances to parent-pin', async () => {
    const { result } = renderHook(() => usePronoteOnboarding());

    // Select both resources → goes to pin-setup
    act(() => {
      result.current.handleImport(RESOURCES);
    });
    expect(result.current.step).toBe('pin-setup');

    // First child: index 0 < length-1 → just advances index
    await act(async () => {
      await result.current.handleChildPinComplete(PIN(RESOURCES[0]!));
    });
    expect(mockCreateChild).not.toHaveBeenCalled();
    expect(result.current.currentPinSetupIndex).toBe(1);

    // Second child (last): triggers the creation loop
    await act(async () => {
      await result.current.handleChildPinComplete(PIN(RESOURCES[1]!));
    });

    expect(mockCreateChild).toHaveBeenCalledTimes(2);

    // splitPronoteName('Marie Dupont') → lastName:'Marie', firstName:'Dupont'
    expect(mockCreateChild).toHaveBeenCalledWith(
      expect.objectContaining({ firstName: 'Dupont', lastName: 'Marie', username: 'marie.dupont' }),
    );

    // splitPronoteName('Léo Martin') → lastName:'Léo', firstName:'Martin'
    // pronoteUsername('Léo Martin') → 'leo.martin' (diacritics stripped)
    expect(mockCreateChild).toHaveBeenCalledWith(
      expect.objectContaining({ firstName: 'Martin', username: 'leo.martin' }),
    );

    expect(mockSetCredential).toHaveBeenCalledTimes(2);
    expect(result.current.step).toBe('parent-pin');
    expect(result.current.error).toBeNull();
  });

  it('sets an error and stays when createChild rejects, without advancing to parent-pin', async () => {
    mockCreateChild.mockRejectedValueOnce(new Error('boom'));

    const { result } = renderHook(() => usePronoteOnboarding());

    act(() => {
      result.current.handleImport([RESOURCES[0]!]);
    });

    // Single child → first call is also the last call → triggers loop
    await act(async () => {
      await result.current.handleChildPinComplete(PIN(RESOURCES[0]!));
    });

    expect(result.current.error).not.toBeNull();
    expect(result.current.step).not.toBe('parent-pin');
    // isCreatingChildren should be false (finally block ran)
    expect(result.current.isCreatingChildren).toBe(false);
  });
});
