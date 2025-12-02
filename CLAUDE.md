# CLAUDE.md - Tom Monorepo

**Monorepo Turborepo** unifiant le site vitrine (landing Next.js 15) et l'application métier (Vite + React Router 7).

## 🚨 RÈGLE ABSOLUE

**JAMAIS** inventer de solutions. **TOUJOURS** rechercher documentation officielle avant toute modification.

## 🏗️ Architecture Monorepo

```
tomai-monorepo/
├── apps/
│   ├── landing/          # Site vitrine Next.js 15 (port 3001)
│   │   ├── app/          # App Router Next.js
│   │   ├── package.json  # Next.js 15 + TailwindCSS 4
│   │   └── next.config.js
│   └── app/              # Application métier Vite (port 5173)
│       ├── src/          # Code Tom-client (inchangé)
│       ├── package.json  # Vite + React Router 7
│       └── vite.config.ts
├── packages/
│   ├── ui/               # Composants UI partagés (future)
│   ├── types/            # Types TypeScript partagés (future)
│   ├── config/           # Configs partagées (future)
│   ├── eslint-config/    # ESLint config
│   └── typescript-config/ # TypeScript config
├── turbo.json            # Configuration Turborepo
├── package.json          # Root package manager
└── pnpm-workspace.yaml   # PNPM workspaces
```

## ⚡ Commandes Monorepo

### Développement
```bash
# Démarrer tous les apps (landing + app métier)
pnpm dev

# Démarrer seulement le landing (port 3001)
pnpm dev:landing

# Démarrer seulement l'app métier (port 5173)
pnpm dev:app
```

### Build et Validation
```bash
# Build tous les apps
pnpm build

# Build landing seulement
pnpm build:landing

# Build app métier seulement
pnpm build:app

# Validation TypeScript complète
pnpm typecheck

# Linting complet
pnpm lint

# Validation complète (typecheck + lint)
pnpm validate
```

### Nettoyage
```bash
# Clean tous les builds
pnpm clean

# Clean landing
cd apps/landing && pnpm clean

# Clean app métier
cd apps/app && pnpm clean
```

## 🎯 Apps Individuelles

### 1. Landing (Site Vitrine)
- **Framework** : Next.js 15.5.6 (App Router)
- **Port** : 3001
- **URL Dev** : http://localhost:3001
- **Styling** : TailwindCSS 4.1.13 (via @import "tailwindcss")
- **Composants** : lucide-react icons + design system custom
- **SEO** : Métadonnées optimisées, Static Generation

**Commandes**:
```bash
cd apps/landing
pnpm dev              # Dev server port 3001
pnpm build            # Production build
pnpm typecheck        # TypeScript check
pnpm lint             # ESLint
```

**Fichiers clés**:
- `app/layout.tsx` - Root layout avec métadonnées SEO
- `app/page.tsx` - Homepage landing (hero, features, CTA)
- `app/globals.css` - TailwindCSS 4 @theme config
- `next.config.js` - Next.js configuration

### 2. App Métier (Tom-client)
- **Framework** : Vite 7.1.5 + React 19.1.1
- **Port** : 5173
- **URL Dev** : http://localhost:5173
- **Routing** : React Router 7.9.1
- **État** : TanStack Query 5.87.4 + TanStack Form 1.20.0
- **Auth** : Better Auth 1.3.10
- **Styling** : shadcn/ui + TailwindCSS 4.1.13

**Commandes**:
```bash
cd apps/app
pnpm dev              # Dev server port 5173
pnpm build            # Production build
pnpm validate         # typecheck + lint
pnpm typecheck        # TypeScript strict
pnpm lint             # ESLint
pnpm lint:fix         # Auto-fix ESLint
```

**Détails complets** : Voir `apps/app/CLAUDE.md`

## 🔒 Règles de Développement

### 1. Navigation Inter-Apps
```typescript
// ✅ CORRECT : Liens entre apps en développement
// Dans landing → app métier
<Link href="http://localhost:5173/auth/register">S'inscrire</Link>

// Dans app métier → landing
<a href="http://localhost:3001">Retour accueil</a>

// En production, utiliser URLs relatives ou domaines configurés
```

### 2. Packages Partagés (Future)
```typescript
// ✅ FUTUR : Import depuis packages partagés
import { Button } from '@repo/ui/button'
import type { User } from '@repo/types'
```

### 3. Standards TypeScript Strict
```typescript
// ✅ OBLIGATOIRE : TypeScript strict mode
// apps/landing : tsconfig.json avec strict: true
// apps/app : tsconfig.json avec strict: true (+ config existante)
```

### 4. ESLint Zero Warnings
```bash
# ✅ OBLIGATOIRE : CI mode zero warnings
pnpm lint --max-warnings 0
```

## 📚 Documentation Officielle

### Framework & Build
- **Turborepo** : https://turbo.build/repo/docs
- **Next.js 15** : https://nextjs.org/docs
- **Vite 7** : https://vitejs.dev/guide
- **PNPM Workspaces** : https://pnpm.io/workspaces

### Landing Stack
- **TailwindCSS 4** : https://tailwindcss.com/docs
- **Lucide Icons** : https://lucide.dev/icons
- **Next.js App Router** : https://nextjs.org/docs/app

### App Métier Stack
- **React Router 7** : https://reactrouter.com
- **TanStack Query** : https://tanstack.com/query/latest
- **shadcn/ui** : https://ui.shadcn.com/docs/components
- **Better Auth** : https://better-auth.com/docs

## 🚨 Standards de Qualité

### Validation Pré-Commit OBLIGATOIRE
```bash
# ✅ Zero erreur TypeScript
pnpm typecheck ✅

# ✅ Zero warnings ESLint (mode CI)
pnpm lint ✅

# ✅ Build production successful
pnpm build ✅

# ✅ Documentation officielle vérifiée
# ✅ Patterns framework respectés
```

### Métriques de Performance
- **Landing (Next.js)** : Lighthouse 95+, Static Generation, <1s FCP
- **App métier (Vite)** : Build <15MB, HMR <500ms, TypeScript strict

## 🔧 Troubleshooting

### Erreur: Module not found '@repo/ui'
```bash
# Les packages partagés ne sont pas encore créés
# Utiliser imports locaux pour le moment
```

### Erreur: Port already in use
```bash
# Landing (3001) ou App (5173) déjà démarrés
pkill -f "next dev"      # Kill landing
pkill -f "vite"          # Kill app métier
```

### Erreur: PNPM workspace resolution
```bash
# Réinstaller dépendances
rm -rf node_modules
pnpm install
```

## 🎓 Mission Critique

Cette plateforme sert de **VRAIES familles françaises**. Chaque ligne de code impacte l'éducation d'enfants réels.

**Objectifs** :
- **Excellence technique** : TypeScript strict + patterns modernes
- **Performance optimisée** : <1s landing, <1.5s app métier
- **SEO landing** : Static Generation, métadonnées complètes
- **Sécurité RGPD** : Protection données + authentification robuste
- **Pédagogie préservée** : IA Gemini socratique + méthodes adaptatives

**Standards Non-Négociables** :
- TypeScript strict mode sans exception (landing + app)
- Zero warnings ESLint en CI
- Build production sans erreurs
- Documentation officielle vérifiée avant toute modification
- Tests fonctionnels complets (futur)
