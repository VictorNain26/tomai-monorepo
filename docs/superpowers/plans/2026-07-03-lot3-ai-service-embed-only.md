# Lot 3 — ai-service embed-only (suppression du rerank) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Supprimer entièrement le reranker bge-reranker-v2-m3 (jamais actif en prod, inutilisable sur CPU, cause de l'OOM latent) : `apps/ai-service` devient embed-only (BGE-M3 dense+sparse conservé tel quel), le serveur perd le stage-2 et ses flags, et `USE_FP16` devient explicite (plus de `auto`).

**Architecture:** Suppression symétrique en 3 couches : serveur TS (stage-2 + flags env + client), service Python (endpoint + modèle + dépendance), infra/docs (compose, Dockerfile, doctor, smoke-test CI, READMEs). Décision d'audit : `docs/audits/2026-07-01-curriculum-to-frontend-architecture.md` (addendum, « Retrieval révisé »). Aucune option managée EU n'existe (Jina→Elastic exclu, Scaleway = pseudo-rerank) et la littérature 2026 dit « skip » sur un corpus < 1000 chunks en hybride tuné.

**Tech Stack:** Bun 1.3/Elysia (server), Python 3.12/FastAPI/uv (ai-service), Bun test + pytest, Docker Compose.

## Global Constraints

- Validation TS avant commit : `cd apps/server && bun run typecheck && bun run lint && bun run test` (zéro warning) ; avant push AUSSI `bun run test:integration`.
- Validation Python : `cd apps/ai-service && uv sync && uv run pytest` (tous les tests passent).
- L'embed BGE-M3 dense+sparse est INTOUCHABLE : aucun changement de comportement de `/embed`, de `EmbedResponse`, ni du client `embed()`.
- `USE_FP16` : les valeurs `true`/`false` restent supportées ; la valeur `auto` disparaît ; **défaut `false`** (CPU déterministe — décision mémoire projet : « device explicite, pas USE_FP16=auto »).
- `AI_SERVICE_TIMEOUT_MS` : défaut abaissé `15000` → `8000` (borne le pire cas chat : 2 tentatives × 8 s + 1,5 s retry ≈ 17,5 s au lieu de 31,5 s). Reste overridable par env.
- Stager fichier par fichier (jamais `git add .`), jamais `--amend`, zéro `eslint-disable`.
- Commits conventionnels en anglais ; scopes : `server`, `rag`, `ci`.
- Branche : `chore/ai-service-embed-only` depuis `origin/main`.
- HORS SCOPE : l'A/B `Modifier.IDF` (chantier bench séparé), le label OTel `provider: 'mistral_ai'` (fond de tâche), toute modif du comportement `/embed`.

---

### Task 0: Branche + baseline

**Files:** aucun.

- [ ] **Step 1: Créer la branche**

```bash
cd /home/ordiv/projets/tomai-monorepo
git fetch origin main --quiet
git checkout -b chore/ai-service-embed-only origin/main
```

- [ ] **Step 2: Baselines vertes**

Run: `cd apps/server && bun run typecheck && bun run lint && bun run test`
Expected: exit 0.
Run: `cd ../ai-service && uv sync --quiet && uv run pytest -q`
Expected: exit 0 (tous les tests passent — noter le nombre).

---

### Task 1: Serveur TS — retirer le stage-2 rerank, les flags env, la méthode client ; timeout 8 s

**Files:**
- Modify: `apps/server/src/services/rag.service.ts` (docstring l.7, import l.22, commentaire l.86, bloc l.108-165)
- Modify: `apps/server/src/config/env.ts` (l.94-102, l.187-193)
- Modify: `apps/server/src/services/ai-service.client.ts` (docstring l.4-12, l.55-58, l.69, l.114-152)
- Test: `apps/server/src/tests/rag.service.test.ts`, `apps/server/src/tests/learning-rag-gate.test.ts`

