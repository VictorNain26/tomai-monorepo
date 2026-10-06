import { z } from 'zod';

const turn = z
  .object({
    student: z.string(),
    text: z.string(),
    tools: z.array(z.string()),
    toolOutputs: z.string(),
    cards: z.string(),
    durationMs: z.number(),
    error: z.string().optional(),
    inputMode: z.literal('voice').optional(),
  })
  .transform(({ error, inputMode, ...rest }) => ({ ...rest, ...(inputMode && { inputMode }), ...(error !== undefined && { error }) }));

/** The part of an `eval-results/` file the annotation and agreement steps read. */
const resultsFile = z.object({
  runName: z.string(),
  judge: z.unknown(),
  report: z.array(
    z.object({
      scenarioId: z.string(),
      exerciseId: z.string(),
      repetition: z.number().int().min(1),
      traceId: z.string().nullable(),
      transcript: z
        .object({
          scenarioId: z.string(),
          exerciseId: z.string(),
          repetition: z.number().int().min(1),
          turns: z.array(turn),
        })
        .nullable(),
    }),
  ),
});
export type ResultsFile = z.infer<typeof resultsFile>;

export function parseResults(json: unknown): ResultsFile {
  return resultsFile.parse(json);
}

export async function loadResults(path: string): Promise<ResultsFile> {
  return parseResults(await Bun.file(path).json());
}

/** Conversations played to the end, with their trace: the only ones worth grading. */
export function gradable({ report }: ResultsFile) {
  return report.flatMap(({ traceId, transcript, ...row }) => {
    if (!traceId || !transcript || transcript.turns.some((t) => 'error' in t)) return [];
    return [{ ...row, traceId, transcript }];
  });
}
