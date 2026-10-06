# Plan — feat/cost-tracking-every-call

Lot 2, point 8 (`docs/roadmap.md`), première PR : chaque appel IA tracé dans `cost_tracking`, à
une précision inférieure au centime (`docs/agent.md` § 13). Le quota lui-même (unité, montant)
attend la décision de Victor et la mesure du passage de fin. Chemins relatifs à `apps/server/src/`.

## Pré-vol (2026-10-06, contre `main` à `6fd41c44`)

- Plan réécrit après le nettoyage (#396 à #399) : plus d'embeddings ni d'épisodes, plus de
  `/health/ai`.
- Sont tracés, chacun par un appel à la main : le tour de chat (`finishTurn`), la fiche
  d'exercice, le diagnostic, l'extraction de document. Ne le sont pas : analyse du tour, titre,
  résumé, cartes (route et outil du chat), STT, TTS.
- `cost_cents` est un entier : un tour de texte (0,035 à 0,10 c, `etudes/2026-10-01/couts.md`)
  s'arrondit à 0. Rien ne lit la table.
- La modération (`mistral-moderation-2603`, entrée, sortie, cartes) est gratuite
  (https://docs.mistral.ai/models/mistral-moderation-26-03, « Free ») : rien à tracer.
- Arbitrage : `platform/` n'importe aucun module (`docs/architecture.md`). Pour que le client
  trace chaque appel par construction, le calcul et l'écriture du coût passent de
  `modules/billing/cost-tracking.service.ts` à `platform/ai/cost.ts`, qui écrit la table par
  `db/schema` comme le moteur de session lit les siennes. La table reste dans `billing`, qui la
  lira pour le quota.

## Tarifs (vérifiés le 2026-10-06)

- `mistral-small-2603` : 0,15 $ et 0,60 $ par million de tokens, entrée et sortie ; cache à
  10 % ; endpoint UE ×1,1.
- `voxtral-mini-2602` (STT) : 0,003 $ par minute
  (https://docs.mistral.ai/models/voxtral-mini-transcribe-26-02) ; la réponse donne
  `usage.promptAudioSeconds` (`@mistralai/mistralai` 2.7.0, `UsageInfo`).
- `voxtral-mini-tts-2603` (TTS) : 0,016 $ pour 1 000 caractères du texte lu
  (https://mistral.ai/news/voxtral-tts/) ; la réponse ne donne pas d'usage, le serveur compte
  les caractères envoyés.

## Tâches

1. **Précision** : `cost_micro_eur` (entier, 1 µ€ = 0,0001 c) remplace `cost_cents` ;
   migration 0001.
2. **Enregistreur** dans `platform/ai/cost.ts` : prix par modèle daté, tokens, secondes d'audio,
   caractères ; un modèle inconnu donne une ligne à 0 marquée, comme aujourd'hui.
3. **Par construction** : `generateText` et `generateStructured` reçoivent un propriétaire
   obligatoire (élève et séance, ou `null` hors élève : éval, tests réels) et tracent leur usage,
   opération = `functionId`, réparation comprise. Propriétaire passé par l'analyse du tour, le
   résumé, le titre, les cartes (route et outil), la fiche, le diagnostic, l'extraction ; les
   traçages à la main de ces trois derniers disparaissent, ils compteraient deux fois.
4. **Chat, STT, TTS** : le tour de chat garde son traçage dans `finishTurn`, par l'enregistreur ;
   STT et TTS reçoivent le même propriétaire obligatoire.
5. **Tests** : coût de chaque sorte d'appel, cache compris ; un appel du client tracé une fois
   avec son propriétaire, rien pour `null` ; STT et TTS tracés avec leurs unités.
6. **Doc** : `docs/suivi.md` (défauts de coût du lot 2), `docs/agent.md` § 13,
   `docs/architecture.md` (`billing` et `platform/ai`).

## Hors périmètre

- Unité et montant du quota, TTS sous quota, fiches réservées au Complet dans le chat, outil de
  fiches imposé par le code, forfaits absents de `subscription_plans` : PR suivantes du point 8.

## Validation

`bun run typecheck`, `bun run lint`, `bunx knip`, `bun run test`, `db:check`,
`bun run test:integration`.
