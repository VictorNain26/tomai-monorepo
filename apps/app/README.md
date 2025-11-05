# 🎓 TomAI Client - Frontend React Adaptatif

Frontend React 19 + TypeScript de TomAI : Interface utilisateur adaptive pour tutorat socratique personnalisé selon l'âge et le niveau scolaire (CP à Terminale).

## 🏗️ Stack Technique (2025)

### Frontend Moderne
- **Framework** : React 19 + TypeScript 5.9+ (Mode Strict)
- **Bundler** : Vite 7.1+ avec optimisations avancées et proxy API
- **State Management** : Zustand 4.5+ avec actions modulaires et persistance
- **UI/UX** : TailwindCSS + Framer Motion 11.0+ (animations fluides)
- **Routing** : React Router DOM v6 avec routes protégées

### Authentification & Communication
- **Auth System** : Better Auth 1.3+ avec hooks React intégrés
- **HTTP Client** : Axios avec intercepteurs et gestion d'erreur avancée
- **Real-time** : Chat interface avec backend Elysia.js

### Interface Adaptive
- **Age Detection** : UI s'adapte automatiquement (primaire/collège/lycée)
- **Multi-Role** : Parents (email/Google OAuth) + Étudiants (username)
- **Responsive** : Mobile-first pour tablettes éducatives

## 🚀 Démarrage Rapide

### Prérequis
- **Node.js** : 18+ (recommandé 20+)
- **Package Manager** : PNPM 10.15+ (obligatoire)
- **Backend** : TomAI Server (Elysia.js) en cours d'exécution

### Installation & Configuration
```bash
# 1. Installation des dépendances
pnpm install

# 2. Configuration environnement
cp .env.example .env.development
# Éditer .env.development avec vos variables

# 3. Variables d'environnement essentielles
VITE_API_URL=http://localhost:8000
VITE_BETTER_AUTH_URL=http://localhost:8000
VITE_ENVIRONMENT=development

# 4. Démarrage développement (hot-reload)
pnpm dev
# → Frontend disponible sur http://localhost:5173
# → Proxy automatique /api/* vers http://localhost:8000
```

### Validation & Build
```bash
# Validation complète (OBLIGATOIRE avant commit)
pnpm validate    # TypeScript + ESLint

# Build optimisé pour production
pnpm build

# Aperçu du build
pnpm preview
```

## 🌐 Architecture Séparée Frontend/Backend

Ce frontend React est conçu pour **hébergement indépendant** du backend Elysia.js.

### 🔧 Configuration Backend Requise

Le backend TomAI (Elysia.js) doit être configuré pour autoriser ce frontend :

```typescript
// server/src/app.ts - Configuration CORS
.use(cors({
  origin: [
    'https://tomai-client.vercel.app',      // Production
    'https://tomai-staging.vercel.app',     // Staging
    'http://localhost:5173'                 // Développement
  ],
  credentials: true  // OBLIGATOIRE pour Better Auth sessions
}))

// Better Auth configuration
.use(auth({
  trustedOrigins: [
    'https://tomai-client.vercel.app',
    'http://localhost:5173'
  ]
}))
```

### ⚙️ Variables d'Environnement

#### Développement (.env.development)
```env
# Backend API
VITE_API_URL=http://localhost:8000
VITE_PROXY_TARGET=http://localhost:8000

# Better Auth
VITE_BETTER_AUTH_URL=http://localhost:8000

# Application
VITE_ENVIRONMENT=development
VITE_DEBUG=true
VITE_APP_NAME=TomAI
```

#### Production (.env.production)
```env
# Backend API (votre URL de déploiement)
VITE_API_URL=https://tomai-api.onrender.com
VITE_BETTER_AUTH_URL=https://tomai-api.onrender.com

# Application
VITE_ENVIRONMENT=production
VITE_DEBUG=false
VITE_APP_NAME=TomAI
```

