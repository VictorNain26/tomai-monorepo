# Cible V1 — architecture et périmètre

Statut : validé le 2026-09-22, aligné sur la vision produit le 2026-10-01.

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

## Monolithe modulaire

Chaque module expose une interface publique (`index.ts`) ; un module n'importe
jamais les fichiers internes d'un autre. Découpage cible, tiré du code actuel de
`apps/server/src` :

| Module | Responsabilité |
|---|---|
| `auth` | Comptes parent (email, Google) et élève (username), création d'un compte élève, mot de passe ; le moteur de session (better-auth, gardes) est dans `platform/` et lit les tables par `db/schema` |
| `family` | Rattachement parent ↔ enfants ; côté parent, résumé de la semaine et alerte de détresse, jamais les conversations ; lecture du statut et de l'usage d'abonnement (`/api/subscriptions`), qui compose enfants, liens et données de `billing` |
| `tutor` | Agent IA : session de chat, classeur de séance, outils, résumé de séance, garde-fous, statistiques d'étude |
| `learning` | Decks, cartes, révisions FSRS, génération de cartes |
| `documents` | Upload, liste des fichiers, extraction, analyse, stockage S3, fichiers prêts pour un tour de chat |
| `billing` | Formules Gratuit et Complet, budget quotidien en coût réel et accès aux fiches, table des coûts IA (`cost_tracking`, écrite par `platform/ai/cost.ts`), abonnement web. Module feuille : il n'importe aucun autre module |
| `voice` | Transcription et synthèse vocale (Voxtral) |
| `platform` | Config, DB, observabilité, erreurs |

Rangement physique, fixé à la refonte demandée le 2026-10-01 (une PR par module, lot 0) :

- `apps/server/src/platform/` : ce que tous les modules utilisent sans règle métier, et qui
  n'importe aucun module — `config/`, `db/` (migrateur), `auth/` (instance better-auth,
  lecture de session), `http/` (contexte Hono, gardes, validation, erreurs, rate limit),
  `observability/` (logger, OpenTelemetry, Sentry), `ai/` (client Mistral et coût de chaque
  appel, écrit dans la table de `billing` par `db/schema`), `lifecycle/`
  (vérification au démarrage).
- `apps/server/src/db/` : point de composition des données — le client Drizzle et le
  schéma qui réunit les tables de tous les modules (les requêtes relationnelles de Drizzle
  en ont besoin). Seule exception à la règle de l'index : ce schéma importe directement le
  fichier `*.schema.ts` de chaque module, car passer par `index.ts` chargerait routes et
  clients externes dans `drizzle-kit`. Pour la même raison, le `*.schema.ts` d'un module importe
  directement celui dont il référence une table par clé étrangère. `src/index.ts`, de même,
  démarre et arrête les jobs des modules.
- `apps/server/src/modules/<module>/` : routes Hono du module (montées par `app.ts` sur
  son préfixe), services, dépôts, tables Drizzle et schémas Zod, avec un `index.ts` pour
  ce que les autres modules ont le droit d'appeler.
- Les tests restent dans `src/tests/`, `src/integration-tests/` et `src/live/` (appels réels).

## Client web

Choix et options comparées : `etudes/2026-10-06/client-web.md`. **Pensé d'abord pour le
téléphone** : chaque parcours se conçoit et se prouve à largeur de téléphone, le bureau s'en
déduit.

En place (`apps/web`) : application monopage Vite + React + TanStack Router, Tailwind sur les
tokens `@repo/tokens`, tests Playwright à largeur de téléphone (WebKit et Chromium).

Cible :
- Consommateur du client typé via `@repo/api` ; aujourd'hui `apps/web` n'appelle pas encore le
  serveur.
- Installable (PWA, `vite-plugin-pwa`) : photo, voix et push passent par le web, sans application
  native en V1.
- Servie par Hono sur la même origine que l'API : cookies sans CORS ni blocage de Safari, un seul
  déploiement.
- Données par TanStack Query, formulaires par react-hook-form et Zod.
- Primitives `@repo/ui` (shadcn sur Radix). Base UI est écarté : sur iOS, il ne verrouille pas
  le défilement derrière un panneau quand la barre de Safari est repliée
  (`@base-ui/utils/useScrollLock.mjs`).
- Le chat consomme le protocole de l'AI SDK (`useChat` de `@ai-sdk/react`), déjà
  celui du serveur.

## Observabilité

- **En place** : logs pino avec un sérialiseur en liste blanche (aucun texte d'élève), spans
  OpenTelemetry de l'AI SDK sans entrées ni sorties (`recordInputs: false`), Sentry si un DSN est
  fourni ; aucun exporteur de traces en production.
- **Défaut connu** : l'AI SDK écrit le message d'erreur dans le span quel que soit `recordInputs`,
  et une erreur de validation y met la sortie du modèle ; `beforeSend` de Sentry ne nettoie que la
  requête. À corriger avant tout export.
- **Cible** (`etudes/2026-10-06/refonte-evaluation.md`, « Observabilité en production ») : traces et
  métriques sans identifiant ni texte, logs avec `trace_id`, erreurs dans un outil hébergé dans
  l'UE, rétentions courtes, accès réservé ; la destination se tranche avec l'hébergeur.

## Décisions ouvertes

Elles sont tranchées au démarrage du lot qui en dépend, doc-first, pas avant :

| Décision | Lot | Ce qui doit être vérifié |
|---|---|---|
| Hébergement web et serveur (UE) | 3 | Région UE, streaming SSE long, coût |
| Fournisseur de paiement web | 3 | Conformité UE, abonnement familial multi-enfants, facturation sans piège réalisable telle que la vision la définit |
| Landing : Astro à la place de Next.js (orientation du 2026-10-01 : site statique, SEO, HTML sans JavaScript par défaut, composants React en îlots) | 4 | Reprise de `@repo/ui` en îlots, hébergement, réécriture avec la nouvelle identité |
| Nom du produit | 4 | Marques et domaines (vision, « Marque ») |

## Ordre des lots

Voir `docs/roadmap.md`.
