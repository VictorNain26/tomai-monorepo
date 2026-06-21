/**
 * usePronote - Unified API-backed Pronote hook
 *
 * Data flow:
 * 1. QR scan -> POST /api/pronote/connect/qr (server stores encrypted token)
 * 2. Fetch: GET /api/pronote/children/:childId/{grades,homework,timetable}
 * 3. Normalized* server types -> PronoteXxx client types via pronote-mappers
 */

import { useCallback, useMemo } from 'react';
import { getTreaty, unwrap } from '@repo/api';
import { usePronoteStore } from '@/stores/pronote-store';
import { mapGrade, mapHomework, mapLesson } from '@/services/pronote/pronote-mappers';
import type {
  QrCodeData,
  PronoteConnectionResult,
  PronoteResource,
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
  // Select individual fields to avoid re-renders on unrelated state changes
  const isConnected = usePronoteStore((s) => s.isConnected);
  const resources = usePronoteStore((s) => s.resources);
  const resourceMappings = usePronoteStore((s) => s.resourceMappings);
  const homework = usePronoteStore((s) => s.homework);
  const grades = usePronoteStore((s) => s.grades);
  const timetable = usePronoteStore((s) => s.timetable);
  const lastHomeworkFetch = usePronoteStore((s) => s.lastHomeworkFetch);
  const lastGradesFetch = usePronoteStore((s) => s.lastGradesFetch);
  const lastTimetableFetch = usePronoteStore((s) => s.lastTimetableFetch);
  const errors = usePronoteStore((s) => s.errors);
  const storeSetConnected = usePronoteStore((s) => s.setConnected);
  const storeSetResources = usePronoteStore((s) => s.setResources);
  const storeSetResourceMapping = usePronoteStore((s) => s.setResourceMapping);
  const storeSetHomework = usePronoteStore((s) => s.setHomework);
  const storeSetGrades = usePronoteStore((s) => s.setGrades);
  const storeSetTimetable = usePronoteStore((s) => s.setTimetable);
  const storeSetError = usePronoteStore((s) => s.setError);
  const storeReset = usePronoteStore((s) => s.reset);

  const connect = useCallback(
    async (qrData: QrCodeData, pin: string): Promise<PronoteConnectionResult> => {
      try {
        const response = await getTreaty().api.pronote.connect.qr.post({
          qr: { jeton: qrData.jeton, login: qrData.login, url: qrData.url },
          pin,
        });

        const raw = unwrap(response) as unknown as {
          success: boolean;
          data: {
            credentialId: string;
            resources: Array<{
              resourceId: number;
              name: string;
              className: string | null;
              establishmentName: string;
            }>;
          };
        };

        if (!raw?.success) {
          return { success: false, error: 'Connexion échouée' };
        }

        const clientResources: PronoteResource[] = raw.data.resources.map((r) => ({
          id: String(r.resourceId),
          name: r.name,
          className: r.className ?? undefined,
        }));

        storeSetConnected({
          instanceUrl: qrData.url,
          username: qrData.login,
          deviceUuid: raw.data.credentialId,
          accountKind: 7, // Parent (only parents use QR connect)
        });
        storeSetResources(clientResources);

        return { success: true, resources: clientResources, accountKind: 7 };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Erreur inconnue';
        return { success: false, error: msg };
      }
    },
    [storeSetConnected, storeSetResources],
  );

  const disconnect = useCallback(async () => {
    storeReset();
  }, [storeReset]);

  const fetchGrades = useCallback(
    async (childId?: string) => {
      if (!isCacheStale(lastGradesFetch, GRADES_TTL)) return;

      const targetId = childId ?? userId;
      try {
        storeSetError('grades', null);
        const response = await getTreaty().api.pronote.children({ childId: targetId }).grades.get();
        const data = unwrap(response);
        const normalized = (data as { data: Parameters<typeof mapGrade>[0][] }).data;
        storeSetGrades(normalized.map(mapGrade));
      } catch (err) {
        console.error('[Pronote] fetchGrades failed:', err);
        storeSetError('grades', 'Impossible de charger les notes. Réessaie.');
      }
    },
    [userId, lastGradesFetch, storeSetGrades, storeSetError],
  );

  const fetchHomework = useCallback(
    async (childId?: string) => {
      if (!isCacheStale(lastHomeworkFetch, HOMEWORK_TTL)) return;

      const targetId = childId ?? userId;
      try {
        storeSetError('homework', null);
        const response = await getTreaty().api.pronote.children({ childId: targetId }).homework.get();
        const data = unwrap(response);
        const normalized = (data as { data: Parameters<typeof mapHomework>[0][] }).data;
        storeSetHomework(normalized.map(mapHomework));
      } catch (err) {
        console.error('[Pronote] fetchHomework failed:', err);
        storeSetError('homework', 'Impossible de charger les devoirs. Réessaie.');
      }
    },
    [userId, lastHomeworkFetch, storeSetHomework, storeSetError],
  );

  const fetchTimetable = useCallback(
    async (childId?: string, day?: string) => {
      if (!isCacheStale(lastTimetableFetch, TIMETABLE_TTL)) return;

      const targetId = childId ?? userId;
      const dayParam = day ?? new Date().toISOString().slice(0, 10);
      try {
        storeSetError('timetable', null);
        const response = await getTreaty().api.pronote
          .children({ childId: targetId })
          .timetable.get({ query: { day: dayParam } });
        const data = unwrap(response);
        const normalized = (data as { data: Parameters<typeof mapLesson>[0][] }).data;
        storeSetTimetable(normalized.map(mapLesson));
      } catch (err) {
        console.error('[Pronote] fetchTimetable failed:', err);
        storeSetError('timetable', "Impossible de charger l'emploi du temps. Réessaie.");
      }
    },
    [userId, lastTimetableFetch, storeSetTimetable, storeSetError],
  );

  const setResourceMapping = useCallback(
    (childId: string, resourceIndex: number) => {
      storeSetResourceMapping(childId, resourceIndex);
    },
    [storeSetResourceMapping],
  );

  // Computed values
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
    errors,

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
