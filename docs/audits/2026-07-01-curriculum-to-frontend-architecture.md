# Audit d'architecture — chaîne curriculum → frontend

> **STATUT (2026-07-07)** : feuille de route active, mais photo au 2026-07-01 —
> le suivi à jour des lots vit dans `docs/architecture/system-design.md` §8.
> Livrés depuis : lot 1 (#262), lot 2 (#265), lot 3 ai-service embed-only (#266),
> lot 4 chat AI SDK (#268) ; `apps/web` supprimée en avance de phase (2026-07-06,
> hardening lot 8) ; Sentry actif partout. Attention : l'« ancien arbitrage n°1 »
> (garder apps/web) est inversé par l'addendum du même document — seule la
> version addendum (app universelle, ADR 0001) fait foi.

Date : 2026-07-01. Méthode : 5 segments audités en parallèle (code réel + vérification doc-first, sources citées), synthèse et revue adversariale par l'orchestrateur. Cadrage validé : audit + recommandations, mobile + web, « tout est discutable », contraintes RGPD/EU-only strict et solo dev. Design : `2026-07-01-curriculum-to-frontend-audit-design.md` (supprimé, historique git).

Les deux affirmations les plus lourdes ont été re-vérifiées de visu par l'orchestrateur (pas seulement par les sous-agents) : le SDK Mistral 2.2.5 installé expose `promptCacheKey`/`reasoningEffort` (`node_modules/.pnpm/@mistralai+mistralai@2.2.5/.../chatcompletionstreamrequest.d.ts:99,105`), et le gate flashcards compare des scores RRF à un seuil cosine (`card-generate.routes.ts:90-93`).

## Flux audité

```
Éduscol (BO) → apps/curriculum (chunk chonkie + contextual → embed HTTP) 
             → apps/ai-service (BGE-M3 dense+sparse, FlagEmbedding, Koyeb CPU)
             → Qdrant Cloud `tomai_educational` (dense 1024D + bm25 IDF, fusion RRF)
             → apps/server (Bun/Elysia : rag.service → tool search_educational_content → Mistral SSE)
             → @repo/api (Eden Treaty) → apps/mobile (Expo 56) + apps/web (Next 16)
```

## Verdict global

**L'architecture est saine et les choix de stack sont défendables en 2026 — aucun pilier n'est à remplacer.** Chaque proposition de remplacement examinée (pgvector à la place de Qdrant, Hono/Fastify à la place d'Elysia/Bun, Vercel AI SDK, Agents API Mistral, nouveaux modèles d'embedding, Docling) a un coût de migration supérieur au gain net dans le contexte EU + solo dev. Les versions sont remarquablement fraîches sur toute la chaîne (lockfiles quasi à jour partout).

En revanche, l'audit sort **1 bug produit P0** (flashcards cassées en prod), **1 risque prod P0** (OOM latent ai-service), **1 mise à jour de sécurité** (Better Auth), et **3 dettes structurantes** (scoring RRF incohérent, contournement SDK Mistral obsolète, duplication chat mobile/web).

---

## Verdicts par pilier

### Garder tel quel (à jour, sains)

| Pilier | Version | Note |
|---|---|---|
| Bun 1.3 + Elysia 1.4.28 | dernières | Bus factor Elysia (quasi mono-mainteneur) = risque structurel n°1 de la stack ; surveiller trimestriellement. Le lock-in réel est Eden Treaty (types end-to-end), pas Elysia. Migration Hono : coût >> gain tant qu'Elysia patche. |
| Drizzle 0.45.2 | dernier stable | v1.0-rc (RQB v2) : ne PAS adopter avant GA. |
| Qdrant Cloud + client 1.18 | dernières | pgvector (déjà dans Postgres) migrable techniquement mais perte du sparse learned BGE-M3 + RRF SQL maison + réindexation → non rentable. Revisiter seulement si abandon de l'hybride. |
| BGE-M3 via FlagEmbedding 1.4.0 | dernière (04/2026) | Seule lib exposant le sparse natif (Infinity/TEI toujours pas — [issue #146](https://github.com/michaelfeil/infinity/issues/146)). Qwen3-Embedding/Arctic-Embed meilleurs au MTEB mais dense-only : bascule = perte du gain sparse mesuré (+8.4 pp cid_recall) + réindexation → gain net négatif. |
| FastAPI/uvicorn/pydantic/torch CPU | à jour | RAS. |
| Stratégie chunking | — | Recursive 400 tok + contextual prefix déterministe + hybride RRF = état de l'art 2026 ([Anthropic contextual retrieval](https://www.anthropic.com/news/contextual-retrieval)). Semantic/late chunking non nécessaires sur un corpus BO structuré. |
| chonkie 1.6.6, httpx 0.28.1, qdrant-client 1.18, pydantic | quasi dernières | Bumps patch opportunistes. |
| Next 16.2.6 (web), React Query 5.90, Eden Treaty 1.4.9 | fraîches | Bump patch Next 16.2.9. Vigilance : lockstep Elysia/Eden à chaque bump serveur. |
| Expo SDK 56 / RN 0.85 / React 19.2 | n-1 | SDK 57 sorti le 30/06/2026, non-breaking — bump après merge de la branche en cours. |
| NativeWind 5.0.0-preview.4 | preview | Seul pilier pré-release en prod. Promotion stable en cours ([#1818](https://github.com/nativewind/nativewind/discussions/1818)) — bumper dès la stable, ne rien migrer. |
| Zod 4 + TypeBox 0.34 | à jour | Pas de redondance réelle : TypeBox = routes Elysia/Eden, Zod = frontières hors-route. Garder les deux. |
| @repo/tokens | — | La pièce la mieux conçue du front : source unique CSS+TS avec test de cohérence. |
| pymupdf4llm (AGPL) | 1.27 | Risque licence FAIBLE : usage strictement offline (`extract_pdfs.py`), jamais dans un service déployé. À cadenasser : corriger `license=MIT` trompeur dans `pyproject.toml:7`, documenter la barrière offline. Docling (MIT) = remplaçant sûr si l'ambiguïté gêne. Éviter Marker (GPL + plafond revenus). |

### Mettre à jour (action requise)

| Pilier | Action | Pourquoi |
|---|---|---|
| **Better Auth 1.6.13 → 1.6.23** | bump cette semaine + dédupliquer (1.6.11 et 1.6.13 coexistent dans le lockfile) | 10 patchs de retard sur la lib d'**auth** ; [security update juin 2026](https://better-auth.com/blog/security-update-june-2026) + GHSA-xr8f-h2gw-9xh6 (avril 2026). Vérifier les advisories contre la config Google OAuth + account linking avant bump. |
| **SDK Mistral 2.2.5 → 2.3.0** | bump + **supprimer le contournement HTTP maison** | Le SDK 2.2.5 expose déjà `promptCacheKey`/`reasoningEffort` (vérifié de visu). Le commentaire `mistral-client.ts:5-8` (« absent du SDK, confirmé v2.2.1 ») est périmé : 100 % du chat prod passe par ~140 lignes de parser SSE maison (`mistral-client.ts:143-191, 381-485`) pour rien. ⚠️ Vérifier la provenance npm (attaque supply-chain Mistral mai 2026). |

### Remplacer / trancher

| Pilier | Verdict |
|---|---|
| **react-native-sse 1.2.1** | **Remplacer par `expo/fetch` streaming** (natif depuis SDK 52, [approche officielle AI SDK Expo](https://ai-sdk.dev/docs/getting-started/expo)). Lib morte depuis ~2 ans, incompatible web. Spike de validation des polyfills streams d'abord. |
| **Rerank bge-reranker-v2-m3** | **Retirer du service maintenant** (position tranchée, cf. arbitrages). 15-19 s/25 chunks CPU, off par défaut → ~1-2 Go de RAM chargés pour zéro appel, et cause directe du risque OOM. Réévaluer plus tard via ONNX INT8 + bench golden set si un gain qualité est démontré. |
| **@repo/chat-core** | **Concrétiser** (aujourd'hui : dossier mort, ni package.json ni source ni import). Cible : cœur chat transport-agnostique partagé mobile/web. |
| **Branche `feat/universal-web-target`** | **Requalifier en outil de dev/preview** (web-smoke Playwright), **pas produit web de prod**. Le produit web reste `apps/web` (Next). Cf. arbitrages. |

---

## Findings code

### Bloquants (P0)

1. **Génération de flashcards cassée en prod** — `apps/server/src/routes/learning/card-generate.routes.ts:90-93` gate `averageSimilarity >= GOOD_SCORE (0.5)` alors que les scores RRF moyens ≈ 0.02 (`rag.service.ts:28,170-175`). En mode `qdrant-hybrid-rrf` (défaut prod, rerank off), `hasGoodSimilarity` est toujours false → **400 `TOPIC_NOT_IN_CURRICULUM` sur toute génération**. Vérifié de visu. Le commentaire `rag.service.ts:120-127` documente l'incomparabilité RRF/cosine… que `card-generate` viole.
2. **OOM latent ai-service** — cible « eco-large 4 GB » (`Dockerfile:6`) vs ~5 GB FP32 runtime (`USE_FP16=auto` → FP32 sur CPU, `config.py:20`). Résolu de fait en retirant le reranker (~-1-2 Go), sinon forcer FP16 (valider le recall) ou monter d'instance.
3. **Orphelins à la mise à jour d'un programme** — `ingest.py:446-486` : IDs `uuid5(content-hash)` → un BO modifié crée de nouveaux points, les anciens ne sont jamais supprimés (ni delete-by-source_file, ni alias blue-green ; seule voie = `--recreate` destructif). Des chunks périmés restent servables aux élèves comme contenu officiel. (Confirme la mémoire projet `rag-cloud-sot-and-update-pattern` — le besoin est maintenant avéré.)

### Importants

- **Scores reranker jetés** — `rag.service.ts:155-159` remappe vers les résultats originaux (score RRF conservé) : même rerank activé, les seuils resteraient cassés. À corriger le jour où le rerank revient.
- **`minSimilarity` ignoré silencieusement** — l'option existe dans l'interface (`rag.service.ts:43`) mais n'est lue nulle part ; `document-analysis.service.ts:318` passe 0.6 en croyant filtrer. No-op.
- **Prefetch 16× au lieu de 4×** — `rag.service.ts:119` (`max(topK*4,20)`) passé comme `limit` à `qdrant.service.ts:143` qui re-multiplie (`max(limit*4,20)`) → 80 candidats/branche pour topK=5. Perf négligeable (petite collection) mais sémantique fausse ; séparer `finalLimit`/`prefetchLimit`.
- **Contexte LLM : scores RRF affichés en %** — `rag.service.ts:307-311` : le modèle voit `[2%]` sur des matches pertinents. Remplacer par un rang.
- **Retrieval non déterministe** — le RAG repose sur l'obéissance au prompt (`rag-policy.ts:12`), aucun `toolChoice` (grep vide). Le modèle peut répondre sans consulter le programme. Gater un retrieval forcé sur l'intent classifier ministral-8b existant.
- **Latence de dégradation ~31 s** — timeout embed 15 s × 2 retries (`tool-executor.ts:81-107`) sur le chemin conversationnel si ai-service répond au /health mais timeout sur /embed.
- **Pas de span OTel GenAI sur le streaming** — `chatStream` (chemin produit principal, poste de coût n°1) non wrappé `withGenAiSpan`, contrairement à `generateText`/`generateStructured`. Découle du contournement HTTP (le supprimer débloque l'instrumentation).
- **`payload.section` ≈ nom de matière** — `ingest.py:149-194,304-352` : le vrai sous-titre BO (« Nombres et calculs ») n'est pas propagé → préfixe contextuel redondant (« Mathématiques, section Mathématiques »), bénéfice du contextual retrieval affaibli.
- **Veille non bouclée et cassant la structure** — `veille_programmes.py:70-87,317-345` : détection sans ré-ingestion, et conversion `pdftotext -layout` (.txt plat) alors que le pipeline dépend des `##` du .md pymupdf4llm.
- **Tokenizer Mistral pour chunker de l'embedding BGE-M3** — `ingest.py:283-301` : ~500 MB de `mistral-common` pour compter des tokens sans rapport avec le tokenizer XLM-R de l'embedder. Vestige de mistral-embed. Remplacer par le tokenizer BGE-M3 ou une heuristique.
- **Duplication chat mobile/web** — même contrat serveur, deux machineries : timeout 90 s dupliqué (`useStreamManager.ts:64` / `stream-chat.ts:53`), types de chunks redéfinis, parseurs différents, `chatQueryKeys` dupliqués (~650 l. mobile vs ~380 l. web). Divergence déjà réelle : le web caste `role` sans filtrer les messages `system` (`apps/web/lib/hooks/use-chat.ts:88`) là où le mobile filtre correctement.
- **Cold start Koyeb** — `HF_HOME=/data/hf_cache` persistant seulement si un volume est monté (non vérifiable dans le repo) ; sinon scale-to-zero = re-download ~3.5 Go > `start-period` 180 s → crashloop healthcheck possible. À vérifier côté Koyeb.
- **Historique non borné côté fichiers** — `chat-message.service.ts:29-35` : `messagesWithFiles` réinjectés en entier à chaque tour, croissance du contexte/coût sans borne.
- **État mono-instance** — cap SSE (`chat-message.routes.ts:21`) et rate-limit (`rate-limit.middleware.ts:57`) en Map mémoire : un 2ᵉ pod doublerait silencieusement les limites. Dette à tracer pré-scale-out, pas d'action immédiate.

### Mineurs

- Label OTel `provider: 'mistral_ai'` sur les spans BGE-M3 self-hosted (`ai-service.client.ts:84,128`) — télémétrie coûts faussée.
- Hash d'audit RGPD `sha256` sans sel (`retrieval-audit.repository.ts:32-34`) — passer en HMAC à clé.
- Args de tool non parsables avalés en `{}` (`mistral-chat.service.ts:322-331`) — renvoyer un ToolError au modèle.
- Head-of-line blocking du lock embed partagé batch/query (`main.py:57,89`) — impact limité (indexation rare), à documenter.
- `license = MIT` dans `pyproject.toml:7` de curriculum malgré la dépendance AGPL.
- Divergence doc port ai-service 8000/8001 ; `chunk_index` non contigu ; `_cycle` code mort ; `contract.json` déclare le lycée non indexé ; pas de boot-check du schéma de collection (dense 1024D + bm25/IDF).

### Points forts confirmés (à préserver)

Fencing anti-injection systématique + `stripPromptTags` + `detectSystemPromptLeak` ; auth stream solide (guard → rate-limit par user → quota → cap) ; `prompt_cache_key` stable partagé entre élèves ; usage tokens sommé multi-tours ; rate-limit fail-closed ; dégradation gracieuse du RAG (pas de fallback silencieux) ; client ai-service curriculum robuste (warming, retry, troncature détectée) ; config Qdrant soignée (quantization int8, payload indexes) ; @repo/tokens avec test de cohérence ; auth cross-platform propre.

---

## Arbitrages (positions tranchées)

**1. Web : garder `apps/web` (Next), requalifier l'Expo universel en outil de preview.** Deux produits distincts (app native élève vs web role-aware avec dashboard parent), la SPA react-native-web (`output:'single'`) serait une régression vs Next + shadcn déjà construits, et la friction native est déjà visible (3 web-gates en 4 commits sur la branche). La duplication chat — vraie motivation de l'universalisation — se résout par le partage de logique, pas par le partage d'UI. La branche `feat/universal-web-target` garde sa valeur comme smoke-test navigateur des écrans natifs en dev.

**2. Rerank : retirer maintenant, réévaluer plus tard.** Il n'a jamais tourné en prod (flag off), il est inutilisable sur CPU (15-19 s), Mistral n'offre pas de rerank API EU (vérifié [docs.mistral.ai/api](https://docs.mistral.ai/api/)), et sa présence en RAM cause le risque OOM. L'hybride dense+sparse+RRF+contextual est déjà l'état de l'art sans lui. Voie de retour si besoin démontré par le golden set : ONNX INT8 + re-bench. Résout la décision ouverte de la mémoire `rag-serving-rerank-decision`.

**3. Scoring : refonder sur « nombre de résultats + rang », pas sur des pseudo-similarités.** En mode RRF les scores absolus n'ont pas de sens (et leur magnitude dépend du `k` par défaut de la version Qdrant serveur — [doc hybrid queries](https://qdrant.tech/documentation/concepts/hybrid-queries/)). Gate flashcards sur `hasValidResults` (+ éventuel seuil sur le score dense brut du prefetch si nécessaire), contexte LLM avec des rangs, suppression des seuils morts.

**4. Pas de nouvelle couche d'abstraction IA.** Ni Vercel AI SDK (protocole chunk custom, gain nul vs SDK Mistral natif), ni Agents API Mistral (état conversationnel chez Mistral + tools hors périmètre RGPD). La simplification vient de la suppression du contournement HTTP, pas d'un framework de plus.

---

## Plan de modernisation priorisé

Chaque lot = une branche courte PR-able, dans l'ordre.

**Lot 1 — Correctifs P0 scoring/flashcards (serveur).** Gate `card-generate` sur `hasValidResults` (suppression du seuil cosine sur scores RRF), rangs au lieu de `[X%]` dans `buildContext`, suppression de `minSimilarity` mort ou implémentation réelle, séparation `finalLimit`/`prefetchLimit`. Tests de non-régression sur le gate. *Effort : faible. Impact : restaure une feature produit cassée.*

**Lot 2 — Sécurité deps.** Better Auth 1.6.23 partout + dédup lockfile (advisories vérifiées contre la config), SDK Mistral 2.3.0 (provenance npm vérifiée). *Effort : faible.*

**Lot 3 — SDK Mistral natif + observabilité.** Supprimer le chemin HTTP/SSE maison de `mistral-client.ts` (passer `promptCacheKey`/`reasoningEffort` au SDK), unifier le retry, wrapper le streaming en `withGenAiSpan`, corriger le label provider OTel. *Effort : moyen. Impact : -140 lignes fragiles + le poste de coût n°1 enfin tracé.*

**Lot 4 — ai-service dégraissé.** Retirer le reranker (code + modèle + flag), trancher FP16/instance, vérifier volume HF Koyeb ou baker les modèles dans l'image, borner le timeout embed du chemin chat. *Effort : moyen. Impact : OOM éliminé, cold start maîtrisé, -1 dépendance.*

**Lot 5 — Cycle de vie de l'index curriculum.** Delete-by-`source_file` avant ré-ingest (minimum viable) ; veille produisant du .md structuré et enchaînant sur le ré-ingest ; propagation du vrai sous-titre BO dans `payload.section` ; retrait du tokenizer Mistral du chunking. *Effort : moyen. Impact : « BO change → index à jour » enfin bouclé, contextual retrieval réparé.*

**Lot 6 — @repo/chat-core réel.** Extraire types de chunks, parseur SSE, query keys, timeout, mapping, machine à états ; adaptateurs de transport par plateforme ; migrer le mobile vers `expo/fetch` (spike d'abord) et retirer `react-native-sse` ; corriger le filtrage `system` côté web au passage. *Effort : élevé. Impact : duplication tuée, transport unifié, dépendance morte retirée.*

**Lot 7 — Retrieval déterministe.** Forcer le tool RAG (`toolChoice`) quand l'intent classifier détecte une question scolaire. *Effort : faible-moyen. À faire après le lot 1 (scoring sain d'abord).*

**Fond de tâche (opportuniste)** : bumps Next 16.2.9, Expo 57, NativeWind stable, pydantic/chonkie patch ; hygiène licence pyproject ; HMAC audit RGPD ; borne `messagesWithFiles` ; ToolError sur args malformés ; documentation invariants (credentials omit/include, mono-instance, contention lock embed).

## Hors scope de cet audit

L'implémentation des lots (chacun suivra plan → implementer → revue). Non vérifiable depuis le code, à confirmer côté infra : région EU du cluster Qdrant Cloud, volume persistant Koyeb, stabilité FP16 CPU, formule d'ID dans `generate_golden.py`.

---

# Addendum (même jour) — révision sous nouveau critère

Victor a modifié le critère d'arbitrage après lecture : **le coût de migration ne compte plus**. On vise la meilleure techno robuste et éprouvée ; le code custom n'est acceptable que s'il n'existe rien de plus solide sur étagère. Il refuse par ailleurs la duplication mobile/web (« pas 2× plus de dev »), et précise que **l'app n'est pas en prod** (zéro user, breaking changes et réindexations libres). Deux ré-évaluations doc-first ont été menées sous ce critère. Les sections ci-dessous **remplacent** les arbitrages 1, 2 et 4 du rapport principal.

## Retrieval révisé

**Fait décisif vérifié dans le code** : le sparse ingéré est bien le `lexical_weights` natif BGE-M3 (`embed.py:64-72` → `ingest.py:612-619`), pas le BM25 de Qdrant. Le custom est load-bearing.

**Le tour complet du marché managé EU 2026 confirme un trou précis** : personne n'expose le sparse natif BGE-M3 — ni [Qdrant Cloud Inference](https://qdrant.tech/documentation/cloud/inference/) (catalogue anglo-centré : MiniLM/mxbai/splade-EN/miniCOIL, pas de BGE-M3, modèles gratuits hébergés US), ni [OVHcloud AI Endpoints](https://www.ovhcloud.com/en/public-cloud/ai-endpoints/catalog/bge-m3/) (sert pourtant **bge-m3 managé EU à ~0,01 €/1M tokens — mais dense uniquement**), ni Scaleway (bge-multilingual-gemma2/qwen3-embedding, dense only), ni Mistral (inférieur mesuré : 0.810 vs 0.894), ni TEI (SPLADE pooling seulement), ni Infinity ([issue #146](https://github.com/michaelfeil/infinity/issues/146) toujours ouverte).

**Verdict : l'ai-service survit au critère « custom seulement si rien de plus solide » — mais réduit à l'embedding seul.**

- **Rerank : supprimé entièrement** (code `rerank.py`, client, flags env, stage-2 de `rag.service.ts`). Aucune option viable : Jina est passée sous contrôle **Elastic** (oct. 2025, DPA Elastic/CLOUD Act — exclu pour données de mineurs) ; le « rerank » Scaleway est un cosine d'embeddings, pas un cross-encoder ; OVH/Mistral n'ont rien ; ONNX INT8 CPU estimé 1-4 s/25 paires (borderline) ; GPU EU ~500-680 €/mois (disproportionné). Et la littérature 2026 converge : corpus < 1000 chunks propre + hybride tuné + topK 5 = cas d'école du rerank non rentable. Bénéfice de la suppression : ~-2 GB RAM → OOM (P0 n°2) résolu, instance eco-medium possible.
- **Alternative « zéro custom » documentée et écartée** : OVH bge-m3 (dense) + BM25 natif Qdrant → ai-service supprimé entièrement, tout managé EU, au prix de **-3.7 pp de recall mesuré** sur le vocabulaire scolaire. Écartée car la qualité FR-éducatif prime et BM25 est strictement moins bon que le sparse appris. Si ce -3.7 pp devenait acceptable un jour, c'est la sortie propre.
- **Deux A/B gratuits avant de figer** (collection sandbox, app pas en prod) : (1) `Modifier.IDF` on/off — la config actuelle (`migrate_collection.py:79-86`) applique une re-pondération IDF que les lexical_weights déjà appris de BGE-M3 n'attendent pas (recette canonique = dot product sans IDF) ; (2) re-chiffrer dense+BM25 vs dense+sparse sur le golden set pour actualiser le -3.7 pp.

## Frontend révisé — une seule app produit

**L'ancien arbitrage n°1 (garder apps/web Next, universal-web = preview) est inversé.** Sous le critère « zéro duplication », la seule architecture cohérente est **une app Expo universelle unique** (iOS + Android + web), pattern prouvé en prod à grande échelle par [Bluesky](https://github.com/bluesky-social/social-app) (web+iOS+Android, un repo, react-native-web, gates `.web.tsx`) et X.com.

**Cette décision est déjà actée par l'[ADR 0001](../adr/0001-universal-consumer-app.md) (PR #260, 2026-06-30)**, qui fait autorité sur la structure d'apps : app conso universelle renommée `apps/app` au cutover, landing Next conservée, console B2B future en Next dédié, Pronote natif-only, **pas de package de logique partagée** (reuse-first : les hooks/écrans du mobile existant servent le web tels quels, coutures plateforme via `.web.ts`/`.native.ts`). L'idée `@repo/chat-core` évoquée en première analyse est **abandonnée au profit de l'ADR** — avec une seule app, le code partagé, c'est l'app. Le présent audit ajoute à l'ADR la décision de la **couche chat** (ci-dessous), qui supprime même la couture streaming `.web.ts`/`.native.ts` que l'ADR prévoyait de gérer à la main.

```
apps/
  app/       ← Expo universel (ADR 0001, remplace mobile + web) : role-aware
               (student)/(parent), expo-router, static rendering (PAS de SSR
               alpha ni RSC expérimental), NativeWind v5, natif gated .native/.web
  landing/   ← Next, inchangée (SEO/SSG mûr, ne partage rien avec l'app)
  server/    ← Elysia/Bun
packages/
  api/       ← Eden Treaty conservé pour le CRUD non-chat ; héberge aussi les
               types partagés du chat (UIMessage custom, data parts) si besoin
```

**Couche chat standardisée sur Vercel AI SDK v5** — supprime le protocole custom des trois côtés :
- Serveur : `streamText()` (`@ai-sdk/mistral`) + `.toUIMessageStreamResponse()` = `Response` standard, fonctionne sur Bun/Elysia ([cookbook officiel](https://ai-sdk.dev/cookbook/api-servers/hono)) ; tools Zod + multi-tours via `stopWhen: stepCountIs(n)` (couvre `search_educational_content`) ; persistance via `onFinish`.
- Clients : un seul `useChat` (`@ai-sdk/react`), [officiellement supporté sur Expo](https://ai-sdk.dev/docs/getting-started/expo) et web.
- `promptCacheKey` Mistral : non exposé par le provider → injecté via `fetch` custom du provider (le cache à 10 % du coût input est conservé).
- `deck_created` → data parts typées du `UIMessage` (first-class v5).
- Disparaissent : `chat-streaming-types.ts` (protocole maison), le contournement HTTP de `mistral-client.ts` (l'AI SDK remplace aussi l'ancien lot 3), `react-native-sse`, les 2 parseurs clients, les 2 jeux de query keys, les timeouts dupliqués — et **`apps/web` entièrement** (au cutover prévu par l'ADR 0001).

**Le prix assumé (validé)** : le dashboard parent quitte shadcn/ui pour react-native-web + NativeWind. Écart réel surtout sur les composants riches (tables) ; NativeWind v5 garde la syntaxe Tailwind et Bluesky prouve que du web dense en RNW tient en prod.

**Solito écarté** (n'a de sens qu'en couple Next+Expo qu'on ne garde pas), **Tamagui écarté** (ne pas empiler deux systèmes de style), **React Strict DOM** trop émergent.

## Plan de modernisation révisé

Remplace le plan du rapport principal. L'app n'étant pas en prod, aucun chemin de transition — on vise directement la cible.

1. **Lot 1 — P0 scoring/flashcards** (inchangé) : gate `card-generate` sur `hasValidResults`, rangs au lieu de `[X%]`, suppression seuils morts, séparation prefetch/limit.
2. **Lot 2 — Sécu deps** (inchangé) : Better Auth 1.6.23 + dédup, provenance npm vérifiée.
3. **Lot 3 — ai-service embed-only** : suppression complète du rerank (service + client + env + rag.service), FP16/instance tranché, volume HF Koyeb vérifié, timeout embed chat borné. + les 2 A/B sandbox (IDF, sparse vs BM25).
4. **Lot 4 — Chat sur AI SDK v5 (serveur d'abord)** : `streamText`/`toUIMessageStreamResponse` sur Elysia, tools Zod, middleware `prompt_cache_key`, `onFinish` persistance, OTel GenAI sur le streaming ; types partagés (UIMessage custom, data parts) exportés via `@repo/api`. Rend obsolète l'ancien lot 3 (contournement HTTP). Pas de package chat-core (ADR 0001).
5. **Lot 5 — App universelle** : suivre la roadmap de l'ADR 0001 (`docs/adr/0001-universal-consumer-app.md`) — cible web + pilote 1 écran (gate go/no-go), parité conso, puis cutover (`apps/mobile` → `apps/app`, **suppression d'`apps/web`**, réconciliation doc), avec `useChat` branché des deux rôles.
6. **Lot 6 — Cycle de vie index curriculum** (inchangé) : delete-by-source_file, veille bouclée en .md structuré, vrai sous-titre dans `payload.section`, retrait du tokenizer Mistral.
7. **Lot 7 — Retrieval déterministe** : tool RAG forcé (`toolChoice` AI SDK) sur intention scolaire.

Fond de tâche inchangé (bumps, hygiène licence, HMAC audit, bornes historique fichiers).
