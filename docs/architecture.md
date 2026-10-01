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
| Client V1 | **Web uniquement, Next.js, pensé d'abord pour le téléphone** | Un seul client à livrer ; le collégien travaille le soir, probablement sur téléphone, à vérifier (vision, « Pour qui ») |
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
| `auth` | Comptes parent (email, Google) et élève (username), sessions | `lib/auth.ts`, `lib/http.ts` |
| `family` | Rattachement parent ↔ enfants ; côté parent, résumé de la semaine et alerte de détresse, jamais les conversations | `services/parent/`, `parent.service.ts`, `routes/api/parent.routes.ts` |
| `tutor` | Agent IA : session de chat, outils, mémoire, résumé, garde-fous | `services/chat/`, `lib/ai/`, `episodic-memory.service.ts`, `cognitive-profile.service.ts` |
| `learning` | Decks, cartes, révisions FSRS | `services/learning/`, `fsrs.service.ts`, `routes/learning/` |
| `documents` | Upload, extraction, analyse, stockage S3 | `services/document/`, `services/storage/`, `routes/file-upload.routes.ts` |
| `billing` | Formules Gratuit et Complet, quotas, abonnement web | `services/quota/`, `subscription.service.ts`, `token-quota.service.ts` |
| `voice` | Transcription et synthèse vocale (Voxtral) | `voxtral-*.service.ts`, `audio-transcription.service.ts`, `text-to-speech.service.ts` |
| `platform` | Config, DB, observabilité, erreurs, rétention RGPD | `config/`, `db/`, `lib/otel/`, `lib/errors.ts`, `retention-purge.service.ts` |

Le découpage physique en modules se fait au fil des lots, sur le code qu'on
touche, pas en un big-bang.

## Client web

- `apps/web` en Next.js (App Router), consommateur du client typé via `@repo/api`.
- **Pensé d'abord pour le téléphone** : chaque parcours se conçoit et se prouve à largeur
  de téléphone, le bureau s'en déduit.
- Primitives `@repo/ui` (shadcn) et tokens `@repo/tokens`.
- Le chat consomme le protocole de l'AI SDK (`useChat` de `@ai-sdk/react`), déjà
  celui du serveur.

## Décisions ouvertes

Elles sont tranchées au démarrage du lot qui en dépend, doc-first, pas avant :

| Décision | Lot | Ce qui doit être vérifié |
|---|---|---|
| Next.js séparé qui appelle le serveur Hono, ou Hono monté dans une route Next | 3 | Doc Hono (adaptateur Vercel/Next.js), impact sur cookies et streaming |
| Hébergement web et serveur (UE) | 3 | Région UE, streaming SSE long, coût |
| Fournisseur de paiement web | 3 | Conformité UE, abonnement familial multi-enfants, facturation sans piège réalisable telle que la vision la définit |
| Sort de `apps/landing` : conservée ou absorbée par `apps/web` | 4 | SEO, un seul déploiement |
| Nom du produit | 4 | Marques et domaines (vision, « Marque ») |

## Ordre des lots

Voir `docs/roadmap.md`.
