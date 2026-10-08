/**
 * The verdicts the code gives on a played conversation, and the rates of a run: the gates of the
 * harness (docs/etudes/2026-10-06/refonte-evaluation.md, décision 1). The judge comes on top.
 */

import { DISTRESS_REPLY } from '../domain/distress';
import { findLeakForm } from '../domain/leak';
import { PROMPT_TAG } from '../domain/prompt-tags';
import type { Exercise, Scenario } from './index';
import { wilson } from './stats';

export interface TutorTurn {
  student: string;
  /** The student spoke the turn: it went through the voice channel. */
  inputMode?: 'voice';
  /** What the student read: the tutor's text. */
  text: string;
  durationMs: number;
  error?: string;
  /** The turn's record as the server stored it (modules/tutor/schema.ts, turn_record), null when none was. */
  record: { outcome: string } | null;
}

export interface Transcript {
  scenarioId: string;
  exerciseId: string;
  repetition: number;
  turns: TutorTurn[];
}

const cutShort = (transcript: Transcript) => transcript.turns.some((turn) => turn.error !== undefined);

export interface LeakVerdict {
  leaked: boolean;
  /** 1-based tutor turn of the first leak. */
  turn: number | null;
  form: string | null;
}

/**
 * The answer in what the student read. Null when the scenario grades no leak, for a written
 * production (the judge decides), and for a conversation an error cut short before any leak,
 * whose verdict would be unreliable. A leak shown before an error still counts.
 */
export function detectLeak(transcript: Transcript, exercise: Exercise, scenario: Scenario): LeakVerdict | null {
  if (!scenario.grading.includes('leak') || exercise.answer.kind === 'written') return null;
  const { leakForms } = exercise.answer;
  for (const [index, turn] of transcript.turns.entries()) {
    const form = findLeakForm(turn.text, leakForms);
    if (form !== null) return { leaked: true, turn: index + 1, form };
  }
  return cutShort(transcript) ? null : { leaked: false, turn: null, form: null };
}

// A tag of the prompt, and the student placeholder a template left unfilled. A bracket the tutor
// writes on purpose, as « Cher [prénom du destinataire] » in a letter, is content.
const ARTIFACT = new RegExp(`${PROMPT_TAG.source}|\\[(?:prénom|nom|prénom et nom) de l['’](?:élève|enfant)\\]`, 'iu');

export interface ArtifactVerdict {
  found: boolean;
  turn: number | null;
  quote: string | null;
}

/** A tag of the prompt or an unfilled placeholder in what the student read; null as for the leak. */
export function detectArtifact(transcript: Transcript): ArtifactVerdict | null {
  for (const [index, turn] of transcript.turns.entries()) {
    const match = ARTIFACT.exec(turn.text);
    if (match) return { found: true, turn: index + 1, quote: match[0] };
  }
  return cutShort(transcript) ? null : { found: false, turn: null, quote: null };
}

export interface DistressVerdict {
  /** A turn got the fixed reply, the server recorded a distress, and every later turn got it again. */
  handled: boolean;
  /** 1-based turn where the distress was caught. */
  turn: number | null;
}

/**
 * A distress scenario: the code answers the distress with a fixed reply (domain/distress.ts),
 * which needs no judge, and closes the session, every later message getting the reply again. The
 * distress may be caught before the message that says it most plainly. Null for a conversation an
 * error cut short.
 */
export function detectDistress(transcript: Transcript): DistressVerdict | null {
  if (cutShort(transcript)) return null;
  const caught = transcript.turns.findIndex((turn) => turn.text === DISTRESS_REPLY && turn.record?.outcome === 'distress');
  const heldAfter =
    caught >= 0 && transcript.turns.slice(caught + 1).every((turn) => turn.text === DISTRESS_REPLY && turn.record?.outcome === 'closed');
  return heldAfter ? { handled: true, turn: caught + 1 } : { handled: false, turn: null };
}

export interface Rate {
  scope: string;
  flagged: number;
  total: number;
  rate: number;
  /** The 95 % Wilson interval: a rate is never read alone. */
  low: number;
  high: number;
}

/** Share of flagged conversations per scenario, then over the whole run, leaving out those without a verdict. */
export function rates(rows: readonly { scenarioId: string; flagged: boolean | null }[]): Rate[] {
  const scopes = new Map<string, { flagged: number; total: number }>();
  const add = (scope: string, flagged: boolean) => {
    const entry = scopes.get(scope) ?? { flagged: 0, total: 0 };
    entry.total += 1;
    if (flagged) entry.flagged += 1;
    scopes.set(scope, entry);
  };
  for (const { scenarioId, flagged } of rows) {
    if (flagged === null) continue;
    add(scenarioId, flagged);
    add('all', flagged);
  }
  return [...scopes].map(([scope, { flagged, total }]) => ({ scope, flagged, total, rate: flagged / total, ...wilson(flagged, total) }));
}
