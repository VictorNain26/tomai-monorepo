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
- **Prochaine action :** continuer la PR A (branche `chore/remove-mobile-app`) à la
  première tâche sans ligne `complete` dans son registre SDD
  `.superpowers/sdd/2026-09-22-lot-0-a-suppression-mobile/progress.md` (git-ignoré, local).
  Exécution : skill `superpowers:subagent-driven-development` sur
  `plans/2026-09-22-lot-0-a-suppression-mobile.md` ; briefs et règles déjà extraits dans ce
  dossier.

## Bloquants

| Bloquant | Effet | Qui | Comment lever |
|---|---|---|---|
| ~~`Expo deps check` échoue sur `main`~~ : Expo a publié des patchs SDK 56 (`expo ~56.0.22`, `expo-router ~56.2.21`…) | Required check rouge : aucune PR ne peut merger | Utilisateur | Levé le 2026-09-22 : les deux checks mobiles ne sont plus requis |

## Lot 0 — PR

| PR | Plan | Branche | Statut | Lien |
|---|---|---|---|---|
| Docs : specs, roadmap, plan du lot 0, ce suivi | — | `docs/rewrite-specs-and-plans` | mergée | #306 |
| B.1 — GitHub Actions sur leur dernière majeure (urgent : fin de Node 20 sur les runners le 2026-09-23 d'après le plan B) | `plans/2026-09-22-lot-0-b-dependances.md`, tâche B.1 | `ci/bump-actions` | mergée | #307 |
| A — Suppression de `apps/mobile` et du billing RevenueCat | `plans/2026-09-22-lot-0-a-suppression-mobile.md` | `chore/remove-mobile-app` | en cours : A.1-A.7 faites et relues | — |
| B — Dépendances et outillage à jour (B.2 → B.9) | `plans/2026-09-22-lot-0-b-dependances.md` | `build/upgrade-all-deps` | à faire | — |
| C — Bascule Mistral Small 4 | `plans/2026-09-22-lot-0-c-mistral-small-4.md` | `feat/mistral-small-4` | à faire | — |
| D — Bugs avec tests de non-régression | `plans/2026-09-22-lot-0-d-bugs.md` | `fix/server-and-tooling-bugs` | à faire | — |
| E1 — Appels IA sur l'AI SDK et le SDK Mistral | `plans/2026-09-22-lot-0-e-code-reinvente.md` | `refactor/replace-custom-ai-calls` | à faire | — |
| E2 — Infra serveur et outillage | `plans/2026-09-22-lot-0-e-code-reinvente.md` | `refactor/replace-custom-infra` | à faire | — |

Le détail des tâches se coche dans le plan de chaque PR, sur sa branche.

## Étapes manuelles (utilisateur)

| Étape | Pour | Statut |
|---|---|---|
| Retirer `Expo deps check` et `Mobile bundle` des required checks de « Protect main » | #306, puis A | fait |
| Confirmer qu'aucune donnée de `device_push_tokens` / `webhook_events` n'est à garder | A.6 | fait (DROP local autorisé) |
| Confirmer la suppression de l'ancien volume Docker Postgres 16 local | B.6 | à faire |
| Créer le secret `RENOVATE_TOKEN`, retirer l'app Mend du dépôt, vérifier la cause côté Mend | B.8 | à faire |
| Mettre à jour les plugins Claude Code | B.9 | à faire |
| Sonde curl de l'endpoint UE avec la clé Mistral | C.1 | à faire |
| Demander le Zero Data Retention au support Mistral | C.1 | à faire |
| Suite live et deux tours de chat réels | C.9 | à faire |
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
