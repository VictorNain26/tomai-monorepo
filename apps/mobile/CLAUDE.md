# CLAUDE.md - Tom Mobile

Application mobile Expo SDK 54 pour la plateforme de tutorat Tom.

## Commandes

```bash
# Développement avec Expo Go (RECOMMANDÉ pour démarrer)
pnpm dev              # Expo Go - scan QR code avec l'app Expo Go
pnpm dev:tunnel       # Expo Go via tunnel (si sur réseau différent)
pnpm dev:ios          # Expo Go sur iOS
pnpm dev:android      # Expo Go sur Android

# Développement avec Dev Client (modules natifs custom)
pnpm dev:client       # Nécessite un build EAS préalable (build:dev)

# Validation
pnpm typecheck        # TypeScript strict
pnpm lint             # ESLint
```

## Smart Build (Best Practice 2026)

**Toujours utiliser les smart builds pour éviter les rebuilds inutiles et économiser.**

```bash
# Safe Build - Vérifie qu'aucun build n'est en cours avant de lancer
pnpm build:safe                    # Par défaut: preview android
pnpm build:safe:preview            # Preview Android avec guard
pnpm build:safe:prod               # Production Android avec guard

# EAS Workflows - Utilise le fingerprint pour éviter les rebuilds
pnpm workflow:preview:android      # Smart build Android (RECOMMANDÉ)
pnpm workflow:preview:ios          # Smart build iOS
pnpm workflow:prod:android         # Production Android + submit
pnpm workflow:prod:ios             # Production iOS + submit

# OTA Updates - Mise à jour sans rebuild (JS uniquement)
pnpm update:dev                    # Update channel development
pnpm update:preview                # Update channel preview
pnpm update:prod                   # Update channel production

# Fingerprint - Vérifier si un rebuild est nécessaire
pnpm fingerprint                   # Génère le fingerprint actuel
```

### Quand utiliser quoi ?

| Changement | Commande | Rebuild ? |
|------------|----------|-----------|
| Code JS/TS uniquement | `pnpm update:preview` | Non (OTA) |
| Nouvelle dépendance JS | `pnpm update:preview` | Non (OTA) |
| Nouvelle dépendance native | `pnpm workflow:preview:android` | Oui si fingerprint change |
| Config app.config.ts | `pnpm workflow:preview:android` | Oui si fingerprint change |
| Permissions Android/iOS | `pnpm workflow:preview:android` | Oui |

## EAS Build (Manuel)

```bash
# Development (testeurs internes)
pnpm build:dev            # iOS + Android
pnpm build:dev:ios        # iOS Simulator
pnpm build:dev:android    # Android APK

# Preview (testeurs externes)
pnpm build:preview        # iOS + Android APK
pnpm build:preview:ios    # iOS (TestFlight internal)
pnpm build:preview:android # Android APK

# Production (stores)
pnpm build:prod           # iOS + Android AAB
pnpm build:prod:ios       # iOS (App Store Connect)
pnpm build:prod:android   # Android AAB (Play Store)

# Submit to stores
pnpm submit:ios           # Soumettre à App Store
pnpm submit:android       # Soumettre à Play Store
```

## Expo Go vs Dev Client

| Mode | Quand l'utiliser | Commande |
|------|------------------|----------|
| **Expo Go** | Développement rapide, pas de modules natifs custom | `pnpm dev` |
| **Dev Client** | Modules natifs (RevenueCat, etc.), debugging avancé | `pnpm dev:client` |

**Important** : Le Dev Client nécessite un build EAS préalable :
```bash
# 1. Build une fois (5-10 min sur EAS)
pnpm build:dev:android  # ou :ios

# 2. Installer l'APK/app sur le device

# 3. Puis utiliser dev:client
pnpm dev:client
```

## Configuration requise

### Première utilisation EAS

```bash
# 1. Installer EAS CLI globalement
npm install -g eas-cli

# 2. Se connecter avec compte Expo
eas login

# 3. Lier le projet (génère projectId dans app.config.ts)
eas build:configure
```

### Comptes développeur (optionnel pour dev/preview)

- **Apple Developer** : $99/an (obligatoire pour App Store)
- **Google Play Developer** : $25 one-time (obligatoire pour Play Store)

## Stack

- **Expo** : SDK 54 + New Architecture
- **React Native** : 0.81
- **TypeScript** : 5.9 strict mode
- **Styling** : NativeWind 4 (TailwindCSS 3 pour React Native)
- **UI** : React Native Reusables (shadcn/ui adapté)
- **State** : TanStack Query (serveur), React Context (local)
- **Auth** : Better Auth avec @better-auth/expo
- **Updates** : EAS Updates avec fingerprint

## Structure

```
src/
├── app/                    # Expo Router (file-based routing)
│   ├── (student)/          # Écrans élève (tabs)
│   ├── (parent)/           # Écrans parent (tabs)
│   ├── (auth)/             # Authentification
│   ├── _layout.tsx         # Layout racine
│   └── index.tsx           # Écran d'accueil
├── components/
│   ├── ui/                 # React Native Reusables
│   ├── auth/               # Composants auth (AuthGuard, etc.)
│   ├── dashboard/          # Composants dashboard
│   ├── chat/               # Composants chat
│   ├── providers/          # Context providers
│   └── common/             # Composants partagés
├── hooks/                  # React Query hooks (source de vérité types)
├── lib/                    # Configuration (auth, api, query-client)
├── services/               # Services métier (audio, pronote)
├── constants/              # Constantes et config
└── types/                  # Types TypeScript

.eas/
└── workflows/              # EAS Workflows avec fingerprint
    ├── preview-android.yml
    ├── preview-ios.yml
    ├── production-android.yml
    └── production-ios.yml

scripts/
└── safe-build.js           # Guard contre builds dupliqués
```

## Profils EAS Build

| Profil | Usage | Distribution | Output | Channel |
|--------|-------|--------------|--------|---------|
| `development` | Dev/debug avec hot reload | Interne | APK + iOS Simulator | development |
| `preview` | Test sans outils dev | Interne | APK + Ad Hoc | preview |
| `production` | Publication stores | Store | AAB + App Store | production |

## Règles

### UI : React Native Reusables uniquement

```typescript
// CORRECT : composants React Native Reusables
import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
```

### NativeWind pour le styling

```typescript
// CORRECT : classes TailwindCSS via NativeWind
<View className="flex-1 bg-background p-4">
  <Text className="text-lg font-bold text-foreground">Bonjour</Text>
</View>
```

### Pas de sur-engineering

- Pas de StyleSheet custom si NativeWind suffit
- Pas de composants dupliqués avec le web
- Utiliser les packages partagés (`@repo/api`)

## Troubleshooting

### "Nothing opens when scanning QR code"

1. **Avec Expo Go** : Utiliser `pnpm dev` (pas `dev:client`)
2. **Sur réseau différent** : Utiliser `pnpm dev:tunnel`
3. **Cache corrompu** : `npx expo start --clear`

### "Metro bundler port already in use"

```bash
# Trouver et tuer le processus
npx kill-port 8081
# Ou utiliser un autre port
npx expo start --port 8082
```

### "EXPO_ROUTER_APP_ROOT not defined"

Le cache Babel est corrompu. Nettoyer :
```bash
npx expo start --clear
```

## Validation pré-commit

```bash
pnpm typecheck  # Zero erreur TypeScript
pnpm lint       # Zero warnings ESLint
```
