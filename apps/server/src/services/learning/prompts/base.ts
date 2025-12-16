/**
 * Prompts de base pour la génération de cartes - Architecture PTCF
 *
 * PTCF = Persona · Task · Context · Format (Gemini 2025 best practices)
 *
 * Principes appliqués:
 * - Few-shot examples (2-3 exemples complets)
 * - Instructions directes et concises
 * - Format JSON via structure claire
 * - RAG comme source de vérité pour le contenu
 */

import type { CardType } from '../types.js';

// ============================================================================
// PERSONA
// ============================================================================

const PERSONA = `Tu es un expert pédagogue français spécialisé dans la création de cartes de révision.
Tu maîtrises les programmes officiels de l'Éducation nationale (Éduscol).
Tu crées des exercices variés, concis et adaptés au niveau de l'élève.`;

// ============================================================================
// TASK CORE
// ============================================================================

const TASK_CORE = `Génère un deck de cartes de révision qui couvre EXHAUSTIVEMENT le thème demandé.

**RÈGLES CRITIQUES :**
- Chaque carte = UNE SEULE notion/compétence distincte
- Utilise TOUS les types de cartes disponibles (pas que des flashcards)
- Varie les angles : définition, application, contre-exemple, comparaison, cause/effet
- Varie les exemples : ne JAMAIS réutiliser le même exemple
- Ne PAS reprendre les exemples du contexte RAG, crée les tiens

Le deck doit permettre de maîtriser l'intégralité du sujet.`;

// ============================================================================
// KATEX (matières scientifiques)
// ============================================================================

export const KATEX_INSTRUCTIONS = `
## KaTeX (OBLIGATOIRE pour formules)
- Inline: $formule$ — Display: $$formule$$
- Dans JSON: double backslash (\\\\pi → \\pi)
- Syntaxe: \\frac{a}{b}, \\sqrt{x}, x^2, x_1, \\times, \\leq, \\geq, \\pi, \\sum_{i=1}^{n}, \\int_a^b`;

// ============================================================================
// FORMAT JSON - Définitions compactes par type
// ============================================================================

const CARD_FORMATS: Record<CardType, string> = {
  flashcard: `{"cardType":"flashcard","content":{"front":"Question","back":"Réponse"}}`,

  qcm: `{"cardType":"qcm","content":{"question":"...","options":["A","B","C","D"],"correctIndex":0,"explanation":"..."}}`,

  vrai_faux: `{"cardType":"vrai_faux","content":{"statement":"Affirmation","isTrue":true,"explanation":"..."}}`,

  matching: `{"cardType":"matching","content":{"instruction":"Associe...","pairs":[{"left":"mot","right":"traduction"},...]}}`,

  fill_blank: `{"cardType":"fill_blank","content":{"sentence":"She ___ to school.","options":["go","goes","going","went"],"correctIndex":1,"grammaticalPoint":"Present simple","explanation":"..."}}`,

  word_order: `{"cardType":"word_order","content":{"instruction":"Remets dans l'ordre","words":["I","went","yesterday"],"correctSentence":"I went yesterday","translation":"..."}}`,

  calculation: `{"cardType":"calculation","content":{"problem":"$2x+5=13$","steps":["$2x=8$","$x=4$"],"answer":"$x=4$","hint":"..."}}`,

  timeline: `{"cardType":"timeline","content":{"instruction":"Ordre chronologique","events":[{"event":"...","date":"...","hint":"..."}],"correctOrder":[0,2,1]}}`,

  matching_era: `{"cardType":"matching_era","content":{"instruction":"Associe à l'époque","items":["Vercingétorix","Louis XIV"],"eras":["Antiquité","Temps modernes"],"correctPairs":[[0,0],[1,1]]}}`,

  cause_effect: `{"cardType":"cause_effect","content":{"context":"...","cause":"...","possibleEffects":["A","B","C","D"],"correctIndex":0,"explanation":"..."}}`,

  classification: `{"cardType":"classification","content":{"instruction":"Classe...","items":["A","B","C"],"categories":["Cat1","Cat2"],"correctClassification":{"Cat1":[0],"Cat2":[1,2]},"explanation":"..."}}`,

  process_order: `{"cardType":"process_order","content":{"instruction":"Ordre des étapes","processName":"...","steps":["Étape A","Étape B"],"correctOrder":[1,0],"explanation":"..."}}`,

  grammar_transform: `{"cardType":"grammar_transform","content":{"instruction":"Mets au passé","originalSentence":"Je mange.","transformationType":"tense","correctAnswer":"J'ai mangé.","acceptableVariants":[],"explanation":"..."}}`
};

// ============================================================================
// FEW-SHOT EXAMPLES (complets)
// ============================================================================

const FEW_SHOT_MATH = `[
  {"cardType":"flashcard","content":{"front":"Qu'est-ce qu'une fraction ?","back":"Un nombre qui représente une partie d'un tout : $\\\\frac{numérateur}{dénominateur}$"}},
  {"cardType":"qcm","content":{"question":"$\\\\frac{3}{4} + \\\\frac{1}{4} = ?$","options":["$\\\\frac{4}{8}$","$1$","$\\\\frac{4}{4}$","$\\\\frac{3}{4}$"],"correctIndex":1,"explanation":"Même dénominateur : on additionne les numérateurs. $\\\\frac{3+1}{4} = \\\\frac{4}{4} = 1$"}},
  {"cardType":"calculation","content":{"problem":"Simplifie $\\\\frac{12}{18}$","steps":["PGCD(12,18) = 6","$\\\\frac{12÷6}{18÷6}$"],"answer":"$\\\\frac{2}{3}$","hint":"Trouve le PGCD"}}
]`;

