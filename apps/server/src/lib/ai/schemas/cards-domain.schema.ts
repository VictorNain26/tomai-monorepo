import { z } from 'zod';

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

// Langues

export const MatchingContentSchema = z.object({
  instruction: z.string().min(1).describe('Consigne pour l\'élève'),
  pairs: z.array(z.object({
    left: z.string().min(1).describe('Élément gauche (mot, événement, date)'),
    right: z.string().min(1).describe('Élément droit (traduction, description)'),
    imageUrl: z.string().url().optional().describe('Image pour vocabulaire illustré')
  })).min(3).max(6).describe('Paires à associer (3-6 paires)')
});

export const FillBlankContentSchema = z.object({
  sentence: z.string().min(1).describe('Phrase avec ___ pour le trou à compléter'),
  options: z.array(z.string().min(1)).min(2).max(6).describe('Options possibles (2-6)'),
  correctIndex: coerceIndex.describe('Index de la bonne réponse'),
  grammaticalPoint: z.string().optional().describe('Point de grammaire testé'),
  explanation: z.string().min(1).describe('Explication de la réponse'),
  hints: hintsField,
  commonMistakes: commonMistakesField
});

export const WordOrderContentSchema = z.object({
  instruction: z.string().min(1).describe('Consigne'),
  words: z.array(z.string().min(1)).min(3).max(10).describe('Mots mélangés'),
  correctSentence: z.string().min(1).describe('Phrase correcte'),
  translation: z.string().optional().describe('Traduction (pour langues étrangères)'),
  hints: hintsField
});

// Maths/Sciences

export const CalculationContentSchema = z.object({
  problem: z.string().min(1).describe('Énoncé du problème (peut contenir KaTeX $$formule$$)'),
  steps: z.array(z.string().min(1)).min(1).max(8).describe('Étapes de résolution'),
  answer: z.string().min(1).describe('Réponse finale (peut contenir KaTeX)'),
  hints: hintsField,
  commonMistakes: commonMistakesField,
  imageUrl: imageUrlField
});

// Histoire-Geo

export const TimelineContentSchema = z.object({
  instruction: z.string().min(1).describe('Consigne'),
  events: z.array(z.object({
    event: z.string().min(1).describe('Nom de l\'événement'),
    date: z.string().optional().describe('Date (révélée après réponse)'),
    hint: z.string().optional().describe('Indice optionnel'),
    imageUrl: z.string().url().optional().describe('Image historique associée')
  })).min(3).max(6).describe('Événements à ordonner (3-6)'),
  correctOrder: z.array(z.number().int().min(0)).min(3).max(6)
    .describe('Indices dans l\'ordre chronologique correct'),
  imageUrl: imageUrlField
});

export const MatchingEraContentSchema = z.object({
  instruction: z.string().min(1).describe('Consigne'),
  items: z.array(z.string().min(1)).min(3).max(6).describe('Personnages, événements, oeuvres'),
  eras: z.array(z.string().min(1)).min(2).max(4).describe('Époques, siècles, périodes'),
  correctPairs: z.array(z.array(z.number().int().min(0)).length(2)).min(3).max(6)
    .describe('Paires correctes [[itemIndex, eraIndex], ...]')
});

export const CauseEffectContentSchema = z.object({
  context: z.string().min(1).describe('Contexte historique ou scientifique'),
  cause: z.string().min(1).describe('La cause à analyser'),
  possibleEffects: z.array(z.string().min(1)).min(2).max(6).describe('Effets possibles (2-6)'),
  correctIndex: coerceIndex.describe('Index du bon effet'),
  explanation: z.string().min(1).describe('Explication du lien cause-effet'),
  commonMistakes: commonMistakesField,
  imageUrl: imageUrlField
});

// SVT

export const ClassificationContentSchema = z.object({
  instruction: z.string().min(1).describe('Consigne'),
  items: z.array(z.string().min(1)).min(4).max(12).describe('Éléments à classer'),
  categories: z.array(z.string().min(1)).min(2).max(4).describe('Catégories disponibles'),
  correctClassification: z.record(z.string(), z.array(z.number().int().min(0)))
    .describe('Classification correcte { "catégorie": [indices des items] }'),
  explanation: z.string().optional().describe('Explication optionnelle'),
  imageUrl: imageUrlField,
  commonMistakes: commonMistakesField
});

export const ProcessOrderContentSchema = z.object({
  instruction: z.string().min(1).describe('Consigne'),
  processName: z.string().min(1).describe('Nom du processus (ex: "La digestion")'),
  steps: z.array(z.string().min(1)).min(3).max(8).describe('Étapes mélangées'),
  correctOrder: z.array(z.number().int().min(0)).min(3).max(8)
    .describe('Indices dans l\'ordre correct'),
  explanation: z.string().optional().describe('Explication optionnelle'),
  imageUrl: imageUrlField,
  hints: hintsField
});

// Francais

export const GrammarTransformContentSchema = z.object({
  instruction: z.string().min(1).describe('Consigne (ex: "Mets au passé composé")'),
  originalSentence: z.string().min(1).describe('Phrase originale'),
  transformationType: z.enum(['tense', 'voice', 'form', 'number'])
    .describe('Type de transformation'),
  correctAnswer: z.string().min(1).describe('Réponse correcte'),
  acceptableVariants: z.array(z.string().min(1)).optional().describe('Variantes acceptables'),
  explanation: z.string().min(1).describe('Explication de la transformation'),
  hints: hintsField,
  commonMistakes: commonMistakesField
});

// Elaboration

export const ReformulationContentSchema = z.object({
  concept: z.string().min(1).describe('Nom du concept à reformuler'),
  prompt: z.string().min(1).describe('Consigne de reformulation (ex: "Explique ce théorème à un camarade")'),
  context: z.string().optional().describe('Contexte facultatif pour guider la reformulation'),
  keyElements: z.array(z.string().min(1)).min(2).max(5)
    .describe('Éléments clés attendus dans la reformulation (2-5)'),
  sampleAnswer: z.string().min(1).describe('Exemple de bonne reformulation'),
  hints: hintsField,
  imageUrl: imageUrlField
});
