/**
 * Détection partagée des credentials pour les tests `live` (services réels).
 * Mutualise le guard fail-closed — chaque suite asserte la présence via un
 * `it(...)`, jamais de skip silencieux.
 */
import { env } from '../config/env';

/** Vraie clé Mistral (≠ 'test-key' injectée par les tests unitaires mockés). */
export const HAS_MISTRAL =
  !!env.MISTRAL_API_KEY && env.MISTRAL_API_KEY !== 'test-key';
