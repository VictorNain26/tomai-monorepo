/**
 * Zod Schemas pour les 13 types de cartes learning
 *
 * Architecture TanStack AI 2025 :
 * - Structured Output natif avec Zod
 * - Validation type-safe
 * - Compatible avec generation JSON de Gemini
 *
 * @see https://tanstack.com/ai/latest/docs/guides/structured-output
 */

import { z } from 'zod';

// ═══════════════════════════════════════════════════════════════════════════
// SCHEMAS UNIVERSELS (3 types)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Flashcard classique (recto/verso)
 */
export const FlashcardContentSchema = z.object({
  front: z.string().min(1).describe('Question ou concept (recto de la carte)'),
  back: z.string().min(1).describe('Réponse ou définition (verso de la carte)')
});

/**
 * QCM - Question à Choix Multiples
 */
export const QCMContentSchema = z.object({
  question: z.string().min(1).describe('La question posée'),
  options: z.array(z.string().min(1))
    .min(2).max(6)
    .describe('Options de réponse (2-6)'),
  correctIndex: z.number().int().min(0)
    .describe('Index de la bonne réponse'),
  explanation: z.string().min(1)
    .describe('Explication de la bonne réponse')
});

/**
 * Vrai/Faux
 */
export const VraiFauxContentSchema = z.object({
  statement: z.string().min(1).describe('Affirmation à évaluer'),
  isTrue: z.boolean().describe('true si affirmation vraie, false sinon'),
  explanation: z.string().min(1).describe('Explication de la réponse')
});

// ═══════════════════════════════════════════════════════════════════════════
// SCHEMAS LANGUES (3 types)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Matching - Association paires (vocabulaire, dates, etc.)
 */
export const MatchingContentSchema = z.object({
  instruction: z.string().min(1).describe('Consigne pour l\'élève'),
  pairs: z.array(z.object({
    left: z.string().min(1).describe('Élément gauche (mot, événement, date)'),
    right: z.string().min(1).describe('Élément droit (traduction, description)')
  }))
    .min(3).max(6)
    .describe('Paires à associer (3-6 paires)')
});

/**
 * Fill Blank - Texte à trous
 */
export const FillBlankContentSchema = z.object({
  sentence: z.string().min(1)
    .describe('Phrase avec ___ pour le trou à compléter'),
  options: z.array(z.string().min(1))
    .min(2).max(6)
    .describe('Options possibles (2-6)'),
  correctIndex: z.number().int().min(0)
    .describe('Index de la bonne réponse'),
  grammaticalPoint: z.string().optional()
    .describe('Point de grammaire testé'),
  explanation: z.string().min(1)
    .describe('Explication de la réponse')
});

/**
 * Word Order - Remise en ordre de mots
 */
export const WordOrderContentSchema = z.object({
  instruction: z.string().min(1).describe('Consigne'),
  words: z.array(z.string().min(1))
    .min(3).max(10)
    .describe('Mots mélangés'),
  correctSentence: z.string().min(1)
    .describe('Phrase correcte'),
  translation: z.string().optional()
    .describe('Traduction (pour langues étrangères)')
});

// ═══════════════════════════════════════════════════════════════════════════
// SCHEMAS MATHS/SCIENCES (1 type)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Calculation - Calcul avec étapes
 */
export const CalculationContentSchema = z.object({
  problem: z.string().min(1)
    .describe('Énoncé du problème (peut contenir KaTeX $$formule$$)'),
  steps: z.array(z.string().min(1))
    .min(1).max(8)
    .describe('Étapes de résolution'),
  answer: z.string().min(1)
    .describe('Réponse finale (peut contenir KaTeX)'),
  hint: z.string().optional()
    .describe('Indice optionnel')
});

// ═══════════════════════════════════════════════════════════════════════════
// SCHEMAS HISTOIRE-GEO (3 types)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Timeline - Chronologie
 */
export const TimelineContentSchema = z.object({
  instruction: z.string().min(1).describe('Consigne'),
  events: z.array(z.object({
    event: z.string().min(1).describe('Nom de l\'événement'),
    date: z.string().optional().describe('Date (révélée après réponse)'),
    hint: z.string().optional().describe('Indice optionnel')
  }))
    .min(3).max(6)
    .describe('Événements à ordonner (3-6)'),
  correctOrder: z.array(z.number().int().min(0))
    .min(3).max(6)
    .describe('Indices dans l\'ordre chronologique correct')
});

/**
 * Matching Era - Association époque/événement
 */
export const MatchingEraContentSchema = z.object({
  instruction: z.string().min(1).describe('Consigne'),
  items: z.array(z.string().min(1))
    .min(3).max(6)
    .describe('Personnages, événements, oeuvres'),
  eras: z.array(z.string().min(1))
    .min(2).max(4)
    .describe('Époques, siècles, périodes'),
  correctPairs: z.array(z.array(z.number().int().min(0)).length(2))
    .min(3).max(6)
    .describe('Paires correctes [[itemIndex, eraIndex], ...]')
});

/**
 * Cause Effect - Cause et conséquence
 */
export const CauseEffectContentSchema = z.object({
  context: z.string().min(1)
    .describe('Contexte historique ou scientifique'),
  cause: z.string().min(1)
    .describe('La cause à analyser'),
  possibleEffects: z.array(z.string().min(1))
    .min(2).max(6)
    .describe('Effets possibles (2-6)'),
  correctIndex: z.number().int().min(0)
    .describe('Index du bon effet'),
  explanation: z.string().min(1)
    .describe('Explication du lien cause-effet')
});

// ═══════════════════════════════════════════════════════════════════════════
// SCHEMAS SVT (2 types)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Classification - Classer éléments dans catégories
 */
