/**
 * Zod Schemas pour les 15 types de cartes learning
 *
 * Architecture 2025 :
 * - Validation type-safe avec Zod
 * - Double-check après Gemini Structured Output
 * - Défense en profondeur (coerceIndex comme filet de sécurité)
 *
 * ## Fondements Scientifiques
 *
 * ### CSEN (Conseil Scientifique de l'Éducation Nationale) - SOURCES OFFICIELLES
 * Les 4 piliers de Stanislas Dehaene appliqués aux types de cartes :
 * - Attention → Un concept par carte (type 'concept')
 * - Engagement actif → QCM, exercices, testing effect
 * - Retour sur erreur → Champs 'explanation' obligatoires
 * - Consolidation → Variation des 15 types de cartes
 *
 * ### EXTENSIONS SCIENTIFIQUES (non-CSEN, académiquement validées)
 * Ces champs et types NE SONT PAS du CSEN mais sont scientifiquement validés :
 * - Double codage : imageUrl optionnel (Paivio 1986)
 * - Scaffolding : hints[] progressifs (Vygotsky 1978)
 * - Erreur productive : commonMistakes[] (Chi 1978)
 * - Élaboration : type 'reformulation' (Pressley 1987)
 *
 * @see services/learning/prompts/pedagogy.ts pour documentation complète
 */

import { z } from 'zod';

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS: Champs cognitifs communs (Sciences Cognitives 2025)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * URL d'image pour double codage (Paivio 1986)
 * Supporte images externes ou data URLs pour schémas générés
 */
const imageUrlField = z.string().url().optional()
  .describe('URL d\'image/schéma pour double codage visuel (optionnel)');

/**
 * Indices progressifs - scaffolding cognitif
 * L'élève peut demander des indices avant de voir la réponse
 */
const hintsField = z.array(z.string().min(1)).max(3).optional()
  .describe('Indices progressifs (du plus vague au plus précis, max 3)');

/**
 * Erreurs fréquentes - apprentissage par l'erreur productive
 * Montrer les erreurs courantes renforce la plasticité neuronale
 */
const commonMistakesField = z.array(z.object({
  mistake: z.string().min(1).describe('L\'erreur fréquente'),
  why: z.string().min(1).describe('Pourquoi c\'est faux')
})).max(3).optional()
  .describe('Erreurs fréquentes à éviter avec explication (max 3)');

// ═══════════════════════════════════════════════════════════════════════════
// HELPER: Défense en profondeur pour index numériques
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Valide un index numérique avec coercion de sécurité.
 * Le Structured Output de Gemini garantit le bon type, mais ce helper
 * offre une défense en profondeur pour tout autre usage du schéma.
 */
const coerceIndex = z.preprocess(
  (val) => (Array.isArray(val) && val.length === 1 ? val[0] : val),
  z.number().int().min(0)
);

// ═══════════════════════════════════════════════════════════════════════════
// SCHEMAS PÉDAGOGIQUES (1 type)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Concept - Explication théorique d'une notion
 * À afficher AVANT les exercices pratiques
 */
export const ConceptContentSchema = z.object({
  title: z.string().min(1)
    .describe('Titre de la notion'),
  explanation: z.string().min(1)
    .describe('Explication claire et concise de la notion'),
  keyPoints: z.array(z.string().min(1))
    .min(2).max(4)
    .describe('Points clés à retenir (2-4)'),
  example: z.string().optional()
    .describe('Exemple optionnel pour illustrer'),
  formula: z.string().optional()
    .describe('Formule KaTeX optionnelle (maths/sciences)'),
  // Double codage (Sciences Cognitives)
  imageUrl: imageUrlField
});

// ═══════════════════════════════════════════════════════════════════════════
// SCHEMAS UNIVERSELS (3 types)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Flashcard classique (recto/verso)
 * Enrichi avec double codage et indices progressifs
 */
export const FlashcardContentSchema = z.object({
  front: z.string().min(1).describe('Question ou concept (recto de la carte)'),
  back: z.string().min(1).describe('Réponse ou définition (verso de la carte)'),
  // Sciences Cognitives 2025
  imageUrl: imageUrlField,
  hints: hintsField
});

/**
 * QCM - Question à Choix Multiples
 * Enrichi avec erreur productive et indices
 */
