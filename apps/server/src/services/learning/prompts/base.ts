/**
 * Prompts de base pour la génération de cartes - Architecture libre 2025
 *
 * Principes:
 * - L'IA est libre de choisir les types de cartes adaptés au contenu
 * - Pas de limites artificielles de caractères
 * - Guidance pédagogique (Bloom, distracteurs) sans contraintes rigides
 * - Few-shot examples pour le format JSON uniquement
 */

import type { CardType } from '../types.js';

// ============================================================================
// PERSONA - Identité pédagogique
// ============================================================================

const PERSONA = `Tu es un expert pédagogue français créant des cartes de révision.
Tu maîtrises les programmes Éduscol et les sciences cognitives de l'apprentissage.
Tu adaptes naturellement le contenu au niveau de l'élève.`;

// ============================================================================
// PRINCIPES PÉDAGOGIQUES (guidance, pas contraintes)
// ============================================================================

const PEDAGOGICAL_PRINCIPLES = `## PRINCIPES PÉDAGOGIQUES

**Taxonomie de Bloom** - Varie les niveaux cognitifs :
- Mémoriser : flashcard, matching (définitions, vocabulaire)
- Comprendre : vrai_faux, fill_blank (reformulation, identification)
- Appliquer : calculation, word_order (mise en pratique)
- Analyser : cause_effect, classification (décomposition, relations)

**Active Recall** - Chaque carte doit forcer une récupération active en mémoire.

**Interleaving** - Mélange les types et les angles d'approche dans le deck.

**Spacing Effect** - Chaque carte = UNE notion distincte pour permettre la répétition espacée.`;

// ============================================================================
// GUIDANCE DISTRACTEURS (QCM, fill_blank, cause_effect)
// ============================================================================

const DISTRACTOR_GUIDANCE = `## DISTRACTEURS (pour QCM, fill_blank, cause_effect)

Crée des distracteurs pédagogiquement utiles :
- **Erreur de calcul courante** : 2+3×4 → proposer 20 (oubli priorité)
- **Confusion concept proche** : aire vs périmètre, homonymes
- **Erreur de raisonnement** : corrélation/causalité, inversion cause/effet
- **Piège typique du niveau** : accord du participe, signe négatif

Les distracteurs doivent être plausibles mais identifiables par un élève qui maîtrise.`;

// ============================================================================
// FORMAT JSON - Structures par type (exemples, pas contraintes)
// ============================================================================

const CARD_FORMATS: Record<CardType, string> = {
  flashcard: `{"cardType":"flashcard","content":{"front":"Question/concept","back":"Réponse/définition"}}`,
  qcm: `{"cardType":"qcm","content":{"question":"...","options":["A","B","C","D"],"correctIndex":0,"explanation":"..."}}`,
  vrai_faux: `{"cardType":"vrai_faux","content":{"statement":"Affirmation","isTrue":true|false,"explanation":"..."}}`,
  matching: `{"cardType":"matching","content":{"instruction":"Associe...","pairs":[{"left":"...","right":"..."}]}}`,
  fill_blank: `{"cardType":"fill_blank","content":{"sentence":"Phrase avec ___","options":[...],"correctIndex":0,"explanation":"..."}}`,
  word_order: `{"cardType":"word_order","content":{"instruction":"Remets dans l'ordre","words":[...],"correctSentence":"...","translation":"..."}}`,
  calculation: `{"cardType":"calculation","content":{"problem":"Énoncé","steps":["Étape 1","Étape 2"],"answer":"Résultat","hint":"..."}}`,
  timeline: `{"cardType":"timeline","content":{"instruction":"Ordre chronologique","events":[{"event":"...","date":"..."}],"correctOrder":[0,1,2]}}`,
  matching_era: `{"cardType":"matching_era","content":{"instruction":"Associe à l'époque","items":[...],"eras":[...],"correctPairs":[[0,0],[1,1]]}}`,
  cause_effect: `{"cardType":"cause_effect","content":{"context":"...","cause":"...","possibleEffects":[...],"correctIndex":0,"explanation":"..."}}`,
  classification: `{"cardType":"classification","content":{"instruction":"Classe...","items":[...],"categories":[...],"correctClassification":{"cat":[0,1]}}}`,
  process_order: `{"cardType":"process_order","content":{"instruction":"Ordre des étapes","processName":"...","steps":[...],"correctOrder":[...]}}`,
  grammar_transform: `{"cardType":"grammar_transform","content":{"instruction":"Transforme...","originalSentence":"...","transformationType":"tense","correctAnswer":"...","explanation":"..."}}`
};

// ============================================================================
// FEW-SHOT EXAMPLES - Format uniquement
// ============================================================================

