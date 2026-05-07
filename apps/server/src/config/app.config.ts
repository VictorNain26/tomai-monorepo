/**
 * Configuration centralisée de l'application TomAI
 * Centralise toutes les constantes et configurations pour éviter les magic numbers
 */

import { logger } from '../lib/observability.js';

export interface AppConfig {
  server: {
    port: number;
    host: string;
    nodeEnv: string;
  };
  security: {
    corsOrigins: (string | RegExp)[];
    betterAuthSecret: string;
    betterAuthUrl: string;
  };
  database: {
    url: string | undefined;
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
    maxConnections: number;
    idleTimeoutMs: number;
    connectionTimeoutMs: number;
  };
  ai: {
    mistral?: {
      apiKey: string | undefined;
      /** Primary chat model (Mistral Small 4 by default, fluent FR + native vision + reasoning toggle). */
      chatModel: string;
      /** High-intelligence reasoning model for hard problems / Terminale spé. */
      reasoningModel: string;
      /** Auxiliary model for short tasks (intent classification, auto-title) — same as chatModel by default. */
      auxModel: string;
      /** Voxtral STT model for audio transcription (élève parle à Tom). */
      transcribeModel: string;
      /** Voxtral TTS model for synthesizing Tom's spoken responses. */
      ttsModel: string;
      temperature: number;
      maxTokens: number;
      requestTimeout: number;
    };
  };
  rateLimit: {
    windowMs: number;
    maxRequestsApi: number;
    maxRequestsChat: number;
  };
  usage: {
    dailyMessageLimit: number;
    tokenCostPerMessage: number;
    warningThreshold: number;
  };
  features: {
    /**
     * When true (default), checkQuota/checkDeckQuota evaluate real per-user
     * counters and can return `allowed: false`. Set QUOTA_ENFORCEMENT_ENABLED=false
     * to disable enforcement (for incidents or rollouts). Counters are still
     * written to DB in both modes so usage data remains available.
     */
    quotaEnforcementEnabled: boolean;
  };
  cache: {
    ttlMs: number;
    maxSize: number;
  };
  rag: {
    // Similarity thresholds (optimisés avec normalisation embeddings 2025-10-05)
    minSimilarity: number;              // Seuil minimum (0.65 optimal après normalisation)
    highSimilarity: number;             // Seuil haute confiance (0.80+)
    veryHighSimilarity: number;         // Seuil très haute confiance (0.90+)

    // Search parameters
    defaultLimit: number;               // Nombre de chunks par défaut
    maxLimit: number;                   // Limite maximum de chunks
    contextMaxLength: number;           // Longueur max contexte RAG (tokens)

    // Cache configuration
    cacheTtlSeconds: number;            // TTL cache (secondes)

    // Hybrid search configuration (BM25 + Semantic)
    hybridSearch: {
      enabled: boolean;                 // Activer hybrid search
      semanticWeight: number;           // Poids semantic search (0-1)
      keywordWeight: number;            // Poids keyword search (0-1)
      rrfConstant: number;              // Constante RRF (Reciprocal Rank Fusion)
      minKeywordMatches: number;        // Minimum de matches keyword pour fusion
    };

    // Query expansion (HyDE)
    queryExpansion: {
      enabled: boolean;                 // Activer query expansion
      minResultsThreshold: number;      // Seuil min résultats avant expansion
      minSimilarityThreshold: number;   // Seuil min similarité avant expansion
    };
  };
  qdrant: {
    url: string;
    apiKey: string;
    collectionName: string;
    enabled: boolean;
  };
}

/**
 * Valide la configuration requise au démarrage
 * Note: Better Auth gère ses propres variables d'environnement directement
 */
function validateRequiredConfig(): void {
  // Better Auth gère BETTER_AUTH_SECRET automatiquement
  // Pas besoin de validation ici

  // Mistral est désormais le provider AI principal (souveraineté EU).
  // En prod on fail-fast sans MISTRAL_API_KEY ; en dev/staging on warn.
  if (Bun.env['NODE_ENV'] !== 'test') {
    const hasMistral = Boolean(Bun.env['MISTRAL_API_KEY']);
    if (!hasMistral) {
      const missing = { operation: 'config:validate', missing: 'MISTRAL_API_KEY' };
      if (Bun.env['NODE_ENV'] === 'production') {
        throw new Error('MISTRAL_API_KEY is required in production');
      }
      logger.warn('Clé API Mistral requise - chat / classifier / summarization seront indisponibles', missing);
    }
  }
}

