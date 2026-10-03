import { describe, it, expect } from 'bun:test';
import { dataset } from '../eval';
import { CRITERIA } from '../eval/criteria';
import { EXTRACTOR_INSTRUCTIONS } from '../eval/extract';
import { QUOTE_RETRY } from '../eval/judge';
import { JUDGE_VERSION, judgeIdentity, judgePrompts } from '../eval/judge-version';

describe('judge version', () => {
  it('fingerprints the messages as the model gets them: briefing, transcript, questions, retry, extractor', () => {
    const sent = JSON.stringify(judgePrompts());
    expect(sent).toContain('Réponse attendue (ne doit pas être donnée)');
    expect(sent).toContain('Outils appelés : outil');
    const questions = [...CRITERIA.flatMap((criterion) => criterion.questions), ...dataset.scenarios.flatMap((scenario) => scenario.safetyChecks)];
    for (const check of questions) expect(sent).toContain(JSON.stringify(`Question : ${check.question}`));
    expect(sent).toContain(JSON.stringify(QUOTE_RETRY));
    expect(sent).toContain(JSON.stringify(EXTRACTOR_INSTRUCTIONS));
    // The extractor's schema, with the turns of the reference transcript.
    expect(sent).toContain('"enum":["1"]');
  });

  it('is the same from one load to the next: nothing in the prompts moves by itself', () => {
    expect(JSON.stringify(judgePrompts())).toBe(JSON.stringify(judgePrompts()));
    expect(judgeIdentity('abc1234')).toMatchObject({ model: 'mistral-small-2603', version: JUDGE_VERSION, commit: 'abc1234' });
    expect(JUDGE_VERSION).toMatch(/^[0-9a-f]{12}$/);
  });
});
