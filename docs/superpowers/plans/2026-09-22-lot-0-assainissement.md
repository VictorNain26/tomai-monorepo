# Lot 0 — Assainissement : plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** partir d'une base saine pour le harnais d'évaluation (lot 1) : plus de mobile,
dépendances à jour, Mistral Small 4 réellement configuré, bugs corrigés avec leurs tests,
code d'infrastructure maison remplacé par des bibliothèques maintenues.

**Architecture :** six PR courtes et séquentielles, chacune mergée en merge commit avant
d'ouvrir la suivante. Chaque PR a son propre plan, ci-dessous. Chaque tâche se relit seule.

**Tech Stack :** Bun + Elysia, Drizzle/Postgres, AI SDK 7 + `@ai-sdk/mistral`, Next.js
(landing), pnpm + Turborepo, GitHub Actions.

**Specs :** `docs/superpowers/specs/2026-09-22-cible-v1.md`,
`docs/superpowers/specs/2026-09-22-agent-ia.md`. Roadmap :
`docs/superpowers/plans/2026-09-22-roadmap.md`.

## Global Constraints

- Tests serveur : Bun, `apps/server/src/tests/<nom>.test.ts` ; intégration `bun run test:integration`.
- Un bug corrigé = un test de non-régression qui échoue avant le correctif.
- Doc-first : toute API tierce utilisée est vérifiée dans le `.d.ts` installé ou la doc officielle, source citée dans le commit.
- Validation avant commit : `pnpm typecheck && pnpm lint && pnpm test` (+ `bun run test:integration` si le serveur est touché), codes de sortie lus.
- Commits `<type>(<scope>): <description>` en anglais, fichiers stagés un par un, jamais `--no-verify`.
- Merge commit, jamais de squash. Branche courte par PR, depuis `main` à jour.
- Identifiants de modèle Mistral datés uniquement, jamais `-latest`.
- Aucune donnée d'élève hors UE : endpoint `api.eu.mistral.ai`, télémétrie IA sans entrées ni sorties.
- Zéro commentaire sauf WHY non évident ; pas d'`eslint-disable`.
- TypeScript reste en 6.0.x : `typescript-eslint@8.70.x` exige `typescript <6.1.0`.

## Ordre et plans

| Ordre | PR | Branche | Plan |
|---|---|---|---|
| 1 | A — Suppression de `apps/mobile` et du billing RevenueCat | `chore/remove-mobile-app` | `2026-09-22-lot-0-a-suppression-mobile.md` |
| 2 | B — Toutes les dépendances et l'outillage à la dernière version | `build/upgrade-all-deps` | `2026-09-22-lot-0-b-dependances.md` |
| 3 | C — Bascule sur Mistral Small 4 | `feat/mistral-small-4` | `2026-09-22-lot-0-c-mistral-small-4.md` |
| 4 | D — Bugs réels avec tests de non-régression | `fix/server-and-tooling-bugs` | `2026-09-22-lot-0-d-bugs.md` |
| 5 | E1 — Appels IA : AI SDK et SDK Mistral à la place du code maison | `refactor/replace-custom-ai-calls` | `2026-09-22-lot-0-e-code-reinvente.md` |
| 6 | E2 — Infra serveur et outillage : code mort supprimé, bibliothèques | `refactor/replace-custom-infra` | idem |

**Exception d'ordre, urgente :** la tâche B.1 (GitHub Actions sur leur dernière majeure)
ne dépend d'aucune autre. GitHub retire Node 20 des runners le 2026-09-23 d'après la
section B. Elle peut partir seule, avant A, dans une PR `ci/bump-actions`.

**Pourquoi A d'abord :** le hook pre-commit lance `turbo typecheck --affected`. Tant que
`apps/mobile` existe, retirer une route serveur casse son typecheck et bloque le commit.
Et sans le mobile, B n'a plus ~40 majeures Expo à migrer.

## Étapes manuelles (utilisateur)

Elles demandent un accès humain et ne peuvent pas être faites par un agent :

| Quand | Étape | PR |
|---|---|---|
| Avant le merge de A | Retirer `Expo deps check` et `Mobile bundle` des required checks du ruleset « Protect main » | A |
| Avant d'appliquer la migration A.6 | Confirmer qu'aucune donnée des tables `device_push_tokens` et `webhook_events` n'est à garder | A |
| Pendant B | Confirmer la suppression de l'ancien volume Docker Postgres 16 local | B |
| Pendant B | Créer le secret `RENOVATE_TOKEN`, retirer l'app Mend hébergée du dépôt, vérifier la cause côté Mend | B |
| Après B | Mettre à jour les plugins Claude Code (`claude plugin marketplace update`, puis `claude plugin update <nom>`) | B |
| Avant C.2 | Sonde curl de l'endpoint UE avec la clé Mistral (tâche C.1, porte bloquante) | C |
| Pendant C | Demander le Zero Data Retention au support Mistral et vérifier son activation | C |
| Fin de C | Lancer la suite live et deux tours de chat réels (C.9) | C |
| Pendant E2 | Vérifier l'existence des secrets `TURBO_TOKEN` / `TURBO_TEAM` | E2 |

## Écarts assumés par rapport aux audits

- « JSON invalide → 500 » est faux sur Elysia 1.4.28 (réponse 400). Le parser maison est
  quand même retiré (D.5), comme un nettoyage.
- Le middleware de request id et le gestionnaire d'erreurs ne tournaient sur **aucune**
  route (hooks Elysia locaux par défaut). D.4 corrige plus que le constat d'origine.
- La validation des routes reste en TypeBox, source des types Eden. Zod dans `body:`
  n'est pas retenu (E2.6), faute de preuve que le `.d.ts` émis reste typé côté client.
- La télémétrie de l'AI SDK enregistrerait par défaut les messages des élèves.
  E1.8 impose `recordInputs: false` et `recordOutputs: false`, avec un test.

## Laissé délibérément aux lots suivants

- Schéma de facturation (`family_billing.revenuecat_*`, enum `billing_status`) : refait
  au lot 3 avec le paiement web. Après A, rien n'attribue plus le premium.
- CSP de la landing ; déploiement Vercel avec pnpm 12 (non documenté par Vercel) :
  lot 3, avec l'hébergement.
- Délai de grâce SIGTERM de l'hébergeur ≥ un tour de chat (`app.stop()` attend les flux
  SSE) : lot 3.
- Stockage partagé du rate limit si plusieurs instances : lot 3.
- `safePrompt`, rejeu du raisonnement, modération : lot 2.
- `pnpm test:scripts` absent de la CI : PR séparée.