const FEW_SHOT_EXAMPLES = `## EXEMPLES DE FORMAT

**Maths/Sciences (avec KaTeX):**
[
  {"cardType":"flashcard","content":{"front":"Formule de l'aire d'un cercle","back":"$A = \\\\pi r^2$ où r est le rayon"}},
  {"cardType":"qcm","content":{"question":"$\\\\frac{3}{4} + \\\\frac{1}{4} = ?$","options":["$\\\\frac{4}{8}$","$1$","$\\\\frac{2}{4}$","$\\\\frac{3}{4}$"],"correctIndex":1,"explanation":"Même dénominateur : $\\\\frac{3+1}{4} = \\\\frac{4}{4} = 1$"}},
  {"cardType":"calculation","content":{"problem":"Résous $2x + 5 = 13$","steps":["$2x = 13 - 5$","$2x = 8$","$x = 4$"],"answer":"$x = 4$"}}
]

**Histoire-Géo:**
[
  {"cardType":"timeline","content":{"instruction":"Remets ces événements dans l'ordre chronologique","events":[{"event":"Prise de la Bastille","date":"14 juillet 1789"},{"event":"Sacre de Napoléon","date":"2 décembre 1804"},{"event":"Révolution de 1848","date":"février 1848"}],"correctOrder":[0,1,2]}},
  {"cardType":"cause_effect","content":{"context":"Révolution française","cause":"Crise financière de la monarchie","possibleEffects":["Convocation des États généraux","Construction de Versailles","Signature du traité de Verdun","Guerre de Cent Ans"],"correctIndex":0,"explanation":"Louis XVI convoque les États généraux pour lever de nouveaux impôts"}}
]

**Langues:**
[
  {"cardType":"matching","content":{"instruction":"Associe chaque mot à sa traduction","pairs":[{"left":"book","right":"livre"},{"left":"house","right":"maison"},{"left":"tree","right":"arbre"}]}},
  {"cardType":"fill_blank","content":{"sentence":"She ___ to school every day.","options":["go","goes","going","went"],"correctIndex":1,"grammaticalPoint":"Present simple - 3rd person singular","explanation":"Avec 'she' (3ème personne), on ajoute -s au verbe"}}
]`;

// ============================================================================
// RÈGLES DE FORMAT JSON
// ============================================================================

const JSON_FORMAT_RULES = `## FORMAT DE SORTIE

Retourne UNIQUEMENT un tableau JSON valide :
- Pas de texte avant/après le JSON
- Pas de blocs markdown (\`\`\`json)
- Guillemets doubles pour les strings
- Nombres sans guillemets (correctIndex: 0, pas "0")
- Booléens sans guillemets (isTrue: true, pas "true")
- KaTeX : double backslash dans JSON (\\\\pi pour afficher \\pi)

**Adapte la longueur au contenu** - une explication complexe peut être plus longue qu'une définition simple.`;

// ============================================================================
// FONCTION PRINCIPALE
// ============================================================================

/**
 * Retourne la liste des formats disponibles
 */
function getAvailableFormats(cardTypes: CardType[]): string {
  const formats = cardTypes.map(type => `- ${type}: ${CARD_FORMATS[type]}`);
  return `## TYPES DE CARTES DISPONIBLES\n\nChoisis les types les plus adaptés au contenu :\n${formats.join('\n')}`;
}

/**
 * Construit le prompt de base complet
 * Architecture libre : guidance sans contraintes rigides
 */
export function getBasePrompt(options: {
  cardTypes: CardType[];
  requiresKaTeX: boolean;
}): string {
  const parts: string[] = [];

  // Persona
  parts.push(PERSONA);

  // Principes pédagogiques (guidance)
  parts.push(PEDAGOGICAL_PRINCIPLES);

  // Guidance distracteurs
  parts.push(DISTRACTOR_GUIDANCE);

  // Types disponibles
  parts.push(getAvailableFormats(options.cardTypes));

  // KaTeX si nécessaire
  if (options.requiresKaTeX) {
    parts.push(KATEX_INSTRUCTIONS);
  }

  // Exemples few-shot
  parts.push(FEW_SHOT_EXAMPLES);

  // Format JSON
  parts.push(JSON_FORMAT_RULES);

  return parts.join('\n\n');
}

// ============================================================================
// KATEX INSTRUCTIONS
// ============================================================================

export const KATEX_INSTRUCTIONS = `## KaTeX (formules mathématiques)

- Inline: $formule$ — Display: $$formule$$
- Dans JSON: double backslash (\\\\pi → \\pi)
- Syntaxe courante: \\frac{a}{b}, \\sqrt{x}, x^2, x_1, \\times, \\leq, \\geq, \\pi, \\sum, \\int`;

// ============================================================================
// EXPORTS
// ============================================================================

export { getAvailableFormats as getCardFormatInstructions };
