---
description: Landing Astro — chargé uniquement sur apps/landing
paths:
  - "apps/landing/**"
---

# Landing (`apps/landing`)

Vitrine marketing et SEO, statique, en Astro 7, servie par Caddy dans une application statique
Clever Cloud (`Caddyfile`).

- **Gelée jusqu'au lot 4** (`docs/roadmap.md`) : seuls des correctifs d'honnêteté
  (`.claude/rules/marketing.md`) ou techniques y entrent. Pas de nouvelle section ni de
  nouvelle direction visuelle : l'identité est rejetée et se refait au lot 4, avec le nom du
  produit.
- Jamais de React là où rien ne bouge : une page, une section ou un composant statique s'écrit en
  `.astro`. Un composant qui a besoin du navigateur est un îlot React chargé par `client:load`,
  enveloppé dans `Island` (`src/components/island.tsx`) : sans lui, `html[data-hydrated]`, qu'attend
  la suite e2e, ne se pose jamais. Les primitives interactives viennent de `@repo/ui`
  (`.claude/rules/design-system.md`).
- Jamais un `<style>` ni un `<script>` en ligne écrit à la main hors de ce qu'Astro traite : la CSP
  (`security.csp`, `astro.config.mjs`) n'admet que ce qu'Astro a haché ; le test « nothing it
  refuses » (`tests/server.spec.ts`) le vérifie.
- Jamais un en-tête HTTP, une redirection ou une page d'erreur ailleurs que dans le `Caddyfile` :
  la suite e2e tourne contre lui, dans l'image `caddy` de la version que Clever Cloud annonce
  ([doc](https://www.clever.cloud/developers/doc/deploy/applications/static/)), à suivre à la main
  dans `playwright.config.ts`.
