/**
 * usePronoteConnect — server-driven onboarding state machine.
 *
 * State transitions:
 *   intro → scan → pin → discovering → select → activating → result
 *
 * On expired/invalid QR: connect/qr returns 409 pronote_reauth_required
 * → step resets to scan with an error message.
 *
 * retryFailed re-activates only the failed subset (already-activated resources
 * are never replayed).
 */

import { useReducer, useCallback } from 'react';
import { getTreaty } from '@repo/api';
import type { ApiError } from '@repo/api';

// ============================================================================
// TYPES
// ============================================================================

export interface QrData {
  jeton: string;
  login: string;
  url: string;
}

export interface DiscoveredChild {
  resourceId: number;
  name: string;
  className: string;
  establishmentName: string;
  suggested: {
    firstName: string;
    lastName: string;
    schoolLevel: string | null;
  };
  existingChildId: string | null;
}

export interface ChildAccessSelection {
  resourceId: number;
  firstName: string;
  lastName: string;
  schoolLevel: string;
  mode: 'create' | 'link';
  username?: string;
  password?: string;
  linkToChildId?: string;
}

interface ActivationSelection {
  resourceId: number;
  firstName: string;
  lastName: string;
  schoolLevel: string;
  username?: string;
  password?: string;
  linkToChildId?: string;
}

interface ActivationResult {
  activated: { resourceId: number; childId: string }[];
  failed: { resourceId: number; reason: string }[];
}

export type OnboardingStep =
  | 'intro'
  | 'scan'
  | 'pin'
  | 'discovering'
  | 'select'
  | 'activating'
  | 'result';

export interface PronoteConnectState {
  step: OnboardingStep;
  qrData: QrData | null;
  pin: string | null;
  credentialId: string | null;
  discovered: DiscoveredChild[];
  selections: ChildAccessSelection[];
  isPending: boolean;
  error: string | null;
  results: ActivationResult;
}

// ============================================================================
// REDUCER
// ============================================================================

type Action =
  | { type: 'set-qr-data'; qrData: QrData }
  | { type: 'go-to-scan' }
  | { type: 'set-pin'; pin: string }
  | { type: 'connect-start' }
  | { type: 'connect-success'; credentialId: string; discovered: DiscoveredChild[] }
  | { type: 'reset-to-scan'; error: string }
  | { type: 'activate-start'; selections: ChildAccessSelection[] }
  | { type: 'activate-success'; results: ActivationResult }
  | { type: 'activate-error'; error: string }
  | { type: 'retry-start' }
  | { type: 'retry-success'; results: ActivationResult }
  | { type: 'reset' };

const initialState: PronoteConnectState = {
  step: 'intro',
  qrData: null,
  pin: null,
  credentialId: null,
  discovered: [],
  selections: [],
  isPending: false,
  error: null,
  results: { activated: [], failed: [] },
};

function reducer(state: PronoteConnectState, action: Action): PronoteConnectState {
  switch (action.type) {
    case 'set-qr-data':
      return { ...state, qrData: action.qrData, step: 'pin', error: null };

    case 'go-to-scan':
      return { ...state, step: 'scan', error: null };

    case 'set-pin':
      return { ...state, pin: action.pin };

    case 'connect-start':
      return { ...state, isPending: true, error: null, step: 'discovering' };

    case 'connect-success':
      return {
        ...state,
        isPending: false,
        credentialId: action.credentialId,
        discovered: action.discovered,
        step: 'select',
      };

    case 'reset-to-scan':
      return { ...state, isPending: false, error: action.error, step: 'scan' };

    case 'activate-start':
      return { ...state, isPending: true, error: null, step: 'activating', selections: action.selections };

    case 'activate-success':
      return { ...state, isPending: false, results: action.results, step: 'result' };

    case 'activate-error':
      return { ...state, isPending: false, error: action.error, step: 'select' };

    case 'retry-start':
      return { ...state, isPending: true, error: null };

    case 'retry-success': {
      const merged: ActivationResult = {
        activated: [...state.results.activated, ...action.results.activated],
        failed: action.results.failed,
      };
      return { ...state, isPending: false, results: merged, step: 'result' };
    }

    case 'reset':
      return initialState;

    default:
      return state;
  }
}

// ============================================================================
// HELPERS
// ============================================================================

function toActivationSelection(sel: ChildAccessSelection): ActivationSelection {
  if (sel.mode === 'link') {
    return {
      resourceId: sel.resourceId,
      firstName: sel.firstName,
      lastName: sel.lastName,
      schoolLevel: sel.schoolLevel,
      linkToChildId: sel.linkToChildId,
    };
  }
  return {
    resourceId: sel.resourceId,
    firstName: sel.firstName,
    lastName: sel.lastName,
    schoolLevel: sel.schoolLevel,
    username: sel.username,
    password: sel.password,
  };
}

function isReauthError(err: unknown): boolean {
  return (err as ApiError)?.code === 'pronote_reauth_required';
}

