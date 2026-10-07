# Plan — la landing en Astro

## Pré-vol (2026-10-07)

- Clever Cloud sert une application statique avec Static Web Server, ou avec Caddy 2.11.4 si un
  `Caddyfile` est à la racine de l'application, port 8080
  ([doc](https://www.clever.cloud/developers/doc/deploy/applications/static/)). La suite Playwright
  tourne contre ce Caddy, en conteneur `caddy:2.11.4-alpine` : en-têtes, redirection et 404 sont
  testés tels qu'ils seront servis.
- Astro 7.3.6 : `security.csp` stable, `<meta>` à empreintes pour `script-src` et `style-src` ; les
  attributs `style` rendus par Motion passent par `style-src-attr 'unsafe-inline'` (`kind:
  "attribute"`, [référence](https://docs.astro.build/en/reference/configuration-reference/)).
  Polices par l'option `fonts` (stable), auto-hébergées au build, avec repli ajusté comme `next/font`
  ([guide](https://docs.astro.build/en/guides/fonts/)) ; elles gardent `--font-nunito` et
  `--font-caveat`, que lit `@repo/tokens`.
- Les îlots React se chargent tous au chargement (`client:load`), comme l'hydratation de Next ;
  `html[data-hydrated]`, qu'attend la suite, se pose quand le dernier îlot est hydraté.
- L'image Open Graph, générée par `next/og`, devient un PNG statique capturé sur la version Next.
- `@astrojs/sitemap` ne porte ni `changefreq` ni `priority` : Google les ignore
  ([doc](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)).
- Adoption vérifiée le 2026-10-07 : astro (63 k étoiles, 7,9 M téléchargements par semaine),
  `@astrojs/react`, `@astrojs/sitemap`, `@astrojs/check` (dépôt d'Astro), `eslint-plugin-astro`
  (poussé le 2026-10-07, 1,1 M), `prettier-plugin-astro` (poussé le 2026-10-05, 1,5 M).

## Problème

La landing tourne sur Vercel, dont l'offre gratuite exclut l'usage commercial, avec Sentry, que
l'hébergement unifié remplace par Bugsink ; Next.js laisse des scripts en ligne qu'une CSP stricte
refuse (`etudes/2026-10-07/hebergement.md`, « Architecture unifiée »).

## Critères d'acceptation

- [ ] `apps/landing` en Astro 7 : mêmes pages, mêmes textes, mêmes balises du `<head>`, mêmes îlots
      interactifs (menu mobile, FAQ, apparitions, Tom).
- [ ] La suite Playwright passe sans changement de ses tests, contre Caddy ; tests ajoutés pour les
      en-têtes, la CSP et la redirection `/home`.
- [ ] `Caddyfile` : en-têtes de `vercel.json`, `frame-ancestors`, `object-src`, `base-uri`, 404.
- [ ] Next.js, Vercel et Sentry supprimés du dépôt (dépendances, configs, env de turbo,
      `trustedDependencies`, preset ESLint `next-js`).
- [ ] Pages légales : l'hébergeur est Clever Cloud ; plus de transfert vers les États-Unis.
- [ ] `.claude/rules/landing.md`, README, SECURITY.md et `suivi.md` à jour.

## Hors périmètre

- Le déploiement chez Clever Cloud et la bascule du DNS : le compte n'existe pas (étape 7).
- Tout changement de contenu ou d'identité (lot 4).

## Vérification de bout en bout

`bun run typecheck && bun run lint`, `bunx turbo run test:e2e --filter=landing`, puis les pages
servies par Caddy, ouvertes dans Chrome, console sans violation de CSP.

## Décision humaine

Portage fidèle en Astro, décidé par Victor le 2026-10-07 (#446).
