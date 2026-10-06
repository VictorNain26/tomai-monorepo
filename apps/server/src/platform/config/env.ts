/**
 * Unified environment configuration — single validated source.
 * Loaded at boot (fail-fast), no silent fallbacks on secrets.
 *
 * Zod schema parses Bun.env once, throws on invalid/missing required vars.
 * All consumer code reads from the singleton export.
 */

import { z } from 'zod';
import { LOG_LEVELS } from '../observability/log-levels.js';
import { existsSync } from 'node:fs';
import { resolveDatabaseUrl } from './database-url.js';

/**
 * Détecte si on est dans un container Docker
 */
function isRunningInDocker(): boolean {
  if (Bun.env.DOCKER_CONTAINER === 'true') {
    return true;
  }
  return existsSync('/.dockerenv');
}

const isProd = Bun.env.NODE_ENV === 'production';
const inDocker = isRunningInDocker();

/**
 * Zod schema for environment validation.
 * - Required secrets: throw at boot if missing in production
 * - Optional configs: defaults provided
 * - Database: smart Docker/localhost detection
 */
const pinnedModelId = z.string().refine((id) => !id.endsWith('-latest'), {
  error: 'alias -latest interdit : épingler un ID daté (https://docs.mistral.ai/inference/model-lifecycle)',
});

// MISTRAL_SERVER_URL doit être une origine nue : un chemin (ex. .../v1)
// produirait /v1/v1/... une fois concaténé au chemin d'API. En prod, seul
// l'endpoint UE est autorisé (aucune donnée élève hors UE).
const mistralServerUrl = z
  .url()
  .refine((value) => new URL(value).pathname === '/', {
    error: 'MISTRAL_SERVER_URL doit être une origine nue, sans chemin (ex. https://api.eu.mistral.ai)',
  })
  .refine((value) => !value.endsWith('/'), {
    error: 'MISTRAL_SERVER_URL ne doit pas se terminer par un slash',
  })
  .refine((value) => !isProd || new URL(value).host === 'api.eu.mistral.ai', {
    error: 'MISTRAL_SERVER_URL doit être api.eu.mistral.ai en production (aucune donnée élève hors UE)',
  });

const EnvSchema = z.object({
  // Application
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  APP_VERSION: z.string().default('1.0.0'),
  DEPLOYMENT_ID: z.string().optional(),

  // URLs and Origins
  BETTER_AUTH_URL: isProd ? z.url() : z.url().default('http://localhost:3000'),
  FRONTEND_URL: z.url().optional(),
  CORS_ORIGINS: z.string().optional(),

  // Database (resolved via resolveDatabaseUrl() which handles Docker detection)
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DATABASE_URL_EXTERNAL: z.string().optional(),
  // Note: getDatabaseUrl() delegates to resolveDatabaseUrl() to avoid duplication

  // Authentication
  BETTER_AUTH_SECRET: z.string().min(32, 'BETTER_AUTH_SECRET must be at least 32 characters'),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  // Session configuration
  SESSION_MAX_AGE: z.coerce.number().int().default(604800), // 7 days in seconds
  SESSION_UPDATE_AGE: z.coerce.number().int().default(86400), // 1 day in seconds

  // Scaleway Object Storage (RGPD — France)
  SCALEWAY_ACCESS_KEY: z.string().optional(),
  SCALEWAY_SECRET_KEY: z.string().optional(),
  SCALEWAY_BUCKET: z.string().optional(),
  SCALEWAY_REGION: z.string().default('fr-par'),

  // AI — Mistral. Endpoint UE : inférence garantie en Europe, +10 %
  // (https://docs.mistral.ai/inference/regional-inference).
  MISTRAL_API_KEY: z.string().optional(),
  MISTRAL_SERVER_URL: mistralServerUrl.default('https://api.eu.mistral.ai'),
  MISTRAL_MODEL: pinnedModelId.default('mistral-small-2603'),
  MISTRAL_STT_MODEL: pinnedModelId.default('voxtral-mini-2602'),
  MISTRAL_TTS_MODEL: pinnedModelId.default('voxtral-mini-tts-2603'),
  MISTRAL_MAX_TOKENS: z.coerce.number().int().default(16384),
  MISTRAL_TEMPERATURE: z.coerce.number().min(0).max(2).default(0.7),
  MISTRAL_TIMEOUT: z.coerce.number().int().default(60000),
  MISTRAL_RETRY_ATTEMPTS: z.coerce.number().int().default(3),
  // Wall-clock budget for one streamText() chat call (all agentic steps
  // included) — replaces the old two-tier setup/chunk timeout pair now that
  // the AI SDK manages the tool loop as a single continuous stream.
  CHAT_STREAM_TIMEOUT_MS: z.coerce.number().int().default(120000),

  // Feature flags
  QUOTA_ENFORCEMENT_ENABLED: z.enum(['true', 'false']).default('true').transform(val => val === 'true'),

  // Observability
  GIT_COMMIT_SHA: z.string().default('unknown'),
  LOG_LEVEL: z.enum(LOG_LEVELS).default('info'),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().optional(),

  // Logging/Monitoring (optional)
  SENTRY_DSN: z.string().optional(),
}); // Allow extra system variables (npm, shell, etc.)

type EnvType = z.infer<typeof EnvSchema>;

/**
 * Parse and validate environment at module load (eager, fail-fast)
 */
function parseEnv(): EnvType {
  const result = EnvSchema.safeParse(Bun.env);

  if (!result.success) {
    const errorMessages = result.error.issues
      .map(issue => `${issue.path.join('.')}: ${issue.message}`)
      .join('\n  ');
    throw new Error(`Invalid environment configuration:\n  ${errorMessages}`);
  }

  return result.data;
}

export const env = parseEnv();

/**
 * Helper to check if running in production
 */
export const isProduction = (): boolean => env.NODE_ENV === 'production';

/**
 * Helper to check if running in development
 */
export const isDevelopment = (): boolean => env.NODE_ENV === 'development';

/**
 * Helper to check if running in Docker
 */
export const isInDocker = (): boolean => inDocker;

/**
 * Resolve DATABASE_URL based on Docker context
 * In Docker containers: use DATABASE_URL (internal hostname)
 * Locally: use DATABASE_URL_EXTERNAL (localhost) if provided, else DATABASE_URL
 *
 * Note: delegates to resolveDatabaseUrl() to avoid duplication with migrate.ts
 */
export function getDatabaseUrl(): string {
  return resolveDatabaseUrl();
}

/**
 * Build CORS origins list (HTTP/HTTPS only)
 * - Includes BETTER_AUTH_URL + FRONTEND_URL (if set)
 * - Adds CORS_ORIGINS comma-separated list
 * - Dev: adds localhost:3000
 */
export function getCorsOrigins(): string[] {
  const origins = new Set<string>();

  // Add explicitly configured origins
  if (env.BETTER_AUTH_URL) {
    origins.add(env.BETTER_AUTH_URL);
  }
  if (env.FRONTEND_URL) {
    origins.add(env.FRONTEND_URL);
  }

  // Add comma-separated CORS_ORIGINS
  if (env.CORS_ORIGINS) {
    env.CORS_ORIGINS.split(',')
      .map(o => o.trim())
      .filter(Boolean)
      .forEach(o => origins.add(o));
  }

  // Dev origins (HTTP localhost)
  if (isDevelopment()) {
    origins.add('http://localhost:3000'); // server
  }

  return Array.from(origins);
}
