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
    gemini: {
      apiKey: string | undefined;
      model: string;           // Modèle principal (chat) - Gemini 2.5 Flash
      audioModel: string;      // Modèle audio (analyse prononciation) - Gemini 2.5 Flash
      ttsModel: string;        // Modèle TTS - Gemini 2.5 Flash TTS
      maxTokens: number;
      temperature: number;
      topP: number;
      requestTimeout: number;
      retryAttempts: number;
      retryDelay: number;
      safetySettings: 'none' | 'low' | 'medium' | 'high';
      thinkingBudget: number;
    };
    mistral?: {
      apiKey: string | undefined;
    };
    gladia?: {
      apiKey: string | undefined;
    };
    elevenlabs?: {
      apiKey: string | undefined;
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
    cacheTtlSeconds: number;            // TTL cache Redis (secondes)

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
  textToSpeech: {
    provider: 'google';
    googleCloud: {
      credentials: string | undefined;
      projectId: string;
      defaultVoice: {
        primary: { name: string; languageCode: string; };
        college: { name: string; languageCode: string; };
        lycee: { name: string; languageCode: string; };
      };
      audioConfig: {
        audioEncoding: string;
        sampleRateHertz: number;
        speakingRate: number;
        pitch: number;
        volumeGainDb: number;
      };
      enableSsml: boolean;
      requestTimeout: number;
      retryAttempts: number;
      retryDelay: number;
    };
  };
}

/**
 * Valide la configuration requise au démarrage
 * Note: Better Auth gère ses propres variables d'environnement directement
 */
function validateRequiredConfig(): void {
  // Better Auth gère BETTER_AUTH_SECRET automatiquement
  // Pas besoin de validation ici

  // Vérifier qu'au moins une clé API IA est présente (sauf en mode test)
  if (Bun.env['NODE_ENV'] !== 'test') {
    const hasGemini = Boolean(Bun.env['GEMINI_API_KEY']);

    if (!hasGemini) {
      logger.warn('Clé API Gemini requise - certaines fonctionnalités seront limitées', { operation: 'config:validate', missing: 'GEMINI_API_KEY' });
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
        'http://localhost:5173',
        'http://localhost:5175'
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
    gemini: {
      apiKey: Bun.env['GEMINI_API_KEY'],
      // Modèles spécialisés pour usage optimal
      model: Bun.env['GEMINI_MODEL'] ?? 'gemini-2.5-flash',           // Chat principal - gratuit et performant
      audioModel: Bun.env['GEMINI_AUDIO_MODEL'] ?? 'gemini-2.5-flash',    // Analyse prononciation (multimodal)
      ttsModel: Bun.env['GEMINI_TTS_MODEL'] ?? 'gemini-2.5-flash-preview-tts', // Text-to-Speech natif
      maxTokens: parseInt(Bun.env['GEMINI_MAX_TOKENS'] ?? '16384', 10), // Gemini 2.5 Flash supports 65536 max
      temperature: parseFloat(Bun.env['GEMINI_TEMPERATURE'] ?? '0.7'),    // Optimal pour éducation
      topP: parseFloat(Bun.env['GEMINI_TOP_P'] ?? '0.95'),                // Créativité contrôlée
      requestTimeout: parseInt(Bun.env['GEMINI_TIMEOUT'] ?? '60000', 10), // Timeout 60s
      retryAttempts: parseInt(Bun.env['GEMINI_RETRY_ATTEMPTS'] ?? '3', 10),
      retryDelay: parseInt(Bun.env['GEMINI_RETRY_DELAY'] ?? '1000', 10),
      safetySettings: (Bun.env['GEMINI_SAFETY'] as 'none' | 'low' | 'medium' | 'high') ?? 'medium',
      thinkingBudget: parseInt(Bun.env['GEMINI_THINKING_BUDGET'] ?? '0', 10),
    },
    // Mistral AI - Embeddings 1024D (migration Gemini → Mistral Jan 2025)
    mistral: Bun.env['MISTRAL_API_KEY'] ? {
      apiKey: Bun.env['MISTRAL_API_KEY'],
    } : undefined,
    // Gladia - Speech-to-Text (migration Gemini → Gladia Jan 2025)
    gladia: Bun.env['GLADIA_API_KEY'] ? {
      apiKey: Bun.env['GLADIA_API_KEY'],
    } : undefined,
    // ElevenLabs - Text-to-Speech (migration Gemini → ElevenLabs Jan 2025)
    elevenlabs: Bun.env['ELEVENLABS_API_KEY'] ? {
      apiKey: Bun.env['ELEVENLABS_API_KEY'],
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

function createTextToSpeechConfig(): AppConfig['textToSpeech'] {
  return {
    provider: 'google',
    googleCloud: {
      credentials: Bun.env['GOOGLE_CLOUD_CREDENTIALS'], // JSON credentials as string
      projectId: Bun.env['GOOGLE_CLOUD_PROJECT_ID'] ?? 'tomai-production',
      defaultVoice: {
        // Voix adaptées par âge - Neural2 pour qualité optimale
        primary: {
          name: 'fr-FR-Neural2-C', // Voix féminine douce pour 6-11 ans
          languageCode: 'fr-FR'
        },
        college: {
          name: 'fr-FR-Neural2-D', // Voix masculine claire pour 11-15 ans
          languageCode: 'fr-FR'
        },
        lycee: {
          name: 'fr-FR-Neural2-E', // Voix féminine professionnelle pour 15-18 ans
          languageCode: 'fr-FR'
        }
      },
      audioConfig: {
        audioEncoding: 'MP3', // Format optimal pour web
        sampleRateHertz: 24000, // Qualité haute pour éducation
        speakingRate: 0.9, // Légèrement plus lent pour compréhension
        pitch: 0.0, // Pitch neutre
        volumeGainDb: 0.0, // Volume optimal
      },
      enableSsml: true, // Support SSML pour mathématiques
      requestTimeout: 10000, // 10s timeout
      retryAttempts: 2, // Retry automatique
      retryDelay: 1000, // 1s entre retries
    }
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
    cache: createCacheConfig(),
    rag: createRagConfig(),
    textToSpeech: createTextToSpeechConfig(),
    qdrant: createQdrantConfig(),
  };
}

// Export de la configuration singleton
export const appConfig = createAppConfig();