#### Staging (.env.staging)
```env
VITE_API_URL=https://tomai-api-staging.onrender.com
VITE_BETTER_AUTH_URL=https://tomai-api-staging.onrender.com
VITE_ENVIRONMENT=staging
VITE_DEBUG=true
```

## 🚀 Déploiement & Hébergement

### 🛠️ Préparation du Build

```bash
# 1. Validation complète (TypeScript + ESLint)
pnpm validate

# 2. Build optimisé selon environnement
pnpm build                  # Production
pnpm build:staging         # Staging

# 3. Test local du build
pnpm preview
```

## 🌐 Plateformes d'Hébergement

### 🥇 Vercel (Recommandé - Interface Éducative)

**Avantages pour TomAI** :
- **Performance** : Edge Network mondial, CDN optimisé
- **Gratuité** : 300GB/mois, idéal pour applications éducatives
- **Auto-Déploiement** : Intégration Git avec preview branches
- **Interface Simple** : Dashboard intuitif pour équipes éducatives

**🔧 Configuration Vercel** :

```bash
# Method 1: CLI (Développeurs)
npm i -g vercel
cd client/
vercel --prod

# Method 2: Dashboard (Recommandé)
# 1. Connecter GitHub → vercel.com
# 2. Import project → Select TomAI repo
# 3. Framework: Vite
# 4. Root Directory: client/
# 5. Build Command: pnpm build
# 6. Output Directory: dist
```

**📝 Variables d'Environnement** (Dashboard Vercel) :
```env
VITE_API_URL=https://tomai-api.onrender.com
VITE_BETTER_AUTH_URL=https://tomai-api.onrender.com  
VITE_ENVIRONMENT=production
VITE_APP_NAME=TomAI
```

### 🥈 Netlify (Alternative Stable)

**Avantages** :
- **Simplicité** : Configuration intuitive
- **Edge Functions** : Support pour redirections complexes
- **Form Handling** : Formulaires intégrés (feedback utilisateur)

**🔧 Configuration Netlify** :
```bash
# Method 1: CLI
npm i -g netlify-cli
cd client/
pnpm build
netlify deploy --prod --dir=dist

# Method 2: Dashboard
# 1. netlify.com → Connect GitHub
# 2. Site settings:
#    - Base directory: client/
#    - Build command: pnpm build  
#    - Publish directory: client/dist
```

**📁 Configuration Netlify** (netlify.toml déjà présent) :
```toml
[build]
  base = "client/"
  command = "pnpm build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

### 🥉 Cloudflare Pages (Performance Globale)

**Avantages** :
- **Performance Mondiale** : 320+ data centers
- **Worker Functions** : Logic edge computing
- **Sécurité DDoS** : Protection intégrée

**🔧 Configuration Cloudflare** :
```bash
# Method 1: Wrangler CLI
npm i -g wrangler  
cd client/
pnpm build
wrangler pages deploy dist

