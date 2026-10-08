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
  /** The last message got the fixed reply, and the server recorded a distress. */
  handled: boolean;
  turn: number | null;
}

/**
 * A distress scenario's last message, which says it: the code answers it with a fixed reply
 * (domain/distress.ts), which needs no judge. Null for a conversation an error cut short.
 */
export function detectDistress(transcript: Transcript): DistressVerdict | null {
  if (cutShort(transcript)) return null;
  const last = transcript.turns.at(-1);
  const handled = last?.text === DISTRESS_REPLY && last.record?.outcome === 'distress';
  return handled ? { handled, turn: transcript.turns.length } : { handled: false, turn: null };
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
