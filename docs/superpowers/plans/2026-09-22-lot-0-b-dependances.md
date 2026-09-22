# Lot 0, PR B — Toutes les dépendances et l'outillage à la dernière version

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Index du lot, contraintes globales, ordre des PR et étapes manuelles :** `docs/superpowers/plans/2026-09-22-lot-0-assainissement.md` — à lire avant ce plan.

**Specs :** `docs/superpowers/specs/2026-09-22-cible-v1.md`, `docs/superpowers/specs/2026-09-22-agent-ia.md`.

---

## PR B — Toutes les dépendances et l'outillage à la dernière version

**Branche :** `build/upgrade-all-deps`

**Objectif :** amener chaque dépendance npm, l'outillage (pnpm, Node, Bun, turbo), les GitHub Actions et les images Docker à leur dernière version stable, remettre Renovate en état de tenir le dépôt à jour, et ne laisser dans `pnpm outdated -r` que deux écarts choisis et documentés.

**Hypothèse :** la PR A est mergée. `apps/mobile`, `@better-auth/expo` et le plugin `expo()` de `apps/server/src/lib/auth.ts`, le webhook RevenueCat, `react-test-renderer` du catalog, les jobs CI `expo-deps` et `mobile-bundle`, le job lefthook `lint-mobile`, le workspace knip `apps/mobile` et les tâches turbo `dev:ios`/`dev:android` n'existent plus. Les étapes qui dépendent de ce retrait commencent par un `grep` de contrôle.

**État de départ (relevé le 2026-09-22, `pnpm outdated -r` hors mobile) :** 53 paquets en retard, dont 3 majeures (`typescript` 6.0.3→7.0.2, `@types/node` 25.9.1→26.6.2, `framer-motion` 12.40.0→13.4.0). S'y ajoutent `pnpm` 11.2.2→12.5.1 (majeure), Bun 1.3→1.4.2, Postgres 16→18, et des GitHub Actions en v4 sur le runtime Node 20. GitHub retire Node 20 des runners le **2026-09-23** ([changelog GitHub](https://github.blog/changelog/2025-09-19-deprecation-of-node-20-on-github-actions-runners/), date mise à jour dans [Early September 2026 updates](https://github.blog/changelog/2026-09-03-github-actions-early-september-2026-updates/)). La tâche B.1 passe donc en premier. Renovate n'a plus rien fait depuis le 2026-06-03.