**Interfaces:**
- Consumes: rien des autres tasks.
- Produces: `rag.service.hybridSearch` avec `strategy` de type `'qdrant-hybrid-rrf'` (seule valeur non-`disabled` restante) ; `aiServiceClient` sans méthode `rerank` ; `env` sans `RAG_RERANK_CANDIDATES`/`RAG_RERANK_ENABLED` ni `isRerankEnabled` ; `AI_SERVICE_TIMEOUT_MS` défaut `8000`. La Task 3 (doctor/docs) et la Task 2 (Python) n'en dépendent pas.

- [ ] **Step 1: Adapter les tests (rouge d'abord)**

Dans `apps/server/src/tests/rag.service.test.ts` :
(a) Supprimer du mock env (l.21-26) les clés `RAG_RERANK_CANDIDATES` et `RAG_RERANK_ENABLED`, la variable `let rerankEnabled` et l'entrée `isRerankEnabled: () => rerankEnabled` du mock module.
(b) Supprimer `const mockRerank = ...` (l.45-48), l'entrée `rerank: mockRerank` du mock aiServiceClient (l.59), et les resets associés du `beforeEach` (l.81-82).
(c) Supprimer le `describe('RAGService — rerank flag')` entier (3 tests) et le test `requests the rerank candidate pool as fused limit when rerank is enabled` (l.148-155).
(d) Le test `truncates results to topK` (anciennement dans le describe rerank) doit SURVIVRE hors du describe supprimé — le déplacer dans le describe des limites :

```typescript
  it('truncates results to topK (mock returns more than the requested limit)', async () => {
    const result = await ragService.hybridSearch({ ...BASE_OPTIONS, limit: 2 });

    expect(result.semanticChunks.length).toBe(2);
    expect(result.strategy).toBe('qdrant-hybrid-rrf');
  });
```

(e) Toute référence `rerankEnabled = true` restante dans le test des limites disparaît ; le test `requests exactly topK fused results` (l.137-146) perd sa ligne `rerankEnabled = false;` et reste tel quel sinon.

Dans `apps/server/src/tests/learning-rag-gate.test.ts` : supprimer le test `it('passes with rerank strategy too', ...)` (l.30-38) — la stratégie rerank n'existe plus ; le cas « toute stratégie non-disabled passe » est déjà couvert par le premier test.

Run: `cd apps/server && bun test src/tests/rag.service.test.ts src/tests/learning-rag-gate.test.ts`
Expected: FAIL — le code référence encore `isRerankEnabled` supprimé du mock (erreur de module) ; c'est le rouge attendu.

- [ ] **Step 2: `env.ts`**

(a) Supprimer les lignes `RAG_RERANK_CANDIDATES: ...` (l.98-101 avec leur commentaire) et `RAG_RERANK_ENABLED: ...` (l.102).
(b) Supprimer la fonction `isRerankEnabled()` entière avec son commentaire (l.187-193).
(c) Commentaire l.94 : `// AI Service ... embeddings + reranking` → `// AI Service (BGE-M3 embeddings)`.
(d) Timeout l.97 :

```typescript
  // Borne le pire cas du chemin chat (embed query) : 2 tentatives × 8 s + retry 1,5 s ≈ 17,5 s.
  // Le rerank (seul appel long) a été supprimé — audit 2026-07-01 lot 3.
  AI_SERVICE_TIMEOUT_MS: z.coerce.number().int().default(8000),
```

- [ ] **Step 3: `rag.service.ts`**

(a) Docstring l.4-11 : supprimer la ligne `- Stage 2 : rerank bge-reranker-v2-m3 (via le même ai-service)` et la mention rerank de l'architecture (garder embed + hybrid RRF).
(b) Import l.22 : `import { env, isRerankEnabled } from '../config/env.js';` → `import { env } from '../config/env.js';` (si `env` n'est plus utilisé après suppression de `RAG_RERANK_CANDIDATES`, supprimer l'import devenu inutile — vérifier au typecheck).
(c) Commentaire numéroté l.86 : retirer l'étape « 3. Rerank … ».
(d) Bloc l.108-114 : remplacer

```typescript
      const candidateK = env.RAG_RERANK_CANDIDATES ?? Math.max(topK * 4, 20);
      const fusedLimit = isRerankEnabled() ? candidateK : topK;
```

par

```typescript
      // Limite fusionnée demandée à Qdrant = topK exactement (le prefetch par
      // branche est dérivé en interne par searchHybrid : max(limit*4, 20)).
      const fusedLimit = topK;
```

(e) Type l.136-137 : `let strategy: 'qdrant-hybrid-rrf' | 'qdrant-hybrid-rrf+rerank-bge-m3' = 'qdrant-hybrid-rrf';` → `const strategy = 'qdrant-hybrid-rrf' as const;`
(f) Supprimer le bloc Stage-2 entier (l.139-165, du `if (isRerankEnabled() && results.length > 1) {` jusqu'à la fin du `catch`), en conservant UNIQUEMENT la coupe défensive :

```typescript
      if (results.length > topK) {
        results = results.slice(0, topK);
      }
```

- [ ] **Step 4: `ai-service.client.ts`**

(a) Docstring l.4-12 : retirer les mentions rerank (`rerank(query, texts, topN) → bge-reranker-v2-m3`) ; le service devient « BGE-M3 dense+sparse embeddings ».
(b) Supprimer `interface RerankResponse { ... }` (l.55-58).
(c) Message `requireUrl` l.69 : `The Python ai-service (BGE-M3 + rerank)` → `The Python ai-service (BGE-M3 embeddings)`.
(d) Supprimer la méthode `rerank(...)` entière (l.114-152).

- [ ] **Step 5: Vert + grep de non-régression**

Run: `cd apps/server && bun test src/tests/rag.service.test.ts src/tests/learning-rag-gate.test.ts`
Expected: PASS.
Run: `grep -rn "rerank\|Rerank\|RERANK" apps/server/src --include="*.ts" | grep -v "live/rag.test.ts"`
Expected: aucune occurrence (le libellé de `live/rag.test.ts:53` est traité en Task 3).

- [ ] **Step 6: Validation complète + commit**

Run: `cd apps/server && bun run typecheck && bun run lint && bun run test`
Expected: exit 0.

```bash
cd /home/ordiv/projets/tomai-monorepo
git add apps/server/src/services/rag.service.ts apps/server/src/config/env.ts apps/server/src/services/ai-service.client.ts apps/server/src/tests/rag.service.test.ts apps/server/src/tests/learning-rag-gate.test.ts
git commit -m "refactor(rag): remove reranker stage from the server retrieval path

The cross-encoder stage was never active in production (flag off by
default, 43-180s measured on CPU) and the 2026-07-01 audit removed it
for good: no viable EU-managed option exists and the literature says
reranking is not worth it on a <1000-chunk corpus already served by
tuned hybrid RRF. Also lowers AI_SERVICE_TIMEOUT_MS default 15s -> 8s
now that single-query embeds are the only remaining call.

Audit ref: docs/audits/2026-07-01-curriculum-to-frontend-architecture.md (lot 3)"
```

---

### Task 2: ai-service Python — endpoint, modèle et dépendance supprimés ; USE_FP16 explicite

**Files:**
- Delete: `apps/ai-service/src/rerank.py`
- Modify: `apps/ai-service/src/main.py` (l.1-11, 22, 26-28, 33-34, 43, 50, 58, 78-82, 94-99)
- Modify: `apps/ai-service/src/schemas.py` (l.40-62, 68-73)
- Modify: `apps/ai-service/src/config.py` (l.15, 20, 48-54)
- Modify: `apps/ai-service/src/embed.py` (l.22-34)
- Modify: `apps/ai-service/pyproject.toml` (l.4, 19) + `uv.lock` (régénéré)
- Test: `apps/ai-service/tests/test_endpoints.py`

**Interfaces:**
- Consumes: rien.
- Produces: `GET /health` renvoie `HealthResponse` SANS `rerank_model`/`rerank_loaded` (champs restants : `status`, `embed_model`, `embed_loaded` — vérifier les champs exacts existants dans `schemas.py` et n'enlever que les deux rerank). `status="ok"` dès que `embed_loaded()`. `POST /rerank` n'existe plus (404). La Task 3 aligne doctor/smoke-test sur ce nouveau contrat `/health`.

- [ ] **Step 1: Adapter les tests (rouge d'abord)**

Dans `apps/ai-service/tests/test_endpoints.py` :
(a) Import l.16 : retirer `RerankItem`.
(b) Supprimer `_fake_rerank` (l.29-30), les `patch("src.rerank...")` (l.40-42), le `patch("src.main.rerank_run", ...)` (l.44).
(c) Supprimer les assertions/tests sur `/rerank` (l.~80-82) et `test_rerank_offloads_to_threadpool` entier (l.174-192).
(d) Ajouter un test de disparition :

```python
def test_rerank_endpoint_is_gone(client):
    resp = client.post("/rerank", json={"query": "q", "texts": ["a"], "top_n": 1})
    assert resp.status_code == 404
```

(adapter la fixture `client` au nom réellement utilisé dans le fichier — lire les tests existants avant.)
(e) Si un test vérifie `/health`, retirer `rerank_loaded`/`rerank_model` de ses assertions.

Run: `cd apps/ai-service && uv run pytest -q`
Expected: FAIL (imports `src.rerank` encore présents dans main.py → le nouveau test 404 échoue aussi) — rouge attendu.

- [ ] **Step 2: Supprimer le rerank du service**

(a) `git rm apps/ai-service/src/rerank.py`
(b) `main.py` : docstring l.1-11 (retirer la ligne `/rerank`), import config l.22 (retirer `RERANK_MODEL`), supprimer les 3 imports `from .rerank import ...` (l.26-28), retirer `RerankRequest, RerankResponse` de l'import schemas (l.33-34), retirer `rerank_load()` du lifespan (l.43), description FastAPI l.50 → `"Embed (BGE-M3 dense+sparse)"`, supprimer `_rerank_lock` (l.58), `/health` l.78-82 :

```python
        status="ok" if embed_loaded() else "loading",
```

(retirer `rerank_model=RERANK_MODEL` et `rerank_loaded=rerank_loaded()` des kwargs), supprimer l'endpoint `/rerank` entier (l.94-99).
(c) `schemas.py` : supprimer le bloc `# ── Rerank ──` (l.40-62 : `RerankRequest`, `RerankItem`, `RerankResponse`) ; dans `HealthResponse` (l.68-73), supprimer les champs `rerank_model: str` et `rerank_loaded: bool`.
(d) `config.py` : supprimer l.15 (`RERANK_MODEL = ...`) ; docstring `validate_config` l.48-54 : `/embed et /rerank` → `/embed`.

- [ ] **Step 3: USE_FP16 explicite (défaut false, plus de `auto`)**

(a) `config.py` l.20 :

```python
USE_FP16 = os.getenv("USE_FP16", "false").lower()
```

(b) `embed.py` `_resolve_fp16()` (l.22-34) : supprimer la branche `auto` (le `torch.cuda.is_available()`) ; valeurs reconnues `true/1/yes` → True, tout le reste → False. Forme cible :

```python
def _resolve_fp16() -> bool:
    # Explicite uniquement : FP16 opt-in via USE_FP16=true. Pas de détection
    # auto — sur CPU le comportement doit être déterministe (audit lot 3).
    return USE_FP16 in ("true", "1", "yes")
```

(si l'import `torch` de ce fichier ne servait qu'à cette branche, le retirer ; sinon le laisser.)

- [ ] **Step 4: Dépendance**

`pyproject.toml` : description l.4 → retirer `and bge-reranker-v2-m3` ; supprimer la ligne l.19 `"sentence-transformers>=3.0", # CrossEncoder pour bge-reranker-v2-m3` (vérifié : seul `rerank.py` l'importait). Puis :

Run: `cd apps/ai-service && uv lock && uv sync`
Expected: lock régénéré sans `sentence-transformers` en dépendance directe.

- [ ] **Step 5: Vert + grep**

Run: `cd apps/ai-service && uv run pytest -q`
Expected: PASS (dont `test_rerank_endpoint_is_gone`).
Run: `grep -rn "rerank" apps/ai-service/src apps/ai-service/tests`
Expected: aucune occurrence.

- [ ] **Step 6: Commit**

```bash
cd /home/ordiv/projets/tomai-monorepo
git add -u apps/ai-service/src apps/ai-service/tests apps/ai-service/pyproject.toml apps/ai-service/uv.lock
git commit -m "refactor(rag): make ai-service embed-only, drop bge-reranker

Removes the /rerank endpoint, the CrossEncoder model preload (~1-2 GB
RAM freed — resolves the latent OOM on 4 GB instances) and the
sentence-transformers dependency (only importer was rerank.py).
USE_FP16 loses its 'auto' value: explicit opt-in, default false, so CPU
behaviour is deterministic.

Audit ref: docs/audits/2026-07-01-curriculum-to-frontend-architecture.md (lot 3)"
```

---

### Task 3: Infra + CI + doctor + docs alignés sur le contrat embed-only

**Files:**
- Modify: `docker-compose.yml` (l.81, 96-97, 111)
- Modify: `apps/ai-service/Dockerfile` (l.5, 54-55 — commentaires)
- Modify: `scripts/doctor-checks.mjs` (l.166-170)
- Modify: `scripts/doctor-checks.test.mjs` (l.87-88)
- Modify: `.github/workflows/smoke-test.yml` (l.49-54)
- Modify: `apps/server/.env.example` (l.53, 75-78), `apps/server/README.md` (l.43, 97-98, 122, 152), `apps/server/CLAUDE.md` (mentions reranker), `apps/ai-service/README.md` (l.3-4, 11-17, 44-67, 73-80, 87-88, 98-99, 110, 129)

**Interfaces:**
- Consumes: contrat `/health` de la Task 2 (`embed_loaded` seul, plus de `rerank_loaded`).
- Produces: rien pour les autres tasks.

- [ ] **Step 1: Doctor (test d'abord)**

`scripts/doctor-checks.test.mjs` l.87-88 : le mock du fetch `/health` renvoie `{ ..., embed_loaded: false, rerank_loaded: true }` → retirer `rerank_loaded` du payload mock ; le titre du test reste « FAIL si embed_loaded false ».
`scripts/doctor-checks.mjs` l.166-170 :

```javascript
  if (body.embed_loaded !== true) {
    throw new Error(`modèles non chargés (embed=${body.embed_loaded})`);
  }
```

Run: `node --test scripts/doctor-checks.test.mjs` (vérifier la commande réelle : `grep -rn "doctor-checks.test" package.json` et utiliser le script npm existant s'il y en a un)
Expected: PASS.

- [ ] **Step 2: CI smoke-test**

`.github/workflows/smoke-test.yml` l.49-54 : supprimer `rerank_ok=$(jq -r '.rerank_loaded' ...)`, la condition `|| [ "$rerank_ok" != "true" ]`, la variable dans le message d'erreur, et le libellé final → `echo "✅ AI-service healthy (BGE-M3 loaded)"`.

- [ ] **Step 3: Docker**

`docker-compose.yml` :
- l.81 commentaire → `# tomai-ai-service — BGE-M3 dense+sparse (embed-only)`
- l.96 : supprimer `- RERANK_MODEL=BAAI/bge-reranker-v2-m3`
- l.97 : `- USE_FP16=auto` → `- USE_FP16=false`
- l.111 : `memory: 6GB` → `memory: 4GB  # BGE-M3 FP32 ~2.5-3 GB + marge (embed-only)`
- l.118 `start_period: 300s` : conserver (1er boot télécharge encore ~2.4 Go), ajuster le commentaire `~3,5 Go` → `~2,4 Go`.

`apps/ai-service/Dockerfile` :
- l.5 → `# Models: BGE-M3 (~2.4 GB), downloaded at first boot into HF_HOME`
- l.54-55 commentaire HEALTHCHECK : `les 2 modèles (~3.5 GB ...)` → `le modèle BGE-M3 (~2.4 GB)` (garder `start-period=180s`).

- [ ] **Step 4: Docs**

- `apps/server/.env.example` : l.53 → `# RAG — ai-service (BGE-M3 embeddings) ...` ; supprimer le bloc l.75-78 (`RAG_RERANK_CANDIDATES`).
- `apps/server/README.md` : retirer les mentions rerank aux l.43, 97, 98 (ligne `RAG_RERANK_ENABLED` entière), 122, 152.
- `apps/server/CLAUDE.md` : supprimer la ligne `Reranker (RAG) : BAAI/bge-reranker-v2-m3 co-hosté dans apps/ai-service/` de la section AI ; dans les sections Stack/RAG et Modules, `+ rerank cross-encoder` / `+ reranker bge-reranker-v2-m3 cross-encoder` → supprimé (laisser « hybrid RRF natif Qdrant »).
- `apps/ai-service/README.md` : titre l.3-4 (embed-only), « Pourquoi » l.11-17 (retirer le point rerank), supprimer la section `### POST /rerank` entière (l.44-67), tableau modèles l.73-80 → une seule ligne BGE-M3 avec `Total RAM runtime : ~3 GB FP32, ~1.5 GB FP16`, tableau env l.87-88 (supprimer `RERANK_MODEL`, `USE_FP16` défaut `false` + « `auto` supprimé »), l.98-99 `/embed et /rerank` → `/embed`, l.110 exemple eco-medium à conserver (noter que embed-only rend eco-medium viable), l.129 `~3.5 GB` → `~2.4 GB`.
- `apps/server/src/live/rag.test.ts` l.53 : libellé `should have ai-service available (BGE-M3 + rerank)` → `should have ai-service available (BGE-M3)`.

- [ ] **Step 5: Grep final monorepo + validations**

Run: `grep -rn "rerank\|RERANK\|Rerank" apps/server apps/ai-service docker-compose.yml scripts/ .github/ --include="*.ts" --include="*.py" --include="*.yml" --include="*.mjs" --include="*.toml" -l`
Expected: aucun fichier (les mentions restantes vivent uniquement dans docs/audits/, docs/superpowers/, apps/curriculum/docs/ — historiques, hors périmètre).
Run: `cd apps/server && bun run typecheck && bun run lint && bun run test`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
cd /home/ordiv/projets/tomai-monorepo
git add docker-compose.yml apps/ai-service/Dockerfile apps/ai-service/README.md scripts/doctor-checks.mjs scripts/doctor-checks.test.mjs .github/workflows/smoke-test.yml apps/server/.env.example apps/server/README.md apps/server/CLAUDE.md apps/server/src/live/rag.test.ts
git commit -m "ci(rag): align infra, doctor and docs with embed-only ai-service

Doctor and smoke-test now assert embed_loaded only; compose drops
RERANK_MODEL, pins USE_FP16=false and lowers the memory limit 6GB->4GB;
READMEs/CLAUDE.md/.env.example lose the reranker sections."
```

---

### Task 4: Preuve end-to-end locale + PR

**Files:** aucun nouveau (le plan lui-même est commité ici).

- [ ] **Step 1: Rebuild du service local et preuve /health + /embed + 404 /rerank**

```bash
cd /home/ordiv/projets/tomai-monorepo
docker compose up -d --build ai-service
until curl -sf http://localhost:8001/health | grep -q '"status":"ok"'; do sleep 5; done
curl -s http://localhost:8001/health
curl -s -X POST http://localhost:8001/embed -H 'Content-Type: application/json' -d '{"texts":["théorème de Pythagore"]}' | head -c 200
curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:8001/rerank -H 'Content-Type: application/json' -d '{"query":"q","texts":["a"]}'
```

Expected: health `status:"ok"` sans champ rerank ; `/embed` renvoie dense+sparse ; `/rerank` renvoie **404**. (Si le port local diffère, lire le mapping dans `docker-compose.yml`.)

- [ ] **Step 2: Doctor complet**

Run: `pnpm doctor`
Expected: tous les checks PASS (le check ai-service ne réclame plus `rerank_loaded`).

- [ ] **Step 3: Validation finale + intégration**

Run: `cd apps/server && bun run typecheck && bun run lint && bun run test && bun run test:integration`
Expected: exit 0 (les suites Pronote skippent proprement si la démo est down — c'est un skip, pas un fail).

- [ ] **Step 4: Commit du plan + push + PR**

```bash
cd /home/ordiv/projets/tomai-monorepo
git add docs/superpowers/plans/2026-07-03-lot3-ai-service-embed-only.md
git commit -m "docs(rag): lot 3 implementation plan (ai-service embed-only)"
git push -u origin chore/ai-service-embed-only
gh pr create --base main --title "refactor(rag): ai-service embed-only — remove the reranker (audit lot 3)" --body "$(cat <<'EOF'
## Summary

Lot 3 of docs/audits/2026-07-01-curriculum-to-frontend-architecture.md: the bge-reranker-v2-m3 stage is removed everywhere. It was never active in production (flag off, 43-180s measured on CPU), no viable EU-managed alternative exists (Jina is Elastic-owned, Scaleway rerank is embedding-cosine), and the 2026 literature says reranking is not worth it on a <1000-chunk corpus already served by tuned hybrid RRF.

- server: stage-2 removed from rag.service, RAG_RERANK_* flags and isRerankEnabled() gone, client rerank() method gone, AI_SERVICE_TIMEOUT_MS default 15s -> 8s (bounds the chat degradation path to ~17.5s)
- ai-service: /rerank endpoint, rerank.py, CrossEncoder preload and sentence-transformers dependency removed (~1-2 GB RAM freed — resolves the latent OOM on 4 GB instances); USE_FP16 'auto' removed (explicit opt-in, default false)
- infra: compose drops RERANK_MODEL, USE_FP16=false, memory 6GB->4GB; doctor + CI smoke-test assert embed_loaded only; docs aligned

BGE-M3 dense+sparse embedding is untouched (audit verdict: only surviving custom — no EU provider exposes native sparse lexical_weights).

## Test plan
- [x] bun typecheck/lint/test + test:integration
- [x] uv run pytest (incl. new test_rerank_endpoint_is_gone: /rerank -> 404)
- [x] Local rebuild proof: /health ok without rerank fields, /embed serves dense+sparse, /rerank returns 404, pnpm doctor all PASS

## Post-merge (infra, hors repo)
Koyeb: the ai-service instance can now downsize (embed-only ~3 GB FP32); verify the HF cache volume is mounted before enabling scale-to-zero.

Generated with Claude Code
EOF
)"
```

---

## Hors scope de ce lot (rappel)

- A/B `Modifier.IDF` on/off + re-chiffrage sparse vs BM25 (chantier bench séparé, collection sandbox).
- Label OTel `provider: 'mistral_ai'` des spans embed (fond de tâche).
- Downsize réel de l'instance Koyeb + vérification du volume HF (action infra hors repo — notée dans la PR).
