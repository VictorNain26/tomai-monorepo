# CLAUDE.md - Tom Client

**Frontend React 19** de la plateforme de tutorat socratique adaptatif Tom. Interface utilisateur moderne avec shadcn/ui et TailwindCSS 4.

## 🚨 RÈGLE ABSOLUE

**JAMAIS** inventer de solutions. **TOUJOURS** rechercher documentation officielle avant toute modification.

### Processus obligatoire :
1. **WebFetch** documentation officielle (shadcn/ui, React 19, TailwindCSS 4.x)
2. **Read/Grep** codebase existant pour patterns
3. **Validation** TypeScript strict + ESLint zero warnings
4. **Implémentation** evidence-based

## ⚡ Commandes de Développement

### Développement
```bash
# Serveur de développement (port 5173)
pnpm dev

# Surveillance TypeScript
pnpm typecheck:watch
```

### Validation (OBLIGATOIRE avant commit)
```bash
# Validation complète
pnpm validate              # typecheck + lint

# Validation stricte CI
pnpm validate:ci           # typecheck + lint zero warnings

# Vérifications individuelles
pnpm typecheck             # TypeScript strict mode
pnpm lint                  # ESLint avec warnings
pnpm lint:ci               # ESLint zero warnings (CI)
pnpm lint:fix              # Auto-fix ESLint
```

### Build et Production
```bash
# Build optimisé production
pnpm build                 # Avec validation pré-build

# Build staging
pnpm build:staging         # Mode staging

# Preview build local
pnpm preview
```

### Outils de Développement
```bash
# Analyse dépendances
pnpm analyze:deps          # Détection dépendances inutiles

# Tests (à configurer)
pnpm test                  # Tests unitaires
pnpm test:ci               # Tests CI
```

## 🎯 Stack Technologique

### Framework & Runtime
- **React** : 19.1.1 (dernière version avec nouvelles fonctionnalités)
- **TypeScript** : 5.9.2 strict mode + configuration production
- **Vite** : 7.1.5 (bundler rapide avec HMR optimisé)
- **Package Manager** : PNPM 10.15.0

### UI & Styling
- **shadcn/ui** : Système de composants Radix UI + Tailwind
- **TailwindCSS** : 4.1.13 avec plugin Vite (@tailwindcss/vite)
- **Radix UI** : 12+ composants primitifs accessibles
- **Lucide React** : 0.468.0 (icônes modernes)
- **Framer Motion** : 12.23.12 (animations fluides)

### État & Données
- **TanStack Query** : v5.87.4 (gestion état serveur)
- **TanStack Form** : v1.20.0 (gestion formulaires)
- **Better Auth** : 1.3.10 avec hooks React

### Navigation & Utils
- **React Router** : 7.9.1 (routing moderne)
- **Class Variance Authority** : 0.7.1 (variants composants)
- **clsx + tailwind-merge** : Fusion classes CSS intelligente
- **Sonner** : 1.7.4 (toasts/notifications)

### Markdown & Math
- **React Markdown** : 10.1.0 (rendu markdown)
- **KaTeX** : 0.16.22 (formules mathématiques)
- **remark-math + rehype-katex** : Pipeline math markdown

## 🏗️ Architecture & Structure

### Organisation du Code
```
src/
├── components/           # Composants réutilisables
│   ├── ui/              # shadcn/ui components (SEULE source UI - 34 composants)
│   ├── auth/            # Composants authentification
│   ├── modals/          # Modals création/édition enfants
│   ├── tables/          # Tables de données
│   └── Layout/          # Composants layout (sidebar, navigation)
├── pages/               # Pages React Router (10 pages)
├── hooks/               # Hooks personnalisés React (14 hooks)
├── lib/                 # Configurations (auth, api, queryClient)
├── services/            # Services API (establishment, pronote)
├── types/               # Types TypeScript globaux
├── utils/               # Fonctions utilitaires (11 fichiers)
├── constants/           # Constantes (messages, schoolLevels)
├── App.tsx              # Composant racine
└── main.tsx             # Point d'entrée Vite
```

