# Plan — `ci/quality-gates`

Portes de qualité de la CI : Renovate qui livre, Playwright en CI, couverture morte retirée,
lint partout, formatage vérifié, plugin React maintenu.

## Pré-vol (2026-10-06, contre `main` à `7427cb66`)

Chaque constat de l'audit, vérifié dans le code, l'API GitHub et la doc officielle :

1. **Renovate** — confirmé. `renovate.yml` planifie `0 4 * * *` (UTC) ; les 14 derniers
   passages planifiés ont démarré entre 08:51 et 10:58 UTC (`gh run list`), soit
   10:51-12:58 à Paris, hors de `before 9am on monday` ; les deux derniers lundis (09-28,
   10-05) aussi. Le tableau de bord (#310) liste 20 mises à jour « Awaiting Schedule »,
   lockfiles compris ; dernière PR Renovate : #177, le 2026-06-03. La doc `schedule`
   recommande une fenêtre d'au moins 3-4 h et le cron avec `*` en minutes
   (docs.renovatebot.com/configuration-options/#schedule). Écart découvert : avec un seul
   passage par jour, `prHourlyLimit: 4` plafonne à 4 nouvelles PR par passage, donc par
   semaine une fois la fenêtre réduite au lundi (#prhourlylimit : la limite compte les PR
   créées par heure, `0` = sans limite).
2. **Playwright** — confirmé : aucun job ne lance `test:e2e` ; `turbo.json` n'a pas la tâche.
   La doc Playwright CI déconseille le cache des navigateurs (« Caching browser binaries is
   not recommended […] operating system dependencies […] are not cacheable »,
   playwright.dev/docs/ci#caching-browsers) : pas de cache, `playwright install --with-deps`
   des seuls navigateurs utiles. La consigne « cache selon la doc » s'applique donc en
   n'en mettant pas.
3. **Couverture** — confirmé : `Server test coverage (report only)` rejoue `src/tests`,
   `continue-on-error`, ni seuil ni upload. Aucun autre usage de `test:coverage`, de
   `coverage/` ou de `lcov-result-merger` (grep du dépôt, docs comprises).
4. **Migrations** — confirmé : le filtre de `migrations` ignore `apps/server/drizzle/`.
5. **`packages/api`** — confirmé : ni script `lint` ni config. Son lint typé lit les types
   du serveur dans `dist/types` : la tâche turbo `lint` doit dépendre de `^build:types`
   comme `typecheck`. `lefthook.yml` : pas de `--no-warn-ignored` pour la landing, pas de
   job pour `packages/ui` ni `packages/api`.
6. **Prettier** — confirmé : `prettier` 3.9.8 installé, script `format`, `.prettierignore`,
   aucune config, vérifié nulle part ; 457 fichiers sur le dépôt diffèrent de sa sortie
   par défaut. Mesures de churn (`--write` puis `git diff --shortstat`) : défaut 397
   fichiers / +24 680 lignes ; `printWidth: 150, singleQuote: true` 319 fichiers / +6 404
   (le 99e centile des lignes serveur fait 147 colonnes, 1 352 imports en guillemets
   simples contre 11) ; Markdown seul 70 fichiers / +1 191.
7. **ESLint React** — confirmé : `eslint-plugin-react` 7.37.5 publié le 2025-04-03, peer
   `eslint ^9.7`, issue ESLint 10 (jsx-eslint/eslint-plugin-react#3977) ouverte.
   `@eslint-react/eslint-plugin` vérifié ce jour : dépôt Rel1cx/eslint-react non archivé,
   v5.24.6 publiée le 2026-10-06, issues fermées en quelques jours (#1963, #1951),
   2,38 M téléchargements/semaine npm, peer `eslint: *`. Critères tenus. La 5.24.6 a moins
   de 24 h : `minimumReleaseAge` de `bunfig.toml` retient la 5.24.4 (2026-10-04).
   `eslint-plugin-react-hooks` 7.1.1 : peer `^10.0.0` acceptée, `fixupPluginRules` inutile.
8. **Tests de `scripts/`** — faux : ils tournent déjà en CI (job `Script tests`,
   `bun run test:scripts`). Rien à faire, sinon le dire.

## Tâches (un commit chacune)

1. `ci(renovate)` — `.github/renovate.json` : `schedule` et `lockFileMaintenance.schedule`
   à `* * * * 1` (tout le lundi, Europe/Paris) ; `prHourlyLimit: 0`, `prConcurrentLimit: 8`
   reste le frein. Automerge et `minimumReleaseAge` inchangés. Validé par
   `renovate-config-validator`.
2. `test(server)` — retirer l'étape coverage de `ci.yml`, `test:coverage`, la fusion lcov et
   l'option `--coverage` de `apps/server/scripts/run-tests.ts`, `lcov-result-merger`,
   `outputs: ["coverage/**"]` de la tâche `test`. Test : `run-tests-script.test.ts` sans
   `coverage`.
3. `ci(migrations)` — ajouter `apps/server/drizzle/` au filtre.
4. `build(api)` — `packages/api/eslint.config.mjs` (config `node` partagée), script `lint`,
   `eslint` et `@repo/eslint-config` en devDependencies ; `lint` dépend de `^build:types`.
5. `build(lefthook)` — jobs lint uniformes (`--no-warn-ignored` partout), jobs
   `lint-ui` et `lint-api`.
6. `build(eslint-config)` — `@eslint-react/eslint-plugin` (`strict-type-checked`) remplace
   `eslint-plugin-react` ; `eslint-plugin-react-hooks` (plugin de l'équipe React) garde les
   règles de hooks et du compilateur, leurs doublons ESLint React sont coupés (la liste
   vient du preset `disable-conflict-eslint-plugin-react-hooks`, qui fait l'inverse) ; `fixupPluginRules` retiré là où la peer
   accepte ESLint 10. Constats corrigés dans `apps/web`, `packages/ui`, `apps/landing`, sans
   `eslint-disable`.
7. `ci(e2e)` — tâche turbo `test:e2e` ; job CI `E2E (Playwright)` : `--affected` en PR,
   navigateurs déduits des tâches à lancer (`--dry=json`), `playwright install --with-deps`.
   `apps/web` d'abord ; la landing gardée si sa durée en CI reste raisonnable (mesurée sur
   cette PR). Règle `.claude/rules/testing-and-commits.md` mise à jour.
8. `style` — Prettier imposé, décision : le garder. Raison : le code est écrit surtout par
   des agents, sans formateur chaque diff mêle fond et forme ; Prettier est déjà là, standard.
   Config explicite `.prettierrc.json` (`printWidth: 150`, `singleQuote: true`, au plus près
   de l'existant) ; Markdown exclu (prose coupée à la main, tableaux re-paddés à chaque
   cellule, PR docs #409 ouverte) ; `apps/server/drizzle/` exclu (sortie de drizzle-kit que
   le job `migrations` compare). Trois commits : config, formatage seul, puis
   `prettier --check` dans le job `lint` (check requis) et en pre-commit sur les fichiers
   indexés ; `.git-blame-ignore-revs` pour le commit de formatage.
9. `docs` — `docs/suivi.md` (point Playwright fait, `lcov-result-merger` retiré de l'audit
   `braces`) ; suppression de ce plan.

## Hors périmètre, remonté

- Rendre `E2E (Playwright)` et `Script tests` requis : réglage du ruleset `Protect main`,
  action du propriétaire.
- Les 20 mises à jour en attente : le prochain lundi en ouvre 8 (`prConcurrentLimit`) ; la
  case « Create all awaiting schedule PRs at once » de #310 les ouvre tout de suite.
