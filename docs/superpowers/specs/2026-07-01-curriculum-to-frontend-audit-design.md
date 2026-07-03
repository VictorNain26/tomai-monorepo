# Audit d'architecture — chaîne curriculum → frontend (design)

Date : 2026-07-01. Validé par Victor.

## Objectif

Audit + recommandations de la chaîne complète curriculum → RAG → serveur → frontends (mobile + web), avec remise en question libre de chaque pilier de la stack ("tout est discutable"). Livrable : rapport d'audit avec verdicts par techno et plan de modernisation priorisé. L'implémentation suivra lot par lot, hors scope de cet audit.

## Contraintes non négociables

- **RGPD / EU-only strict** : données d'élèves mineurs — tout provider IA/infra recommandé doit rester UE.
- **Solo dev / maintenabilité** : technos mainstream bien documentées, limiter les couches exotiques.

## Découpage — 5 segments

| # | Segment | Périmètre | Piliers évalués |
|---|---------|-----------|-----------------|
| 1 | Ingestion curriculum | `apps/curriculum` (Éduscol → chunk → embed → Qdrant) | Python/uv, chonkie, pymupdf4llm, veille, contrat de données |
| 2 | Service embeddings | `apps/ai-service` | FastAPI, FlagEmbedding/BGE-M3, bge-reranker, torch CPU, Koyeb |
| 3 | RAG serveur | `rag.service`, `qdrant.service`, `ai-service.client`, tool-executor, prompt RAG | Qdrant hybrid RRF, seuils/scoring, architecture retrieval |
| 4 | Chat serveur → LLM | Routes chat SSE, Mistral, sessions, Elysia/Bun, Drizzle, Better Auth | Elysia 1.4, Bun 1.3, Mistral SDK, TypeBox/Eden |
| 5 | Frontends | `apps/mobile` + `apps/web` + `@repo/api` | Expo 56/RN 0.85, NativeWind v5, react-native-sse, Next 16, React Query, Eden Treaty |

La landing est hors scope (vitrine statique, pas de chaîne RAG).

## Méthode par segment

Sous-agent read-only avec brief précis (fichiers pivots issus de l'exploration préalable). Pour chaque pilier :

1. Version installée vs dernière stable + santé du projet, vérifié doc-first (sources citées).
2. Alternatives 2026 crédibles, filtrées RGPD/EU + solo-dev. Remplacement proposé seulement si gain net > coût de migration.
3. Qualité de l'intégration dans le code réel (patterns, coutures).

Les coutures repérées en exploration sont vérifiées dans le segment concerné : prefetch RAG ~16× topK (double amplification `rag.service.ts:119` + `qdrant.service.ts:143`), scores RRF affichés en % cosine + filtrage `MIN_SCORE` inopérant en hybride (`rag.service.ts:120-127, 308-317`), nom de collection en défaut dur triplé, label OTel `provider: 'mistral_ai'` sur BGE-M3 self-hosted, package `@repo/chat-core` sans `name`.

## Exécution

5 segments en parallèle (sous-agents lecture + recherche doc). Synthèse par l'orchestrateur : cohérence inter-segments, arbitrages, revue adversariale des recommandations de remplacement (« qu'est-ce que ça casse ? »).

## Livrable

`docs/audits/2026-07-01-curriculum-to-frontend-architecture.md` :

- diagramme du flux + verdict par pilier (garder / mettre à jour / remplacer, source citée) ;
- findings code (fichier:ligne) classés bloquant / important / mineur ;
- plan de modernisation priorisé en lots livrables (chacun PR-able indépendamment) ;
- hors scope explicite : l'implémentation.

Aucune modification de code pendant l'audit.
