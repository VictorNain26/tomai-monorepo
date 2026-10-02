import { z } from 'zod';
import { educationLevelSchema } from '../lib/education-levels.js';
import { SUBJECT_SLUGS } from '../lib/subjects.js';

const text = z.string().trim().min(1);

const collegeLevelSchema = educationLevelSchema.extract(['sixieme', 'cinquieme', 'quatrieme', 'troisieme']);
export type CollegeLevel = z.infer<typeof collegeLevelSchema>;

const entrySchema = z.strictObject({
  id: text,
  level: collegeLevelSchema,
  subject: z.enum(SUBJECT_SLUGS),
  domain: text,
  subtheme: text.nullable(),
  subsubtheme: text.nullable(),
  kind: z.enum(['objective', 'automatism']),
  /** Exact wording of the official text. */
  text,
  page: z.number().int().min(1),
  /** A fraction was rebuilt from stacked digits: checked against the rendered page. */
  formula: z.boolean(),
});
export type Entry = z.infer<typeof entrySchema>;

export const textFileSchema = z
  .strictObject({
    sourceId: text,
    sha256: z.string().regex(/^[0-9a-f]{64}$/),
    entries: z.array(entrySchema).min(1),
  })
  .refine(({ entries }) => new Set(entries.map((e) => e.id)).size === entries.length, {
    message: 'entry ids must be unique',
  });
export type TextFile = z.infer<typeof textFileSchema>;
