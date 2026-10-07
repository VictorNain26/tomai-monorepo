/**
 * The server's configuration: one schema, parsed once by main.ts from the environment and passed
 * on. No other file reads the environment.
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';

const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;
const MISTRAL_EU = 'https://api.eu.mistral.ai';

const webDistDir = z.string().refine((dir) => existsSync(join(dir, 'index.html')), {
  error: 'WEB_DIST_DIR doit être le build de apps/web, un dossier qui contient index.html',
});

const fields = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  LOG_LEVEL: z.enum(LOG_LEVELS).default('info'),
  // Requests per minute a client address may send to the API; the e2e suite, whose browsers share one address, raises it.
  API_RATE_LIMIT: z.coerce.number().int().positive().default(100),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  // The one public origin, of the API and the web alike. In development, the Vite dev server,
  // whose proxy forwards /api here: better-auth's redirects land on the web.
  BETTER_AUTH_URL: z.url().optional(),
  BETTER_AUTH_SECRET: z.string().min(32, 'BETTER_AUTH_SECRET doit faire au moins 32 caractères'),
  // The build of apps/web. In development, Vite serves it.
  WEB_DIST_DIR: webDistDir.optional(),
  // Scaleway Transactional Email: an IAM key restricted to it, its Project, and a sender on the
  // Project's checked domain. Without them, outside production, emails are logged instead.
  SCW_ACCESS_KEY: z.string().optional(),
  SCW_SECRET_KEY: z.string().optional(),
  SCW_DEFAULT_PROJECT_ID: z.guid().optional(),
  MAIL_FROM: z.email().optional(),
  // Mistral, through its EU endpoint in production (docs.mistral.ai/inference/regional-inference).
  // A dated model only: an alias changes model and price silently
  // (docs.mistral.ai/inference/model-lifecycle).
  MISTRAL_API_KEY: z.string().optional(),
  // A bare origin, kept without its trailing slash: the SDKs add their own paths.
  MISTRAL_SERVER_URL: z
    .url({ protocol: /^https?$/ })
    .refine((url) => new URL(url).href === `${new URL(url).origin}/`, { error: 'MISTRAL_SERVER_URL doit être une origine, sans chemin' })
    .transform((url) => new URL(url).origin)
    .default(MISTRAL_EU),
  MISTRAL_MODEL: z
    .string()
    .refine((model) => !model.endsWith('-latest'), { error: 'MISTRAL_MODEL doit être un modèle daté, pas un alias -latest' })
    .default('mistral-small-2603'),
  // For the text calls. Moderation keeps its own shorter deadlines, measured during an incident
  // (platform/ai/moderation.ts); 0 retries turns its retries off too.
  MISTRAL_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
  MISTRAL_RETRY_ATTEMPTS: z.coerce.number().int().min(0).max(5).default(2),
});

const databaseFields = fields.pick({ NODE_ENV: true, DATABASE_URL: true });

// Zod skips a refinement once a field has failed: these checks run apart, so that one error
// names every variable at fault.
const MAIL = ['SCW_ACCESS_KEY', 'SCW_SECRET_KEY', 'SCW_DEFAULT_PROJECT_ID', 'MAIL_FROM'] as const;
const REQUIRED_IN_PRODUCTION = ['BETTER_AUTH_URL', 'WEB_DIST_DIR', 'MISTRAL_API_KEY', ...MAIL] as const;

type Environment = Record<string, string | undefined>;

function parse<T extends z.ZodType>(target: T, raw: Environment, required: readonly string[] = []): z.infer<T> {
  // An empty variable counts as unset: `PORT=` falls back to its default instead of failing.
  const environment = Object.fromEntries(Object.entries(raw).filter(([, value]) => value !== undefined && value !== ''));
  const result = target.safeParse(environment);
  const issues = result.success ? [] : result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
  if (environment['NODE_ENV'] === 'production') {
    for (const key of required) if (!(key in environment)) issues.push(`${key}: requis en production`);
  }
  if (!result.success || issues.length > 0) throw new Error(`Invalid environment:\n  ${issues.join('\n  ')}`);
  return result.data;
}

export type LogLevel = (typeof LOG_LEVELS)[number];

export interface Config {
  readonly production: boolean;
  readonly port: number;
  readonly logLevel: LogLevel;
  readonly apiRateLimit: number;
  readonly databaseUrl: string;
  readonly publicUrl: string;
  readonly authSecret: string;
  readonly webDistDir: string | undefined;
  readonly mail: { accessKey: string; secretKey: string; projectId: string; from: string } | undefined;
  readonly mistral: MistralConfig;
}

export interface MistralConfig {
  /** Outside production, absent: Mistral refuses the calls. */
  readonly apiKey: string | undefined;
  readonly serverUrl: string;
  /** Inference guaranteed in the EU, at a 10 % upcharge. */
  readonly euEndpoint: boolean;
  readonly model: string;
  readonly timeoutMs: number;
  readonly retryAttempts: number;
}

/** Parses the environment, or throws with every invalid variable named. */
export function loadConfig(environment: Environment): Config {
  const env = parse(fields, environment, REQUIRED_IN_PRODUCTION);
  // The mail settings go together: with one missing, nothing would be sent, silently.
  const set = MAIL.filter((key) => env[key] !== undefined);
  if (set.length > 0 && set.length < MAIL.length) {
    const missing = MAIL.filter((key) => env[key] === undefined);
    throw new Error(`Invalid environment:\n  ${missing.map((key) => `${key}: requis avec ${set.join(', ')}`).join('\n  ')}`);
  }
  // A student's text never leaves the EU in production.
  if (env.NODE_ENV === 'production' && env.MISTRAL_SERVER_URL !== MISTRAL_EU) {
    throw new Error(`Invalid environment:\n  MISTRAL_SERVER_URL: ${MISTRAL_EU} requis en production`);
  }
  return Object.freeze({
    production: env.NODE_ENV === 'production',
    port: env.PORT,
    logLevel: env.LOG_LEVEL,
    apiRateLimit: env.API_RATE_LIMIT,
    databaseUrl: env.DATABASE_URL,
    publicUrl: env.BETTER_AUTH_URL ?? 'http://localhost:3002',
    authSecret: env.BETTER_AUTH_SECRET,
    webDistDir: env.WEB_DIST_DIR,
    mail:
      env.SCW_ACCESS_KEY && env.SCW_SECRET_KEY && env.SCW_DEFAULT_PROJECT_ID && env.MAIL_FROM
        ? { accessKey: env.SCW_ACCESS_KEY, secretKey: env.SCW_SECRET_KEY, projectId: env.SCW_DEFAULT_PROJECT_ID, from: env.MAIL_FROM }
        : undefined,
    mistral: {
      apiKey: env.MISTRAL_API_KEY,
      serverUrl: env.MISTRAL_SERVER_URL,
      euEndpoint: env.MISTRAL_SERVER_URL === MISTRAL_EU,
      model: env.MISTRAL_MODEL,
      timeoutMs: env.MISTRAL_TIMEOUT_MS,
      retryAttempts: env.MISTRAL_RETRY_ATTEMPTS,
    },
  });
}

/** What the migration script needs: it runs before the server, without the server's secrets. */
export function loadDatabaseConfig(environment: Environment): Pick<Config, 'production' | 'databaseUrl'> {
  const env = parse(databaseFields, environment);
  return Object.freeze({ production: env.NODE_ENV === 'production', databaseUrl: env.DATABASE_URL });
}
