# Architecture

Ce qui est en place, et comment. Le pourquoi de chaque choix : `decisions.md` ; le produit :
`vision.md` ; le tuteur : `tuteur.md`.

Tom est le nom de l'IA, pas du produit, dont le nom est ouvert. Aucun utilisateur réel : aucune
contrainte de rétrocompatibilité, on vise directement la cible.

## Serveur

Monolithe modulaire ; sa structure et ses règles de dépendance viennent de
`etudes/2026-10-06/refonte-architecture.md`. Les fichiers, la voix et la facturation arrivent
au lot 3.

En place (`apps/server/src`) :
- `main.ts`, seule racine de composition, et `migrate.ts` ; `config.ts`, un seul schéma de
  l'environnement ; `app.ts`, `createApp(deps)`.
- `platform/` : `http` (erreurs RFC 9457, en-têtes de sécurité, service du web), `db` (client,
  migrations sous verrou et vérifiées au démarrage), `auth` (better-auth et ses tables),
  `observability` (pino), `lifecycle` (santé et arrêt).
- `modules/household` : le foyer, l'élève créé par son gardien sans aucun identifiant (ni e-mail,
  ni mot de passe, ni nom de famille), ses appareils ; l'accès du gardien à l'élève comme clause
  de la requête SQL, une matrice de tests d'accès croisés.
