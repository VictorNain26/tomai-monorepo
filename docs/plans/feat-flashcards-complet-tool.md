# Plan — feat/flashcards-complet-tool

Lot 2, point 8, troisième PR : les fiches de révision du chat réservées au Complet, et l'outil
imposé par le code quand l'analyse du tour relève une demande ou un accord (décidé le 2026-10-06,
`docs/suivi.md`). Chemins relatifs à `apps/server/src/`.

## Pré-vol (2026-10-06, contre `main` à `a3ac7ede`)

- L'outil `generate_flashcards` est donné à tout élève, Gratuit compris, alors que la route
  `/api/learning/generate` réserve les fiches au Complet (`docs/vision.md`, « Offre et prix »).
- Quand l'analyse relève une demande (`wantsFlashcards`), l'outil est approuvé mais le modèle
  reste libre de ne pas l'appeler : en S4 (2026-10-05), Small 4 a refusé des fiches demandées
  puis confirmées, au nom d'une règle qu'aucune consigne ne donne.
- `ai` 7.0.107 : `prepareStep` peut rendre `toolChoice: { type: 'tool', toolName }` ;
  `@ai-sdk/mistral` 4.0.48 le traduit en ne gardant que cet outil avec `tool_choice: "any"`
  (`dist/index.js`, « mistral does not support tool mode directly »).
- Arbitrage, sur l'accord de Victor du 2026-10-06 de retirer ce qui ne sert pas : les compteurs
  de paquets (5 par jour, 50 par mois, `quota-deck.ts`, colonnes de `user_subscriptions`) partent.
  Le budget en euros (#401) borne déjà le coût des cartes, route et outil compris ; la vision ne
  promet aucun nombre de paquets.

## Tâches

1. **Complet seulement** : la route de chat passe la formule (`checkQuota`) à `buildChatTools`,
   qui ne donne l'outil qu'au Complet. En Gratuit, une demande de fiches reçoit une consigne du
   tour : les fiches sont réservées à la formule Complet, le dire en une phrase et revenir à
   l'exercice.
2. **Outil imposé** : au Complet, quand l'analyse relève une demande, le premier pas impose
   l'outil (`prepareStep`, `toolChoice`) ; le refus de l'outil sans demande reste (approbation).
3. **Compteurs de paquets retirés** : `quota-deck.ts`, `checkDeckQuota`, `incrementDeckUsage`,
   les colonnes `decks_generated_*`, `last_reset_at`, `last_monthly_reset_at`, et ce qui ne sert
   plus qu'à eux (`ensure`, `needsDailyReset`, `needsMonthlyReset`). Migration.
4. **Tests** : outil absent en Gratuit et consigne du tour ; premier pas forcé sur une demande,
   libre sinon ; route de cartes sans compteurs.
5. **Doc** : `docs/suivi.md` (défauts de coût, « Fiches refusées par le modèle »), `docs/agent.md`.

## Hors périmètre

- Passage de fin (mesure du coût d'une soirée, budgets définitifs).

## Après revue

- Un seul paquet par tour : après l'appel imposé, l'outil sort des outils actifs, sinon le modèle,
  l'approbation toujours acquise, pouvait en refaire jusqu'à la fin des pas.
- L'accès aux fiches se décide une fois, dans `billing` (`QuotaCheckResult.flashcards`) : un
  Complet actif et non expiré ; sur une lecture en échec, ni fiches ni avis (`null`), la route de
  cartes répond 503. Les deux routes lisent ce champ.
- Approbation et `prepareStep` déclarés seulement quand l'outil est là ; JSDoc de
  `turnInstruction` remise à sa place ; tests du branchement de la route, de l'appel unique et du
  tour sans outil.

## Validation

`bun run typecheck`, `bun run lint`, `bunx knip`, `bun run test`, `db:check`,
`bun run test:integration`.
