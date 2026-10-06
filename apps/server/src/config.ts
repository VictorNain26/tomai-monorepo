/**
 * The server's configuration: one schema, parsed once by main.ts from the environment and passed
 * on. No other file reads the environment.
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';

const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;

const webDistDir = z.string().refine((dir) => existsSync(join(dir, 'index.html')), {
  error: 'WEB_DIST_DIR doit être le build de apps/web, un dossier qui contient index.html',
});

const fields = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  LOG_LEVEL: z.enum(LOG_LEVELS).default('info'),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  // The one public origin, of the API and the web alike. In development, the Vite dev server,
  // whose proxy forwards /api here: better-auth's redirects land on the web.
  BETTER_AUTH_URL: z.url().optional(),
  BETTER_AUTH_SECRET: z.string().min(32, 'BETTER_AUTH_SECRET doit faire au moins 32 caractères'),
  // The build of apps/web. In development, Vite serves it.
  WEB_DIST_DIR: webDistDir.optional(),
});

const schema = fields.superRefine((env, ctx) => {
  if (env.NODE_ENV !== 'production') return;
  if (!env.BETTER_AUTH_URL) ctx.addIssue({ code: 'custom', path: ['BETTER_AUTH_URL'], message: 'requis en production' });
  if (!env.WEB_DIST_DIR) ctx.addIssue({ code: 'custom', path: ['WEB_DIST_DIR'], message: 'requis en production' });
});

const databaseSchema = fields.pick({ NODE_ENV: true, DATABASE_URL: true });

function parse<T extends z.ZodType>(target: T, environment: Record<string, string | undefined>): z.infer<T> {
  const result = target.safeParse(environment);
  if (!result.success) {
    const issues = result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
    throw new Error(`Invalid environment:\n  ${issues.join('\n  ')}`);
  }
  return result.data;
}

export type LogLevel = (typeof LOG_LEVELS)[number];

export interface Config {
  readonly production: boolean;
  readonly port: number;
  readonly logLevel: LogLevel;
  readonly databaseUrl: string;
  readonly publicUrl: string;
  readonly authSecret: string;
  readonly webDistDir: string | undefined;
}

/** Parses the environment, or throws with every invalid variable named. */
export function loadConfig(environment: Record<string, string | undefined>): Config {
  const env = parse(schema, environment);
  return Object.freeze({
    production: env.NODE_ENV === 'production',
    port: env.PORT,
    logLevel: env.LOG_LEVEL,
    databaseUrl: env.DATABASE_URL,
    publicUrl: env.BETTER_AUTH_URL ?? 'http://localhost:3002',
    authSecret: env.BETTER_AUTH_SECRET,
    webDistDir: env.WEB_DIST_DIR,
  });
}

/** What the migration script needs: it runs before the server, without the server's secrets. */
export function loadDatabaseConfig(environment: Record<string, string | undefined>): Pick<Config, 'production' | 'databaseUrl'> {
  const env = parse(databaseSchema, environment);
  return Object.freeze({ production: env.NODE_ENV === 'production', databaseUrl: env.DATABASE_URL });
}
