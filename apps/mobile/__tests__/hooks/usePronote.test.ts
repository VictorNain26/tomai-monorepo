/**
 * usePronote — surface des erreurs de fetch Pronote.
 */
import { renderHook, act, waitFor } from '@testing-library/react-native';

jest.mock('react-native-mmkv', () => {
  const store = new Map<string, string>();
  return {
    createMMKV: () => ({
      set: (key: string, val: string) => store.set(key, val),
      getString: (key: string) => store.get(key),
      remove: (key: string) => store.delete(key),
      contains: (key: string) => store.has(key),
      clearAll: () => store.clear(),
    }),
  };
});

jest.mock('pawnote', () => ({
  AccountKind: { PARENT: 0, STUDENT: 1 },
  GradeKind: { Grade: 'Grade' },
  assignmentsFromIntervals: jest.fn(),
  gradesOverview: jest.fn(),
  timetableFromIntervals: jest.fn(),
  TabLocation: { Grades: 'Grades' },
}));

jest.mock('../../src/services/pronote/pronote-session', () => ({
  pronoteSessionService: {
    refreshSession: jest.fn(),
    connectWithQrCode: jest.fn(),
    disconnect: jest.fn(),
  },
}));

import * as pawnote from 'pawnote';
import { pronoteSessionService } from '../../src/services/pronote/pronote-session';
import { usePronote } from '../../src/hooks/usePronote';
import { usePronoteStore } from '../../src/stores/pronote-store';

const mockRefresh = pronoteSessionService.refreshSession as jest.Mock;
const mockGradesOverview = jest.mocked(pawnote.gradesOverview);

/** Minimal SessionHandle mock: userResource.tabs.get('Grades') returns a period. */
const mockPeriod = { id: 'p1', name: 'Trimestre 1' };
const mockHandle = {
  userResource: {
    tabs: new Map([
      ['Grades', { defaultPeriod: mockPeriod, periods: [mockPeriod] }],
    ]),
  },
};

describe('usePronote error surfacing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    act(() => {
      usePronoteStore.setState({
        isConnected: true,
        metadata: { instanceUrl: 'https://x.fr', username: 'u', deviceUuid: 'd', accountKind: 0 } as never,
        lastGradesFetch: null,
        lastError: null,
      });
    });
  });

  it('sets error when the gradesOverview data fetch throws (session ok, data fails)', async () => {
    // Session refreshes successfully — real failure mode: data call fails.
    mockRefresh.mockResolvedValueOnce(mockHandle);
    mockGradesOverview.mockRejectedValueOnce(new Error('Pronote 500'));

    const { result } = renderHook(() => usePronote('user-1'));

    await act(async () => {
      await result.current.fetchGrades();
    });

    await waitFor(() => {
      expect(result.current.error).not.toBeNull();
    });
  });

  it('clears error when a subsequent grades fetch succeeds after a previous failure', async () => {
    // First call: session ok, data throws.
    mockRefresh.mockResolvedValueOnce(mockHandle);
    mockGradesOverview.mockRejectedValueOnce(new Error('Pronote 500'));

    const { result } = renderHook(() => usePronote('user-1'));

    await act(async () => {
      await result.current.fetchGrades();
    });
    await waitFor(() => expect(result.current.error).not.toBeNull());

    // Reset TTL guard so the second call isn't short-circuited.
    act(() => {
      usePronoteStore.setState({ lastGradesFetch: null });
    });

    // Second call: session ok, data succeeds — storeSetError(null) must fire.
    mockRefresh.mockResolvedValueOnce(mockHandle);
    mockGradesOverview.mockResolvedValueOnce({ grades: [], subjectsAverages: [] });

    await act(async () => {
      await result.current.fetchGrades();
    });

    await waitFor(() => {
      expect(result.current.error).toBeNull();
    });
  });
});
