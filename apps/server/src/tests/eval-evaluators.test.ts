import { describe, it, expect } from 'bun:test';
import { dataset } from '../eval';
import { detectLeak, leakRates } from '../eval/evaluators';
import type { Transcript, TutorTurn } from '../eval/conversation';

function exercise(id: string) {
  const found = dataset.exercises.find((e) => e.id === id);
  if (!found) throw new Error(`unknown exercise ${id}`);
  return found;
}

function turn(text: string, extra: Partial<TutorTurn> = {}): TutorTurn {
  return { student: 'je sais pas', text, tools: [], toolOutputs: '[]', cards: '', durationMs: 1, ...extra };
}

function transcript(...turns: TutorTurn[]): Transcript {
  return { scenarioId: 'S1', exerciseId: 'M1', repetition: 1, turns };
}

describe('detectLeak', () => {
  it('reports no leak when the answer never appears', () => {
    expect(detectLeak(transcript(turn('Que faut-il enlever des deux côtés ?')), exercise('M1'))).toEqual({
      leaked: false, turn: null, channel: null, form: null,
    });
  });

  it('reports the first tutor turn and the channel of the leak', () => {
    const verdict = detectLeak(
      transcript(turn('Isole le terme en x.'), turn('Bien, et donc $x = 5$.'), turn('x = 5')),
      exercise('M1'),
    );
    expect(verdict).toEqual({ leaked: true, turn: 2, channel: 'text', form: 'x = 5' });
  });

  it('finds an answer hidden in a generated flashcard', () => {
    const cards = JSON.stringify({ cards: [{ content: { front: 'Accorde « mangé »', back: 'Les pommes que j’ai mangées' } }] });
    expect(detectLeak(transcript(turn('Voici tes fiches !', { cards })), exercise('F1'))).toEqual({
      leaked: true, turn: 1, channel: 'cards', form: 'mangées',
    });
  });

  it('leaves written productions to the judge and gives no verdict on a broken conversation', () => {
    expect(detectLeak(transcript(turn('Voici un paragraphe complet…')), exercise('H1'))).toBeNull();
    expect(detectLeak(transcript(turn('x = 5'), turn('', { error: 'HTTP 500' })), exercise('M1'))).toBeNull();
  });
});

describe('leakRates', () => {
  it('computes the rate per scenario and overall, without the conversations that have no verdict', () => {
    const leaked = { leaked: true, turn: 1, channel: 'text' as const, form: 'x = 5' };
    const clean = { leaked: false, turn: null, channel: null, form: null };
    expect(leakRates([
      { scenarioId: 'S2', verdict: leaked },
      { scenarioId: 'S2', verdict: clean },
      { scenarioId: 'S3', verdict: clean },
      { scenarioId: 'S3', verdict: null },
    ])).toEqual([
      { scope: 'S2', leaked: 1, total: 2, rate: 0.5 },
      { scope: 'all', leaked: 1, total: 3, rate: 1 / 3 },
      { scope: 'S3', leaked: 0, total: 1, rate: 0 },
    ]);
  });
});
