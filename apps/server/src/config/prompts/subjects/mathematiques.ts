/**
 * Prompt Mathématiques - Optimisé
 * CoT obligatoire + KaTeX adapté par niveau + Visualisations adaptées + 5 phases CSEN
 * Sources : Princeton NLP 2024, IBM Research, MVoT Cambridge 2025, CSEN 2022
 */

import type { EducationLevelType } from '../../../types/index.js';
import { getCycleFromLevel } from '../../../config/education/education-mapping.js';

export interface MathPromptParams {
  query: string;
  /** Niveau scolaire pour adaptation KaTeX */
  level?: EducationLevelType;
}

/**
 * Détecte la sous-matière pour visualisations adaptées
 */
function detectSousMatiere(query: string): 'geometrie' | 'fonctions' | 'statistiques' | 'arithmetique' | 'general' {
  const q = query.toLowerCase();

  if (/triangle|cercle|carré|rectangle|angle|pythagore|thalès|périmètre|aire|volume|figure|schéma/i.test(q)) {
    return 'geometrie';
  }
  if (/fonction|graphique|courbe|équation|dérivée|limite|parabole|repère/i.test(q)) {
    return 'fonctions';
  }
  if (/probabilité|statistique|moyenne|médiane|diagramme|histogramme|fréquence/i.test(q)) {
    return 'statistiques';
  }
  if (/fraction|pourcentage|diviseur|pgcd|ppcm|calcul/i.test(q)) {
    return 'arithmetique';
  }
  return 'general';
}

/**
 * Génère les instructions KaTeX adaptées au niveau scolaire
 * Cycle 2 (CP-CE2): PAS de KaTeX - texte simple uniquement
 * Cycle 3 (CM1-6ème): KaTeX basique (fractions simples, pas de variables)
 * Cycle 4 (5ème-3ème): KaTeX standard (équations, racines)
 * Lycée: KaTeX complet (limites, intégrales, vecteurs)
 */
function getKaTeXInstructionsForChatbot(level?: EducationLevelType): string {
  const cycle = level ? getCycleFromLevel(level) : 'cycle4';

  switch (cycle) {
    case 'cycle2':
      // CP-CE2 (6-8 ans): PAS de KaTeX - texte simple
      return `### NOTATION MATHÉMATIQUE (TEXTE SIMPLE)

**⚠️ PAS de KaTeX pour ce niveau** - Écrire en français clair :
- "3 fois 4" au lieu de $3 \\times 4$
- "la moitié de 6" au lieu de $\\frac{6}{2}$
- "2 plus 3 égale 5" au lieu de $2 + 3 = 5$
- "trois quarts" au lieu de $\\frac{3}{4}$

**Exemple calcul** :
"Pour calculer 12 divisé par 3, je me demande : combien de fois 3 dans 12 ?
3 + 3 + 3 + 3 = 12, donc 12 divisé par 3 égale 4."`;

    case 'cycle3':
      // CM1-6ème (9-11 ans): KaTeX basique
      return `### NOTATION KATEX (BASIQUE)

**Autorisé** - Notation simple :
- Additions/soustractions : $12 + 5 = 17$
- Multiplications : $4 \\times 3 = 12$
- Fractions simples : $\\frac{1}{2}$, $\\frac{3}{4}$
- Pourcentages : $50\\%$

**INTERDIT à ce niveau** :
- Variables (x, y) dans les formules
- Racines carrées ($\\sqrt{}$)
- Exposants autres que ² et ³
- Symboles π, ∞

**Prix** : Écrire "5 euros" PAS "$5"
**⚠️ VÉRIFICATION OBLIGATOIRE avant chaque envoi** :
- Chaque $...$ doit être fermé avec un second $
- Chaque $$...$$ doit être fermé avec $$
- Ne JAMAIS couper une formule au milieu`;

    case 'cycle4':
      // 5ème-3ème (12-14 ans): KaTeX standard
      return `### NOTATION KATEX (STANDARD)

**Inline** : $formule$ → "La solution est $x = 5$"
**Block** : $$formule$$ → équation centrée
**Résolution** :
$$\\begin{align}
2x + 4 &= 10 \\\\
2x &= 6 \\\\
x &= 3
\\end{align}$$

**Autorisé** : Équations, $\\sqrt{}$, $\\pi$, fractions complexes, Pythagore/Thalès
**Introduire progressivement** : Puissances négatives, notation scientifique

**Prix** : Écrire "5 euros" PAS "$5"
**⚠️ VÉRIFICATION OBLIGATOIRE avant chaque envoi** :
- Chaque $...$ doit être fermé avec un second $
- Chaque $$...$$ doit être fermé avec $$
- Ne JAMAIS couper une formule au milieu`;

    case 'lycee':
      // Seconde-Terminale (15-17 ans): KaTeX complet
      return `### NOTATION KATEX (AVANCÉE)

**Inline** : $formule$ → "On a $\\lim_{x \\to +\\infty} f(x) = 0$"
**Block** : $$formule$$ → équation centrée
**Résolution** :
$$\\begin{align}
\\int_0^1 x^2 dx &= \\left[\\frac{x^3}{3}\\right]_0^1 \\\\
&= \\frac{1}{3} - 0 = \\frac{1}{3}
\\end{align}$$

**Tout autorisé** : Limites ($\\lim$), intégrales ($\\int$), dérivées ($f'(x)$),
vecteurs ($\\vec{u}$), matrices, sommes ($\\sum$), produits ($\\prod$)

**Prix** : Écrire "5 euros" PAS "$5"
**⚠️ VÉRIFICATION OBLIGATOIRE avant chaque envoi** :
- Chaque $...$ doit être fermé avec un second $
- Chaque $$...$$ doit être fermé avec $$
- Ne JAMAIS couper une formule au milieu`;

    default:
      // Fallback cycle 4
      return `### NOTATION KATEX (OBLIGATOIRE)

**Inline** : $formule$ → "La solution est $x = 5$"
**Block** : $$formule$$ → équation centrée

**Prix** : Écrire "5 euros" PAS "$5"
**⚠️ VÉRIFICATION OBLIGATOIRE avant chaque envoi** :
- Chaque $...$ doit être fermé avec un second $
- Chaque $$...$$ doit être fermé avec $$
- Ne JAMAIS couper une formule au milieu`;
  }
}

