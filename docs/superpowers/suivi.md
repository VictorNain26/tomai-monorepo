# Suivi des travaux

Source de vérité de l'avancement. **À lire en premier en reprenant le travail**, et à
mettre à jour dans la même PR que le travail qu'il décrit (PR ouverte, mergée, étape
manuelle faite, bloquant levé).

Specs : `specs/2026-09-22-cible-v1.md`, `specs/2026-09-22-agent-ia.md`.
Roadmap : `plans/2026-09-22-roadmap.md`. Plan du lot en cours :
`plans/2026-09-22-lot-0-assainissement.md` (index) et ses plans par PR.

## Où on en est

- **Dernière mise à jour :** 2026-09-22
- **Lot en cours :** 0 — Assainissement
- **Prochaine action :** démarrer la PR E1 (`plans/2026-09-22-lot-0-e-code-reinvente.md`,
  branche `refactor/replace-custom-ai-calls`) avec le skill
  `superpowers:subagent-driven-development`.

## Reporté depuis les PR A et B

Constats hors périmètre de A, à traiter dans la PR indiquée :

- **PR B** : l'override `'nanoid@5'` résout `nanoid@6` et son commentaire est faux ;
  `.vscode/extensions.json` recommande encore `ruff`/`python`. La copie en `ArrayBuffer` de
  `encryption.ts:51-53,72-73` est à revérifier.
