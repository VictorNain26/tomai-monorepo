# CLAUDE.md - Tom Landing Page

Landing page Next.js 16 pour la plateforme de tutorat Tom. Site statique SEO avec TailwindCSS 4.

## Commandes

```bash
# Développement
pnpm dev              # Port 3001

# Validation (obligatoire avant commit)
pnpm typecheck        # TypeScript strict
pnpm lint             # ESLint

# Build
pnpm build            # Production
```

## Stack

- **Next.js** : 16 (App Router)
- **TypeScript** : 5.9 strict mode
- **TailwindCSS** : 4
- **Animations** : Framer Motion
- **Icons** : Lucide React

## Structure

```
app/                    # Pages Next.js App Router
├── page.tsx            # Page d'accueil
├── layout.tsx          # Layout racine
├── confidentialite/    # Page confidentialité
├── cgu/                # CGU
├── mentions-legales/   # Mentions légales
└── contact/            # Contact

components/
├── atoms/              # Composants atomiques (FadeIn, Logo, etc.)
├── molecules/          # Composants moléculaires (NavLinks, HeroMockup)
├── sections/           # Sections de page (Hero, Features, Pricing, FAQ, CTA)
├── layout/             # Header, Footer
└── ui/                 # shadcn/ui components
```

## Règles

### Architecture des composants

- **atoms/** : Composants réutilisables sans état (Logo, FadeIn, SectionHeader)
- **molecules/** : Combinaisons d'atomes (NavLinks, HeroMockup)
- **sections/** : Sections complètes de page (Hero, Features, Pricing, FAQ, CTA)
- **layout/** : Header et Footer partagés

### UI : shadcn/ui + TailwindCSS

```typescript
// CORRECT : shadcn/ui Button
import { Button } from '@/components/ui/button'

<Button size="lg">Essayer gratuitement</Button>
```

```typescript
// INTERDIT : boutons custom avec effets complexes
<button className="custom-glow-shine-effect">
```

### Pas de sur-engineering

- Pas d'animations complexes inutiles
- Pas de composants créés mais non utilisés
- Supprimer le code mort

## Sections de la landing

| Section | Fichier | Description |
|---------|---------|-------------|
| Hero | `hero.tsx` | Accroche + CTA principal |
| Problem/Solution | `problem-solution.tsx` | Pain points parents vs solution Tom |
| How It Works | `how-it-works.tsx` | 3 étapes méthode socratique |
| Features | `features.tsx` | 6 fonctionnalités clés |
| Pricing | `pricing.tsx` | Plans Gratuit/Complet |
| FAQ | `faq.tsx` | Questions fréquentes parents |
| CTA | `cta.tsx` | Appel à l'action final |

## Validation pré-commit

```bash
pnpm typecheck  # Zero erreur TypeScript
pnpm lint       # Zero warnings ESLint
pnpm build      # Build successful
```
