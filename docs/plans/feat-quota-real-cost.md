# Plan — feat/quota-real-cost

Lot 2, point 8, deuxième PR : le quota compte le coût réel, lecture vocale comprise (décidé le
2026-10-06, `docs/suivi.md`). Chemins relatifs à `apps/server/src/`.

## Pré-vol (2026-10-06, contre `main` à `d0cea6a9`)

- Depuis #400, `cost_tracking` reçoit chaque appel facturé, en micro-euros, pour son élève. Le
  quota tient pourtant ses propres compteurs de tokens dans `user_subscriptions` (fenêtre de 5 h,
  jour, semaine, totaux), alimentés par le seul tour de chat, au prix plein du cache.
- `subscription_plans` n'a aucune ligne (ni migration ni seed) : `ensureUserSubscription` lève
  « Free plan not found », et la consommation n'est jamais comptée. Ses colonnes (limite en
  tokens, prix 15 € + 5 €) ne sont plus lues : seul `name` sert.
- `/api/tts/synthesize` n'a aucun quota.
- Le mois des fiches passe par `Intl.DateTimeFormat`, le jour et la semaine par date-fns.
- Arbitrages :
  - la consommation se lit dans `cost_tracking` (somme des `cost_micro_eur` depuis la dernière
    remise à zéro, 10 h à Paris) au lieu de compteurs tenus à part : un seul fait, à un seul
    endroit, et tous les appels y sont ;
  - un budget par jour, sans la fenêtre de 5 h : le budget en euros borne déjà la dépense ;
  - la formule devient une colonne de `user_subscriptions` (enum `subscription_plan_type`), la
    table `subscription_plans` disparaît : plus de ligne à insérer pour que le quota marche ;
  - budgets provisoires, à fixer par Victor sur le coût mesuré au passage de fin
    (`docs/vision.md`, « Offre et prix ») : Gratuit 20 000 µ€ (2 c) par jour, Complet
    100 000 µ€ (10 c). Au plafond chaque jour, 0,60 € et 3 € par mois ; une fiche d'exercice
    (trois tirages en raisonnement) coûte de l'ordre de quelques milliers de µ€, une lecture
    vocale de 500 caractères environ 8 000 µ€.

## Tâches

1. **Budget** (`quota-config.ts`) : `dailyBudgetMicroEur` par formule ; `checkQuota` rend
   autorisé, formule, dépensé, budget, pourcentage, remise à zéro. Dépensé = somme de
   `cost_tracking` depuis la dernière remise à zéro ; index `(user_id, created_at)`.
2. **Schéma** : `user_subscriptions.plan` remplace `plan_id` ; retirés : `subscription_plans`,
   les compteurs de tokens (`window_*`, `tokens_used_*`, `last_weekly_reset_at`, `total_*`) et les
   colonnes jamais lues (`total_days_active`, `cancelled_at`, `metadata`). Migration.
3. **Appelants** : `incrementTokenUsage` disparaît (le tour de chat est déjà dans
   `cost_tracking`) ; la route de chat et `/api/subscriptions/usage` passent au budget ;
   `/api/tts/synthesize` vérifie le quota avant la synthèse (429 `QUOTA_EXCEEDED`).
4. **Fiches** : le mois par date-fns, comme le jour ; compteurs de paquets inchangés.
5. **Tests** : budget atteint ou non, remise à zéro de 10 h, sans abonnement = Gratuit,
   lecture vocale refusée au-delà ; intégration : la somme lue dans `cost_tracking`.
6. **Doc** : `docs/suivi.md` (défauts de coût et forfaits absents), `docs/agent.md` § 13.

## Hors périmètre

- Fiches de l'outil du chat réservées au Complet, outil imposé par le code : PR suivante.
- Paiement et passage au Complet : lot 3.

## Validation

`bun run typecheck`, `bun run lint`, `bunx knip`, `bun run test`, `db:check`,
`bun run test:integration`.
