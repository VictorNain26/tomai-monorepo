# Mobile Tom

App Expo SDK 55 + React Native 0.83 + React 19.2. NativeWind + React Native Reusables.

## Commandes

```bash
pnpm dev:client       # Dev Client (RECOMMANDE — necessite build EAS prealable)
pnpm dev              # Expo Go (limite : pas de modules natifs custom)
pnpm dev:tunnel       # Expo Go via tunnel (reseau different)
pnpm typecheck        # TypeScript strict
pnpm lint             # ESLint zero warnings
```

**Dev Client est l'environnement principal** : l'app utilise Google Sign-In, RevenueCat, expo-camera, expo-sqlite qui necessitent du code natif.

## Builds

| Changement | Commande | Rebuild ? |
|------------|----------|-----------|
| Code JS/TS uniquement | `pnpm update:preview` | Non (OTA) |
| Nouvelle dep native | `pnpm workflow:preview:android` | Oui si fingerprint change |
| Config app.config.ts | `pnpm workflow:preview:android` | Oui si fingerprint change |

```bash
# Smart builds (RECOMMANDE - evite rebuilds inutiles)
pnpm workflow:preview:android     # Preview Android
pnpm workflow:preview:ios         # Preview iOS
pnpm workflow:prod:android        # Production Android + submit
pnpm workflow:prod:ios            # Production iOS + submit

# OTA Updates (JS uniquement, sans rebuild)
pnpm update:preview               # Channel preview
pnpm update:prod                  # Channel production
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

- QR code ne marche pas → `pnpm dev` (pas `dev:client`) ou `pnpm dev:tunnel`
- Cache corrompu → `npx expo start --clear`
- Port 8081 occupe → `npx kill-port 8081`
