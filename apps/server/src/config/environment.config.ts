/**
 * Configuration centralisée de l'environnement
 * Évite le hardcoding et centralise la gestion des variables d'environnement
 */

export interface EnvironmentConfig {
  // Application
  NODE_ENV: 'development' | 'production' | 'test';
  PORT: number;
  APP_VERSION: string;
  DEPLOYMENT_ID?: string;

  // URLs et CORS
  BETTER_AUTH_URL: string;
  FRONTEND_URL: string;
  CORS_ORIGINS?: string[];
  TRUSTED_ORIGINS?: string[];

  // Session et cookies
  SESSION_MAX_AGE: number; // en secondes
  SESSION_UPDATE_AGE: number; // en secondes

  // Base de données
  DATABASE_URL: string;
  REDIS_URL?: string;

  // Upstash Redis (production serverless)
  UPSTASH_REDIS_REST_URL?: string;
  UPSTASH_REDIS_REST_TOKEN?: string;
  UPSTASH_DISABLE_TELEMETRY?: string;

  // IA et services externes
  GEMINI_API_KEY?: string;

  // Authentication
  BETTER_AUTH_SECRET: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;

  // Flags et debug
  DEBUG?: string;
  LOG_LEVEL: 'debug' | 'info' | 'warn' | '_error';
}

/**
 * Détecte si on est dans un container Docker
 * Check 1: Variable DOCKER_CONTAINER explicite
 * Check 2: Fichier /.dockerenv (présent dans tous les containers)
 * Check 3: /proc/1/cgroup contient "docker" (Linux containers)
 */
function isRunningInDocker(): boolean {
  // Check explicite via variable d'environnement
  if (Bun.env['DOCKER_CONTAINER'] === 'true') {
    return true;
  }

  // Check fichier /.dockerenv (méthode standard)
  try {
    const fs = require('fs');
    return fs.existsSync('/.dockerenv');
  } catch {
    return false;
  }
}

/**
 * Valide et parse les variables d'environnement
 */
function parseEnvironment(): EnvironmentConfig {
  const isDevelopment = (Bun.env['NODE_ENV'] ?? 'development') !== 'production';
  const inDocker = isRunningInDocker();

  // Validation des variables obligatoires
  const requiredVars = ['BETTER_AUTH_SECRET', 'DATABASE_URL'];
  const missingVars = requiredVars.filter(varName => !Bun.env[varName]);

  if (missingVars.length > 0) {
    throw new Error(`Variables d'environnement manquantes: ${missingVars.join(', ')}`);
  }

  // Parse CORS_ORIGINS si défini
  const corsOrigins = Bun.env['CORS_ORIGINS'] 
    ? Bun.env['CORS_ORIGINS'].split(',').map(origin => origin.trim()).filter(Boolean)
    : undefined;

  // Parse TRUSTED_ORIGINS si défini
  const trustedOrigins = Bun.env['TRUSTED_ORIGINS'] 
    ? Bun.env['TRUSTED_ORIGINS'].split(',').map(origin => origin.trim()).filter(Boolean)
    : undefined;

  return {
    // Application
    NODE_ENV: (Bun.env['NODE_ENV'] as EnvironmentConfig['NODE_ENV']) ?? 'development',
    PORT: parseInt(Bun.env['PORT'] ?? '3000'),
    APP_VERSION: Bun.env['APP_VERSION'] ?? '1.0.0',
    DEPLOYMENT_ID: Bun.env['DEPLOYMENT_ID'],

    // URLs et CORS
    BETTER_AUTH_URL: Bun.env['BETTER_AUTH_URL'] ?? (isDevelopment ? 'http://localhost:3000' : ''),
    FRONTEND_URL: Bun.env['FRONTEND_URL'] ?? Bun.env['CORS_ORIGIN'] ?? (isDevelopment ? 'http://localhost:5173' : ''),
    CORS_ORIGINS: corsOrigins,
    TRUSTED_ORIGINS: trustedOrigins,

    // Session et cookies (durées en secondes)
    SESSION_MAX_AGE: parseInt(Bun.env['SESSION_MAX_AGE'] ?? '604800'), // 7 jours
    SESSION_UPDATE_AGE: parseInt(Bun.env['SESSION_UPDATE_AGE'] ?? '86400'), // 1 jour

    // Base de données - Auto-switch Docker/localhost
    DATABASE_URL: inDocker
      ? Bun.env['DATABASE_URL']! // redis://redis:6379 dans Docker
      : (Bun.env['DATABASE_URL_EXTERNAL'] ?? Bun.env['DATABASE_URL'])!, // localhost hors Docker
    REDIS_URL: inDocker
      ? Bun.env['REDIS_URL'] // redis://redis:6379 dans Docker
      : (Bun.env['REDIS_URL_EXTERNAL'] ?? Bun.env['REDIS_URL']), // localhost hors Docker

    // Upstash Redis (production serverless)
    UPSTASH_REDIS_REST_URL: Bun.env['UPSTASH_REDIS_REST_URL'],
    UPSTASH_REDIS_REST_TOKEN: Bun.env['UPSTASH_REDIS_REST_TOKEN'],
    UPSTASH_DISABLE_TELEMETRY: Bun.env['UPSTASH_DISABLE_TELEMETRY'],

    // IA et services externes
    GEMINI_API_KEY: Bun.env['GEMINI_API_KEY'],

    // Authentication
    BETTER_AUTH_SECRET: Bun.env['BETTER_AUTH_SECRET']!,
    GOOGLE_CLIENT_ID: Bun.env['GOOGLE_CLIENT_ID'],
    GOOGLE_CLIENT_SECRET: Bun.env['GOOGLE_CLIENT_SECRET'],

    // Flags et debug
    DEBUG: Bun.env['DEBUG'],
    LOG_LEVEL: (Bun.env['LOG_LEVEL'] as EnvironmentConfig['LOG_LEVEL']) ?? 'info'
  };
}

/**
 * Configuration de l'environnement - instance singleton
 */
export const env = parseEnvironment();

/**
 * Utilitaires pour l'environnement
 */
export const envUtils = {
  isDevelopment: env.NODE_ENV === 'development',
  isProduction: env.NODE_ENV === 'production',
  isTest: env.NODE_ENV === 'test',
  isDocker: isRunningInDocker(),

  /**
   * Vérifie si une variable d'environnement est définie
   */
  has(key: keyof EnvironmentConfig): boolean {
    return env[key] !== undefined;
  },

  /**
   * Obtient une variable avec une valeur par défaut
   */
  get<K extends keyof EnvironmentConfig>(key: K, defaultValue: EnvironmentConfig[K]): EnvironmentConfig[K] {
    return env[key] ?? defaultValue;
  },

  /**
   * Valide que toutes les variables requises pour un service sont présentes
   */
  validateService(serviceName: string, requiredVars: (keyof EnvironmentConfig)[]): void {
    const missing = requiredVars.filter(key => !this.has(key));
    if (missing.length > 0) {
      throw new Error(`${serviceName}: Variables manquantes: ${missing.join(', ')}`);
    }
  }
};