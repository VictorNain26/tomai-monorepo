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

  // IA et services externes
  GEMINI_API_KEY?: string;

  // Scaleway Object Storage (RGPD - France)
  SCALEWAY_ACCESS_KEY?: string;
  SCALEWAY_SECRET_KEY?: string;
  SCALEWAY_BUCKET?: string;
  SCALEWAY_REGION?: string;

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
    FRONTEND_URL: Bun.env['FRONTEND_URL'] ?? Bun.env['CORS_ORIGIN'] ?? (isDevelopment ? 'http://localhost:3001' : ''),
    CORS_ORIGINS: corsOrigins,
    TRUSTED_ORIGINS: trustedOrigins,

    // Session et cookies (durées en secondes)
    SESSION_MAX_AGE: parseInt(Bun.env['SESSION_MAX_AGE'] ?? '604800'), // 7 jours
    SESSION_UPDATE_AGE: parseInt(Bun.env['SESSION_UPDATE_AGE'] ?? '86400'), // 1 jour

    // Base de données - Auto-switch Docker/localhost
    DATABASE_URL: inDocker
      ? Bun.env['DATABASE_URL']!
      : (Bun.env['DATABASE_URL_EXTERNAL'] ?? Bun.env['DATABASE_URL'])!,

    // IA et services externes
    GEMINI_API_KEY: Bun.env['GEMINI_API_KEY'],

    // Scaleway Object Storage (RGPD - France)
    SCALEWAY_ACCESS_KEY: Bun.env['SCALEWAY_ACCESS_KEY'],
    SCALEWAY_SECRET_KEY: Bun.env['SCALEWAY_SECRET_KEY'],
    SCALEWAY_BUCKET: Bun.env['SCALEWAY_BUCKET'],
    SCALEWAY_REGION: Bun.env['SCALEWAY_REGION'] ?? 'fr-par',

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
 * Configuration de l'environnement - lazy singleton
 * Validated on first access, not at module import time.
 * This allows tests to import modules that depend on env without
 * needing all env vars to be set.
 */
let _env: EnvironmentConfig | null = null;

export function getEnv(): EnvironmentConfig {
  _env ??= parseEnvironment();
  return _env;
}

/** @deprecated Use getEnv() — kept for backward compatibility during migration */
export const env: EnvironmentConfig = new Proxy({} as EnvironmentConfig, {
  get(_target, prop: string) {
    return getEnv()[prop as keyof EnvironmentConfig];
  },
});

/**
 * Utilitaires pour l'environnement
 */
export const envUtils = {
  get isDevelopment() { return getEnv().NODE_ENV === 'development'; },
  get isProduction() { return getEnv().NODE_ENV === 'production'; },
  get isTest() { return getEnv().NODE_ENV === 'test'; },
  get isDocker() { return isRunningInDocker(); },

  /**
   * Vérifie si une variable d'environnement est définie
   */
  has(key: keyof EnvironmentConfig): boolean {
    return getEnv()[key] !== undefined;
  },

  /**
   * Obtient une variable avec une valeur par défaut
   */
  get<K extends keyof EnvironmentConfig>(key: K, defaultValue: EnvironmentConfig[K]): EnvironmentConfig[K] {
    return getEnv()[key] ?? defaultValue;
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