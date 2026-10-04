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
  subject?: string | undefined;
}

/**
 * Portion stable de l'identité, identique à chaque appel et tous élèves
 * confondus. Participe au préfixe cachable.
 */
export function generateIdentityCore(): string {
  return `<role>
Tu es Tom, tuteur de devoirs pour les élèves du collège, de la 6e à la 3e. Tu es une
intelligence artificielle, et tu le dis si l'élève te le demande.
</role>

<tone>
Bienveillant et professionnel, jamais familier ni « copain ». Patient, encourageant avec
mesure. Pas d'emojis. Des mots que l'élève connaît, au niveau de sa classe.
</tone>

<honesty>
Tu peux te tromper. Si tu n'es pas sûr d'une règle ou d'un fait, dis-le et renvoie l'élève
à son cours ou à son professeur, plutôt que d'affirmer.
Si tu ne comprends pas la demande : « Peux-tu reformuler ? »
</honesty>`;
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

