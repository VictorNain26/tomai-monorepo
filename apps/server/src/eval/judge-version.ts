import { createHash } from 'node:crypto';
import { z } from 'zod';
import { CRITERIA } from './criteria.js';
import { EXTRACTOR_INSTRUCTIONS } from './extract.js';
import { dataset } from './index.js';
import { answerSchema } from './judge.js';
import { JUDGE } from './judge-config.js';
import { PREAMBLE } from './judge-context.js';

/**
 * Fingerprint of everything the judge's model reads or is set with: model and sampling,
 * preamble, answer schema, questions, safety questions of the scenarios and the extractor's
 * instructions. A change to any of them is a new judge, without anyone bumping a version;
 * the code of the verifiers is identified by the commit (`output.ts`).
 */
export const JUDGE_VERSION = createHash('sha256')
  .update(JSON.stringify([
    JUDGE,
    PREAMBLE,
    z.toJSONSchema(answerSchema),
    CRITERIA.map(({ name, questions }) => ({ name, questions })),
    dataset.scenarios.map(({ id, safetyChecks }) => ({ id, safetyChecks })),
    EXTRACTOR_INSTRUCTIONS,
  ]))
  .digest('hex')
  .slice(0, 12);
