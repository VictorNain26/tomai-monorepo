import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { act } from '@testing-library/react-native';

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

const { usePronoteStore } = require('@/stores/pronote-store');

type StoreType = {
  getState: () => {
    homework: { id: string; subject: string }[];
    grades: { id: string; subject: string }[];
    timetable: { id: string; subject?: string }[];
    lastHomeworkFetch: string | null;
    lastGradesFetch: string | null;
    lastTimetableFetch: string | null;
    errors: { homework: string | null; grades: string | null; timetable: string | null };
    setHomework: (homework: { id: string; subject: string }[]) => void;
    setGrades: (grades: { id: string; subject: string }[]) => void;
    setTimetable: (timetable: { id: string }[]) => void;
    setError: (key: 'homework' | 'grades' | 'timetable', message: string | null) => void;
    reset: () => void;
  };
};

const store = usePronoteStore as unknown as StoreType;

describe('usePronoteStore', () => {
  beforeEach(() => {
    act(() => {
      store.getState().reset();
    });
  });

  it('should cache homework with timestamp', () => {
    act(() => {
      store.getState().setHomework([
        { id: 'hw-1', subject: 'Maths' },
      ]);
    });

    const state = store.getState();
    expect(state.homework).toHaveLength(1);
    expect(state.lastHomeworkFetch).not.toBeNull();
  });

  it('should cache grades with timestamp', () => {
    act(() => {
      store.getState().setGrades([
        { id: 'g-1', subject: 'Français' },
      ]);
    });

    const state = store.getState();
    expect(state.grades).toHaveLength(1);
    expect(state.lastGradesFetch).not.toBeNull();
  });

  it('should cache timetable with timestamp', () => {
    act(() => {
      store.getState().setTimetable([
        { id: 'tt-1' },
      ]);
    });

    const state = store.getState();
    expect(state.timetable).toHaveLength(1);
    expect(state.lastTimetableFetch).not.toBeNull();
  });

  it('should reset all state', () => {
    act(() => {
      store.getState().setHomework([{ id: 'hw-1', subject: 'Maths' }]);
    });

    expect(store.getState().homework).toHaveLength(1);

    act(() => {
      store.getState().reset();
    });

    const state = store.getState();
    expect(state.homework).toEqual([]);
    expect(state.lastHomeworkFetch).toBeNull();
  });

  it('should set per-domain errors without cross-contamination', () => {
    act(() => {
      store.getState().setError('grades', 'Erreur notes');
    });

    const state = store.getState();
    expect(state.errors.grades).toBe('Erreur notes');
    expect(state.errors.homework).toBeNull();
    expect(state.errors.timetable).toBeNull();
  });
});