const FEW_SHOT_HISTOIRE = `[
  {"cardType":"flashcard","content":{"front":"Quand a eu lieu la prise de la Bastille ?","back":"14 juillet 1789"}},
  {"cardType":"timeline","content":{"instruction":"Remets dans l'ordre chronologique","events":[{"event":"Prise de la Bastille","date":"14 juillet 1789"},{"event":"Déclaration des droits de l'homme","date":"26 août 1789"},{"event":"Fuite à Varennes","date":"21 juin 1791"}],"correctOrder":[0,1,2]}},
  {"cardType":"cause_effect","content":{"context":"Révolution française","cause":"Crise financière de la monarchie","possibleEffects":["Convocation des États généraux","Construction de Versailles","Signature du traité de Verdun","Guerre de Cent Ans"],"correctIndex":0,"explanation":"Louis XVI convoque les États généraux pour lever de nouveaux impôts"}}
]`;

const FEW_SHOT_LANGUES = `[
  {"cardType":"flashcard","content":{"front":"house","back":"maison"}},
  {"cardType":"fill_blank","content":{"sentence":"She ___ to school every day.","options":["go","goes","going","went"],"correctIndex":1,"grammaticalPoint":"Present simple - 3rd person","explanation":"Avec 'she', on ajoute -s/-es au verbe"}},
  {"cardType":"matching","content":{"instruction":"Associe chaque mot à sa traduction","pairs":[{"left":"book","right":"livre"},{"left":"car","right":"voiture"},{"left":"tree","right":"arbre"}]}}
]`;

// ============================================================================
// RÈGLES DE FORMAT
// ============================================================================

const FORMAT_RULES = `
## FORMAT DE SORTIE

Retourne UNIQUEMENT un tableau JSON valide :
- Pas de texte avant/après
- Pas de \`\`\`json
- Guillemets doubles
- Nombres sans guillemets (correctIndex: 0, pas "0")
- Booléens sans guillemets (isTrue: true, pas "true")

## LIMITES DE CARACTÈRES
- Front/back flashcard : 150 max
- Question QCM : 150 max
- Options : 60 max chacune
- Explanations : 200 max
- Instructions : 100 max

## INTERDIT
- Tableaux markdown (mal rendus sur mobile)
- Schémas ASCII
- Listes longues (max 3 items)
- "Méthodologie en X phases"
- Réponses type "cours complet"
- Répéter la question dans la réponse
- Périphrases (aller droit au but)`;

// ============================================================================
// FONCTIONS EXPORTÉES
// ============================================================================

/**
 * Retourne les formats JSON pour les types de cartes demandés
 */
function getCardFormatInstructions(cardTypes: CardType[]): string {
  const formats = cardTypes.map(type => `- ${type}: ${CARD_FORMATS[type]}`);
  return `## TYPES DE CARTES DISPONIBLES\n\n${formats.join('\n')}`;
}

/**
 * Sélectionne l'exemple few-shot approprié selon la matière
 */
function getFewShotExample(cardTypes: CardType[]): string {
  // Détecter la catégorie par les types de cartes présents
  if (cardTypes.includes('calculation')) {
    return `## EXEMPLE DE SORTIE (maths)\n\n${FEW_SHOT_MATH}`;
  }
  if (cardTypes.includes('timeline') || cardTypes.includes('matching_era') || cardTypes.includes('cause_effect')) {
    return `## EXEMPLE DE SORTIE (histoire)\n\n${FEW_SHOT_HISTOIRE}`;
  }
  if (cardTypes.includes('matching') || cardTypes.includes('word_order')) {
    return `## EXEMPLE DE SORTIE (langues)\n\n${FEW_SHOT_LANGUES}`;
  }
  // Défaut : maths (le plus complet)
  return `## EXEMPLE DE SORTIE\n\n${FEW_SHOT_MATH}`;
}

/**
 * Construit le prompt de base complet (structure PTCF)
 */
export function getBasePrompt(options: {
  cardTypes: CardType[];
  requiresKaTeX: boolean;
}): string {
  const parts: string[] = [];

  // P - Persona
  parts.push(PERSONA);

  // T - Task
  parts.push(TASK_CORE);

  // C - Context (formats disponibles)
  parts.push(getCardFormatInstructions(options.cardTypes));

  // KaTeX si nécessaire
  if (options.requiresKaTeX) {
    parts.push(KATEX_INSTRUCTIONS);
  }

  // Few-shot example
  parts.push(getFewShotExample(options.cardTypes));

  // F - Format
  parts.push(FORMAT_RULES);

  return parts.join('\n\n');
}

// Exports pour compatibilité (utilisés dans les tests ou ailleurs)
export { getCardFormatInstructions };

// Règles exportées pour les tests
export const CONCISION_RULES = FORMAT_RULES;
export const EXHAUSTIVE_COVERAGE_RULES = TASK_CORE;
export const JSON_SAFETY_RULES = FORMAT_RULES;