// ============================================================================
// HOOK
// ============================================================================

export interface UsePronoteConnectReturn extends PronoteConnectState {
  setQrData: (qrData: QrData) => void;
  goToScan: () => void;
  submitPin: (pin: string) => Promise<void>;
  confirmSelections: (selections: ChildAccessSelection[]) => Promise<void>;
  retryFailed: (correctedSelections: ChildAccessSelection[]) => Promise<void>;
  reset: () => void;
}

export function usePronoteConnect(): UsePronoteConnectReturn {
  const [state, dispatch] = useReducer(reducer, initialState);

  const setQrData = useCallback((qrData: QrData) => {
    dispatch({ type: 'set-qr-data', qrData });
  }, []);

  const goToScan = useCallback(() => {
    dispatch({ type: 'go-to-scan' });
  }, []);

  const submitPin = useCallback(
    async (pin: string) => {
      if (!state.qrData) return;

      dispatch({ type: 'connect-start' });

      try {
        const connectResponse = await getTreaty().api.pronote.connect.qr.post({
          qr: state.qrData,
          pin,
        });

        // Cast: dynamic Eden route resolves loosely
        const connectData = (connectResponse as unknown as { data: { data: { credentialId: string; resources: DiscoveredChild[] } } | null; error: { status: number; value: unknown } | null });

        if (connectData.error) {
          const ev = connectData.error.value as Record<string, unknown> | null | undefined;
          const code = ev?.code as string | undefined;
          const err = new Error('connect error') as ApiError;
          err.code = code;
          throw err;
        }

        const { credentialId } = connectData.data!.data;

        const childrenResponse = await getTreaty().api.pronote.credentials({ id: credentialId }).children.get();

        // Cast: dynamic Eden route resolves loosely
        const childrenData = (childrenResponse as unknown as { data: { data: DiscoveredChild[] } | null; error: { status: number; value: unknown } | null });

        if (childrenData.error) {
          const ev = childrenData.error.value as Record<string, unknown> | null | undefined;
          const err = new Error('discover error') as ApiError;
          err.code = ev?.code as string | undefined;
          throw err;
        }

        const discovered = childrenData.data!.data;

        dispatch({ type: 'connect-success', credentialId, discovered });
      } catch (err: unknown) {
        if (isReauthError(err)) {
          dispatch({ type: 'reset-to-scan', error: 'QR expiré — rescannez le code dans Pronote.' });
        } else {
          dispatch({ type: 'reset-to-scan', error: 'Connexion Pronote échouée. Réessayez.' });
        }
      }
    },
    [state.qrData],
  );

  const confirmSelections = useCallback(
    async (selections: ChildAccessSelection[]) => {
      if (!state.credentialId) return;

      dispatch({ type: 'activate-start', selections });

      try {
        const apiSelections = selections.map(toActivationSelection);

        // Cast: dynamic :id segment resolves loosely in Eden Treaty types
        const activateEndpoint = getTreaty().api.pronote.credentials({ id: state.credentialId }).activate as unknown as {
          post: (body: { selections: ActivationSelection[] }) => Promise<{ data: { data: ActivationResult } | null; error: { status: number; value: unknown } | null }>;
        };
        const responseData = await activateEndpoint.post({ selections: apiSelections });

        if (responseData.error) {
          const ev = responseData.error.value as Record<string, unknown> | null | undefined;
          throw new Error((ev?.error as string | undefined) ?? 'Activation failed');
        }

        dispatch({ type: 'activate-success', results: responseData.data!.data });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Activation échouée. Réessayez.';
        dispatch({ type: 'activate-error', error: message });
      }
    },
    [state.credentialId],
  );

  const retryFailed = useCallback(
    async (correctedSelections: ChildAccessSelection[]) => {
      if (!state.credentialId) return;

      dispatch({ type: 'retry-start' });

      try {
        const apiSelections = correctedSelections.map(toActivationSelection);

        // Cast: dynamic :id segment resolves loosely in Eden Treaty types
        const activateEndpoint = getTreaty().api.pronote.credentials({ id: state.credentialId }).activate as unknown as {
          post: (body: { selections: ActivationSelection[] }) => Promise<{ data: { data: ActivationResult } | null; error: { status: number; value: unknown } | null }>;
        };
        const responseData = await activateEndpoint.post({ selections: apiSelections });

        if (responseData.error) {
          const ev = responseData.error.value as Record<string, unknown> | null | undefined;
          throw new Error((ev?.error as string | undefined) ?? 'Retry activation failed');
        }

        dispatch({ type: 'retry-success', results: responseData.data!.data });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Réessai échoué.';
        dispatch({ type: 'activate-error', error: message });
      }
    },
    [state.credentialId],
  );

  const reset = useCallback(() => {
    dispatch({ type: 'reset' });
  }, []);

  return {
    ...state,
    setQrData,
    goToScan,
    submitPin,
    confirmSelections,
    retryFailed,
    reset,
  };
}
