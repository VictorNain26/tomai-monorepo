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
import type {
  QrCodeData,
  PronoteHomework,
  PronoteGrade,
  PronoteTimetableEntry,
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
  // Select individual fields to avoid re-renders on unrelated state changes
  const isConnected = usePronoteStore((s) => s.isConnected);
  const metadata = usePronoteStore((s) => s.metadata);
  const resources = usePronoteStore((s) => s.resources);
  const resourceMappings = usePronoteStore((s) => s.resourceMappings);
  const homework = usePronoteStore((s) => s.homework);
  const grades = usePronoteStore((s) => s.grades);
  const timetable = usePronoteStore((s) => s.timetable);
  const lastHomeworkFetch = usePronoteStore((s) => s.lastHomeworkFetch);
  const lastGradesFetch = usePronoteStore((s) => s.lastGradesFetch);
  const lastTimetableFetch = usePronoteStore((s) => s.lastTimetableFetch);
  const storeSetConnected = usePronoteStore((s) => s.setConnected);
  const storeSetResources = usePronoteStore((s) => s.setResources);
  const storeSetResourceMapping = usePronoteStore((s) => s.setResourceMapping);
  const storeSetHomework = usePronoteStore((s) => s.setHomework);
  const storeSetGrades = usePronoteStore((s) => s.setGrades);
  const storeSetTimetable = usePronoteStore((s) => s.setTimetable);
  const storeReset = usePronoteStore((s) => s.reset);

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
        const meta = {
          instanceUrl: qrData.url,
          username: qrData.login,
          deviceUuid,
          accountKind: result.accountKind ?? AccountKind.PARENT,
        };

        storeSetConnected(meta);
        storeSetResources(result.resources);

      }

      return result;
    },
    [userId, storeSetConnected, storeSetResources],
  );

  const disconnect = useCallback(async () => {
    await pronoteSessionService.disconnect(userId);
    storeReset();
  }, [userId, storeReset]);

  const fetchHomework = useCallback(
    async () => {
      if (!metadata) return;
      if (!isCacheStale(lastHomeworkFetch, HOMEWORK_TTL)) return;

      const handle = await pronoteSessionService.refreshSession(userId, metadata);
      if (!handle) return;

      try {
        const now = new Date();
        const from = new Date(now);
        from.setDate(from.getDate() - 7);
        const to = new Date(now);
        to.setDate(to.getDate() + 14);

        const assignments = await assignmentsFromIntervals(handle, from, to);
        const hw: PronoteHomework[] = assignments.map((a) => ({
          id: a.id,
          subject: a.subject.name,
          description: a.description,
          dueDate: a.deadline.toISOString(),
          done: a.done,
          difficulty: a.difficulty ?? 0,
        }));

        storeSetHomework(hw);
      } catch (err) {
        console.error('[Pronote] fetchHomework failed:', err);
      }
    },
    [userId, metadata, lastHomeworkFetch, storeSetHomework],
  );

  const fetchGrades = useCallback(async () => {
    if (!metadata) return;
    if (!isCacheStale(lastGradesFetch, GRADES_TTL)) return;

    const handle = await pronoteSessionService.refreshSession(userId, metadata);
    if (!handle) return;

    try {
      const period = getCurrentPeriod(handle);
      if (!period) return;

      const overview = await gradesOverview(handle, period);

      const g: PronoteGrade[] = overview.grades.map((gr) => ({
        id: gr.id,
        subject: gr.subject.name,
        value: gr.value.kind === GradeKind.Grade ? gr.value.points : null,
        outOf: gr.outOf.points,
        coefficient: gr.coefficient,
        date: gr.date.toISOString(),
        description: gr.comment,
        average: gr.average ? gr.average.points : undefined,
        max: gr.max ? gr.max.points : undefined,
        min: gr.min ? gr.min.points : undefined,
      }));

      storeSetGrades(g);
    } catch (err) {
      console.error('[Pronote] fetchGrades failed:', err);
    }
  }, [userId, metadata, lastGradesFetch, storeSetGrades]);

  const fetchTimetable = useCallback(
    async () => {
      if (!metadata) return;
      if (!isCacheStale(lastTimetableFetch, TIMETABLE_TTL)) return;

      const handle = await pronoteSessionService.refreshSession(userId, metadata);
      if (!handle) return;

      try {
        const now = new Date();
        const from = new Date(now);
        from.setHours(0, 0, 0, 0);
        const to = new Date(now);
        to.setDate(to.getDate() + 7);

        const result = await timetableFromIntervals(handle, from, to);
        const tt: PronoteTimetableEntry[] = result.classes
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

        storeSetTimetable(tt);
      } catch (err) {
        console.error('[Pronote] fetchTimetable failed:', err);
      }
    },
    [userId, metadata, lastTimetableFetch, storeSetTimetable],
  );

  const setResourceMapping = useCallback(
    (childId: string, resourceIndex: number) => {
      storeSetResourceMapping(childId, resourceIndex);
    },
    [storeSetResourceMapping],
  );

  // Computed values (matching old useStudentPronote API)
  const upcomingHomework = useMemo(
    () => homework.filter((h) => !h.done).length,
    [homework],
  );

  const averageGrade = useMemo(() => {
    const valid = grades.filter((g) => g.value !== null);
    if (valid.length === 0) return null;
    return (
      valid.reduce((sum, g) => sum + ((g.value as number) / g.outOf) * 20, 0) /
      valid.length
    );
  }, [grades]);

  return {
    // State
    isConnected,
    resources,
    resourceMappings,
    homework,
    grades,
    timetable,

    // Computed
    upcomingHomework,
    averageGrade,

    // Actions
    connect,
    disconnect,
    fetchHomework,
    fetchGrades,
    fetchTimetable,
    setResourceMapping,
  };
}
