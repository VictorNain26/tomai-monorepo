/**
 * pronote-mappers — pure conversion helpers
 *
 * Maps server-side Normalized* types to mobile PronoteXxx client types.
 * Re-exports the Normalized* interfaces so tests can import them from one place.
 */

import type {
  PronoteGrade,
  PronoteHomework,
  PronoteTimetableEntry,
} from './pronote-types';

// ---------------------------------------------------------------------------
// Mirror of server provider.types — kept here to avoid importing server code.
// These must stay in sync with apps/server/src/services/pronote/provider.types.ts.
// ---------------------------------------------------------------------------

export interface NormalizedGrade {
  subject: string;
  value: number | null;
  scale: number;
  date: string;
  comment: string | null;
  coefficient: number;
  classAverage: number | null;
  max: number | null;
  min: number | null;
}

export interface NormalizedHomework {
  subject: string;
  description: string;
  dueDate: string;
  done: boolean;
}

export interface NormalizedLesson {
  subject: string;
  start: string;
  end: string;
  room: string | null;
  canceled: boolean;
}

// ---------------------------------------------------------------------------
// Stable id helpers — deterministic, no uuid dep required
// ---------------------------------------------------------------------------

function stableId(prefix: string, index: number, ...parts: string[]): string {
  return `${prefix}:${index}:${parts.join(':')}`;
}

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

export function mapGrade(g: NormalizedGrade, index: number): PronoteGrade {
  return {
    id: stableId('grade', index, g.subject, g.date, String(g.value ?? 'null')),
    subject: g.subject,
    value: g.value,
    outOf: g.scale,
    coefficient: g.coefficient,
    date: g.date,
    description: g.comment ?? '',
    average: g.classAverage ?? undefined,
    max: g.max ?? undefined,
    min: g.min ?? undefined,
  };
}

export function mapHomework(h: NormalizedHomework, index: number): PronoteHomework {
  return {
    id: stableId('hw', index, h.subject, h.dueDate),
    subject: h.subject,
    description: h.description,
    dueDate: h.dueDate,
    done: h.done,
    difficulty: 0,
  };
}

export function mapLesson(l: NormalizedLesson, index: number): PronoteTimetableEntry {
  return {
    id: stableId('lesson', index, l.subject, l.start),
    subject: l.subject,
    teacherNames: [],
    classrooms: l.room ? [l.room] : [],
    startDate: l.start,
    endDate: l.end,
    canceled: l.canceled,
    status: undefined,
  };
}
