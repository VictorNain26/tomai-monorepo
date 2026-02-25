# Landing Tom

Landing page Next.js 16 statique SEO. TailwindCSS 4 + Framer Motion.

## Commandes

```bash
pnpm dev          # Port 3001
pnpm typecheck    # TypeScript strict
pnpm lint         # ESLint zero warnings
pnpm build        # Production
```

## Architecture composants

- **`components/atoms/`** : composants reutilisables sans etat (Logo, FadeIn, SectionHeader)
- **`components/molecules/`** : combinaisons d'atomes (NavLinks, HeroMockup)
- **`components/sections/`** : sections completes de page (Hero, Features, Pricing, FAQ, CTA)
- **`components/layout/`** : Header, Footer partages
- **`components/ui/`** : shadcn/ui uniquement

## Contraintes

- JAMAIS de composants UI custom : utiliser shadcn/ui (`@/components/ui/`)
- JAMAIS de CSS custom ni styles inline : TailwindCSS uniquement
- Deploy via Vercel (auto sur push). JAMAIS `pnpm install --force` dans vercel.json.
