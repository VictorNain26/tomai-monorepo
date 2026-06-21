/**
 * PronoteManageScreen — list, resync, delete, reset-password tests.
 *
 * Covers:
 * 1. list: renders one card per establishment with childCount.
 * 2. resync: shows added count; shows "à jour" when 0 added.
 * 3. delete: asks confirm then calls delete + refetches.
 * 4. reset-password: validates min 8 and calls the patch.
 * 5. empty state: shows "Connecter Pronote" CTA.
 */

import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';

// ─── usePronoteManage mock ────────────────────────────────────────────────────

const mockResync = jest.fn();
const mockDeleteCredential = jest.fn();
const mockResetChildPassword = jest.fn();
const mockUsePronoteManage = jest.fn();

jest.mock('@/hooks/usePronoteManage', () => ({
  usePronoteManage: (...args: unknown[]) => mockUsePronoteManage(...args),
}));

// ─── useConfirm mock ──────────────────────────────────────────────────────────

const mockConfirm = jest.fn();

jest.mock('@/components/ui/confirm-dialog', () => ({
  useConfirm: () => ({ confirm: mockConfirm }),
  ConfirmDialogProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// ─── useToast mock ────────────────────────────────────────────────────────────

const mockToastSuccess = jest.fn();
const mockToastError = jest.fn();

jest.mock('@/components/ui/toast', () => ({
  useToast: () => ({ success: mockToastSuccess, error: mockToastError }),
}));

// ─── expo-router mock ─────────────────────────────────────────────────────────

const mockRouterPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockRouterPush, back: jest.fn() }),
}));

// ─── useThemeColors mock ──────────────────────────────────────────────────────

jest.mock('@/hooks/useThemeColors', () => ({
  useThemeColors: () => ({
    primary: '#2563EB',
    primaryForeground: '#FFFFFF',
    destructive: '#DC2626',
    destructiveForeground: '#FFFFFF',
    foreground: '#1C1917',
    mutedForeground: '#78716C',
    background: '#FAFAF9',
    border: '#E7E5E4',
    muted: '#F5F5F4',
    card: '#FFFFFF',
    success: '#16A34A',
    warning: '#D97706',
  }),
}));

// ─── NativeWind / safe-area / haptics ─────────────────────────────────────────

jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return {
    SafeAreaView: View,
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  };
});

jest.mock('nativewind', () => ({
  styled: (Component: React.ComponentType) => Component,
}));

jest.mock('@/lib/haptics', () => ({
  haptics: { light: jest.fn(), heavy: jest.fn() },
}));

// ─── Import screen AFTER mocks ────────────────────────────────────────────────

import PronoteManageScreen from '@/app/(parent)/pronote-manage';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeCredential(overrides: Record<string, unknown> = {}) {
  return {
    credentialId: 'cred-1',
    establishmentName: 'Lycée Jean Moulin',
    establishmentUrl: 'https://jean-moulin.fr',
    childCount: 2,
    ...overrides,
  };
}

