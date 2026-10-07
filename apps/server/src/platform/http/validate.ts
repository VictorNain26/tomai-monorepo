/**
 * A JSON body checked against its Zod schema by Hono's own validator, which keeps the parsed type
 * for the route and for hono/client. A refused body is an INVALID_REQUEST problem naming each field.
 */

import { validator } from 'hono/validator';
import type { z } from 'zod';
import { Problem } from './problem';

export function jsonBody<T extends z.ZodType>(schema: T) {
  return validator('json', (value): z.infer<T> => {
    const result = schema.safeParse(value);
    if (!result.success) {
      throw new Problem('INVALID_REQUEST', result.error.issues.map((issue) => `${issue.path.join('.') || 'body'}: ${issue.message}`).join('; '));
    }
    return result.data;
  });
}
