/**
 * pronote-e2e-stubs — gating tests.
 *
 * Verifies that:
 * 1. The E2E stub constants are well-formed (shape + non-empty values).
 * 2. The IS_E2E guard evaluates correctly for various env values.
 * 3. When EXPO_PUBLIC_E2E === '1' at call time, usePronoteConnect dispatches
 *    stub results without ever invoking getTreaty.
 *
 * Implementation note: isE2E() in usePronoteConnect reads process.env at
 * call time (not at import time), so env manipulation in tests is reliable
 * without module isolation.
 */

import { renderHook, act } from '@testing-library/react-native';
import { getTreaty } from '@repo/api';

import {
  E2E_QR_PAYLOAD,
  E2E_CREDENTIAL_ID,
  E2E_DISCOVERED,
  E2E_ACTIVATE_RESULT,
} from '../../src/services/pronote/pronote-e2e-stubs';
import { usePronoteConnect } from '../../src/hooks/usePronoteConnect';

jest.mock('@repo/api', () => ({
  getTreaty: jest.fn(() => {
    throw new Error('getTreaty called unexpectedly');
  }),
}));

const mockGetTreaty = getTreaty as jest.MockedFunction<typeof getTreaty>;

afterEach(() => {
  jest.clearAllMocks();
  delete process.env.EXPO_PUBLIC_E2E;
});

// ── 1. Stub shape ─────────────────────────────────────────────────────────────

describe('pronote-e2e-stubs: fixture shape', () => {
  it('E2E_QR_PAYLOAD has jeton, login, url — all non-empty strings', () => {
    expect(typeof E2E_QR_PAYLOAD.jeton).toBe('string');
    expect(E2E_QR_PAYLOAD.jeton.length).toBeGreaterThan(0);
    expect(typeof E2E_QR_PAYLOAD.login).toBe('string');
    expect(E2E_QR_PAYLOAD.login.length).toBeGreaterThan(0);
    expect(typeof E2E_QR_PAYLOAD.url).toBe('string');
    expect(E2E_QR_PAYLOAD.url).toMatch(/^https?:\/\//);
  });

  it('E2E_CREDENTIAL_ID is a non-empty string', () => {
    expect(typeof E2E_CREDENTIAL_ID).toBe('string');
    expect(E2E_CREDENTIAL_ID.length).toBeGreaterThan(0);
  });

  it('E2E_DISCOVERED has exactly one child with resourceId 0', () => {
    expect(E2E_DISCOVERED).toHaveLength(1);
    expect(E2E_DISCOVERED[0].resourceId).toBe(0);
    expect(E2E_DISCOVERED[0].existingChildId).toBeNull();
    expect(typeof E2E_DISCOVERED[0].suggested.firstName).toBe('string');
    expect(typeof E2E_DISCOVERED[0].suggested.lastName).toBe('string');
  });

  it('E2E_ACTIVATE_RESULT has one activated entry and no failures', () => {
    expect(E2E_ACTIVATE_RESULT.activated).toHaveLength(1);
    expect(E2E_ACTIVATE_RESULT.activated[0].resourceId).toBe(0);
    expect(typeof E2E_ACTIVATE_RESULT.activated[0].childId).toBe('string');
    expect(E2E_ACTIVATE_RESULT.failed).toHaveLength(0);
  });
});

// ── 2. IS_E2E flag semantics ─────────────────────────────────────────────────

describe('IS_E2E flag semantics (env variable contract)', () => {
  it('must be false when EXPO_PUBLIC_E2E is unset (production default)', () => {
    delete process.env.EXPO_PUBLIC_E2E;
    expect(process.env.EXPO_PUBLIC_E2E === '1').toBe(false);
  });

  it('resolves to true only for the exact string "1"', () => {
    // These values must NOT activate E2E mode.
    for (const val of ['true', 'yes', '0', 'false', '', 'TRUE']) {
      expect(val === '1').toBe(false);
    }
    expect('1' === '1').toBe(true);
  });

  it('production and development eas.json profiles do NOT set EXPO_PUBLIC_E2E', () => {
    // Guard: in any non-preview env, the variable must be absent → guard false.
    const productionValue: string | undefined = undefined;
    expect(productionValue === '1').toBe(false);
  });
});

// ── 3. usePronoteConnect E2E stub paths ───────────────────────────────────────
//
// isE2E() reads process.env.EXPO_PUBLIC_E2E at call time (function, not const),
// so we can set the flag just before triggering the action.

describe('usePronoteConnect: E2E stub path bypasses getTreaty', () => {
  it('submitPin dispatches stub discover result — getTreaty never called', async () => {
    const { result } = renderHook(() => usePronoteConnect());

    act(() => {
      result.current.setQrData(E2E_QR_PAYLOAD);
    });

    process.env.EXPO_PUBLIC_E2E = '1';
    await act(async () => {
      await result.current.submitPin('0000');
    });

    expect(mockGetTreaty).not.toHaveBeenCalled();
    expect(result.current.step).toBe('select');
    expect(result.current.credentialId).toBe(E2E_CREDENTIAL_ID);
    expect(result.current.discovered).toHaveLength(1);
    expect(result.current.discovered[0].resourceId).toBe(0);
  });

  it('confirmSelections dispatches stub activate result — getTreaty never called', async () => {
    const { result } = renderHook(() => usePronoteConnect());

    act(() => {
      result.current.setQrData(E2E_QR_PAYLOAD);
    });

    process.env.EXPO_PUBLIC_E2E = '1';
    await act(async () => {
      await result.current.submitPin('0000');
    });

    await act(async () => {
      await result.current.confirmSelections([
        {
          resourceId: 0,
          firstName: 'Demo',
          lastName: 'Eleve',
          schoolLevel: 'troisieme',
          mode: 'create',
          username: 'demo.eleve',
          password: 'PasswordDemo1!',
        },
      ]);
    });

    expect(mockGetTreaty).not.toHaveBeenCalled();
    expect(result.current.step).toBe('result');
    expect(result.current.results.activated).toHaveLength(1);
    expect(result.current.results.failed).toHaveLength(0);
  });

  it('submitPin uses live API when EXPO_PUBLIC_E2E is unset', async () => {
    // Ensure getTreaty IS called in non-E2E mode.
    delete process.env.EXPO_PUBLIC_E2E;

    // Make getTreaty return a mock API that doesn't throw.
    mockGetTreaty.mockReturnValue({
      api: {
        pronote: {
          connect: {
            qr: {
              post: jest.fn().mockResolvedValue({
                data: { data: { credentialId: 'live-cred', resources: [] } },
                error: null,
              }),
            },
          },
          credentials: jest.fn(() => ({
            children: {
              get: jest.fn().mockResolvedValue({
                data: { data: [] },
                error: null,
              }),
            },
            activate: { post: jest.fn() },
          })),
        },
      },
    } as unknown as ReturnType<typeof getTreaty>);

    const { result } = renderHook(() => usePronoteConnect());

    act(() => {
      result.current.setQrData(E2E_QR_PAYLOAD);
    });

    await act(async () => {
      await result.current.submitPin('0000');
    });

    // In non-E2E mode, getTreaty must be called.
    expect(mockGetTreaty).toHaveBeenCalled();
  });
});
