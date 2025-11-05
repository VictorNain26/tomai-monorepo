# Guide de Déploiement Vercel - TomAI Monorepo

**Documentation officielle basée sur https://vercel.com/docs/monorepos**

## 🎯 Stratégie Monorepo avec Domaines Multiples

### Architecture Recommandée par Vercel

Pour un monorepo comme `tomai-monorepo` contenant plusieurs applications, Vercel recommande de créer **UN PROJET VERCEL PAR APPLICATION**.

**Structure actuelle du monorepo** :
```
tomai-monorepo/
├── apps/
│   ├── landing/      → Projet Vercel 1 (Landing Page)
│   └── app/          → Projet Vercel 2 (Application Client)
└── packages/
    └── ui/           → Partagé entre les projets
```

**Résultat sur Vercel** :
- **Projet 1** : `tomai-landing` → domaine `www.tomai.fr`
- **Projet 2** : `tomai-app` → domaine `app.tomai.fr`

---

## 📊 Mapping Monorepo → Projets Vercel

| Repository | Root Directory | Projet Vercel | Domaine Suggéré |
|-----------|---------------|---------------|-----------------|
| `tomai-monorepo` | `apps/landing` | `tomai-landing` | `www.tomai.fr` ou `tomai.fr` |
| `tomai-monorepo` | `apps/app` | `tomai-app` | `app.tomai.fr` |

**Avantages de cette approche** :
- ✅ Chaque app a sa propre URL de déploiement
- ✅ Configurations indépendantes (build, env vars)
- ✅ Domaines personnalisés distincts
- ✅ Déploiements isolés (un commit peut déployer une seule app)

---

## 🚀 Déploiement Détaillé - Landing Page

### Option 1 : Via Vercel Dashboard (Recommandé pour débutants)

#### Étape 1 : Créer le Projet Landing
1. Aller sur https://vercel.com/new
2. **Import Git Repository** : Sélectionner `tomai-monorepo`
3. **Configure Project** :
   ```yaml
   Project Name: tomai-landing
   Framework Preset: Next.js (auto-détecté)
   Root Directory: apps/landing  # CRUCIAL
   Build Command: turbo build (auto-détecté depuis vercel.json)
   Output Directory: .next (auto-détecté)
   Install Command: pnpm install (auto-détecté)
   ```
4. **Deploy**

#### Étape 2 : Configurer le Domaine
1. Aller dans **Project Settings** > **Domains**
2. Ajouter votre domaine : `tomai.fr` ou `www.tomai.fr`
3. Configurer DNS chez votre registrar (voir section DNS ci-dessous)

### Option 2 : Via Vercel CLI (Recommandé pour experts)

```bash
# Installation CLI
pnpm add -g vercel

# Depuis le root du monorepo
cd /home/ordiv/code/TomIA/tomai-monorepo

# Connexion Vercel
vercel login

# Déploiement Landing Page
cd apps/landing
vercel

# Prompts attendus :
# ? Set up and deploy? [Y/n] y
# ? Which scope? [Votre compte Vercel]
# ? Link to existing project? n
# ? What's your project's name? tomai-landing
# ? In which directory is your code located? ./ (car déjà dans apps/landing)

# Déploiement production
vercel --prod

# Ajouter domaine custom
vercel domains add tomai.fr
```

---

## 🌐 Configuration DNS pour Domaines Personnalisés

### Configuration Recommandée

**Pour domaine principal `tomai.fr`** :

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | @ | 76.76.21.21 | 3600 |
| CNAME | www | cname.vercel-dns.com | 3600 |

**Vérification DNS** :
```bash
# Vérifier configuration A record
dig tomai.fr A

# Vérifier configuration CNAME
dig www.tomai.fr CNAME
```

### Alternative : Utiliser les Nameservers Vercel

**Plus simple mais moins flexible** :
1. Dans Vercel Dashboard > Project > Domains
2. Cliquer sur "Use Vercel Nameservers"
3. Copier les nameservers fournis (ex: `ns1.vercel-dns.com`)
4. Remplacer les nameservers chez votre registrar

**Avantages** :
- ✅ Configuration automatique des DNS
- ✅ Gestion simplifiée des sous-domaines
- ✅ Certificat SSL automatique

---

## 🔄 Déploiement de l'Application Client (Futur)

### Quand vous serez prêt à déployer `apps/app`

**Étapes identiques mais avec** :
```yaml
Project Name: tomai-app
Root Directory: apps/app
Domaine: app.tomai.fr
```

**Configuration DNS pour sous-domaine** :
| Type | Name | Value | TTL |
|------|------|-------|-----|
| CNAME | app | cname.vercel-dns.com | 3600 |

---

## 🔗 Lier les Projets Vercel (Related Projects)