export const QCMContentSchema = z.object({
  question: z.string().min(1).describe('La question posée'),
  options: z.array(z.string().min(1))
    .min(2).max(6)
    .describe('Options de réponse (2-6)'),
  correctIndex: coerceIndex.describe('Index de la bonne réponse'),
  explanation: z.string().min(1)
    .describe('Explication de la bonne réponse'),
  // Sciences Cognitives 2025
  imageUrl: imageUrlField,
  hints: hintsField,
  commonMistakes: commonMistakesField
});

/**
 * Vrai/Faux
 * Enrichi avec erreur productive
 */
export const VraiFauxContentSchema = z.object({
  statement: z.string().min(1).describe('Affirmation à évaluer'),
  isTrue: z.boolean().describe('true si affirmation vraie, false sinon'),
  explanation: z.string().min(1).describe('Explication de la réponse'),
  // Sciences Cognitives 2025
  commonMistakes: commonMistakesField
});

// ═══════════════════════════════════════════════════════════════════════════
// SCHEMAS LANGUES (3 types)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Matching - Association paires (vocabulaire, dates, etc.)
 * Enrichi avec double codage pour langues (images vocabulaire)
 */
export const MatchingContentSchema = z.object({
  instruction: z.string().min(1).describe('Consigne pour l\'élève'),
  pairs: z.array(z.object({
    left: z.string().min(1).describe('Élément gauche (mot, événement, date)'),
    right: z.string().min(1).describe('Élément droit (traduction, description)'),
    imageUrl: z.string().url().optional().describe('Image pour vocabulaire illustré')
  }))
    .min(3).max(6)
    .describe('Paires à associer (3-6 paires)')
});

/**
 * Fill Blank - Texte à trous
 * Enrichi avec erreur productive et indices
 */
export const FillBlankContentSchema = z.object({
  sentence: z.string().min(1)
    .describe('Phrase avec ___ pour le trou à compléter'),
  options: z.array(z.string().min(1))
    .min(2).max(6)
    .describe('Options possibles (2-6)'),
  correctIndex: coerceIndex.describe('Index de la bonne réponse'),
  grammaticalPoint: z.string().optional()
    .describe('Point de grammaire testé'),
  explanation: z.string().min(1)
    .describe('Explication de la réponse'),
  // Sciences Cognitives 2025
  hints: hintsField,
  commonMistakes: commonMistakesField
});

/**
 * Word Order - Remise en ordre de mots
 * Enrichi avec indices progressifs
 */
export const WordOrderContentSchema = z.object({
  instruction: z.string().min(1).describe('Consigne'),
  words: z.array(z.string().min(1))
    .min(3).max(10)
    .describe('Mots mélangés'),
  correctSentence: z.string().min(1)
    .describe('Phrase correcte'),
  translation: z.string().optional()
    .describe('Traduction (pour langues étrangères)'),
  // Sciences Cognitives 2025
  hints: hintsField
});

// ═══════════════════════════════════════════════════════════════════════════
// SCHEMAS MATHS/SCIENCES (1 type)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Calculation - Calcul avec étapes
 * Enrichi avec indices progressifs et erreurs fréquentes
 */
export const CalculationContentSchema = z.object({
  problem: z.string().min(1)
    .describe('Énoncé du problème (peut contenir KaTeX $$formule$$)'),
  steps: z.array(z.string().min(1))
    .min(1).max(8)
    .describe('Étapes de résolution'),
  answer: z.string().min(1)
    .describe('Réponse finale (peut contenir KaTeX)'),
  // Sciences Cognitives 2025 (remplace hint singulier par hints progressifs)
  hints: hintsField,
  commonMistakes: commonMistakesField,
  imageUrl: imageUrlField
});

// ═══════════════════════════════════════════════════════════════════════════
// SCHEMAS HISTOIRE-GEO (3 types)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Timeline - Chronologie
 * Enrichi avec double codage (images historiques)
 */
