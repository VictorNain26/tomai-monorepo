# CLAUDE.md - Tom Mobile

Application mobile Expo SDK 54 pour la plateforme de tutorat Tom.

## Commandes

```bash
# Développement (avec dev-client)
pnpm dev              # Dev client (nécessite build:dev d'abord)
pnpm dev:go           # Expo Go (sans dev-client)

# Validation
pnpm typecheck        # TypeScript strict
pnpm lint             # ESLint

# EAS Build - Development (testeurs internes)
pnpm build:dev            # iOS + Android APK
pnpm build:dev:ios        # iOS Simulator uniquement
pnpm build:dev:android    # Android APK uniquement

# EAS Build - Preview (testeurs externes)
pnpm build:preview        # iOS + Android APK
pnpm build:preview:ios    # iOS (TestFlight internal)
pnpm build:preview:android # Android APK

# EAS Build - Production (stores)
pnpm build:prod           # iOS + Android AAB
pnpm build:prod:ios       # iOS (App Store Connect)
pnpm build:prod:android   # Android AAB (Play Store)

# Submit to stores
pnpm submit:ios           # Soumettre à App Store
pnpm submit:android       # Soumettre à Play Store
```

## Configuration requise

### Première utilisation EAS

```bash
# 1. Installer EAS CLI globalement
npm install -g eas-cli

# 2. Se connecter avec compte Expo
eas login

# 3. Lier le projet (génère projectId dans app.json)
eas build:configure
```

### Comptes développeur (optionnel pour dev/preview)

- **Apple Developer** : $99/an (obligatoire pour App Store)
- **Google Play Developer** : $25 one-time (obligatoire pour Play Store)

## Stack

- **Expo** : SDK 54
- **React Native** : 0.83
- **TypeScript** : 5.9 strict mode
- **Styling** : NativeWind (TailwindCSS pour React Native)
- **UI** : React Native Reusables (shadcn/ui adapté)

## Structure

```
app/                    # Expo Router (file-based routing)
├── (student)/          # Écrans élève
├── (parent)/           # Écrans parent
├── (auth)/             # Authentification
├── _layout.tsx         # Layout racine
└── index.tsx           # Écran d'accueil

components/
├── ui/                 # React Native Reusables
├── dashboard/          # Composants dashboard
├── chat/               # Composants chat
└── ...                 # Composants spécifiques

hooks/                  # React Query hooks (source de vérité types)
lib/                    # Configuration (auth, api)
```

## Profils EAS Build

| Profil | Usage | Distribution | Output |
|--------|-------|--------------|--------|
| `development` | Dev/debug avec hot reload | Interne | APK + iOS Simulator |
| `preview` | Test sans outils dev | Interne | APK + Ad Hoc |
| `production` | Publication stores | Store | AAB + App Store |

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

## Validation pré-commit

```bash
pnpm typecheck  # Zero erreur TypeScript
pnpm lint       # Zero warnings ESLint
```