export const ClassificationContentSchema = z.object({
  instruction: z.string().min(1).describe('Consigne'),
  items: z.array(z.string().min(1))
    .min(4).max(12)
    .describe('Éléments à classer'),
  categories: z.array(z.string().min(1))
    .min(2).max(4)
    .describe('Catégories disponibles'),
  correctClassification: z.record(z.string(), z.array(z.number().int().min(0)))
    .describe('Classification correcte { "catégorie": [indices des items] }'),
  explanation: z.string().optional()
    .describe('Explication optionnelle')
});

/**
 * Process Order - Ordre d'un processus
 */
export const ProcessOrderContentSchema = z.object({
  instruction: z.string().min(1).describe('Consigne'),
  processName: z.string().min(1)
    .describe('Nom du processus (ex: "La digestion")'),
  steps: z.array(z.string().min(1))
    .min(3).max(8)
    .describe('Étapes mélangées'),
  correctOrder: z.array(z.number().int().min(0))
    .min(3).max(8)
    .describe('Indices dans l\'ordre correct'),
  explanation: z.string().optional()
    .describe('Explication optionnelle')
});

// ═══════════════════════════════════════════════════════════════════════════
// SCHEMAS FRANCAIS (1 type)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Grammar Transform - Transformation grammaticale
 */
export const GrammarTransformContentSchema = z.object({
  instruction: z.string().min(1)
    .describe('Consigne (ex: "Mets au passé composé")'),
  originalSentence: z.string().min(1)
    .describe('Phrase originale'),
  transformationType: z.enum(['tense', 'voice', 'form', 'number'])
    .describe('Type de transformation'),
  correctAnswer: z.string().min(1)
    .describe('Réponse correcte'),
  acceptableVariants: z.array(z.string().min(1)).optional()
    .describe('Variantes acceptables'),
  explanation: z.string().min(1)
    .describe('Explication de la transformation')
});

// ═══════════════════════════════════════════════════════════════════════════
// SCHEMAS COMBINÉS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Types de cartes comme enum Zod
 */
export const CardTypeSchema = z.enum([
  // Universels
  'flashcard', 'qcm', 'vrai_faux',
  // Langues
  'matching', 'fill_blank', 'word_order',
  // Maths/Sciences
  'calculation',
  // Histoire-Géo
  'timeline', 'matching_era', 'cause_effect',
  // SVT
  'classification', 'process_order',
  // Français
  'grammar_transform'
]);

/**
 * Carte avec discriminated union basée sur cardType
 *
 * TanStack AI utilisera ce schema pour le structured output
 */
export const ParsedCardSchema = z.discriminatedUnion('cardType', [
  // Universels
  z.object({
    cardType: z.literal('flashcard'),
    content: FlashcardContentSchema
  }),
  z.object({
    cardType: z.literal('qcm'),
    content: QCMContentSchema
  }),
  z.object({
    cardType: z.literal('vrai_faux'),
    content: VraiFauxContentSchema
  }),
  // Langues
  z.object({
    cardType: z.literal('matching'),
    content: MatchingContentSchema
  }),
  z.object({
    cardType: z.literal('fill_blank'),
    content: FillBlankContentSchema
  }),
  z.object({
    cardType: z.literal('word_order'),
    content: WordOrderContentSchema
  }),
  // Maths/Sciences
  z.object({
    cardType: z.literal('calculation'),
    content: CalculationContentSchema
  }),
  // Histoire-Géo
  z.object({
    cardType: z.literal('timeline'),
    content: TimelineContentSchema
  }),
  z.object({
    cardType: z.literal('matching_era'),
    content: MatchingEraContentSchema
  }),
  z.object({
    cardType: z.literal('cause_effect'),
    content: CauseEffectContentSchema
  }),
  // SVT
  z.object({
    cardType: z.literal('classification'),
    content: ClassificationContentSchema
  }),
  z.object({
    cardType: z.literal('process_order'),
    content: ProcessOrderContentSchema
  }),
  // Français
  z.object({
    cardType: z.literal('grammar_transform'),
    content: GrammarTransformContentSchema
  })
]);

/**
 * Schema pour un tableau de cartes (output de la génération)
 * Pas de limite max - l'utilisateur spécifie le nombre
 */
export const CardGenerationOutputSchema = z.array(ParsedCardSchema)
  .min(1)
  .describe('Tableau de cartes générées');

// ═══════════════════════════════════════════════════════════════════════════
// TYPE EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

export type CardType = z.infer<typeof CardTypeSchema>;
export type ParsedCard = z.infer<typeof ParsedCardSchema>;
export type CardGenerationOutput = z.infer<typeof CardGenerationOutputSchema>;

// Content types exports
export type FlashcardContent = z.infer<typeof FlashcardContentSchema>;
export type QCMContent = z.infer<typeof QCMContentSchema>;
export type VraiFauxContent = z.infer<typeof VraiFauxContentSchema>;
export type MatchingContent = z.infer<typeof MatchingContentSchema>;
export type FillBlankContent = z.infer<typeof FillBlankContentSchema>;
export type WordOrderContent = z.infer<typeof WordOrderContentSchema>;
export type CalculationContent = z.infer<typeof CalculationContentSchema>;
export type TimelineContent = z.infer<typeof TimelineContentSchema>;
export type MatchingEraContent = z.infer<typeof MatchingEraContentSchema>;
export type CauseEffectContent = z.infer<typeof CauseEffectContentSchema>;
export type ClassificationContent = z.infer<typeof ClassificationContentSchema>;
export type ProcessOrderContent = z.infer<typeof ProcessOrderContentSchema>;
export type GrammarTransformContent = z.infer<typeof GrammarTransformContentSchema>;
