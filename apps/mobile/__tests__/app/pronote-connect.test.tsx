/**
 * PronoteConnectScreen — wizard driving usePronoteConnect.
 *
 * Tests mock the step sub-components to avoid camera/native deps.
 * Covers:
 * 1. scan step: QR scan callback → setQrData called with parsed QrData.
 * 2. pin step: submit → submitPin called with PIN.
 * 3. define-access step: existingChildId child → link mode shown (no creds fields).
 * 4. define-access step: new child → ChildCredentialsFields rendered.
 * 5. result step: activated list rendered.
 * 6. result step: failed list + retry button rendered, retryFailed called on press.
 */

import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';

// ─── Hook mock ───────────────────────────────────────────────────────────────

const mockSetQrData = jest.fn();
const mockGoToScan = jest.fn();
const mockSubmitPin = jest.fn();
const mockConfirmSelections = jest.fn();
const mockRetryFailed = jest.fn();
const mockReset = jest.fn();
const mockUsePronoteConnect = jest.fn();

jest.mock('@/hooks/usePronoteConnect', () => ({
  usePronoteConnect: (...args: unknown[]) => mockUsePronoteConnect(...args),
}));

// ─── PronoteStepIntro mock (avoids TomAvatar→MathText→react-native-webview) ───
jest.mock('@/components/parent/pronote/PronoteStepIntro', () => ({
  PronoteStepIntro: ({ onContinue }: { onContinue: () => void }) => {
    const { TouchableOpacity } = require('react-native');
    return <TouchableOpacity testID="mock-intro-continue" onPress={onContinue} />;
  },
}));

// ─── PronoteStepConnecting mock ───────────────────────────────────────────────
jest.mock('@/components/parent/pronote/PronoteStepConnecting', () => ({
  PronoteStepConnecting: () => {
    const { View } = require('react-native');
    return <View testID="mock-connecting" />;
  },
}));

// ─── PronoteQrScanner mock — exposes onBarCodeScanned via testID ──────────────
jest.mock('@/components/parent/PronoteQrScanner', () => ({
  PronoteQrScanner: ({
    onBarCodeScanned,
  }: {
    onBarCodeScanned: (r: { data: string }) => void;
    error: string | null;
  }) => {
    const { TouchableOpacity } = require('react-native');
    return (
      <TouchableOpacity
        testID="mock-qr-trigger"
        onPress={() =>
          onBarCodeScanned({
            data: JSON.stringify({ jeton: 'tok123', login: 'user@x.fr', url: 'https://lycee.fr' }),
          })
        }
      />
    );
  },
}));

// ─── PronotePinEntry mock — exposes pin input + submit button ─────────────────
jest.mock('@/components/parent/PronotePinEntry', () => ({
  PronotePinEntry: ({
    pin,
    onPinChange,
    onSubmit,
  }: {
    establishment: string;
    pin: string;
    onPinChange: (p: string) => void;
    onSubmit: () => void;
    onReset: () => void;
    error: string | null;
    isPending: boolean;
  }) => {
    const { View, TextInput, TouchableOpacity } = require('react-native');
    return (
      <View>
        <TextInput testID="pronote-pin-input" value={pin} onChangeText={onPinChange} />
        <TouchableOpacity testID="pronote-pin-submit" onPress={onSubmit} />
      </View>
    );
  },
}));

// ─── Other deps ──────────────────────────────────────────────────────────────

jest.mock('@/hooks/useAvailableLevels', () => ({
  useAvailableLevels: () => ({
    levels: ['sixieme', 'cinquieme', 'quatrieme', 'troisieme'].map((key) => ({
      key,
      available: true,
      subjectsCount: 10,
    })),
    isLoading: false,
  }),
}));

jest.mock('@/hooks/useParentDashboard', () => ({
  useParentDashboard: () => ({
    children: [],
    isLoading: false,
  }),
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn() }),
}));

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

