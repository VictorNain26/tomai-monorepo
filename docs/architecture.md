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
| Client V1 | **Web uniquement, application monopage (orientation : Vite, React, TanStack Router), pensée d'abord pour le téléphone** | Un seul client à livrer ; le collégien travaille le soir, probablement sur téléphone, à vérifier (vision, « Pour qui ») |
| Application native | **Hors V1** ; `apps/mobile` supprimé au lot 0 (l'historique git le garde) | Code mort à maintenir sinon |
| Topologie | **Un dépôt, backend en monolithe modulaire** | `ai-service` et `curriculum` séparés ont pourri puis été supprimés ; un service séparé ne se justifie que par une contrainte réelle |
| Serveur | Bun + Hono (Elysia remplacé le 2026-10-01) | Client typé de bout en bout (`hono/client`) ; adoption et maintenance bien plus larges qu'Elysia, qui reposait sur un seul mainteneur ; tourne sur Bun, Node et l'edge |
| LLM | **Mistral**, stack 100 % UE | Souveraineté, données de mineurs (RGPD) |
| Modèle de chat | **Mistral Small 4** (`mistral-small-2603`), multimodal | Voir `agent.md` |
| Référentiel de conception IA | Guides de certification Claude (Architect Foundations, Architect Professional, Developer Foundations), pratiques indépendantes du fournisseur | Pratiques reconnues, auditables |
| Pronote | **Hors V1** : module, `pawnote`, tables et routes retirés au lot 0 | Accès non officiel, cassé par la version 2026 de Pronote ; il ne revient que par une convention avec Index Éducation (vision, « Périmètre V1 ») |
| Paiement | Web, **à facturation sans piège** (vision, « Offre et prix ») | Premier reproche des parents dans les avis |

## Monolithe modulaire

Chaque module expose une interface publique (`index.ts`) ; un module n'importe
jamais les fichiers internes d'un autre. Découpage cible, tiré du code actuel de
`apps/server/src` :

| Module | Responsabilité | Code actuel |
|---|---|---|
| `auth` | Comptes parent (email, Google) et élève (username), création d'un compte élève, mot de passe ; le moteur de session (better-auth, gardes) est dans `platform/` et lit les tables par `db/schema` | `modules/auth/` |
| `family` | Rattachement parent ↔ enfants ; côté parent, résumé de la semaine et alerte de détresse, jamais les conversations ; lecture du statut et de l'usage d'abonnement (`/api/subscriptions`), qui compose enfants, liens et données de `billing` | `modules/family/` |
| `tutor` | Agent IA : session de chat, classeur de séance, outils, résumé de séance, garde-fous, statistiques d'étude | `modules/tutor/` |
| `learning` | Decks, cartes, révisions FSRS, génération de cartes | `modules/learning/` |
| `documents` | Upload, liste des fichiers, extraction, analyse, stockage S3, fichiers prêts pour un tour de chat | `modules/documents/` |
| `billing` | Formules Gratuit et Complet, quotas de tokens et de fiches, suivi des coûts IA, abonnement web. Module feuille : il n'importe aucun autre module | `modules/billing/` |
| `voice` | Transcription et synthèse vocale (Voxtral) | `modules/voice/` |
| `platform` | Config, DB, observabilité, erreurs | `platform/` (config, migrateur, auth, http, observabilité, IA, cycle de vie) |

Rangement physique, fixé à la refonte demandée le 2026-10-01 (une PR par module, lot 0) :

- `apps/server/src/platform/` : ce que tous les modules utilisent sans règle métier, et qui
  n'importe aucun module — `config/`, `db/` (migrateur), `auth/` (instance better-auth,
  lecture de session), `http/` (contexte Hono, gardes, validation, erreurs, rate limit),
  `observability/` (logger, OpenTelemetry, Sentry), `ai/` (client Mistral), `lifecycle/`
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
- Les tests restent dans `src/tests/` et `src/integration-tests/`.

## Client web

- `apps/web` en application monopage Vite + React + TanStack Router (orientation du 2026-10-01, confirmée au démarrage du lot 3), consommateur du client typé via `@repo/api`.
- **Pensé d'abord pour le téléphone** : chaque parcours se conçoit et se prouve à largeur
  de téléphone, le bureau s'en déduit.
- Primitives `@repo/ui` (shadcn) et tokens `@repo/tokens`.
- Le chat consomme le protocole de l'AI SDK (`useChat` de `@ai-sdk/react`), déjà
  celui du serveur.

## Décisions ouvertes

Elles sont tranchées au démarrage du lot qui en dépend, doc-first, pas avant :

| Décision | Lot | Ce qui doit être vérifié |
|---|---|---|
| Client web : SPA Vite + React + TanStack Router (orientation du 2026-10-01 : derrière une connexion, sans besoin de SEO ni de rendu serveur ; Vite 219 M et TanStack Router 28 M téléchargements par semaine) | 3 | Fichiers servis par Hono sur la même origine que l'API (cookies sans CORS) ou par un hébergeur statique ; intégration de `@repo/ui` et de `useChat` |
| Hébergement web et serveur (UE) | 3 | Région UE, streaming SSE long, coût |
| Fournisseur de paiement web | 3 | Conformité UE, abonnement familial multi-enfants, facturation sans piège réalisable telle que la vision la définit |
| Landing : Astro à la place de Next.js (orientation du 2026-10-01 : site statique, SEO, HTML sans JavaScript par défaut, composants React en îlots) | 4 | Reprise de `@repo/ui` en îlots, hébergement, réécriture avec la nouvelle identité |
| Nom du produit | 4 | Marques et domaines (vision, « Marque ») |

## Ordre des lots

Voir `docs/roadmap.md`.
