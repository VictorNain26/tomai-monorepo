# TomAI Landing

Landing page Next.js 16 pour la plateforme de tutorat Tom. Site statique SEO.

## Quick Start

```bash
pnpm dev          # http://localhost:3001
pnpm build        # Production
```

## Stack

| Composant | Version |
|-----------|---------|
| Next.js | 16 (App Router) |
| TypeScript | 5.9 strict |
| TailwindCSS | 4 |
| Animations | Framer Motion |
| Icons | Lucide React |
| UI | shadcn/ui |

## Pages

| Route | Description |
|-------|-------------|
| `/` | Accueil (Hero, Features, Pricing, FAQ, CTA) |
| `/confidentialite` | Politique de confidentialite |
| `/cgu` | Conditions generales |
| `/mentions-legales` | Mentions legales |
| `/contact` | Contact |

## Components

```
components/
├── atoms/        # Logo, FadeIn, SectionHeader
├── molecules/    # NavLinks, HeroMockup
├── sections/     # Hero, ProblemSolution, HowItWorks, Features, Pricing, FAQ, CTA
├── layout/       # Header, Footer
└── ui/           # shadcn/ui
```

## Deploy

Vercel (auto sur push). Configuration dans `vercel.json`.
