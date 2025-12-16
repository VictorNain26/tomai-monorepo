# CLAUDE.md - Tom Monorepo

Monorepo Turborepo unifiant le site vitrine (landing Next.js 16) et l'application métier (Vite + React Router 7).

## Règle absolue

**JAMAIS** inventer de solutions. **TOUJOURS** rechercher la documentation officielle avant toute modification.

## Architecture

```
tomai-monorepo/
├── apps/
│   ├── landing/          # Site vitrine Next.js 16 (port 3001)
│   └── app/              # Application métier Vite (port 5173)
├── packages/
│   ├── eslint-config/    # ESLint config
│   └── typescript-config/ # TypeScript config
├── turbo.json            # Configuration Turborepo
└── pnpm-workspace.yaml   # PNPM workspaces
```

## Commandes

### Développement
```bash
pnpm dev              # Tous les apps (landing + app)
pnpm dev:landing      # Landing seulement (port 3001)
pnpm dev:app          # App métier seulement (port 5173)
```

### Build et Validation
```bash
pnpm build            # Build tous les apps
pnpm typecheck        # TypeScript strict
pnpm lint             # ESLint
pnpm validate         # typecheck + lint
```

### Nettoyage
```bash
pnpm clean            # Clean tous les builds
```

## Apps

### Landing (Site Vitrine)
- **Framework** : Next.js 16 (App Router)
- **Port** : 3001
- **Styling** : TailwindCSS 4
- **Features** : SEO, Static Generation

### App Métier (Tom-client)
- **Framework** : Vite 7 + React 19
- **Port** : 5173
- **Routing** : React Router 7
- **État** : TanStack Query + TanStack Form
- **Auth** : Better Auth
- **UI** : shadcn/ui + TailwindCSS 4

**Détails** : Voir `apps/app/CLAUDE.md`

## Règles strictes

### Longueur des fichiers

- **400 lignes maximum** par fichier
- Découper les composants si dépassement

### Pas de sur-engineering

- Pas d'abstractions prématurées
- Pas de composants génériques pour un seul usage
- Pas de state management complexe si TanStack Query suffit
- Supprimer le code inutilisé

### Standards TypeScript

```typescript
// CORRECT : Types explicites
interface UserFormData {
  name: string;
  email: string;
}

async function handleUser(user: UserFormData | null): Promise<void> {
  if (!user) throw new Error('User required');
  // ...
}

// INTERDIT : Any types
async function handleUser(user: any) { }
```

### UI : shadcn/ui uniquement

```typescript
// CORRECT : shadcn/ui components
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

<Button variant="default">Valider</Button>

// INTERDIT : CSS custom, styles inline
<button style={{ backgroundColor: 'blue' }}>
<div className="custom-card-style">
```

## Sources officielles

- **Turborepo** : https://turbo.build/repo/docs
- **Next.js 16** : https://nextjs.org/docs
- **Vite 7** : https://vitejs.dev/guide
- **TailwindCSS 4** : https://tailwindcss.com/docs
- **shadcn/ui** : https://ui.shadcn.com/docs/components
- **TanStack Query** : https://tanstack.com/query/latest
- **React Router 7** : https://reactrouter.com

## Validation pré-commit

```bash
pnpm typecheck  # Zero erreur TypeScript
pnpm lint       # Zero warnings ESLint
pnpm build      # Build successful
```
