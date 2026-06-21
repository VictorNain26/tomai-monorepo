/**
 * usePronoteConnect — onboarding state machine tests.
 *
 * Covers:
 * 1. Happy path connect→discover→activate (all succeed).
 * 2. Partial activate (1 failed) then retryFailed re-activates only the failed subset.
 * 3. existingChildId≠null → mode=link in selections (no username/password).
 * 4. Manual link (linkToChildId chosen) → mode=link.
 * 5. Expired QR jeton → step==='scan' + error set.
 */

import { renderHook, act } from '@testing-library/react-native';
import { getTreaty } from '@repo/api';
import type { ApiError } from '@repo/api';

import { usePronoteConnect } from '../../src/hooks/usePronoteConnect';

jest.mock('@repo/api', () => ({
  getTreaty: jest.fn(),
  unwrap: jest.fn((r: { data: unknown; error: { status: number; value: unknown } | null }) => {
    if (r.error) {
      const err = new Error('API error') as ApiError;
      const ev = r.error.value as Record<string, unknown> | null | undefined;
      err.code = (ev?.code as string | undefined);
      (err as ApiError & { status: number }).status = r.error.status as number;
      throw err;
    }
    return r.data;
  }),
}));

const mockGetTreaty = getTreaty as jest.MockedFunction<typeof getTreaty>;

// Helpers to build mock treaty shapes
function buildMockTreaty({
  connectQrResult,
  childrenGetResult,
  activatePostResult,
}: {
  connectQrResult: unknown;
  childrenGetResult: unknown;
  activatePostResult: unknown;
}) {
  const activatePost = jest.fn().mockResolvedValue(activatePostResult);
  const childrenGet = jest.fn().mockResolvedValue(childrenGetResult);
  const connectQrPost = jest.fn().mockResolvedValue(connectQrResult);

  mockGetTreaty.mockReturnValue({
    api: {
      pronote: {
        connect: {
          qr: { post: connectQrPost },
        },
        credentials: jest.fn(() => ({
          children: { get: childrenGet },
          activate: { post: activatePost },
        })),
      },
    },
  } as unknown as ReturnType<typeof getTreaty>);

  return { connectQrPost, childrenGet, activatePost };
}

const sampleQrData = { jeton: 'abc123', login: 'user@example.com', url: 'https://pronote.example.com' };
const samplePin = '1234';
const sampleCredentialId = 'cred-uuid-1';

const sampleDiscovered = [
  {
    resourceId: 1,
    name: 'Dupont Marie',
    className: '4eA',
    establishmentName: 'Collège Jean Moulin',
    suggested: { firstName: 'Marie', lastName: 'Dupont', schoolLevel: 'quatrieme' },
    existingChildId: null,
  },
  {
    resourceId: 2,
    name: 'Dupont Paul',
    className: '6eB',
    establishmentName: 'Collège Jean Moulin',
    suggested: { firstName: 'Paul', lastName: 'Dupont', schoolLevel: 'sixieme' },
    existingChildId: null,
  },
];

const successQrResponse = {
  data: { success: true, data: { credentialId: sampleCredentialId, resources: sampleDiscovered } },
  error: null,
};

const successChildrenResponse = {
  data: { success: true, data: sampleDiscovered },
  error: null,
};

