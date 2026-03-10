import { create } from 'zustand';
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware';
import { createMMKV } from 'react-native-mmkv';
import type {
  PronoteMetadata,
  PronoteResource,
  PronoteHomework,
  PronoteGrade,
  PronoteTimetableEntry,
} from '@/services/pronote/pronote-types';

const mmkv = createMMKV({ id: 'pronote-store' });

const mmkvStorage: StateStorage = {
  getItem: (name: string) => mmkv.getString(name) ?? null,
  setItem: (name: string, value: string) => mmkv.set(name, value),
  removeItem: (name: string) => { mmkv.remove(name); },
};

interface PronoteState {
  isConnected: boolean;
  metadata: PronoteMetadata | null;
  resources: PronoteResource[];
  resourceMappings: Record<string, number>;
  homework: PronoteHomework[];
  grades: PronoteGrade[];
  timetable: PronoteTimetableEntry[];
  lastHomeworkFetch: string | null;
  lastGradesFetch: string | null;
  lastTimetableFetch: string | null;

  setConnected: (metadata: PronoteMetadata) => void;
  setResources: (resources: PronoteResource[]) => void;
  setResourceMapping: (childId: string, resourceIndex: number) => void;
  setHomework: (homework: PronoteHomework[]) => void;
  setGrades: (grades: PronoteGrade[]) => void;
  setTimetable: (timetable: PronoteTimetableEntry[]) => void;
  reset: () => void;
}

const initialState = {
  isConnected: false,
  metadata: null,
  resources: [],
  resourceMappings: {},
  homework: [],
  grades: [],
  timetable: [],
  lastHomeworkFetch: null,
  lastGradesFetch: null,
  lastTimetableFetch: null,
};

export const usePronoteStore = create<PronoteState>()(
  persist(
    (set) => ({
      ...initialState,

      setConnected: (metadata) =>
        set({ isConnected: true, metadata }),

      setResources: (resources) =>
        set({ resources }),

      setResourceMapping: (childId, resourceIndex) =>
        set((state) => ({
          resourceMappings: { ...state.resourceMappings, [childId]: resourceIndex },
        })),

      setHomework: (homework) =>
        set({ homework, lastHomeworkFetch: new Date().toISOString() }),

      setGrades: (grades) =>
        set({ grades, lastGradesFetch: new Date().toISOString() }),

      setTimetable: (timetable) =>
        set({ timetable, lastTimetableFetch: new Date().toISOString() }),

      reset: () => set(initialState),
    }),
    {
      name: 'pronote-state',
      storage: createJSONStorage(() => mmkvStorage),
    },
  ),
);
