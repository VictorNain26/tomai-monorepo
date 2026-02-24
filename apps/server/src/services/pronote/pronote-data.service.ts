/**
 * Pronote Data Service - Homework, grades, timetable with cache
 *
 * Pattern: check cache -> get session via authService -> fetch -> set cache
 */

import {
  assignmentsFromIntervals,
  gradesOverview,
  timetableFromIntervals,
  type Assignment,
} from 'pawnote';
import { db } from '../../db/connection.js';
import { pronoteChildMappings } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import { logger } from '../../lib/observability.js';
import { cacheService } from '../memory-cache.service.js';
import { pronoteAuthService } from './pronote-auth.service.js';
import {
  PRONOTE_CACHE,
  type PronoteHomework,
  type PronoteGrade,
  type PronoteTimetableEntry,
} from './pronote-shared.js';

// =============================================
// SERVICE CLASS
// =============================================

class PronoteDataService {
  /**
   * Récupère les devoirs pour un enfant (cache 15min)
   */
  async getHomeworkForChild(childId: string, weekOffset = 0): Promise<PronoteHomework[] | null> {
    const cacheKey = `homework:${childId}:w${weekOffset}`;
    const cached = cacheService.get<PronoteHomework[]>(PRONOTE_CACHE.PREFIX, cacheKey);
    if (cached) return cached;

    const result = await pronoteAuthService.getActiveSessionForChild(childId);
    if (!result) return null;

    const { session } = result;

    try {
      const now = new Date();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay() + 1 + weekOffset * 7);
      startOfWeek.setHours(0, 0, 0, 0);

      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      endOfWeek.setHours(23, 59, 59, 999);

      const assignments = await assignmentsFromIntervals(session, startOfWeek, endOfWeek);

      await db
        .update(pronoteChildMappings)
        .set({ lastHomeworkSync: new Date(), updatedAt: new Date() })
        .where(eq(pronoteChildMappings.childId, childId));

      const homework = assignments.map((a: Assignment) => ({
        id: a.id,
        subject: a.subject.name,
        description: a.description,
        dueDate: a.deadline,
        done: a.done,
        difficulty: a.difficulty,
        estimatedMinutes: a.length,
      }));

      cacheService.set(PRONOTE_CACHE.PREFIX, cacheKey, homework, PRONOTE_CACHE.TTL.HOMEWORK);

      return homework;
    } catch (error) {
      logger.error('Pronote homework fetch error', {
        operation: 'pronote:homework:error',
        childId,
        _error: error instanceof Error ? error.message : String(error),
        severity: 'medium' as const,
      });
      return null;
    }
  }

  /**
   * Récupère les notes pour un enfant (cache 1h)
   */
  async getGradesForChild(childId: string): Promise<PronoteGrade[] | null> {
    const cacheKey = `grades:${childId}`;
    const cached = cacheService.get<PronoteGrade[]>(PRONOTE_CACHE.PREFIX, cacheKey);
    if (cached) return cached;

    const result = await pronoteAuthService.getActiveSessionForChild(childId);
    if (!result) return null;

    const { session } = result;

    try {
      const defaultPeriod = session.userResource.tabs.get(198)?.defaultPeriod;
      if (!defaultPeriod) {
        logger.warn('No default period for grades', { childId });
        return [];
      }

      const overview = await gradesOverview(session, defaultPeriod);

      await db
        .update(pronoteChildMappings)
        .set({ lastGradesSync: new Date(), updatedAt: new Date() })
        .where(eq(pronoteChildMappings.childId, childId));

      const grades = overview.grades.map((g) => ({
        id: g.id,
        subject: g.subject.name,
        value: g.value.kind === 0 ? g.value.points : null,
        outOf: g.outOf.points,
        coefficient: g.coefficient,
        date: g.date,
        description: g.comment,
        average: g.average?.points,
        max: g.max?.points,
        min: g.min?.points,
      }));

      cacheService.set(PRONOTE_CACHE.PREFIX, cacheKey, grades, PRONOTE_CACHE.TTL.GRADES);

      return grades;
    } catch (error) {
      logger.error('Pronote grades fetch error', {
        operation: 'pronote:grades:error',
        childId,
        _error: error instanceof Error ? error.message : String(error),
        severity: 'medium' as const,
      });
      return null;
    }
  }

  /**
   * Récupère l'emploi du temps pour un enfant (cache 30min)
   */
  async getTimetableForChild(
    childId: string,
    weekOffset = 0
  ): Promise<PronoteTimetableEntry[] | null> {
    const cacheKey = `timetable:${childId}:w${weekOffset}`;
    const cached = cacheService.get<PronoteTimetableEntry[]>(PRONOTE_CACHE.PREFIX, cacheKey);
    if (cached) return cached;

    const result = await pronoteAuthService.getActiveSessionForChild(childId);
    if (!result) return null;

    const { session } = result;

    try {
      const now = new Date();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay() + 1 + weekOffset * 7);
      startOfWeek.setHours(0, 0, 0, 0);

      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      endOfWeek.setHours(23, 59, 59, 999);

      const timetable = await timetableFromIntervals(session, startOfWeek, endOfWeek);

      await db
        .update(pronoteChildMappings)
        .set({ lastTimetableSync: new Date(), updatedAt: new Date() })
        .where(eq(pronoteChildMappings.childId, childId));

      const entries = timetable.classes
        .filter((c): c is typeof c & { is: 'lesson' } => c.is === 'lesson')
        .map((lesson) => ({
          id: lesson.id,
          subject: lesson.subject?.name,
          teacherNames: lesson.teacherNames,
          classrooms: lesson.classrooms,
          startDate: lesson.startDate,
          endDate: lesson.endDate,
          canceled: lesson.canceled,
          status: lesson.status,
        }));

      cacheService.set(PRONOTE_CACHE.PREFIX, cacheKey, entries, PRONOTE_CACHE.TTL.TIMETABLE);

      return entries;
    } catch (error) {
      logger.error('Pronote timetable fetch error', {
        operation: 'pronote:timetable:error',
        childId,
        _error: error instanceof Error ? error.message : String(error),
        severity: 'medium' as const,
      });
      return null;
    }
  }
}

export const pronoteDataService = new PronoteDataService();
