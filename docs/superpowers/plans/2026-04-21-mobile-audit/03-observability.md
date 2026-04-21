# SP3 — Observabilité — Plan

**Spec parent** : `docs/superpowers/specs/2026-04-21-mobile-audit/README.md`
**Date** : 2026-04-21

## Goal

Installer une stack d'observabilité production-ready sur le mobile : Sentry (crash + perf + breadcrumbs), PostHog (analytics + feature flags + session replay), intégration Maestro en CI preview, baseline Jest coverage.

## Tech Stack

- `@sentry/react-native` v8.x (intégration native Expo via plugin + source maps EAS auto)
- `posthog-react-native` v3.2+ (dev build requis, iOS 13+ / Android 26+)
- Maestro CLI dans `.eas/workflows/preview-android.yml`
- `jest --coverage` avec seuils configurés dans `jest.config.js`

## Livrables

1. Sentry installé et instrumenté (capture auto crashs + ErrorBoundary + navigation tracking)
2. PostHog installé + autocapture + 1 event custom par écran majeur
3. Maestro job ajouté au workflow preview (voir plan `2026-03-20-maestro-e2e.md` Task 4)
4. Jest coverage seuil 50% global
5. Secrets EAS documentés (`SENTRY_DSN`, `POSTHOG_API_KEY`, `POSTHOG_HOST`)

---

## Task 1 — Sentry RN v8

### Files

- Create: `apps/mobile/src/lib/sentry.ts`
- Modify: `apps/mobile/package.json` (add `@sentry/react-native`)
- Modify: `apps/mobile/app.config.ts` (add Sentry plugin)
- Modify: `apps/mobile/src/app/_layout.tsx` (Sentry.init + ErrorBoundary)
- Create: `apps/mobile/eas-hooks/post-publish.sh` (source maps upload)
- Modify: `apps/mobile/eas.json` (`Sentry.wrap()` post-publish hook)

### Steps

- [ ] **Step 1 — Install dep** (native, requires rebuild)
  ```bash
  cd apps/mobile && pnpm add @sentry/react-native
  ```

- [ ] **Step 2 — Plugin in `app.config.ts`**
  ```ts
  plugins: [
    // ... existing plugins
    [
      '@sentry/react-native/expo',
      {
        organization: 'tomia',
        project: 'tom-mobile',
        url: 'https://sentry.io/',
      },
    ],
  ],
  ```

- [ ] **Step 3 — Create `src/lib/sentry.ts`** wrapper with init guards (skip in dev unless `EXPO_PUBLIC_SENTRY_DEBUG=true`)

- [ ] **Step 4 — Wire `_layout.tsx`**: `Sentry.init({ dsn: Constants.expoConfig.extra.sentryDsn, tracesSampleRate: 0.2, replaysSessionSampleRate: 0, replaysOnErrorSampleRate: 1.0 })` + wrap `export default Sentry.wrap(RootLayout)`.

- [ ] **Step 5 — Navigation tracking** : `Sentry.reactNavigationIntegration()` — adapter pour Expo Router : intégration `expo-router` via `useNavigationContainerRef`

- [ ] **Step 6 — Source maps EAS** : `@sentry/react-native/expo` plugin gère l'upload automatique pendant EAS build. Vérifier que le token `SENTRY_AUTH_TOKEN` est configuré comme secret EAS.

- [ ] **Step 7 — Env & secrets**
  ```
  EXPO_PUBLIC_SENTRY_DSN=https://...@sentry.io/...
  SENTRY_AUTH_TOKEN=sntrys_...  # secret EAS uniquement
  ```

- [ ] **Step 8 — Validation**
  ```bash
  cd apps/mobile && pnpm build:dev && pnpm typecheck && pnpm lint && pnpm test
  ```
  Puis crash volontaire dans dev pour vérifier que l'event apparaît dans Sentry.

- [ ] **Step 9 — Commit**
  ```
  feat(mobile): integrate Sentry RN v8 for crash + perf monitoring
  ```

---

## Task 2 — PostHog RN

### Files

- Create: `apps/mobile/src/lib/posthog.ts`
- Modify: `apps/mobile/package.json` (add `posthog-react-native` + peers)
- Modify: `apps/mobile/src/app/_layout.tsx` (PostHogProvider wrapper)
- Modify: `apps/mobile/src/hooks/useAnalytics.ts` (new — typed event helpers)

### Steps

- [ ] **Step 1 — Install**
  ```bash
  cd apps/mobile && pnpm add posthog-react-native
  # Peers : expo-application, expo-device, expo-file-system (déjà présents)
  ```