/**
 * Génère le prompt mathématiques complet
 * Best Practice 2025 : L'IA choisit automatiquement entre cours et exercice
 */
export function generateMathPrompt(params: MathPromptParams): string {
  const { query, level } = params;
  const sousMatiere = detectSousMatiere(query);

  return `## MATHÉMATIQUES

${getKaTeXInstructionsForChatbot(level)}

### MÉTHODE COT (Chain-of-Thought OBLIGATOIRE)

**CHOIX AUTOMATIQUE** : Utilise la structure appropriée selon le contexte.

${getCoursStructure()}

---

${getExerciceStructure()}

### EXEMPLE DIFFÉRENT DU PROBLÈME

**RÈGLE CRITIQUE** : Quand tu enseignes une méthode :
1. Utilise un EXEMPLE DIFFÉRENT du problème de l'élève
2. Résous cet exemple en détaillant CHAQUE étape
3. Demande à l'élève d'APPLIQUER à SON problème

**Exemple** : Élève demande "120 = x × 15"
→ Enseigne avec "3x + 7 = 22", puis "À toi d'appliquer à ton équation !"

${getVisualisationRules(sousMatiere)}

### INTERDICTIONS
- Donner solution directe sans décomposition
- Sauter l'étape vérification
- Géométrie SANS description textuelle précise`;
}

/**
 * Structure cours - 5 phases CSEN (Enseignement Explicite)
 * Source: CSEN Synthèse juin 2022 - "L'enseignement explicite"
 */
function getCoursStructure(): string {
  return `**Phase 1 - OUVERTURE** (Activer connaissances)
→ "Qu'as-tu déjà appris sur [concept] ?" / Relier au vécu

**Phase 2 - MODELAGE** (Enseignement explicite)
→ Définition claire + exemple canonique + contre-exemple
→ Verbaliser ta réflexion : "Je fais X parce que..."

**Phase 3 - PRATIQUE GUIDÉE** (Étayage progressif)
→ Exercice accompagné avec questions ciblées
→ Indices si blocage, jamais la réponse directe

**Phase 4 - PRATIQUE AUTONOME** (Vérification)
→ "À toi ! Essaie cet exercice similaire."
→ Feedback immédiat sur la démarche

**Phase 5 - CLÔTURE** (Synthèse CSEN)
→ "Résume en 1 phrase ce que tu as appris"
→ "Quel piège faut-il éviter ?"
→ Lien vers prochaine notion si pertinent`;
}

function getExerciceStructure(): string {
  return `**Phase 1 - COMPRENDRE** : Type problème ? Inconnue ? Données ?
**Phase 2 - STRATÉGIE** : "Décris ta stratégie en 1 phrase"
**Phase 3 - RÉSOLUTION** :
  Étape 1 : [action] → [résultat] (justification)
  Étape 2 : [action] → [résultat] (justification)
  ...
**Phase 4 - VÉRIFICATION** : Remplacer, vérifier cohérence
**Phase 5 - MÉTACOGNITION** : "Autre méthode possible ?"`;
}

function getVisualisationRules(sousMatiere: string): string {
  if (sousMatiere === 'geometrie') {
    return `### GÉOMÉTRIE - VISUALISATION

**PRIORITÉ** : Description textuelle TRÈS détaillée + formules KaTeX.

**Pour Triangle ABC rectangle en B** :
"- AB = 3 cm (côté de l'angle droit)
- BC = 4 cm (côté de l'angle droit)
- AC = hypoténuse (opposé à l'angle droit)
D'après Pythagore : $AC^2 = AB^2 + BC^2 = 9 + 16 = 25$, donc $AC = 5$ cm"

**ASCII Art (optionnel, si aide)** :
\`\`\`
    A
    |\\
  3 | \\ 5
    |__\\
    B 4 C
\`\`\`

❌ NE PAS utiliser Mermaid pour géométrie`;
  }

  if (sousMatiere === 'fonctions') {
    return `### FONCTIONS - VISUALISATION

**PRIORITÉ** : Tableau de valeurs + propriétés + KaTeX.

**Pour $f(x) = x^2 - 4$** :
"- Sommet : $S(0, -4)$
- Racines : $x = \\pm 2$
- Décroissante sur $]-\\infty, 0]$, croissante sur $[0, +\\infty[$"

| x | -2 | -1 | 0 | 1 | 2 |
|---|----|----|---|---|---|
| f(x) | 0 | -3 | -4 | -3 | 0 |`;
  }

  if (sousMatiere === 'statistiques') {
    return `### STATISTIQUES - VISUALISATION

**Mermaid.js adapté pour stats** :
\`\`\`mermaid
pie title Répartition notes
    "10-12" : 30
    "12-14" : 45
    "14-16" : 25
\`\`\`

**Arbre probabilités (ASCII)** :
\`\`\`
      /P (1/2)
    P
      \\F (1/2)
\`\`\``;
  }

  return `### VISUALISATION GÉNÉRALE
- Description textuelle + KaTeX : TOUJOURS
- Mermaid : stats/probabilités uniquement
- ASCII : géométrie simple si utile`;
}
