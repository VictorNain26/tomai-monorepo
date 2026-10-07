# Plan — le chat de l'élève (étape 6, PR 6c)

Pré-vol (2026-10-07) : le serveur répond à un tour par le flux de messages UI de l'AI SDK
(`POST /api/sessions/:id/messages`, corps `{ text, inputMode }`, #435), et liste les séances et leurs
messages (#434). Le web a le foyer et le jumelage (#439). `useChat` n'envoie que le dernier message
par `prepareSendMessagesRequest` (ai-sdk.dev, « Chatbot Message Persistence ») ; une réponse non
OK lève une `APICallError` qui porte le corps du problème. Dépendances vérifiées le 2026-10-07 :
`@ai-sdk/react` 4.0.131 (11,1 M de téléchargements par semaine, publiée le 2026-10-05), qui épingle
`ai` 7.0.128, la version du serveur : une seule version d'`ai` dans le lockfile.

## Problème

Victor ne peut pas encore parler à Tom : aucun écran n'appelle le tuteur.

## Critères d'acceptation

- [ ] L'accueil de l'élève liste ses séances (titre, ou sa date) et en ouvre une nouvelle.
- [ ] `/seance/$sessionId` : l'historique, puis le chat par `useChat` ; Tom qui réfléchit se voit.
- [ ] Les refus du serveur en français : quota du jour, tour déjà en cours, trop de requêtes, et
      tout autre échec sans le message interne.
- [ ] Parcours prouvés à largeur de téléphone, WebKit et Chromium : un élève relié ouvre une séance,
      envoie un message et lit la réponse ; le quota épuisé se dit. Le tour y est simulé par
      `page.route` ; le vrai tour est couvert par les tests du serveur avec le faux Mistral.

## Hors périmètre

Photo et voix (lot 3), mention IA dès la première interaction (lot 3), la mémoire entre séances
(PR suivante), le premier test complet dans Chrome (après le merge).

## Vérification de bout en bout

`bun run typecheck && bun run lint && bun run test`, la suite Playwright du web.

## Décision humaine

Étape 6 sur les composants de base, sans travail de style : Victor, 2026-10-07.