### Configuration TypeScript Strict
```typescript
// tsconfig.json - Mode strict activé
{
  "strict": true,
  "noImplicitAny": true,
  "strictNullChecks": true,
  "noUncheckedIndexedAccess": true,
  "exactOptionalPropertyTypes": true,
  "noImplicitReturns": true,
  "noFallthroughCasesInSwitch": true
}
```

### Alias de Chemins
```typescript
// Alias configurés dans vite.config.ts et tsconfig.json
"@/*": ["src/*"]
"@/components/*": ["src/components/*"]
"@/utils/*": ["src/utils/*"]
"@/hooks/*": ["src/hooks/*"]
"@/types/*": ["src/types/*"]
"@/pages/*": ["src/pages/*"]
"@/constants/*": ["src/constants/*"]
"@shared-types": ["../shared-types"]
```

## 🔒 Règles de Développement

### 1. UI Components - Priorité shadcn/ui
```typescript
// ✅ PRIORITÉ 1 : shadcn/ui components obligatoires
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

<Button variant="default" size="lg">Valider</Button>
<Card className="w-full max-w-md">
  <CardHeader>Titre</CardHeader>
  <CardContent>Contenu</CardContent>
</Card>
```

```typescript
// ✅ PRIORITÉ 2 : TailwindCSS 4.x classes si shadcn/ui insuffisant
<div className="bg-background text-foreground border border-border rounded-lg p-4">
  <div className="flex items-center justify-between gap-4">
    <span className="text-sm font-medium">Label</span>
  </div>
</div>
```

```typescript
// ❌ INTERDIT : CSS custom, classes inventées, styles inline
<button style={{ backgroundColor: 'blue' }}>
<div className="custom-card-style">
```

### 2. TypeScript Strict - Zero Compromis
```typescript
// ✅ CORRECT : Types explicites, gestion null/undefined
interface UserFormData {
  name: string;
  email: string;
  age?: number;
}

async function handleUser(user: UserFormData | null): Promise<ProcessedUser> {
  if (!user) {
    throw new ValidationError('User data is required');
  }
  
  return await processValidUser(user);
}
```

```typescript
// ❌ INTERDIT : any, types partiels, null non-géré
async function handleUser(user: any) {
  return await processValidUser(user); // Crash possible
}
```

### 3. Gestion d'État Moderne
```typescript
// ✅ TanStack Query pour données serveur
import { useQuery, useMutation } from '@tanstack/react-query'

const { data: users, isLoading, error } = useQuery({
  queryKey: ['users'],
  queryFn: fetchUsers,
  staleTime: 5 * 60 * 1000 // 5 minutes cache
});

const updateUserMutation = useMutation({
  mutationFn: updateUser,
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['users'] });
  }
});
```

```typescript
// ✅ TanStack Form pour formulaires
import { useForm } from '@tanstack/react-form'

const form = useForm({
  defaultValues: { name: '', email: '' },
  onSubmit: async ({ value }) => {
    await updateUserMutation.mutateAsync(value);
  }
});
```

### 4. Authentification Better Auth
```typescript
// ✅ Configuration client Better Auth
import { useUser, useIsAuthenticated, signIn, signOut } from '@/lib/auth-hooks'

function ProfileComponent() {
  const user = useUser(); // User | null
  const isAuthenticated = useIsAuthenticated(); // boolean
  
  if (!isAuthenticated) {
    return <LoginForm onLogin={() => signIn.email({ email, password })} />;
  }
  
  return (
    <div>
      <h1>Bonjour {user?.name}</h1>
      <Button onClick={() => signOut()}>Déconnexion</Button>
    </div>
  );
}
```

## 🔧 Configuration Vite

