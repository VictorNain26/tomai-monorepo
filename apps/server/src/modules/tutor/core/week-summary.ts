/**
 * The summary of the week, which the guardian and the student read alike (`docs/vision.md`,
 * principle 3): the subjects, the time spent, what resists. Written by the code from timestamps
 * and the exercises' records, never by a model: no word of the student nor of Tom enters it.
 */

import type { SubjectFamily } from '../../../domain/subjects';
import { notionMemories, notionView, type PastExercise } from './memory';

const WEEK_MS = 7 * 24 * 60 * 60_000;
/** A longer gap between two moments of a session is a pause, not time spent. */
const PAUSE_MS = 10 * 60_000;
const ROUND_MINUTES = 5;
/** « Étape intermédiaire » on the ladder: a notion solved with this much help still resists. */
const RESISTS_FROM_HINT = 3;

/** The summary covers the seven days before now, read on a Monday morning as on a Sunday evening. */
export const weekStart = (now: Date) => new Date(now.getTime() - WEEK_MS);

/** A message of the week, and when its session opened. */
export interface WeekMessage {
  sessionId: string;
  subject: SubjectFamily | null;
  startedAt: Date;
  at: Date;
}

const roundedMinutes = (ms: number) => Math.round(ms / 60_000 / ROUND_MINUTES) * ROUND_MINUTES;

/**
 * `messages` grouped by session, each session's in their order; `exercises` and `resets` as the
 * learner memory reads them. A turn stores the student's message and the reply together, once the
 * reply is written: the session's opening times its first message, and the reading of the last
 * reply is not counted.
 */
export function weekSummary(messages: readonly WeekMessage[], exercises: readonly PastExercise[], resets: ReadonlyMap<string, number>) {
  const sessions = new Map<string, WeekMessage[]>();
  for (const message of messages) {
    const session = sessions.get(message.sessionId);
    if (session) session.push(message);
    else sessions.set(message.sessionId, [message]);
  }

  const spent = new Map<SubjectFamily, number>();
  for (const session of sessions.values()) {
    const [first] = session;
    if (!first) continue;
    const times = [first.startedAt, ...session.map((message) => message.at)].map((date) => date.getTime());
    let ms = 0;
    for (let index = 1; index < times.length; index++) {
      const gap = (times[index] ?? 0) - (times[index - 1] ?? 0);
      if (gap <= PAUSE_MS) ms += gap;
    }
    const subject = first.subject ?? 'general';
    spent.set(subject, (spent.get(subject) ?? 0) + ms);
  }

  const total = [...spent.values()].reduce((sum, ms) => sum + ms, 0);
  const subjects = [...spent].map(([subject, ms]) => ({ subject, minutes: roundedMinutes(ms) })).sort((a, b) => b.minutes - a.minutes);
  // An exercise left with no help at all says nothing of the notion: it was barely begun.
  const resisting = notionMemories(exercises, resets)
    .filter((notion) => (!notion.lastSolved && notion.lastHintLevel > 0) || notion.lastHintLevel >= RESISTS_FROM_HINT)
    .map(notionView);
  return { minutes: roundedMinutes(total), sessions: sessions.size, subjects, resisting };
}