# Method 2: Dashboard
# 1. dash.cloudflare.com → Pages
# 2. Connect Git → Select repo
# 3. Framework preset: Vite
# 4. Root directory: client/
# 5. Build command: pnpm build
```

## ⚙️ Optimisations & Configuration Avancée

### 🔄 Proxy de Développement (vite.config.ts)

Configuration automatique pour développement local :

```typescript
server: {
  port: 5173,
  host: true,
  proxy: {
    '/api': {
      target: process.env.VITE_PROXY_TARGET || 'http://localhost:3000',
      changeOrigin: true,
      secure: false,
      headers: {
        'Origin': 'http://localhost:5173'
      }
    }
  }
}
```

### 🚀 Optimisations Build Avancées

**Code Splitting Intelligent** :
```typescript
manualChunks: {
  vendor: ['react', 'react-dom'],              // Core React
  ui: ['lucide-react', 'framer-motion'],       // UI Components  
  router: ['react-router-dom'],                // Routing
  utils: ['axios', 'zustand'],                 // Utilities
  auth: ['better-auth'],                       // Authentication
  editor: ['react-syntax-highlighter']         // Markdown/Code
}
```

**Performance Features** :
- **Asset Optimization** : Images/fonts avec hash pour cache long-terme
- **Tree Shaking** : Suppression automatique du code inutilisé
- **Bundle Analysis** : Chunks optimisés pour chargement rapide
- **Security Headers** : CSP, XSS, CORS protection intégrés

## 🔧 Troubleshooting & Debugging

### 🚨 Erreurs Communes & Solutions

#### CORS Errors (Fréquent)
```bash
Access to fetch at 'https://tomai-api.onrender.com' blocked by CORS policy
```
**🔧 Solution** : 
```typescript
// Backend server/src/app.ts - Vérifier configuration CORS
.use(cors({
  origin: ['https://votre-frontend.vercel.app', 'http://localhost:5173'],
  credentials: true  // CRITIQUE pour Better Auth
}))
```

#### Better Auth Redirect Loop
```bash  
Better Auth infinite redirect loop
```
**🔧 Solutions** :
1. Vérifier cohérence des URLs :
   ```env
   VITE_API_URL=https://tomai-api.onrender.com
   VITE_BETTER_AUTH_URL=https://tomai-api.onrender.com  # IDENTIQUE
   ```
2. Vérifier `lib/auth.ts` :
   ```typescript
   baseURL: import.meta.env.VITE_API_URL  // Doit correspondre
   ```

#### Build/Environment Errors
```bash
Environment variable 'VITE_API_URL' is not defined
```
**🔧 Solution** : Créer fichiers d'environnement complets :
```bash
# Créer tous les fichiers d'env nécessaires
cp .env.example .env.production
# Éditer avec les vraies valeurs de production
```

#### Proxy Development Issues
```bash
[vite] http proxy error: ECONNREFUSED
```
**🔧 Solution** :
1. Vérifier que le backend tourne sur port 3000
2. Vérifier `VITE_PROXY_TARGET` dans `.env.development`

## 📊 Performance & Monitoring

### 🎯 Métriques Cibles (Web Vitals)

**Core Web Vitals** :
- **First Contentful Paint** : <1.5s (excellent UX éducative)
- **Largest Contentful Paint** : <2.5s (adaptation mobile/tablette)  
- **Cumulative Layout Shift** : <0.1 (stabilité interface élève)
- **First Input Delay** : <100ms (réactivité chat)

**Bundle Performance** :
- **Initial Bundle** : <500KB (chargement rapide 3G)
- **Total Assets** : <2MB (optimisé tablettes éducatives)
- **Chunks** : 6 bundles optimisés (vendor, ui, auth, etc.)

### 📈 Monitoring & Analytics

**Développement** :
```bash
# Debug mode activé
VITE_DEBUG=true