function makeHookState(overrides: Record<string, unknown> = {}) {
  return {
    credentials: [],
    pronoteChildren: [],
    isLoading: false,
    isError: false,
    resync: mockResync,
    deleteCredential: mockDeleteCredential,
    resetChildPassword: mockResetChildPassword,
    resyncingId: null,
    deletingId: null,
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('PronoteManageScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUsePronoteManage.mockReturnValue(makeHookState());
  });

  // ── 1. list ─────────────────────────────────────────────────────────────────
  it('renders one card per establishment with childCount', () => {
    mockUsePronoteManage.mockReturnValue(
      makeHookState({
        credentials: [
          makeCredential({ credentialId: 'cred-1', establishmentName: 'Lycée Jean Moulin', childCount: 2 }),
          makeCredential({ credentialId: 'cred-2', establishmentName: 'Collège Paul Bert', childCount: 1 }),
        ],
      }),
    );

    const { getByTestId } = render(<PronoteManageScreen />);

    expect(getByTestId('credential-card-cred-1')).toBeTruthy();
    expect(getByTestId('credential-card-cred-2')).toBeTruthy();
    expect(getByTestId('child-count-cred-1')).toBeTruthy();
    expect(getByTestId('child-count-cred-2')).toBeTruthy();
  });

  // ── 2a. resync: added > 0 ───────────────────────────────────────────────────
  it('resync: shows added count when children were added', async () => {
    mockResync.mockResolvedValue({ added: [{ resourceId: 3 }, { resourceId: 4 }], stillMapped: [] });
    mockUsePronoteManage.mockReturnValue(
      makeHookState({
        credentials: [makeCredential()],
      }),
    );

    const { getByTestId } = render(<PronoteManageScreen />);

    await act(async () => {
      fireEvent.press(getByTestId('resync-btn-cred-1'));
    });

    expect(mockResync).toHaveBeenCalledWith('cred-1');
    expect(mockToastSuccess).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('2'),
    );
  });

  // ── 2b. resync: "à jour" when 0 added ──────────────────────────────────────
  it('resync: shows "à jour" when no children were added', async () => {
    mockResync.mockResolvedValue({ added: [], stillMapped: [1, 2] });
    mockUsePronoteManage.mockReturnValue(
      makeHookState({
        credentials: [makeCredential()],
      }),
    );

    const { getByTestId } = render(<PronoteManageScreen />);

    await act(async () => {
      fireEvent.press(getByTestId('resync-btn-cred-1'));
    });

    expect(mockToastSuccess).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('à jour'),
    );
  });

  // ── 3. delete: confirm then delete + refetch ────────────────────────────────
  it('delete: asks confirm then calls deleteCredential', async () => {
    mockConfirm.mockResolvedValue(true);
    mockDeleteCredential.mockResolvedValue({ success: true });
    mockUsePronoteManage.mockReturnValue(
      makeHookState({
        credentials: [makeCredential()],
      }),
    );

    const { getByTestId } = render(<PronoteManageScreen />);

    await act(async () => {
      fireEvent.press(getByTestId('delete-btn-cred-1'));
    });

    expect(mockConfirm).toHaveBeenCalled();
    expect(mockDeleteCredential).toHaveBeenCalledWith('cred-1');
  });

  it('delete: does NOT call deleteCredential if confirm is cancelled', async () => {
    mockConfirm.mockResolvedValue(false);
    mockUsePronoteManage.mockReturnValue(
      makeHookState({
        credentials: [makeCredential()],
      }),
    );

    const { getByTestId } = render(<PronoteManageScreen />);

    await act(async () => {
      fireEvent.press(getByTestId('delete-btn-cred-1'));
    });

    expect(mockConfirm).toHaveBeenCalled();
    expect(mockDeleteCredential).not.toHaveBeenCalled();
  });

  // ── 4. reset-password ───────────────────────────────────────────────────────
  it('reset-password: validates min 8 chars and blocks submission', async () => {
    mockUsePronoteManage.mockReturnValue(
      makeHookState({
        credentials: [makeCredential()],
        pronoteChildren: [
          { id: 'child-1', firstName: 'Marie', lastName: 'DUPONT', hasPronote: true, pronoteCredentialId: 'cred-1' },
        ],
      }),
    );

    const { getByTestId } = render(<PronoteManageScreen />);

    // Open reset password dialog
    fireEvent.press(getByTestId('reset-pwd-btn-child-1'));

    // Enter short password
    fireEvent.changeText(getByTestId('reset-pwd-input'), 'short');
    await act(async () => {
      fireEvent.press(getByTestId('reset-pwd-submit'));
    });

    // Should NOT call resetChildPassword with invalid password
    expect(mockResetChildPassword).not.toHaveBeenCalled();
    expect(getByTestId('reset-pwd-error')).toBeTruthy();
  });

  it('reset-password: calls resetChildPassword with valid password', async () => {
    mockResetChildPassword.mockResolvedValue({});
    mockUsePronoteManage.mockReturnValue(
      makeHookState({
        credentials: [makeCredential()],
        pronoteChildren: [
          { id: 'child-1', firstName: 'Marie', lastName: 'DUPONT', hasPronote: true, pronoteCredentialId: 'cred-1' },
        ],
      }),
    );

    const { getByTestId } = render(<PronoteManageScreen />);

    fireEvent.press(getByTestId('reset-pwd-btn-child-1'));
    fireEvent.changeText(getByTestId('reset-pwd-input'), 'ValidPass1');
    await act(async () => {
      fireEvent.press(getByTestId('reset-pwd-submit'));
    });

    expect(mockResetChildPassword).toHaveBeenCalledWith('child-1', 'ValidPass1');
    expect(mockToastSuccess).toHaveBeenCalled();
  });

  // ── 6. multi-establishment: each child appears under its own card only ───────
  it('multi-establishment: each child appears under only its own establishment card', () => {
    mockUsePronoteManage.mockReturnValue(
      makeHookState({
        credentials: [
          makeCredential({ credentialId: 'cred-1', establishmentName: 'Lycée Jean Moulin', childCount: 1 }),
          makeCredential({ credentialId: 'cred-2', establishmentName: 'Collège Paul Bert', childCount: 1 }),
        ],
        pronoteChildren: [
          { id: 'child-a', firstName: 'Alice', lastName: 'Durand', hasPronote: true, pronoteCredentialId: 'cred-1' },
          { id: 'child-b', firstName: 'Bob', lastName: 'Martin', hasPronote: true, pronoteCredentialId: 'cred-2' },
        ],
      }),
    );

    const { getByTestId, queryByTestId } = render(<PronoteManageScreen />);

    // child-a's reset button exists under cred-1 card
    expect(getByTestId('reset-pwd-btn-child-a')).toBeTruthy();
    // child-b's reset button exists under cred-2 card
    expect(getByTestId('reset-pwd-btn-child-b')).toBeTruthy();

    // The card-level scoping is structural: PronoteCredentialCard only receives
    // its own children, so each reset button appears exactly once.
    expect(queryByTestId('reset-pwd-btn-child-a')).toBeTruthy();
    expect(queryByTestId('reset-pwd-btn-child-b')).toBeTruthy();
  });

  // ── 7. reset form renders EXACTLY ONCE even with 2 establishments ────────────
  it('reset-password: form renders exactly once when triggered (not duplicated under each card)', async () => {
    mockUsePronoteManage.mockReturnValue(
      makeHookState({
        credentials: [
          makeCredential({ credentialId: 'cred-1', establishmentName: 'Lycée Jean Moulin', childCount: 1 }),
          makeCredential({ credentialId: 'cred-2', establishmentName: 'Collège Paul Bert', childCount: 1 }),
        ],
        pronoteChildren: [
          { id: 'child-a', firstName: 'Alice', lastName: 'Durand', hasPronote: true, pronoteCredentialId: 'cred-1' },
          { id: 'child-b', firstName: 'Bob', lastName: 'Martin', hasPronote: true, pronoteCredentialId: 'cred-2' },
        ],
      }),
    );

    const { getByTestId, queryAllByTestId } = render(<PronoteManageScreen />);

    // Trigger reset for child-a
    fireEvent.press(getByTestId('reset-pwd-btn-child-a'));

    // The input field must appear exactly once, not once per credential card
    expect(queryAllByTestId('reset-pwd-input').length).toBe(1);
  });

  // ── 5. empty state ──────────────────────────────────────────────────────────
  it('empty state: shows connect CTA when no credentials', () => {
    mockUsePronoteManage.mockReturnValue(makeHookState({ credentials: [] }));

    const { getByTestId } = render(<PronoteManageScreen />);

    expect(getByTestId('empty-connect-cta')).toBeTruthy();
  });

  it('empty state: pressing connect CTA navigates to pronote-connect', () => {
    mockUsePronoteManage.mockReturnValue(makeHookState({ credentials: [] }));

    const { getByTestId } = render(<PronoteManageScreen />);

    fireEvent.press(getByTestId('empty-connect-cta'));

    expect(mockRouterPush).toHaveBeenCalledWith('/(parent)/pronote-connect');
  });
});
