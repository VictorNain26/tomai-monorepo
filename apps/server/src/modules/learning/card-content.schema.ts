/**
 * The one definition of the revision cards: their types, the shape of each one's content, and the
 * schema the generator sends to Mistral in strict structured output. Strict mode rejects
 * `format: uri` and `propertyNames` (400, code 3051, `live/structured-output.test.ts`): no `z.url()`
 * nor `z.record` here. JSON Schema cannot tie an index to the length of its list: `CardSchema`
 * checks it after the shape.
 */

import { z } from 'zod';

export const CARD_TYPES = [
  'concept',
  'flashcard',
  'qcm',
  'vrai_faux',
  'matching',
  'fill_blank',
  'word_order',
  'calculation',
  'timeline',
  'matching_era',
  'cause_effect',
  'classification',
  'process_order',
  'grammar_transform',
  'reformulation',
] as const;

export type CardType = (typeof CARD_TYPES)[number];

const hintsField = z.array(z.string().min(1)).max(3).optional().describe('Indices progressifs (du plus vague au plus précis, max 3)');

const commonMistakesField = z
  .array(
    z.object({
      mistake: z.string().min(1).describe("L'erreur fréquente"),
      why: z.string().min(1).describe("Pourquoi c'est faux"),
    }),
  )
  .max(3)
  .optional()
  .describe('Erreurs fréquentes à éviter avec explication (max 3)');

const answerIndex = z.number().int().min(0);

const ConceptContentSchema = z.object({
  title: z.string().min(1).describe('Titre de la notion'),
  explanation: z.string().min(1).describe('Explication claire et concise de la notion'),
  keyPoints: z.array(z.string().min(1)).min(2).max(4).describe('Points clés à retenir (2-4)'),
  example: z.string().optional().describe('Exemple optionnel pour illustrer'),
  formula: z.string().optional().describe('Formule KaTeX optionnelle (maths/sciences)'),
});

const FlashcardContentSchema = z.object({
  front: z.string().min(1).describe('Question ou concept (recto de la carte)'),
  back: z.string().min(1).describe('Réponse ou définition (verso de la carte)'),
  hints: hintsField,
});

const QCMContentSchema = z.object({
  question: z.string().min(1).describe('La question posée'),
  options: z.array(z.string().min(1)).min(2).max(6).describe('Options de réponse (2-6)'),
  correctIndex: answerIndex.describe('Index de la bonne réponse'),
  explanation: z.string().min(1).describe('Explication de la bonne réponse'),
  hints: hintsField,
  commonMistakes: commonMistakesField,
});

const VraiFauxContentSchema = z.object({
  statement: z.string().min(1).describe('Affirmation à évaluer'),
  isTrue: z.boolean().describe('true si affirmation vraie, false sinon'),
  explanation: z.string().min(1).describe('Explication de la réponse'),
  commonMistakes: commonMistakesField,
});

const MatchingContentSchema = z.object({
  instruction: z.string().min(1).describe("Consigne pour l'élève"),
  pairs: z
    .array(
      z.object({
        left: z.string().min(1).describe('Élément gauche (mot, événement, date)'),
        right: z.string().min(1).describe('Élément droit (traduction, description)'),
      }),
    )
    .min(3)
    .max(6)
    .describe('Paires à associer (3-6 paires)'),
});

const FillBlankContentSchema = z.object({
  sentence: z.string().min(1).describe('Phrase avec ___ pour le trou à compléter'),
  options: z.array(z.string().min(1)).min(2).max(6).describe('Options possibles (2-6)'),
  correctIndex: answerIndex.describe('Index de la bonne réponse'),
  grammaticalPoint: z.string().optional().describe('Point de grammaire testé'),
  explanation: z.string().min(1).describe('Explication de la réponse'),
  hints: hintsField,
  commonMistakes: commonMistakesField,
});

const WordOrderContentSchema = z.object({
  instruction: z.string().min(1).describe('Consigne'),
  words: z.array(z.string().min(1)).min(3).max(10).describe('Mots mélangés'),
  correctSentence: z.string().min(1).describe('Phrase correcte'),
  translation: z.string().optional().describe('Traduction (pour langues étrangères)'),
  hints: hintsField,
});

const CalculationContentSchema = z.object({
  problem: z.string().min(1).describe('Énoncé du problème (peut contenir KaTeX $$formule$$)'),
  steps: z.array(z.string().min(1)).min(1).max(8).describe('Étapes de résolution'),
  answer: z.string().min(1).describe('Réponse finale (peut contenir KaTeX)'),
  hints: hintsField,
  commonMistakes: commonMistakesField,
});

const TimelineContentSchema = z.object({
  instruction: z.string().min(1).describe('Consigne'),
  events: z
    .array(
      z.object({
        event: z.string().min(1).describe("Nom de l'événement"),
        date: z.string().optional().describe('Date (révélée après réponse)'),
        hint: z.string().optional().describe('Indice optionnel'),
      }),
    )
    .min(3)
    .max(6)
    .describe('Événements à ordonner (3-6)'),
  correctOrder: z.array(z.number().int().min(0)).min(3).max(6).describe("Indices dans l'ordre chronologique correct"),
});

