# Mobile Tom

App Expo SDK 55 + React Native 0.83 + React 19.2. NativeWind + React Native Reusables.

## Workflow dev

```bash
pnpm dev              # Lance Metro + Dev Client (quotidien)
pnpm build:dev        # Rebuild dev client Android (smart : skip si fingerprint identique)
pnpm typecheck        # TypeScript strict
pnpm lint             # ESLint zero warnings
pnpm test             # Tests jest-expo
```

**Dev Client sur telephone physique Android** : l'app utilise Google Sign-In, RevenueCat, expo-camera, expo-sqlite qui necessitent du code natif.

### Quand rebuilder ?

| Changement | Commande |
|------------|----------|
| Code JS/TS uniquement | Rien, hot-reload auto |
| Nouvelle dep native | `pnpm build:dev` |
| Config app.config.ts | `pnpm build:dev` |

## CI/CD (workflows EAS)

```bash
pnpm workflow:preview:android     # Preview Android (auto sur push staging)
pnpm workflow:preview:ios         # Preview iOS
pnpm workflow:prod:android        # Production Android + submit Play Store
pnpm workflow:prod:ios            # Production iOS + submit App Store
```

## Architecture

- **`src/app/`** : Expo Router v7 (file-based routing) avec groupes `(auth)`, `(student)`, `(parent)`
- **`src/components/ui/`** : React Native Reusables uniquement
- **`src/hooks/`** : React Query hooks (source de verite types)
- **`src/services/`** : services metier (audio, pronote)
- **`src/lib/`** : config (auth, api, query-client)

## Contraintes

- JAMAIS de StyleSheet custom si NativeWind suffit
- JAMAIS de composants dupliques avec le web → utiliser `@repo/api`
- UI via React Native Reusables uniquement (`@/components/ui/`)
- State : TanStack Query (serveur) + React Context (local)

## Troubleshooting

- Metro ne demarre pas → `npx expo start --dev-client --clear`
- Port 8081 occupe → `npx kill-port 8081`
- Telephone ne se connecte pas → verifier meme reseau Wi-Fi
