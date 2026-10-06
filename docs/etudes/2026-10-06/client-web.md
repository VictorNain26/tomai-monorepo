# Client web — 2026-10-06

Instantané daté, jamais mis à jour. Demandé par Victor le 2026-10-06 pour `apps/web` (lot 3,
point 1) : « n'exclus rien comme solution, pas même Next.js, il faut la solution la plus
adaptée ». L'orientation du 2026-10-01 (SPA Vite + React + TanStack Router,
`../../architecture.md`) est rejugée sur données, pas reprise.

## Méthode

- Le besoin, tiré de `../../vision.md` et du code : une app derrière une connexion, sans SEO,
  pensée d'abord pour le téléphone (photo d'exercice, voix, alerte au parent). Elle consomme le
  client typé `hono/client` (`@repo/api`), l'auth better-auth par cookies, le chat au protocole
  UI message de l'AI SDK 7, et réutilise `@repo/ui` (React).
- Chaque dépendance est vérifiée le 2026-10-06 : dépôt non archivé, release dans les six derniers
  mois, issues fermées sur les 30 derniers jours, téléchargements npm hebdomadaires
  (`api.npmjs.org`) et étoiles (`gh api`). Les versions de Vite, TanStack Router,
  `@ai-sdk/react` et `vite-plugin-pwa`, et les exports de `@tanstack/router-plugin`, ont été
  recoupés sur le registre npm.
- Sources : la documentation officielle, citée à chaque constat. Ce qui n'a pas été vérifié est
  dit en fin d'étude.

## Décision

**SPA Vite 8 + React 19.3 + TanStack Router, installable en PWA, servie par Hono sur la même
origine que l'API.** Pas d'application native en V1. L'orientation du 2026-10-01 tient. L'étude
y ajoute trois choses : la PWA, le service par Hono, et le passage de `@repo/ui` à Base UI.

## Framework

| Option | Adoption | Verdict |
|---|---|---|
| Vite 8.3.3 + `@tanstack/react-router` 1.170.41 | 232 M et 25 M/sem. | Retenu |
| Next.js 16.3.8 (`output: 'export'`) | 76,9 M/sem. | Écarté |
| React Router 8.4.0 (mode framework, `ssr: false`) | 68,7 M/sem. | Écarté |
| TanStack Start 1.168.60 (mode SPA) | 16,6 M/sem. | Écarté |
| Astro 7.3.5 | 7,9 M/sem. | Écarté |
| SvelteKit 3.0.1, SolidStart 2.0.5 | — | Écartés |
| Bundler de Bun (imports HTML, HMR) | — | Écarté |

