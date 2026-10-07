/**
 * The version of everything the writer may receive besides the conversation itself: the system
 * prompt of each class, the subject blocks, the voice marker, the turn's instructions, the
 * contract at each level, the regeneration's and the learner memory's. A turn records it: an edit of any of them makes
 * a new version, so that measures never mix two prompts.
 */

import { SCHOOL_LEVELS } from '../../../domain/levels';
import { SUBJECT_FAMILIES } from '../../../domain/subjects';
import { turnInstruction } from './analysis';
import { VOICE_MARKER } from './assembler';
import { LADDER, turnContract } from './ladder';
import { learnerMemoryBlock } from './memory';
import { regenerationInstruction } from './output-check';
import { promptVersion, studentBlock, subjectBlock, systemPrompt } from './prompt';
import type { ExerciseSheet } from './sheet';

const SHEET: ExerciseSheet = {
  statement: '',
  kind: 'short',
  answer: null,
  answerForms: [],
  mathEquation: null,
  mathAnswer: null,
  steps: ['a', 'b'],
  commonErrors: [],
  rule: 'r',
  facts: [{ text: 'f', role: 'support' }],
  expectedElements: [],
  entries: [],
  laterEntries: [],
};
const ANALYSIS = {
  subject: 'general',
  bringsExercise: false,
  proposesAnswer: false,
  asksSolution: false,
  asksExplanation: false,
  saysStuck: false,
} as const;
const DIAGNOSES = [
  null,
  ...(['correct', 'right-step', 'incorrect', 'unclear'] as const).map((verdict) => ({
    verdict,
    firstWrongStep: 'e',
    errorType: 'n/a' as const,
    proposalMath: null,
    decidedBy: 'model' as const,
  })),
];

export const TURN_PROMPT_VERSION = promptVersion(
  [
    ...SCHOOL_LEVELS.map(systemPrompt),
    ...SUBJECT_FAMILIES.map(subjectBlock),
    studentBlock(''),
    VOICE_MARKER,
    turnInstruction({ ...ANALYSIS, proposesAnswer: true }),
    turnInstruction({ ...ANALYSIS, asksSolution: true }),
    ...LADDER.flatMap((_, level) =>
      DIAGNOSES.map((diagnosis) =>
        turnContract({
          sheet: SHEET,
          uncertain: false,
          level,
          attempt: diagnosis !== null,
          asksSolution: true,
          diagnosis,
          stepsDone: 0,
          hints: [{ level, text: 'h' }],
        }),
      ),
    ),
    regenerationInstruction([{ kind: 'answer' }, { kind: 'tag' }, { kind: 'equality', quote: 'q' }, { kind: 'moderation', categories: [] }]),
    learnerMemoryBlock(['n'], [{ notionId: 'n', label: 'l', worked: 1, lastHintLevel: 0, lastSolved: true, frequentError: 'careless' }]),
  ].join('\n'),
);
