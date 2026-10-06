# Plan — Hono sert `apps/web` sur la même origine, PWA

Lot 3, point 1, suite du squelette #408. Branche `feat/web-served-by-hono`, depuis `main`
à `2dbb3747`.

## Pré-vol (2026-10-06, contre le code et les `.d.ts` installés)

- **`serveStatic`** : `hono/bun` est déprécié, retiré en Hono v5 ; `@hono/bun` 1.0.0, déjà
  dépendance du serveur (`getConnInfo`), l'exporte (`node_modules/@hono/bun/README.md`,
  [doc](https://hono.dev/docs/getting-started/bun)). Options lues dans
  `hono/dist/types/middleware/serve-static/index.d.ts` : `root`, `path`, `onFound`,
  `onNotFound`. Il refuse seul les segments `..`. Un `HEAD` est servi par la route `GET`
  (`hono-base.js`, `#dispatch`).
- **Exclure `/api`** : `except` de `hono/combine`
  ([doc](https://hono.dev/docs/middleware/builtin/combine)), pas de condition maison.
- **CSP** : `secureHeaders({ contentSecurityPolicy })` ([doc](https://hono.dev/docs/middleware/builtin/secure-headers)),
  type `ContentSecurityPolicyOptions` dans `secure-headers.d.ts`. Écart avec l'étude : son API
  est maintenant vérifiée.
- **Sortie de Vite** (build local de `apps/web` avec le plugin PWA) : `index.html` ne porte
  aucun script ni style en ligne, seulement `<script type="module" src="/assets/…">`,
  `<link rel="stylesheet">`, le manifest et `<script src="/registerSW.js" defer>`. Aucun `data:`
  dans les assets. Une CSP `default-src 'self'` passe donc telle quelle ; `build.assetsInlineLimit: 0`
  ([doc](https://vite.dev/config/build-options#build-assetsinlinelimit)) empêche Vite d'en
  produire un plus tard. Les `style` posés par React passent par le CSSOM, que la CSP ne
  bloque pas.
- **`vite-plugin-pwa`** 2.0.0, vérifié le 2026-10-06 : publié le 2026-10-03, dépôt non
  archivé (dernier push 2026-10-04), 4 282 étoiles, 6,0 M téléchargements/semaine, 2 issues
  fermées en 30 jours pour 191 ouvertes mais les issues et PR récentes reçoivent réponse du
  mainteneur (#945, #933). Workbox 7.4.1 (dépôt GoogleChrome actif, 11 M/sem.). Retenu, réserve
  de l'étude maintenue. Options lues dans `vite-plugin-pwa/dist/index.d.ts` :
  `injectRegister: 'script-defer'` produit un fichier `registerSW.js`, compatible avec la CSP,
  là où `inline` ne l'est pas ([doc](https://vite-pwa-org.netlify.app/guide/register-service-worker)) ;
  `registerType: 'autoUpdate'` pose `skipWaiting` et `clientsClaim`
  ([doc](https://vite-pwa-org.netlify.app/guide/auto-update)) ;
  `workbox.navigateFallbackDenylist` ([doc](https://vite-pwa-org.netlify.app/workbox/generate-sw))
  garde les navigations `/api` (callback OAuth) hors du service worker. `generateSW` ne met en
  cache que le précache du build : aucune réponse `/api`.
- **Icônes** : `apps/web/public` n'a qu'un favicon 32 px et une icône Apple 180 px ; le manifest
  veut du 192 et du 512 pour être installable sur Android. Ce sont les icônes de la landing
  (`apps/landing/public/icon-192.png`, `icon-512.png`), même identité provisoire : copiées.
- **Better Auth** fait confiance à son `baseURL` par défaut et rejette un `Origin` hors de
  `trustedOrigins` ([doc](https://www.better-auth.com/docs/reference/security), « Trusted
  Origins »).
- **Vite `server.proxy`** : une clé est un préfixe de chemin ([doc](https://vite.dev/config/server-options#server-proxy)).
- **Écart** : `src/app.ts` répond `GET /` en JSON (`TomAI API`, `operational`) ; `/` est
  maintenant la SPA. La route part, et son test dans `integration-tests/api-endpoints.test.ts`.
  Aucun client ne l'appelle.
- **Écart** : l'auth est réglée pour deux sous-domaines (`app.` et `api.`) :
  `crossSubDomainCookies`, `FRONTEND_URL` exigé en production, CORS. La même origine les rend
  caducs et le cookie au domaine parent s'étendrait à la landing : ils partent avec CORS.

## Décisions

1. **Le serveur trouve `dist` par `WEB_DIST_DIR`**, validée dans
   `platform/config/env.ts` : exigée en production, le dossier doit contenir `index.html`
   (échec au boot sinon). Absente en dev, où Vite sert le web. Un chemin relatif au build
   dépendrait de la profondeur du fichier (source ou bundle) : écarté.
2. **Dev : proxy de Vite** (`/api/` vers `:3000`), pas CORS. Le navigateur voit une seule
   origine comme en production : cookie de session sans `SameSite` cross-site, aucun preflight,
   et `@repo/api` garde la même base relative partout. Seul ajout côté serveur : better-auth
   fait confiance à `http://localhost:3002` en dev, l'`Origin` que le proxy transmet.
3. **Plus de CORS** : aucun client sur une autre origine (la landing n'appelle jamais le
   serveur, pas d'app native en V1). `cors()`, `CORS_ORIGINS`, `FRONTEND_URL` et
   `getCorsOrigins` partent ; `getTrustedOrigins()` ne garde que l'origine de Vite en dev. Cookie
   de session limité à l'hôte (plus de `crossSubDomainCookies`).
4. **CSP globale** dans `secureHeaders`, sortie de `app.ts` dans
   `platform/http/security-headers.ts` pour être testée seule :
   `default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none';
   form-action 'self'`. Sur une réponse JSON elle ne coûte rien. CORP et COOP repassent à leur
   défaut (`same-origin`) : la raison de les couper (web sur une autre origine) disparaît, et
   l'OAuth Google de better-auth passe par redirection, pas par `window.opener`.
   Conséquence connue : la page d'erreur HTML de better-auth (`/api/auth/error`, `<style>` en
   ligne) s'affiche sans style ; la PR de connexion pointe `onAPIError.errorURL` vers une page
   du web.
5. **Cache** : `/assets/*` (nommés par hash par Vite) en `public, max-age=31536000, immutable` ;
   tout le reste (`index.html`, `sw.js`, `registerSW.js`, manifest, icônes) en `no-cache`.
6. **Fallback SPA** : `index.html` pour un `GET` hors de `/api/*` et `/assets/*` sans fichier ;
   un asset haché absent reste un 404, une route `/api` inconnue le 404 JSON de
   `handleNotFound`.
7. **Image Docker** : un étage `web` sur `node:24-slim` (Vite tourne sous Node, étude), avec le
   binaire `bun` copié de l'étage `base` pour l'installation ; l'étage `production` copie
   `apps/web/dist` et pose `WEB_DIST_DIR`. `docker.yml` se déclenche aussi sur `apps/web/**` et
   `packages/tokens/**`.
8. **`@repo/api`** : plus de `init` forcé (`credentials: 'include'`, `mode: 'cors'`), inutile à
   même origine ; exemples en base `'/'`. Exports inchangés.

## Tâches

1. Serveur — `platform/http/web-client.ts` (`webClient(distDir)` : sous-app Hono, service
   statique, fallback, cache) monté hors de la chaîne typée d'`app.ts` pour laisser `AppType`
   intact ; `platform/http/security-headers.ts` ; `env.ts` (`WEB_DIST_DIR`,
   `getTrustedOrigins`) ; `auth.ts`. Tests : `src/tests/web-client.test.ts` (fichier servi,
   fallback, 404 JSON sous `/api`, 404 d'un asset absent, en-têtes de cache, CSP sur une page),
   `env-web.test.ts` (variable exigée en production, dossier sans `index.html` refusé, origines
   de confiance), mise à jour des tests d'auth et d'intégration.
2. Docker — `apps/server/Dockerfile`, `.github/workflows/docker.yml` ; build de l'image en local.
3. Web — `vite.config.ts` (PWA, proxy, `assetsInlineLimit`), icônes, `tests/pwa.spec.ts` :
   manifest (nom, `standalone`, couleurs égales au fond de la page, icônes servies) et service
   worker actif sur `/sw.js`, une navigation `/api` qui ne passe pas par lui.
4. `@repo/api` — `client.ts`, `config.ts`, `index.ts` ; test : une base `'/'` donne une requête
   `/api/…` relative, sans `mode` ni `credentials` imposés.
5. Doc — `docs/architecture.md`, `.claude/rules/web.md`, `.claude/rules/server.md` (CORS),
   `apps/server/.env.example`, `README.md`, `docs/suivi.md`.

## Renvoyé

- `ai` aligné sur la version qu'épingle `@ai-sdk/react` : avec la PR qui installe
  `@ai-sdk/react` (chat du lot 3), seule à en dépendre.
- Mesures sur un vrai iPhone et un Android : restent dans `docs/suivi.md`.
- `Permissions-Policy` `microphone=()` : à ouvrir à `self` par la PR de la voix.
