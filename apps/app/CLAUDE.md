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

# Build
pnpm build            # Production
pnpm preview          # Preview local
```

## Stack

- **React** : 19 + React Compiler (memoization automatique)
- **TypeScript** : 5.9 strict mode
- **Vite** : 7
- **Routing** : React Router 7
- **État serveur** : TanStack Query 5 (pattern `queryOptions`)
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
│   ├── chat/            # Composants chat (atoms, molecules, organisms)
│   ├── modals/          # Modals
│   └── Layout/          # Sidebar, navigation
├── pages/               # Pages React Router
├── hooks/               # Hooks personnalisés (useChat, usePresignedUpload)
├── lib/                 # Config (auth, api-client, queryClient)
├── services/            # Services API
├── types/               # Types globaux (IFileAttachment, FileType)
├── utils/               # Utilitaires
└── constants/           # Constantes
```

---

## ⚠️ BEST PRACTICES 2025-2026 (OBLIGATOIRES)

Ces règles sont **NON-NÉGOCIABLES**. Claude Code DOIT les appliquer systématiquement.

### 1. React 19 + React Compiler : AUCUN useMemo/useCallback

**Source** : https://react.dev/learn/react-compiler/introduction

Le React Compiler optimise automatiquement. Les hooks de memoization manuels sont **INTERDITS** sauf cas exceptionnels.

```typescript
// ❌ INTERDIT (anti-pattern 2026)
import { useMemo, useCallback, memo } from 'react';

const items = useMemo(() => data.filter(x => x.active), [data]);
const handleClick = useCallback(() => onClick(id), [onClick, id]);
const MemoizedComponent = memo(MyComponent);

// ✅ OBLIGATOIRE (React Compiler optimise)
const items = data.filter(x => x.active);
const handleClick = () => onClick(id);
function MyComponent() { ... }
```

**Exceptions autorisées** (documenter pourquoi) :
- Interop avec libs externes exigeant référence stable (DnD, charts, maps)
- Contrôle précis des dépendances d'un `useEffect` critique
- Calculs très coûteux (>100ms) avec inputs instables

### 2. TanStack Query v5 : Pattern `queryOptions` OBLIGATOIRE

**Source** : https://tanstack.com/query/latest/docs/framework/react/guides/query-options

```typescript
// ❌ INTERDIT (ancien pattern)
export const myQueries = {
  users: () => ({
    queryKey: ['users'],
    queryFn: fetchUsers,
  }),
};

// ✅ OBLIGATOIRE (queryOptions v5)
import { queryOptions } from '@tanstack/react-query';

export const usersQueryOptions = () =>
  queryOptions({
    queryKey: ['users'] as const,
    queryFn: fetchUsers,
  });

export const userQueryOptions = (userId: string) =>
  queryOptions({
    queryKey: ['users', userId] as const,
    queryFn: () => fetchUser(userId),
    enabled: !!userId,
  });

// Usage dans composants
const { data } = useQuery(usersQueryOptions());
const { data: user } = useQuery(userQueryOptions(id));
```

**Règles queryOptions** :
- Toujours utiliser `as const` pour les queryKey
- Un fichier `queries/*.ts` par domaine (users, learning, chat...)
- Nommer `{domain}QueryOptions` ou `{entity}QueryOptions`

### 3. TypeScript Strict : Patterns obligatoires

**Source** : https://www.typescriptlang.org/tsconfig#strict

```typescript
// ❌ INTERDIT
const data: any = response;
catch (error) { console.log(error.message); }
const item = items[0]; // sans vérifier undefined

// ✅ OBLIGATOIRE
const data: UserResponse = response;
catch (error: unknown) {
  if (error instanceof Error) {
    console.log(error.message);
  }
}
const item = items[0];
if (!item) return null;
```

**Patterns TypeScript stricts** :
- `unknown` au lieu de `any` pour les catch et données externes
- `as const` pour les tableaux/objets littéraux
- Vérifier `undefined` après accès array/optional chaining
- Discriminated unions pour les états async

### 4. État dérivé : Calcul direct, PAS de useState

```typescript
// ❌ INTERDIT (état dérivé dans useState)
const [filteredItems, setFilteredItems] = useState<Item[]>([]);
useEffect(() => {
  setFilteredItems(items.filter(x => x.active));
}, [items]);

// ✅ OBLIGATOIRE (calcul direct)
const filteredItems = items.filter(x => x.active);
```

### 5. Comparaisons : Explicites et lisibles

```typescript
// ❌ ÉVITER (implicite)
if (value) { ... }
if (items.length) { ... }

// ✅ PRÉFÉRER (explicite)
if (value !== '') { ... }
if (value !== null && value !== undefined) { ... }
if (items.length > 0) { ... }
```

### 6. Handlers : Inline quand simple

```typescript
// ❌ ÉVITER (wrapper inutile)
const handleChange = (value: string) => {
  setValue(value);
};
<Select onValueChange={handleChange} />

// ✅ PRÉFÉRER (inline direct)
<Select onValueChange={setValue} />

// ✅ OK si logique additionnelle
const handleChange = (value: string) => {
  setValue(value);
  setOtherState('');  // Reset cascade
};
```

---

## Règles générales

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

### Upload fichiers (Presigned URLs)

Upload direct vers Scaleway Object Storage (RGPD France) via presigned URLs.

```typescript
import { usePresignedUpload } from '@/hooks/usePresignedUpload'

function FileUploader() {
  const { uploadFile, files, isProcessing, removeFile } = usePresignedUpload();

  const handleUpload = async (file: File) => {
    // Flow: GET presigned URL → PUT direct Scaleway → CONFIRM backend
    const attachment = await uploadFile(file, { context: 'chat' });
    if (attachment) {
      console.log('Upload réussi:', attachment.fileId);
    }
  };
}
```

**Limites** : 10MB max, types supportés : images, PDF, audio, documents Word/texte.

## Sources officielles (WebFetch OBLIGATOIRE)

- **React Compiler** : https://react.dev/learn/react-compiler/introduction
- **TanStack Query v5** : https://tanstack.com/query/latest/docs/framework/react/guides/query-options
- **shadcn/ui** : https://ui.shadcn.com/docs/components
- **TailwindCSS 4** : https://tailwindcss.com/docs
- **React 19** : https://react.dev/reference/react
- **React Router 7** : https://reactrouter.com
- **Better Auth** : https://better-auth.com/docs
- **TypeScript Strict** : https://www.typescriptlang.org/tsconfig#strict

## Validation pré-commit

```bash
pnpm typecheck  # Zero erreur TypeScript strict
pnpm lint       # Zero warnings ESLint
pnpm build      # Build successful
```

## Checklist Claude Code (OBLIGATOIRE avant chaque modification)

- [ ] Aucun `useMemo`, `useCallback`, `memo` ajouté (sauf exception documentée)
- [ ] Pattern `queryOptions` utilisé pour TanStack Query
- [ ] `as const` sur tous les queryKey
- [ ] Aucun `any` - utiliser `unknown` pour données externes
- [ ] État dérivé calculé directement (pas de useState+useEffect)
- [ ] Comparaisons explicites (`!== ''` au lieu de `!value`)
- [ ] Fichier < 400 lignes
- [ ] `pnpm validate` passe sans erreur
