/**
 * AddChildScreen — manual child creation form
 *
 * Fields (matching createChildSchema + ICreateChildData):
 *   firstName, lastName, username (min 3), password (min 8, strength indicator),
 *   schoolLevel (picker), dateOfBirth (YYYY-MM-DD)
 *
 * testIDs:
 *   add-child-first-name, add-child-last-name, add-child-username,
 *   add-child-password, add-child-dob, add-child-level-picker,
 *   add-child-submit, add-child-error
 */

import React from 'react';
import { render, fireEvent, act, waitFor } from '@testing-library/react-native';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockCreateChild = jest.fn();
const mockBack = jest.fn();

jest.mock('@/hooks/useParentDashboard', () => ({
  useParentDashboard: () => ({
    createChild: mockCreateChild,
    isCreating: false,
  }),
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack }),
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
  }),
}));

jest.mock('@/lib/haptics', () => ({
  haptics: { light: jest.fn(), heavy: jest.fn() },
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

// ─── Import screen under test (AFTER mocks) ──────────────────────────────────
import AddChildScreen from '@/app/(parent)/add-child';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fillValidForm(getByTestId: ReturnType<typeof render>['getByTestId']) {
  fireEvent.changeText(getByTestId('add-child-first-name'), 'Alice');
  fireEvent.changeText(getByTestId('add-child-last-name'), 'Dupont');
  fireEvent.changeText(getByTestId('add-child-username'), 'alice.dupont');
  fireEvent.changeText(getByTestId('add-child-password'), 'Password1');
  fireEvent.changeText(getByTestId('add-child-dob'), '2012-05-15');
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('AddChildScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateChild.mockResolvedValue({ id: 'c1', firstName: 'Alice' });
  });

  it('renders all required fields', () => {
    const { getByTestId } = render(<AddChildScreen />);
    expect(getByTestId('add-child-first-name')).toBeTruthy();
    expect(getByTestId('add-child-last-name')).toBeTruthy();
    expect(getByTestId('add-child-username')).toBeTruthy();
    expect(getByTestId('add-child-password')).toBeTruthy();
    expect(getByTestId('add-child-dob')).toBeTruthy();
    expect(getByTestId('add-child-submit')).toBeTruthy();
  });

  it('calls createChild with correct payload and navigates back on success', async () => {
    const { getByTestId } = render(<AddChildScreen />);

    fillValidForm(getByTestId);
    // Pick schoolLevel — default is 'sixieme'; we can trigger a level change
    // via the picker. For simplicity, trust the default is set.

    await act(async () => {
      fireEvent.press(getByTestId('add-child-submit'));
    });

    await waitFor(() => {
      expect(mockCreateChild).toHaveBeenCalledWith(
        expect.objectContaining({
          firstName: 'Alice',
          lastName: 'Dupont',
          username: 'alice.dupont',
          password: 'Password1',
          dateOfBirth: '2012-05-15',
        })
      );
    });

    await waitFor(() => {
      expect(mockBack).toHaveBeenCalled();
    });
  });

  it('shows client validation error for username too short', async () => {
    const { getByTestId, findByTestId } = render(<AddChildScreen />);

    fireEvent.changeText(getByTestId('add-child-first-name'), 'Alice');
    fireEvent.changeText(getByTestId('add-child-last-name'), 'Dupont');
    fireEvent.changeText(getByTestId('add-child-username'), 'ab'); // < min 3
    fireEvent.changeText(getByTestId('add-child-password'), 'Password1');
    fireEvent.changeText(getByTestId('add-child-dob'), '2012-05-15');

    await act(async () => {
      fireEvent.press(getByTestId('add-child-submit'));
    });

    const err = await findByTestId('add-child-error');
    expect(err).toBeTruthy();
    expect(mockCreateChild).not.toHaveBeenCalled();
  });

  it('shows client validation error for password too short', async () => {
    const { getByTestId, findByTestId } = render(<AddChildScreen />);

    fillValidForm(getByTestId);
    fireEvent.changeText(getByTestId('add-child-password'), 'Short1'); // < 8

    await act(async () => {
      fireEvent.press(getByTestId('add-child-submit'));
    });

    const err = await findByTestId('add-child-error');
    expect(err).toBeTruthy();
    expect(mockCreateChild).not.toHaveBeenCalled();
  });

  it('surfaces API "username already taken" error to the user', async () => {
    mockCreateChild.mockRejectedValueOnce(
      new Error('Ce nom d\'utilisateur existe déjà')
    );

    const { getByTestId, findByTestId } = render(<AddChildScreen />);
    fillValidForm(getByTestId);

    await act(async () => {
      fireEvent.press(getByTestId('add-child-submit'));
    });

    const err = await findByTestId('add-child-error');
    expect(err).toBeTruthy();
  });
});
