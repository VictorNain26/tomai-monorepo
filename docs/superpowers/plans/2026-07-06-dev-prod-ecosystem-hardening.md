# Dev & Prod Ecosystem Hardening — Implementation Plan

> **STATUT : LIVRÉ** — 8/8 lots mergés (PR #272 à #279, 2026-07-06). Document
> conservé comme trace d'exécution ; ne pas exécuter.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Traiter tous les findings de l'audit 2026-07-06 : écosystème dev local prouvable (vrais providers, zéro mock), gates CI complets, observabilité Sentry, pipeline de déploiement fiable.

**Architecture:** 7 lots = 7 branches courtes → PR → merge main (merge commit). Chaque lot est livrable seul. Aucun mock : les preuves sont des appels réels (doctor = vrai roundtrip Mistral, smoke test = SHA déployé vérifié). Les stubs existants justifiés (Pronote UI mobile en E2E) restent.

**Tech Stack:** Bun/Elysia, Drizzle, Next.js 16, Expo SDK 56, Turborepo, GitHub Actions, lefthook, Sentry (`@sentry/elysia`, `@sentry/nextjs`, `@sentry/react-native`), pnpm 11.

## Global Constraints

- **Aucun mock/fake de provider** — les seuls stubs autorisés sont ceux qui existent déjà (Pronote UI mobile sous `EXPO_PUBLIC_E2E=1`).
- **Doc-first** : tout usage SDK/config tiers non trivial se valide contre la doc officielle ; le commit cite la source.
- **Zéro `eslint-disable`** comme correctif. Lint `--max-warnings 0`.
- **Validation avant commit** : server `bun run typecheck && bun run lint && bun run test` ; mobile `pnpm typecheck && pnpm lint && pnpm test` ; avant push server : `bun run test:integration`.
- **Stager fichier par fichier** (jamais `git add .`). Conventional commits anglais, scopes : `chat|server|landing|mobile|ci|db|auth|rag`.
- **Merge commit uniquement**, `gh pr merge` cassé → merger via `gh api PUT .../merge` (mémoire projet).
- **Piège connu** : `apps/server/src/tests/api-endpoints.test.ts` mocke `drizzle-orm` partiellement — tout nouveau module importé par la chaîne `app.ts`/`server-lifecycle.ts` tirant les schémas Drizzle doit y être mocké (pattern : mock de `retention-purge.service`).
- **pnpm 11** : les réglages pnpm vivent dans `pnpm-workspace.yaml`, PAS dans `.npmrc`.

## Findings d'audit vérifiés → lots

| Finding (vérifié) | Lot |
|---|---|
| CLAUDE.md racine : observabilité « en cours d'install » trompeur ; E2E Maestro vrai mais emplacement (`.eas/workflows/`) non documenté | 1 |
| `packages/chat-core` vide ; `.gitignore` sans `*.pem/*.key/*.p12` ; `.env.example` landing/ai-service vides ; mobile `.env.example` défaut staging contredit la résolution auto ; `setup.mjs` ne copie pas le `.env` racine ; ruff absent du pre-commit ; référence « demo-server » inexistant dans `pronote-e2e-stubs.ts` | 1 |
| `doctor:e2e` : check Mistral = présence de clé seulement (`scripts/doctor-checks.mjs:275`) | 2 |
| `e2e-local.mjs` : aucune vérification device/app/Metro avant `maestro test` | 2 |
| `/health` : `checks.ai` hardcodé `healthy` (`health.routes.ts:129-132`) ; Qdrant/ai-service jamais vérifiés en prod | 3 |
| Mobile jamais bundlé en CI ; CVE non surveillées (1 critical/11 high transitifs) ; image ai-service non buildée en PR ; ruleset sans `Migration Sync`/`Expo deps check` | 4 |
| Sentry absent partout (vars `SENTRY_DSN` déclarées, rien ne les consomme) | 5 |
| `smoke-test.yml` : course de timing — peut valider l'ancienne version déployée | 6 |
| Migrations au boot de chaque instance sans garde d'exclusivité validée | 7 |

**Findings réfutés pendant la vérification (ne PAS traiter)** : claim « E2E Maestro sur PR » (vrai — `apps/mobile/.eas/workflows/preview-android.yml`) ; fail-fast `AI_SERVICE_TOKEN` côté Bun (existe — `env.ts:153-155`) ; « E2E mobile local cassé par eas.json » (le flux local = dev-client + résolution auto d'URL via Metro hostUri) ; « main non protégée » (ruleset actif id 15514160).

**Hors scope (décisions posées)** : PostHog → chantier séparé (cadrage RGPD mineurs requis pour analytics/replay sur élèves) ; gate coverage → reste signal (règle no-silent-migration-gates) ; E2E web Playwright → non (apps/web supprimée au cutover lot 5 app universelle) ; tests landing → non (site statique, décision existante `testing-and-commits.md`).

---

## Lot 1 — Hygiène & vérité documentaire

Branche : `chore/audit-hygiene`. Aucun risque runtime — fichiers doc/config only.

### Task 1: Quick wins fichiers

**Files:**
- Modify: `.gitignore`, `CLAUDE.md`, `apps/mobile/.env.example`, `scripts/setup.mjs`, `apps/mobile/src/services/pronote/pronote-e2e-stubs.ts`
- Create: contenu dans `apps/landing/.env.example`, `apps/ai-service/.env.example`
- Delete: `packages/chat-core/` (dossier vide)

**Interfaces:** aucun code consommé/produit — hygiène pure.

- [ ] **Step 1: `.gitignore`** — ajouter après la ligne `.env` existante :

```gitignore
*.pem
*.key
*.p12
```

Vérifier qu'aucun fichier tracké ne matche : `git ls-files | grep -E '\.(pem|key|p12)$'` → vide attendu (sinon STOP et remonter).

- [ ] **Step 2: supprimer `packages/chat-core`** — `git ls-files packages/chat-core` doit être vide (dossier non tracké, 0 fichiers). Alors `rm -rf packages/chat-core`. Vérifier qu'aucune référence n'existe : `grep -rn "chat-core" --include="*.{json,ts,yaml}" . --exclude-dir=node_modules` → vide attendu.

- [ ] **Step 3: `CLAUDE.md` racine** — deux corrections de vérité :
  - Ligne observabilité du tableau Stack : remplacer `Sentry (crash/perf), PostHog (analytics + flags + session replay) — en cours d'install` par `OpenTelemetry (server, OTLP en prod) + logger structuré ; Sentry/PostHog non installés (chantier planifié)`.
  - Section « Review IA », ligne E2E : remplacer `E2E Maestro en preview Android sur PR (signal, pas gate)` par `E2E Maestro en preview Android sur PR via EAS Workflows (apps/mobile/.eas/workflows/preview-android.yml) — signal, pas gate`.

- [ ] **Step 4: `.env.example` vides** — lire `apps/ai-service/src/config.py` et lister chaque var lue (`API_TOKEN`, `ENVIRONMENT`, etc. — vérifier dans le code, ne pas inventer) ; écrire `apps/ai-service/.env.example` avec une ligne commentée par var (format du best-in-repo `apps/server/.env.example` : tags `[dev]`/`[externe]`). Idem `apps/landing/.env.example` : `grep -rn "process.env" apps/landing --include="*.ts*" | grep -v node_modules` et documenter chaque var trouvée (si aucune : écrire un commentaire `# Aucune variable requise — site statique`).

- [ ] **Step 5: `apps/mobile/.env.example`** — remplacer le défaut `EXPO_PUBLIC_API_URL=https://api-staging.tomia.fr` par :

```bash
# EXPO_PUBLIC_API_URL — NE PAS définir en dev local : l'app dérive l'URL du
# backend de l'IP Metro (hostUri) — device physique → IP LAN, émulateur → 10.0.2.2.
# Ne définir que pour forcer un backend distant (ex: staging).
# EXPO_PUBLIC_API_URL=
```

- [ ] **Step 6: `scripts/setup.mjs`** — ajouter la racine à la liste des copies `.env.example → .env` (le compose racine lit `AI_SERVICE_TOKEN`/`HF_TOKEN` du shell ou d'un `.env` racine). Suivre le pattern existant lignes 17-23 en ajoutant `'.'` à la liste des dossiers copiés.

- [ ] **Step 7: `pronote-e2e-stubs.ts`** — corriger le commentaire référençant un « demo-server » inexistant : le remplacer par la référence au vrai chemin de preuve (test live serveur `apps/server/src/live/pronote.test.ts`, compte réel `PRONOTE_TEST_*`).

- [ ] **Step 8: valider + commit** — `pnpm typecheck && pnpm lint` (racine). Commit par thème :

```bash
git add .gitignore && git commit -m "chore: ignore private key files (*.pem, *.key, *.p12)"
git add CLAUDE.md && git commit -m "docs: fix observability and E2E claims to match reality"
git add apps/landing/.env.example apps/ai-service/.env.example apps/mobile/.env.example scripts/setup.mjs && git commit -m "chore: complete .env.example files and root env copy in setup"
git add apps/mobile/src/services/pronote/pronote-e2e-stubs.ts && git commit -m "docs(mobile): fix stale demo-server reference in pronote e2e stubs"
```

### Task 2: ruff en pre-commit

**Files:**
- Modify: `lefthook.yml`

**Interfaces:** consomme `uv` (déjà requis par apps/curriculum, hors workspace pnpm).

- [ ] **Step 1: consulter la doc lefthook** (https://lefthook.dev/configuration/) pour la syntaxe `glob` + `root` sur jobs parallèles — citer le champ vérifié dans le commit.

- [ ] **Step 2: ajouter les jobs** dans `pre-commit.jobs` (pattern des jobs lint existants) :

```yaml
    - name: lint-ai-service
      root: "apps/ai-service/"
      glob: "**/*.py"
      run: uv run ruff check {staged_files} && uv run ruff format --check {staged_files}

    - name: lint-curriculum
      root: "apps/curriculum/"
      glob: "**/*.py"
      run: uv run ruff check {staged_files} && uv run ruff format --check {staged_files}
```

- [ ] **Step 3: prouver le hook** — introduire volontairement un fichier Python mal formaté dans `apps/ai-service/`, `git add` ce fichier, tenter `git commit` → doit échouer ; retirer le fichier ; committer le lefthook.yml :

```bash
git add lefthook.yml && git commit -m "ci: add ruff check to pre-commit for python apps (validated against lefthook.dev/configuration)"
```

- [ ] **Step 4: PR + merge** — `gh pr create` puis merge via `gh api PUT .../merge` (merge commit).

---

## Lot 2 — Doctor : preuves réelles, pas de présence de clé

Branche : `feat/doctor-real-proofs`.

### Task 3: check Mistral réel dans doctor:e2e

**Files:**
- Modify: `scripts/doctor-checks.mjs` (fonction `checkMistralKey`, ligne ~275, et son commentaire)

**Interfaces:**
- Consomme : `ctx.config.mistralKey`, `ctx.fetchFn` (déjà dans le contexte doctor).
- Produit : le check renommé `mistral chat réel (ministral-3b, 1 token)`.

- [ ] **Step 1: doc-first** — vérifier sur https://docs.mistral.ai/api/ le endpoint chat completions (`POST https://api.mistral.ai/v1/chat/completions`, body `{model, messages, max_tokens}`) et le nom exact du modèle le moins cher (`ministral-3b-latest`). Citer l'URL dans le commit.

- [ ] **Step 2: remplacer `checkMistralKey`** par un appel réel :

```javascript
// Preuve réelle du chemin LLM : un chat completion 1 token sur le modèle le
// moins cher. Coût par run ≈ négligeable ; échoue sur clé invalide, quota
// épuisé ou panne API — ce qu'une simple présence de clé ne prouve pas.
function checkMistralReal(ctx) {
  return { name: 'mistral chat réel (ministral-3b, 1 token)', run: async () => {
    if (!ctx.config.mistralKey) {
      throw new Error('MISTRAL_API_KEY absente — définis-la dans apps/server/.env ou ton shell');
    }
    const res = await ctx.fetchFn('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${ctx.config.mistralKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'ministral-3b-latest',
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 1,
      }),
    });
    if (!res.ok) throw new Error(`mistral chat -> HTTP ${res.status} (clé invalide, quota ou panne API)`);
    const body = await res.json();
    if (!body?.choices?.length) throw new Error('mistral chat: réponse sans choices');
  }};
}
```

Mettre à jour l'appel dans `buildChecks` (même position que `checkMistralKey`).

- [ ] **Step 3: prouver les deux chemins** — (a) `pnpm doctor:e2e` avec la vraie clé → PASS ; (b) `MISTRAL_API_KEY=sk-invalid pnpm doctor:e2e` → FAIL sur ce check avec HTTP 401. Coller les deux sorties dans la PR.

- [ ] **Step 4: commit**

```bash
git add scripts/doctor-checks.mjs && git commit -m "feat(ci): doctor proves mistral with a real 1-token completion (validated against docs.mistral.ai/api)"
```

### Task 4: garde-fous explicites dans e2e-local.mjs

**Files:**
- Modify: `scripts/e2e-local.mjs` (insérer un stage 0 avant le doctor)

**Interfaces:**
- Consomme : `run()` existant ; `adb`, `curl` sur le PATH.
- Produit : stage `0/4 — préconditions device` ; les stages existants renumérotés 1→4.

- [ ] **Step 1: insérer le stage préconditions** après les imports (le package Android : lire `apps/mobile/app.config.ts` pour extraire la vraie valeur de `android.package` — ne pas deviner) :

```javascript
// Stage 0/4 — préconditions explicites (pas de silent assumption) :
// un device/émulateur connecté, l'app dev-client installée, Metro joignable.
import { execSync } from 'node:child_process';

const ANDROID_PACKAGE = 'REMPLACER_PAR_android.package_DE_app.config.ts';

function precondition(name, fn) {
  try { fn(); console.log(`[e2e:local] OK — ${name}`); }
  catch (e) {
    console.error(`[e2e:local] ABORT — ${name}: ${e.message}`);
    process.exit(1);
  }
}

precondition('device/émulateur adb connecté', () => {
  const out = execSync('adb devices').toString();
  if (!/^\S+\tdevice$/m.test(out)) throw new Error('aucun device en état "device" — lance l\'émulateur ou branche un téléphone (adb devices)');
});

precondition(`app dev-client installée (${ANDROID_PACKAGE})`, () => {
  const out = execSync(`adb shell pm list packages ${ANDROID_PACKAGE}`).toString();
  if (!out.includes(ANDROID_PACKAGE)) throw new Error(`app absente — build/installe le dev client : cd apps/mobile && pnpm build:dev`);
});

precondition('Metro joignable sur :8081', () => {
  execSync('curl -sf -o /dev/null http://localhost:8081/status');
});
```

- [ ] **Step 2: renuméroter les logs** des stages existants (`1/3`→`1/4`, etc.).

- [ ] **Step 3: prouver les deux chemins** — sans émulateur lancé : `pnpm e2e:local` → ABORT stage 0 avec message actionnable. Avec la stack complète (mémoire `emulateur-android-headless-agent` pour les pièges WSL2) : le run passe le stage 0.

- [ ] **Step 4: commit + PR + merge**

```bash
git add scripts/e2e-local.mjs && git commit -m "feat(ci): e2e-local fails fast with actionable messages when device/app/metro missing"
```

---

## Lot 3 — /health prod : dépendances réellement vérifiées

Branche : `feat/health-real-checks`. TDD.

**Position (défendue)** : DB down → `unhealthy` (503, Docker restart). ai-service ou Qdrant down → `degraded` (200 — pas de restart-loop sur panne externe, mais visible : le smoke test du lot 6 assertera `status == "healthy"` strict). `checks.ai` hardcodé supprimé (aucun ping Mistral par probe : un healthcheck toutes les 30 s ne doit pas consommer l'API billable — la preuve Mistral vit dans le doctor, lot 2).

### Task 5: checks ai-service + Qdrant réels dans /health

**Files:**
- Modify: `apps/server/src/routes/api/health.routes.ts` (bloc `checks.ai`, lignes 129-132)
- Test: `apps/server/src/tests/health-routes.test.ts` (créer ou étendre s'il existe — vérifier avec `ls apps/server/src/tests/ | grep health`)

**Interfaces:**
- Consomme : `env.AI_SERVICE_URL`, `env.QDRANT_URL`, `env.QDRANT_ENABLED`, `env.AI_SERVICE_TOKEN`, `env.QDRANT_API_KEY` (tous déjà dans `env.ts`).
- Produit : body `/health` avec `checks.aiService` et `checks.qdrant` (`{ status, latency? , error? }`), `checks.ai` supprimé ; `status` global = `degraded` si l'un d'eux échoue, `unhealthy` seulement si DB down.

- [ ] **Step 1: écrire les tests qui échouent** — cas : (a) ai-service configuré et joignable → `checks.aiService.status === 'healthy'` ; (b) ai-service configuré injoignable → `degraded` global, HTTP 200 ; (c) non configuré → `checks.aiService.status === 'not_configured'`, n'affecte pas le statut global ; (d) DB down → 503 (cas existant). Mocker les fetch sortants avec le pattern des tests server existants (regarder `apps/server/src/tests/` pour le pattern de mock fetch en vigueur — le suivre, pas en inventer un).

- [ ] **Step 2: `bun test src/tests/health-routes.test.ts`** → FAIL attendu (checks inexistants).

- [ ] **Step 3: implémenter** — dans le handler `/health`, remplacer le bloc `checks.ai` :

```typescript
if (env.AI_SERVICE_URL) {
  try {
    const start = Date.now();
    const res = await fetch(`${env.AI_SERVICE_URL}/health`, {
      signal: AbortSignal.timeout(2000),
      headers: env.AI_SERVICE_TOKEN ? { Authorization: `Bearer ${env.AI_SERVICE_TOKEN}` } : {},
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    checks.aiService = { status: 'healthy', latency: Date.now() - start };
  } catch (error) {
    checks.aiService = { status: 'unhealthy', error: error instanceof Error ? error.message : 'unreachable' };
    if (overallStatus === 'healthy') overallStatus = 'degraded';
  }
} else {
  checks.aiService = { status: 'not_configured' };
}

if (env.QDRANT_ENABLED === 'true' && env.QDRANT_URL) {
  try {
    const start = Date.now();
    const res = await fetch(`${env.QDRANT_URL}/healthz`, {
      signal: AbortSignal.timeout(2000),
      headers: env.QDRANT_API_KEY ? { 'api-key': env.QDRANT_API_KEY } : {},
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    checks.qdrant = { status: 'healthy', latency: Date.now() - start };
  } catch (error) {
    checks.qdrant = { status: 'unhealthy', error: error instanceof Error ? error.message : 'unreachable' };
    if (overallStatus === 'healthy') overallStatus = 'degraded';
  }
} else {
  checks.qdrant = { status: 'not_configured' };
}
```

Vérifier doc-first le path healthcheck Qdrant (`/healthz`) et son header d'auth (`api-key`) sur https://qdrant.tech/documentation/ — citer dans le commit. Les deux checks tournent en parallèle avec le check DB si le pattern du fichier le permet (sinon séquentiel, timeouts 2 s bornent le pire cas).

- [ ] **Step 4: tests verts** — `cd apps/server && bun run test` → PASS. Vérifier aussi le piège `api-endpoints.test.ts` (mock drizzle partiel) si de nouveaux imports apparaissent.

- [ ] **Step 5: preuve manuelle locale** — stack `pnpm dev` lancée : `curl -s localhost:3000/health | jq .checks` montre `aiService`/`qdrant` healthy avec latences réelles ; stopper le conteneur ai-service → `status: "degraded"`, HTTP 200.

- [ ] **Step 6: valider + commit + PR + merge**

```bash
cd apps/server && bun run typecheck && bun run lint && bun run test && bun run test:integration
git add apps/server/src/routes/api/health.routes.ts apps/server/src/tests/health-routes.test.ts
git commit -m "feat(server): /health verifies ai-service and qdrant for real (degraded, not 503; validated against qdrant.tech docs)"
```

---

## Lot 4 — CI durcie

Branche : `ci/harden-gates`.

### Task 6: bundle mobile en CI

**Files:**
- Modify: `.github/workflows/ci.yml` (nouveau job après `expo-deps`), `apps/mobile/package.json` (script)

**Interfaces:** produit le job `mobile-bundle` (nom affiché : `Mobile bundle`).

- [ ] **Step 1: doc-first** — vérifier `npx expo export --platform android` sur https://docs.expo.dev/more/expo-cli/#exporting (fonctionne sans credentials, produit `dist/`). Citer dans le commit.

- [ ] **Step 2: script** dans `apps/mobile/package.json` : `"bundle:check": "expo export --platform android --output-dir /tmp/expo-export-ci"`.

- [ ] **Step 3: job CI** (pattern des jobs existants — checkout SHA-pinné identique + setup-monorepo) :

```yaml
  # Compile le bundle Metro : attrape les erreurs de bundling avant EAS.
  mobile-bundle:
    name: Mobile bundle
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5 # v4.3.1
        with:
          fetch-depth: 0
      - uses: ./.github/actions/setup-monorepo
        with:
          turbo-cache-key: mobile-bundle
      - name: Check mobile changed
        id: changed
        run: |
          if [ -n "$GITHUB_BASE_REF" ]; then
            DIFF=$(git diff --name-only "origin/$GITHUB_BASE_REF"...HEAD -- 'apps/mobile/' 'packages/')
          else
            DIFF="forced-on-main"
          fi
          [ -n "$DIFF" ] && echo "changed=true" >> "$GITHUB_OUTPUT" || echo "changed=false" >> "$GITHUB_OUTPUT"
      - name: Export bundle
        if: steps.changed.outputs.changed == 'true'
        working-directory: apps/mobile
        run: pnpm bundle:check
```

- [ ] **Step 4: prouver** — pousser la branche, ouvrir la PR, vérifier le job vert dans `gh pr checks`. Commit : `ci(mobile): gate metro bundle export on PRs touching mobile`.

### Task 7: audit CVE bloquant avec ignores explicites

**Files:**
- Modify: `.github/workflows/security.yml` (nouveau job), `pnpm-workspace.yaml` (auditConfig)

- [ ] **Step 1: doc-first** — vérifier sur https://pnpm.io/settings (pnpm 11) le champ `auditConfig.ignoreCves` et sa place dans `pnpm-workspace.yaml`. Citer URL+champ dans le commit.

- [ ] **Step 2: lister les CVE actuelles** — `pnpm audit --prod --audit-level high --json` ; pour chaque CVE transitive non corrigeable (ex. `shell-quote` via `react-devtools-core`, chaîne dev-tooling), l'ajouter à `auditConfig.ignoreCves` avec un commentaire YAML : CVE, chaîne de dépendance, raison (« dev-tooling, non exposé au runtime prod »), date de revue. **Aucun ignore sans justification écrite.** Les CVE corrigeables par bump patch/minor → les corriger dans ce lot (pas d'ignore).

- [ ] **Step 3: job dans security.yml** (suivre le style SHA-pinné du fichier) :

```yaml
  dependency-audit:
    name: Dependency audit (prod, high+)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5 # v4.3.1
      - uses: ./.github/actions/setup-monorepo
        with:
          turbo-cache-key: audit
      - name: pnpm audit
        run: pnpm audit --prod --audit-level high
```

- [ ] **Step 4: prouver** — job vert sur la PR (les ignores couvrent le reliquat justifié). Commit : `ci: gate high+ prod CVEs with documented ignores (validated against pnpm.io/settings)`.

### Task 8: build image ai-service en PR

**Files:**
- Modify: `.github/workflows/docker.yml`

- [ ] **Step 1:** répliquer le job de build server existant pour `apps/ai-service/Dockerfile` (build seul, pas de push), déclenché sur `paths: apps/ai-service/**`. Reprendre les mêmes actions SHA-pinnées que le job server.
- [ ] **Step 2:** prouver via un run PR ; commit : `ci: build ai-service image on PR (catch broken Dockerfile before main)`.

### Task 9: required checks complétés dans le ruleset

**Files:** aucun — configuration GitHub (ruleset id 15514160).

- [ ] **Step 1: annoncer au user avant d'agir** (action externe sur le repo). Puis :

```bash
gh api -X PUT repos/VictorNain26/tomai-monorepo/rulesets/15514160 --input - <<'EOF'
{ "name": "Protect main", "target": "branch", "enforcement": "active",
  "conditions": { "ref_name": { "include": ["~DEFAULT_BRANCH"], "exclude": [] } },
  "rules": [
    { "type": "deletion" }, { "type": "non_fast_forward" },
    { "type": "required_status_checks", "parameters": {
      "strict_required_status_checks_policy": false,
      "required_status_checks": [
        {"context": "typecheck"}, {"context": "lint"}, {"context": "Test"},
        {"context": "Build"}, {"context": "Migration Sync"}, {"context": "Expo deps check"},
        {"context": "Mobile bundle"}, {"context": "Dependency audit (prod, high+)"}
      ] } }
  ] }
EOF
```

**Attention** : `Migration Sync`, `Expo deps check`, `Mobile bundle` et `Dependency audit` doivent reporter sur **chaque** PR pour ne pas bloquer les merges (cf. commentaire `ci.yml:14-16`) — c'est le cas : ils tournent sans `paths:` filter au niveau workflow (le skip conditionnel interne reporte quand même un statut success). Vérifier ce point pour chaque check ajouté avant le PUT ; sinon retirer le check concerné de la liste.

- [ ] **Step 2: prouver** — `gh api repos/VictorNain26/tomai-monorepo/rulesets/15514160 --jq '.rules'` montre les 8 contexts. PR + merge du lot.

---

## Lot 5 — Sentry (server + web + landing + mobile)

Branche : `feat/sentry-observability`.

**Préalable USER (je ne peux pas le faire — compte tiers)** : créer l'organisation Sentry en **région EU** (data residency, cohérent stack 100 % EU) sur https://sentry.io, 4 projets (`tomai-server`, `tomai-web`, `tomai-landing`, `tomai-mobile`), récupérer les 4 DSN + un `SENTRY_AUTH_TOKEN` (scope `project:releases` pour les sourcemaps). Les poser : DSN server → env Koyeb ; DSN web/landing → env Vercel ; DSN mobile + auth token → secrets EAS ; auth token → secret GitHub si besoin CI.

### Task 10: Sentry server (@sentry/elysia)

**Files:**
- Modify: `apps/server/package.json`, `apps/server/src/index.ts`, `apps/server/src/app.ts`
- Test: `apps/server/src/tests/api-endpoints.test.ts` (mock éventuel si la chaîne d'import l'exige)

**Interfaces:**
- Consomme : `env.SENTRY_DSN` (déjà dans `env.ts:122`).
- Produit : `Sentry.init` conditionnel au DSN ; app wrappée `Sentry.withElysia`.

- [ ] **Step 1: doc-first** — lire https://docs.sentry.io/platforms/javascript/guides/bun/ et le README `@sentry/elysia` ; confirmer : init au plus tôt (avant imports applicatifs, comme `setupOtel()`), `withElysia(new Elysia())`, coexistence OTel (option `skipOpenTelemetrySetup` — vérifier le nom exact du champ dans la doc). Citer dans le commit.
- [ ] **Step 2:** `cd apps/server && bun add @sentry/elysia`.
- [ ] **Step 3:** init dans `src/index.ts` juste après `setupOtel()` (conditionnel : ne rien faire sans `SENTRY_DSN`) ; wrap dans `src/app.ts` : `const app = env.SENTRY_DSN ? Sentry.withElysia(new Elysia()) : new Elysia()` — adapter à la forme réelle de construction de l'app dans le fichier. Brancher `Sentry.captureException` dans les handlers `uncaughtException`/`unhandledRejection` existants (`index.ts:105-122`) avant l'exit, avec `await Sentry.flush(2000)`.
- [ ] **Step 4:** valider (typecheck/lint/test/test:integration — mocker `@sentry/elysia` dans `api-endpoints.test.ts` si la chaîne d'import casse, pattern `retention-purge.service`).
- [ ] **Step 5:** preuve locale — `SENTRY_DSN=<dsn-test> bun run dev`, déclencher une route qui throw, vérifier l'event dans Sentry. Commit : `feat(server): sentry error capture via @sentry/elysia (validated against docs.sentry.io bun guide)`.

### Task 11: Sentry landing (@sentry/nextjs)

> **Amendement 2026-07-06 (décision Victor)** : `apps/web` est condamnée (ADR 0001, suppression au Lot 8 de ce chantier) — AUCUN investissement Sentry dedans. Cette task couvre `apps/landing` uniquement.

**Files:**
- Create: `apps/landing/instrumentation.ts`, `apps/landing/instrumentation-client.ts`, `apps/landing/sentry.server.config.ts`, `apps/landing/sentry.edge.config.ts`
- Modify: `apps/landing/next.config.*`, `apps/landing/package.json`, `apps/landing/.env.example`

- [ ] **Step 1: doc-first** — https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/ pour Next 16 App Router : noms exacts des fichiers d'instrumentation, `withSentryConfig`, variables `NEXT_PUBLIC_SENTRY_DSN`. **Ne pas utiliser le wizard interactif** (non scriptable) — setup manuel d'après la doc. Citer chaque fichier créé ↔ section de doc.
- [ ] **Step 2:** installer `@sentry/nextjs` dans les 2 apps ; créer les fichiers d'instrumentation (init conditionnel au DSN — build et dev doivent fonctionner sans) ; wrapper `withSentryConfig` dans les 2 `next.config`.
- [ ] **Step 3:** `pnpm turbo run build --filter=web --filter=landing` → vert sans DSN. Preuve avec DSN : page de test qui throw → event visible.
- [ ] **Step 4:** documenter `NEXT_PUBLIC_SENTRY_DSN` dans les `.env.example`. Commit : `feat(web,landing): sentry via @sentry/nextjs manual setup (validated against docs.sentry.io nextjs manual-setup)`.

### Task 12: Sentry mobile (@sentry/react-native)

**Files:**
- Modify: `apps/mobile/package.json`, `apps/mobile/app.config.ts`, layout racine Expo Router (`apps/mobile/src/app/_layout.tsx` — vérifier le chemin réel), `apps/mobile/.env.example`, `apps/mobile/CLAUDE.md` (section « Observabilité (à installer) » → état réel)

- [ ] **Step 1: doc-first** — https://docs.sentry.io/platforms/react-native/manual-setup/expo/ : plugin `@sentry/react-native/expo` dans `app.config.ts` (org, project, `useNativeInit`), `Sentry.init` dans le layout racine, `Sentry.wrap` du composant racine, sourcemaps auto sur build EAS via le plugin + `SENTRY_AUTH_TOKEN` en secret EAS. Vérifier la compatibilité SDK Expo 56 dans la matrice de versions de la doc. Citer dans le commit.
- [ ] **Step 2:** `npx expo install @sentry/react-native` (depuis apps/mobile — expo install aligne la version native).
- [ ] **Step 3:** plugin + init conditionnel (`EXPO_PUBLIC_SENTRY_DSN`) + wrap. **Dep native → rebuild dev client requis** : `pnpm build:dev` (règle CLAUDE.md mobile).
- [ ] **Step 4:** valider `pnpm typecheck && pnpm lint && pnpm test` ; preuve device : throw de test → event Sentry avec stack symbolisée.
- [ ] **Step 5:** mettre à jour `apps/mobile/CLAUDE.md` (Sentry installé, PostHog reste « à installer, chantier séparé ») et le `CLAUDE.md` racine (ligne observabilité : Sentry actif sur server/web/landing/mobile). Commit : `feat(mobile): sentry rn sdk with expo plugin and eas sourcemaps (validated against docs.sentry.io expo manual-setup)`.
- [ ] **Step 6:** PR + merge du lot.

---

## Lot 6 — Smoke test post-deploy fiable (SHA vérifié)

Branche : `ci/smoke-test-sha`.

### Task 13: exposer le commit déployé dans /health

**Files:**
- Modify: `apps/server/src/config/env.ts` (schéma : `GIT_COMMIT_SHA: z.string().default('unknown')`), `apps/server/src/routes/api/health.routes.ts` (body : `commit: env.GIT_COMMIT_SHA`)
- Test: étendre `apps/server/src/tests/health-routes.test.ts` (assert `commit` présent)

- [ ] **Step 1:** TDD — test rouge sur `body.commit`, puis implémentation (le Dockerfile pose déjà `ENV GIT_COMMIT_SHA` depuis le build arg, `Dockerfile:45-47`).
- [ ] **Step 2: vérifier la chaîne Koyeb** — confirmer que le build Koyeb passe `GIT_COMMIT_SHA` en build arg (config Koyeb, hors repo). Si ce n'est pas le cas : le dire explicitement au user avec la procédure manuelle (réglage du service Koyeb), et le smoke test doit **échouer** (pas de skip) si `commit == "unknown"` en prod.
- [ ] **Step 3:** valider + commit : `feat(server): expose deployed commit sha in /health`.

### Task 14: smoke test qui attend LE bon déploiement

**Files:**
- Modify: `.github/workflows/smoke-test.yml`

- [ ] **Step 1:** remplacer la boucle du job backend : poll `https://api.tomia.fr/health` toutes les 30 s, **jusqu'à 20 min**, succès seulement si `.commit == "$GITHUB_SHA"` **et** `.status == "healthy"` (strict : attrape les pannes RAG grâce au lot 3) :

```yaml
      - name: Wait for THIS commit to be live and healthy
        run: |
          for i in $(seq 1 40); do
            sleep 30
            body=$(curl -sS https://api.tomia.fr/health || true)
            commit=$(echo "$body" | jq -r '.commit // "unreachable"')
            status=$(echo "$body" | jq -r '.status // "unreachable"')
            echo "attempt $i/40: commit=$commit status=$status (want ${GITHUB_SHA} healthy)"
            if [ "$commit" = "${GITHUB_SHA}" ] && [ "$status" = "healthy" ]; then
              echo "✅ deployed commit is live and fully healthy"; exit 0
            fi
            if [ "$commit" = "${GITHUB_SHA}" ] && [ "$status" != "healthy" ]; then
              echo "::error::new version live but $status"; echo "$body" | jq .; exit 1
            fi
          done
          echo "::error::commit ${GITHUB_SHA} never became live+healthy in 20min"; exit 1
```

`timeout-minutes: 25` sur le job. Garder le check ai-service existant tel quel.

- [ ] **Step 2:** prouver sur le merge réel du lot (le workflow tourne sur push main) — vérifier le run vert avec le bon SHA dans les logs. Commit : `ci: smoke test gates on the deployed commit sha, strict healthy status`.

---

## Lot 7 — Migrations : exclusivité multi-instance prouvée

Branche : `fix/migrate-advisory-lock`.

### Task 15: garde d'exclusivité sur la migration au boot

**Files:**
- Modify: `apps/server/src/scripts/migrate.ts` (localiser : `grep -rn "migrate" apps/server/package.json` pour le vrai chemin du script buildé en `dist/migrate.js`)
- Test: `apps/server/src/tests/migrate-lock.test.ts`

- [ ] **Step 1: doc-first** — vérifier dans la doc/source drizzle-orm (https://orm.drizzle.team/docs/migrations et le code `node_modules/drizzle-orm/postgres-js/migrator.d.ts` de la version installée) si `migrate()` pose déjà un verrou de session. **Si le verrou existe et est documenté** : pas de code — écrire la preuve (citation source) dans `.claude/rules/database-migrations.md` et clore la task. **Sinon** : Step 2.
- [ ] **Step 2 (si nécessaire): advisory lock explicite** autour de l'appel `migrate()` :

```typescript
// Plusieurs instances Koyeb peuvent booter en parallèle : une seule doit
// migrer, les autres attendent qu'elle ait fini puis constatent le no-op.
await db.execute(sql`SELECT pg_advisory_lock(hashtext('drizzle_migrate'))`);
try {
  await migrate(db, { migrationsFolder: './drizzle' });
} finally {
  await db.execute(sql`SELECT pg_advisory_unlock(hashtext('drizzle_migrate'))`);
}
```

- [ ] **Step 3: test** — deux appels `migrate` concurrents sur la même DB de test aboutissent sans erreur ni double application (compter les lignes de `drizzle.__drizzle_migrations`).
- [ ] **Step 4:** valider server complet + commit : `fix(db): serialize boot migrations across instances with advisory lock` (ou `docs(db): prove drizzle migrate lock` si Step 1 suffit). PR + merge.

---

## Lot 8 — Suppression d'apps/web (amendement, décision Victor 2026-07-06)

Branche : `chore/remove-apps-web`. Rationale : ADR 0001 (app universelle) a arrêté le chantier web ; zéro user en prod ; garder l'app crée des conflits d'architecture et pollue les sessions IA. Vérifié : `@repo/ui` survit (consommé par landing), `@repo/api` survit (consommé par mobile).

### Task 16: purge complète d'apps/web

**Files:**
- Delete: `apps/web/` (git rm -r)
- Modify: `package.json` racine (script `dev:web`, mention dans `dev`), `scripts/dev.mjs` (retirer web:3002 du lancement et du fail-fast), `docker-compose.yml` (CORS_ORIGINS sans :3002 + commentaires), `CLAUDE.md` racine (ligne Web du tableau Stack, commandes, ligne Deploy Vercel), `turbo.json` si filtre web nommé, `.github/workflows/*` si référence web explicite, `apps/server/.env.example` + `apps/server/src/config/env.ts` si défaut CORS liste :3002 (vérifier), `lefthook.yml` (job lint-web)

**Interfaces:** aucun consommateur restant à préserver (vérifié : grep `@repo/api` = mobile only hors web ; `@repo/ui` = landing).

- [ ] **Step 1: inventaire exhaustif** — `grep -rn "apps/web\|dev:web\|:3002\|--filter=web" --include="*.{json,yml,yaml,mjs,ts,md}" . --exclude-dir=node_modules --exclude-dir=apps/web` ; chaque hit est traité (supprimé/réécrit) ou justifié dans le rapport.
- [ ] **Step 2: `git rm -r apps/web`** + purge des références de l'inventaire.
- [ ] **Step 3: validation monorepo entière** — `pnpm install` (lockfile régénéré), `pnpm turbo typecheck lint test build` → tout vert.
- [ ] **Step 4: preuve dev local** — `pnpm dev` démarre (landing:3001 + server:3000, plus de :3002), `pnpm doctor` PASS.
- [ ] **Step 5: commit + PR** — `chore: remove apps/web (ADR 0001 universal app; web chapter closed)`. ACTION USER post-merge : débrancher le projet Vercel tomai-web.

## Ordre d'exécution et dépendances

1 → 2 → 3 → 4 → 6 (le lot 6 dépend du lot 3 pour `status == healthy` strict et de la task 13) ; 5 et 7 indépendants (parallélisables après le lot 1). PostHog : chantier séparé à cadrer ensuite.

## Self-review (fait)

- Chaque finding vérifié de l'audit mappe à une task ; les findings réfutés sont listés pour ne pas être retraités.
- Aucun placeholder « TBD » ; les deux points nécessitant une lecture au moment de l'exécution (`android.package`, chemin réel `migrate.ts`, pattern mock fetch des tests server) sont des instructions de lecture explicites avec commande.
- Types/contrats inter-tasks cohérents : `checks.aiService`/`checks.qdrant`/`commit` produits en lot 3/task 13 et consommés en lot 6.
