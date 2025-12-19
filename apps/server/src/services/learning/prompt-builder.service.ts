/**
 * Service de construction de prompts pour la génération de cartes
 *
 * Assemble les différentes parties du prompt de manière modulaire :
 * - Base (format JSON, règles de concision)
 * - Matière (instructions spécifiques, KaTeX si nécessaire)
 * - Cycle scolaire (adaptation au niveau de l'élève)
 * - Contexte RAG (programme officiel)
 */

import type { CardGenerationParams } from './types.js';
import {
  getBasePrompt,
  getSubjectInstructions,
  subjectRequiresKaTeX,
  getEducationCycle,
  getCycleAdaptationInstructions,
  getRecommendedCardTypes
} from './prompts/index.js';

export interface BuiltPrompt {
  /** Prompt système complet */
  systemPrompt: string;
  /** Prompt utilisateur avec le contexte spécifique */
  userPrompt: string;
  /** Métadonnées pour le parsing */
  metadata: {
    expectedCardCount: number;
    requiresKaTeX: boolean;
  };
}

/**
 * Construit le prompt complet pour la génération de cartes
 */
export function buildCardGenerationPrompt(params: CardGenerationParams): BuiltPrompt {
  const {
    topic,
    subject,
    level,
    ragContext,
    cardCount
  } = params;

  // 1. Récupérer la config de la matière
  const requiresKaTeX = subjectRequiresKaTeX(subject);
  const cardTypes = getRecommendedCardTypes(subject);

  // 2. Déterminer le cycle scolaire
  const cycle = getEducationCycle(level);

  // 3. Construire le prompt système
  const systemParts: string[] = [];

  // Base : format JSON, règles de concision, diversité
  systemParts.push(getBasePrompt({
    cardTypes,
    requiresKaTeX
  }));

  // Instructions spécifiques à la matière
  systemParts.push(getSubjectInstructions(subject));

  // Adaptation au cycle scolaire
  systemParts.push(getCycleAdaptationInstructions(cycle));

  const systemPrompt = systemParts.join('\n\n---\n\n');

  // 4. Construire le prompt utilisateur
  const userPrompt = buildUserPrompt({
    topic,
    subject,
    level,
    ragContext,
    cardCount,
    domaine: params.domaine
  });

  return {
    systemPrompt,
    userPrompt,
    metadata: {
      expectedCardCount: cardCount,
      requiresKaTeX
    }
  };
}

/**
 * Construit le prompt utilisateur avec le contexte spécifique
 */
function buildUserPrompt(params: {
  topic: string;
  subject: string;
  level: string;
  ragContext: string;
  cardCount: number;
  domaine?: string;
}): string {
  const {
    topic,
    subject,
    level,
    ragContext,
    cardCount,
    domaine
  } = params;

  const lines: string[] = [];

  lines.push(`## DEMANDE DE GÉNÉRATION\n`);
  lines.push(`**Matière :** ${subject}`);
  lines.push(`**Niveau :** ${level}`);
  if (domaine) {
    lines.push(`**Domaine :** ${domaine}`);
  }
  lines.push(`**Sous-chapitre :** ${topic}`);
  lines.push(`**Nombre de cartes :** ${cardCount}`);
  lines.push(`\n**Objectif :** Couvrir EXHAUSTIVEMENT toutes les notions du sous-chapitre "${topic}" pour une révision complète.`);

  // Contexte RAG (programme officiel)
  if (ragContext && ragContext.trim().length > 0) {
    lines.push(`\n## PROGRAMME OFFICIEL (contexte)\n`);
    lines.push(ragContext);
    lines.push(`\n**Note :** Utilise ce contexte comme base mais crée tes propres exemples et formulations.`);
  } else {
    lines.push(`\n**Note :** Aucun contexte RAG fourni. Génère des cartes basées sur le programme officiel français pour ce niveau.`);
  }

  lines.push(`\n## GÉNÈRE MAINTENANT LES ${cardCount} CARTES EN JSON`);

  return lines.join('\n');
}

/**
 * Estime le nombre de tokens du prompt
 * (approximation : 1 token ≈ 4 caractères en français)
 */
export function estimatePromptTokens(prompt: BuiltPrompt): number {
  const totalChars = prompt.systemPrompt.length + prompt.userPrompt.length;
  return Math.ceil(totalChars / 4);
}
