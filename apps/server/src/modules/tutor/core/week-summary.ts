/**
 * The summary of the week, which the guardian and the student read alike (`docs/vision.md`,
 * principle 3): the subjects, the time spent, what resists. Written by the code from timestamps
 * and the exercises' records, never by a model: no word of the student nor of Tom enters it.
 */

import type { SubjectFamily } from '../../../domain/subjects';
import { notionMemories, notionView, type PastExercise } from './memory';

const WEEK_MS = 7 * 24 * 60 * 60_000;
/** A longer gap between two messages is a pause, not time spent. */
const PAUSE_MS = 10 * 60_000;
const ROUND_MINUTES = 5;
/** « Étape intermédiaire » on the ladder: a notion solved with this much help still resists. */
const RESISTS_FROM_HINT = 3;

/** The summary covers the seven days before now, read on a Monday morning as on a Sunday evening. */
export const weekStart = (now: Date) => new Date(now.getTime() - WEEK_MS);

export interface WeekMessage {
  sessionId: string;
  subject: SubjectFamily | null;
  at: Date;
}

/** `messages` grouped by session, each session's in their order; `exercises` and `resets` as the learner memory reads them. */
export function weekSummary(messages: readonly WeekMessage[], exercises: readonly PastExercise[], resets: ReadonlyMap<string, number>) {
  const sessions = new Map<string, WeekMessage[]>();
  for (const message of messages) sessions.set(message.sessionId, [...(sessions.get(message.sessionId) ?? []), message]);

  const spent = new Map<SubjectFamily, number>();
  for (const [first, ...rest] of sessions.values()) {
    if (!first) continue;
    let ms = 0;
    rest.reduce((previous, message) => {
      const gap = message.at.getTime() - previous.at.getTime();
      if (gap <= PAUSE_MS) ms += gap;
      return message;
    }, first);
    const subject = first.subject ?? 'general';
    spent.set(subject, (spent.get(subject) ?? 0) + ms);
  }

  const subjects = [...spent]
    .map(([subject, ms]) => ({ subject, minutes: Math.round(ms / 60_000 / ROUND_MINUTES) * ROUND_MINUTES }))
    .sort((a, b) => b.minutes - a.minutes);
  const resisting = notionMemories(exercises, resets)
    .filter((notion) => !notion.lastSolved || notion.lastHintLevel >= RESISTS_FROM_HINT)
    .map(notionView);
  return { minutes: subjects.reduce((total, { minutes }) => total + minutes, 0), sessions: sessions.size, subjects, resisting };
}