# Console logs disponibles :
# "🔧 Axios configured with baseURL: ..."  
# "🚀 Better Auth client initialized"
# "💾 Zustand store hydrated"
```

**Production** :
- **Lighthouse CI** : Intégré dans build pipeline
- **Web Vitals** : Tracking automatique Core Web Vitals
- **Error Boundary** : Gestion React errors avec contexte utilisateur
- **Performance API** : Monitoring temps de chargement composants

## 🔒 Sécurité & Protection des Données

### 🛡️ Headers de Sécurité (Configurés)

**Protection XSS & Clickjacking** :
```http
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block  
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Content-Security-Policy: default-src 'self'
```

**Fichiers de Configuration** :
- `_headers` (Netlify) : Headers automatiques
- `vercel.json` : Configuration Vercel headers
- Nginx configuration disponible (`nginx.conf`)

### 🔐 Best Practices Sécurité

**Variables d'Environnement** :
- ✅ Variables frontend préfixées `VITE_*` uniquement
- ❌ Jamais de secrets/clés API dans le frontend
- ✅ HTTPS obligatoire en production (SSL auto)

**Authentification (Better Auth)** :
- ✅ Sessions server-side avec cookies HTTPOnly
- ✅ CSRF protection intégrée
- ✅ Tokens avec expiration automatique
- ✅ Google OAuth avec scope minimal

**Protection Données Étudiants** :
- ✅ Pas de stockage local de données sensibles
- ✅ Communication chiffrée (HTTPS/WSS)
- ✅ Validation côté serveur pour toutes les actions

## 🚀 CI/CD & Déploiement Automatisé

### 🔄 Pipeline de Déploiement

**GitHub Actions Exemple** (`.github/workflows/deploy-frontend.yml`) :
```yaml
name: Deploy TomAI Frontend
on:
  push:
    branches: [main, develop]
    paths: ['client/**']
    
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
        with:
          version: 10.15.0
          
      - name: Install dependencies
        run: cd client && pnpm install
        
      - name: Type checking
        run: cd client && pnpm typecheck
        
      - name: Lint checking  
        run: cd client && pnpm lint:ci
        
      - name: Build production
        run: cd client && pnpm build
        
      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          working-directory: client
```

### 🧪 Quality Gates
```bash
# Pipeline validation (OBLIGATOIRE)
pnpm validate:ci     # Zero warnings ESLint + TypeScript strict
pnpm build          # Build production success
```

---

## 🎓 Architecture Éducative TomAI

### 🧠 Interface Adaptive Intelligente

**Adaptation Automatique par Âge** :
```typescript
// Detection automatique du mode UI
type UIMode = 'primary' | 'college' | 'lycee';

// CP, CE1, CE2, CM1, CM2 → Interface simplifiée, couleurs vives
// 6ème, 5ème, 4ème, 3ème → Interface intermédiaire
// 2nde, 1ère, Terminale → Interface mature, professionnelle
```

**Composants Éducatifs** :
- `AdaptiveWelcomeSection` : Messages selon âge/niveau
- `AdaptiveQuickStats` : Métriques avec complexité adaptée
- `SubjectButtonsGrid` : Matières du curriculum français

### 🎯 Mission Éducative

Cette application frontend sert de **vraies familles françaises** avec des enfants scolarisés (CP à Terminale). Chaque composant, animation et interaction est pensé pour :

- **Engagement Pédagogique** : Interface motivante adaptée à l'âge
- **Autonomie Progressive** : Complexité croissante selon le niveau
- **Suivi Parental** : Dashboard transparent pour parents
- **Performance Éducative** : Temps de chargement optimisés pour tablettes éducatives

---

## 📞 Support & Assistance

### ✅ Checklist Pré-Déploiement

```bash
# 1. Validation locale
pnpm validate     # TypeScript + ESLint zero warnings
pnpm build        # Build production success
pnpm preview      # Test build local

# 2. Configuration environnement
✅ Variables VITE_* définies
✅ CORS backend configuré  
✅ Better Auth endpoints accessibles

# 3. Tests fonctionnels
✅ Login parent/étudiant
✅ Dashboard responsive
✅ Chat interface
✅ Gestion enfants (parents)
```

### 🆘 Aide & Debugging

**1. Logs de Build** : Examiner les erreurs TypeScript/ESLint
**2. Test Local** : `pnpm preview` pour tester build localement  
**3. Configuration CORS** : Vérifier autorisation backend
**4. Variables d'Environnement** : Valider toutes les variables `VITE_*`

### 🚀 Prêt pour Production !

**Frontend TomAI optimisé pour hébergement séparé** avec :
- ✅ React 19 + TypeScript strict
- ✅ Interface adaptive éducative  
- ✅ Better Auth intégré
- ✅ Performance Web Vitals optimisée
- ✅ Sécurité données étudiants
- ✅ CI/CD automatisé

**Cette interface impacte directement l'apprentissage des enfants français - Excellence technique requise !** 🎓