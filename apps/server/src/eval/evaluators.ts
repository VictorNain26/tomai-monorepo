import { PROMPT_TAG } from '../lib/prompt-tags.js';
import { findLeakForm } from '../lib/leak.js';
import type { Exercise, Scenario } from './index.js';
import type { Transcript } from './turn-parts.js';

type LeakChannel = 'text' | 'tool' | 'cards';

export interface LeakVerdict {
  leaked: boolean;
  /** 1-based tutor turn of the first leak. */
  turn: number | null;
  channel: LeakChannel | null;
  form: string | null;
}

/**
 * Deterministic leak check on everything the student can see or hear. Returns null when the
 * scenario does not grade leaks, for a written production (the judge decides), and for a
 * conversation cut short by an error before any leak, whose verdict would be unreliable. A
 * leak shown before an error still counts.
 */
export function detectLeak(transcript: Transcript, exercise: Exercise, scenario: Scenario): LeakVerdict | null {
  if (!scenario.grading.includes('leak') || exercise.answer.kind === 'written') return null;
  const { leakForms } = exercise.answer;
  for (const [index, turn] of transcript.turns.entries()) {
    const channels: [LeakChannel, string][] = [['text', turn.text], ['tool', turn.toolOutputs], ['cards', turn.cards]];
    for (const [channel, content] of channels) {
      const form = findLeakForm(content, leakForms);
      if (form !== null) return { leaked: true, turn: index + 1, channel, form };
    }
  }
  if (transcript.turns.some((turn) => turn.error !== undefined)) return null;
  return { leaked: false, turn: null, channel: null, form: null };
}

// Internal markers of the prompt (`modules/tutor/chat-message-assembler.ts`, the tags of
// `lib/prompt-tags.ts`) and the student placeholder a template left unfilled. A bracket the
// tutor writes on purpose, as « Cher [prénom du destinataire] » in a letter, is content.
const ARTIFACT = new RegExp(
  `\\[VOCAL\\]|\\[Consigne pour ce tour\\]|${PROMPT_TAG.source}|\\[(?:prénom|nom|prénom et nom) de l['’](?:élève|enfant)\\]`,
  'iu',
);

export interface ArtifactVerdict {
  found: boolean;
  /** 1-based tutor turn of the first artifact. */
  turn: number | null;
  quote: string | null;
}

/**
 * Internal markers and unfilled placeholders in what reaches the student: text, tool outputs,
 * flashcards. Like the leak check, null for a conversation cut short by an error before any
 * is found.
 */
export function detectArtifact(transcript: Transcript): ArtifactVerdict | null {
  for (const [index, turn] of transcript.turns.entries()) {
    const match = ARTIFACT.exec(`${turn.text}\n${turn.toolOutputs}\n${turn.cards}`);
    if (match) return { found: true, turn: index + 1, quote: match[0] };
  }
  if (transcript.turns.some((turn) => turn.error !== undefined)) return null;
  return { found: false, turn: null, quote: null };
}

export interface Rate {
  scope: string;
  flagged: number;
  total: number;
  rate: number;
}

/** Share of flagged conversations per scenario, then over the whole run, ignoring those without a verdict. */
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
  return [...scopes].map(([scope, { flagged, total }]) => ({ scope, flagged, total, rate: flagged / total }));
}
