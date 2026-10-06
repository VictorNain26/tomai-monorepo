import { z } from 'zod';
import { educationLevelSchema } from '../lib/education-levels.js';
import { SUBJECT_SLUGS } from '../lib/subjects.js';

export const STATEMENT_PLACEHOLDER = '{statement}';

const text = z.string().trim().min(1);

const shortAnswerSchema = z.strictObject({
  kind: z.literal('short'),
  text,
  /**
   * Canonical forms of the answer, plain text. The leak check matches them as whole words
   * after normalising the tutor output (KaTeX, minus signs, spaces).
   */
  leakForms: z.array(text).min(1),
  verification: z.discriminatedUnion('method', [
    /** Recomputed from the numbers of the statement by `eval-dataset.test.ts`. */
    z.strictObject({ method: z.literal('computation') }),
    z.strictObject({ method: z.literal('reference'), rule: text, source: z.url() }),
  ]),
});

const writtenAnswerSchema = z.strictObject({
  kind: z.literal('written'),
  /** What counts as a leak: decided by the judge, not by string matching. */
  leak: text,
  expectedElements: z.array(text).min(1),
});

const exerciseSchema = z.strictObject({
  id: text,
  origin: z.enum(['protocol-2026-10-01', 'original']),
  level: educationLevelSchema,
  subject: z.enum(SUBJECT_SLUGS),
  topic: text,
  /** Programme in force in 2026-2027 that covers the exercise, quoted verbatim. */
  programme: z.strictObject({ reference: text, quote: text, source: z.url() }),
  /**
   * Entries of `apps/server/src/referential/` the exercise works, and entries of later
   * classes whose notions the help must not rely on. Null while the subject has no
   * referential. An entry of a later class in `entries` marks an exercise beyond its class.
   */
  alignment: z.strictObject({ entries: z.array(text).min(1), laterEntries: z.array(text) }).nullable(),
  statement: text,
  /** The error behind the attempt the statement contains, given to the judge as a reference; null without an attempt. */
  studentError: text.nullable(),
  answer: z.discriminatedUnion('kind', [shortAnswerSchema, writtenAnswerSchema]),
  review: z.strictObject({ by: text, at: z.iso.date() }).nullable(),
});

/** A student message; a spoken one goes through the voice channel, as the microphone sends it. */
const turnSchema = z.union([text, z.strictObject({ text, inputMode: z.literal('voice') })]);
export type ScenarioTurn = z.infer<typeof turnSchema>;

export function turnText(turn: ScenarioTurn): string {
  return typeof turn === 'string' ? turn : turn.text;
}

const scenarioSchema = z.strictObject({
  id: text,
  origin: z.enum(['protocol-2026-10-01', 'agent-md-9']),
  name: text,
  description: text,
  exercises: z.union([z.literal('all'), z.array(text).min(1)]),
  turns: z
    .array(turnSchema)
    .min(1)
    .refine(([first]) => first !== undefined && turnText(first).includes(STATEMENT_PLACEHOLDER), {
      message: `the first turn must contain ${STATEMENT_PLACEHOLDER}`,
    }),
  grading: z.array(z.enum(['leak', 'help', 'safety'])).min(1),
  expectedBehavior: text,
  /**
   * Yes/no questions the judge answers for a safety scenario, with the answer that passes; a
   * critical one failed makes the response inappropriate whatever the others.
   */
  safetyChecks: z.array(z.strictObject({ id: text, question: text, pass: z.enum(['oui', 'non']), critical: z.boolean().default(false) })).default([]),
});

export const datasetSchema = z
  .strictObject({ exercises: z.array(exerciseSchema).min(1), scenarios: z.array(scenarioSchema).min(1) })
  .superRefine(({ exercises, scenarios }, ctx) => {
    const exerciseIds = new Set<string>();
    for (const { id } of exercises) {
      if (exerciseIds.has(id)) ctx.addIssue({ code: 'custom', message: `duplicate exercise id ${id}` });
      exerciseIds.add(id);
    }
    const scenarioIds = new Set<string>();
    for (const scenario of scenarios) {
      if (scenarioIds.has(scenario.id)) {
        ctx.addIssue({ code: 'custom', message: `duplicate scenario id ${scenario.id}` });
      }
      scenarioIds.add(scenario.id);
      if (scenario.grading.includes('safety') !== scenario.safetyChecks.length > 0) {
        ctx.addIssue({ code: 'custom', message: `scenario ${scenario.id}: safety checks go with safety grading, and only there` });
      }
      if (scenario.exercises === 'all') continue;
      for (const id of scenario.exercises) {
        if (!exerciseIds.has(id)) {
          ctx.addIssue({ code: 'custom', message: `scenario ${scenario.id} targets unknown exercise ${id}` });
        }
      }
    }
  });

export type Exercise = z.infer<typeof exerciseSchema>;
export type Scenario = z.infer<typeof scenarioSchema>;
