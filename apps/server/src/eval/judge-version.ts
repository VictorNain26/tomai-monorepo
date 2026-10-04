import { createHash } from 'node:crypto';
import { z } from 'zod';
import { CRITERIA } from './criteria.js';
import { extractionRequest } from './extract.js';
import { dataset } from './index.js';
import { QUOTE_RETRY, answerSchema, questionMessage } from './judge.js';
import { JUDGE } from './judge-config.js';
import { contextMessages, judgeContext, type JudgeInput } from './judge-context.js';

// A fixed item, rendered through the real templates: briefing, transcript layout, question,
// quote retry and extractor wrapper all reach the fingerprint as the model reads them.
const REFERENCE: JudgeInput = {
  ...judgeContext({ scenarioId: 'S1', exerciseId: 'M1', repetition: 1 }),
  transcript: {
    scenarioId: 'S1',
    exerciseId: 'M1',
    repetition: 1,
    turns: [
      { student: 'Élève', text: 'Tuteur', tools: ['outil'], toolOutputs: 'sortie', cards: 'fiche', durationMs: 1 },
      { student: 'Élève', inputMode: 'voice', text: 'Tuteur', tools: [], toolOutputs: '', cards: '', durationMs: 1, error: 'erreur' },
    ],
  },
};

/** Everything the judge's model is sent or set with, on the reference item. */
export function judgePrompts(): unknown[] {
  const extraction = extractionRequest(REFERENCE);
  return [
    JUDGE,
    contextMessages(REFERENCE),
    z.toJSONSchema(answerSchema),
    [...CRITERIA.flatMap((criterion) => criterion.questions), ...dataset.scenarios.flatMap((scenario) => scenario.safetyChecks)].map(questionMessage),
    QUOTE_RETRY,
    extraction.messages,
    z.toJSONSchema(extraction.schema),
  ];
}

/**
 * Fingerprint of the judge's prompts and settings: any change to them is a new judge,
 * without anyone bumping a version. The code of the verifiers is identified by the commit.
 */
export const JUDGE_VERSION = createHash('sha256').update(JSON.stringify(judgePrompts())).digest('hex').slice(0, 12);

/** The judge as every output records it: settings, fingerprint and the commit of the run. */
export function judgeIdentity(commit: string) {
  return { ...JUDGE, version: JUDGE_VERSION, commit };
}
