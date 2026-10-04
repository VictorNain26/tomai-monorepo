import { describe, it, expect } from 'bun:test';
import { dataset } from '../eval';
import { detectArtifact, detectLeak, rates } from '../eval/evaluators';
import type { TutorTurn } from '../eval/turn-parts';
import { transcript, turn } from './_helpers/eval-fixtures';

function exercise(id: string) {
  const found = dataset.exercises.find((e) => e.id === id);
  if (!found) throw new Error(`unknown exercise ${id}`);
  return found;
}

function scenario(id: string) {
  const found = dataset.scenarios.find((s) => s.id === id);
  if (!found) throw new Error(`unknown scenario ${id}`);
  return found;
}

const S1 = scenario('S1');

function reply(text: string, extra: Partial<TutorTurn> = {}): TutorTurn {
  return turn('je sais pas', text, extra);
}

const played = (...turns: TutorTurn[]) => transcript(turns);

describe('detectLeak', () => {
  it('reports no leak when the answer never appears', () => {
    expect(detectLeak(played(reply('Que faut-il enlever des deux côtés ?')), exercise('M1'), S1)).toEqual({
      leaked: false, turn: null, channel: null, form: null,
    });
  });

  it('reports the first tutor turn and the channel of the leak', () => {
    const verdict = detectLeak(
      played(reply('Isole le terme en x.'), reply('Bien, et donc $x = 5$.'), reply('x = 5')),
      exercise('M1'),
      S1,
    );
    expect(verdict).toEqual({ leaked: true, turn: 2, channel: 'text', form: 'x = 5' });
  });

  it('finds an answer hidden in a generated flashcard', () => {
    const cards = JSON.stringify({ cards: [{ content: { front: 'Accorde « mangé »', back: 'Les pommes que j’ai mangées' } }] });
    expect(detectLeak(played(reply('Voici tes fiches !', { cards })), exercise('F1'), S1)).toEqual({
      leaked: true, turn: 1, channel: 'cards', form: 'mangées',
    });
  });

  it('leaves written productions to the judge and scenarios without leak grading out', () => {
    expect(detectLeak(played(reply('Voici un paragraphe complet…')), exercise('H1'), S1)).toBeNull();
    expect(detectLeak(played(reply('x = 5')), exercise('M1'), scenario('S5'))).toBeNull();
  });

  it('keeps a leak shown before an error, and gives no verdict on a broken clean conversation', () => {
    expect(detectLeak(played(reply('x = 5'), reply('', { error: 'HTTP 500' })), exercise('M1'), S1)).toEqual({
      leaked: true, turn: 1, channel: 'text', form: 'x = 5',
    });
    expect(detectLeak(played(reply('Isole x.'), reply('', { error: 'HTTP 500' })), exercise('M1'), S1)).toBeNull();
  });
});

describe('rates', () => {
  it('computes the rate per scenario and overall, without the conversations that have no verdict', () => {
    expect(rates([
      { scenarioId: 'S2', flagged: true },
      { scenarioId: 'S2', flagged: false },
      { scenarioId: 'S3', flagged: false },
      { scenarioId: 'S3', flagged: null },
    ])).toEqual([
      { scope: 'S2', flagged: 1, total: 2, rate: 0.5 },
      { scope: 'all', flagged: 1, total: 3, rate: 1 / 3 },
      { scope: 'S3', flagged: 0, total: 1, rate: 0 },
    ]);
  });
});

describe('detectArtifact', () => {
  it('finds an internal marker or an unfilled placeholder in the text or the flashcards', () => {
    expect(detectArtifact(played(reply('Bien.'), reply('[VOCAL]\n\nTrès bien, je vais t’expliquer.')))).toEqual({ found: true, turn: 2, quote: '[VOCAL]' });
    expect(detectArtifact(played(reply('Retour à ton exercice, [prénom de l\'élève] :')))).toMatchObject({ found: true, quote: '[prénom de l\'élève]' });
    expect(detectArtifact(played(reply('Voici tes fiches.', { cards: 'Rappel <student_context>' })))).toMatchObject({ found: true, turn: 1 });
  });

  it('leaves alone brackets that are content: a choice, an interval, a list marker', () => {
    expect(detectArtifact(played(reply('Choisis [a] ou [b] ; x est dans [0 ; 5].'), reply('Le nom commun « prénom » est masculin.')))).toEqual({ found: false, turn: null, quote: null });
  });
});
