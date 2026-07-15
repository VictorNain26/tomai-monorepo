/**
 * Button — parité design system : variant secondary + état loading.
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

jest.mock('@/hooks/useThemeColors', () => ({
  useThemeColors: () => ({
    primary: '#2563EB',
    primaryForeground: '#FFFFFF',
    secondary: '#F1F5F9',
    secondaryForeground: '#0F172A',
    destructive: '#DC2626',
    destructiveForeground: '#FFFFFF',
    foreground: '#0F172A',
    mutedForeground: '#64748B',
    background: '#FFFFFF',
    border: '#E2E8F0',
    card: '#FFFFFF',
  }),
}));

jest.mock('@/lib/haptics', () => ({
  haptics: { light: jest.fn(), heavy: jest.fn() },
}));

import { Button } from '@/components/ui/button';

describe('Button', () => {
  it('renders the secondary variant with its label', () => {
    const { getByText } = render(<Button variant="secondary">Continuer</Button>);
    expect(getByText('Continuer')).toBeTruthy();
  });

  it('does not fire onPress while loading', () => {
    const onPress = jest.fn();
    const { getByText, getByRole, rerender } = render(<Button onPress={onPress}>Envoyer</Button>);
    fireEvent.press(getByText('Envoyer'));
    expect(onPress).toHaveBeenCalledTimes(1);

    rerender(<Button onPress={onPress} isLoading>Envoyer</Button>);
    // en loading le label est remplacé par le spinner et le Pressable est disabled
    expect(() => getByText('Envoyer')).toThrow();

    fireEvent.press(getByRole('button'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
