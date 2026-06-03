/**
 * Unified environment configuration — single validated source.
 * Loaded at boot (fail-fast), no silent fallbacks on secrets.
 *
 * Zod schema parses Bun.env once, throws on invalid/missing required vars.
 * All consumer code reads from the singleton export.
 */

import { z } from 'zod';
import { existsSync } from 'node:fs';
import { resolveDatabaseUrl } from './database-url.js';

/**
 * Détecte si on est dans un container Docker
 */
function isRunningInDocker(): boolean {
  if (Bun.env['DOCKER_CONTAINER'] === 'true') {
    return true;
  }
  return existsSync('/.dockerenv');
}

const isProd = Bun.env['NODE_ENV'] === 'production';
const inDocker = isRunningInDocker();

/**
 * Zod schema for environment validation.
 * - Required secrets: throw at boot if missing in production
 * - Optional configs: defaults provided
 * - Database: smart Docker/localhost detection
 */
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
  TRUSTED_ORIGINS: z.string().optional(),

  // Database (resolved via resolveDatabaseUrl() which handles Docker detection)
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DATABASE_URL_EXTERNAL: z.string().optional(),
  // Note: getDatabaseUrl() delegates to resolveDatabaseUrl() to avoid duplication

  // Authentication
  BETTER_AUTH_SECRET: z.string().min(32, 'BETTER_AUTH_SECRET must be at least 32 characters'),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  // Pronote encryption (required in production if Pronote is enabled)
  PRONOTE_ENCRYPTION_KEY: z.string().min(32, 'PRONOTE_ENCRYPTION_KEY must be at least 32 characters').optional(),

  // RevenueCat webhooks (required in production)
  REVENUECAT_WEBHOOK_AUTH: z.string().min(32, 'REVENUECAT_WEBHOOK_AUTH must be at least 32 characters').optional(),

  // Session configuration
  SESSION_MAX_AGE: z.coerce.number().int().default(604800), // 7 days in seconds
  SESSION_UPDATE_AGE: z.coerce.number().int().default(86400), // 1 day in seconds

  // Scaleway Object Storage (RGPD — France)
  SCALEWAY_ACCESS_KEY: z.string().optional(),
  SCALEWAY_SECRET_KEY: z.string().optional(),
  SCALEWAY_BUCKET: z.string().optional(),
  SCALEWAY_REGION: z.string().default('fr-par'),

  // AI — Mistral (100% sovereign EU stack)
  MISTRAL_API_KEY: z.string().optional(),
  MISTRAL_MODEL: z.string().default('mistral-medium-latest'),
  MISTRAL_REASONING_MODEL: z.string().default('magistral-medium-latest'),
  MISTRAL_TTS_MODEL: z.string().default('voxtral-tts-latest'),
  MISTRAL_MAX_TOKENS: z.coerce.number().int().default(16384),
  MISTRAL_TEMPERATURE: z.coerce.number().min(0).max(2).default(0.7),
  MISTRAL_TOP_P: z.coerce.number().min(0).max(1).default(0.95),
  MISTRAL_TIMEOUT: z.coerce.number().int().default(60000),
  MISTRAL_RETRY_ATTEMPTS: z.coerce.number().int().default(3),
  MISTRAL_RETRY_DELAY: z.coerce.number().int().default(1000),

  // STT — Gladia (EU, Paris)
  GLADIA_API_KEY: z.string().optional(),

  // RAG — Qdrant Cloud + BGE-M3 embeddings via ai-service
  QDRANT_URL: z.string().optional(),
  QDRANT_API_KEY: z.string().optional(),
  QDRANT_COLLECTION: z.string().default('tomai_educational'),
  QDRANT_ENABLED: z.enum(['true', 'false']).default('false'),

  // AI Service (Python FastAPI, Koyeb fra) — embeddings + reranking
  AI_SERVICE_URL: z.string().optional(),
  AI_SERVICE_TOKEN: z.string().optional(),
  AI_SERVICE_TIMEOUT_MS: z.coerce.number().int().default(15000),

  // Rate limiting
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().default(900000), // 15 min
  RATE_LIMIT_MAX_REQUESTS_API: z.coerce.number().int().default(100),
  RATE_LIMIT_MAX_REQUESTS_CHAT: z.coerce.number().int().default(10),

  // Currency conversion
  USD_TO_EUR_RATE: z.coerce.number().positive().default(0.92),

  // Feature flags
  QUOTA_ENFORCEMENT_ENABLED: z.enum(['true', 'false']).default('true').transform(val => val === 'true'),

  // Observability
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  DEBUG: z.string().optional(),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().optional(),

  // Logging/Monitoring (optional)
  SENTRY_DSN: z.string().optional(),
  POSTHOG_API_KEY: z.string().optional(),
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

  // Validate production-specific requirements
  if (isProd) {
    const prodChecks: string[] = [];

    if (!result.data.REVENUECAT_WEBHOOK_AUTH) {
      prodChecks.push('REVENUECAT_WEBHOOK_AUTH is required (production)');
    }

    if (!result.data.PRONOTE_ENCRYPTION_KEY) {
      prodChecks.push('PRONOTE_ENCRYPTION_KEY is required (production)');
    }

    if (prodChecks.length > 0) {
      throw new Error(`Production validation failed:\n  ${prodChecks.join('\n  ')}`);
    }
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
 * - Dev: adds localhost:3000/3001/3002
 * Single source of truth for HTTP origins — no mobile schemes here
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
    origins.add('http://localhost:3001'); // landing
    origins.add('http://localhost:3002'); // web app
  }

  return Array.from(origins);
}

/**
 * Build trusted origins for Better Auth
 * Composes CORS origins + adds mobile deep link schemes (tomia://, exp:// in dev)
 */
export function getTrustedOrigins(): string[] {
  const origins = new Set<string>();

  // Start with HTTP origins from getCorsOrigins()
  getCorsOrigins().forEach(o => origins.add(o));

  // Add tomia:// (mobile deep link, always present)
  origins.add('tomia://');

  // Add exp:// only in development (Expo dev client)
  if (isDevelopment()) {
    origins.add('exp://');
  }

  return Array.from(origins);
}
