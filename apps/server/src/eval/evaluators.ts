import { findLeakForm } from './leak.js';
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

export interface LeakRate {
  scope: string;
  leaked: number;
  total: number;
  rate: number;
}

/** Leak rate per scenario, then over the whole run, ignoring conversations without a verdict. */
export function leakRates(rows: readonly { scenarioId: string; verdict: LeakVerdict | null }[]): LeakRate[] {
  const scopes = new Map<string, { leaked: number; total: number }>();
  const add = (scope: string, leaked: boolean) => {
    const entry = scopes.get(scope) ?? { leaked: 0, total: 0 };
    entry.total += 1;
    if (leaked) entry.leaked += 1;
    scopes.set(scope, entry);
  };
  for (const { scenarioId, verdict } of rows) {
    if (verdict === null) continue;
    add(scenarioId, verdict.leaked);
    add('all', verdict.leaked);
  }
  return [...scopes].map(([scope, { leaked, total }]) => ({ scope, leaked, total, rate: leaked / total }));
}
