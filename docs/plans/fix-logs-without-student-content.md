# Plan — fix/logs-without-student-content

Lot 2, point 7 (`docs/roadmap.md`), deuxième PR : aucun contenu d'élève dans les logs.
Constat : `docs/etudes/2026-10-04/refonte-agent.md`, « Autres usages de l'IA ». Chemins
relatifs à `apps/server/src/`.

## Recensement (2026-10-05)

Toutes les clés passées au logger, relevées par l'AST de TypeScript hors tests :
- **messages d'erreur de l'AI SDK** : `TypeValidationError` recopie la sortie du modèle
  (« Value: ${JSON.stringify(value)} », `@ai-sdk/provider` 4.0.17), `JSONParseError` le texte
  (« Text: ${text} »), `InvalidToolInputError` le message de sa cause (`ai` 7.0.107) ; le
  serializer d'erreurs (`platform/observability/logger.ts`) garde `message` et `stack`, dont
  la première ligne le répète ;
- **titre de séance** (`auto-title.service.ts`), tiré de la conversation ;
- **sujet saisi** pour les cartes (`topic`, `card-generate.routes.ts`,
  `card-generator.service.ts`) et pour une séance (`chat-session.service.ts`, avec le détail
  postgres, `pgDetail`, qui recopie les valeurs d'une ligne refusée) ;
- **nom de fichier** (`document-extraction.service.ts`), et **clé de stockage**, loggée sept
  fois, qui le contient (`uploads/{userId}/{timestamp}-{fileId}-{nom}`) ; la clé part aussi
  dans les journaux du stockage objet ;
- **message d'erreur brut** des cartes (`_actualError`), hors du serializer.

## Tâches

1. Serializer : pour ces trois erreurs de l'AI SDK, le message sans le contenu, sur
   `message`, `stack` et chaque `cause`.
2. Appels : titre, sujet saisi, nom de fichier, `pgDetail` et `_actualError` retirés ; une
   longueur ou un identifiant à la place quand il sert.
3. Clé de stockage sans le nom de fichier (`uploads/{userId}/{timestamp}-{fileId}`) : rien ne
   le relit, le nom reste en base.
4. Tests : erreurs de l'AI SDK sérialisées sans leur contenu, cause comprise ; clé de
   stockage ; appels sans les champs retirés.
5. `docs/suivi.md`.

## Validation

`bun run typecheck`, `bun run lint`, `bunx knip`, `bun run test`.
