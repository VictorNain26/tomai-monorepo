/**
 * usePronote - Unified device-first Pronote hook
 *
 * Replaces useParentPronote and useStudentPronote.
 * All data lives on-device (Zustand/MMKV); server only stores credentials backup.
 *
 * Data flow:
 * 1. QR scan → pawnote login → token stored in SecureStore
 * 2. Refresh: token → pawnote session → fetch homework/grades/timetable → store
 * 3. Credentials synced to server as encrypted backup
 */

import { useCallback, useMemo } from 'react';
import { usePronoteStore } from '@/stores/pronote-store';
import { pronoteSessionService } from '@/services/pronote/pronote-session';
import { pronoteCredentialsSync } from '@/services/pronote/pronote-credentials';
import type {
  QrCodeData,
  PronoteHomework,
  PronoteGrade,
  PronoteTimetableEntry,
  PronoteChatContext,
} from '@/services/pronote/pronote-types';

// Cache TTLs in milliseconds
const HOMEWORK_TTL = 15 * 60 * 1000; // 15 minutes
const GRADES_TTL = 60 * 60 * 1000; // 1 hour
const TIMETABLE_TTL = 30 * 60 * 1000; // 30 minutes

function isCacheStale(lastFetch: string | null, ttl: number): boolean {
  if (!lastFetch) return true;
  return Date.now() - new Date(lastFetch).getTime() > ttl;
}

export function usePronote(userId: string) {
  const store = usePronoteStore();

  const connect = useCallback(
    async (qrData: QrCodeData, pin: string) => {
      const deviceUuid = `tomai-${userId}-${Date.now()}`;
      const result = await pronoteSessionService.connectWithQrCode(
        userId,
        qrData,
        pin,
        deviceUuid,
      );

      if (result.success && result.resources) {
        store.setConnected({
          instanceUrl: qrData.url,
          username: qrData.login,
          deviceUuid,
          accountKind: 3, // parent account type in pawnote
        });
        store.setResources(result.resources);

        // Sync credentials to server (best-effort)
        void pronoteCredentialsSync.pushToServer({
          token: '', // Token is in SecureStore, not exposed here
          metadata: {
            instanceUrl: qrData.url,
            username: qrData.login,
            deviceUuid,
            accountKind: 3,
          },
          tokenExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        });
      }

      return result;
    },
    [userId, store],
  );

  const disconnect = useCallback(async () => {
    await pronoteSessionService.disconnect(userId);
    store.reset();
    void pronoteCredentialsSync.removeFromServer();
  }, [userId, store]);

  const fetchHomework = useCallback(
    async (_weekOffset?: number) => {
      if (!store.metadata) return;
      if (!isCacheStale(store.lastHomeworkFetch, HOMEWORK_TTL)) return;

      const handle = await pronoteSessionService.refreshSession(userId, store.metadata);
      if (!handle) return;

      try {
        const { assignmentsFromIntervals, use } = await import('pawnote');
        const now = new Date();
        const from = new Date(now);
        from.setDate(from.getDate() - 7);
        const to = new Date(now);
        to.setDate(to.getDate() + 14);

        const assignments = await use(handle, assignmentsFromIntervals, { from, to });
        const homework: PronoteHomework[] = assignments.map((a) => ({
          id: String(a.id ?? `hw-${a.subject}-${a.dueDate.getTime()}`),
          subject: a.subject,
          description: a.description,
          dueDate: a.dueDate.toISOString(),
          done: a.done,
          difficulty: a.difficulty ?? 0,
        }));

        store.setHomework(homework);
      } catch {
        // Session may have expired; data remains from cache
      }
    },
    [userId, store],
  );

  const fetchGrades = useCallback(async () => {
    if (!store.metadata) return;
    if (!isCacheStale(store.lastGradesFetch, GRADES_TTL)) return;

    const handle = await pronoteSessionService.refreshSession(userId, store.metadata);
    if (!handle) return;

    try {
      const { gradesOverview, use } = await import('pawnote');
      const overview = await use(handle, gradesOverview);

      const grades: PronoteGrade[] = overview.grades.map((g) => ({
        id: String(g.id ?? `gr-${g.subject}-${g.date.getTime()}`),
        subject: g.subject,
        value: g.value ?? null,
        outOf: g.outOf,
        coefficient: g.coefficient,
        date: g.date.toISOString(),
        description: g.comment ?? '',
        average: g.average,
        max: g.max,
        min: g.min,
      }));

      store.setGrades(grades);
    } catch {
      // Session may have expired; data remains from cache
    }
  }, [userId, store]);

  const fetchTimetable = useCallback(
    async (_weekOffset?: number) => {
      if (!store.metadata) return;
      if (!isCacheStale(store.lastTimetableFetch, TIMETABLE_TTL)) return;

      const handle = await pronoteSessionService.refreshSession(userId, store.metadata);
      if (!handle) return;

      try {
        const { timetableFromIntervals, use } = await import('pawnote');
        const now = new Date();
        const from = new Date(now);
        from.setHours(0, 0, 0, 0);
        const to = new Date(now);
        to.setDate(to.getDate() + 7);

        const entries = await use(handle, timetableFromIntervals, { from, to });
        const timetable: PronoteTimetableEntry[] = entries.map((e) => ({
          id: String(e.id ?? `tt-${e.startDate.getTime()}`),
          subject: e.subject,
          teacherNames: e.teacherNames ?? [],
          classrooms: e.classrooms ?? [],
          startDate: e.startDate.toISOString(),
          endDate: e.endDate.toISOString(),
          canceled: e.canceled ?? false,
          status: e.status,
        }));

        store.setTimetable(timetable);
      } catch {
        // Session may have expired; data remains from cache
      }
    },
    [userId, store],
  );

  const setResourceMapping = useCallback(
    (childId: string, resourceIndex: number) => {
      store.setResourceMapping(childId, resourceIndex);
    },
    [store],
  );

  const getChatContext = useCallback((): PronoteChatContext | undefined => {
    if (!store.isConnected) return undefined;

    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    const todayTimetable = store.timetable.filter((e) => {
      const start = new Date(e.startDate);
      return start >= todayStart && start <= todayEnd;
    });

    // Recent grades: last 10
    const recentGrades = [...store.grades]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10);

    return {
      homework: store.homework.length > 0 ? store.homework : undefined,
      recentGrades: recentGrades.length > 0 ? recentGrades : undefined,
      todayTimetable: todayTimetable.length > 0 ? todayTimetable : undefined,
    };
  }, [store.isConnected, store.homework, store.grades, store.timetable]);

  // Computed values (matching old useStudentPronote API)
  const upcomingHomework = useMemo(
    () => store.homework.filter((h) => !h.done).length,
    [store.homework],
  );

  const averageGrade = useMemo(() => {
    const valid = store.grades.filter((g) => g.value !== null);
    if (valid.length === 0) return null;
    return (
      valid.reduce((sum, g) => sum + ((g.value as number) / g.outOf) * 20, 0) /
      valid.length
    );
  }, [store.grades]);

  return {
    // State
    isConnected: store.isConnected,
    resources: store.resources,
    resourceMappings: store.resourceMappings,
    homework: store.homework,
    grades: store.grades,
    timetable: store.timetable,

    // Computed
    upcomingHomework,
    averageGrade,

    // Actions
    connect,
    disconnect,
    fetchHomework,
    fetchGrades,
    fetchTimetable,
    getChatContext,
    setResourceMapping,
  };
}
