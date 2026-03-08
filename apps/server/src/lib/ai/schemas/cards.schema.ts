import { z } from 'zod';

// Re-export domain schemas
export {
  MatchingContentSchema,
  FillBlankContentSchema,
  WordOrderContentSchema,
  CalculationContentSchema,
  TimelineContentSchema,
  MatchingEraContentSchema,
  CauseEffectContentSchema,
  ClassificationContentSchema,
  ProcessOrderContentSchema,
  GrammarTransformContentSchema,
  ReformulationContentSchema,
} from './cards-domain.schema.js';

import {
  MatchingContentSchema,
  FillBlankContentSchema,
  WordOrderContentSchema,
  CalculationContentSchema,
  TimelineContentSchema,
  MatchingEraContentSchema,
  CauseEffectContentSchema,
  ClassificationContentSchema,
  ProcessOrderContentSchema,
  GrammarTransformContentSchema,
  ReformulationContentSchema,
} from './cards-domain.schema.js';

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

const imageUrlField = z.string().url().optional()
  .describe('URL d\'image/schéma pour double codage visuel (optionnel)');

const hintsField = z.array(z.string().min(1)).max(3).optional()
  .describe('Indices progressifs (du plus vague au plus précis, max 3)');

const commonMistakesField = z.array(z.object({
  mistake: z.string().min(1).describe('L\'erreur fréquente'),
  why: z.string().min(1).describe('Pourquoi c\'est faux')
})).max(3).optional()
  .describe('Erreurs fréquentes à éviter avec explication (max 3)');

const coerceIndex = z.preprocess(
  (val) => (Array.isArray(val) && val.length === 1 ? val[0] : val),
  z.number().int().min(0)
);

// ═══════════════════════════════════════════════════════════════════════════
// PEDAGOGIQUE (1 type)
// ═══════════════════════════════════════════════════════════════════════════

export const ConceptContentSchema = z.object({
  title: z.string().min(1).describe('Titre de la notion'),
  explanation: z.string().min(1).describe('Explication claire et concise de la notion'),
  keyPoints: z.array(z.string().min(1)).min(2).max(4).describe('Points clés à retenir (2-4)'),
  example: z.string().optional().describe('Exemple optionnel pour illustrer'),
  formula: z.string().optional().describe('Formule KaTeX optionnelle (maths/sciences)'),
  imageUrl: imageUrlField
});

// ═══════════════════════════════════════════════════════════════════════════
// UNIVERSELS (3 types)
// ═══════════════════════════════════════════════════════════════════════════

export const FlashcardContentSchema = z.object({
  front: z.string().min(1).describe('Question ou concept (recto de la carte)'),
  back: z.string().min(1).describe('Réponse ou définition (verso de la carte)'),
  imageUrl: imageUrlField,
  hints: hintsField
});

export const QCMContentSchema = z.object({
  question: z.string().min(1).describe('La question posée'),
  options: z.array(z.string().min(1)).min(2).max(6).describe('Options de réponse (2-6)'),
  correctIndex: coerceIndex.describe('Index de la bonne réponse'),
  explanation: z.string().min(1).describe('Explication de la bonne réponse'),
  imageUrl: imageUrlField,
  hints: hintsField,
  commonMistakes: commonMistakesField
});

export const VraiFauxContentSchema = z.object({
  statement: z.string().min(1).describe('Affirmation à évaluer'),
  isTrue: z.boolean().describe('true si affirmation vraie, false sinon'),
  explanation: z.string().min(1).describe('Explication de la réponse'),
  commonMistakes: commonMistakesField
});

// ═══════════════════════════════════════════════════════════════════════════
// COMBINED SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════

export const CardTypeSchema = z.enum([
  'concept',
  'flashcard', 'qcm', 'vrai_faux',
  'matching', 'fill_blank', 'word_order',
  'calculation',
  'timeline', 'matching_era', 'cause_effect',
  'classification', 'process_order',
  'grammar_transform',
  'reformulation'
]);

export const ParsedCardSchema = z.discriminatedUnion('cardType', [
  z.object({ cardType: z.literal('concept'), content: ConceptContentSchema }),
  z.object({ cardType: z.literal('flashcard'), content: FlashcardContentSchema }),
  z.object({ cardType: z.literal('qcm'), content: QCMContentSchema }),
  z.object({ cardType: z.literal('vrai_faux'), content: VraiFauxContentSchema }),
  z.object({ cardType: z.literal('matching'), content: MatchingContentSchema }),
  z.object({ cardType: z.literal('fill_blank'), content: FillBlankContentSchema }),
  z.object({ cardType: z.literal('word_order'), content: WordOrderContentSchema }),
  z.object({ cardType: z.literal('calculation'), content: CalculationContentSchema }),
  z.object({ cardType: z.literal('timeline'), content: TimelineContentSchema }),
  z.object({ cardType: z.literal('matching_era'), content: MatchingEraContentSchema }),
  z.object({ cardType: z.literal('cause_effect'), content: CauseEffectContentSchema }),
  z.object({ cardType: z.literal('classification'), content: ClassificationContentSchema }),
  z.object({ cardType: z.literal('process_order'), content: ProcessOrderContentSchema }),
  z.object({ cardType: z.literal('grammar_transform'), content: GrammarTransformContentSchema }),
  z.object({ cardType: z.literal('reformulation'), content: ReformulationContentSchema })
]);

export const CardGenerationOutputSchema = z.array(ParsedCardSchema)
  .min(1)
  .describe('Tableau de cartes générées');

// ═══════════════════════════════════════════════════════════════════════════
// TYPE EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

export type CardType = z.infer<typeof CardTypeSchema>;
export type ParsedCard = z.infer<typeof ParsedCardSchema>;
export type CardGenerationOutput = z.infer<typeof CardGenerationOutputSchema>;

export type ConceptContent = z.infer<typeof ConceptContentSchema>;
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
export type ReformulationContent = z.infer<typeof ReformulationContentSchema>;

export type CommonMistake = { mistake: string; why: string };
