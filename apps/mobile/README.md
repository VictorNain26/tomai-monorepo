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
| React Native | 0.81 |
| React | 19.1 |
| TypeScript | 5.9 strict |
| Styling | NativeWind 4 (TailwindCSS) |
| UI | React Native Reusables |
| State | TanStack Query 5 |
| Auth | Better Auth + Google OAuth |
| Paiements | RevenueCat |
| Navigation | Expo Router 6 (file-based) |

## Configuration

| Propriete | Valeur |
|-----------|--------|
| Bundle ID | `fr.tomia.mobile` |
| Deep link | `tomia://` |
| Architecture | New Architecture (enabled) |
| iOS min | 15.1 |
| Android min SDK | 24 |

## Ecrans

```
src/app/
├── index.tsx                 # Redirection selon role (student/parent)
├── (auth)/                   # Authentification
│   ├── login.tsx             # Connexion (email + Google OAuth + username)
│   ├── register.tsx          # Inscription
│   ├── forgot-password.tsx   # Mot de passe oublie
│   ├── reset-password.tsx    # Reset via deep link
│   └── callback.tsx          # OAuth callback
│
├── (student)/                # 4 tabs eleve
│   ├── (home)/index.tsx      # Dashboard
│   ├── (chat)/index.tsx      # Chat IA (SSE streaming, fichiers, classeur)
│   ├── (learning)/           # Revisions
│   │   ├── index.tsx         # Liste des decks
│   │   ├── create.tsx        # Creer un deck
│   │   └── [id].tsx          # Detail deck / revision FSRS
│   └── (profile)/            # Profil
│       ├── index.tsx         # Menu profil
│       ├── settings.tsx      # Parametres
│       ├── info.tsx          # Infos compte
│       ├── files.tsx         # Classeur (bibliotheque de fichiers)
│       └── pronote/          # Pronote (notes, devoirs, emploi du temps)
│
└── (parent)/                 # 2 tabs parent
    ├── (home)/               # Dashboard + gestion enfants
    │   ├── index.tsx         # Liste enfants
    │   └── child/[id]/       # Profil enfant (notes, devoirs, EDT)
    └── (profile)/            # Profil parent
        ├── index.tsx         # Menu
        ├── pricing.tsx       # Abonnement (RevenueCat)
        └── pronote-connect.tsx
```

## Composants

```
src/components/
├── ui/           # React Native Reusables (avatar, button, card, text, etc.)
├── chat/         # Chat: input, messages, deck cards, file picker, classeur
├── dashboard/    # Widgets: notes recentes, devoirs urgents, tokens
├── learning/     # Deck cards, card viewer, viewers par matiere
├── parent/       # Gestion enfants, modals creation/suppression
├── pronote/      # Vues notes et devoirs (partagees student/parent)
├── subscription/ # Paywall RevenueCat, customer center
├── common/       # Avatar Tom, empty state, loading, math/mermaid
├── providers/    # Theme, RevenueCat, AppProviders
└── auth/         # AuthGuard
```

## Hooks

| Hook | Description |
|------|-------------|
| `useChat` | Chat SSE streaming + attachments + deck creation |
| `usePresignedUpload` | Upload fichiers via Scaleway presigned URLs |
| `useUserFiles` / `useSessionFiles` | Classeur: fichiers utilisateur et session |
| `useAttachFile` / `useDetachFile` | Attacher/detacher fichiers au chat |
| `useDecks` / `useDeck` | CRUD decks de revision |
| `useDueCards` / `useReviewCard` | Revision FSRS (cartes dues, soumettre reponse) |
| `useDueSummary` | Nombre total de cartes a reviser |
| `useStudentPronote` | Notes, devoirs, emploi du temps Pronote |
| `useParentPronote` | Pronote parent (connexion, mappings, enfants) |
| `useStudentDashboard` | Stats eleve (sessions, temps, tokens) |
| `useParentDashboard` | Dashboard parent + gestion enfants |
| `useSubscription` / `useIsPro` | Etat abonnement RevenueCat |
| `useVoiceInput` | Dictee vocale (enregistrement + transcription) |
| `useTextToSpeech` | Synthese vocale ElevenLabs |
| `useTheme` | Theme clair/sombre |

## Base de donnees locale (SQLite)

Utilise `expo-sqlite` + Drizzle ORM pour le cache offline :

| Table | Usage |
|-------|-------|
| `chat_messages` | Cache messages avec statut sync |
| `chat_sessions` | Cache sessions |
| `learning_decks` | Cache decks |
| `fsrs_state` | Etat FSRS par carte |
| `pending_actions` | File d'attente actions offline |
| `sync_metadata` | Timestamps de derniere sync |
| `user_preferences` | Preferences locales |

## Builds (EAS)

### Profils

| Profil | Distribution | Channel | API |
|--------|-------------|---------|-----|
| `development` | Interne | `development` | staging |
| `preview` | Interne (APK) | `preview` | staging |
| `production` | Store (AAB/IPA) | `production` | production |

### Commandes

```bash
# Smart builds (recommande - evite les rebuilds inutiles)
pnpm workflow:preview:android     # Preview Android
pnpm workflow:preview:ios         # Preview iOS
pnpm workflow:prod:android        # Production Android + submit
pnpm workflow:prod:ios            # Production iOS + submit

# OTA Updates (JS uniquement, pas de rebuild)
pnpm update:preview               # Update channel preview
pnpm update:prod                  # Update channel production

# Builds manuels
pnpm build:preview                # APK preview
pnpm build:prod                   # AAB/IPA production
```

### Quand utiliser quoi ?

| Changement | Commande | Rebuild ? |
|------------|----------|-----------|
| Code JS/TS uniquement | `pnpm update:preview` | Non (OTA) |
| Nouvelle dep JS | `pnpm update:preview` | Non (OTA) |
| Nouvelle dep native | `pnpm workflow:preview:android` | Oui si fingerprint change |
| Config `app.config.ts` | `pnpm workflow:preview:android` | Oui si fingerprint change |
| Permissions Android/iOS | `pnpm workflow:preview:android` | Oui |

## EAS Workflows

Les workflows preview utilisent le fingerprint pour eviter les rebuilds inutiles :
1. Calcul du fingerprint natif
2. Si un build existant a le meme fingerprint → repack (pas de rebuild)
3. Sinon → build complet
4. Publication OTA dans tous les cas

## Troubleshooting

### QR code ne s'ouvre pas

1. Utiliser `pnpm dev` (pas `dev:client`)
2. Sur reseau different : `pnpm dev:tunnel`
3. Cache corrompu : `npx expo start --clear`

### Port 8081 occupe

```bash
npx kill-port 8081
# Ou utiliser un autre port
npx expo start --port 8082
```
