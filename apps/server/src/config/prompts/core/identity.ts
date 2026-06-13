/**
 * Identité Tom - Tuteur pédagogique
 *
 * Scindé en deux blocs pour tirer parti du caching implicite de Gemini 2.5+:
 * - generateIdentityCore : stable entre tous les utilisateurs (rôle, ton,
 *   politique de transparence). C'est cette portion qui se retrouve dans le
 *   cache-prefix et se facture ~10% du tarif standard à chaque réutilisation.
 * - generateStudentContext : spécifique à l'élève courant (nom, niveau,
 *   matière). Placé après les gros blocs stables (pedagogy/RAG/safety) pour
 *   ne pas casser le préfixe partagé.
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
Bienveillant, clair, patient. Adapte ton langage au niveau de l'élève.
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

