# Web Tom

App web **role-aware** Next.js 16 + TailwindCSS 4 + shadcn/ui. Produit authentifié (parents, élèves, établissements) — distinct de la landing marketing.

## Commandes

```bash
pnpm dev          # Port 3002
pnpm typecheck    # TypeScript strict
pnpm lint         # ESLint zero warnings
pnpm build        # Production
```

## Rôle dans l'architecture

- **`apps/mobile`** : produit mobile natif (Expo) — parents + élèves.
- **`apps/web`** (cet app) : produit web — mêmes rôles + futur **établissement** (B2B).
- **`apps/landing`** : vitrine marketing/SEO uniquement (pas le produit).
- **`apps/server`** : backend Elysia, source unique de vérité (auth + API).

Le web ne partage **pas** ses composants avec le mobile (primitives RN ≠ DOM). Il partage le **backend** (`@repo/api`) et le **design system au niveau tokens** (`@repo/tokens`, preset Tailwind v4 consommé aussi par NativeWind côté mobile). React Native Web n'est volontairement pas utilisé (maintenance-only en 2026).

## Architecture

- **`app/`** : App Router Next.js, routing par rôle via segments :
  - `app/login/` : connexion/inscription (email + mot de passe).
  - `app/parent/`, `app/student/`, `app/school/` : espaces par rôle, chacun avec son `layout.tsx` (= `DashboardShell`) + pages.
- **`components/ui/`** : shadcn/ui uniquement (Button, Card…).
- **`components/`** : composants applicatifs (`DashboardShell`, `LogoutButton`, `ThemeProvider`).
- **`lib/`** : `auth-client.ts` (Better Auth), `roles.ts` (type `Role` + routing), `utils.ts` (`cn`).
- **`proxy.ts`** : garde d'auth (convention Next.js 16, ex-`middleware`) — redirige vers `/login` si pas de session. Équivalent web de `Stack.Protected`.

## Auth (Better Auth — client séparé)

Le serveur d'auth est **Elysia** (`apps/server`), pas Next.js. Le web est un **client cross-origin** :

- `lib/auth-client.ts` : `createAuthClient({ baseURL: NEXT_PUBLIC_SERVER_URL })` from `better-auth/react`. **Pas** de plugin `nextCookies` (réservé au Better Auth hébergé dans Next.js).
- En **dev**, le cookie de session est host-only sur `localhost` → partagé entre `:3000` (api) et `:3002` (web). CORS serveur autorise `:3002` avec `credentials: true` (cf. `app.config.ts` + `auth.ts`, dev defaults).
- `proxy.ts` interroge `/api/auth/get-session` en transférant le cookie.
- Rôle : `'parent' | 'student'` côté serveur aujourd'hui ; `'school'` viendra avec le B2B.

## Conventions

- **JAMAIS** de composant UI custom → shadcn/ui (`@/components/ui/`).
- **JAMAIS** de CSS custom ni style inline → Tailwind + tokens `@repo/tokens`.
- Pas de logique métier dans le front → tout passe par le serveur via `@repo/api`.
- TypeScript strict, zéro `any`. React 19 (pas de `forwardRef`).
- Design **template** assumé — design final plus tard.

## Variables d'environnement

| Var | Usage | Défaut dev |
|-----|-------|-----------|
| `NEXT_PUBLIC_SERVER_URL` | URL du backend Elysia (auth + API) | `http://localhost:3000` |

## À brancher (suite)

- **Eden Treaty** (`@repo/api`) dans `lib/api.ts` — quand un écran consommera une vraie route (pour l'instant les dashboards sont des templates statiques → YAGNI).
- **Google OAuth** web (`signIn.social`) — nécessite `GOOGLE_CLIENT_ID/SECRET` côté serveur + flux redirect.
- **Espace établissement** (`/school`) — placeholder ; sera développé en console B2B (classes, reporting) avec un rôle `school` côté serveur.

## Sources officielles

[Next.js 16](https://nextjs.org/docs) · [shadcn/ui](https://ui.shadcn.com) · [TailwindCSS 4](https://tailwindcss.com) · [Better Auth](https://better-auth.com) · [Better Auth Next.js](https://better-auth.com/docs/integrations/next)
