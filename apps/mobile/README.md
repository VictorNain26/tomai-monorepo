# TomAI Mobile

Application mobile Expo SDK 55 pour la plateforme de tutorat IA francaise. iOS et Android.

## Quick Start

```bash
# Installation (depuis la racine du monorepo)
pnpm install

# Developpement (Dev Client sur telephone physique)
pnpm dev              # Lance Metro + Dev Client
pnpm build:dev        # Rebuild dev client Android (smart fingerprint)

# Validation
pnpm typecheck
pnpm lint
pnpm test
```

## Stack

| Composant | Version |
|-----------|---------|
| Expo | SDK 55 |
| React Native | 0.83 (New Architecture) |
| React | 19.2 |
| TypeScript | 5.9 strict |
| Styling | NativeWind 5 (TailwindCSS 4) |
| UI | React Native Reusables |
| State | TanStack Query 5 (serveur) + Zustand (local) |
| Auth | Better Auth + Google OAuth |
| Paiements | RevenueCat |
| Navigation | Expo Router 7 (file-based) |
| DB locale | expo-sqlite + Drizzle ORM |
| Push | Firebase Cloud Messaging (FCM) |

## Configuration

| Propriete | Valeur |
|-----------|--------|
| Bundle ID | `fr.tomia.mobile` |
| Deep link | `tomia://` |
| iOS min | 15.1 |
| Android min SDK | 24 |

## Screens

```
src/app/
├── index.tsx                 # Redirection selon role
├── (auth)/                   # Login, register, OAuth, reset password
├── (student)/                # 4 tabs eleve
│   ├── (home)/               # Dashboard
│   ├── (chat)/               # Chat IA (SSE streaming, fichiers)
│   ├── (learning)/           # Revisions FSRS (decks, cartes)
│   └── (profile)/            # Profil, classeur, Pronote
└── (parent)/                 # 2 tabs parent
    ├── (home)/               # Dashboard, gestion enfants, Pronote
    └── (profile)/            # Profil, abonnement RevenueCat
```

## Builds (EAS)

```bash
pnpm build:dev                    # Dev client Android (quotidien)
pnpm workflow:preview:android     # Preview Android
pnpm workflow:preview:ios         # Preview iOS
pnpm workflow:prod:android        # Production Android + submit
pnpm workflow:prod:ios            # Production iOS + submit
```

| Changement | Action |
|------------|--------|
| Code JS/TS uniquement | Rien, hot-reload auto |
| Nouvelle dep native | `pnpm build:dev` |
| Config app.config.ts | `pnpm build:dev` |

## Troubleshooting

- **Metro ne demarre pas** : `npx expo start --dev-client --clear`
- **Port 8081 occupe** : `npx kill-port 8081`
- **Telephone ne se connecte pas** : verifier meme reseau Wi-Fi
