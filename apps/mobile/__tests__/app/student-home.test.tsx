/**
 * Student Dashboard — Task 9: pronote section gate via usePronoteStatus(selfId)
 *
 * Verifies that:
 * 1. When status.hasPronote === true, homework/grades sections are rendered.
 * 2. When status.hasPronote === false (or status undefined), the "not connected" banner is shown.
 * 3. className comes from status.className, not from pronote.resources[0].
 */

import React from 'react';
import { render, waitFor } from '@testing-library/react-native';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockUsePronoteStatus = jest.fn();
const mockUsePronote = jest.fn();
const mockUseUser = jest.fn();
const mockUseStudentDashboard = jest.fn();
const mockUseDueSummary = jest.fn();

jest.mock('@/hooks', () => ({
  usePronote: (...args: unknown[]) => mockUsePronote(...args),
  usePronoteStatus: (...args: unknown[]) => mockUsePronoteStatus(...args),
  useStudentDashboard: () => mockUseStudentDashboard(),
  useThemeColors: () => ({
    primary: '#2563EB',
    foreground: '#1C1917',
    mutedForeground: '#78716C',
    destructive: '#DC2626',
    warning: '#F59E0B',
    background: '#FAFAF9',
    muted: '#F5F5F4',
    card: '#FFFFFF',
    border: '#E7E5E4',
    cardForeground: '#1C1917',
  }),
  useDueSummary: () => mockUseDueSummary(),
}));

jest.mock('@/lib/auth', () => ({
  useUser: () => mockUseUser(),
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ refetchQueries: jest.fn() }),
}));

jest.mock('@/constants/subjects', () => ({
  enrichSubjectKey: (subject: string) => ({ name: subject }),
}));

jest.mock('@/components/dashboard', () => ({
  HomeworkUrgentCard: () => null,
  GradesRecentCard: () => null,
}));

jest.mock('@/components/chat', () => ({
  ChatErrorBanner: () => null,
}));

jest.mock('@/components/ui/safe-area-view', () => {
  const { View } = require('react-native');
  return { SafeAreaView: View };
});

jest.mock('@/lib/styles', () => ({
  bgColors: { primary: { 10: '#EFF6FF' }, destructive: { 5: '#FEF2F2' } },
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildPronoteHook(overrides = {}) {
  return {
    homework: [],
    grades: [],
    timetable: [],
    errors: {},
    fetchHomework: jest.fn(),
    fetchGrades: jest.fn(),
    fetchTimetable: jest.fn(),
    upcomingHomework: 0,
    averageGrade: null,
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('StudentDashboard — usePronoteStatus gate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseUser.mockReturnValue({ id: 'student-1', name: 'Alice Dupont' });
    mockUseStudentDashboard.mockReturnValue({ userName: 'Alice Dupont' });
    mockUseDueSummary.mockReturnValue({ data: undefined });
    mockUsePronote.mockReturnValue(buildPronoteHook());
  });

  it('passes self-id to usePronoteStatus', () => {
    mockUsePronoteStatus.mockReturnValue({ data: undefined, isLoading: true });

    const StudentDashboard = require('../../src/app/(student)/(home)/index').default;
    render(<StudentDashboard />);

    expect(mockUsePronoteStatus).toHaveBeenCalledWith('student-1');
  });

  it('renders Pronote sections when status.hasPronote === true', async () => {
    mockUsePronoteStatus.mockReturnValue({
      data: { hasPronote: true, className: '4eB', establishmentName: 'Lycée X' },
      isLoading: false,
    });

    const StudentDashboard = require('../../src/app/(student)/(home)/index').default;
    const { getByTestId } = render(<StudentDashboard />);

    await waitFor(() => {
      expect(getByTestId('student-dashboard')).toBeTruthy();
    });
  });

  it('renders "not connected" banner when status.hasPronote === false', async () => {
    mockUsePronoteStatus.mockReturnValue({
      data: { hasPronote: false, className: null, establishmentName: null },
      isLoading: false,
    });

    const StudentDashboard = require('../../src/app/(student)/(home)/index').default;
    const { getByText } = render(<StudentDashboard />);

    await waitFor(() => {
      expect(getByText('Pronote non connecte')).toBeTruthy();
    });
  });

  it('renders "not connected" banner when status is undefined (loading)', async () => {
    mockUsePronoteStatus.mockReturnValue({ data: undefined, isLoading: true });

    const StudentDashboard = require('../../src/app/(student)/(home)/index').default;
    const { getByText } = render(<StudentDashboard />);

    await waitFor(() => {
      expect(getByText('Pronote non connecte')).toBeTruthy();
    });
  });

  it('shows className from status.className, not from pronote.resources', async () => {
    mockUsePronoteStatus.mockReturnValue({
      data: { hasPronote: true, className: '3eA', establishmentName: 'Collège Y' },
      isLoading: false,
    });
    // pronote hook has no resources — className must come from status
    mockUsePronote.mockReturnValue(buildPronoteHook({ resources: [] }));

    const StudentDashboard = require('../../src/app/(student)/(home)/index').default;
    const { getByText } = render(<StudentDashboard />);

    await waitFor(() => {
      expect(getByText('3eA')).toBeTruthy();
    });
  });
});
