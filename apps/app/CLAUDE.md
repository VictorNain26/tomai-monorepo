# CLAUDE.md - Tom Client

Frontend React 19 de la plateforme de tutorat Tom. Interface utilisateur avec shadcn/ui et TailwindCSS 4.

## Règle absolue

**JAMAIS** inventer de solutions. **TOUJOURS** rechercher la documentation officielle avant toute modification.

### Processus obligatoire

1. WebFetch documentation officielle (shadcn/ui, React 19, TailwindCSS 4)
2. Read/Grep patterns existants dans le codebase
3. Validation TypeScript strict + ESLint zero warnings
4. Implémentation evidence-based

## Commandes

```bash
# Développement
pnpm dev              # Port 5173
pnpm typecheck:watch  # Surveillance TypeScript

# Validation (obligatoire avant commit)
pnpm validate         # typecheck + lint
pnpm typecheck        # TypeScript strict
pnpm lint             # ESLint
pnpm lint:fix         # Auto-fix

# Build
pnpm build            # Production
pnpm preview          # Preview local
```

## Stack

- **React** : 19
- **TypeScript** : 5.9 strict mode
- **Vite** : 7
- **Routing** : React Router 7
- **État serveur** : TanStack Query 5
- **Formulaires** : TanStack Form 1
- **Auth** : Better Auth
- **UI** : shadcn/ui + TailwindCSS 4
- **Icons** : Lucide React
- **Animations** : Framer Motion

## Structure

```
src/
├── components/
│   ├── ui/              # shadcn/ui (SEULE source UI)
│   ├── auth/            # Authentification
│   ├── modals/          # Modals
│   └── Layout/          # Sidebar, navigation
├── pages/               # Pages React Router
├── hooks/               # Hooks personnalisés
├── lib/                 # Config (auth, api, queryClient)
├── services/            # Services API
├── types/               # Types globaux
├── utils/               # Utilitaires
└── constants/           # Constantes
```

## Règles strictes

### Longueur des fichiers

- **400 lignes maximum** par fichier
- Découper les composants complexes en sous-composants

### Pas de sur-engineering

- Pas de composants génériques pour un seul usage
- Pas de hooks custom si un inline suffit
- Pas de context si TanStack Query gère déjà l'état
- Supprimer le code inutilisé

### UI : shadcn/ui uniquement

```typescript
// CORRECT : shadcn/ui
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

<Button variant="default" size="lg">Valider</Button>
```

```typescript
// INTERDIT : CSS custom, styles inline
<button style={{ backgroundColor: 'blue' }}>
<div className="custom-card-style">
```

### TypeScript Strict

```typescript
// CORRECT : Types explicites, gestion null
interface UserFormData {
  name: string;
  email: string;
  age?: number;
}

async function handleUser(user: UserFormData | null): Promise<void> {
  if (!user) {
    throw new Error('User required');
  }
  // ...
}

// INTERDIT : any, null non-géré
async function handleUser(user: any) {
  // Crash possible
}
```

### État avec TanStack

```typescript
// TanStack Query pour données serveur
const { data: users, isLoading } = useQuery({
  queryKey: ['users'],
  queryFn: fetchUsers,
  staleTime: 5 * 60 * 1000
});

// TanStack Form pour formulaires
const form = useForm({
  defaultValues: { name: '', email: '' },
  onSubmit: async ({ value }) => {
    await mutation.mutateAsync(value);
  }
});
```

### Authentification Better Auth

```typescript
import { useUser, useIsAuthenticated, signIn, signOut } from '@/lib/auth-hooks'

function Profile() {
  const user = useUser();
  const isAuthenticated = useIsAuthenticated();

  if (!isAuthenticated) {
    return <LoginForm />;
  }

  return <div>Bonjour {user?.name}</div>;
}
```

## Sources officielles

- **shadcn/ui** : https://ui.shadcn.com/docs/components
- **TailwindCSS 4** : https://tailwindcss.com/docs
- **React 19** : https://react.dev/reference/react
- **TanStack Query** : https://tanstack.com/query/latest
- **React Router 7** : https://reactrouter.com
- **Better Auth** : https://better-auth.com/docs

## Validation pré-commit

```bash
pnpm typecheck  # Zero erreur TypeScript strict
pnpm lint       # Zero warnings ESLint
pnpm build      # Build successful
```
