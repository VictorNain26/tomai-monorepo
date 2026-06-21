/**
 * usePronote — API-backed hook tests.
 *
 * Verifies:
 * 1. Per-domain error surfacing (cross-contamination guard).
 * 2. fetchGrades(childId) targets the correct route.
 * 3. connect() delegates to POST /api/pronote/connect/qr and updates store.
 */

import { renderHook, act, waitFor } from '@testing-library/react-native';
import { getTreaty } from '@repo/api';

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

import { usePronote } from '../../src/hooks/usePronote';
import { usePronoteStore } from '../../src/stores/pronote-store';

const mockGetTreaty = getTreaty as jest.MockedFunction<typeof getTreaty>;

// ---------------------------------------------------------------------------
// Helpers to build minimal treaty mocks
// ---------------------------------------------------------------------------

type GradeRaw = {
  subject: string;
  value: number | null;
  scale: number;
  date: string;
  comment: string | null;
  coefficient: number;
  classAverage: number | null;
  max: number | null;
  min: number | null;
};
type HomeworkRaw = {
  subject: string;
  description: string;
  dueDate: string;
  done: boolean;
};
type LessonRaw = {
  subject: string;
  start: string;
  end: string;
  room: string | null;
  canceled: boolean;
};

function makeChildrenApi(opts: {
  childId: string;
  gradesResult?: { data: { success: boolean; data: GradeRaw[] }; error: null } | { data: null; error: { status: number; value: { message: string } } };
  homeworkResult?: { data: { success: boolean; data: HomeworkRaw[] }; error: null } | { data: null; error: { status: number; value: { message: string } } };
  timetableResult?: { data: { success: boolean; data: LessonRaw[] }; error: null } | { data: null; error: { status: number; value: { message: string } } };
}) {
  const childrenFn = jest.fn((params: { childId: string }) => {
    if (params.childId !== opts.childId) {
      return { grades: { get: jest.fn().mockResolvedValue({ data: null, error: { status: 403, value: { message: 'Forbidden' } } }) } };
    }
    return {
      grades: { get: jest.fn().mockResolvedValue(opts.gradesResult ?? { data: { success: true, data: [] }, error: null }) },
      homework: { get: jest.fn().mockResolvedValue(opts.homeworkResult ?? { data: { success: true, data: [] }, error: null }) },
      timetable: { get: jest.fn().mockResolvedValue(opts.timetableResult ?? { data: { success: true, data: [] }, error: null }) },
    };
  });
  return childrenFn;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('usePronote error surfacing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    act(() => {
      usePronoteStore.setState({
        isConnected: true,
        metadata: null,
        lastGradesFetch: null,
        lastHomeworkFetch: null,
        lastTimetableFetch: null,
        errors: { homework: null, grades: null, timetable: null },
      });
    });
  });

  it('sets grades error when grades endpoint returns an error', async () => {
    const childrenFn = makeChildrenApi({
      childId: 'user-1',
      gradesResult: { data: null, error: { status: 500, value: { message: 'Pronote 500' } } },
    });
    mockGetTreaty.mockReturnValue({
      api: { pronote: { children: childrenFn } },
    } as unknown as ReturnType<typeof getTreaty>);

    const { result } = renderHook(() => usePronote('user-1'));

    await act(async () => {
      await result.current.fetchGrades();
    });

    await waitFor(() => {
      expect(result.current.errors.grades).not.toBeNull();
    });
  });

  it('clears grades error when a subsequent grades fetch succeeds', async () => {
    // First call: error
    const errorResult = { data: null, error: { status: 500, value: { message: 'Pronote 500' } } } as const;
    const successResult = { data: { success: true, data: [] }, error: null } as const;

    const gradesMock = jest.fn()
      .mockResolvedValueOnce(errorResult)
      .mockResolvedValueOnce(successResult);

    const childrenFn = jest.fn(() => ({ grades: { get: gradesMock } }));

    mockGetTreaty.mockReturnValue({
      api: { pronote: { children: childrenFn } },
    } as unknown as ReturnType<typeof getTreaty>);

    const { result } = renderHook(() => usePronote('user-1'));

    await act(async () => { await result.current.fetchGrades(); });
    await waitFor(() => expect(result.current.errors.grades).not.toBeNull());

    // Reset TTL guard
    act(() => { usePronoteStore.setState({ lastGradesFetch: null }); });

    await act(async () => { await result.current.fetchGrades(); });
    await waitFor(() => { expect(result.current.errors.grades).toBeNull(); });
  });

  it('does not wipe homework error when grades fetch succeeds concurrently', async () => {
    const homeworkGet = jest.fn().mockResolvedValue({
      data: null,
      error: { status: 500, value: { message: 'Homework 500' } },
    });
    const gradesGet = jest.fn().mockResolvedValue({
      data: { success: true, data: [] },
      error: null,
    });

    const childrenFn = jest.fn(() => ({
      grades: { get: gradesGet },
      homework: { get: homeworkGet },
    }));

    mockGetTreaty.mockReturnValue({
      api: { pronote: { children: childrenFn } },
    } as unknown as ReturnType<typeof getTreaty>);

    const { result } = renderHook(() => usePronote('user-1'));

    await act(async () => {
      await Promise.all([
        result.current.fetchHomework(),
        result.current.fetchGrades(),
      ]);
    });

    await waitFor(() => {
      expect(result.current.errors.homework).not.toBeNull();
      expect(result.current.errors.grades).toBeNull();
    });
  });
});

