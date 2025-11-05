# Guide Production-Ready - TomAI Monorepo

**Checklist complète pour déployer landing + app sur Vercel avec sous-domaines**

---

## 🎯 Stratégie Domaines et Sous-domaines

### Architecture Recommandée

```
tomai.fr              → Landing Page (Marketing)
www.tomai.fr          → Redirect vers tomai.fr
app.tomai.fr          → Application Client (Authentifiée)
```

### Configuration DNS Requise

Chez votre registrar de domaine (ex: OVH, Gandi, Cloudflare) :

| Type | Name | Value | TTL | Description |
|------|------|-------|-----|-------------|
| A | @ | 76.76.21.21 | 3600 | Apex domain vers Vercel |
| CNAME | www | cname.vercel-dns.com | 3600 | Redirect www → apex |
| CNAME | app | cname.vercel-dns.com | 3600 | Sous-domaine application |

**Vérification DNS** :
```bash
# Vérifier A record
dig tomai.fr A

# Vérifier CNAME
dig www.tomai.fr CNAME
dig app.tomai.fr CNAME
```

---

## 🔧 Modifications Code Nécessaires - Landing Page

### Problème Actuel

❌ **URLs hardcodées** dans 3 fichiers :
- `apps/landing/components/sections/hero.tsx` (ligne 35)
- `apps/landing/components/sections/cta.tsx` (ligne 18)
- `apps/landing/components/sections/pricing.tsx` (lignes 20, 38, 55)

**Toutes pointent vers** : `http://localhost:5173/auth/register`

### Solution : Variables d'Environnement

✅ **Fichiers créés** :
1. `.env.example` - Template avec documentation
2. `.env.local` - Development (git-ignored)
3. `lib/urls.ts` - Helper centralisé pour les URLs

### Modifications à Faire

#### 1. Mettre à jour `hero.tsx`

**Ajouter l'import** (après ligne 3) :
```typescript
import { AppRoutes } from "@/lib/urls";
```

**Remplacer** (ligne 35) :
```typescript
// AVANT
<Link href="http://localhost:5173/auth/register" className="w-full sm:w-auto">

// APRÈS
<Link href={AppRoutes.register} className="w-full sm:w-auto">
```

#### 2. Mettre à jour `cta.tsx`

**Ajouter l'import** :
```typescript
import { AppRoutes } from "@/lib/urls";
```

**Remplacer** (ligne 18) :
```typescript
// AVANT
<Link href="http://localhost:5173/auth/register" className="w-full sm:w-auto">

// APRÈS
<Link href={AppRoutes.register} className="w-full sm:w-auto">
```

#### 3. Mettre à jour `pricing.tsx`

**Ajouter l'import** :
```typescript
import { AppRoutes } from "@/lib/urls";
```

**Remplacer dans l'objet `plans`** (3 occurrences aux lignes 20, 38, 55) :
```typescript
// AVANT
href: "http://localhost:5173/auth/register",

// APRÈS
href: AppRoutes.register,
```

---

## 📝 Configuration Vercel - Landing Page

### Étape 1 : Déployer le Projet

**Via Vercel Dashboard** :
1. Aller sur https://vercel.com/new
2. Import repository : `tomai-monorepo`
3. **Project Name** : `tomai-landing`
4. **Framework Preset** : Next.js (auto-détecté)
5. **Root Directory** : `apps/landing`
6. **Build Command** : `turbo build` (auto-détecté)
7. **Output Directory** : `.next` (auto-détecté)
8. **Install Command** : `pnpm install` (auto-détecté)

### Étape 2 : Variables d'Environnement

Dans **Vercel Dashboard** > Project Settings > Environment Variables :

```bash
# Production
NEXT_PUBLIC_APP_URL=https://app.tomai.fr

# Preview (optionnel)
NEXT_PUBLIC_APP_URL=https://app-preview.tomai.fr
```

### Étape 3 : Configurer le Domaine

1. **Settings** > **Domains**
2. **Add Domain** : `tomai.fr`
3. **Add Domain** : `www.tomai.fr` (avec redirect vers apex)
4. Vercel vous guidera pour la configuration DNS

---

## 📝 Configuration Vercel - Application (apps/app)

### Étape 1 : Déployer le Projet

**Via Vercel Dashboard** :
1. Aller sur https://vercel.com/new
2. Import **SAME repository** : `tomai-monorepo`
3. **Project Name** : `tomai-app`
4. **Framework Preset** : Vite (auto-détecté via package.json)
5. **Root Directory** : `apps/app` ← **Maintenant visible !**
6. **Build Command** : `turbo build` ou `vite build`
7. **Output Directory** : `dist`
8. **Install Command** : `pnpm install`

### Étape 2 : Variables d'Environnement

**À configurer selon votre backend** :

```bash
# API Backend
VITE_API_URL=https://api.tomai.fr

# Better Auth
VITE_BETTER_AUTH_URL=https://api.tomai.fr/api/auth

# Google OAuth (depuis votre console Google)
VITE_GOOGLE_CLIENT_ID=votre-client-id

# Autres variables selon .env.example de apps/app
```

### Étape 3 : Configurer le Sous-domaine

1. **Settings** > **Domains**
2. **Add Domain** : `app.tomai.fr`
3. Vercel vous guidera pour la configuration DNS CNAME

---

## 🔗 Configuration des Redirections

