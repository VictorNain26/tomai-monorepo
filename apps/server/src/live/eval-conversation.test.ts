import { describe, it, expect } from 'bun:test';
import { HAS_MISTRAL } from './_creds';
import { dataset } from '../eval';
import { playConversation, removeEvalAccounts } from '../eval/conversation';

// Live : Mistral réel et base de dev (`bun run test:live`), hors CI. Joue une conversation
// d'évaluation par la vraie route de chat, comme `bun run eval`.

describe('eval conversation through /api/chat/stream (real API and DB)', () => {
  it('MISTRAL_API_KEY is configured (fail-closed, no silent skip)', () => {
    expect(HAS_MISTRAL).toBe(true);
  });

  it('plays S2 on M1 as a fresh student and returns the tutor turn', async () => {
    const scenario = dataset.scenarios.find((s) => s.id === 'S2');
    const exercise = dataset.exercises.find((e) => e.id === 'M1');
    if (!scenario || !exercise) throw new Error('S2 or M1 missing from the dataset');

    const transcript = await playConversation(scenario, exercise, 1);

    expect(transcript.turns).toHaveLength(1);
    expect(transcript.turns[0]?.error).toBeUndefined();
    expect(transcript.turns[0]?.text.length).toBeGreaterThan(0);
    expect(await removeEvalAccounts()).toBeGreaterThanOrEqual(1);
  }, 120_000);
});
