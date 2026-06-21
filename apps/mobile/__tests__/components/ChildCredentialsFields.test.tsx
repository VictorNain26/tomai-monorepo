/**
 * ChildCredentialsFields — unit tests
 *
 * Verifies: username validation error, weak password indicator, strong password indicator.
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

// ─── Mocks ───────────────────────────────────────────────────────────────────

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

// ─── Import component under test (AFTER mocks) ───────────────────────────────
import { ChildCredentialsFields } from '@/components/parent/ChildCredentialsFields';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeProps(overrides: Partial<React.ComponentProps<typeof ChildCredentialsFields>> = {}) {
  return {
    username: '',
    password: '',
    schoolLevel: 'sixieme' as const,
    onChange: jest.fn(),
    errors: {},
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('ChildCredentialsFields', () => {
  it('shows username error when error prop contains username message', () => {
    const { getByText } = render(
      <ChildCredentialsFields
        {...makeProps({ errors: { username: 'Identifiant : lettres, chiffres, points, underscores' } })}
      />
    );
    expect(getByText('Identifiant : lettres, chiffres, points, underscores')).toBeTruthy();
  });

  it('shows weak strength indicator for a short password', () => {
    const { getByTestId } = render(
      <ChildCredentialsFields
        {...makeProps({ password: 'abc' })}
      />
    );
    expect(getByTestId('password-strength-weak')).toBeTruthy();
  });

  it('shows strong strength indicator for a complex password', () => {
    const { getByTestId } = render(
      <ChildCredentialsFields
        {...makeProps({ password: 'Password1!' })}
      />
    );
    expect(getByTestId('password-strength-strong')).toBeTruthy();
  });

  it('calls onChange when username input changes', () => {
    const onChange = jest.fn();
    const { getByTestId } = render(
      <ChildCredentialsFields {...makeProps({ onChange })} />
    );
    fireEvent.changeText(getByTestId('credentials-username'), 'alice.dupont');
    expect(onChange).toHaveBeenCalledWith('username', 'alice.dupont');
  });

  it('calls onChange when password input changes', () => {
    const onChange = jest.fn();
    const { getByTestId } = render(
      <ChildCredentialsFields {...makeProps({ onChange })} />
    );
    fireEvent.changeText(getByTestId('credentials-password'), 'Password1');
    expect(onChange).toHaveBeenCalledWith('password', 'Password1');
  });

  it('renders level picker', () => {
    const { getByTestId } = render(
      <ChildCredentialsFields {...makeProps()} />
    );
    expect(getByTestId('add-child-level-picker')).toBeTruthy();
  });
});
