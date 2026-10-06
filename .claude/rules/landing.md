---
description: Landing Next.js — chargé uniquement sur apps/landing
paths:
  - "apps/landing/**"
---

# Landing (`apps/landing`)

Vitrine marketing et SEO, statique, en Next.js.

- **Gelée jusqu'au lot 4** (`docs/roadmap.md`) : seuls des correctifs d'honnêteté
  (`.claude/rules/marketing.md`) ou techniques y entrent. Pas de nouvelle section ni de
  nouvelle direction visuelle : l'identité est rejetée et se refait au lot 4, avec le nom du
  produit.
- **Cette version de Next.js diffère de ce que tu connais** : API, conventions et structure
  ont changé. Avant d'écrire du code, lire le guide concerné dans
  `apps/landing/node_modules/next/dist/docs/` (le paquet `next` n'est pas visible depuis la
  racine), et tenir compte des avis de dépréciation. `agentRules: false`
  (`next.config.mjs`) empêche `next dev` d'écrire un `AGENTS.md` ou un `CLAUDE.md` ici.
- Sections, annotations et démo sont des composants de composition, libres ; les primitives
  interactives viennent de `@repo/ui` (`.claude/rules/design-system.md`).
- Déploiement Vercel automatique au push. **Jamais `bun install --force`** dans
  `vercel.json` : ça masque les conflits de résolution au lieu de les régler.
