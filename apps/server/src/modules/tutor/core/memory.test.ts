import { describe, expect, it } from 'bun:test';
import { programmeFor } from '../../../referential';
import { learnerMemoryBlock, notionMemories, notionView, type PastExercise } from './memory';
import { notionText } from './sheet';

const [first, second] = programmeFor('quatrieme', 'mathematiques', 2026)?.entries ?? [];
if (!first || !second) throw new Error('the referential has no maths for the quatrième');

const day = (n: number) => new Date(Date.UTC(2026, 8, n));
const exercise = (overrides: Partial<PastExercise>): PastExercise => ({
  createdAt: day(10),
  entries: [first.id],
  hintLevel: 1,
  solved: true,
  errorTypes: [],
  ...overrides,
});

describe('notionMemories', () => {
  it('counts each notion, reads its last exercise, and names an error seen twice', () => {
    const memories = notionMemories(
      [
        exercise({ createdAt: day(10), errorTypes: ['misinterpret'] }),
        exercise({ createdAt: day(12), entries: [first.id, second.id], hintLevel: 4, solved: false, errorTypes: ['misinterpret', 'not-sure'] }),
      ],
      new Map(),
    );
    expect(memories).toEqual([
      { notionId: first.id, label: first.text, worked: 2, lastHintLevel: 4, lastSolved: false, frequentError: 'misinterpret' },
      { notionId: second.id, label: second.text, worked: 1, lastHintLevel: 4, lastSolved: false, frequentError: null },
    ]);
  });

  it('names no error seen once only, nor one outside the closed list', () => {
    const [memory] = notionMemories([exercise({ errorTypes: ['careless', 'n/a', 'not-sure', 'n/a'] })], new Map());
    expect(memory?.frequentError).toBeNull();
  });

  it('leaves out the exercises before a correction of the student, for that notion only', () => {
    const memories = notionMemories(
      [exercise({ createdAt: day(10), entries: [first.id, second.id] }), exercise({ createdAt: day(20), entries: [second.id] })],
      new Map([[second.id, day(15)]]),
    );
    expect(memories.map(({ notionId, worked }) => [notionId, worked])).toEqual([
      [first.id, 1],
      [second.id, 1],
    ]);
  });

  it('drops a notion the referential does not know', () => {
    expect(notionMemories([exercise({ entries: ['inconnue'] })], new Map())).toEqual([]);
  });
});

describe('learnerMemoryBlock', () => {
  const memories = notionMemories([exercise({ hintLevel: 3, solved: false, errorTypes: ['careless', 'careless'] })], new Map());

  it('writes the exercise’s notions only, in the referential’s words, with no text of the student', () => {
    const block = learnerMemoryBlock([first.id], memories);
    expect(block).toStartWith('<learner_memory>\n');
    expect(block).toContain(
      `- ${notionText(first.id) ?? ''} : travaillée 1 fois ; la dernière fois, pas résolue, avec de l'aide jusqu'à : étape intermédiaire`,
    );
    expect(block).toContain("erreur fréquente : fait des erreurs d'inattention");
    expect(block).toEndWith('</learner_memory>');
  });

  it('is null when the past says nothing of the exercise’s notions', () => {
    expect(learnerMemoryBlock([second.id], memories)).toBeNull();
    expect(learnerMemoryBlock([first.id], [])).toBeNull();
  });
});

describe('notionView', () => {
  it('names the help by its step of the ladder, and the error to watch in the student’s words', () => {
    const [memory] = notionMemories([exercise({ hintLevel: 2, solved: false, errorTypes: ['misinterpret', 'misinterpret'] })], new Map());
    if (!memory) throw new Error('no memory');
    expect(notionView(memory)).toEqual({
      notionId: first.id,
      label: first.text,
      worked: 1,
      lastSolved: false,
      lastHelp: 'Indice ciblé',
      watch: 'mal lire la consigne',
    });
    expect(notionView({ ...memory, frequentError: null }).watch).toBeNull();
  });
});
