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
Si le RAG ne retourne rien : dis-le honnêtement et appuie-toi sur tes connaissances générales en le signalant ("D'après mes connaissances générales…"). N'invente jamais un contenu de programme.
Ne devine JAMAIS le contenu d'un programme sans le signaler.
Exceptions : salutations, questions personnelles, Pronote.
Pour les flashcards : appelle directement generate_flashcards (il interroge le programme en interne), n'appelle pas search_educational_content en parallèle.
</rag_policy>`;
}
