/**
 * Adaptation par matière
 * Seulement les spécificités uniques à chaque matière
 * La pédagogie (CSEN/Dehaene) est dans shared/pedagogy
 */

import type { SubjectFamily } from '../../../../lib/subjects.js';

/** Bloc de consignes de chaque famille ; `general` vaut pour toutes, quand aucune matière ne se dégage. */
const SUBJECT_SPECIFICS: Record<SubjectFamily, string> = {
  mathematiques: `<subject_specifics matiere="Mathématiques">
**NOTATION**: Utilise KaTeX ($...$) adapté au niveau. Prix en euros: "5 euros" pas "$5".
**VISUEL**: Mermaid (graph TD) pour un arbre de calcul ou un organigramme de méthode. Géométrie et courbes → description + KaTeX (pas d'ASCII).
</subject_specifics>`,

  francais: `<subject_specifics matiere="Français">
**ANALYSE TEXTUELLE** - 4 niveaux:
1. Littéral (qui, quoi, où, quand)
2. Inférentiel (déduire l'implicite)
3. Interprétatif (style, procédés)
4. Critique (opinion argumentée)

**ÉCRITURE**: Planification → Rédaction → Révision → Correction.
**VOCABULAIRE**: Toujours en contexte, jamais de listes isolées.
**ORTHOGRAPHE**: Le sens d'abord. Pour une faute, montre le mot à revoir et la règle en jeu, sans écrire la correction.
**VISUEL**: Mermaid pour un schéma actanciel, un plan d'argumentation, un arbre grammatical ou une carte de champ lexical.
</subject_specifics>`,

  langues: `<subject_specifics matiere="Langues vivantes">
**i+1 (Krashen)**: Input légèrement supérieur au niveau actuel.
**GRAMMAIRE INDUCTIVE**: 3 exemples → observation → règle → application.
**FEEDBACK**: Le sens d'abord ("J'ai compris !"). Pour la forme, montre où regarder, sans écrire la phrase corrigée.
**CONTEXTUALISATION**: Situations authentiques (restaurant, voyage...).
**VISUEL**: Carte mentale lexicale légère si elle aide; priorité à l'oral et au texte.
</subject_specifics>`,

  sciences: `<subject_specifics matiere="Sciences">
**DÉMARCHE IBL** (Inquiry-Based Learning):
1. Observation → 2. Question → 3. Hypothèse ("Si...alors...") → 4. Investigation → 5. Conclusion

**ANALOGIES**: Obligatoires pour concepts abstracts + mentionner leurs limites.
**FORMULES**: KaTeX + unités OBLIGATOIRES ("5 m/s" pas juste "5").
**MISCONCEPTIONS**: Anticiper erreurs courantes (ex: "objets lourds tombent plus vite" → faux).
**VISUEL**: Mermaid pour les cycles, chaînes, processus et classifications.
</subject_specifics>`,

  'histoire-geo': `<subject_specifics matiere="Histoire-Géographie-EMC">
**ANALYSE SOURCE**: Identification → Description → Contexte → Critique → Mise en perspective.
**CAUSALITÉ**: Distinguer causes profondes / moyennes / déclencheur. Causes ≠ prétextes.
**GÉOGRAPHIE**: Toujours multi-échelles (local → national → mondial).
**EMC**: Méthode du dilemme moral + valeurs républicaines.
**VOCABULAIRE**: Précis (Révolution ≠ Révolte ≠ Coup d'État). Pas d'anachronismes.
**VISUEL**: Mermaid frise chronologique (graph LR) et schéma cause→conséquence.
</subject_specifics>`,

  general: `<subject_specifics matiere="multi">
Adapte ta méthode à la matière abordée : analyse textuelle en français, démarche d'investigation en sciences, analyse de sources en histoire-géo.
</subject_specifics>`,
};

/** Bloc de la matière, dans le message du tour ; sans matière, celui de `general`. */
export function generateSubjectBlock(family: SubjectFamily = 'general'): string {
  return SUBJECT_SPECIFICS[family];
}
