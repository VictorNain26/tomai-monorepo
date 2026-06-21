/**
 * Student Timetable Screen — Task 9: pronote gate via usePronoteStatus(selfId)
 *
 * Verifies that:
 * 1. usePronoteStatus is called with the student's own id.
 * 2. The "not connected" placeholder is shown when status.hasPronote is false/undefined.
 * 3. The "not connected" placeholder is NOT shown when status.hasPronote is true.
 */

import React from 'react';
import { render, waitFor } from '@testing-library/react-native';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockUsePronoteStatus = jest.fn();
const mockUsePronote = jest.fn();
const mockUseUser = jest.fn();

jest.mock('@/hooks', () => ({
  usePronote: (...args: unknown[]) => mockUsePronote(...args),
  usePronoteStatus: (...args: unknown[]) => mockUsePronoteStatus(...args),
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
}));

jest.mock('@/lib/auth', () => ({
  useUser: () => mockUseUser(),
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn() }),
}));

jest.mock('@/components/chat', () => ({
  ChatErrorBanner: () => null,
}));

jest.mock('@/components/ui/safe-area-view', () => {
  const { View } = require('react-native');
  return { SafeAreaView: View };
});

jest.mock('@/components/ui/skeleton', () => {
  const { View } = require('react-native');
  return { Skeleton: (props: { className?: string }) => <View {...props} /> };
});

jest.mock('@/lib/styles', () => ({
  bgColors: {
    destructive: { 5: '#FEF2F2' },
    warning: { 5: '#FFFBEB' },
  },
  borderColors: {
    destructive: { 20: '#FECACA' },
    warning: { 20: '#FDE68A' },
  },
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

// lucide-react-native icons are not available in the test environment
jest.mock('lucide-react-native', () => {
  const { View } = require('react-native');
  return new Proxy(
    {},
    { get: () => () => <View /> }
  );
});

// react-native-reanimated uses native modules; stub Animated.View
jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  return {
    default: { View },
    useAnimatedStyle: () => ({}),
    useSharedValue: (initial: unknown) => ({ value: initial, set: jest.fn() }),
    withRepeat: (v: unknown) => v,
    withTiming: (v: unknown) => v,
    withSequence: (v: unknown) => v,
  };
});

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

describe('TimetableScreen — usePronoteStatus gate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseUser.mockReturnValue({ id: 'student-1', name: 'Alice Dupont' });
    mockUsePronote.mockReturnValue(buildPronoteHook());
  });

  it('passes self-id to usePronoteStatus', () => {
    mockUsePronoteStatus.mockReturnValue({ data: undefined, isLoading: true });

    const TimetableScreen =
      require('../../src/app/(student)/(profile)/pronote/timetable').default;
    render(<TimetableScreen />);

    expect(mockUsePronoteStatus).toHaveBeenCalledWith('student-1');
  });

  it('shows not-connected placeholder when status.hasPronote === false', async () => {
    mockUsePronoteStatus.mockReturnValue({
      data: { hasPronote: false, className: null, establishmentName: null },
      isLoading: false,
    });

    const TimetableScreen =
      require('../../src/app/(student)/(profile)/pronote/timetable').default;
    const { getByTestId } = render(<TimetableScreen />);

    await waitFor(() => {
      expect(getByTestId('pronote-not-connected-placeholder')).toBeTruthy();
    });
  });

  it('shows not-connected placeholder when status is undefined (not loaded)', async () => {
    mockUsePronoteStatus.mockReturnValue({ data: undefined, isLoading: true });

    const TimetableScreen =
      require('../../src/app/(student)/(profile)/pronote/timetable').default;
    const { getByTestId } = render(<TimetableScreen />);

    await waitFor(() => {
      expect(getByTestId('pronote-not-connected-placeholder')).toBeTruthy();
    });
  });

  it('does NOT show not-connected placeholder when status.hasPronote === true', async () => {
    mockUsePronoteStatus.mockReturnValue({
      data: { hasPronote: true, className: '4eB', establishmentName: 'Lycée X' },
      isLoading: false,
    });
    // timetable is empty but Pronote is linked → no placeholder, shows empty state
    mockUsePronote.mockReturnValue(buildPronoteHook({ timetable: [] }));

    const TimetableScreen =
      require('../../src/app/(student)/(profile)/pronote/timetable').default;
    const { queryByTestId } = render(<TimetableScreen />);

    await waitFor(() => {
      expect(queryByTestId('pronote-not-connected-placeholder')).toBeNull();
    });
  });
});