const MatchingEraContentSchema = z.object({
  instruction: z.string().min(1).describe('Consigne'),
  items: z.array(z.string().min(1)).min(3).max(6).describe('Personnages, événements, oeuvres'),
  eras: z.array(z.string().min(1)).min(2).max(4).describe('Époques, siècles, périodes'),
  correctPairs: z
    .array(z.array(z.number().int().min(0)).length(2))
    .min(3)
    .max(6)
    .describe('Paires correctes [[itemIndex, eraIndex], ...]'),
});

const CauseEffectContentSchema = z.object({
  context: z.string().min(1).describe('Contexte historique ou scientifique'),
  cause: z.string().min(1).describe('La cause à analyser'),
  possibleEffects: z.array(z.string().min(1)).min(2).max(6).describe('Effets possibles (2-6)'),
  correctIndex: answerIndex.describe('Index du bon effet'),
  explanation: z.string().min(1).describe('Explication du lien cause-effet'),
  commonMistakes: commonMistakesField,
});

const ClassificationContentSchema = z.object({
  instruction: z.string().min(1).describe('Consigne'),
  items: z.array(z.string().min(1)).min(4).max(12).describe('Éléments à classer'),
  categories: z
    .array(
      z.object({
        name: z.string().min(1).describe('Nom de la catégorie'),
        itemIndexes: z.array(z.number().int().min(0)).describe('Indices des éléments de cette catégorie'),
      }),
    )
    .min(2)
    .max(4)
    .describe('Catégories et leurs éléments (2-4)'),
  explanation: z.string().optional().describe('Explication optionnelle'),
  commonMistakes: commonMistakesField,
});

const ProcessOrderContentSchema = z.object({
  instruction: z.string().min(1).describe('Consigne'),
  processName: z.string().min(1).describe('Nom du processus (ex: "La digestion")'),
  steps: z.array(z.string().min(1)).min(3).max(8).describe('Étapes mélangées'),
  correctOrder: z.array(z.number().int().min(0)).min(3).max(8).describe("Indices dans l'ordre correct"),
  explanation: z.string().optional().describe('Explication optionnelle'),
  hints: hintsField,
});

const GrammarTransformContentSchema = z.object({
  instruction: z.string().min(1).describe('Consigne (ex: "Mets au passé composé")'),
  originalSentence: z.string().min(1).describe('Phrase originale'),
  transformationType: z.enum(['tense', 'voice', 'form', 'number']).describe('Type de transformation'),
  correctAnswer: z.string().min(1).describe('Réponse correcte'),
  acceptableVariants: z.array(z.string().min(1)).optional().describe('Variantes acceptables'),
  explanation: z.string().min(1).describe('Explication de la transformation'),
  hints: hintsField,
  commonMistakes: commonMistakesField,
});

const ReformulationContentSchema = z.object({
  concept: z.string().min(1).describe('Nom du concept à reformuler'),
  prompt: z.string().min(1).describe('Consigne de reformulation (ex: "Explique ce théorème à un camarade")'),
  context: z.string().optional().describe('Contexte facultatif pour guider la reformulation'),
  keyElements: z.array(z.string().min(1)).min(2).max(5).describe('Éléments clés attendus dans la reformulation (2-5)'),
  sampleAnswer: z.string().min(1).describe('Exemple de bonne reformulation'),
  hints: hintsField,
});

const CardShapeSchema = z.discriminatedUnion('cardType', [
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
  z.object({ cardType: z.literal('reformulation'), content: ReformulationContentSchema }),
]);

type CardShape = z.infer<typeof CardShapeSchema>;

const isIndexOf = (index: number, length: number) => index < length;

/** Every index of the list once: an order, or items shared out between groups. */
const coversOnce = (indexes: readonly number[], length: number) =>
  indexes.length === length && new Set(indexes).size === length && indexes.every((index) => isIndexOf(index, length));

function misplacedIndex(card: CardShape): string | null {
  switch (card.cardType) {
    case 'qcm':
    case 'fill_blank':
      return isIndexOf(card.content.correctIndex, card.content.options.length) ? null : 'correctIndex';
    case 'cause_effect':
      return isIndexOf(card.content.correctIndex, card.content.possibleEffects.length) ? null : 'correctIndex';
    case 'timeline':
      return coversOnce(card.content.correctOrder, card.content.events.length) ? null : 'correctOrder';
    case 'process_order':
      return coversOnce(card.content.correctOrder, card.content.steps.length) ? null : 'correctOrder';
    case 'matching_era': {
      const { items, eras, correctPairs } = card.content;
      const itemsCovered = coversOnce(
        correctPairs.map(([item = -1]) => item),
        items.length,
      );
      return itemsCovered && correctPairs.every(([, era = -1]) => era >= 0 && isIndexOf(era, eras.length)) ? null : 'correctPairs';
    }
    case 'classification':
      return coversOnce(
        card.content.categories.flatMap((category) => category.itemIndexes),
        card.content.items.length,
      )
        ? null
        : 'categories';
    default:
      return null;
  }
}

export const CardSchema = CardShapeSchema.superRefine((card, ctx) => {
  const field = misplacedIndex(card);
  if (field) ctx.addIssue({ code: 'custom', message: `${field} must point into its list, each index once`, path: ['content', field] });
});

export type Card = z.infer<typeof CardSchema>;

/** The shape alone: one card with a misplaced index is set aside, not the whole batch. */
export const CardGenerationSchema = z.object({
  cards: z.array(CardShapeSchema).min(1).describe('Tableau de cartes générées'),
});
