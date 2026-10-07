# Cible V1 — architecture et périmètre

Statut : validé le 2026-09-22, aligné sur la vision produit le 2026-10-01. **En refonte depuis le
2026-10-06** : la cible est `etudes/2026-10-06/refonte-architecture.md`, qui prime sur ce document
là où ils divergent ; chaque étape de la refonte réécrit la partie qu'elle reconstruit.

## Produit

Pour qui, promesse, preuves, prix et périmètre : `vision.md`, qui
prime sur ce document. Ici, seulement l'architecture qui en découle.

Le nom du produit est ouvert (vision, « Marque ») ; Tom est le nom de l'IA. L'app n'est
pas en production : aucun utilisateur, aucune contrainte de rétrocompatibilité, on vise
directement la cible.

## Décisions

| Sujet | Décision | Motif |
|---|---|---|
| Client V1 | **Web uniquement, application monopage Vite + React + TanStack Router, installable (PWA), servie par Hono sur la même origine que l'API, pensée d'abord pour le téléphone** | Un seul client à livrer ; le collégien travaille le soir, probablement sur téléphone, à vérifier (vision, « Pour qui ») ; options comparées, Next.js compris, dans `etudes/2026-10-06/client-web.md` |
| Application native | **Hors V1** ; `apps/mobile` supprimé au lot 0 (l'historique git le garde) | Code mort à maintenir sinon |
| Topologie | **Un dépôt, backend en monolithe modulaire** | `ai-service` et `curriculum` séparés ont pourri puis été supprimés ; un service séparé ne se justifie que par une contrainte réelle |
| Serveur | Bun + Hono (Elysia remplacé le 2026-10-01) | Client typé de bout en bout (`hono/client`) ; adoption et maintenance bien plus larges qu'Elysia, qui reposait sur un seul mainteneur ; tourne sur Bun, Node et l'edge |
| LLM | **Mistral**, stack 100 % UE | Souveraineté, données de mineurs (RGPD) |
| Modèle de chat | **Mistral Small 4** (`mistral-small-2603`), multimodal | Voir `tuteur.md` |
| Pronote | **Hors V1** : module, `pawnote`, tables et routes retirés au lot 0 | Accès non officiel, cassé par la version 2026 de Pronote ; il ne revient que par une convention avec Index Éducation (vision, « Périmètre V1 ») |
| Paiement | Web, **à facturation sans piège** (vision, « Offre et prix ») | Premier reproche des parents dans les avis |

## Serveur

Monolithe modulaire, en refonte : structure, règles de dépendance et ordre de reconstruction
dans `etudes/2026-10-06/refonte-architecture.md`. Les modules (foyer, tuteur, apprentissage,
fichiers, voix, facturation) arrivent chacun avec l'étape qui le construit.

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
  développement ; le gardien vérifie son adresse, réinitialise son mot de passe (toutes ses
  sessions fermées) et supprime son compte avec son mot de passe, ce qui emporte son foyer s'il en
  est le seul gardien. Les envois partent après la réponse (`platform/lifecycle/background.ts`),
  que l'arrêt attend.
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
  build, jamais une réponse `/api`, et laisse passer les navigations `/api` (callback OAuth).
  Photo, voix et push passeront par le web, sans application native en V1.

- Client typé : le serveur émet ses déclarations (`build:types`, seul point d'entrée
  `apps/server/src/contract.ts`), que turbo construit avant le typecheck et le lint du web ; le
  web les lit par `hc<AppType>` et `parseResponse` de `hono/client`, une erreur par `problemOf`
  (`apps/web/src/lib/api.ts`). Aucun type du serveur n'est réécrit côté client.
- Données par TanStack Query, formulaires par react-hook-form et Zod, celui-ci en mode
  `jitless` : sa sonde `new Function` serait une violation de la CSP.

Cible :
- Primitives `@repo/ui` (shadcn sur Radix). Base UI est écarté : sur iOS, il ne verrouille pas
  le défilement derrière un panneau quand la barre de Safari est repliée
  (`@base-ui/utils/useScrollLock.mjs`).
- Le chat consomme le protocole de l'AI SDK (`useChat` de `@ai-sdk/react`), déjà
  celui du serveur.

## Observabilité

- **En place** : logs pino avec le `requestId` de chaque requête et un sérialiseur d'erreurs en
  liste blanche (aucun texte d'élève). Les erreurs iront à Bugsink, auto-hébergé chez Clever Cloud,
  avec la préproduction ; les traces OpenTelemetry attendent un besoin mesuré
  (`etudes/2026-10-07/hebergement.md`).
- **À tenir dès leur retour** : l'AI SDK écrit le message d'erreur dans le span quel que soit
  `recordInputs`, et une erreur de validation y met la sortie du modèle ; les messages d'erreur
  se réécrivent avant tout export.
- **Cible** (`etudes/2026-10-06/refonte-evaluation.md`, « Observabilité en production ») : traces et
  métriques sans identifiant ni texte, logs avec `trace_id`, erreurs dans un outil hébergé dans
  l'UE, rétentions courtes, accès réservé ; les erreurs vont à Bugsink, chez l'hébergeur.

## Hébergement

Tranché le 2026-10-07 (`etudes/2026-10-07/hebergement.md`) : tout chez Clever Cloud, région Paris.
`app.<nom>.fr` sert l'API et le web depuis l'image du serveur ; `<nom>.fr` est la landing, en
Astro, dans une application statique à part. Les erreurs vont à Bugsink, l'e-mail part de Scaleway
TEM, les photos iront dans Cellar.

## Décisions ouvertes

Elles sont tranchées au démarrage du lot qui en dépend, doc-first, pas avant :

| Décision | Lot | Ce qui doit être vérifié |
|---|---|---|
| Fournisseur de paiement web | 3 | Conformité UE, abonnement familial multi-enfants, facturation sans piège réalisable telle que la vision la définit |
| Nom du produit | 4 | Marques et domaines (vision, « Marque ») |

## Ordre des lots

Voir `docs/roadmap.md`.