- `platform/email` : l'envoi d'un e-mail, Scaleway TEM par son SDK en production, le journal en
  développement. Le gardien n'a pas de mot de passe : il entre par un code à 6 chiffres envoyé à son
  adresse (plugin `email-otp`), le premier créant son compte sur invitation, ou par une clé d'accès
  (`@better-auth/passkey`, liée à l'origine publique) qu'il crée depuis son foyer. Une clé se crée,
  et le compte se supprime, depuis une session ouverte il y a moins de 10 minutes ; la suppression
  emporte son foyer s'il en est le seul gardien. L'élève n'a pas de clé : le garde du foyer lui
  ferme les routes de better-auth, sauf celles par où son parent entre sur son appareil. Une session
  vit 90 jours sans usage ; un appareil garde la session de l'enfant quand le parent y entre
  (`multiSession`), et ne garde aucune session de parent une fois rendu à l'enfant
  (`platform/auth/pairing.ts`). Les envois partent après la réponse (`platform/lifecycle/background.ts`),
  que l'arrêt attend.
- `modules/tutor` : les séances, le tour (`POST /api/sessions/:id/messages`), qui échoue fermé, le
  quota par élève, le résumé et le titre en tâche de fond, la mémoire d'apprentissage
  (`/api/memory`), le résumé de la semaine (`/api/summary`) ; ses règles dans `tuteur.md`.
- `platform/ai` : les appels à Mistral et à sa modération, le coût de chacun.
- `platform/auth/pairing.ts` : le jumelage d'un appareil d'élève, un code à usage unique demandé
  par le gardien, haché par better-auth, qui ouvre une session pour l'élève.
- `domain/` (niveaux, matières), `referential/` (outil et textes officiels), `eval/` (jeu
  d'évaluation, données seules) ; `testing/` (une base de test par fichier).
- Les frontières sont vérifiées au lint (`eslint-plugin-boundaries`), jusqu'aux couches d'un
  module : routes, service, repository.

## Client web

Choix et options comparées : `etudes/2026-10-06/client-web.md`. **Pensé d'abord pour le
téléphone** : chaque parcours se conçoit et se prouve à largeur de téléphone, le bureau s'en
déduit.

En place (`apps/web`) :
- Application monopage Vite + React + TanStack Router, Tailwind sur les tokens `@repo/tokens`,
  tests Playwright à largeur de téléphone (WebKit et Chromium).
- Servie par Hono sur la même origine que l'API (`apps/server/src/platform/http/web-client.ts`) : cookie de
  session limité à l'hôte, sans CORS ni blocage de Safari, un seul déploiement. Le serveur lit le
  build dans `WEB_DIST_DIR`, que l'image Docker embarque ; une navigation hors de `/api` sans
  fichier reçoit `index.html`, un fichier absent reste un 404. Assets hachés en cache
  `immutable`, le reste en `no-cache` revalidé par ETag ; fichiers compressés au build. CSP
  `default-src 'self'` sur toutes les réponses, `no-store` sur `/api`. En dev, le proxy de Vite
  envoie `/api/` et `/health` au serveur, et l'origine de Vite est la base de better-auth : une
  seule origine aussi. La suite de bout en bout (`tooling/playwright-web`) tourne sur le serveur
  construit qui sert le web construit.
- Après un déploiement, un onglet ouvert qui demande un morceau disparu de son ancien build se
  recharge une fois sur le nouveau (TanStack Router, `lazyRouteComponent`).
- Installable (PWA, `vite-plugin-pwa`) : manifest et service worker, qui ne met en cache que le
  build, jamais une réponse `/api`, et laisse passer les navigations `/api`.
  Photo, voix et push passeront par le web, sans application native en V1.

- Client typé : le serveur émet ses déclarations (`build:types`, seul point d'entrée
  `apps/server/src/contract.ts`), que turbo construit avant le typecheck et le lint du web ; le
  web les lit par `hc<AppType>` et `parseResponse` de `hono/client`, une erreur par `isProblem`
  (`apps/web/src/lib/api.ts`). Aucun type du serveur n'est réécrit côté client.
- Données par TanStack Query, formulaires par react-hook-form et Zod, celui-ci en mode
  `jitless` : sa sonde `new Function` serait une violation de la CSP.
- Primitives `@repo/ui` (shadcn) ; le chat par `useChat` de `@ai-sdk/react`, qui lit le protocole
  du serveur (`apps/web/src/lib/chat.ts`).

## Observabilité

- **En place** : logs pino avec le `requestId` de chaque requête et un sérialiseur d'erreurs en
  liste blanche (aucun texte d'élève). Les erreurs iront à Bugsink, auto-hébergé chez Clever Cloud,
  juste avant la première vraie famille ; les traces OpenTelemetry attendent un besoin mesuré
  (`etudes/2026-10-07/hebergement.md`).
- **À tenir dès leur retour** : l'AI SDK écrit le message d'erreur dans le span quel que soit
  `recordInputs`, et une erreur de validation y met la sortie du modèle ; les messages d'erreur
  se réécrivent avant tout export.
- **Cible** : traces et métriques sans identifiant ni texte, logs avec `trace_id`, rétentions
  courtes, accès réservé.

## Hébergement

Tout chez Clever Cloud, région Paris (`etudes/2026-10-07/hebergement.md`). L'image du serveur
sert l'API et le web ; la landing, en Astro, vit dans une application statique à part. L'e-mail
part de Scaleway TEM, les photos iront dans Cellar.

- **Staging** : https://staging.tomia.fr, l'application `tomai-staging` (Docker nano) et sa base
  `tomai-staging-db` (PostgreSQL 18, `XXS_TNY`, disque chiffré, certificat épinglé par
  `DATABASE_CA`). Le proxy de Clever Cloud ajoute l'adresse réelle à droite de
  `X-Forwarded-For` : le serveur fait confiance à `TRUSTED_PROXY_HOPS` sauts (1 au staging) pour
  son rate limit et pour better-auth (`platform/http/client-address.ts`). L'e-mail part de
  `mail.tomia.fr`, par une clé limitée à l'envoi.
- **Landing** : https://tomia.fr, l'application statique `tomai-landing`, servie par Caddy
  (`apps/landing/Caddyfile`). `contact@tomia.fr` est redirigée vers la boîte Gmail de Victor,
  donc chez Google : à revoir si une boîte dans l'UE devient nécessaire.
- **Production** : elle naît avec la première vraie famille.

### Environnements et livraison

Décidé par Victor le 2026-10-08. Une seule branche durable, `main` ; deux environnements, qui sont
deux applications Clever Cloud, chacune avec sa base et ses clés :

- **Staging** (la préproduction) : chaque merge sur `main`, `ci-ok` vert, y déploie l'image que la
  CI a construite et testée, désignée par son digest. On y teste dans les conditions du cloud
  (proxy, Postgres, vrai Mistral) ce que le local ne montre pas.
- **Production** : la même image, au même digest, après l'approbation de Victor (environnement
  GitHub `production`, relecteur requis). Elle naît avec la première vraie famille ; d'ici là, seul
  le staging existe.
- **Landing** : directement en production, sans staging (Victor, 2026-10-08). Chaque merge sur
  `main`, `ci-ok` vert, envoie à son application statique ce que la CI a construit,
  son `Caddyfile` et `dist/` (job `deploy-landing`, environnement GitHub `landing`).

Les clés de chaque environnement vivent dans son environnement GitHub : le déploiement du staging
n'a pas celles de la production. Pas de branche par environnement : une branche longue retarde
l'intégration (la recherche DORA lie les meilleures performances aux branches courtes,
[dora.dev](https://dora.dev/capabilities/trunk-based-development/)), et chaque environnement
reconstruirait une image que personne n'a testée, là où l'image se construit une fois et ne change
que par sa configuration ([12factor.net](https://12factor.net/build-release-run)). Clever Cloud ne
fait que tirer l'image : il ne construit rien, et les secrets ne passent pas au build.

## Décisions ouvertes

`decisions.md`, « Ouvertes ».

## Ordre des lots

Voir `docs/roadmap.md`.
