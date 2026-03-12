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
    isConnected: boolean;
    metadata: { instanceUrl: string; username: string; deviceUuid: string; accountKind: number } | null;
    resources: { name: string; id: string; className?: string }[];
    resourceMappings: Record<string, number>;
    homework: { id: string; subject: string }[];
    grades: { id: string; subject: string }[];
    timetable: { id: string; subject?: string }[];
    lastHomeworkFetch: string | null;
    lastGradesFetch: string | null;
    lastTimetableFetch: string | null;
    setConnected: (metadata: Record<string, unknown>) => void;
    setResources: (resources: { name: string; id: string }[]) => void;
    setResourceMapping: (childId: string, resourceIndex: number) => void;
    setHomework: (homework: { id: string; subject: string }[]) => void;
    setGrades: (grades: { id: string; subject: string }[]) => void;
    setTimetable: (timetable: { id: string }[]) => void;
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

  it('should start disconnected', () => {
    const state = store.getState();
    expect(state.isConnected).toBe(false);
    expect(state.metadata).toBeNull();
    expect(state.resources).toEqual([]);
  });

  it('should set connected with metadata', () => {
    act(() => {
      store.getState().setConnected({
        instanceUrl: 'https://demo.pronote.fr',
        username: 'jean',
        deviceUuid: 'dev-1',
        accountKind: 6,
      });
    });

    const state = store.getState();
    expect(state.isConnected).toBe(true);
    expect(state.metadata?.instanceUrl).toBe('https://demo.pronote.fr');
  });

  it('should set resources', () => {
    act(() => {
      store.getState().setResources([
        { name: 'Jean', id: '1' },
        { name: 'Marie', id: '2' },
      ]);
    });

    expect(store.getState().resources).toHaveLength(2);
  });

  it('should set resource mapping', () => {
    act(() => {
      store.getState().setResourceMapping('child-1', 0);
      store.getState().setResourceMapping('child-2', 1);
    });

    const mappings = store.getState().resourceMappings;
    expect(mappings['child-1']).toBe(0);
    expect(mappings['child-2']).toBe(1);
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
      store.getState().setConnected({
        instanceUrl: 'https://demo.pronote.fr',
        username: 'jean',
        deviceUuid: 'dev-1',
        accountKind: 6,
      });
      store.getState().setHomework([{ id: 'hw-1', subject: 'Maths' }]);
    });

    expect(store.getState().isConnected).toBe(true);

    act(() => {
      store.getState().reset();
    });

    const state = store.getState();
    expect(state.isConnected).toBe(false);
    expect(state.metadata).toBeNull();
    expect(state.homework).toEqual([]);
    expect(state.lastHomeworkFetch).toBeNull();
  });
});
