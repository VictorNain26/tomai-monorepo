/**
 * Student Profile Screen — Task 9: pronote section gate via usePronoteStatus(selfId)
 *
 * Verifies that:
 * 1. usePronoteStatus receives the current user's own id.
 * 2. Pronote menu section appears when status.hasPronote === true.
 * 3. Pronote menu section is absent when status.hasPronote === false.
 * 4. className in profile header comes from status.className.
 */

import React from 'react';
import { render, waitFor } from '@testing-library/react-native';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockUsePronoteStatus = jest.fn();
const mockUsePronote = jest.fn();
const mockUseUser = jest.fn();
const mockUseStudentDashboard = jest.fn();
const mockSignOut = jest.fn();

jest.mock('@/hooks', () => ({
  usePronote: (...args: unknown[]) => mockUsePronote(...args),
  usePronoteStatus: (...args: unknown[]) => mockUsePronoteStatus(...args),
  useStudentDashboard: () => mockUseStudentDashboard(),
  useThemeColors: () => ({
    primary: '#2563EB',
    foreground: '#1C1917',
    mutedForeground: '#78716C',
    destructive: '#DC2626',
    background: '#FAFAF9',
    muted: '#F5F5F4',
    card: '#FFFFFF',
    border: '#E7E5E4',
    cardForeground: '#1C1917',
  }),
}));

jest.mock('@/lib/auth', () => ({
  useUser: () => mockUseUser(),
  signOut: () => mockSignOut(),
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));

jest.mock('@/components/ui/toast', () => ({
  useToast: () => ({ error: jest.fn() }),
}));

jest.mock('@/components/ui/confirm-dialog', () => ({
  useConfirm: () => ({ confirm: jest.fn().mockResolvedValue(false), info: jest.fn() }),
}));

jest.mock('@/components/dashboard', () => ({
  TokenUsageCard: () => null,
}));

jest.mock('@/components/ui/card', () => {
  const { View } = require('react-native');
  return { Card: ({ children }: { children: React.ReactNode }) => <View>{children}</View> };
});

jest.mock('@/components/ui/screen', () => {
  const { View } = require('react-native');
  return { Screen: View };
});

jest.mock('@/lib/styles', () => ({
  bgColors: { primary: { 10: '#EFF6FF' }, destructive: { 5: '#FEF2F2' } },
  borderColors: { destructive: { 20: '#FECACA' } },
  shadows: { sm: {} },
}));

jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return {
    SafeAreaView: View,
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  };
});

jest.mock('nativewind', () => ({
  cssInterop: jest.fn(),
  remapProps: jest.fn(),
}));

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('StudentProfileScreen — usePronoteStatus gate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseUser.mockReturnValue({ id: 'student-1', name: 'Alice Dupont' });
    mockUseStudentDashboard.mockReturnValue({ usage: null, isLoadingUsage: false });
    mockUsePronote.mockReturnValue({
      homework: [],
      grades: [],
      timetable: [],
      errors: {},
      upcomingHomework: 2,
      averageGrade: 14.5,
    });
  });

  it('passes self-id to usePronoteStatus', () => {
    mockUsePronoteStatus.mockReturnValue({ data: undefined, isLoading: true });

    const StudentProfileScreen = require('../../src/app/(student)/(profile)/index').default;
    render(<StudentProfileScreen />);

    expect(mockUsePronoteStatus).toHaveBeenCalledWith('student-1');
  });

  it('shows Pronote menu section when status.hasPronote === true', async () => {
    mockUsePronoteStatus.mockReturnValue({
      data: { hasPronote: true, className: '4eB', establishmentName: 'Lycée X' },
      isLoading: false,
    });

    const StudentProfileScreen = require('../../src/app/(student)/(profile)/index').default;
    const { getByText } = render(<StudentProfileScreen />);

    await waitFor(() => {
      expect(getByText('Devoirs')).toBeTruthy();
      expect(getByText('Notes')).toBeTruthy();
      expect(getByText('Emploi du temps')).toBeTruthy();
    });
  });

  it('hides Pronote menu section when status.hasPronote === false', async () => {
    mockUsePronoteStatus.mockReturnValue({
      data: { hasPronote: false, className: null, establishmentName: null },
      isLoading: false,
    });

    const StudentProfileScreen = require('../../src/app/(student)/(profile)/index').default;
    const { queryByText } = render(<StudentProfileScreen />);

    await waitFor(() => {
      expect(queryByText('Devoirs')).toBeNull();
      expect(queryByText('Notes')).toBeNull();
    });
  });

  it('shows className from status.className in profile header', async () => {
    mockUsePronoteStatus.mockReturnValue({
      data: { hasPronote: true, className: '5eC', establishmentName: 'Collège Z' },
      isLoading: false,
    });

    const StudentProfileScreen = require('../../src/app/(student)/(profile)/index').default;
    const { getByText } = render(<StudentProfileScreen />);

    await waitFor(() => {
      expect(getByText('5eC')).toBeTruthy();
    });
  });
});