function createServerConfig(): { port: number; host: string; nodeEnv: string } {
  return {
    port: parseInt(Bun.env['PORT'] ?? '3000', 10),
    host: '0.0.0.0', // Pour Docker
    nodeEnv: Bun.env['NODE_ENV'] ?? 'development',
  };
}

function createSecurityConfig(): AppConfig['security'] {
  // Configuration CORS basée sur les variables d'environnement
  function getCorsOrigins(): string[] {
    const origins: string[] = [];
    
    // Ajouter FRONTEND_URL si défini
    if (Bun.env['FRONTEND_URL']) {
      origins.push(Bun.env['FRONTEND_URL']);
    }
    
    // Ajouter BETTER_AUTH_URL si défini
    if (Bun.env['BETTER_AUTH_URL']) {
      origins.push(Bun.env['BETTER_AUTH_URL']);
    }
    
    // Ajouter CORS_ORIGINS si défini
    if (Bun.env['CORS_ORIGINS']) {
      const corsOrigins = Bun.env['CORS_ORIGINS'].split(',').map(origin => origin.trim());
      origins.push(...corsOrigins);
    }
    
    // Origins de développement par défaut
    if (Bun.env['NODE_ENV'] === 'development') {
      origins.push(
        'http://localhost:3000',
        'http://localhost:3001'
      );
    }
    
    // Déduplication et filtrage
    return Array.from(new Set(origins)).filter(Boolean);
  }
  
  const corsOrigins = getCorsOrigins();

  return {
    corsOrigins,
    betterAuthSecret: Bun.env['BETTER_AUTH_SECRET'] ?? (() => {
      if (Bun.env['NODE_ENV'] === 'production') {
        throw new Error('BETTER_AUTH_SECRET is required in production');
      }
      return 'dev-secret-key-local-development-only';
    })(),
    betterAuthUrl: Bun.env['BETTER_AUTH_URL'] ?? 'http://localhost:3000'
  };
}

function createDatabaseConfig(): AppConfig['database'] {
  return {
    url: Bun.env['DATABASE_URL'],
    host: Bun.env['DB_HOST'] ?? 'localhost',
    port: parseInt(Bun.env['DB_PORT'] ?? '5432', 10),
    database: Bun.env['DB_NAME'] ?? 'tomai_dev',
    user: Bun.env['DB_USER'] ?? 'tomai',
    password: Bun.env['DB_PASSWORD'] ?? 'tomai_dev_password',
    maxConnections: 20,
    idleTimeoutMs: 30000,
    connectionTimeoutMs: 2000,
  };
}

function createAiConfig(): AppConfig['ai'] {
  return {
    // Mistral AI — sole AI provider (chat + embeddings + reasoning + STT + TTS + OCR).
    // EU-sovereign by default: Mistral Compute infra, GDPR / AI Act compliance native.
    mistral: Bun.env['MISTRAL_API_KEY'] ? {
      apiKey: Bun.env['MISTRAL_API_KEY'],
      chatModel: Bun.env['MISTRAL_CHAT_MODEL'] ?? 'mistral-small-latest',
      reasoningModel: Bun.env['MISTRAL_REASONING_MODEL'] ?? 'magistral-medium-latest',
      auxModel: Bun.env['MISTRAL_AUX_MODEL'] ?? 'mistral-small-latest',
      // Voxtral Mini Transcribe V2 (alias `voxtral-mini-transcribe-latest`,
      // version datée `voxtral-mini-transcribe-2602`). Diarisation, word
      // timestamps, 13 langues (FR inclus), audios jusqu'à 3h.
      transcribeModel: Bun.env['MISTRAL_TRANSCRIBE_MODEL'] ?? 'voxtral-mini-transcribe-latest',
      // Voxtral TTS (alias `voxtral-tts-latest`, version datée `voxtral-tts-2603`).
      // Voice cloning depuis sample audio — pas de voix pré-définies. Voir
      // `scripts/voxtral-create-voices.ts` pour créer les 3 voix maîtres.
      ttsModel: Bun.env['MISTRAL_TTS_MODEL'] ?? 'voxtral-tts-latest',
      temperature: parseFloat(Bun.env['MISTRAL_TEMPERATURE'] ?? '0.7'),
      maxTokens: parseInt(Bun.env['MISTRAL_MAX_TOKENS'] ?? '16384', 10),
      requestTimeout: parseInt(Bun.env['MISTRAL_TIMEOUT'] ?? '60000', 10),
    } : undefined,
  };
}

