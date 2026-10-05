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

### Après revue

La liste de trois classes laissait passer d'autres messages qui recopient du contenu,
vérifiés dans les paquets installés :
- `DrizzleQueryError` (drizzle-orm 0.45) écrit les paramètres de la requête, donc tout texte
  d'élève écrit en base ; postgres recopie une valeur refusée dans son message ;
- les erreurs du SDK Mistral (2.7.0) recopient le corps de la réponse ;
- `RetryError` de l'AI SDK reprend le message des erreurs qu'elle enveloppe ;
- un texte de modèle dont une ligne commence par « at » passait le filtre de la pile ;
- l'URL présignée porte les en-têtes `x-amz-meta-*` dans sa requête : le nom de fichier y
  était encore.

## Tâches

1. Serializer, par famille, aux trois frontières qui portent du contenu :
   - base : le texte SQL sans les paramètres ; postgres, son code SQLSTATE, sa table, sa
     colonne et sa contrainte ;
   - SDK Mistral : le nom et le statut HTTP ;
   - AI SDK : le nom ; l'outil d'une entrée invalide ; une relance, ses tentatives et sa
     raison, sa dernière erreur en cause ; les messages fixes de `NoObjectGeneratedError` ;
   - la pile, prise après le message exact, sans filtre sur son contenu.
2. Appels : titre, sujet saisi, nom de fichier, `pgDetail` et `_actualError` retirés ; une
   longueur ou un drapeau à la place quand il sert ; les champs postgres de la création de
   séance, toujours vides (lus sur l'erreur de drizzle), retirés : la cause les porte.
3. Clé de stockage sans le nom de fichier, avec son extension
   (`uploads/{userId}/{timestamp}-{fileId}.pdf`) ; le nom n'est plus signé dans l'URL
   d'upload ; il reste en base.
4. Tests : chaque famille d'erreurs sans son contenu, cause et pile comprises ; clé et URL
   signée ; logs de la séance et des cartes sans le sujet saisi, en succès et en échec.
5. `docs/suivi.md`.

## Validation

`bun run typecheck`, `bun run lint`, `bunx knip`, `bun run test`.
