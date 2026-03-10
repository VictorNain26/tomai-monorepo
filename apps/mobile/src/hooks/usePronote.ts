/**
 * usePronote - Unified device-first Pronote hook
 *
 * Replaces useParentPronote and useStudentPronote.
 * All data lives on-device (Zustand/MMKV); server only stores credentials backup.
 *
 * Data flow:
 * 1. QR scan -> pawnote login -> token stored in SecureStore
 * 2. Refresh: token -> pawnote session -> fetch homework/grades/timetable -> store
 * 3. Credentials synced to server as encrypted backup
 */

import { useCallback, useMemo } from 'react';
import {
  AccountKind,
  GradeKind,
  assignmentsFromIntervals,
  gradesOverview,
  timetableFromIntervals,
  TabLocation,
  type SessionHandle,
} from 'pawnote';
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

/** Get the current period from session handle (defaults to first available period) */
function getCurrentPeriod(handle: SessionHandle) {
  const gradesTab = handle.userResource.tabs.get(TabLocation.Grades);
  if (gradesTab?.defaultPeriod) return gradesTab.defaultPeriod;
  if (gradesTab?.periods && gradesTab.periods.length > 0) return gradesTab.periods[0];
  return null;
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
          accountKind: AccountKind.PARENT,
        });
        store.setResources(result.resources);

        // Sync credentials to server (best-effort)
        void pronoteCredentialsSync.pushToServer({
          token: '', // Token is in SecureStore, not exposed here
          metadata: {
            instanceUrl: qrData.url,
            username: qrData.login,
            deviceUuid,
            accountKind: AccountKind.PARENT,
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
    async () => {
      if (!store.metadata) return;
      if (!isCacheStale(store.lastHomeworkFetch, HOMEWORK_TTL)) return;

      const handle = await pronoteSessionService.refreshSession(userId, store.metadata);
      if (!handle) return;

      try {
        const now = new Date();
        const from = new Date(now);
        from.setDate(from.getDate() - 7);
        const to = new Date(now);
        to.setDate(to.getDate() + 14);

        const assignments = await assignmentsFromIntervals(handle, from, to);
        const homework: PronoteHomework[] = assignments.map((a) => ({
          id: a.id,
          subject: a.subject.name,
          description: a.description,
          dueDate: a.deadline.toISOString(),
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
      const period = getCurrentPeriod(handle);
      if (!period) return;

      const overview = await gradesOverview(handle, period);

      const grades: PronoteGrade[] = overview.grades.map((g) => ({
        id: g.id,
        subject: g.subject.name,
        value: g.value.kind === GradeKind.Grade ? g.value.points : null,
        outOf: g.outOf.points,
        coefficient: g.coefficient,
        date: g.date.toISOString(),
        description: g.comment,
        average: g.average ? g.average.points : undefined,
        max: g.max ? g.max.points : undefined,
        min: g.min ? g.min.points : undefined,
      }));

      store.setGrades(grades);
    } catch {
      // Session may have expired; data remains from cache
    }
  }, [userId, store]);

  const fetchTimetable = useCallback(
    async () => {
      if (!store.metadata) return;
      if (!isCacheStale(store.lastTimetableFetch, TIMETABLE_TTL)) return;

      const handle = await pronoteSessionService.refreshSession(userId, store.metadata);
      if (!handle) return;

      try {
        const now = new Date();
        const from = new Date(now);
        from.setHours(0, 0, 0, 0);
        const to = new Date(now);
        to.setDate(to.getDate() + 7);

        const result = await timetableFromIntervals(handle, from, to);
        const timetable: PronoteTimetableEntry[] = result.classes
          .filter((c): c is typeof c & { is: 'lesson' } => c.is === 'lesson')
          .map((e) => ({
            id: e.id,
            subject: e.subject?.name,
            teacherNames: e.teacherNames,
            classrooms: e.classrooms,
            startDate: e.startDate.toISOString(),
            endDate: e.endDate.toISOString(),
            canceled: e.canceled,
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
