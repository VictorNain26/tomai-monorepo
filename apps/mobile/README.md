# TomAI Mobile

Application mobile Expo SDK 54 pour la plateforme de tutorat IA francaise. iOS et Android.

## Quick Start

```bash
# Installation (depuis la racine du monorepo)
pnpm install

# Developpement avec Expo Go
pnpm dev              # Scanner le QR code avec l'app Expo Go
pnpm dev:tunnel       # Si sur un reseau different

# Validation
pnpm typecheck
pnpm lint
```

## Stack

| Composant | Version |
|-----------|---------|
| Expo | SDK 54 |
| React Native | 0.81 (New Architecture) |
| React | 19.1 |
| TypeScript | 5.9 strict |
| Styling | NativeWind 4 (TailwindCSS) |
| UI | React Native Reusables |
| State | TanStack Query 5 |
| Auth | Better Auth + Google OAuth |
| Paiements | RevenueCat |
| Navigation | Expo Router 6 (file-based) |
| DB locale | expo-sqlite + Drizzle ORM |

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

## Hooks

| Hook | Description |
|------|-------------|
| `useChat` | Chat SSE streaming + attachments + deck creation |
| `usePresignedUpload` | Upload fichiers via Scaleway presigned URLs |
| `useUserFiles` / `useSessionFiles` | Classeur : fichiers utilisateur et session |
| `useDecks` / `useDeck` | CRUD decks de revision |
| `useDueCards` / `useReviewCard` | Revision FSRS (cartes dues, soumettre reponse) |
| `useStudentPronote` / `useParentPronote` | Notes, devoirs, emploi du temps Pronote |
| `useStudentDashboard` / `useParentDashboard` | Stats et gestion enfants |
| `useSubscription` / `useIsPro` | Etat abonnement RevenueCat |
| `useVoiceInput` / `useTextToSpeech` | Dictee vocale + synthese ElevenLabs |

## Local Database (SQLite)

Cache offline via `expo-sqlite` + Drizzle ORM :

| Table | Usage |
|-------|-------|
| `chat_messages` / `chat_sessions` | Cache messages et sessions |
| `learning_decks` / `fsrs_state` | Cache decks et etat FSRS |
| `pending_actions` | File d'attente actions offline |
| `sync_metadata` | Timestamps de derniere sync |
| `user_preferences` | Preferences locales |

## Builds (EAS)

```bash
# Smart builds (recommande - fingerprint evite rebuilds inutiles)
pnpm workflow:preview:android     # Preview Android
pnpm workflow:preview:ios         # Preview iOS
pnpm workflow:prod:android        # Production Android + submit
pnpm workflow:prod:ios            # Production iOS + submit

# OTA Updates (JS uniquement, pas de rebuild)
pnpm update:preview               # Channel preview
pnpm update:prod                  # Channel production
```

| Changement | Commande | Rebuild ? |
|------------|----------|-----------|
| Code JS/TS uniquement | `pnpm update:preview` | Non (OTA) |
| Nouvelle dep native | `pnpm workflow:preview:android` | Oui si fingerprint change |
| Permissions Android/iOS | `pnpm workflow:preview:android` | Oui |

## Troubleshooting

- **QR code ne s'ouvre pas** : utiliser `pnpm dev` (pas `dev:client`) ou `pnpm dev:tunnel`
- **Cache corrompu** : `npx expo start --clear`
- **Port 8081 occupe** : `npx kill-port 8081`