- [ ] **Step 2 — Wrapper `src/lib/posthog.ts`** qui instancie `PostHog` avec :
  - `apiKey` : `Constants.expoConfig.extra.posthogApiKey`
  - `host` : `Constants.expoConfig.extra.posthogHost` (défaut EU `https://eu.posthog.com`)
  - `captureAppLifecycleEvents: true`
  - `sessionReplay: true`  (nécessite SDK 3.3+)
  - `disabled` : `__DEV__` (opt-in via env)

- [ ] **Step 3 — `_layout.tsx`** : wrap avec `<PostHogProvider>` à l'intérieur de ThemeProvider

- [ ] **Step 4 — User identification** : dans `RevenueCatProvider` ou un nouvel effect :
  ```ts
  useEffect(() => {
    if (session?.user?.id) posthog.identify(session.user.id, { role: user.role });
    else posthog.reset();
  }, [session?.user?.id]);
  ```

- [ ] **Step 5 — Feature flags helper** : `useFeatureFlag(key)` hook qui wrap `posthog.useFeatureFlag`.

- [ ] **Step 6 — Env**
  ```
  EXPO_PUBLIC_POSTHOG_API_KEY=phc_...
  EXPO_PUBLIC_POSTHOG_HOST=https://eu.posthog.com
  ```

- [ ] **Step 7 — Commit**
  ```
  feat(mobile): integrate PostHog RN with session replay + feature flags
  ```

---

## Task 3 — Maestro CI integration

Voir plan complet : `docs/superpowers/plans/2026-03-20-maestro-e2e.md` Task 4.

### Steps

- [ ] **Step 1 — Lire `.eas/workflows/preview-android.yml` actuel**

- [ ] **Step 2 — Ajouter job `e2e` à la fin** (type `maestro-test` si supporté, sinon `custom` avec install maestro CLI)

- [ ] **Step 3 — Secrets EAS** : vérifier/créer `E2E_STUDENT_USERNAME`, `E2E_STUDENT_PASSWORD`, `E2E_PARENT_EMAIL`, `E2E_PARENT_PASSWORD`

- [ ] **Step 4 — Compte test staging** : créer `e2e_student_test` + `e2e-parent@test.tomia.fr` avec 1 enfant + 1 deck pré-rempli

- [ ] **Step 5 — Commit**
  ```
  ci(mobile): integrate Maestro E2E into preview workflow (signal, not gate)
  ```

---

## Task 4 — Jest coverage baseline

### Files

- Modify: `apps/mobile/jest.config.js`

### Steps

- [ ] **Step 1 — Ajouter seuils de coverage**
  ```js
  coverageThreshold: {
    global: {
      statements: 50,
      branches: 40,
      functions: 50,
      lines: 50,
    },
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/app/**/_layout.tsx',  // layouts = routing, peu testable
  ],
  ```

- [ ] **Step 2 — Run coverage baseline**
  ```bash
  cd apps/mobile && pnpm test:coverage
  ```
  Ajuster les seuils au niveau courant +5% pour ne pas casser CI.

- [ ] **Step 3 — Commit**
  ```
  test(mobile): add Jest coverage thresholds (baseline 50%)
  ```

---

## Pré-requis utilisateur

1. **Compte Sentry** : créer projet `tom-mobile` sur sentry.io, récupérer DSN + auth token
2. **Compte PostHog** : créer projet sur `eu.posthog.com`, récupérer API key
3. **Secrets EAS** : configurer via `eas secret:create` :
   - `SENTRY_AUTH_TOKEN`
   - `E2E_STUDENT_USERNAME`, `E2E_STUDENT_PASSWORD`
   - `E2E_PARENT_EMAIL`, `E2E_PARENT_PASSWORD`
4. **Env staging/prod** (Koyeb/EAS) :
   - `EXPO_PUBLIC_SENTRY_DSN`
   - `EXPO_PUBLIC_POSTHOG_API_KEY`
   - `EXPO_PUBLIC_POSTHOG_HOST=https://eu.posthog.com`

## Risques

- **Rebuild natif obligatoire** après install Sentry/PostHog (`pnpm build:dev`) — timing à coordonner.
- **Session replay PostHog** iOS < 13 ou Android < 26 désactivé silencieusement.
- **Source maps EAS** : vérifier que les builds preview ET prod uploadent bien. Tester avec un sample exception.
- **Maestro CI** : flaky si réseau staging down. **Signal, pas gate**.
