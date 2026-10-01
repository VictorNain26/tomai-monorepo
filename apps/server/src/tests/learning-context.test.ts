import { describe, it, expect, mock } from 'bun:test';
import type { learningService } from '../modules/learning/learning.service';

type ReviewSignals = Awaited<ReturnType<typeof learningService.getReviewSignals>>;

let signals: ReviewSignals = { dueCount: 0, weakSubjects: [] };
let failing = false;
mock.module('../modules/learning/index', () => ({
  learningService: {
    getReviewSignals: async (): Promise<ReviewSignals> => {
      if (failing) throw new Error('db down');
      return signals;
    },
  },
}));

const { getLearningContext } = await import('../modules/tutor/mistral-helpers');

describe('getLearningContext', () => {
  it('adds nothing when no card is due and no subject is weak', async () => {
    signals = { dueCount: 0, weakSubjects: [] };

    expect(await getLearningContext('u1')).toBeNull();
  });

  it('names the due cards and the weak subjects', async () => {
    signals = {
      dueCount: 3,
      weakSubjects: [{ subject: 'francais', totalLapses: 5 }, { subject: 'mathematiques', totalLapses: 2 }],
    };

    const context = await getLearningContext('u1');

    expect(context).toContain("L'élève a 3 cartes de révision en attente.");
    expect(context).toContain('Sujets à renforcer : francais (5 erreurs), mathematiques (2 erreurs).');
  });

  it('uses the singular for a single due card', async () => {
    signals = { dueCount: 1, weakSubjects: [] };

    expect(await getLearningContext('u1')).toContain("L'élève a 1 carte de révision en attente.");
  });

  it('degrades to no context when the signals cannot be read', async () => {
    failing = true;

    expect(await getLearningContext('u1')).toBeNull();
    failing = false;
  });
});
