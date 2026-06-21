/**
 * Login Screen — student path wired to signIn.username
 *
 * Verifies that when the "Eleve" toggle is selected, handleLogin calls
 * signInUsername (not signIn / email) with the identifier and password.
 *
 * Real labels from the components:
 *   - Student toggle: testID="login-toggle-student"  (label "Eleve", no accent)
 *   - Parent toggle:  testID="login-toggle-parent"
 *   - Identifier:     testID="login-identifier-input"
 *   - Password:       testID="login-password-input"
 *   - Submit:         testID="login-submit-button"
 *   - Error banner:   testID="login-error-message"
 */

import React from 'react';
import { render, fireEvent, act, waitFor } from '@testing-library/react-native';

// ─── Mocks (hoisted by jest) ──────────────────────────────────────────────────

// jest.mock is hoisted before variable declarations, so we cannot reference
// variables created above the call. Use jest.fn() inline; retrieve refs
// via jest.mocked() or require() after the mock is established.

jest.mock('@/lib/auth', () => ({
  signIn: jest.fn(),
  signInUsername: jest.fn(),
  signInWithGoogle: jest.fn(),
}));

jest.mock('@/hooks/useThemeColors', () => ({
  useThemeColors: () => ({
    primary: '#2563EB',
    primaryForeground: '#FFFFFF',
    success: '#059669',
    successForeground: '#FFFFFF',
    warning: '#D97706',
    warningForeground: '#FFFFFF',
    destructive: '#DC2626',
    destructiveForeground: '#FFFFFF',
    info: '#0EA5E9',
    infoForeground: '#FFFFFF',
    foreground: '#1C1917',
    mutedForeground: '#78716C',
    background: '#FAFAF9',
    border: '#E7E5E4',
    card: '#FFFFFF',
  }),
}));

jest.mock('@/components/common', () => ({
  TomAvatar: () => null,
}));

jest.mock('@/components/auth/GoogleSignInButton', () => ({
  GoogleSignInButton: () => null,
}));

jest.mock('@/components/auth/auth-screen', () => ({
  AuthScreen: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// ─── Resolve mock refs after jest.mock ────────────────────────────────────────

import * as AuthModule from '@/lib/auth';
import LoginScreen from '@/app/(auth)/login';

const mockSignInEmail = jest.mocked(AuthModule.signIn);
const mockSignInUsername = jest.mocked(AuthModule.signInUsername);

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('LoginScreen — accountType routing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSignInEmail.mockResolvedValue({ data: null, error: null } as never);
    mockSignInUsername.mockResolvedValue({ data: null, error: null } as never);
  });

  it('calls signIn (email) when accountType is parent (default)', async () => {
    const { getByTestId } = render(<LoginScreen />);

    fireEvent.changeText(getByTestId('login-identifier-input'), 'parent@example.com');
    fireEvent.changeText(getByTestId('login-password-input'), 'secret');

    await act(async () => {
      fireEvent.press(getByTestId('login-submit-button'));
    });

    expect(mockSignInEmail).toHaveBeenCalledWith('parent@example.com', 'secret');
    expect(mockSignInUsername).not.toHaveBeenCalled();
  });

  it('calls signInUsername when accountType is student', async () => {
    const { getByTestId } = render(<LoginScreen />);

    // Switch to student tab — testID="login-toggle-student", label "Eleve"
    fireEvent.press(getByTestId('login-toggle-student'));

    fireEvent.changeText(getByTestId('login-identifier-input'), 'jean.dupont');
    fireEvent.changeText(getByTestId('login-password-input'), 'motdepasse');

    await act(async () => {
      fireEvent.press(getByTestId('login-submit-button'));
    });

    expect(mockSignInUsername).toHaveBeenCalledWith('jean.dupont', 'motdepasse');
    expect(mockSignInEmail).not.toHaveBeenCalled();
  });

  it('does NOT call signInUsername when accountType is parent (regression)', async () => {
    const { getByTestId } = render(<LoginScreen />);

    // Explicitly select parent tab
    fireEvent.press(getByTestId('login-toggle-parent'));

    fireEvent.changeText(getByTestId('login-identifier-input'), 'parent@example.com');
    fireEvent.changeText(getByTestId('login-password-input'), 'secret');

    await act(async () => {
      fireEvent.press(getByTestId('login-submit-button'));
    });

    expect(mockSignInEmail).toHaveBeenCalledTimes(1);
    expect(mockSignInUsername).not.toHaveBeenCalled();
  });

  it('shows error banner when signInUsername returns an error', async () => {
    mockSignInUsername.mockResolvedValueOnce({
      data: null,
      error: { message: 'invalid credentials', status: 401 },
    } as never);

    const { getByTestId } = render(<LoginScreen />);

    fireEvent.press(getByTestId('login-toggle-student'));
    fireEvent.changeText(getByTestId('login-identifier-input'), 'bad.user');
    fireEvent.changeText(getByTestId('login-password-input'), 'wrong');

    await act(async () => {
      fireEvent.press(getByTestId('login-submit-button'));
    });

    await waitFor(() => {
      expect(getByTestId('login-error-message')).toBeTruthy();
    });
  });
});