### Dans apps/landing/vercel.json

**Déjà configuré** pour sécurité :
```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" }
      ]
    }
  ],
  "redirects": [
    {
      "source": "/home",
      "destination": "/",
      "permanent": true
    }
  ]
}
```

**Optionnel - Ajouter redirect www → apex** :
```json
{
  "redirects": [
    {
      "source": "/home",
      "destination": "/",
      "permanent": true
    },
    {
      "source": "/:path*",
      "has": [{ "type": "host", "value": "www.tomai.fr" }],
      "destination": "https://tomai.fr/:path*",
      "permanent": true
    }
  ]
}
```

---

## ✅ Checklist Production Readiness

### Landing Page (apps/landing)

- [x] Variables d'environnement créées (.env.example, .env.local)
- [x] Helper URLs créé (lib/urls.ts)
- [ ] hero.tsx mis à jour avec AppRoutes.register
- [ ] cta.tsx mis à jour avec AppRoutes.register
- [ ] pricing.tsx mis à jour avec AppRoutes.register (3 occurrences)
- [x] vercel.json configuré avec headers sécurité
- [ ] Build production testé : `pnpm build`
- [ ] TypeScript validé : `pnpm typecheck`
- [ ] ESLint passé : `pnpm lint`
- [ ] Projet Vercel créé (tomai-landing)
- [ ] Variables env configurées sur Vercel
- [ ] Domaine apex configuré (tomai.fr)
- [ ] Domaine www configuré (www.tomai.fr)
- [ ] DNS A record pointant vers 76.76.21.21
- [ ] DNS CNAME www pointant vers cname.vercel-dns.com
- [ ] Certificat SSL actif (automatique Vercel)

### Application (apps/app)

- [ ] Projet Vercel créé (tomai-app)
- [ ] Root Directory `apps/app` sélectionné ✅ (fix gitlink appliqué)
- [ ] Variables env configurées sur Vercel
- [ ] Sous-domaine app.tomai.fr configuré
- [ ] DNS CNAME app pointant vers cname.vercel-dns.com
- [ ] Backend API accessible depuis app
- [ ] Better Auth configuré avec URLs production
- [ ] Google OAuth redirect URI mis à jour
- [ ] Build production testé
- [ ] Certificat SSL actif

### Cross-Domain Communication

- [ ] CORS configuré sur backend pour app.tomai.fr
- [ ] Cookies domaine configuré (.tomai.fr)
- [ ] Session persistante entre landing et app
- [ ] Test redirection landing → app fonctionnelle

---

## 🧪 Tests de Validation

### Test Local (Avant Déploiement)

```bash
# Dans apps/landing
pnpm build
pnpm start

# Vérifier que les liens pointent vers localhost:5173
curl http://localhost:3000 | grep -o "href=\"[^\"]*register"

# Dans apps/app
pnpm build
pnpm preview

# Tester authentification locale
```

### Test Production (Après Déploiement)

```bash
# Vérifier DNS
dig tomai.fr A
dig www.tomai.fr CNAME
dig app.tomai.fr CNAME

# Vérifier SSL
curl -I https://tomai.fr
curl -I https://app.tomai.fr

# Vérifier redirections
curl -I https://www.tomai.fr  # Doit redirect vers tomai.fr

# Vérifier liens CTA
curl https://tomai.fr | grep -o "href=\"[^\"]*register"
# Doit afficher : href="https://app.tomai.fr/auth/register"
```

---

## 🔄 Workflow de Déploiement Complet

### Ordre Recommandé

1. **Préparer le Code** (Ce document)
   - ✅ Modifier les 3 fichiers landing pour utiliser AppRoutes
   - Commit + push vers GitHub

2. **Déployer Backend** (si pas déjà fait)
   - Configurer API sur infrastructure (Koyeb, Railway, etc.)
   - Noter l'URL API pour variables env

3. **Déployer Application (apps/app)**
   - Créer projet Vercel
   - Configurer variables env (API_URL, AUTH, etc.)
   - Configurer sous-domaine app.tomai.fr
   - Test : https://app.tomai.fr/auth/register

4. **Déployer Landing (apps/landing)**
   - Créer projet Vercel
   - Configurer variable env : NEXT_PUBLIC_APP_URL=https://app.tomai.fr
   - Configurer domaines tomai.fr + www.tomai.fr
   - Test : Cliquer CTA → Redirige vers app.tomai.fr

5. **Vérifier Communication Cross-Domain**
   - CORS backend accepte app.tomai.fr
   - Cookies session fonctionnels
   - OAuth redirects correctement configurés

---

## 📚 Ressources Officielles

- **Vercel Monorepos** : https://vercel.com/docs/monorepos
- **Vercel Domains** : https://vercel.com/docs/projects/domains
- **Next.js Environment Variables** : https://nextjs.org/docs/app/building-your-application/configuring/environment-variables

---

## 🎯 Résumé Exécutif

**Problème** : Landing page contient 5 URLs localhost hardcodées

**Solution** :
1. Créer système variables env (`lib/urls.ts`)
2. Remplacer URLs dans 3 composants
3. Configurer 2 projets Vercel (landing + app)
4. Configurer DNS (A record + 2 CNAME)
5. Tester redirections production

**Temps estimé** : 30-45 minutes (avec domaine déjà acheté)

**Résultat** : Landing page → app.tomai.fr fonctionnel en production
