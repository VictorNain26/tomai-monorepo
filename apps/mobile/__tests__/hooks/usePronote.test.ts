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

import { pronoteSessionService } from '../../src/services/pronote/pronote-session';
import { usePronote } from '../../src/hooks/usePronote';
import { usePronoteStore } from '../../src/stores/pronote-store';

const mockRefresh = pronoteSessionService.refreshSession as jest.Mock;

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

  it('sets error when a grades fetch throws', async () => {
    mockRefresh.mockRejectedValueOnce(new Error('network'));
    const { result } = renderHook(() => usePronote('user-1'));

    await act(async () => {
      await result.current.fetchGrades();
    });

    await waitFor(() => {
      expect(result.current.error).not.toBeNull();
    });
  });
});
