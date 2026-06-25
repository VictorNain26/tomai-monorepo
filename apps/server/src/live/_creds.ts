/**
 * Détection partagée des credentials/services pour les tests `live` (services
 * réels : Qdrant Cloud, ai-service, Mistral). Mutualise le guard fail-closed —
 * chaque suite asserte la présence via un `it(...)`, jamais de skip silencieux.
 */
import { env } from '../config/env';
import { qdrantService } from '../services/qdrant.service';
import { aiServiceClient } from '../services/ai-service.client';

/** Vraie clé Mistral (≠ 'test-key' injectée par les tests unitaires mockés). */
export const HAS_MISTRAL =
  !!env.MISTRAL_API_KEY && env.MISTRAL_API_KEY !== 'test-key';

/** Vars RAG configurées (Qdrant Cloud + ai-service). */
export const RAG_VARS_PRESENT = Boolean(
  process.env.QDRANT_URL && process.env.QDRANT_API_KEY && process.env.AI_SERVICE_URL,
);

/**
 * Ping réel : Qdrant + ai-service joignables. Évite les timeouts si la stack est
 * configurée mais pas démarrée. Coûteux (réseau) → à appeler une fois par suite.
 */
export async function ragReachable(): Promise<boolean> {
  if (!RAG_VARS_PRESENT) return false;
  const [qdrantOk, aiOk] = await Promise.all([
    qdrantService.isAvailable().catch(() => false),
    aiServiceClient.isAvailable().catch(() => false),
  ]);
  return qdrantOk && aiOk;
}