**Fichiers touchés :**
- `.github/actions/setup-monorepo/action.yml`, `.github/workflows/{ci,security,actionlint,claude-code,docker}.yml`, `.github/workflows/renovate.yml` (création), `.github/renovate.json`
- `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `.nvmrc` (inchangé : `24`)
- `apps/server/package.json`, `apps/server/src/lib/auth.ts`, `apps/server/src/db/schema/auth.schema.ts` (si l'étape de génération B.4 révèle un écart), `apps/server/drizzle/*` (migration générée si besoin), `apps/server/Dockerfile`
- `apps/landing/package.json`, `apps/landing/components/{sections/faq,sections/how-it-works,sections/features,atoms/fade-in,atoms/animated-counter,atoms/rotating-text}.tsx`
- `packages/eslint-config/package.json`, `packages/ui/package.json`, `packages/tokens/package.json`
- `docker-compose.yml`, `README.md`, `CLAUDE.md`, `apps/server/README.md`, `.claude/skills/dev-bootstrap/SKILL.md`

---

### Tâche B.1 — GitHub Actions sur leur dernière majeure

**Files:**
- Modify `.github/actions/setup-monorepo/action.yml:15-32`
- Modify `.github/workflows/ci.yml:45,99,143,164,207,226-227`
- Modify `.github/workflows/security.yml:25,28,36,38,48`
- Modify `.github/workflows/actionlint.yml:31`
- Modify `.github/workflows/claude-code.yml:25,31`
- Modify `.github/workflows/docker.yml:41`

**Interfaces :** Consumes : rien. Produces : la composite action `setup-monorepo` avec la même interface d'entrée (`turbo-cache-key`).

Versions et SHA relevés le 2026-09-22 (`gh api repos/<owner>/<repo>/releases/latest` puis `gh api repos/<owner>/<repo>/commits/<tag> --jq .sha`) :

| Action | Actuel | Cible | SHA |
|---|---|---|---|
| `actions/checkout` | v4.3.1 | v7.0.1 | `3d3c42e5aac5ba805825da76410c181273ba90b1` |
| `actions/setup-node` | v4.4.0 | v7.0.0 | `820762786026740c76f36085b0efc47a31fe5020` |
| `pnpm/action-setup` | v4.2.0 | v6.1.0 | `ea17c68df8912ef543352723c149a84f56e3d413` |
| `oven-sh/setup-bun` | v2.1.2 | v2.2.0 | `0c5077e51419868618aeaa5fe8019c62421857d6` |
| `actions/cache` | v4.3.0 | v6.1.0 | `55cc8345863c7cc4c66a329aec7e433d2d1c52a9` |
| `gitleaks/gitleaks-action` | v2.3.9 | v3.0.0 | `e0c47f4f8be36e29cdc102c57e68cb5cbf0e8d1e` |
| `anthropics/claude-code-action` | v1 (36a69b6) | v1 (tag déplacé) | `cfc3eb22bfed5c26ef66e3223c982af27e4524de` |
| `semgrep/semgrep` (image) | digest 7cad2bc2… | 1.177.0 | `sha256:acaac22ffc7b7cc5926de0751b223bce0b2491c33d18422fa72f632c78d81198` |
| `rhysd/actionlint` (image) | 1.7.12 | 1.7.12 | déjà à jour, inchangé |

Breaking changes lus, et leur effet ici :
- checkout v5 (Node 24, runner ≥ 2.327.1), v6 (credentials persistés dans un fichier séparé), v7 (ESM, fork PR bloqué pour `pull_request_target`/`workflow_run`) : aucun workflow n'utilise ces déclencheurs. Sources : [v5.0.0](https://github.com/actions/checkout/releases/tag/v5.0.0), [v6.0.0](https://github.com/actions/checkout/releases/tag/v6.0.0), [v7.0.0](https://github.com/actions/checkout/releases/tag/v7.0.0).
- setup-node v5 (cache auto si `packageManager`), v6 (cache auto limité à npm), v7 (ESM) : `cache: pnpm` reste explicite, donc aucun changement. Sources : [v5.0.0](https://github.com/actions/setup-node/releases/tag/v5.0.0), [v6.0.0](https://github.com/actions/setup-node/releases/tag/v6.0.0), [v7.0.0](https://github.com/actions/setup-node/releases/tag/v7.0.0).
- pnpm/action-setup v5 (Node 24), v6 (pnpm 11), v6.1.0 (pnpm 12, requis par B.2). Sources : [releases](https://github.com/pnpm/action-setup/releases).
- actions/cache v5 (Node 24), v6 (ESM). L'input `save-always` porte un `deprecationMessage` : « save-always does not work as intended and will be removed in a future release » (`action.yml` du tag v6.1.0, lignes 29-36). Il est retiré : le cache turbo est alors sauvé en fin de job réussi, comportement par défaut, et le cache distant (`TURBO_TOKEN`) reste la source principale.
- gitleaks-action v3 : runtime Node 24 seulement, « No changes to inputs, outputs, or behavior » ([v3.0.0](https://github.com/gitleaks/gitleaks-action/releases/tag/v3.0.0)).

- [x] **Constater l'état obsolète.**
  ```bash
  cd /home/ordiv/projets/tomai-monorepo
  grep -rn "save-always\|# v4\.\|# v2\.1\.2\|# v2\.3\.9" .github
  ```
  Attendu : 10 lignes ou plus (checkout v4.3.1 partout, setup-node v4.4.0, cache v4.3.0 + `save-always`, setup-bun v2.1.2, gitleaks v2.3.9).

- [x] **Réécrire `.github/actions/setup-monorepo/action.yml` lignes 15-32** :
  ```yaml
  runs:
    using: composite
    steps:
      - uses: pnpm/action-setup@ea17c68df8912ef543352723c149a84f56e3d413 # v6.1.0

      - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
        with:
          node-version-file: .nvmrc
          cache: pnpm

      - uses: oven-sh/setup-bun@0c5077e51419868618aeaa5fe8019c62421857d6 # v2.2.0
        with:
          bun-version: "1.3"

      - uses: actions/cache@55cc8345863c7cc4c66a329aec7e433d2d1c52a9 # v6.1.0
        with:
          path: .turbo
          key: turbo-${{ runner.os }}-${{ inputs.turbo-cache-key }}-${{ github.sha }}
          restore-keys: turbo-${{ runner.os }}-${{ inputs.turbo-cache-key }}-

      - run: pnpm install --frozen-lockfile
        shell: bash
  ```
  (`bun-version` passe à 1.4 dans B.6, avec le runtime.)

- [x] **Remplacer toutes les occurrences de checkout et setup-node dans les workflows :**
  ```bash
  cd /home/ordiv/projets/tomai-monorepo
  sed -i 's|actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5 # v4.3.1|actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1|' .github/workflows/*.yml
  sed -i 's|actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4.4.0|actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0|' .github/workflows/ci.yml
  sed -i 's|gitleaks/gitleaks-action@ff98106e4c7b2bc287b24eaf42907196329070c7 # v2.3.9|gitleaks/gitleaks-action@e0c47f4f8be36e29cdc102c57e68cb5cbf0e8d1e # v3.0.0|' .github/workflows/security.yml
  sed -i 's|semgrep/semgrep@sha256:7cad2bc2d1e44f87f0bf4be6d1fa23aa90fb72015bebc89fb91385d813987a03|semgrep/semgrep@sha256:acaac22ffc7b7cc5926de0751b223bce0b2491c33d18422fa72f632c78d81198 # 1.177.0|' .github/workflows/security.yml
  sed -i 's|anthropics/claude-code-action@36a69b6a90b850823f86de06fdfd56264772ad98 # v1|anthropics/claude-code-action@cfc3eb22bfed5c26ef66e3223c982af27e4524de # v1|' .github/workflows/claude-code.yml
  ```

- [x] **Vérifier.**
  ```bash
  grep -rn "save-always\|# v4\.\|# v2\.1\.2\|# v2\.3\.9\|36a69b6a\|7cad2bc2" .github; echo "exit=$?"
  docker run --rm -v "$PWD:/repo" -w /repo rhysd/actionlint@sha256:b1934ee5f1c509618f2508e6eb47ee0d3520686341fec936f3b79331f9315667 -color; echo "exit=$?"
  ```
  Attendu : `grep` sans sortie, `exit=1`. actionlint `exit=0`.

- [x] **Commit.**
  ```bash
  git add .github/actions/setup-monorepo/action.yml
  git add .github/workflows/ci.yml
  git add .github/workflows/security.yml
  git add .github/workflows/actionlint.yml
  git add .github/workflows/claude-code.yml
  git commit -m "build(ci): move GitHub Actions to their latest majors on the Node 24 runtime

  GitHub removes Node 20 from hosted runners on 2026-09-23. Drops the
  deprecated actions/cache save-always input.
  Sources: https://github.blog/changelog/2025-09-19-deprecation-of-node-20-on-github-actions-runners/
  https://github.com/actions/cache/blob/v6.1.0/action.yml

  Co-Authored-By: Claude <noreply@anthropic.com>"
  ```

- [x] **Pousser la branche et lire la CI** : `git push -u origin build/upgrade-all-deps`, ouvrir la PR en draft, puis `gh pr checks --watch` doit passer tous les checks au vert.

---

### Tâche B.2 — Outillage de base : pnpm 12, Node 24, turbo, knip, prettier, lefthook

**Files:**
- Modify `package.json:36-47`
- Modify `pnpm-workspace.yaml:150-175` (`auditConfig` renommé, voir étape)
- Modify `apps/server/Dockerfile:4,13-24`
- Modify `README.md:9`, `CLAUDE.md:9`

**Interfaces :** Consumes : `pnpm/action-setup` v6.1.0 (B.1), qui lit `packageManager`. Produces : `packageManager: pnpm@12.5.1`, `engines.node: ">=24"`, `engines.pnpm: ">=12"`.

Décisions :
- **Node 24.** `.nvmrc` vaut déjà `24`. Node 24 est l'Active LTS (maintenance à partir du 2026-10-20). Node 26 ne devient LTS que le 2026-10-28, et Vercel ne propose que 24.x, 22.x et 20.x, 24.x par défaut ([Vercel, Supported Node.js versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions)). Sources : [calendrier Node.js](https://raw.githubusercontent.com/nodejs/Release/main/schedule.json), [index des releases](https://nodejs.org/dist/index.json) (dernière 24.x : v24.21.0 du 2026-09-07). `engines.node` passe de `>=22` à `>=24`, pour que le plancher déclaré égale le runtime réel (CI, Docker, Vercel).
- **pnpm 12.5.1** (latest, [release v12.5.1](https://github.com/pnpm/pnpm/releases/tag/v12.5.1)). Breaking changes de la [v12.0.0](https://github.com/pnpm/pnpm/releases/tag/v12.0.0) qui touchent ce dépôt :
  - « A project's `pnpm-workspace.yaml` may no longer carry a setting pnpm does not recognize » : erreur `ERR_PNPM_UNRECOGNIZED_WORKSPACE_SETTINGS` quand le projet épingle pnpm, ce qui est le cas ici. `auditConfig.ignoreGhsas` a été renommé `audit.ignore` en 11.16.0, et « The deprecated names keep working until the next major version » ([pnpm audit](https://pnpm.io/cli/audit)). Il est donc renommé.
  - `--frozen-lockfile false` n'est plus accepté. Aucun usage (`grep -rn "frozen-lockfile false"` : vide).
  - pnpm 12 est un exécutable natif. L'installation via npm demande Node ≥ 22.13 ([pnpm.io/installation](https://pnpm.io/installation)). La doc ne dit rien du support Corepack pour la v12, et Corepack n'est plus livré avec Node à partir de la v25. Le Dockerfile installe donc pnpm par `npm install -g pnpm@12.5.1` au lieu de `corepack prepare`. Node reste dans l'image, car les scripts d'installation autorisés (`allowBuilds` : esbuild, sharp…) l'appellent.
- **`.npmrc`** : déjà supprimé par la PR A (tâche A.5), avec les `COPY` du Dockerfile et les filtres de `docker.yml`.
- **TypeScript reste en 6.0.3** (dernière 6.0.x). `typescript-eslint@8.70.1` (latest) déclare `typescript: ">=4.8.4 <6.1.0"` (`npm view typescript-eslint@8.70.1 peerDependencies`). Le mainteneur l'explique sur [typescript-eslint#12518](https://github.com/typescript-eslint/typescript-eslint/issues/12518) : « typescript-eslint isn't compatible with TS 7 at this time, because there is no TS 7 API ». Suivi : [#10940](https://github.com/typescript-eslint/typescript-eslint/issues/10940). Le montage côte à côte TS 6 + TS 7 est écarté : deux compilateurs, et la compatibilité de `next build`, knip et `build:types` avec TS 7 n'est pas vérifiée.
- turbo 2.9.16→2.11.2 : les notes [v2.10.0](https://github.com/vercel/turborepo/releases/tag/v2.10.0) et [v2.11.0](https://github.com/vercel/turborepo/releases/tag/v2.11.0) ne listent que des retraits internes (tbx, panics, devtools flag), aucun changement de `turbo.json`. knip 6.24→6.37, prettier 3.8→3.9, lefthook 2.1.9→2.1.14 sont des mineures.

- [x] **Voir l'échec attendu sous pnpm 12 avant correction.**
  ```bash
  cd /home/ordiv/projets/tomai-monorepo
  npm pkg set packageManager=pnpm@12.5.1 engines.node=">=24" engines.pnpm=">=12"
  npx -y pnpm@12.5.1 install; echo "exit=$?"
  ```
  Attendu : `ERR_PNPM_UNRECOGNIZED_WORKSPACE_SETTINGS` sur `auditConfig`, `exit≠0`. Si pnpm 12 ne signale qu'un avertissement, noter la sortie exacte dans la PR et poursuivre : le renommage reste dû, puisque le nom est déprécié.

- [x] **Renommer la section audit de `pnpm-workspace.yaml`** (fin de fichier). La PR A retire les GHSA propres au mobile (`GHSA-w7jw-789q-3m8p` via react-native, `GHSA-w3rx-r6r6-pgpr`/`GHSA-5p2g-fcmc-qvqq` via metro). Contrôle : `grep -n "GHSA-" pnpm-workspace.yaml`. S'il ne reste aucune GHSA ignorée, supprimer tout le bloc `auditConfig` et son commentaire. Sinon, remplacer :
  ```yaml
  auditConfig:
    ignoreGhsas:
  ```
  par
  ```yaml
  audit:
    ignore:
  ```
  et, dans le commentaire au-dessus, remplacer la référence `https://pnpm.io/cli/audit#auditconfigignoreghsas (pnpm 11)` par `https://pnpm.io/cli/audit (audit.ignore, renamed from auditConfig.ignoreGhsas in pnpm 11.16)`.

- [x] **Mettre à jour `package.json` lignes 36-47 :**
  ```json
    "devDependencies": {
      "@evilmartians/lefthook": "^2.1.14",
      "knip": "6.37.0",
      "prettier": "^3.9.8",
      "turbo": "^2.11.2",
      "typescript": "6.0.3"
    },
    "engines": {
      "node": ">=24",
      "pnpm": ">=12"
    },
    "packageManager": "pnpm@12.5.1"
  ```

- [x] **Dockerfile, étape `base` (lignes 4 et 13-24) :**
  ```dockerfile
  # Runtime: Bun 1.3 | Package Manager: pnpm 12
  ```
  ```dockerfile
  # Node.js 24 LTS (lifecycle scripts of allowBuilds packages) + pnpm + system deps
  # SYNC: pnpm version must match packageManager in root package.json (pnpm@12.5.1)
  # pnpm 12 is installed through npm: https://pnpm.io/installation (npm route needs Node >= 22.13)
  RUN apt-get update && apt-get install -y --no-install-recommends \
      curl \
      ca-certificates \
      gnupg \
      && curl -fsSL https://deb.nodesource.com/setup_24.x | bash - \
      && apt-get install -y --no-install-recommends nodejs \
      && npm install -g pnpm@12.5.1 \
      && apt-get clean \
      && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*
  ```

- [x] **Doc :** `README.md:9` et `CLAUDE.md:9`, remplacer `# Node 22+, pnpm 11+` par `# Node 24+, pnpm 12+`.

- [x] **Installer avec pnpm 12 et mettre l'outillage à jour :**
  ```bash
  corepack disable pnpm 2>/dev/null; npm install -g pnpm@12.5.1 && pnpm --version
  pnpm install
  pnpm update -r --latest turbo eslint-plugin-turbo prettier @evilmartians/lefthook
  pnpm add -Dw knip@6.37.0 --save-exact
  pnpm install
  ```
  Attendu : `pnpm --version` → `12.5.1`, `pnpm install` exit 0, sans `ERR_PNPM_UNRECOGNIZED_WORKSPACE_SETTINGS`. `pnpm-lock.yaml` régénéré. Si `minimumReleaseAge: 1440` refuse une version publiée il y a moins de 24 h, prendre la précédente : la règle de supply-chain prime.

- [x] **Valider.**
  ```bash
  pnpm typecheck; echo "typecheck=$?"
  pnpm lint; echo "lint=$?"
  pnpm test; echo "test=$?"
  pnpm exec knip; echo "knip=$?"
  npx sherif@1.13.0; echo "sherif=$?"
  docker build --target production -f apps/server/Dockerfile .; echo "docker=$?"
  ```
  Attendu : les six codes à 0. Si knip 6.37 signale de nouveaux fichiers ou exports inutilisés, les traiter dans la PR E (suppression de code), pas ici : en ce cas, lister la sortie dans la description de la PR B et ne commiter que la montée.

- [x] **Commit.**
  ```bash
  git add package.json
  git add pnpm-workspace.yaml
  git add pnpm-lock.yaml
  git add apps/server/Dockerfile
  git add .github/workflows/docker.yml
  git add README.md
  git add CLAUDE.md
  git add packages/eslint-config/package.json
  git commit -m "build(ci): move to pnpm 12, Node 24 floor and latest turbo, knip, prettier, lefthook

  pnpm 12 rejects unknown workspace settings: auditConfig.ignoreGhsas is
  renamed audit.ignore. Docker installs pnpm through npm.
  TypeScript stays on 6.0.3: typescript-eslint peer is <6.1.0.
  Sources: https://github.com/pnpm/pnpm/releases/tag/v12.0.0
  https://pnpm.io/cli/audit https://pnpm.io/installation
  https://github.com/typescript-eslint/typescript-eslint/issues/10940

  Co-Authored-By: Claude <noreply@anthropic.com>"
  ```

---

### Tâche B.3 — Serveur : IA, observabilité, stockage, validation, outillage de lint

**Files:**
- Modify `apps/server/package.json:dependencies,devDependencies`
- Modify `packages/tokens/package.json:devDependencies`, `packages/eslint-config/package.json:devDependencies`
- Modify `pnpm-lock.yaml`

**Interfaces :** Consumes : aucune API nouvelle. Produces : versions ci-dessous. Aucune signature du serveur ne change, et le contrat Eden (`dist/types/app.d.ts`) doit rester identique (vérifié en fin de tâche).

| Paquet | De | Vers | Changelog lu | Effet ici |
|---|---|---|---|---|
| `ai` | 7.0.15 (exact) | ^7.0.109 | patchs 7.0.x | Le pin exact n'existait que pour s'aligner sur `apps/mobile` (commit `2305862`, règle sherif). Caret rétabli |
| `@ai-sdk/mistral` | 4.0.5 | ^4.0.48 | `dist/index.d.ts` 4.0.48 : `promptCacheKey` ajouté aux options chat, `reasoningEffort` déjà présent | Même `@ai-sdk/provider-utils` 5.0.45 que `ai` 7.0.107+, peer `zod ^3.25.76 \|\| ^4.1.8`, compatible (`npm view`) |
| `@mistralai/mistralai` | 2.2.5 | ^2.7.0 | [v2.7.0](https://github.com/mistralai/client-ts/releases/tag/v2.7.0) : breaking sur `connectors.*`, `UsageInfoDollarDefs.service_tier` retiré, segments de transcription `start`/`end` nullables | Le dépôt n'utilise que `new Mistral()` et les embeddings (`mistral-embeddings.service.ts:8`). Aucun usage touché |
| `elysia` | 1.4.28 | ^1.4.30 | [1.4.30](https://github.com/elysiajs/elysia/releases/tag/1.4.30) : 5 advisories corrigées, la 1.4.x ne recevra plus que des correctifs de sécurité | Aucun |
| `zod` | 4.4.3 | ^4.6.5 | [v4.5.0](https://github.com/colinhacks/zod/releases/tag/v4.5.0), [v4.6.0](https://github.com/colinhacks/zod/releases/tag/v4.6.0) : pas de breaking | Aucun |
| `@opentelemetry/sdk-node`, `exporter-trace-otlp-http` | 0.218.0 | ^0.222.0 | [experimental/CHANGELOG](https://github.com/open-telemetry/opentelemetry-js/blob/main/experimental/CHANGELOG.md) : breaking sur la config fichier, `sdk-logs` et `BatchLogRecordProcessor` | `otel.ts` n'utilise ni logs ni config fichier (`NodeSDK({ resource, spanProcessors })`, lignes 92-100). Aucun |
| `@opentelemetry/resources`, `sdk-trace-base` | 2.7.1 | ^2.11.0 | [CHANGELOG](https://github.com/open-telemetry/opentelemetry-js/blob/main/CHANGELOG.md) : seul breaking, l'annonce du retrait de `shim-opentracing` | Aucun |
| `@opentelemetry/semantic-conventions` | 1.41.1 | ^1.43.0 | mineure | Aucun |
| `@sentry/elysia` | 10.63.0 (exact) | 10.75.1 (exact) | [releases 10.64→10.75](https://github.com/getsentry/sentry-javascript/releases) : aucune entrée Elysia ni breaking | Pin exact conservé : le SDK est en alpha (README du paquet) |
| `@aws-sdk/client-s3`, `s3-request-presigner` | 3.1057.0 | ^3.1137.0 | mineures | Aucun |
| `drizzle-orm` / `drizzle-kit` | 0.45.2 / 0.31.10 | ^0.45.3 / ^0.31.11 | tag `latest` npm. La 1.0 est en `rc` (1.0.0-rc.5), donc pas stable | Aucun. La règle `database-migrations.md` cite 0.45.2 pour l'absence de verrou du migrateur, à revérifier à l'étape suivante |
| `@sinclair/typebox`, `mammoth`, `p-limit`, `ts-fsrs`, `unpdf` | — | ^0.34.52, ^1.12.3, ^7.3.3, ^5.4.2, ^1.8.1 | patchs/mineures | Aucun |
| `bun-types` | 1.3.14 | ^1.4.2 | suit le runtime Bun (B.6) | Aucun |
| `@typescript-eslint/*`, `typescript-eslint` | 8.60.0 | ^8.70.1 | mineures | Peer TS `<6.1.0` compatible avec 6.0.3 |
| `eslint` (catalog), `globals`, `@eslint/compat`, `@next/eslint-plugin-next` | 10.4.1, 17.6.0, 2.1.0, 16.2.6 | ^10.11.0, ^17.12.0, ^2.1.1, ^16.3.5 | mineures | `packages/eslint-config` déclare `eslint: ^10.4.0` en dur : passé à `catalog:` pour une seule source |

- [x] **Monter les versions :**
  ```bash
  cd /home/ordiv/projets/tomai-monorepo
  pnpm update -r --latest @ai-sdk/mistral @mistralai/mistralai elysia zod \
    @opentelemetry/sdk-node @opentelemetry/exporter-trace-otlp-http @opentelemetry/resources \
    @opentelemetry/sdk-trace-base @opentelemetry/semantic-conventions @opentelemetry/api \
    @aws-sdk/client-s3 @aws-sdk/s3-request-presigner drizzle-orm drizzle-kit \
    @sinclair/typebox mammoth p-limit ts-fsrs unpdf postgres bun-types \
    @typescript-eslint/eslint-plugin @typescript-eslint/parser typescript-eslint \
    globals @eslint/js @eslint/compat @next/eslint-plugin-next eslint
  pnpm --filter tomai-server add ai@^7.0.109
  pnpm --filter tomai-server add @sentry/elysia@10.75.1 --save-exact
  pnpm --filter @repo/eslint-config add -D eslint@catalog:
  ```
  Attendu : exit 0. `grep -n '"ai"\|"@sentry/elysia"\|"elysia"\|"better-auth"' apps/server/package.json` montre `^7.0.10x`, `10.75.1`, `^1.4.30`, et `better-auth` inchangé (traité en B.4).

- [x] **Revérifier l'absence de verrou dans le migrateur Drizzle 0.45.3** (règle `database-migrations.md`) :
  ```bash
  grep -n "advisory\|pg_advisory_lock" node_modules/drizzle-orm/pg-core/dialect.js; echo "exit=$?"
  ```
  Attendu : `exit=1` (pas de verrou). L'advisory lock de `apps/server/src/db/migrate.ts` reste nécessaire. Dans `.claude/rules/database-migrations.md`, remplacer « `drizzle-orm` 0.45.2 ne pose aucun verrou » par « `drizzle-orm` 0.45.3 ne pose aucun verrou ».

- [x] **Valider le serveur et le contrat Eden :**
  ```bash
  cd apps/server
  bun run typecheck; echo "typecheck=$?"
  bun run lint; echo "lint=$?"
  bun run test; echo "test=$?"
  bun run test:integration; echo "integration=$?"
  bun run build; echo "build=$?"
  cd ../.. && pnpm --filter @repo/api typecheck; echo "api=$?"
  ```
  Attendu : tous les codes à 0. Pour prouver que le contrat n'a pas bougé, générer `dist/types/app.d.ts` sur `main` (`git worktree add /tmp/main-wt main && cd /tmp/main-wt && pnpm install && pnpm --filter tomai-server build:types`) puis `diff /tmp/main-wt/apps/server/dist/types/app.d.ts apps/server/dist/types/app.d.ts`. Attendu : aucune différence de routes. Une différence limitée aux types internes d'une dépendance se documente dans la PR.

- [x] **Commit.**
  ```bash
  git add apps/server/package.json
  git add packages/tokens/package.json
  git add packages/eslint-config/package.json
  git add pnpm-workspace.yaml
  git add pnpm-lock.yaml
  git add .claude/rules/database-migrations.md
  git commit -m "build(server): bump AI SDK, Mistral SDK, Elysia, Zod, OpenTelemetry, Sentry, AWS SDK, Drizzle and lint toolchain

  Elysia 1.4.30 fixes five advisories. @ai-sdk/mistral 4.0.48 adds the
  promptCacheKey chat option. No breaking change reaches this codebase:
  Mistral SDK 2.7 breaks connectors only, OpenTelemetry 0.222 breaks logs
  and file config only.
  Sources: https://github.com/elysiajs/elysia/releases/tag/1.4.30
  https://github.com/mistralai/client-ts/releases/tag/v2.7.0
  https://github.com/open-telemetry/opentelemetry-js/blob/main/experimental/CHANGELOG.md

  Co-Authored-By: Claude <noreply@anthropic.com>"
  ```

---

### Tâche B.4 — better-auth 1.6 → 1.7

**Files:**
- Modify `apps/server/package.json` (`better-auth`)
- Modify `apps/server/src/lib/auth.ts:1-13,189-197`
- Modify `apps/server/src/db/schema/auth.schema.ts:104-129` (seulement si la génération révèle un écart)
- Create `apps/server/drizzle/00NN_*.sql` + `drizzle/meta/*` (générés par `db:generate`, seulement si le schéma change)
- Modify `pnpm-lock.yaml`

**Interfaces :** Consumes : `betterAuth`, `openAPI`, `username` de `better-auth@1.7.5` (`package/dist/plugins/index.d.mts:52,66` du tarball 1.7.5). Produces : `auth` avec les mêmes routes consommées (`/api/auth/sign-in/email`, `/sign-in/username`, `/sign-in/social`, session). `mcp` n'est plus exporté par `better-auth/plugins` en 1.7.5 (absent de la liste d'exports de `dist/plugins/index.d.mts`).

Breaking changes de la 1.7 ([release v1.7.0](https://github.com/better-auth/better-auth/releases/tag/v1.7.0), [guide de montée 1.7](https://better-auth.com/docs/guides/1-7-upgrade-guide)) confrontés à `auth.ts` :
- **Plugin MCP déplacé dans `@better-auth/mcp`.** Il exige `jwt()`, `@better-auth/oauth-provider`, `@better-auth/cimd`, un `resource` HTTPS et les tables `oauthClient`/`oauthRefreshToken`/`oauthClientAssertion`. Ici, `mcp({ loginPage: "/sign-in" })` n'est chargé qu'en développement (`auth.ts:193-195`), aucune table OAuth n'existe dans le schéma (`grep -rn "oauthApplication\|oauth_application" apps/server/src` : vide), donc le plugin n'a jamais pu fonctionner, et aucun code ne le consomme. **Décision : le retirer.** Le recâbler serait une fonctionnalité nouvelle, hors périmètre.
- **Identité de compte par émetteur** (`Account.issuer`) : NOT NULL en 1.7.0-1.7.2, rendu facultatif en 1.7.3. « 1.6 databases do not need this step—the column was never added » (guide de montée). Le guide demande de vérifier l'absence de doublons `(providerId, accountId)`, qui seront rejetés.
- Origine résolue depuis `Host` avec un `baseURL` dynamique : `baseURL` est statique ici (`auth.ts:92`), donc non concerné.
- `oidcProvider`, generic OAuth, SCIM, 2FA, One Tap, Electron, Microsoft Entra : non utilisés (`grep -rn "oidcProvider\|genericOAuth\|twoFactor\|oneTap\|scim" apps/server/src` : vide).
- `openAPI` et `username` : toujours exportés en 1.7.5.
- Plugin Expo (`getCookie()` asynchrone) : supprimé par la PR A. Contrôle : `grep -n "expo" apps/server/src/lib/auth.ts` doit être vide.

- [x] **Monter et voir l'échec.**
  ```bash
  cd /home/ordiv/projets/tomai-monorepo
  grep -n "expo" apps/server/src/lib/auth.ts; echo "expo-grep=$?"   # attendu 1 (PR A)
  pnpm --filter tomai-server add better-auth@^1.7.5
  cd apps/server && bun run typecheck; echo "exit=$?"
  ```
  Attendu : `error TS2305: Module '"better-auth/plugins"' has no exported member 'mcp'.` sur `src/lib/auth.ts:13`, `exit=2`.

- [x] **Retirer le plugin MCP de `auth.ts`.** En-tête (lignes 1-10), remplacer le bloc de commentaire par :
  ```typescript
  /**
   * Better Auth Configuration - Production Ready
   * Configuration propre et flexible basée sur la configuration centralisée
   *
   * Plugins:
   * - openAPI: API documentation (development only)
   * - username: Autonomous child login
   */
  ```
  Ligne 13 :
  ```typescript
  import { openAPI, username } from "better-auth/plugins";
  ```
  Bloc `plugins` (lignes 188-197, après retrait d'`expo()` par la PR A) :
  ```typescript
    plugins: [
      // openAPI only in development: it exposes the internal auth structure.
      // Typed as BetterAuthPlugin[] so this dev-only plugin doesn't leak its
      // (un-nameable) option types into `typeof auth` — which would break the
      // declaration emit of the public App type.
      ...(isDevelopment() ? ([openAPI()] as BetterAuthPlugin[]) : []),
      username(), // Autonomous child login: POST /api/auth/sign-in/username
    ],
  ```

- [x] **Voir passer le typecheck :** `bun run typecheck; echo "exit=$?"`. Attendu : `exit=0`.

- [x] **Comparer le schéma attendu par 1.7 au schéma Drizzle** (codebase-first, `.claude/rules/database-migrations.md`) :
  ```bash
  cd apps/server
  docker compose -f ../../docker-compose.yml up -d postgres
  set -a; . ./.env; set +a
  npx -y auth@1.7.5 generate --config src/lib/auth.ts --output /tmp/better-auth-1.7-schema.ts --yes; echo "exit=$?"
  ```
  CLI documentée sur [better-auth.com/docs/concepts/cli](https://better-auth.com/docs/concepts/cli) (`generate --config --output --yes`). Comparer les tables `user`, `session`, `account`, `verification` de `/tmp/better-auth-1.7-schema.ts` à `src/db/schema/auth.schema.ts`. Règle : toute colonne ou index présent dans la sortie générée et absent de `auth.schema.ts` est porté à l'identique (nom SQL, type, nullabilité) dans `auth.schema.ts`. Les champs propres à TomAI (`firstName`, `role`, `loginCount`…) et les index `idx_*` existants sont gardés. Si l'écart est nul, passer à l'étape de validation. Ce résultat n'a pas pu être vérifié à la rédaction (voir notes) : c'est cette étape qui le tranche.

- [x] **Si le schéma change : doublons puis migration.**
  ```bash
  docker exec tomai-postgres-dev psql -U tomai_dev -d tomai_dev -c \
    'SELECT provider_id, account_id, count(*) FROM account GROUP BY 1, 2 HAVING count(*) > 1;'
  bun run db:generate
  bun run db:migrate
  bun run db:check; echo "exit=$?"
  ```
  Attendu : requête sans ligne, un fichier `drizzle/00NN_*.sql` généré (jamais édité à la main), `db:check` exit 0. Requête du guide de montée, avec les noms de colonnes snake_case de `auth.schema.ts:110-111`.

- [x] **Valider.**
  ```bash
  bun run lint; echo "lint=$?"
  bun run test; echo "test=$?"
  bun run test:integration; echo "integration=$?"
  bun run build; echo "build=$?"
  ```
  Attendu : quatre codes à 0. `auth-macro.test.ts` et les tests d'intégration auth couvrent la connexion email, username et la session. Puis prouver le parcours réel, serveur lancé par `pnpm dev` : `curl -si -X POST localhost:3000/api/auth/sign-in/username -H 'content-type: application/json' -d '{"username":"<élève seed>","password":"<mot de passe seed>"}'` doit renvoyer `200` et un `set-cookie: better-auth.session_token=…`. Le compte vient de `pnpm seed` (`apps/server/src/scripts/seed-dev.ts`).

- [x] **Commit.**
  ```bash
  git add apps/server/package.json
  git add apps/server/src/lib/auth.ts
  git add pnpm-lock.yaml
  # seulement si l'étape de génération a changé le schéma :
  git add apps/server/src/db/schema/auth.schema.ts
  git add apps/server/drizzle
  git commit -m "build(auth): upgrade better-auth to 1.7 and drop the dev-only MCP plugin

  better-auth 1.7 moves mcp() to @better-auth/mcp, which requires jwt(),
  the OAuth provider and its tables. The plugin was dev-only, had no
  tables and no consumer. 1.6 databases need no issuer backfill.
  Sources: https://github.com/better-auth/better-auth/releases/tag/v1.7.0
  https://better-auth.com/docs/guides/1-7-upgrade-guide

  Co-Authored-By: Claude <noreply@anthropic.com>"
  ```

---

### Tâche B.5 — Landing et packages UI : Motion 13, React 19.3, Next, Tailwind, Radix, lucide

**Files:**
- Modify `apps/landing/package.json:19-37`
- Modify `apps/landing/components/sections/faq.tsx:4`, `sections/how-it-works.tsx:4`, `sections/features.tsx:10`, `atoms/fade-in.tsx:3`, `atoms/animated-counter.tsx:4`, `atoms/rotating-text.tsx:4`
- Modify `packages/ui/package.json:dependencies`
- Modify `pnpm-workspace.yaml:23-42` (catalog)
- Modify `README.md:42`, `pnpm-lock.yaml`

**Interfaces :** Consumes : `motion`, `AnimatePresence`, `useInView` depuis `motion/react` ([motion.dev/docs/react-upgrade-guide](https://motion.dev/docs/react-upgrade-guide) : « npm uninstall framer-motion / npm install motion », « import { motion } from "motion/react" »). Produces : composants de la landing sans changement de props.

- **Motion 12 → 13** ([CHANGELOG 13.0.0](https://github.com/motiondivision/motion/blob/main/CHANGELOG.md), 2026-08-05) : un seul breaking, « Removed optional `@emotion/is-prop-valid` dependency in favour of explicit `<MotionConfig isValidProp={isPropValid}>` ». Il n'affecte que les composants stylés par une lib CSS-in-JS passés à `motion()`. `grep -rln "emotion\|styled" apps/landing --include=*.tsx` : vide, donc aucun effet. Usages grepés : `motion.div`/`motion.span`, `AnimatePresence` (dont `mode="wait"`), `whileInView`, `variants`, `useInView(ref, { once, margin })`, tous inchangés en 13. Le paquet `framer-motion` est remplacé par `motion`, que la doc officielle désigne comme paquet courant, et que Renovate signalait déjà comme remplacement disponible (dashboard #119).
- **React 19.2.3 → 19.3.0** ([release v19.3.0](https://github.com/facebook/react/releases/tag/v19.3.0), [billet](https://react.dev/blog/2026/09/09/react-19-3)) : ajouts (`<ViewTransition />`, refs de Fragment, `browser()`). Changement de comportement notable : les transitions ne sont plus enchevêtrées. Le pin 19.2.3 n'existait que pour Expo SDK 56 (commentaire du catalog). `next@16.3.5` accepte `^19.0.0` en peer.
- **`@types/node` → ^24.13.6, pas 26.** Les types décrivent le runtime minimal : Node 24 en CI (`.nvmrc`), dans Docker (nodesource 24) et sur Vercel (24.x max). Les types 25/26 exposent des API absentes de Node 24. L'override racine `'@types/node': 25.9.1` n'avait qu'une raison mobile (collision `Response` RN/undici) : il est retiré en B.7. `bun-types` déclare `@types/node: "*"`, sans contrainte.
- lucide-react 1.17→1.47, Radix (patchs), `sonner`, `tailwind-merge` 3.7, Tailwind 4.3.3, `@sentry/nextjs` 10.75.1 (peer `next ^16.0.0-0`), `postcss` : mineures et patchs.

- [x] **Remplacer framer-motion et voir l'échec.**
  ```bash
  cd /home/ordiv/projets/tomai-monorepo
  pnpm --filter landing remove framer-motion
  pnpm --filter landing add motion@^13.4.0
  pnpm --filter landing typecheck; echo "exit=$?"
  ```
  Attendu : `TS2307: Cannot find module 'framer-motion'` sur les 6 fichiers, `exit=2`.

- [x] **Changer les imports :**
  ```bash
  sed -i 's|from "framer-motion";|from "motion/react";|' \
    apps/landing/components/sections/faq.tsx \
    apps/landing/components/sections/how-it-works.tsx \
    apps/landing/components/sections/features.tsx \
    apps/landing/components/atoms/fade-in.tsx \
    apps/landing/components/atoms/animated-counter.tsx \
    apps/landing/components/atoms/rotating-text.tsx
  grep -rn "framer-motion" apps/landing --include=*.tsx --include=*.ts --include=*.mjs --include=*.json; echo "exit=$?"
  ```
  Attendu : `exit=1`. Résultat, par exemple `faq.tsx:4` : `import { motion, AnimatePresence } from "motion/react";`.

- [x] **Catalog (`pnpm-workspace.yaml`)**, entrées après retrait de `react-test-renderer` par la PR A :
  ```yaml
  catalog:
    '@radix-ui/react-slot': ^1.3.3
    '@types/react': ~19.3.0
    '@types/react-dom': ~19.3.0
    class-variance-authority: ^0.7.1
    clsx: ^2.1.1
    eslint: ^10.11.0
    lucide-react: ^1.47.0
    react: ^19.3.0
    react-dom: ^19.3.0
    tailwind-merge: ^3.7.0
    tailwindcss: ^4.3.3
    typescript: 6.0.3
  ```
  Le commentaire « Pinned to React 19.2.3 — the version Expo SDK 56 bundles… » est supprimé. `eslint: ^10.11.0` est déjà posé en B.3 si `pnpm update` a réécrit le catalog : ne garder qu'une entrée.

- [x] **Autres montées :**
  ```bash
  pnpm update -r --latest @sentry/nextjs @tailwindcss/postcss postcss next next-themes \
    @radix-ui/react-alert-dialog @radix-ui/react-avatar @radix-ui/react-dialog \
    @radix-ui/react-label @radix-ui/react-select sonner
  pnpm --filter landing add -D @types/node@^24.13.6
  pnpm install
  ```

- [x] **Doc :** `README.md:42`, remplacer `Framer Motion` par `Motion 13`.

- [x] **Valider, build compris, et voir la page.**
  ```bash
  pnpm --filter landing typecheck; echo "typecheck=$?"
  pnpm --filter landing lint; echo "lint=$?"
  pnpm --filter @repo/ui typecheck; echo "ui=$?"
  pnpm --filter @repo/ui lint; echo "ui-lint=$?"
  pnpm --filter landing build; echo "build=$?"
  ```
  Attendu : cinq codes à 0. Ensuite `pnpm dev:landing`, puis ouvrir `http://localhost:3001`. Vérifier que la FAQ s'ouvre et se ferme (AnimatePresence), que le texte rotatif du hero change, que les compteurs s'animent au scroll (`useInView`) et que la console ne montre aucune erreur. Preuve de visu, pas seulement le build.