export const TimelineContentSchema = z.object({
  instruction: z.string().min(1).describe('Consigne'),
  events: z.array(z.object({
    event: z.string().min(1).describe('Nom de l\'événement'),
    date: z.string().optional().describe('Date (révélée après réponse)'),
    hint: z.string().optional().describe('Indice optionnel'),
    imageUrl: z.string().url().optional().describe('Image historique associée')
  }))
    .min(3).max(6)
    .describe('Événements à ordonner (3-6)'),
  correctOrder: z.array(z.number().int().min(0))
    .min(3).max(6)
    .describe('Indices dans l\'ordre chronologique correct'),
  // Sciences Cognitives 2025
  imageUrl: imageUrlField
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
 * Enrichi avec erreur productive
 */
export const CauseEffectContentSchema = z.object({
  context: z.string().min(1)
    .describe('Contexte historique ou scientifique'),
  cause: z.string().min(1)
    .describe('La cause à analyser'),
  possibleEffects: z.array(z.string().min(1))
    .min(2).max(6)
    .describe('Effets possibles (2-6)'),
  correctIndex: coerceIndex.describe('Index du bon effet'),
  explanation: z.string().min(1)
    .describe('Explication du lien cause-effet'),
  // Sciences Cognitives 2025
  commonMistakes: commonMistakesField,
  imageUrl: imageUrlField
});

// ═══════════════════════════════════════════════════════════════════════════
// SCHEMAS SVT (2 types)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Classification - Classer éléments dans catégories
 * Enrichi avec double codage (schémas scientifiques)
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
    .describe('Explication optionnelle'),
  // Sciences Cognitives 2025
  imageUrl: imageUrlField,
  commonMistakes: commonMistakesField
});

/**
 * Process Order - Ordre d'un processus
 * Enrichi avec double codage (schémas processus biologiques)
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
    .describe('Explication optionnelle'),
  // Sciences Cognitives 2025
  imageUrl: imageUrlField,
  hints: hintsField
});

// ═══════════════════════════════════════════════════════════════════════════
// SCHEMAS FRANCAIS (1 type)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Grammar Transform - Transformation grammaticale
 * Enrichi avec erreur productive
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
    .describe('Explication de la transformation'),
  // Sciences Cognitives 2025
  hints: hintsField,
  commonMistakes: commonMistakesField
});

// ═══════════════════════════════════════════════════════════════════════════
// SCHEMAS ÉLABORATION (1 type) - Sciences Cognitives 2025
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Reformulation - Élaboration active
 *
 * EXTENSION SCIENTIFIQUE (non-CSEN) :
 * Basé sur Elaborative Interrogation (Pressley et al., 1987)
 * "Expliquer une notion avec ses propres mots renforce compréhension et mémorisation"
 *
 * L'élève doit reformuler un concept sans regarder la définition,
 * activant ainsi le rappel actif + l'élaboration (double effet).
 *
 * Source: Pressley, M. et al. (1987). Elaborative interrogation.
 *         Journal of Educational Psychology, 79(3), 217-228.
 */
export const ReformulationContentSchema = z.object({
  concept: z.string().min(1)
    .describe('Nom du concept à reformuler'),
  prompt: z.string().min(1)
    .describe('Consigne de reformulation (ex: "Explique ce théorème à un camarade")'),
  context: z.string().optional()
    .describe('Contexte facultatif pour guider la reformulation'),
  keyElements: z.array(z.string().min(1))
    .min(2).max(5)
    .describe('Éléments clés attendus dans la reformulation (2-5)'),
  sampleAnswer: z.string().min(1)
    .describe('Exemple de bonne reformulation'),
  // Sciences Cognitives 2025
  hints: hintsField,
  imageUrl: imageUrlField
});

// ═══════════════════════════════════════════════════════════════════════════
// SCHEMAS COMBINÉS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Types de cartes comme enum Zod (15 types)
 */
export const CardTypeSchema = z.enum([
  // Pédagogique
  'concept',
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
  'grammar_transform',
  // Élaboration (Sciences Cognitives 2025)
  'reformulation'
]);

/**
 * Carte avec discriminated union basée sur cardType
 *
 * TanStack AI utilisera ce schema pour le structured output
 */
export const ParsedCardSchema = z.discriminatedUnion('cardType', [
  // Pédagogique
  z.object({
    cardType: z.literal('concept'),
    content: ConceptContentSchema
  }),
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
  }),
  // Élaboration (Sciences Cognitives 2025)
  z.object({
    cardType: z.literal('reformulation'),
    content: ReformulationContentSchema
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

// Type helper pour les erreurs fréquentes (réutilisable côté frontend)
export type CommonMistake = { mistake: string; why: string };
