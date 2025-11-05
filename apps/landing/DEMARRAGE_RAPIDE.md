# 🚀 TomAI Landing - Guide de Démarrage Rapide

## Commandes Essentielles

### Développement
```bash
cd /home/ordiv/code/TomIA/tomai-monorepo/apps/landing

# Démarrer le serveur de développement
pnpm dev                    # Accessible sur http://localhost:3001

# Avec surveillance TypeScript
pnpm typecheck:watch
```

### Validation
```bash
# Validation complète (obligatoire avant commit)
pnpm validate               # TypeScript + ESLint

# Vérifications individuelles
pnpm typecheck              # TypeScript strict
pnpm lint                   # ESLint warnings autorisés
pnpm lint:ci                # ESLint zero warnings (CI)
```

### Build Production
```bash
# Build optimisé
pnpm build                  # Next.js static generation

# Preview build local
pnpm preview
```

---

## Structure du Site

### Pages Principales
- **Homepage** (`/`) - Landing page complète avec toutes les sections
- **Robots.txt** (`/robots.txt`) - SEO crawling
- **Sitemap** (`/sitemap.xml`) - SEO indexation

### Sections Homepage
1. **Header** - Navigation sticky avec mobile menu
2. **Hero** - Value proposition + CTAs
3. **Features** - 6 fonctionnalités clés
4. **How It Works** - Méthode en 3 étapes
5. **Pricing** - 3 plans tarifaires
6. **Testimonials** - 3 témoignages clients
7. **CTA** - Appel à l'action final
8. **Footer** - Liens et informations légales

---

## Composants Disponibles

### Layout Components
- `Header` - Navigation complète
- `Footer` - Footer avec liens

### Section Components
- `Hero` - Section hero optimisée conversion
- `Features` - Grid de features cards
- `HowItWorks` - Steps timeline
- `Pricing` - Plans tarifs
- `Testimonials` - Social proof
- `CTA` - Final call-to-action

### UI Components
- `Button` - Variants: default, secondary, outline, ghost, link
- `Card` - Variants: default avec hover effects

---

## Design System

### Colors (TailwindCSS 4)
```
primary: #3B82F6        (Education Blue)
secondary: #F3F4F6      (Soft Gray)
muted: #6B7280          (Subtle text)
```

### Spacing Scale
```
Container: max-w-7xl
Section padding: py-20 sm:py-32
Card padding: p-6
```

### Typography
```
Font: Inter (Google Fonts)
Headings: font-bold tracking-tight
Body: text-muted-foreground
```

---

## Liens Navigation

### CTAs vers App Métier
- Connexion → `http://localhost:5173/auth/login`
- Inscription → `http://localhost:5173/auth/register`

### Ancres Internes
- `#features` - Section fonctionnalités
- `#how-it-works` - Comment ça marche
- `#pricing` - Tarifs
- `#testimonials` - Témoignages

---

## SEO Configuration

### Metadata
- Title: "TomAI - Assistant Pédagogique Socratique Adaptatif"
- Description: 160 caractères optimisés
- Open Graph + Twitter Card configurés
- Canonical URLs: https://tomai.fr

### Performance
- Static Site Generation activée
- Image optimization (AVIF, WebP)
- Font optimization (Inter)
- Code splitting automatique

---

## Troubleshooting

### Port déjà utilisé
```bash
pkill -f "next dev"        # Tuer processus existant
pnpm dev                   # Redémarrer
```

### Erreurs TypeScript
```bash
pnpm typecheck             # Vérifier erreurs
# Corriger puis rebuild
```

### Cache Next.js
```bash
pnpm clean                 # Nettoyer .next/
pnpm build                 # Rebuild complet
```

---

## Déploiement Production

### Vercel (Recommandé)
```bash
# 1. Pousser sur GitHub
git add .
git commit -m "feat: landing page production-ready"
git push

# 2. Connecter à Vercel
# → Import projet GitHub
# → Détecter Next.js automatique
# → Configurer variables environnement
# → Déployer
```

### Variables Environnement Production
```env
NEXT_PUBLIC_APP_URL=https://app.tomai.fr
```

---

## Prochaines Étapes

### Immediate
- [ ] Tests manuels responsive (mobile, tablet, desktop)
- [ ] Tests cross-browser (Chrome, Firefox, Safari)
- [ ] Validation accessibilité (WCAG 2.1 AA)

### Court Terme
- [ ] Ajouter page FAQ
- [ ] Ajouter page Contact avec formulaire
- [ ] Configurer Google Analytics 4
- [ ] Tests A/B variants hero

### Moyen Terme
- [ ] Blog section (MDX)
- [ ] Témoignages vidéo
- [ ] Live chat support
- [ ] Dashboard analytics SEO

---

## Support

### Documentation
- Landing : `LANDING_REBUILD.md` - Documentation complète
- Monorepo : `../../CLAUDE.md` - Guide développeur
- Migration : `../../MIGRATION_SUCCESS.md` - Rapport migration

### Ressources Externes
- Next.js 15 : https://nextjs.org/docs/app
- TailwindCSS 4 : https://tailwindcss.com/docs
- shadcn/ui : https://ui.shadcn.com (pour futurs composants)

---

**Version** : 1.0.0  
**Status** : Production-Ready ✅  
**Dernière mise à jour** : 2025-11-04