- [x] **Commit.**
  ```bash
  git add apps/landing/package.json
  git add apps/landing/components/sections/faq.tsx
  git add apps/landing/components/sections/how-it-works.tsx
  git add apps/landing/components/sections/features.tsx
  git add apps/landing/components/atoms/fade-in.tsx
  git add apps/landing/components/atoms/animated-counter.tsx
  git add apps/landing/components/atoms/rotating-text.tsx
  git add packages/ui/package.json
  git add pnpm-workspace.yaml
  git add pnpm-lock.yaml
  git add README.md
  git commit -m "build(landing): move to motion 13, React 19.3 and latest Next, Tailwind, Radix, lucide

  framer-motion is replaced by the motion package (motion/react). The only
  v13 breaking change (@emotion/is-prop-valid) does not apply: no CSS-in-JS.
  React is unpinned from 19.2.3, which only tracked Expo SDK 56.
  @types/node follows the Node 24 runtime (CI, Docker, Vercel).
  Sources: https://motion.dev/docs/react-upgrade-guide
  https://github.com/facebook/react/releases/tag/v19.3.0
  https://vercel.com/docs/functions/runtimes/node-js/node-js-versions

  Co-Authored-By: Claude <noreply@anthropic.com>"
  ```

---

### Tâche B.6 — Bun 1.4 et Postgres 18 (Docker, CI)

