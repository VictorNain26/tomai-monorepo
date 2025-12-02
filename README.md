# Tom Monorepo

**Plateforme de tutorat socratique adaptatif** - Architecture Turborepo unifiée

## 🚀 Démarrage Rapide

```bash
# Installation
pnpm install

# Développement (lance landing + app en parallèle)
pnpm dev
# → Landing: http://localhost:3001
# → App métier: http://localhost:5173

# Build production
pnpm build

# Validation complète
pnpm validate
```

## 📁 Structure

```
tomai-monorepo/
├── apps/
│   ├── landing/     # Site vitrine Next.js 15 (port 3001)
│   └── app/         # Application métier Vite (port 5173)
├── packages/
│   ├── ui/          # Composants UI partagés
│   ├── types/       # Types TypeScript partagés
│   └── config/      # Configurations partagées
└── CLAUDE.md        # Documentation complète développeur
```

## 🎯 Apps

### Landing (Site Vitrine)
- **URL** : http://localhost:3001
- **Tech** : Next.js 15 + TailwindCSS 4
- **Features** : Homepage SEO, Static Generation, Design system moderne

### App Métier (Tom-client)
- **URL** : http://localhost:5173
- **Tech** : Vite 7 + React 19 + React Router 7
- **Features** : Chat SSE, Better Auth, Pronote, Gamification

## 📚 Documentation

- **[CLAUDE.md](./CLAUDE.md)** - Guide développeur complet
- **[MIGRATION_SUCCESS.md](./MIGRATION_SUCCESS.md)** - Rapport migration
- **[apps/app/CLAUDE.md](./apps/app/CLAUDE.md)** - Documentation app métier

## ⚡ Commandes

```bash
# Développement
pnpm dev              # Tous les apps
pnpm dev:landing      # Landing seulement
pnpm dev:app          # App métier seulement

# Build
pnpm build            # Build production complet
pnpm build:landing    # Landing seulement
pnpm build:app        # App métier seulement

# Validation
pnpm typecheck        # TypeScript strict
pnpm lint             # ESLint
pnpm validate         # typecheck + lint

# Maintenance
pnpm clean            # Clean builds
```

## 🔧 Stack Technique

- **Monorepo** : Turborepo 2.6.0
- **Package Manager** : PNPM 10.15.0
- **Node.js** : ≥18
- **TypeScript** : 5.9.2 (strict mode)
- **Landing** : Next.js 15, TailwindCSS 4, Framer Motion
- **App** : Vite 7, React 19, shadcn/ui, Better Auth, TanStack Query

## ✅ Statut

- ✅ Build production : Successful (landing + app)
- ✅ TypeScript : Strict mode, zero erreurs
- ✅ ESLint : Warnings mineurs (non-bloquants)
- ✅ Dev servers : Opérationnels (1831ms landing, instantané app)

## 🎓 Mission

Plateforme servant de **vraies familles françaises** pour l'éducation de leurs enfants (CP à Terminale). Excellence technique, performance optimisée, sécurité RGPD.

---

**Créé avec** : Claude Code | **Méthodologie** : Evidence-based architecture | **Durée** : 2 heures
