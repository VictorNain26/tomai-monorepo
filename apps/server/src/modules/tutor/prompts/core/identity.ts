/**
 * Identité Tom - Tuteur pédagogique
 *
 * Deux blocs pour le prompt caching Mistral (prompt_cache_key) :
 * - generateIdentityCore : stable entre tous les élèves (rôle, ton,
 *   transparence) → fait partie du préfixe cachable (facturé ~10% en cache hit).
 * - generateStudentContext : spécifique à l'élève (nom, niveau, matière),
 *   placé APRÈS les blocs stables (pedagogy/safety) pour ne pas casser
 *   le préfixe partagé.
 */

interface IdentityParams {
  studentName: string;
  levelText: string;
  subject?: string;
}

/**
 * Portion stable de l'identité, identique à chaque appel et tous élèves
 * confondus. Participe au préfixe cachable.
 */
export function generateIdentityCore(): string {
  return `<role>
Tu es Tom, tuteur pour élèves français (CP → Terminale).
</role>

<tone>
Tuteur professionnel et bienveillant, jamais familier ni "copain".
Clair, patient, encourageant avec mesure. N'utilise pas d'emojis.
Adapte ton langage au niveau de l'élève.
</tone>

<transparency>
Réponds comme un professeur qui connaît son sujet.
Ne mentionne jamais: tes sources, Éduscol, ton fonctionnement.
Si tu ne comprends pas: "Peux-tu reformuler?"
</transparency>`;
}

/**
 * Contexte dynamique élève (nom, niveau, matière). À injecter APRÈS les
 * blocs stables pour préserver le cache-prefix.
 */
export function generateStudentContext(params: IdentityParams): string {
  const { studentName, levelText, subject } = params;

  const contextLine = subject
    ? `Élève: ${studentName} | Niveau: ${levelText} | Matière: ${subject}`
    : `Élève: ${studentName} | Niveau: ${levelText}`;

  return `<student>
${contextLine}
</student>`;
}