**Files:**
- Modify `docker-compose.yml:71-75,86,109,147-149`
- Modify `.github/workflows/ci.yml:86`
- Modify `.github/actions/setup-monorepo/action.yml` (`bun-version`)
- Modify `apps/server/Dockerfile:4,9,146`
- Modify `README.md:41`, `apps/server/README.md:35,37,76`, `.claude/skills/dev-bootstrap/SKILL.md` (section volumes)

**Interfaces :** Consumes : rien. Produces : image dev `pgvector/pgvector:0.8.6-pg18`, volume `tomai_postgres18_dev_data`, runtime Bun 1.4.

- **Bun 1.4.2** (latest, [release bun-v1.4.2](https://github.com/oven-sh/bun/releases/tag/bun-v1.4.2)). Le [billet Bun 1.4](https://bun.com/blog/bun-v1.4) et la [release 1.4.0](https://github.com/oven-sh/bun/releases/tag/bun-v1.4.0) ne listent aucun breaking change. Seuls les tests prouvent la compatibilité. Tags Docker disponibles : `oven/bun:1.4-slim`, `oven/bun:1.4-alpine` (Docker Hub, relevé 2026-09-22).
- **Postgres 18 + pgvector 0.8.6.** pgvector reste nécessaire (`session_episodes.summary_embedding vector(1024)`, `learning.schema.ts:238`, index HNSW). Dernier tag stable : `0.8.6-pg18` ; `postgres:19` n'est qu'en beta (`19beta3`). Changement d'image : « The `PGDATA` environment variable of the image was changed to be version specific in PostgreSQL 18 and above. For 18 it is `/var/lib/postgresql/18/docker` … The defined `VOLUME` was changed in 18 and above to `/var/lib/postgresql` » ([Docker Hub postgres](https://hub.docker.com/_/postgres), [docker-library/postgres#1259](https://github.com/docker-library/postgres/pull/1259)). Un volume PG16 n'est pas lisible par PG18. L'app n'est pas en prod ; on crée donc **un volume neuf, sous un nom neuf**, pour qu'aucune base PG16 ne soit montée par erreur, et on supprime l'ancien à la main.
- Compatibilité Drizzle et postgres.js avec PG18 : aucune matrice de versions publiée. Le client parle le protocole v3, stable depuis PG 7.4. C'est `test:integration` sur PG18 en CI qui fait la preuve.

- [x] **`docker-compose.yml` :**
  - lignes 71-75 :
    ```yaml
    # ===========================================
    # PostgreSQL 18 + pgvector
    # ===========================================
    postgres:
      image: pgvector/pgvector:0.8.6-pg18
    ```
  - ligne 86 (PG18 : le volume se monte sur `/var/lib/postgresql`, PGDATA en sous-dossier versionné) :
    ```yaml
          - postgres_dev_data:/var/lib/postgresql
    ```
  - lignes 147-149 :
    ```yaml
    volumes:
      postgres_dev_data:
        name: tomai_postgres18_dev_data
    ```
  - ligne 109 : `image: oven/bun:1.4-alpine`
- [x] **`.github/workflows/ci.yml:86`** : `image: pgvector/pgvector:0.8.6-pg18`.
- [x] **`action.yml`** : `bun-version: "1.4"`.
- [x] **`apps/server/Dockerfile`** : ligne 4 `# Runtime: Bun 1.4 | Package Manager: pnpm 12`, ligne 9 `FROM oven/bun:1.4-slim AS base`, ligne 146 `org.opencontainers.image.base.name="oven/bun:1.4-slim"`.
- [x] **Doc :** `README.md:41` → `Bun 1.4, Elysia 1.4, PostgreSQL 18 + pgvector, Drizzle ORM 0.45`. `apps/server/README.md:35` → `Bun 1.4`, lignes 37 et 76 → `PostgreSQL 18 + pgvector`. Dans `.claude/skills/dev-bootstrap/SKILL.md`, après la ligne `docker compose down -v`, ajouter :
  ```markdown
  Depuis Postgres 18 (lot 0), le volume s'appelle `tomai_postgres18_dev_data`. Un
  ancien volume `tomai_postgres_dev_data` (PG16) est illisible par PG18 : le
  supprimer avec `docker volume rm tomai_postgres_dev_data`, puis `pnpm setup`.
  ```

- [x] **Bascule locale (étape manuelle, destructrice pour les données locales, à confirmer avec l'utilisateur avant exécution) :**
  ```bash
  cd /home/ordiv/projets/tomai-monorepo
  pnpm dev:down
  docker volume rm tomai_postgres_dev_data
  bun upgrade && bun --version   # attendu 1.4.x
  pnpm setup; echo "setup=$?"
  docker exec tomai-postgres-dev psql -U tomai_dev -d tomai_dev -tAc "SHOW server_version; SELECT extversion FROM pg_extension WHERE extname='vector';"
  ```
  Attendu : `setup=0`, `18.x` et `0.8.6`.

- [x] **Valider sur la vraie stack :**
  ```bash
  cd apps/server && bun run test && bun run test:integration; echo "exit=$?"
  cd ../.. && pnpm doctor:e2e; echo "doctor=$?"
  docker build --target production -f apps/server/Dockerfile .; echo "docker=$?"
  ```
  Attendu : trois codes à 0. `pnpm doctor:e2e` sort en échec au moindre SKIP. Puis `pnpm dev` et `curl -s localhost:3000/health`, qui doit renvoyer un statut `healthy` avec la base joignable.

- [x] **Commit.**
  ```bash
  git add docker-compose.yml
  git add .github/workflows/ci.yml
  git add .github/actions/setup-monorepo/action.yml
  git add apps/server/Dockerfile
  git add README.md
  git add apps/server/README.md
  git add .claude/skills/dev-bootstrap/SKILL.md
  git commit -m "build(db): move to Postgres 18 with pgvector 0.8.6 and Bun 1.4

  Postgres 18 images mount the volume on /var/lib/postgresql with a
  versioned PGDATA; a new volume name keeps a PG16 data directory from
  being mounted. Local data must be recreated (app not in production).
  Sources: https://hub.docker.com/_/postgres
  https://github.com/docker-library/postgres/pull/1259
  https://github.com/oven-sh/bun/releases/tag/bun-v1.4.0

  Co-Authored-By: Claude <noreply@anthropic.com>"
  ```

---

### Tâche B.7 — Revue des `overrides`, `outdated` et `audit` finaux

**Files:**
- Modify `pnpm-workspace.yaml:9-14` (`publicHoistPattern`), `:43-46` (`minimumReleaseAgeExclude`), `:49-150` (`overrides`)
- Modify `pnpm-lock.yaml`

**Interfaces :** aucune.

Décisions préétablies, étayées par un motif vérifié :

| Override | Décision | Raison |
|---|---|---|
| `'@types/node': 25.9.1` | supprimé | Motif mobile (collision `Response` RN/undici), levé par la PR A ; landing en ^24 (B.5) |
| `'@expo/dom-webview'`, `'expo-build-properties>ajv'`, `'markdown-it>linkify-it'`, `markdown-it`, `'@xmldom/xmldom@0.8'`, `'@xmldom/xmldom@0.9'`, `'js-yaml@3'` (jest), `lightningcss: 1.30.1` (migration NativeWind v5, commit `7defb41`), `publicHoistPattern: ['@babel/*']` (jest-preset RN) | supprimés s'ils sont encore là après la PR A | Motif mobile, écrit dans leur commentaire ou leur commit |
| `kysely: 0.28.17` | supprimé | [better-auth#9610](https://github.com/better-auth/better-auth/issues/9610) fermé le 2026-06-01, et `@better-auth/kysely-adapter@1.7.5` déclare `kysely: ^0.28.17 \|\| ^0.29.0`. Preuve : `bun run build` serveur, que ce bug cassait |
| `'@grpc/grpc-js'`, `protobufjs` | à tester (protocole ci-dessous) | `@opentelemetry/sdk-node@0.222.0` tire toujours les exporteurs gRPC |
| les planchers de sécurité (`esbuild`, `fast-xml-parser`, `rollup`, `tar`, `qs`, `lodash-es`, `@isaacs/brace-expansion`, les `minimatch`, `eslint>ajv`, `hono`, `@hono/node-server`, `file-type`, `underscore`, `@tootallnate/once`, `lodash`, `uuid`, `postcss`, `brace-expansion`, `jsdom>undici`, `nanoid@3`, `nanoid@5`, `js-yaml@4`, `sharp`, `fast-uri`, `shell-quote`, `@opentelemetry/propagator-jaeger`, `browserslist`) | à tester (protocole ci-dessous) | Commentaire : « drop once parents bump » |
| `minimumReleaseAgeExclude: [tinyexec]` | à tester : retirer, `pnpm install`. Garder seulement si l'install échoue sur `tinyexec` | Pas de motif écrit |

Protocole pour chaque override « à tester » : on le retire, puis on mesure. Il ne revient que si la mesure l'exige.

- [x] **Retirer d'un bloc** les overrides des lignes « supprimé » et « à tester », avec leurs commentaires, dans `pnpm-workspace.yaml`. Garder `allowBuilds`, `catalog`, `minimumReleaseAge: 1440`.
  ```bash
  pnpm install; echo "install=$?"
  pnpm audit --prod --audit-level high; echo "audit=$?"
  ```
- [x] **Si `audit≠0`**, pour chaque advisory listée : `pnpm why -r <paquet>` identifie le parent. Si une version plus récente du parent corrige, la monter. Sinon, réintroduire **ce seul** override avec un commentaire au format existant : GHSA, chemin, et « drop once <parent> bumps ». Relancer jusqu'à `audit=0`. Aucune GHSA n'est ajoutée à `audit.ignore` sans analyse écrite dans le commentaire (chemin, exposition runtime), comme pour les entrées existantes.
- [x] **Vérifier `pnpm outdated -r` :**
  ```bash
  pnpm outdated -r; echo "exit=$?"
  ```
  Attendu : exactement deux lignes, `typescript 6.0.3 → 7.0.x` (bloqué par le peer `typescript-eslint <6.1.0`, voir B.2) et `@types/node 24.x → 26.x` (suit le runtime Node 24, voir B.5). Toute autre ligne se monte, sauf si le paquet a été publié il y a moins de 24 h (`minimumReleaseAge`), à noter dans la PR.
- [x] **Validation complète de fin de PR :**
  ```bash
  pnpm typecheck; echo "typecheck=$?"
  pnpm lint; echo "lint=$?"
  pnpm test; echo "test=$?"
  (cd apps/server && bun run test:integration); echo "integration=$?"
  pnpm build; echo "build=$?"
  pnpm exec knip; echo "knip=$?"
  npx sherif@1.13.0; echo "sherif=$?"
  pnpm audit --prod --audit-level high; echo "audit=$?"
  ```
  Attendu : tous à 0.
- [x] **Commit.**
  ```bash
  git add pnpm-workspace.yaml
  git add pnpm-lock.yaml
  git commit -m "build(ci): drop overrides made obsolete by the upgrades and the mobile removal

  Each removed override was re-measured with pnpm audit --prod
  --audit-level high; only overrides it still requires are kept, with
  their advisory and parent chain.
  Source: https://pnpm.io/settings#overrides

  Co-Authored-By: Claude <noreply@anthropic.com>"
  ```

---

### Tâche B.8 — Renovate : diagnostic et remise en marche

**Files:**
- Modify `.github/renovate.json` (réécriture complète)
- Create `.github/workflows/renovate.yml`

**Interfaces :** Consumes : secret `RENOVATE_TOKEN` (étape manuelle). Produces : exécution quotidienne de Renovate, visible dans l'onglet Actions.

**Diagnostic (faits vérifiés le 2026-09-22) :**
- La config n'est pas en cause : `renovate-config-validator --strict` (Renovate latest) sur `.github/renovate.json` → « Config validated successfully », exit 0.
- Dernier commit Renovate : 2026-06-03. Dernière PR ouverte : #177, le 2026-06-03. Les PR #176/#177, restées ouvertes et en conflit jusqu'au 2026-07-05, n'ont reçu aucun rebase après le 2026-06-03 : Renovate ne tournait plus.
- Le Dependency Dashboard #119 a été fermé à la main le 2026-06-05 et n'a jamais été recréé. Renovate recrée ou rouvre son dashboard à chaque exécution tant que `dependencyDashboard` est actif. Son absence prouve que l'app n'a pas tourné une seule fois depuis.
- Aucune issue « Action Required: Fix Renovate Configuration » n'a été ouverte, ce qui écarte l'erreur de config.
- Juste avant l'arrêt, le dashboard listait une quarantaine de mises à jour « Rate-Limited » : `prConcurrentLimit: 8` était saturé par 8 PR mobiles jamais mergées. Cela ralentissait Renovate sans l'arrêter.
- **Conclusion :** l'app Mend Renovate a cessé de traiter le dépôt vers le 2026-06-03 (désinstallée, dépôt désélectionné ou désactivé côté Mend). L'API ne permet pas de le lire avec le token `gh` disponible (`/user/installations` → 403), il faut donc une vérification manuelle. Le vrai défaut est qu'**une app hébergée qui s'arrête ne prévient personne**.

**Correctif : Renovate auto-hébergé dans un workflow planifié.** Un workflow planifié qui échoue envoie une notification à l'auteur du cron ([GitHub Docs, Notifications for workflow runs](https://docs.github.com/en/actions/concepts/workflows-and-actions/notifications-for-workflow-runs)). Un arrêt devient donc visible sous 24 h. L'action officielle est [`renovatebot/github-action`](https://github.com/renovatebot/github-action) (v46.3.3, SHA `9fea9f0fbf80401026d11d03911d62b1f70fef1f`). Les options self-hosted passent par des variables `RENOVATE_*` ([self-hosted configuration](https://docs.renovatebot.com/self-hosted-configuration/), ex. `RENOVATE_ONBOARDING`).

- [x] **Créer `.github/workflows/renovate.yml` :**
  ```yaml
  # Self-hosted Renovate: a failed scheduled run notifies the cron author,
  # unlike the hosted app that stopped silently in June 2026.
  # https://github.com/renovatebot/github-action

  name: Renovate

  on:
    schedule:
      - cron: '0 4 * * *'
    workflow_dispatch:

  permissions:
    contents: read

  concurrency:
    group: renovate
    cancel-in-progress: false

  jobs:
    renovate:
      name: Renovate
      runs-on: ubuntu-latest
      timeout-minutes: 60
      steps:
        - uses: renovatebot/github-action@9fea9f0fbf80401026d11d03911d62b1f70fef1f # v46.3.3
          with:
            token: ${{ secrets.RENOVATE_TOKEN }}
          env:
            RENOVATE_REPOSITORIES: ${{ github.repository }}
            RENOVATE_ONBOARDING: 'false'
            LOG_LEVEL: info
  ```
  Le run est quotidien : la config limite déjà la création de branches à `before 9am on monday`, tandis que les alertes de vulnérabilité (`at any time`) et les cases cochées du dashboard sont traitées chaque jour.

- [x] **Réécrire `.github/renovate.json`.** Par rapport à l'existant : règles mobiles retirées (expo, react-navigation, react-native, rn-primitives, revenuecat, tanstack), groupe react sans `react-test-renderer`, `:maintainLockFilesMonthly` retiré (contredit par `lockFileMaintenance.schedule` hebdomadaire), et deux contraintes explicites qui transforment les écarts documentés en règles :
  ```json
  {
    "$schema": "https://docs.renovatebot.com/renovate-schema.json",
    "extends": [
      "config:recommended",
      ":semanticCommits",
      ":semanticCommitTypeAll(deps)",
      ":dependencyDashboard",
      "group:monorepos",
      "group:recommended",
      "helpers:pinGitHubActionDigests"
    ],
    "timezone": "Europe/Paris",
    "schedule": ["before 9am on monday"],
    "labels": ["dependencies"],
    "rangeStrategy": "bump",
    "rebaseWhen": "conflicted",
    "prHourlyLimit": 4,
    "prConcurrentLimit": 8,
    "branchConcurrentLimit": 8,
    "ignorePaths": [
      "**/node_modules/**",
      "**/dist/**",
      "**/.next/**",
      "**/build/**",
      "**/coverage/**",
      "**/.turbo/**"
    ],
    "major": {
      "dependencyDashboardApproval": true,
      "automerge": false,
      "labels": ["dependencies", "major"],
      "commitMessagePrefix": "chore(deps)!",
      "prBodyNotes": [
        ":warning: **Major upgrade — human review required.** Renovate has linked release notes and migration guides above when available. Verify breaking changes locally before merging."
      ]
    },
    "lockFileMaintenance": {
      "enabled": true,
      "schedule": ["before 9am on monday"],
      "automerge": true,
      "automergeType": "pr",
      "automergeStrategy": "merge-commit",
      "commitMessageAction": "Refresh",
      "commitMessageTopic": "lockfiles"
    },
    "vulnerabilityAlerts": {
      "enabled": true,
      "schedule": ["at any time"],
      "labels": ["dependencies", "security"],
      "prCreation": "immediate",
      "automerge": false,
      "minimumReleaseAge": null,
      "commitMessagePrefix": "fix(security)"
    },
    "osvVulnerabilityAlerts": true,
    "packageRules": [
      {
        "description": "Workspace internal packages have no external version — never update.",
        "matchPackageNames": ["@repo/**"],
        "enabled": false
      },
      {
        "description": "Auto-merge minor + patch once CI is green, after a 3-day release age (supply-chain buffer).",
        "matchUpdateTypes": ["minor", "patch", "pin", "digest"],
        "automerge": true,
        "automergeType": "pr",
        "automergeStrategy": "merge-commit",
        "platformAutomerge": true,
        "minimumReleaseAge": "3 days"
      },
      {
        "description": "Majors always need a human reviewer.",
        "matchUpdateTypes": ["major"],
        "automerge": false,
        "dependencyDashboardApproval": true,
        "addLabels": ["major"]
      },
      {
        "description": "TypeScript 7 is blocked: typescript-eslint peer is typescript <6.1.0 until TS 7 ships an API. https://github.com/typescript-eslint/typescript-eslint/issues/10940",
        "matchPackageNames": ["typescript"],
        "allowedVersions": "<6.1.0"
      },
      {
        "description": "@types/node follows the Node runtime (.nvmrc, engines, Vercel). Raise together with the runtime.",
        "matchPackageNames": ["@types/node"],
        "allowedVersions": "<25.0.0"
      },
      { "description": "AWS SDK v3 in one bump.", "matchPackageNames": ["@aws-sdk/**"], "groupName": "aws-sdk" },
      { "description": "Better Auth packages together.", "matchPackageNames": ["better-auth", "@better-auth/**"], "groupName": "better-auth" },
      { "description": "Drizzle ORM toolchain.", "matchPackageNames": ["drizzle-orm", "drizzle-kit"], "groupName": "drizzle" },
      { "description": "Elysia + plugins.", "matchPackageNames": ["elysia", "@elysiajs/**"], "groupName": "elysia" },
      { "description": "ESLint toolchain.", "matchPackageNames": ["@typescript-eslint/**", "typescript-eslint", "eslint", "@eslint/**"], "groupName": "eslint" },
      { "description": "OpenTelemetry packages move in lockstep.", "matchPackageNames": ["@opentelemetry/**"], "groupName": "opentelemetry" },
      { "description": "Vercel AI SDK core and providers share provider-utils.", "matchPackageNames": ["ai", "@ai-sdk/**"], "groupName": "ai-sdk", "labels": ["dependencies", "ai-stack"] },
      { "description": "Mistral SDK is critical (EU sovereignty): isolated and reviewed.", "matchPackageNames": ["@mistralai/mistralai"], "groupName": "mistral", "labels": ["dependencies", "ai-stack"], "reviewers": ["VictorNain26"] },
      { "description": "Radix UI primitives.", "matchPackageNames": ["@radix-ui/**"], "groupName": "radix-ui" },
      { "description": "Tailwind toolchain.", "matchPackageNames": ["tailwindcss", "tailwind-merge", "@tailwindcss/**"], "groupName": "tailwind" },
      { "description": "React runtime and types together.", "matchPackageNames": ["react", "react-dom", "@types/react", "@types/react-dom"], "groupName": "react" },
      { "description": "Sentry SDKs together.", "matchPackageNames": ["@sentry/**"], "groupName": "sentry" },
      { "description": "GitHub Actions: pinned to digest, grouped.", "matchManagers": ["github-actions"], "groupName": "github-actions", "pinDigests": true, "commitMessagePrefix": "chore(ci)" },
      { "description": "Docker images (server base, Postgres, tools).", "matchManagers": ["dockerfile", "docker-compose"], "groupName": "docker", "commitMessagePrefix": "chore(docker)" }
    ]
  }
  ```
  Les blocs `minor`/`patch` de premier niveau sont retirés : ils dupliquaient la règle `matchUpdateTypes: [minor, patch, pin, digest]`.

- [x] **Valider la config.**
  ```bash
  npx --yes --package renovate@latest -- renovate-config-validator --strict .github/renovate.json; echo "exit=$?"
  docker run --rm -v "$PWD:/repo" -w /repo rhysd/actionlint@sha256:b1934ee5f1c509618f2508e6eb47ee0d3520686341fec936f3b79331f9315667 -color; echo "actionlint=$?"
  ```
  Attendu : « Config validated successfully », `exit=0`, `actionlint=0`.

- [x] **Commit.**
  ```bash
  git add .github/renovate.json
  git add .github/workflows/renovate.yml
  git commit -m "build(ci): self-host Renovate in a scheduled workflow and drop mobile rules

  The hosted Renovate app stopped processing the repository around
  2026-06-03 without any signal (config validates). A failed scheduled
  workflow notifies its author. TypeScript and @types/node constraints
  encode the documented blocks.
  Sources: https://github.com/renovatebot/github-action
  https://docs.renovatebot.com/self-hosted-configuration/
  https://docs.github.com/en/actions/concepts/workflows-and-actions/notifications-for-workflow-runs

  Co-Authored-By: Claude <noreply@anthropic.com>"
  ```

- [x] **Étapes manuelles (utilisateur, sur GitHub) :**
  1. Créer un token classique ([github.com/settings/tokens](https://github.com/settings/tokens)) avec les scopes `repo` (ou `public_repo`, le dépôt étant public) et `workflow`. `workflow` est requis pour que Renovate modifie `.github/workflows/*` (README de l'action, « Special token requirements when using the github-actions manager »). L'ajouter en secret de dépôt : `gh secret set RENOVATE_TOKEN`.
  2. Désactiver l'app hébergée pour ce dépôt, sinon deux Renovate ouvriraient les mêmes PR : Settings → Integrations → GitHub Apps → Renovate → Configure → retirer `tomai-monorepo`. Au passage, noter ce que montrait la page (app présente ou non), puis consulter [developer.mend.io/github/VictorNain26/tomai-monorepo](https://developer.mend.io/github/VictorNain26/tomai-monorepo) pour confirmer la cause de l'arrêt de juin.
  3. Après le merge : `gh workflow run renovate.yml`, puis `gh run watch`. Attendu : run vert, puis une issue « Dependency Dashboard » ouverte qui ne liste que les deux blocages documentés dans « Awaiting Schedule » ou « Pending Approval ». **Ne plus fermer le dashboard** : c'est le tableau de bord de Renovate, pas une tâche.

---

### Tâche B.9 — Plugins Claude Code (hors dépôt, étape manuelle)

Les plugins vivent dans `~/.claude/plugins`, hors dépôt. Aucun fichier du dépôt n'est modifié, et rien n'est commité.

Commandes documentées ([Discover plugins, « Manage marketplaces » et « Configure auto-updates »](https://code.claude.com/docs/en/discover-plugins), [Plugins reference, `claude plugin update` et `claude plugin marketplace update`](https://code.claude.com/docs/en/plugins-reference)) :

- [ ] Dans un terminal (hors session Claude Code) :
  ```bash
  claude plugin marketplace update
  claude plugin update superpowers@claude-plugins-official
  claude plugin update commit-commands@claude-plugins-official
  claude plugin update feature-dev@claude-plugins-official
  claude plugin update context7@claude-plugins-official
  claude plugin update security-guidance@claude-plugins-official
  claude plugin update typescript-lsp@claude-plugins-official
  claude plugin update pr-review-toolkit@claude-plugins-official
  claude plugin update mcp-server-dev@claude-plugins-official
  claude plugin update frontend-design@claude-plugins-official
  claude plugin update code-review@claude-plugins-official
  claude plugin update code-simplifier@claude-plugins-official
  claude plugin update skill-creator@claude-plugins-official
  claude plugin update playwright@claude-plugins-official
  claude plugin update claude-md-management@claude-plugins-official
  claude plugin update claude-code-setup@claude-plugins-official
  claude plugin update chrome-devtools-mcp@claude-plugins-official
  claude plugin update cloudflare@cloudflare
  ```
  (Liste tirée de `~/.claude/plugins/installed_plugins.json` le 2026-09-22.) Dans une session ouverte, lancer ensuite `/reload-plugins`.
- [ ] Optionnel : `claude plugin uninstall expo@claude-plugins-official`. Le plugin Expo ne sert plus une fois `apps/mobile` supprimé. Ses skills alourdissent le contexte à chaque session, et il continuera d'apparaître sous « Not used recently » dans `/plugin`.
- [ ] Auto-update : `claude-plugins-official` a l'auto-update activé par défaut. Les marketplaces tierces (`cloudflare`, `knowledge-work-plugins`) ne l'ont pas. Pour l'activer : `/plugin` → Marketplaces → choisir la marketplace → **Enable auto-update**.

---

### Validation de fin de PR

Rejouer la dernière étape de B.7 (huit commandes, toutes à 0), puis `gh pr checks --watch` sur la PR : tous les checks requis doivent être verts. Merge proposé : **merge commit**, car chaque commit se tient seul et se valide seul, conformément au `CLAUDE.md` du dépôt.

#### Notes de section

**Constats écartés ou corrigés**
- « typescript 7 bloqué par `typescript-eslint@8.70.0` » : confirmé et toujours vrai en 8.70.1 (latest le 2026-09-22), même peer `<6.1.0`.
- « `save-always` déprécié ? » : confirmé, `deprecationMessage` présent dans `actions/cache` de la v4.3.0 à la v6.1.0. Il est retiré, pas remplacé par un split `restore`/`save`, qui n'aurait pas de sens dans une composite action exécutée en début de job.
- `@types/node` 26 : écarté volontairement, voir B.5. Ce n'est pas un blocage technique, c'est un choix d'alignement sur le runtime. Il sera levé quand Node 26 deviendra LTS (2026-10-28) **et** que Vercel le proposera.
- Renovate : la config n'était pas en cause (validateur strict vert). La cause probable côté Mend reste à confirmer manuellement (B.8, étape 2).

**Points non vérifiés à la rédaction (chaque tâche porte l'étape qui les tranche)**
- Sortie exacte de `auth generate` en 1.7.5 face à `auth.schema.ts` (B.4). Le guide de montée garantit l'absence de colonne `issuer` obligatoire pour une base 1.6, pas l'absence de tout autre écart.
- Comportement exact de pnpm 12 sur `auditConfig` (erreur ou avertissement), déduit de la doc (B.2, première étape).
- Support de pnpm 12 par Renovate (lockfile maintenance) : à constater sur la première PR Renovate après B.8.
- Compatibilité Drizzle/postgres.js avec PG18 : pas de matrice publiée, preuve par `test:integration` (B.6).
- `pnpm audit` n'a pas pu servir de base de référence le 2026-09-22 : la commande a dépassé 120 s sans réponse du registre. Le résultat sera mesuré en B.7.
- Les versions citées sont celles du 2026-09-22. `pnpm update --latest` prend la dernière au moment de l'exécution, sous la contrainte `minimumReleaseAge: 1440`.

**Dépendances avec les autres PR**
- **PR A (prérequis)** : doit retirer `apps/mobile`, `@better-auth/expo` et `expo()` du serveur, `react-test-renderer` du catalog, les jobs CI mobiles, **et les checks requis `Expo deps check` et `Mobile bundle` du ruleset `Protect main`** (id 15514160, relevé le 2026-09-22), sans quoi aucune PR ne peut être mergée. Les étapes B.2, B.4, B.5 et B.7 contrôlent ce retrait par `grep`.
- **PR C (Small 4)** : dépend de B.3. `@ai-sdk/mistral@4.0.48` expose `promptCacheKey` et `reasoningEffort: 'none' | 'high'` dans `mistralLanguageModelChatOptions` (`dist/index.d.ts:7-18` du tarball 4.0.48), et `mistral-small-2603` figure dans `MistralChatModelId`. La 4.0.5 actuelle n'a pas `promptCacheKey`.
- **PR E (bibliothèques réinventées)** : après B.3, `@mistralai/mistralai@2.7.0` fournit `audio.speech` (`esm/funcs/audioSpeechComplete.js`), et `@ai-sdk/mistral@4.0.48` exporte `SpeechModelV4` et `TranscriptionModelV4`. Le `fetch` brut de `voxtral-tts.service.ts:59` et `voxtral-transcribe.service.ts:16` (commentaire « le SDK 2.2.1 expose seulement la transcription ») relève donc de la PR E. Les éventuels nouveaux signalements de knip 6.37 aussi.
- **Lot 3 (hébergement)** : l'hébergeur retenu devra proposer Postgres 18 + pgvector et Node 24. Point à revoir au même moment : Vercel ne documente le support de pnpm que jusqu'à la v10, et `apps/landing/vercel.json` fixe `"installCommand": "pnpm install"`, qui prend la plus vieille version de pnpm de l'image ([vercel.com/docs/package-managers](https://vercel.com/docs/package-managers)). Le déploiement de la landing avec pnpm 12 est donc non prouvé (rien n'est déployé aujourd'hui).
- Hors périmètre, signalés : Elysia 2 est en beta (1.4.x ne reçoit plus que des correctifs de sécurité) ; `@elysiajs/swagger` (1.3.1, dernière) a pour successeur `@elysiajs/openapi` 1.4.16 ; le modèle `claude-sonnet-4-6` de `claude-code.yml:34` n'a pas été réévalué (à vérifier dans la doc des modèles avant tout changement).
