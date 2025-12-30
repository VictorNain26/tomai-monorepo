# Tom Client - Frontend React

Frontend React 19 de la plateforme de tutorat Tom. Voir `CLAUDE.md` pour les règles de développement détaillées.

## Stack

- **React** : 19 + TypeScript 5.9 strict
- **Vite** : 7 avec proxy API
- **UI** : shadcn/ui + TailwindCSS 4
- **État** : TanStack Query 5 + TanStack Form 1
- **Auth** : Better Auth
- **Routing** : React Router 7

## Démarrage

```bash
# Installation
pnpm install

# Développement (port 5173)
pnpm dev

# Validation (obligatoire avant commit)
pnpm validate

# Build production
pnpm build
```

## Variables d'environnement

### Développement (.env.development)

```env
VITE_API_URL=http://localhost:3000
VITE_BETTER_AUTH_URL=http://localhost:3000
VITE_ENVIRONMENT=development
```

### Production (.env.production)

```env
VITE_API_URL=https://tomai-api.koyeb.app
VITE_BETTER_AUTH_URL=https://tomai-api.koyeb.app
VITE_ENVIRONMENT=production
```

## Déploiement Vercel

Configuration automatique via `vercel.json` :

```json
{
  "installCommand": "pnpm install",
  "buildCommand": "pnpm build",
  "outputDirectory": "dist"
}
```

Variables requises dans le dashboard Vercel :
- `VITE_API_URL` : URL du backend
- `VITE_BETTER_AUTH_URL` : URL Better Auth (identique)
- `VITE_ENVIRONMENT` : `production`

## Configuration CORS backend

Le backend doit autoriser ce frontend :

```typescript
// server/src/app.ts
.use(cors({
  origin: [
    'https://app.tomtuteur.fr',     // Production
    'http://localhost:5173'          // Développement
  ],
  credentials: true
}))
```

## Troubleshooting

### Erreur CORS

Vérifier que le backend autorise l'origine du frontend dans sa config CORS.

### Boucle de redirection Better Auth

Vérifier que `VITE_API_URL` et `VITE_BETTER_AUTH_URL` sont identiques.

### Erreur proxy développement

Vérifier que le backend tourne sur le port configuré dans `vite.config.ts`.
