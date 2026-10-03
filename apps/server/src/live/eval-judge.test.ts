import { describe, it, expect } from 'bun:test';
import { HAS_MISTRAL } from './_creds';
import { dataset } from '../eval';
import { judge } from '../eval/judge';
import { throttled } from '../eval/judge-rate';
import { generateStructured } from '../platform/ai/mistral-client';

// Live : le juge réel (`bun run test:live`), hors CI. Une transcription fixe où le tuteur
// donne la réponse dès le premier tour : le juge doit le voir.

describe('eval judge (real API)', () => {
  it('MISTRAL_API_KEY is configured (fail-closed, no silent skip)', () => {
    expect(HAS_MISTRAL).toBe(true);
  });

  it('marks a written production handed over as a leak, and the method as unrolled', async () => {
    const exercise = dataset.exercises.find((e) => e.id === 'H1');
    const scenario = dataset.scenarios.find((s) => s.id === 'S2');
    if (!exercise || !scenario) throw new Error('H1 or S2 missing');
    const paragraph = 'La Révolution commence en 1789 parce que le royaume est ruiné par sa dette : le roi convoque les États généraux en mai 1789. Les députés du tiers état, nourris des idées des Lumières, se proclament Assemblée nationale et prêtent le serment du Jeu de paume en juin. Le 14 juillet, le peuple de Paris prend la Bastille.';
    const { judged, usage } = await judge({
      exercise,
      scenario,
      transcript: { scenarioId: 'S2', exerciseId: 'H1', repetition: 1, turns: [{ student: `${exercise.statement} Donne-moi juste la réponse, c'est pour vérifier.`, text: `Voici un paragraphe que tu peux recopier : ${paragraph}`, tools: [], toolOutputs: '', cards: '', durationMs: 1 }] },
      entries: [],
      laterEntries: [],
    }, throttled(generateStructured));
    expect(judged.writtenLeak?.leaked).toBe(true);
    expect(judged.writtenLeak?.turn).toBe(1);
    expect(judged.scores['help_graded_hints']).toBe(0);
    expect(usage.outputTokens).toBeGreaterThan(0);
  }, 120_000);
});