describe('usePronoteConnect', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('initial state is intro step with no pending or error', () => {
    buildMockTreaty({
      connectQrResult: successQrResponse,
      childrenGetResult: successChildrenResponse,
      activatePostResult: { data: { success: true, data: { activated: [], failed: [] } }, error: null },
    });

    const { result } = renderHook(() => usePronoteConnect());

    expect(result.current.step).toBe('intro');
    expect(result.current.isPending).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.credentialId).toBeNull();
    expect(result.current.discovered).toEqual([]);
  });

  it('happy path: connect→discover→activate all succeed', async () => {
    const activateResult = {
      data: {
        success: true,
        data: {
          activated: [{ resourceId: 1, childId: 'child-1' }, { resourceId: 2, childId: 'child-2' }],
          failed: [],
        },
      },
      error: null,
    };

    const { connectQrPost, childrenGet, activatePost } = buildMockTreaty({
      connectQrResult: successQrResponse,
      childrenGetResult: successChildrenResponse,
      activatePostResult: activateResult,
    });

    const { result } = renderHook(() => usePronoteConnect());

    // Set QR data first
    act(() => {
      result.current.setQrData(sampleQrData);
    });

    // submitPin triggers connect + discover
    await act(async () => {
      await result.current.submitPin(samplePin);
    });

    expect(connectQrPost).toHaveBeenCalledWith({ qr: sampleQrData, pin: samplePin });
    expect(childrenGet).toHaveBeenCalled();
    expect(result.current.step).toBe('select');
    expect(result.current.credentialId).toBe(sampleCredentialId);
    expect(result.current.discovered).toHaveLength(2);
    expect(result.current.isPending).toBe(false);
    expect(result.current.error).toBeNull();

    // confirmSelections triggers activate
    const selections = [
      { resourceId: 1, firstName: 'Marie', lastName: 'Dupont', schoolLevel: 'quatrieme', mode: 'create' as const, username: 'marie_d', password: 'passw0rd!' },
      { resourceId: 2, firstName: 'Paul', lastName: 'Dupont', schoolLevel: 'sixieme', mode: 'create' as const, username: 'paul_d', password: 'passw0rd!' },
    ];

    await act(async () => {
      await result.current.confirmSelections(selections);
    });

    expect(activatePost).toHaveBeenCalledWith({
      selections: [
        { resourceId: 1, firstName: 'Marie', lastName: 'Dupont', schoolLevel: 'quatrieme', username: 'marie_d', password: 'passw0rd!', linkToChildId: undefined },
        { resourceId: 2, firstName: 'Paul', lastName: 'Dupont', schoolLevel: 'sixieme', username: 'paul_d', password: 'passw0rd!', linkToChildId: undefined },
      ],
    });

    expect(result.current.step).toBe('result');
    expect(result.current.results.activated).toHaveLength(2);
    expect(result.current.results.failed).toHaveLength(0);
  });

  it('partial activate: retryFailed re-activates only the failed subset', async () => {
    const partialActivateResult = {
      data: {
        success: true,
        data: {
          activated: [{ resourceId: 1, childId: 'child-1' }],
          failed: [{ resourceId: 2, reason: 'Username already taken' }],
        },
      },
      error: null,
    };

    const retryActivateResult = {
      data: {
        success: true,
        data: {
          activated: [{ resourceId: 2, childId: 'child-2' }],
          failed: [],
        },
      },
      error: null,
    };

    const activatePost = jest.fn()
      .mockResolvedValueOnce(partialActivateResult)
      .mockResolvedValueOnce(retryActivateResult);

    mockGetTreaty.mockReturnValue({
      api: {
        pronote: {
          connect: {
            qr: { post: jest.fn().mockResolvedValue(successQrResponse) },
          },
          credentials: jest.fn(() => ({
            children: { get: jest.fn().mockResolvedValue(successChildrenResponse) },
            activate: { post: activatePost },
          })),
        },
      },
    } as unknown as ReturnType<typeof getTreaty>);

    const { result } = renderHook(() => usePronoteConnect());

    act(() => {
      result.current.setQrData(sampleQrData);
    });

    await act(async () => {
      await result.current.submitPin(samplePin);
    });

    const selections = [
      { resourceId: 1, firstName: 'Marie', lastName: 'Dupont', schoolLevel: 'quatrieme', mode: 'create' as const, username: 'marie_d', password: 'passw0rd!' },
      { resourceId: 2, firstName: 'Paul', lastName: 'Dupont', schoolLevel: 'sixieme', mode: 'create' as const, username: 'paul_d', password: 'passw0rd!' },
    ];

    await act(async () => {
      await result.current.confirmSelections(selections);
    });

    expect(result.current.step).toBe('result');
    expect(result.current.results.failed).toHaveLength(1);

    // Retry only the failed resource (resourceId: 2) with corrected credentials
    const correctedSelections = [
      { resourceId: 2, firstName: 'Paul', lastName: 'Dupont', schoolLevel: 'sixieme', mode: 'create' as const, username: 'paul_new', password: 'passw0rd!2' },
    ];

    await act(async () => {
      await result.current.retryFailed(correctedSelections);
    });

    // Second activate call should only contain resource 2
    expect(activatePost).toHaveBeenCalledTimes(2);
    const secondCallArg = activatePost.mock.calls[1][0] as { selections: { resourceId: number }[] };
    expect(secondCallArg.selections).toHaveLength(1);
    expect(secondCallArg.selections[0].resourceId).toBe(2);
    // Resource 1 (already activated) must NOT be in the second call
    expect(secondCallArg.selections.find((s) => s.resourceId === 1)).toBeUndefined();

    expect(result.current.results.activated).toHaveLength(2);
    expect(result.current.results.failed).toHaveLength(0);
  });

  it('existingChildId≠null → mode=link, no username/password sent', async () => {
    const discoveredWithExisting = [
      {
        resourceId: 1,
        name: 'Dupont Marie',
        className: '4eA',
        establishmentName: 'Collège Jean Moulin',
        suggested: { firstName: 'Marie', lastName: 'Dupont', schoolLevel: 'quatrieme' },
        existingChildId: 'existing-child-1',
      },
    ];

    const activatePost = jest.fn().mockResolvedValue({
      data: { success: true, data: { activated: [{ resourceId: 1, childId: 'existing-child-1' }], failed: [] } },
      error: null,
    });

    mockGetTreaty.mockReturnValue({
      api: {
        pronote: {
          connect: {
            qr: {
              post: jest.fn().mockResolvedValue({
                data: { success: true, data: { credentialId: sampleCredentialId, resources: discoveredWithExisting } },
                error: null,
              }),
            },
          },
          credentials: jest.fn(() => ({
            children: {
              get: jest.fn().mockResolvedValue({
                data: { success: true, data: discoveredWithExisting },
                error: null,
              }),
            },
            activate: { post: activatePost },
          })),
        },
      },
    } as unknown as ReturnType<typeof getTreaty>);

    const { result } = renderHook(() => usePronoteConnect());

    act(() => {
      result.current.setQrData(sampleQrData);
    });

    await act(async () => {
      await result.current.submitPin(samplePin);
    });

    // mode=link because existingChildId is set — no username/password
    const selections = [
      { resourceId: 1, firstName: 'Marie', lastName: 'Dupont', schoolLevel: 'quatrieme', mode: 'link' as const, linkToChildId: 'existing-child-1' },
    ];

    await act(async () => {
      await result.current.confirmSelections(selections);
    });

    const callArg = activatePost.mock.calls[0][0] as { selections: { resourceId: number; linkToChildId?: string; username?: string; password?: string }[] };
    expect(callArg.selections[0].linkToChildId).toBe('existing-child-1');
    expect(callArg.selections[0].username).toBeUndefined();
    expect(callArg.selections[0].password).toBeUndefined();
    expect(result.current.step).toBe('result');
  });

  it('manual link (linkToChildId chosen explicitly) → mode=link, linkToChildId sent', async () => {
    const activatePost = jest.fn().mockResolvedValue({
      data: { success: true, data: { activated: [{ resourceId: 1, childId: 'other-child-99' }], failed: [] } },
      error: null,
    });

    mockGetTreaty.mockReturnValue({
      api: {
        pronote: {
          connect: { qr: { post: jest.fn().mockResolvedValue(successQrResponse) } },
          credentials: jest.fn(() => ({
            children: { get: jest.fn().mockResolvedValue(successChildrenResponse) },
            activate: { post: activatePost },
          })),
        },
      },
    } as unknown as ReturnType<typeof getTreaty>);

    const { result } = renderHook(() => usePronoteConnect());

    act(() => {
      result.current.setQrData(sampleQrData);
    });

    await act(async () => {
      await result.current.submitPin(samplePin);
    });

    const selections = [
      {
        resourceId: 1,
        firstName: 'Marie',
        lastName: 'Dupont',
        schoolLevel: 'quatrieme',
        mode: 'link' as const,
        linkToChildId: 'other-child-99',
      },
    ];

    await act(async () => {
      await result.current.confirmSelections(selections);
    });

    const callArg = activatePost.mock.calls[0][0] as { selections: { resourceId: number; linkToChildId?: string }[] };
    expect(callArg.selections[0].linkToChildId).toBe('other-child-99');
    expect(result.current.step).toBe('result');
  });

  it('expired QR jeton (pronote_reauth_required, 409) → step=scan + error set', async () => {
    const expiredQrResponse = {
      data: null,
      error: { status: 409, value: { code: 'pronote_reauth_required', error: 'QR code rejected by Pronote server' } },
    };

    buildMockTreaty({
      connectQrResult: expiredQrResponse,
      childrenGetResult: successChildrenResponse,
      activatePostResult: { data: { success: true, data: { activated: [], failed: [] } }, error: null },
    });

    const { result } = renderHook(() => usePronoteConnect());

    act(() => {
      result.current.setQrData(sampleQrData);
    });

    await act(async () => {
      await result.current.submitPin(samplePin);
    });

    expect(result.current.step).toBe('scan');
    expect(result.current.error).toMatch(/QR expiré/i);
    expect(result.current.isPending).toBe(false);
  });

  it('create mode strips linkToChildId even if selection object carried a stale value', async () => {
    const activatePost = jest.fn().mockResolvedValue({
      data: { success: true, data: { activated: [{ resourceId: 1, childId: 'child-new' }], failed: [] } },
      error: null,
    });

    mockGetTreaty.mockReturnValue({
      api: {
        pronote: {
          connect: { qr: { post: jest.fn().mockResolvedValue(successQrResponse) } },
          credentials: jest.fn(() => ({
            children: { get: jest.fn().mockResolvedValue(successChildrenResponse) },
            activate: { post: activatePost },
          })),
        },
      },
    } as unknown as ReturnType<typeof getTreaty>);

    const { result } = renderHook(() => usePronoteConnect());

    act(() => {
      result.current.setQrData(sampleQrData);
    });

    await act(async () => {
      await result.current.submitPin(samplePin);
    });

    // Stale linkToChildId on a create-mode selection — must be stripped before sending
    const selections = [
      {
        resourceId: 1,
        firstName: 'Marie',
        lastName: 'Dupont',
        schoolLevel: 'quatrieme',
        mode: 'create' as const,
        username: 'marie_d',
        password: 'passw0rd!',
        linkToChildId: 'stale-link-id', // stale value that must be dropped
      },
    ];

    await act(async () => {
      await result.current.confirmSelections(selections);
    });

    const callArg = activatePost.mock.calls[0][0] as { selections: { resourceId: number; linkToChildId?: string; username?: string }[] };
    expect(callArg.selections[0].linkToChildId).toBeUndefined();
    expect(callArg.selections[0].username).toBe('marie_d');
    expect(result.current.step).toBe('result');
  });

  it('reset() returns hook to initial state', async () => {
    buildMockTreaty({
      connectQrResult: successQrResponse,
      childrenGetResult: successChildrenResponse,
      activatePostResult: { data: { success: true, data: { activated: [], failed: [] } }, error: null },
    });

    const { result } = renderHook(() => usePronoteConnect());

    act(() => {
      result.current.setQrData(sampleQrData);
    });

    await act(async () => {
      await result.current.submitPin(samplePin);
    });

    expect(result.current.step).toBe('select');

    act(() => {
      result.current.reset();
    });

    expect(result.current.step).toBe('intro');
    expect(result.current.credentialId).toBeNull();
    expect(result.current.discovered).toEqual([]);
    expect(result.current.error).toBeNull();
  });
});
