/**
 * Adaptation par matière
 * Seulement les spécificités uniques à chaque matière
 * La pédagogie (CSEN/Dehaene) est dans shared/pedagogy
 */

type SubjectType =
  | 'mathematiques'
  | 'francais'
  | 'langues'
  | 'sciences'
  | 'histoire-geo'
  | null;

/**
 * Source unique des spécificités par matière
 * Utilisé par generateSubjectSpecifics() et generateSubjectBlock()
 */
const SUBJECT_SPECIFICS: Record<Exclude<SubjectType, null>, string> = {
  mathematiques: `<subject_specifics matiere="Mathématiques">
**NOTATION**: Utilise KaTeX ($...$) adapté au niveau. Prix en euros: "5 euros" pas "$5".
**MÉTHODE**: Chain-of-Thought obligatoire. Étape par étape avec justifications.
**VÉRIFICATION**: Toujours demander de vérifier le résultat.
**VISUALISATION**: Géométrie → description textuelle détaillée. ASCII optionnel.
**EXEMPLE**: Utilise un exemple DIFFÉRENT du problème de l'élève pour enseigner, puis "À toi d'appliquer !"
</subject_specifics>`,

  francais: `<subject_specifics matiere="Français">
**ANALYSE TEXTUELLE** - 4 niveaux:
1. Littéral (qui, quoi, où, quand)
2. Inférentiel (déduire l'implicite)
3. Interprétatif (style, procédés)
4. Critique (opinion argumentée)

**ÉCRITURE**: Planification → Rédaction → Révision → Correction.
**VOCABULAIRE**: Toujours en contexte, jamais de listes isolées.
**ORTHOGRAPHE**: Corriger APRÈS validation du sens. Expliquer la règle.
</subject_specifics>`,

  langues: `<subject_specifics matiere="Langues vivantes">
**CECRL**: A1-A2 (collège) → B1-B2 (lycée).
**i+1 (Krashen)**: Input légèrement supérieur au niveau actuel.
**GRAMMAIRE INDUCTIVE**: 3 exemples → observation → règle → application.
**FEEDBACK**: Sens d'abord ("J'ai compris !"), forme ensuite ("Un anglophone dirait...").
**CONTEXTUALISATION**: Situations authentiques (restaurant, voyage...).
</subject_specifics>`,

  sciences: `<subject_specifics matiere="Sciences">
**DÉMARCHE IBL** (Inquiry-Based Learning):
1. Observation → 2. Question → 3. Hypothèse ("Si...alors...") → 4. Investigation → 5. Conclusion

**ANALOGIES**: Obligatoires pour concepts abstracts + mentionner leurs limites.
**FORMULES**: KaTeX + unités OBLIGATOIRES ("5 m/s" pas juste "5").
**MISCONCEPTIONS**: Anticiper erreurs courantes (ex: "objets lourds tombent plus vite" → faux).
</subject_specifics>`,

  'histoire-geo': `<subject_specifics matiere="Histoire-Géographie-EMC">
**ANALYSE SOURCE**: Identification → Description → Contexte → Critique → Mise en perspective.
**CAUSALITÉ**: Distinguer causes profondes / moyennes / déclencheur. Causes ≠ prétextes.
**GÉOGRAPHIE**: Toujours multi-échelles (local → national → mondial).
**EMC**: Méthode du dilemme moral + valeurs républicaines.
**VOCABULAIRE**: Précis (Révolution ≠ Révolte ≠ Coup d'État). Pas d'anachronismes.
</subject_specifics>`
};

/**
 * Normalise le nom de matière
 */
function normalizeSubject(subject: string): SubjectType {
  const s = subject.toLowerCase().trim();

  if (s.includes('math')) return 'mathematiques';
  if (s === 'français' || s === 'francais') return 'francais';
  if (['anglais', 'espagnol', 'allemand', 'italien', 'english', 'spanish'].includes(s)) {
    return 'langues';
  }
  if (['svt', 'sciences', 'biologie', 'physique', 'chimie', 'physique-chimie'].includes(s)) {
    return 'sciences';
  }
  if (['histoire', 'géographie', 'geographie', 'histoire-geo', 'emc', 'hggsp'].includes(s)) {
    return 'histoire-geo';
  }

  return null;
}

/**
 * Génère les spécificités pour UNE matière
 */
function generateSubjectSpecifics(subject: string): string | null {
  const normalized = normalizeSubject(subject);
  if (!normalized) return null;
  return SUBJECT_SPECIFICS[normalized];
}

/**
 * Génère le bloc matière pour le system prompt
 * - Si subject fourni : retourne les spécificités de cette matière
 * - Sinon : retourne un fallback court (économise ~600 tokens vs ALL)
 */
export function generateSubjectBlock(subject?: string): string | null {
  if (subject) {
    return generateSubjectSpecifics(subject);
  }
  return `<subject_specifics matiere="multi">
Adapte ta méthode à la matière abordée: Chain-of-Thought en maths, analyse textuelle en français, démarche IBL en sciences, analyse de sources en histoire-géo.
</subject_specifics>`;
}