**Feature Vercel pour monorepos** : Lier jusqu'à 3 projets d'un même monorepo

**Avantages** :
- Navigation rapide entre projets dans le Dashboard
- Vue unifiée des déploiements
- Partage de contexte entre projets

**Configuration** :
1. Dashboard > Project Settings > Related Projects
2. Ajouter `tomai-app` comme projet lié à `tomai-landing`

---

## ⚡ Smart Build Optimization (Vercel)

**Feature automatique pour monorepos** :

> "Vercel automatically skips builds for projects in a monorepo that are unchanged by the commit"

**Exemple** :
- Commit modifie uniquement `apps/landing/components/hero.tsx`
- ✅ Vercel déploie **SEULEMENT** `tomai-landing`
- ❌ Vercel **SKIP** le build de `tomai-app` (non affecté)

**Économies** :
- Temps de build réduit de 70%+
- Coûts Vercel optimisés (moins de builds)

---

## 📊 Workflow Complet Multi-Domaines

### Scénario : Déployer Landing + App sur domaines séparés

```bash
# 1. Créer projet Landing
cd /home/ordiv/code/TomIA/tomai-monorepo/apps/landing
vercel --prod
vercel domains add tomai.fr

# 2. Créer projet App (plus tard)
cd ../app
vercel --prod
vercel domains add app.tomai.fr

# 3. Lier les projets dans Dashboard
# Settings > Related Projects > Add tomai-app

# 4. Configurer DNS
# A record: tomai.fr → 76.76.21.21
# CNAME: www.tomai.fr → cname.vercel-dns.com
# CNAME: app.tomai.fr → cname.vercel-dns.com
```

---

## 🎯 Stratégie de Domaines Recommandée

### Option 1 : Domaine Apex + Sous-domaine (Recommandé)
```
tomai.fr             → Landing Page (marketing)
www.tomai.fr         → Redirect vers tomai.fr
app.tomai.fr         → Application Client (authentifiée)
api.tomai.fr         → Backend API (futur)
docs.tomai.fr        → Documentation (futur)
```

### Option 2 : Domaines Séparés
```
tomai.fr             → Landing Page
tomai-app.com        → Application Client
```

**Recommandation** : **Option 1** (sous-domaines) pour cohérence de marque.

---

## ✅ Checklist Déploiement Landing Page

- [ ] Compte Vercel créé et connecté à GitHub
- [ ] Projet `tomai-landing` créé avec Root Directory `apps/landing`
- [ ] Build production successful sur Vercel
- [ ] Domaine `tomai.fr` acheté et accessible
- [ ] DNS configurés (A record + CNAME)
- [ ] Certificat SSL actif (automatique Vercel)
- [ ] Domaine custom accessible via HTTPS
- [ ] Web Analytics activé (Vercel Dashboard)
- [ ] Performance validée (Lighthouse > 95)

---

## 🔧 Configuration Avancée

### Variables d'Environnement par Projet

**Landing Page** (public, pas de secrets) :
```bash
# Vercel Dashboard > tomai-landing > Settings > Environment Variables
NEXT_PUBLIC_APP_URL=https://app.tomai.fr
NEXT_PUBLIC_API_URL=https://api.tomai.fr
```

**App Client** (avec secrets) :
```bash
# Vercel Dashboard > tomai-app > Settings > Environment Variables
DATABASE_URL=postgresql://...
NEXTAUTH_SECRET=...
GOOGLE_CLIENT_ID=...
```

### Preview Deployments par Branche

**Configuration automatique Vercel** :
- `main` branch → Production (`tomai.fr`)
- `staging` branch → Preview (`tomai-git-staging.vercel.app`)
- Pull Requests → Preview URLs uniques

---

## 📚 Sources Officielles

- **Monorepos Vercel** : https://vercel.com/docs/monorepos
- **Domains Configuration** : https://vercel.com/docs/projects/domains
- **Next.js on Vercel** : https://vercel.com/docs/frameworks/nextjs

---

## 🎓 Résumé Exécutif

**Pour ton cas TomAI** :

1. **Aujourd'hui** : Déployer `apps/landing` sur `tomai.fr`
   - 1 projet Vercel = 1 domaine
   - Build production validé (13.7 kB)
   - Prêt à déployer immédiatement

2. **Plus tard** : Déployer `apps/app` sur `app.tomai.fr`
   - 2ème projet Vercel indépendant
   - Même repository, Root Directory différent

3. **Gestion** : Les 2 projets coexistent dans le même monorepo
   - Smart Build Optimization automatique
   - Déploiements isolés par app
   - Domaines distincts configurés séparément

**Temps estimé déploiement** : 15 minutes pour landing page (avec domaine custom).