- **Next.js.** Ce qui le justifie (rendu serveur, server actions, middleware, cookies, rewrites)
  est soit inutile derrière une connexion, soit en double avec Hono. En export statique, il perd
  les routes dynamiques sans `generateStaticParams`, les cookies, les headers et le proxy
  ([doc, 2026-08-25](https://nextjs.org/docs/app/guides/static-exports)). On paierait le
  framework sans rien utiliser de ce qui le justifie. Hors export statique, il ajouterait un
  second serveur Node à côté de Hono.
- **React Router en mode SPA.** La racine est rendue au build : les routes doivent rester
  exécutables côté serveur ([doc](https://reactrouter.com/how-to/spa)), une contrainte sans
  contrepartie ici. Le routeur TanStack type et valide les paramètres de recherche par schéma
  ([comparatif](https://tanstack.com/router/latest/docs/framework/react/comparison), publié par
  TanStack, donc juge et partie).
- **TanStack Start.** Son mode SPA garde des fonctions serveur
  ([doc](https://tanstack.com/start/latest/docs/framework/react/guide/spa-mode)) : un second
  serveur à côté de Hono. Il partage le routeur retenu ; y passer resterait possible si un rendu
  serveur devenait nécessaire.
- **Astro.** Il est fait pour un site de contenu, et il est prévu pour la landing (lot 4). Une app
  avec l'état d'un chat n'a pas besoin d'îlots.
- **SvelteKit, SolidStart.** Ils perdent `@repo/ui`, écrit en React. `@ai-sdk/solid` n'a pas eu
  de release depuis le 2025-05-07 : il échoue au critère des six mois.
- **Bundler de Bun.** Sa doc le dit « *work in progress* » et ses plugins ne passent pas par la
  CLI ([doc](https://bun.com/docs/bundler/fullstack)). `@tanstack/router-plugin` n'exporte que
  `vite`, `rspack`, `esbuild` et `webpack` : le plugin Bun est seulement proposé
  ([discussion #6871](https://github.com/TanStack/router/discussions/6871)). Rien n'y remplace
  non plus `vite-plugin-pwa`. Bun reste le gestionnaire de paquets et le runtime du serveur ; Vite
  tourne sous Node 24, déjà requis par le dépôt
  ([guide Bun](https://bun.com/docs/guides/ecosystem/vite)).
- Vite 8 (2026-03-12) utilise Rolldown, en dev comme au build
  ([annonce](https://vite.dev/blog/announcing-vite8)) ; `@vitejs/plugin-react` 6.1.2 suit.

## Téléphone : PWA plutôt que natif

- **Photo** : `<input type="file" accept="image/*" capture="environment">`
  ([MDN](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/capture)).
- **Voix** : MediaRecorder produit du WebM/Opus depuis Safari 18.4, et seulement de l'`audio/mp4`
  avant ([WebKit](https://webkit.org/blog/16574/webkit-features-in-safari-18-4/)). Le serveur
  accepte déjà les deux (`modules/documents/upload.helpers.ts`). Le client choisit le format avec
  `MediaRecorder.isTypeSupported`.
- **Push** : sur iOS 16.4 et plus, seulement pour une app ajoutée à l'écran d'accueil, avec une
  permission demandée sur un geste ([WebKit](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)).
  Apple a renoncé à retirer les web apps installées dans l'UE
  ([TechCrunch, 2024-03-01](https://techcrunch.com/2024/03/01/apple-reverses-decision-about-blocking-web-apps-on-iphones-in-the-eu/)).
  **Conséquence :** l'alerte de détresse au parent ne peut pas reposer sur le seul push. Un parent
  qui n'a pas installé l'app ne la recevrait pas. Il faut un canal garanti, l'e-mail par exemple,
  et le push en plus.
- **Stockage** : Safari efface après 7 jours sans visite le stockage écrit par script, sauf pour
  une app installée ([web.dev](https://web.dev/articles/storage-for-the-web)). Rien d'important
  ne vit côté client.
- **`vite-plugin-pwa` 2.0.0** (2026-10-03, 6 M/sem., Workbox 7.4.1) : retenu, avec une réserve.
  2 issues fermées en 30 jours pour 191 ouvertes, la réactivité est faible. L'alternative
  `@serwist/vite` n'a que 21 k téléchargements par semaine.
- **Natif en V1 : non.** Photo, voix et push passent par le web. Expo ne réutilise pas
  `@repo/ui`, écrit pour le DOM, et `useChat` y demande des polyfills
  ([doc AI SDK](https://ai-sdk.dev/docs/getting-started/expo)). Capacitor 8.5.2 pourrait
  envelopper la même SPA si un iPhone réel montre que le push web ne tient pas : le choix
  d'aujourd'hui ne ferme pas cette porte.

## Service des fichiers : même origine que l'API

Hono sert la SPA avec `serveStatic` ([doc](https://hono.dev/docs/getting-started/bun)), et un
fallback vers `index.html` est déclaré après les routes `/api`.

- **Cookies.** better-auth signale que Safari bloque les cookies d'une API sur un autre domaine
  que le front ([doc](https://www.better-auth.com/docs/concepts/cookies)). La même origine évite
  ce cas, ainsi que le CORS et le preflight de chaque requête, coûteux sur un réseau mobile.
- **SSE et déploiement.** Le chat passe par la même connexion. Il y a un seul artefact et aucun
  second hébergeur à payer en UE. La contrepartie : déployer le web, c'est déployer le serveur.
- **Cache.** Assets hachés en `immutable` ; `index.html` et le service worker en `no-cache`.
- **`@repo/api`** force aujourd'hui `mode: 'cors'` et une URL absolue : le web passera une base
  relative.

## Données, formulaires, UI, chat

- **Données** : `@tanstack/react-query` 5.104.1 (82,8 M/sem.). La doc de Hono montre son usage avec
  `InferRequestType` et `InferResponseType` ([doc](https://hono.dev/docs/concepts/stacks)). Pas
  de bibliothèque de liaison.
- **Formulaires** : `react-hook-form` 7.89.0 et `@hookform/resolvers` 5.9.1 (70 M/sem.,
  `zodResolver` compatible Zod 4). Les `fields` d'un 400 (#405) passent à `setError` avec leur
  message, déjà en français. TanStack Form 1.33.5 est écarté : aucune issue fermée en 30 jours.
- **UI** : Tailwind 4.3.3 avec `@tailwindcss/vite`. Depuis juillet 2026, shadcn démarre sur Base UI
  et garde Radix, sans le déprécier
  ([changelog](https://ui.shadcn.com/docs/changelog/2026-07-base-ui-default)). Les deux sont
  actifs (`@base-ui/react` 1.8.0 et `radix-ui` 1.7.0, 19 M/sem. chacun). `@repo/ui` ne compte que
  deux primitives Radix (dialog, slot) : il passe à Base UI au début du lot 3, tant que c'est
  presque gratuit. La landing gelée consomme `@repo/ui` : la bascule doit la garder intacte.
- **Chat** : `@ai-sdk/react` 4.0.131 (peer `react ^19.2.1`). Il épingle `ai` 7.0.128 alors que le
  serveur est en 7.0.107 : la même PR aligne le serveur, sinon deux copies de `ai` coexistent. Le
  type `TomChatMessage`, déjà réexporté par `@repo/api`, type `useChat` de bout en bout
  ([doc](https://ai-sdk.dev/docs/ai-sdk-ui/streaming-data)).

## Tests

- **Composants** : Vitest 5.0.3 en browser mode avec Playwright
  ([doc](https://vitest.dev/guide/browser/)), dans un vrai navigateur au format d'un téléphone,
  sous Node. `bun test` avec happy-dom (sans layout ni médias, 484 issues ouvertes) reste pour la
  logique pure.
- **De bout en bout** : Playwright 1.63.0, avec un téléphone émulé et le moteur WebKit
  ([doc](https://playwright.dev/docs/emulation)), sous Node.

## À mesurer sur un vrai iPhone et un Android

- le format réellement produit par MediaRecorder, et la transcription de Voxtral sur ce format ;
- la photo prise par `capture` jusqu'à l'upload présigné ;
- le push dans une app installée, et la part des parents qui l'installent ;
- le partage ou non de la session entre Safari et l'app installée ;
- un flux SSE long quand l'écran se verrouille ;
- la durée de vie du cookie de session face à ITP, en usage du soir.

## Non vérifié

- Vite 8 lancé par le runtime Bun (`bunx --bun vite`), Vitest et Playwright sous Bun.
- L'API du middleware CSP de Hono.
- Le support de `capture` sur iOS, que MDN ne détaille pas.
- Le contenu de `vite-plugin-pwa` 2.0.0 au-delà de ses dépendances.
- Le coût d'hébergement UE, faute de fournisseur choisi (décision ouverte du lot 3).
