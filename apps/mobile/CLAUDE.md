# Mobile Tom

App Expo SDK 55 + React Native 0.83 + React 19.2. NativeWind v5 + React Native Reusables.

## Workflow dev

```bash
pnpm dev              # Lance Metro + Dev Client (quotidien)
pnpm build:dev        # Rebuild dev client Android (smart : skip si fingerprint identique)
pnpm typecheck        # TypeScript strict (zero `any`)
pnpm lint             # ESLint zero warnings
pnpm test             # Tests jest-expo
pnpm test:coverage    # Couverture Jest
```

**Dev Client sur téléphone physique Android** : l'app utilise Google Sign-In, RevenueCat, expo-camera, expo-sqlite, expo-crypto qui nécessitent du code natif. Expo Go ne suffit pas.

### Quand rebuilder ?

| Changement | Commande |
|------------|----------|
| Code JS/TS uniquement | Rien, hot-reload auto |
| Nouvelle dep native (ex: expo-crypto, op-sqlite) | `pnpm build:dev` |
| Config `app.config.ts` | `pnpm build:dev` |

## CI/CD (EAS Workflows)

```bash
pnpm workflow:preview:android     # Preview Android (auto sur push staging)
pnpm workflow:preview:ios         # Preview iOS
pnpm workflow:prod:android        # Production Android + submit Play Store
pnpm workflow:prod:ios            # Production iOS + submit App Store
```

OTA updates via EAS Update. `runtimeVersion: fingerprint` en prod, `1.0.0-dev` en preview (pour éviter divergence Windows/Linux pnpm). Bsdiff patch support activé (réduit taille updates via diffing bytecode Hermes).

## Architecture

- **`src/app/`** : Expo Router v7 file-based avec groupes `(auth)`, `(student)`, `(parent)`
- **`src/components/ui/`** : React Native Reusables uniquement (primitives `@rn-primitives/*`)
- **`src/components/providers/`** : Theme, RevenueCat, Query, Toast, ConfirmDialog
- **`src/hooks/`** : hooks React Query (source de vérité types) — un hook par domaine métier
- **`src/services/`** : services métier (audio, pronote)
- **`src/lib/`** : config (auth, api, query-client, navigation, notifications)
- **`src/stores/`** : Zustand (client state uniquement — pronote, child-access)
- **`src/db/`** : Drizzle + expo-sqlite (cache offline)
- **`e2e/`** : flows Maestro (auth, chat, learning)

## Intégration server

Backend Elysia à `apps/server`. **Eden Treaty** via `@repo/api` (workspace package) donne la type-safety e2e.

- Client initialisé dans `src/lib/api.ts` : `EXPO_PUBLIC_API_URL`, `cookieProvider` injectant la session Better Auth, timeouts (30s général / 60s upload / 120s chat).
- **Auth** : Better Auth + `@better-auth/expo` plugin. Session stockée en `expo-secure-store` (Keychain/Keystore). Deep links `tomia://` pour retour OAuth.
- **Chat SSE** : `react-native-sse` dans `src/hooks/useChat.ts`. Backoff exponentiel + gestion 429 `QUOTA_EXCEEDED` et `CONCURRENT_STREAM`.
- **Upload** : presigned URLs Scaleway (`POST /api/upload/presign` → PUT S3 direct → `POST /api/upload/confirm/:id`). Voir `src/hooks/usePresignedUpload.ts`.
- **Data fetching** : TanStack Query v5 + persister AsyncStorage (`TOMIA_QUERY_CACHE`, gcTime 24h, staleTime 5min, retry 2× exponentiel) + NetInfo pour `onlineManager`.

## Patterns React / Expo 2026

- `experiments.typedRoutes: true` actif → utiliser les types générés pour `<Link href>` / `router.push`
- **React 19** : pas de `forwardRef` (ref = prop), `use()` au lieu de `useContext()`, `<Ctx value={}>` au lieu de `<Ctx.Provider>`
- **React Compiler** : **bloqué** par incompatibilité Expo Router (issue #35100). Mémorisation manuelle (`useMemo`/`useCallback`) où utile, sinon laisser React runtime.
- **Stack.Protected** : à adopter pour auth-gating (voir `src/app/index.tsx` pour migration)
- **`useLoaderData`** : à adopter sur écrans data-driven (pattern Expo Router v7)

## Contraintes

- **JAMAIS** de StyleSheet custom si NativeWind suffit
- **JAMAIS** de composants dupliqués avec le web → utiliser `@repo/api`
- UI via React Native Reusables uniquement (`@/components/ui/`)
- State : TanStack Query (server state) + Zustand (client state) — jamais mixer
- TypeScript strict, zéro `any` (vérifié en CI)
- **400 lignes max** par fichier (3 exceptions actuelles à splitter : `(auth)/login.tsx`, `(parent)/onboarding-pronote.tsx`, `(parent)/profile/pronote-connect.tsx`)

## Testing

- **Unit** : `jest-expo` + `@testing-library/react-native`. Tests dans `__tests__/<path>/<name>.test.ts`.
- **E2E** : Maestro dans `e2e/*.yaml`. 4 flows : auth-student, auth-parent, chat-send-message, learning-flashcard. Requiert compte test staging + secrets EAS (`E2E_STUDENT_USERNAME`, etc.).
- `testID` obligatoires sur éléments critiques (login form, dashboards, chat input/send, deck list)

## Observabilité (à installer — voir spec SP3)

- **Sentry** RN SDK v8 : crashs, perfs, source maps EAS
- **PostHog** RN 3.2+ : analytics + feature flags + session replay (dev build requis, iOS 13+/Android 26+)

## Sécurité & conformité (à installer — voir spec SP4)

- **App Integrity** : `expo-app-integrity` (App Attest iOS + Play Integrity Android) — obligatoire pour flows paiement/credentials
- **SSL pinning** : scope minimal (`/api/auth/*` et `/api/subscriptions/*`) via `react-native-ssl-public-key-pinning`
- **Cache chiffré** : SQLite → SQLCipher (`@op-engineering/op-sqlite`) + TanStack persister wrapper AES (clés en SecureStore)
- **a11y WCAG 2.1 AA** obligatoire (EAA en vigueur depuis juin 2025) : `accessibilityLabel`, `accessibilityRole`, contrast 4.5:1, targets ≥44×44pt

## Troubleshooting

| Symptôme | Solution |
|---|---|
| Metro ne démarre pas | `npx expo start --dev-client --clear` |
| Port 8081 occupé | `npx kill-port 8081` |
| Téléphone ne se connecte pas | vérifier même réseau Wi-Fi |
| NativeWind v5 className ignoré sur `SafeAreaView` | Utiliser le wrapper CSS `@/components/ui/safe-area-view` (le polyfill global ne wrappe que `SafeAreaProvider`) |
| Metro `unstable_enablePackageExports` erreur | Ne PAS override — SDK 53+ gère les `conditionNames` correctement |

## Sources officielles

[Expo SDK 55](https://docs.expo.dev), [Expo Router v7](https://docs.expo.dev/router/introduction/), [React Native Reusables](https://rnr-docs.vercel.app), [NativeWind v5](https://www.nativewind.dev/v5), [TanStack Query v5](https://tanstack.com/query/v5), [Better Auth](https://better-auth.com), [Maestro](https://maestro.mobile.dev)
