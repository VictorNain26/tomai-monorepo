---
description: Landing Astro — chargé uniquement sur apps/landing
paths:
  - "apps/landing/**"
---

# Landing (`apps/landing`)

Vitrine marketing et SEO, statique, en Astro 7, servie par Caddy dans une application statique
Clever Cloud (`apps/landing/Caddyfile`).

- **Gelée jusqu'au lot 4** (`docs/roadmap.md`) : seuls des correctifs d'honnêteté ou techniques
  y entrent, pas de nouvelle section. Au lot 4, elle reçoit la direction artistique du lot 3 et
  le nom du produit.
- **On n'affirme que ce qu'on peut prouver** (`docs/vision.md`) : chaque chiffre a une source
  primaire datée, chaque différence face à un concurrent est mesurée, ce qui n'est pas construit
  ne se promet pas. Une phrase qu'on ne peut adosser à une source ou à une mesure se retire.
- Jamais de promesse de progrès scolaire ni de meilleures notes, jamais « le seul » ; jamais
  « conforme au cadre d'usage de l'IA du ministère », « agréé » ou « recommandé par l'Éducation
  nationale », « aligné sur les programmes » sans la métrique publiée, ni « fait les devoirs »
  (`docs/etudes/2026-10-01/education-nationale.md`, c).
- Preuve sociale réelle seulement : témoignages de vraies familles avec leur accord, chiffres
  sourcés ; jamais un avis, un logo ou un compteur inventé ou anticipé.
- Jamais un cookie non essentiel avant le consentement, ni un bandeau où « Refuser » est moins
  visible qu'« Accepter » ([CNIL](https://www.cnil.fr/en/dark-patterns-cookie-banners-cnil-issues-formal-notice-website-publishers)).
- Jamais de framework client (React ou autre) : la landing est du HTML statique. Un composant qui
  a besoin du navigateur est un élément personnalisé (`customElements.define`) dans le `<script>`
  de son composant, sur l'élément natif quand il existe (`<dialog>` pour le menu, `<details>` pour
  la FAQ) ; les apparitions passent par l'API vanilla de Motion
  (`apps/landing/src/scripts/reveal.ts`). Les classes partagées avec le web viennent de
  `@repo/ui/classes`.
- Jamais un état d'entrée masqué hors de `@media (scripting: enabled)` : sans scripts, la page
  s'affiche entière (`apps/landing/tests/reveals.spec.ts`).
- Jamais de `<script>` ni de `<style>` en `is:inline`, ni d'attribut `style` : la CSP
  (`security.csp`, `apps/landing/astro.config.mjs`) n'admet que ce qu'Astro a haché ; les tests
  « nothing it refuses » (`apps/landing/tests/server.spec.ts`) le vérifient.
- Jamais un texte suivi d'une balise qui ouvre la ligne suivante sans `{' '}` : Astro 7 compresse
  le HTML comme du JSX (`compressHTML: 'jsx'`) et colle les deux
  ([guide de migration](https://docs.astro.build/en/guides/upgrade-to/v7/)).
- Jamais un en-tête HTTP, une redirection ou une page d'erreur ailleurs que dans le `Caddyfile` :
  la suite e2e tourne contre lui, dans l'image `caddy` de la version que Clever Cloud annonce
  ([doc](https://www.clever.cloud/developers/doc/deploy/applications/static/)), à suivre à la main
  dans `apps/landing/playwright.config.ts`.