jest.mock('@/lib/pronote-helpers', () => ({
  parseQrCode: (data: string) => {
    try {
      return JSON.parse(data) as unknown;
    } catch {
      return null;
    }
  },
  extractEstablishment: () => 'lycee-moulin',
}));

// ─── Import screen (AFTER mocks) ─────────────────────────────────────────────

import PronoteConnectScreen from '@/app/(parent)/pronote-connect';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeHookState(overrides: Record<string, unknown> = {}) {
  return {
    step: 'scan',
    qrData: null,
    pin: null,
    credentialId: null,
    discovered: [],
    selections: [],
    isPending: false,
    error: null,
    results: { activated: [], failed: [] },
    setQrData: mockSetQrData,
    goToScan: mockGoToScan,
    submitPin: mockSubmitPin,
    confirmSelections: mockConfirmSelections,
    retryFailed: mockRetryFailed,
    reset: mockReset,
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('PronoteConnectScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUsePronoteConnect.mockReturnValue(makeHookState());
  });

  // ── 1. scan step ────────────────────────────────────────────────────────────
  it('scan step: QR scan callback calls setQrData with parsed QrData', () => {
    const { getByTestId } = render(<PronoteConnectScreen />);

    fireEvent.press(getByTestId('mock-qr-trigger'));

    expect(mockSetQrData).toHaveBeenCalledWith({
      jeton: 'tok123',
      login: 'user@x.fr',
      url: 'https://lycee.fr',
    });
  });

  // ── 2. pin step ─────────────────────────────────────────────────────────────
  it('pin step: submit calls submitPin with entered PIN', async () => {
    mockSubmitPin.mockResolvedValue(undefined);
    mockUsePronoteConnect.mockReturnValue(
      makeHookState({
        step: 'pin',
        qrData: { jeton: 'tok123', login: 'user@x.fr', url: 'https://lycee.fr' },
      }),
    );

    const { getByTestId } = render(<PronoteConnectScreen />);

    fireEvent.changeText(getByTestId('pronote-pin-input'), '1234');

    await act(async () => {
      fireEvent.press(getByTestId('pronote-pin-submit'));
    });

    expect(mockSubmitPin).toHaveBeenCalledWith('1234');
  });

  // ── 3. define-access: existingChildId → link mode, no creds fields ──────────
  it('select step: existingChildId child shows link mode (no ChildCredentialsFields)', () => {
    mockUsePronoteConnect.mockReturnValue(
      makeHookState({
        step: 'select',
        discovered: [
          {
            resourceId: 1,
            name: 'DUPONT Marie',
            className: '4eA',
            establishmentName: 'Collège Jean Moulin',
            suggested: { firstName: 'Marie', lastName: 'DUPONT', schoolLevel: 'quatrieme' },
            existingChildId: 'existing-child-42',
          },
        ],
      }),
    );

    const { getByTestId, queryByTestId } = render(<PronoteConnectScreen />);

    expect(getByTestId('define-access-link-mode-1')).toBeTruthy();
    expect(queryByTestId('credentials-username')).toBeNull();
  });

  // ── 4. define-access: new child → ChildCredentialsFields ───────────────────
  it('select step: new child renders credential fields', () => {
    mockUsePronoteConnect.mockReturnValue(
      makeHookState({
        step: 'select',
        discovered: [
          {
            resourceId: 2,
            name: 'MARTIN Paul',
            className: '6eB',
            establishmentName: 'Collège Jean Moulin',
            suggested: { firstName: 'Paul', lastName: 'MARTIN', schoolLevel: 'sixieme' },
            existingChildId: null,
          },
        ],
      }),
    );

    const { getByTestId } = render(<PronoteConnectScreen />);

    expect(getByTestId('credentials-username')).toBeTruthy();
    expect(getByTestId('credentials-password')).toBeTruthy();
  });

  // ── 5. result step: activated list ─────────────────────────────────────────
  it('result step: shows activated list', () => {
    mockUsePronoteConnect.mockReturnValue(
      makeHookState({
        step: 'result',
        results: {
          activated: [{ resourceId: 1, childId: 'child-1' }],
          failed: [],
        },
        discovered: [
          {
            resourceId: 1,
            name: 'DUPONT Marie',
            className: '4eA',
            establishmentName: 'Collège Jean Moulin',
            suggested: { firstName: 'Marie', lastName: 'DUPONT', schoolLevel: 'quatrieme' },
            existingChildId: null,
          },
        ],
        selections: [
          {
            resourceId: 1,
            firstName: 'Marie',
            lastName: 'DUPONT',
            schoolLevel: 'quatrieme',
            mode: 'create',
            username: 'marie.dupont',
            password: 'Password1!',
          },
        ],
      }),
    );

    const { getByTestId } = render(<PronoteConnectScreen />);

    expect(getByTestId('result-activated-list')).toBeTruthy();
  });

  // ── 6. result step: failed list + retry ────────────────────────────────────
  it('result step: failed child shows reason and retry button', () => {
    mockRetryFailed.mockResolvedValue(undefined);
    mockUsePronoteConnect.mockReturnValue(
      makeHookState({
        step: 'result',
        results: {
          activated: [],
          failed: [{ resourceId: 2, reason: 'Username already taken' }],
        },
        discovered: [
          {
            resourceId: 2,
            name: 'MARTIN Paul',
            className: '6eB',
            establishmentName: 'Collège Jean Moulin',
            suggested: { firstName: 'Paul', lastName: 'MARTIN', schoolLevel: 'sixieme' },
            existingChildId: null,
          },
        ],
        selections: [
          {
            resourceId: 2,
            firstName: 'Paul',
            lastName: 'MARTIN',
            schoolLevel: 'sixieme',
            mode: 'create',
            username: 'paul.martin',
            password: 'Password1!',
          },
        ],
      }),
    );

    const { getByTestId } = render(<PronoteConnectScreen />);

    expect(getByTestId('result-failed-list')).toBeTruthy();
    expect(getByTestId('result-retry-btn')).toBeTruthy();
  });

  // ── 7. intro continue → goToScan called ────────────────────────────────────
  it('intro step: pressing continue calls goToScan', () => {
    mockUsePronoteConnect.mockReturnValue(makeHookState({ step: 'intro' }));

    const { getByTestId } = render(<PronoteConnectScreen />);

    fireEvent.press(getByTestId('mock-intro-continue'));

    expect(mockGoToScan).toHaveBeenCalledTimes(1);
  });

  // ── 8. result step: edit failed child username → retryFailed with corrected value ──
  it('result step: editing failed child username then retry calls retryFailed with corrected username', async () => {
    mockRetryFailed.mockResolvedValue(undefined);

    // Simulate hook where selections has failing username
    const failedSelections = [
      {
        resourceId: 3,
        firstName: 'Lea',
        lastName: 'BERNARD',
        schoolLevel: 'cinquieme',
        mode: 'create' as const,
        username: 'lea.bernard',
        password: 'Password1!',
      },
    ];

    mockUsePronoteConnect.mockReturnValue(
      makeHookState({
        step: 'result',
        results: {
          activated: [],
          failed: [{ resourceId: 3, reason: 'missing_credentials' }],
        },
        discovered: [
          {
            resourceId: 3,
            name: 'BERNARD Lea',
            className: '5eC',
            establishmentName: 'Collège Jean Moulin',
            suggested: { firstName: 'Lea', lastName: 'BERNARD', schoolLevel: 'cinquieme' },
            existingChildId: null,
          },
        ],
        selections: failedSelections,
      }),
    );

    const { getByTestId } = render(<PronoteConnectScreen />);

    // Edit the username field for the failed child
    fireEvent.changeText(getByTestId('result-failed-username-3'), 'lea.bernard.new');

    // Press retry
    await act(async () => {
      fireEvent.press(getByTestId('result-retry-btn'));
    });

    // retryFailed should be called with the CORRECTED username
    expect(mockRetryFailed).toHaveBeenCalledTimes(1);
    const [calledWith] = mockRetryFailed.mock.calls[0] as [typeof failedSelections];
    const childEntry = calledWith.find((s) => s.resourceId === 3);
    expect(childEntry?.username).toBe('lea.bernard.new');
  });

  // ── 9. result step: all-conflict failure → shows "Terminer" not retry ──────
  it('result step: only already_mapped failures shows "Terminer" button instead of retry', () => {
    mockUsePronoteConnect.mockReturnValue(
      makeHookState({
        step: 'result',
        results: {
          activated: [],
          failed: [{ resourceId: 4, reason: 'already_mapped' }],
        },
        discovered: [
          {
            resourceId: 4,
            name: 'DUPONT Emma',
            className: null,
            establishmentName: 'Lycée Paul Valéry',
            suggested: { firstName: 'Emma', lastName: 'DUPONT', schoolLevel: 'seconde' },
            existingChildId: null,
          },
        ],
        selections: [
          {
            resourceId: 4,
            firstName: 'Emma',
            lastName: 'DUPONT',
            schoolLevel: 'seconde',
            mode: 'create' as const,
          },
        ],
      }),
    );

    const { getByTestId, queryByTestId } = render(<PronoteConnectScreen />);

    expect(queryByTestId('result-retry-btn')).toBeNull();
    expect(getByTestId('result-done-btn')).toBeTruthy();
  });

  // ── 10. result step: mixed failures → retry only sends correctable subset ──
  it('result step: mixed failures (correctable + conflict) → retryFailed only receives correctable', async () => {
    mockRetryFailed.mockResolvedValue(undefined);

    const selections = [
      {
        resourceId: 5,
        firstName: 'Luc',
        lastName: 'MARTIN',
        schoolLevel: 'sixieme',
        mode: 'create' as const,
        username: 'luc.martin',
        password: 'Password1!',
      },
      {
        resourceId: 6,
        firstName: 'Marie',
        lastName: 'MARTIN',
        schoolLevel: 'quatrieme',
        mode: 'create' as const,
        username: 'marie.martin',
        password: 'Password1!',
      },
    ];

    mockUsePronoteConnect.mockReturnValue(
      makeHookState({
        step: 'result',
        results: {
          activated: [],
          failed: [
            { resourceId: 5, reason: 'missing_credentials' },
            { resourceId: 6, reason: 'already_mapped' },
          ],
        },
        discovered: [
          {
            resourceId: 5,
            name: 'MARTIN Luc',
            className: '6eA',
            establishmentName: 'Collège Jean Moulin',
            suggested: { firstName: 'Luc', lastName: 'MARTIN', schoolLevel: 'sixieme' },
            existingChildId: null,
          },
          {
            resourceId: 6,
            name: 'MARTIN Marie',
            className: '4eB',
            establishmentName: 'Collège Jean Moulin',
            suggested: { firstName: 'Marie', lastName: 'MARTIN', schoolLevel: 'quatrieme' },
            existingChildId: null,
          },
        ],
        selections,
      }),
    );

    const { getByTestId } = render(<PronoteConnectScreen />);

    expect(getByTestId('result-retry-btn')).toBeTruthy();

    await act(async () => {
      fireEvent.press(getByTestId('result-retry-btn'));
    });

    expect(mockRetryFailed).toHaveBeenCalledTimes(1);
    const [calledWith] = mockRetryFailed.mock.calls[0] as [typeof selections];
    expect(calledWith.some((s) => s.resourceId === 6)).toBe(false);
    expect(calledWith.some((s) => s.resourceId === 5)).toBe(true);
  });
});
