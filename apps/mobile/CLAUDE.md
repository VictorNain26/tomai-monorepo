# CLAUDE.md - Tom Mobile

Application mobile Expo SDK 54 pour la plateforme de tutorat Tom.

## Commandes

```bash
# Développement
pnpm dev              # Expo (port 8081)
npx expo start        # Alternative

# Validation
pnpm typecheck        # TypeScript strict
pnpm lint             # ESLint

# Build
npx expo build        # Build EAS
```

## Stack

- **Expo** : SDK 54
- **React Native** : 0.81
- **TypeScript** : 5.9 strict mode
- **Styling** : NativeWind (TailwindCSS pour React Native)
- **UI** : React Native Reusables (shadcn/ui adapté)

## Structure

```
app/                    # Expo Router (file-based routing)
├── (tabs)/             # Navigation par onglets
├── _layout.tsx         # Layout racine
└── index.tsx           # Écran d'accueil

components/
├── ui/                 # React Native Reusables
└── ...                 # Composants spécifiques

lib/                    # Configuration (auth, api)
```

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
- Utiliser les packages partagés (`@tomai/api`, `@tomai/shared-types`)

## Validation pré-commit

```bash
pnpm typecheck  # Zero erreur TypeScript
pnpm lint       # Zero warnings ESLint
```