**Build Production:** Target ES2022, esbuild minify, code splitting optimisé (vendor, ui, auth, editor chunks)
**Proxy API:** Port 5173 → Backend 3000, SSE support pour `/api/chat/stream`, timeout 60s pour `/api`
**Détails:** Voir `vite.config.ts` pour configuration complète

## 📚 Documentation Locale

**Dossier `docs/`** (non versionné Git, local uniquement) :
- Documentation technique détaillée (DESIGN-SYSTEM.md, guides, audits)
- Analyses et optimisations du projet
- Documentation de référence technique

**Pratique** :
- Documentation technique → `docs/` (exclus Git via `.gitignore`)
- Seuls `CLAUDE.md` et `README.md` restent à la racine des projets
- Ne PAS commiter `docs/` - documentation locale uniquement pour développement

## 🚨 Standards de Qualité

### Validation Pré-Commit OBLIGATOIRE
```bash
# ✅ Zero erreur TypeScript strict
pnpm typecheck ✅

# ✅ Zero warnings ESLint (mode CI)
pnpm lint:ci ✅

# ✅ Build production successful
pnpm build ✅

# ✅ Documentation officielle vérifiée
# ✅ Patterns shadcn/ui respectés
# ✅ Types strict mode validés
```

### Métriques de Performance
- **Bundle size** : <500KB initial, <2MB total
- **Load time** : <1.5s sur WiFi, <3s sur 3G
- **Lighthouse** : >90 Performance, >95 Accessibility
- **Core Web Vitals** : LCP <2.5s, FID <100ms, CLS <0.1

## 📚 Sources Officielles OBLIGATOIRES

### UI & Styling
- **shadcn/ui** : https://ui.shadcn.com/docs/components - Composants UI et patterns
- **TailwindCSS 4.x** : https://tailwindcss.com/docs - Classes utilitaires responsive
- **Radix UI** : https://www.radix-ui.com/primitives - Primitives accessibles

### Framework & État
- **React 19** : https://react.dev/reference/react - Hooks modernes, Concurrent features
- **TanStack Query v5** : https://tanstack.com/query/latest - État serveur et cache
- **React Router 7** : https://reactrouter.com - Navigation et data loading

### Auth & Utils
- **Better Auth** : https://better-auth.com/docs - Patterns client-side et hooks React
- **Vite 7** : https://vitejs.dev/guide - Configuration build et proxy

---

## 🧠 Extended Thinking - Problèmes Complexes

**Niveaux de réflexion pour décisions Frontend:**

| Niveau | Usage | Exemple Frontend |
|--------|-------|------------------|
| `"think"` (~4K tokens) | Analyse multi-composants | Component hierarchy optimization |
| `"think hard"` (~10K tokens) | Architecture UI | State management refactoring |
| `"think harder"` (~20K tokens) | Redesign complet | Zustand vs TanStack Query migration |
| `"ultrathink"` (~32K tokens) | Transformation majeure | React 19 → Svelte 5 migration |

**Prompts recommandés:**
```bash
"think about refactoring ChatInterface to separate concerns"
"think hard about optimizing re-renders in conversation list with >100 messages"
"think harder about redesigning component hierarchy for code splitting"
```

**📚 Guide complet:** Voir `/docs/EXTENDED_THINKING.md` pour:
- Quand utiliser chaque niveau
- Examples Tom Frontend spécifiques
- Best practices et coûts token

---

## 🎓 Mission Critique

Cette interface sert de **VRAIES familles françaises** pour l'éducation de leurs enfants.

**Objectifs Qualité** :
- **Excellence UX** : Interface intuitive et accessible
- **Performance** : Chargement rapide et interactions fluides  
- **Sécurité** : Authentification robuste et données protégées
- **Fiabilité** : Zero crash, gestion d'erreurs complète
- **Accessibilité** : WCAG 2.1 AA minimum

**Standards Non-Négociables** :
- TypeScript strict mode sans exception
- shadcn/ui components exclusivement
- Zero warnings ESLint en CI
- Build production sans erreurs
- Tests fonctionnels complets (futur)