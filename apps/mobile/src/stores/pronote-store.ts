import { create } from 'zustand';
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware';
import { createMMKV } from 'react-native-mmkv';
import type {
  PronoteHomework,
  PronoteGrade,
  PronoteTimetableEntry,
} from '@/services/pronote/pronote-types';

let mmkvInstance: ReturnType<typeof createMMKV> | null = null;

function getMMKV() {
  if (!mmkvInstance) {
    mmkvInstance = createMMKV({ id: 'pronote-store' });
  }
  return mmkvInstance;
}

const mmkvStorage: StateStorage = {
  getItem: (name: string) => getMMKV().getString(name) ?? null,
  setItem: (name: string, value: string) => getMMKV().set(name, value),
  removeItem: (name: string) => { getMMKV().remove(name); },
};

type PronoteFetchKey = 'homework' | 'grades' | 'timetable';

interface PronoteState {
  homework: PronoteHomework[];
  grades: PronoteGrade[];
  timetable: PronoteTimetableEntry[];
  lastHomeworkFetch: string | null;
  lastGradesFetch: string | null;
  lastTimetableFetch: string | null;
  errors: { homework: string | null; grades: string | null; timetable: string | null };

  setHomework: (homework: PronoteHomework[]) => void;
  setGrades: (grades: PronoteGrade[]) => void;
  setTimetable: (timetable: PronoteTimetableEntry[]) => void;
  setError: (key: PronoteFetchKey, message: string | null) => void;
  reset: () => void;
}

const initialState = {
  homework: [],
  grades: [],
  timetable: [],
  lastHomeworkFetch: null,
  lastGradesFetch: null,
  lastTimetableFetch: null,
  errors: { homework: null, grades: null, timetable: null },
};

export const usePronoteStore = create<PronoteState>()(
  persist(
    (set) => ({
      ...initialState,

      setHomework: (homework) =>
        set({ homework, lastHomeworkFetch: new Date().toISOString() }),

      setGrades: (grades) =>
        set({ grades, lastGradesFetch: new Date().toISOString() }),

      setTimetable: (timetable) =>
        set({ timetable, lastTimetableFetch: new Date().toISOString() }),

      setError: (key, message) =>
        set((s) => ({ errors: { ...s.errors, [key]: message } })),

      reset: () => set(initialState),
    }),
    {
      name: 'pronote-state',
      storage: createJSONStorage(() => mmkvStorage),
    },
  ),
);