describe('usePronote fetchGrades childId routing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    act(() => {
      usePronoteStore.setState({
        isConnected: true,
        metadata: null,
        lastGradesFetch: null,
        lastHomeworkFetch: null,
        lastTimetableFetch: null,
        errors: { homework: null, grades: null, timetable: null },
      });
    });
  });

  it('calls children({childId}) with userId when no childId provided', async () => {
    const childrenFn = jest.fn(() => ({
      grades: { get: jest.fn().mockResolvedValue({ data: { success: true, data: [] }, error: null }) },
    }));
    mockGetTreaty.mockReturnValue({
      api: { pronote: { children: childrenFn } },
    } as unknown as ReturnType<typeof getTreaty>);

    const { result } = renderHook(() => usePronote('self-user'));
    await act(async () => { await result.current.fetchGrades(); });

    expect(childrenFn).toHaveBeenCalledWith({ childId: 'self-user' });
  });

  it('calls children({childId}) with explicit childId when provided', async () => {
    const childrenFn = jest.fn(() => ({
      grades: { get: jest.fn().mockResolvedValue({ data: { success: true, data: [] }, error: null }) },
    }));
    mockGetTreaty.mockReturnValue({
      api: { pronote: { children: childrenFn } },
    } as unknown as ReturnType<typeof getTreaty>);

    const { result } = renderHook(() => usePronote('parent-id'));
    await act(async () => { await result.current.fetchGrades('child-abc'); });

    expect(childrenFn).toHaveBeenCalledWith({ childId: 'child-abc' });
  });
});

describe('usePronote connect', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    act(() => {
      usePronoteStore.setState({
        isConnected: false,
        resources: [],
        errors: { homework: null, grades: null, timetable: null },
      });
    });
  });

  it('calls POST /api/pronote/connect/qr and updates store on success', async () => {
    const connectPost = jest.fn().mockResolvedValue({
      data: {
        success: true,
        data: {
          credentialId: 'cred-1',
          resources: [{ resourceId: 1, name: 'Alice', className: '5A', establishmentName: 'Collège X' }],
        },
      },
      error: null,
    });

    mockGetTreaty.mockReturnValue({
      api: { pronote: { connect: { qr: { post: connectPost } } } },
    } as unknown as ReturnType<typeof getTreaty>);

    const { result } = renderHook(() => usePronote('user-1'));
    const qrData = { jeton: 'tok', login: 'usr', url: 'https://school.fr/pronote/' };

    let connectResult: { success: boolean } | undefined;
    await act(async () => {
      connectResult = await result.current.connect(qrData, '1234');
    });

    expect(connectPost).toHaveBeenCalledWith({
      qr: { jeton: 'tok', login: 'usr', url: 'https://school.fr/pronote/' },
      pin: '1234',
    });
    expect(connectResult?.success).toBe(true);

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });
  });

  it('returns success:false and does not update store when API errors', async () => {
    const connectPost = jest.fn().mockResolvedValue({
      data: null,
      error: { status: 409, value: { message: 'QR expiré', code: 'pronote_reauth_required' } },
    });

    mockGetTreaty.mockReturnValue({
      api: { pronote: { connect: { qr: { post: connectPost } } } },
    } as unknown as ReturnType<typeof getTreaty>);

    const { result } = renderHook(() => usePronote('user-1'));
    const qrData = { jeton: 'tok', login: 'usr', url: 'https://school.fr/pronote/' };

    let connectResult: { success: boolean } | undefined;
    await act(async () => {
      connectResult = await result.current.connect(qrData, '1234');
    });

    expect(connectResult?.success).toBe(false);
    expect(result.current.isConnected).toBe(false);
  });
});
