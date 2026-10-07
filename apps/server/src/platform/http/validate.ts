/**
 * A JSON body checked against its Zod schema by Hono's own validator, which keeps the parsed type
 * for the route and for hono/client. A refused body is an INVALID_REQUEST problem naming each field.
 */

import { validator } from 'hono/validator';
import { z } from 'zod';
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

const uuid = z.uuid();

/** A path parameter that must be a UUID: anything else names no resource, which the database would refuse with an error. */
export function uuidParam<const N extends string>(name: N) {
  return validator('param', (params: Record<string, string>) => {
    const parsed = uuid.safeParse(params[name]);
    if (!parsed.success) throw new Problem('NOT_FOUND');
    return { [name]: parsed.data } as Record<N, string>;
  });
}