function createUsageConfig(): AppConfig['usage'] {
  return {
    dailyMessageLimit: 100,
    tokenCostPerMessage: 0.0000001,
    warningThreshold: 0.8, // 80% de la limite
  };
}

function createCacheConfig(): AppConfig['cache'] {
  return {
    ttlMs: 3600000, // 1 heure
    maxSize: 1000,
  };
}

function createRagConfig(): AppConfig['rag'] {
  return {
    // Similarity thresholds (optimisés avec normalisation embeddings 2025-10-05)
    // Après normalisation: vectors magnitude = 1.0 → similarité 0.94+ pour très similaire
    minSimilarity: parseFloat(Bun.env['RAG_MIN_SIMILARITY'] ?? '0.65'),         // Optimal après normalisation
    highSimilarity: parseFloat(Bun.env['RAG_HIGH_SIMILARITY'] ?? '0.80'),       // Haute confiance
    veryHighSimilarity: parseFloat(Bun.env['RAG_VERY_HIGH_SIMILARITY'] ?? '0.90'), // Très haute confiance

    // Search parameters
    defaultLimit: parseInt(Bun.env['RAG_DEFAULT_LIMIT'] ?? '3', 10), // Optimisé: 5→3 (-40% tokens)
    maxLimit: parseInt(Bun.env['RAG_MAX_LIMIT'] ?? '10', 10), // Réduit de 20→10
    contextMaxLength: parseInt(Bun.env['RAG_CONTEXT_MAX_LENGTH'] ?? '4000', 10), // Optimisé: 6000→4000 (~1000 mots)

    // Cache configuration
    cacheTtlSeconds: parseInt(Bun.env['RAG_CACHE_TTL_SECONDS'] ?? '3600', 10), // 1 heure

    // Hybrid search configuration (BM25 + Semantic) - 2025 best practices
    hybridSearch: {
      enabled: Bun.env['RAG_HYBRID_SEARCH_ENABLED'] !== 'false',                // Activé par défaut
      semanticWeight: parseFloat(Bun.env['RAG_SEMANTIC_WEIGHT'] ?? '0.7'),      // Semantic prioritaire
      keywordWeight: parseFloat(Bun.env['RAG_KEYWORD_WEIGHT'] ?? '0.3'),        // Keyword complémentaire
      rrfConstant: parseFloat(Bun.env['RAG_RRF_CONSTANT'] ?? '60'),             // Constante RRF standard
      minKeywordMatches: parseInt(Bun.env['RAG_MIN_KEYWORD_MATCHES'] ?? '1', 10), // Au moins 1 match
    },

    // Query expansion (HyDE) - Désactivé par défaut (coût LLM)
    queryExpansion: {
      enabled: Bun.env['RAG_QUERY_EXPANSION_ENABLED'] === 'true',               // Opt-in
      minResultsThreshold: parseInt(Bun.env['RAG_EXPANSION_MIN_RESULTS'] ?? '3', 10), // Trigger si <3 résultats
      minSimilarityThreshold: parseFloat(Bun.env['RAG_EXPANSION_MIN_SIMILARITY'] ?? '0.65'), // Trigger si <0.65
    },
  };
}

function createQdrantConfig(): AppConfig['qdrant'] {
  return {
    url: Bun.env['QDRANT_URL'] ?? '',
    apiKey: Bun.env['QDRANT_API_KEY'] ?? '',
    collectionName: Bun.env['QDRANT_COLLECTION_NAME'] ?? 'tomai_educational',
    enabled: Bun.env['QDRANT_ENABLED'] === 'true',
  };
}

/**
 * Configuration centralisée de l'application
 */
export function createAppConfig(): AppConfig {
  validateRequiredConfig();

  return {
    server: createServerConfig(),
    security: createSecurityConfig(),
    database: createDatabaseConfig(),
    ai: createAiConfig(),
    rateLimit: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequestsApi: Bun.env['NODE_ENV'] === 'development' ? 5000 : 100,
      maxRequestsChat: Bun.env['NODE_ENV'] === 'development' ? 500 : 10,
    },
    usage: createUsageConfig(),
    features: {
      // Opt-out: set QUOTA_ENFORCEMENT_ENABLED=false to disable. Any other value
      // (unset, "true", anything) enables enforcement.
      quotaEnforcementEnabled: Bun.env['QUOTA_ENFORCEMENT_ENABLED'] !== 'false',
    },
    cache: createCacheConfig(),
    rag: createRagConfig(),
    qdrant: createQdrantConfig(),
  };
}

// Export de la configuration singleton
export const appConfig = createAppConfig();