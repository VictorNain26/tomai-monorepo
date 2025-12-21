/**
 * Service de construction de prompts - Architecture Meta-Planning
 *
 * Phase 2 de la génération : Construit le prompt pour générer
 * les cartes selon le plan créé en Phase 1.
 *
 * L'IA suit son propre plan (DeckPlan) pour créer les cartes.
 */

import type { DeckPlan } from '../../lib/ai/schemas/deck-planner.schema.js';
import type { CardGenerationParams } from './types.js';
import {
  subjectRequiresKaTeX,
  KATEX_INSTRUCTIONS,
  RICH_CONTENT_INSTRUCTIONS
} from './prompts/index.js';

// ============================================================================
// TYPES
// ============================================================================

export interface BuiltPrompt {
  /** Prompt système complet */
  systemPrompt: string;
  /** Prompt utilisateur avec le plan à suivre */
  userPrompt: string;
}

// ============================================================================
// PROMPT EXÉCUTION (Phase 2)
// ============================================================================

/**
 * Construit le prompt pour générer les cartes selon le plan
 */
export function buildCardExecutionPrompt(
  params: CardGenerationParams,
  plan: DeckPlan
): BuiltPrompt {
  const { topic, subject, level, ragContext } = params;
  const requiresKaTeX = subjectRequiresKaTeX(subject);

  // System prompt simplifié - l'IA suit le plan
  const systemParts: string[] = [];

  systemParts.push(`Tu es un expert pédagogue français.
Tu génères des cartes de révision en suivant EXACTEMENT le plan fourni.
Chaque carte doit correspondre à une entrée du plan.

**IMPORTANT : Contenu enrichi**
Utilise des tableaux et diagrammes Mermaid quand c'est pertinent pour :
- Clarifier les explications complexes
- Illustrer des processus ou des étapes
- Comparer des éléments
- Rendre le contenu plus visuel et mémorable`);

  // Format JSON
  systemParts.push(CARD_FORMAT_INSTRUCTIONS);

  // Contenu enrichi (tableaux, Mermaid)
  systemParts.push(RICH_CONTENT_INSTRUCTIONS);

  // KaTeX si nécessaire
  if (requiresKaTeX) {
    systemParts.push(KATEX_INSTRUCTIONS);
  }

  const systemPrompt = systemParts.join('\n\n');

  // User prompt avec le plan à suivre
  const userPrompt = buildExecutionUserPrompt(topic, subject, level, plan, ragContext);

  return { systemPrompt, userPrompt };
}

// ============================================================================
// FORMAT JSON
// ============================================================================

const CARD_FORMAT_INSTRUCTIONS = `## FORMAT DE SORTIE

Retourne UNIQUEMENT un tableau JSON valide de cartes :

[
  {"cardType": "concept", "content": {...}},
  {"cardType": "qcm", "content": {...}},
  ...
]

**Types de cartes :**
- concept: {title, explanation, keyPoints[], example?, formula?}
- flashcard: {front, back}
- qcm: {question, options[], correctIndex, explanation}
- vrai_faux: {statement, isTrue, explanation}
- matching: {instruction, pairs[{left, right}]}
- fill_blank: {sentence, options[], correctIndex, grammaticalPoint?, explanation}
- word_order: {instruction, words[], correctSentence, translation?}
- calculation: {problem, steps[], answer, hint?}
- timeline: {instruction, events[{event, date?, hint?}], correctOrder[]}
- matching_era: {instruction, items[], eras[], correctPairs[]}
- cause_effect: {context, cause, possibleEffects[], correctIndex, explanation}
- classification: {instruction, items[], categories[], correctClassification{}, explanation?}
- process_order: {instruction, processName, steps[], correctOrder[], explanation?}
- grammar_transform: {instruction, originalSentence, transformationType, correctAnswer, acceptableVariants?, explanation}

**Contenu enrichi :** Utilise tableaux Markdown, listes, et formules KaTeX quand pertinent.

**Règles JSON :**
- Pas de texte avant/après le JSON
- Guillemets doubles pour strings
- KaTeX: double backslash (\\\\pi pour π)`;

// ============================================================================
// USER PROMPT
// ============================================================================

function buildExecutionUserPrompt(
  topic: string,
  subject: string,
  level: string,
  plan: DeckPlan,
  ragContext?: string
): string {
  const lines: string[] = [];

  lines.push('## CONTEXTE\n');
  lines.push(`**Matière :** ${subject}`);
  lines.push(`**Niveau :** ${level}`);
  lines.push(`**Sujet :** ${topic}`);

  // Programme officiel si disponible
  if (ragContext?.trim()) {
    lines.push('\n## PROGRAMME OFFICIEL\n');
    lines.push(ragContext);
  }

  // Plan à suivre
  lines.push('\n## PLAN À SUIVRE\n');
  lines.push(`**Titre du deck :** ${plan.deckTitle}`);
  lines.push(`**Progression :** ${plan.difficultyProgression}`);
  lines.push(`**Justification :** ${plan.rationale}`);

  lines.push('\n**Notions et cartes à générer :**\n');

  for (const notion of plan.notions) {
    lines.push(`### ${notion.notionTitle}`);
    for (const card of notion.cards) {
      lines.push(`- **${card.cardType}** (${card.difficulty}): ${card.purpose}`);
      lines.push(`  Notion: ${card.notionCovered}`);
    }
    lines.push('');
  }

  lines.push(`\n## GÉNÈRE MAINTENANT LES ${plan.totalCards} CARTES EN JSON`);
  lines.push('Suis EXACTEMENT le plan ci-dessus. Une carte par entrée du plan.');

  return lines.join('\n');
}

// ============================================================================
// UTILITAIRES
// ============================================================================

/**
 * Estime le nombre de tokens du prompt
 */
export function estimatePromptTokens(prompt: BuiltPrompt): number {
  const totalChars = prompt.systemPrompt.length + prompt.userPrompt.length;
  return Math.ceil(totalChars / 4);
}
