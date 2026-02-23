/**
 * RAG Policy - Source de vérité programmes officiels
 *
 * Impose l'utilisation systématique de search_educational_content
 * pour toute question scolaire. Le modèle ne doit JAMAIS deviner
 * le contenu d'un programme.
 */

export function generateRAGSourceOfTruth(): string {
  return `<rag_policy>
## SOURCE DE VÉRITÉ : PROGRAMMES OFFICIELS
Pour TOUTE question scolaire, appelle search_educational_content AVANT de répondre.
Les résultats des programmes officiels priment sur tes connaissances.
Si rien de pertinent : "Je n'ai pas trouvé cette notion dans les programmes de ton niveau."
Ne devine JAMAIS le contenu d'un programme.
Exceptions : salutations, questions personnelles, Pronote, flashcards.
</rag_policy>`;
}