- **Surveillance** : le graphe de dépendances GitHub liste encore `apps/curriculum/uv.lock` et
  `apps/ai-service/uv.lock` (supprimés en `8f5011f`, 0 dépendance) et y rattachait de nouvelles
  alertes (#317 créée le 2026-09-19). Les 70 alertes ont été classées `inaccurate` le
  2026-09-22. Si une alerte réapparaît sur ces chemins, ouvrir un ticket au support GitHub.
  Dependabot ne sert qu'à détecter (alertes + graphe, source de `vulnerabilityAlerts`) ; ses
  PR de version et de sécurité restent désactivées, Renovate ouvre toutes les PR.
- **PR E (depuis la PR B)** : champs morts `IAppUser.parentId` (`packages/api/src/types.ts:23`)
  et `ElysiaAuthenticatedUser.parentId` (`apps/server/src/types/index.ts:17`), exemple périmé
  `pool-limiter.ts:57` ; `react@19.2.3` et un second `next` résolus comme peers optionnels de
  better-auth côté serveur (`pnpm dedupe` à tenter) ; indice knip sur `ignoreBinaries` de
  `apps/server/knip.json`.
- **Plafonds de version à lever à la main** (Renovate ne les proposera pas) : TypeScript
  `<6.1.0` tant que `typescript-eslint` exige `typescript <6.1.0` (TS 7 sans API JS avant
  la 7.1, issue typescript-eslint #10940) ; `@types/node` `<25.0.0` tant que le runtime est
  Node 24 (Vercel ne propose que 24.x, 22.x, 20.x ; Node 26 LTS le 2026-10-28).
- **Lot 3** : colonnes RevenueCat de `family_billing`, enum `billing_status` et commentaires
  de `billing.schema.ts` (dont `:179`) ; `app-guide-data.ts` à réécrire avec la navigation
  web. Le code de `BillingService` et `plan-cache` se retrouve avec
  `git log --diff-filter=D -- apps/server/src/services/billing/`. Le coût est stocké en
  centimes entiers : un tour (~0,05 centime) s'arrondit à 0 ; à revoir avec la facturation
  web.
- **PR E** : deux copies de `@ai-sdk/provider` (4.0.17 et 4.0.2, erreurs IDE seulement,
  `tsc` vert) à dédupliquer ; `capturedResult.totalUsage` déprécié dans
  `chat-message.routes.ts` (même sémantique que `usage`), même fichier appelle la méthode
  instance dépréciée `capturedResult.toUIMessageStream(...)` (ai@7 : « Use the standalone
  `toUIMessageStream` helper from 'ai' with `result.stream` ») ; Voxtral TTS/STT via fetch
  maison alors que `@mistralai/mistralai` 2.7.0 expose `audioSpeechComplete`/`audioVoices`.
- **Lot 3 — TTS** : `language` de `/api/tts` accepté mais ignoré, toutes les langues lues
  avec `fr_marie_neutral` (seuls presets fr/en/gb existent ; es/de sans voix) ;
  `/api/tts/voices` annonce encore ces langues.
- **Lot 2** : le quota compte `totalTokens` (tokens cachés et de raisonnement inclus) ;
  observation, antérieure à C.
- **Surveillance** : `pronote.test.ts` live échoue en `PageUnavailableError` sur le compte
  Pronote de test (antérieur à C).

## Bloquants

| Bloquant | Effet | Qui | Comment lever |
|---|---|---|---|
| ~~`Expo deps check` échoue sur `main`~~ : Expo a publié des patchs SDK 56 (`expo ~56.0.22`, `expo-router ~56.2.21`…) | Required check rouge : aucune PR ne peut merger | Utilisateur | Levé le 2026-09-22 : les deux checks mobiles ne sont plus requis |
| ZDR (Zero Data Retention) non demandé | Mistral peut conserver textes et audio d'élèves selon sa rétention par défaut ; bloque tout utilisateur réel, pas le merge (app pas en prod) | Utilisateur | Demande au support Mistral puis vérification Admin › API › Privacy |

## Lot 0 — PR

| PR | Plan | Branche | Statut | Lien |
|---|---|---|---|---|
| Docs : specs, roadmap, plan du lot 0, ce suivi | — | `docs/rewrite-specs-and-plans` | mergée | #306 |
| B.1 — GitHub Actions sur leur dernière majeure (urgent : fin de Node 20 sur les runners le 2026-09-23 d'après le plan B) | `plans/2026-09-22-lot-0-b-dependances.md`, tâche B.1 | `ci/bump-actions` | mergée | #307 |
| A — Suppression de `apps/mobile` et du billing RevenueCat | `plans/2026-09-22-lot-0-a-suppression-mobile.md` | `chore/remove-mobile-app` | mergée | #308 |
| B — Dépendances et outillage à jour (B.2 → B.9) | `plans/2026-09-22-lot-0-b-dependances.md` | `build/upgrade-all-deps` | mergée | #309 |
| C — Bascule Mistral Small 4 | `plans/2026-09-22-lot-0-c-mistral-small-4.md` | `feat/mistral-small-4` | mergée | #313 |
| D — Bugs avec tests de non-régression | `plans/2026-09-22-lot-0-d-bugs.md` | `fix/server-and-tooling-bugs` | en revue | — |
| E1 — Appels IA sur l'AI SDK et le SDK Mistral | `plans/2026-09-22-lot-0-e-code-reinvente.md` | `refactor/replace-custom-ai-calls` | à faire | — |
| E2 — Infra serveur et outillage | `plans/2026-09-22-lot-0-e-code-reinvente.md` | `refactor/replace-custom-infra` | à faire | — |

Le détail des tâches se coche dans le plan de chaque PR, sur sa branche.

## Étapes manuelles (utilisateur)

| Étape | Pour | Statut |
|---|---|---|
| Retirer `Expo deps check` et `Mobile bundle` des required checks de « Protect main » | #306, puis A | fait |
| Confirmer qu'aucune donnée de `device_push_tokens` / `webhook_events` n'est à garder | A.6 | fait (DROP local autorisé) |
| Confirmer la suppression de l'ancien volume Docker Postgres 16 local | B.6 | fait (volume supprimé) |
| Créer le secret `RENOVATE_TOKEN`, retirer l'app Mend du dépôt, vérifier la cause côté Mend | B.8 | fait (app désinstallée, run manuel `done`, Dependency Dashboard #310) |
| Mettre à jour les plugins Claude Code | B.9 | à faire |
| Sonde curl de l'endpoint UE avec la clé Mistral | C.1 | fait (2026-09-22, lancée par l'agent avec accord, après activation de Pay-As-You-Go : Small 4 et Medium sont à 0 requête/min sur le plan gratuit ; plafond de dépenses supplémentaires 10 €/mois ; entraînement sur les appels API désactivé) |
| Demander le Zero Data Retention au support Mistral | C.1 | à faire |
| Suite live et deux tours de chat réels | C.9 | fait (2026-09-22, lancé par l'agent : `test:live` Mistral 6/6, `pnpm doctor:e2e` exit 0, deux tours seedés sans aucun chunk de raisonnement côté client, `cost_tracking` en `mistral-small-2603`, majoration 1.1, 3136 tokens cachés au 2e tour) |
| Vérifier les secrets `TURBO_TOKEN` / `TURBO_TEAM` | E2 | à faire |

## Lots suivants

| Lot | Statut |
|---|---|
| 1 — Harnais d'évaluation | plan à écrire au démarrage |
| 2 — Agent selon les guides | plan à écrire au démarrage |
| 3 — Client web Next.js | plan à écrire au démarrage |

## Journal

- **2026-09-22** — Specs, roadmap et plan du lot 0 réécrits (#306), anciens documents du
  2026-09-04 supprimés. Décisions : Small 4 pour chat et vision, `apps/mobile` supprimé,
  échelle d'indices graduée, parent = résumé + alertes, V1 collège seul, toutes les
  dépendances à jour (TypeScript 7 bloqué par `typescript-eslint`).
- **2026-09-22** — Suivi créé. PR B.1 ouverte (#307). Retrait des required checks mobile
  refusé à l'agent par le classifieur de permissions : étape laissée à l'utilisateur.
- **2026-09-22** — Ruleset corrigé, #306 et #307 mergées. PR A démarrée : A.1 (suppression
  de `apps/mobile`) faite et relue, commit `41d00f3`.
- **2026-09-22** — PR A : A.2 (webhook RevenueCat et billing serveur retirés) faite et
  relue, commit `3d3175a`.
- **2026-09-22** — PR A : A.3 (plugin Expo de Better Auth, origines mobiles, routes de
  jetons push retirés) faite et relue, commit `ed4c2be`.
- **2026-09-22** — PR A : A.4 (exports réservés au mobile retirés de `@repo/api`,
  `@repo/tokens`, `@repo/eslint-config`) faite et relue, commit `a88dfa6`.
- **2026-09-22** — PR A : A.5 (réglages et overrides pnpm propres à Expo retirés, `.npmrc`
  supprimé) faite et relue, commit `0bb738e`.
- **2026-09-22** — PR A : A.6 (tables `device_push_tokens` et `webhook_events` supprimées,
  migration `0027`, appliquée en local uniquement) faite et relue, commit `8b91890`.
- **2026-09-22** — PR A : A.7 (doc et configuration Claude sans le mobile) faite et relue,
  commit `745e216`. Historique réécrit avec accord : les deux commits de A.6 fusionnés.
- **2026-09-22** — PR A : A.8 (validation de fin de PR : 13 commandes à exit 0, aucun reste
  injustifié) faite ; relecture finale de toute la branche sans finding bloquant.
- **2026-09-22** — PR A mergée (#308, merge commit). PR B démarrée.
- **2026-09-22** — PR B : B.2 (pnpm 12.5.1, plancher Node 24, outillage), B.3 (dépendances
  serveur, contrat Eden identique) et B.4 (better-auth 1.7, plugin MCP retiré, champ mort
  `user.parentId` retiré de la config auth) faites et relues.
- **2026-09-22** — PR B : B.5 (Motion 13, React 19.3, landing vérifiée dans le navigateur),
  B.6 (Postgres 18 + pgvector 0.8.6, Bun 1.4 ; volume local neuf
  `tomai_postgres18_dev_data`) et B.7 (overrides obsolètes retirés, seul reste un plancher
  esbuild ciblé sur drizzle-kit) faites et relues.
- **2026-09-22** — PR B : B.8 (Renovate auto-hébergé) faite et relue ; relecture finale
  sans finding bloquant ; validation de fin de PR verte (`outdated` : seuls TypeScript 7 et
  `@types/node` 26, écarts voulus).
- **2026-09-22** — PR B mergée (#309, merge commit). Ancien volume Postgres 16 supprimé,
  app Renovate hébergée désinstallée, secret `RENOVATE_TOKEN` créé : le run manuel de
  Renovate termine `done` et ouvre le Dependency Dashboard (#310).
- **2026-09-22** — PR C (bascule Mistral Small 4) implémentée : Small 4 daté partout
  (`mistral-small-2603`), endpoint UE (`api.eu.mistral.ai`, +10 % de coût), clé de cache par
  session, raisonnement gardé côté serveur (jamais forwardé au client), deux bugs TTS
  corrigés, `pnpm doctor` étendu au modèle et à l'endpoint Mistral, suite live 6/6.
- **2026-09-22** — PR C mergée (#313, merge commit). Reste la demande de Zero Data Retention
  (bloquant avant tout utilisateur réel).
- **2026-09-22** — PR D (bugs avec tests de non-régression) implémentée : 19 tâches. Par
  thème — serveur : arrêt gracieux ordonné, id de requête et enveloppe d'erreur globale,
  bornes de quota calculées en Europe/Paris, purge de rétention qui rapporte les vrais
  compteurs, retrait du sweep horaire de quota, parseur JSON natif d'Elysia, retrait de la
  vérification de session orpheline et du cache de cookie de session, configuration OTLP
  laissée à l'exporteur, gate de validation qui échoue si la matrice échoue, `PG_CONTAINER`
  honoré par le doctor, UUID validés à la frontière de route, routes de credentials
  device-first supprimées ; landing : images distantes non proxyables stoppées, en-têtes de
  sécurité et métadonnées SEO corrigés, réponse de la waitlist vérifiée en statut et en
  corps, textes qui décrivent un service web plutôt qu'une app de store ; CI : job Renovate en
  échec si le token est refusé, parcours nouveau dev pointé sur `pnpm run setup` ;
  outillage : lanceur de tests maison remplacé par `bun test --isolate` partout, mocks
  `tool-executor`/`chat-tools` isolés. Décisions à garder : date-fns conservé bien que Bun
  1.4.2 expose désormais `Temporal` (typage TypeScript 6.0 non vérifié) — à réévaluer ;
  `apps/server/scripts/run-tests.ts` (lanceur custom) remplacé par `bun test --isolate`
  natif ; les erreurs de validation répondent maintenant 400 avec l'enveloppe
  `{ error: { code, message }, requestId }` au lieu du 422 par défaut d'Elysia (changement de
  contrat pour de futurs clients) ; le `cookieCache` de better-auth retiré, donc un compte
  supprimé perd l'accès immédiatement ; `needsMonthlyReset` utilise toujours
  `Intl.DateTimeFormat` alors que les bornes jour/semaine sont passées à date-fns (suivi de
  cohérence) ; `apps/landing/lib/actions/waitlist.ts` porte désormais une vraie logique de
  branchement mais la landing n'a pas de lanceur de tests
  (`.claude/rules/testing-and-commits.md` : « Pas de tests ») — choix délibéré à revisiter.
