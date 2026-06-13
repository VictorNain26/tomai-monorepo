# Phase 5 — Robustesse apps Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Durcir la robustesse des quatre apps (server, ai-service/CI, mobile, web) en corrigeant les follow-ups confirmés de la revue archi/produit du 2026-06-11 : lifecycle leaks, commentaires périmés, trous de test, inférence bloquante, cache CI, veille BO fantôme, duplication mobile, erreurs Pronote silencieuses, et robustesse UI web.

**Architecture:** Monorepo Turborepo / pnpm. Server Bun+Elysia (tests Bun runner). ai-service Python FastAPI (uv, pytest/ruff). CI GitHub Actions. Mobile Expo RN (jest-expo). Web Next.js 16 (vitest). Aucune nouvelle dépendance n'est requise — si une tâche semble en exiger une, STOP et signaler au lieu de l'ajouter.

**Tech Stack:** Bun 1.3, Elysia 1.4, Drizzle ; Python 3.12 FastAPI + FlagEmbedding/sentence-transformers ; Expo SDK 56 / RN 0.85 / React 19.2 / NativeWind v5 ; Next.js 16 / vitest ; GitHub Actions (astral-sh/setup-uv).

**Conventions de validation (rappel, à exécuter avant CHAQUE commit de la tâche concernée) :**
- Server : `cd apps/server && bun run typecheck && bun run lint && bun run test`. Avant push : `bun run test:integration` (piège : `api-endpoints.test.ts` mocke `drizzle-orm` partiellement — tout nouveau module tiré par la chaîne `app.ts`/`server-lifecycle.ts` doit y être mocké ; aucune des tâches server ci-dessous n'ajoute un tel module).
- ai-service : `cd apps/ai-service && uv run ruff check . && uv run ruff format --check . && uv run pytest`.
- curriculum (pour la veille BO) : `cd apps/curriculum && uv run ruff check . && uv run pytest -q`.
- Mobile : `cd apps/mobile && pnpm typecheck && pnpm lint && pnpm test`. Zéro classe palette brute (ESLint gate) — utiliser les classes de tokens sémantiques.
- Web : `cd apps/web && pnpm typecheck && pnpm lint && pnpm test` (vitest).
- Commits conventionnels, scopes : `server`, `mobile`, `chat`, `ci`, `rag`, `web`. Stager les fichiers explicitement (jamais `git add .`/`-A`). TypeScript strict, zéro `any`. Commentaires : seulement le WHY non-évident.

**Parallélisation (numérotation séquentielle conservée) :**
- Groupe A (server) : Tâches 1, 2, 3 indépendantes entre elles.
- Groupe B (ai-service/CI) : Tâches 5, 6, 7 indépendantes entre elles et du groupe A.
- Groupe C (mobile) : Tâche 8 → 9 → 10 → 11 dans cet ordre (10 et 11 dépendent du store/hook touchés ; 8 et 9 sont indépendantes l'une de l'autre mais touchent des fichiers voisins, garder l'ordre).
- Groupe D (web) : Tâches 12, 13, 14, 15, 16 indépendantes entre elles.
Les groupes A/B/C/D peuvent partir en parallèle sur des branches distinctes si souhaité, mais ce plan vise une seule branche Phase 5 exécutée séquentiellement.

---

## EXCLUSIONS (justifiées, NE PAS implémenter)

- **Batch S3 DeleteObjects en suppression de compte enfant (review item 4) — EXCLU (YAGNI).** Vérifié : `apps/server/src/services/parent.service.ts:198-251` `deleteChild` purge les fichiers d'UN SEUL enfant (`filesRepository.listByUserId(childId)`, boucle `for (const { storageKey } of fileRecords)` lignes 224-239). Le volume est borné et petit (les fichiers d'un enfant), pas un cas N+1 à l'échelle. Batcher `DeleteObjects` ajouterait de la complexité (chunking par 1000, parsing des erreurs partielles) sans gain mesurable. On garde les deletes séquentiels best-effort existants.

---

### Task 1: Stop le scheduler de rétention + le cron de reset tokens au shutdown

**Contexte vérifié :** `apps/server/src/services/retention-purge.service.ts:41-63` `startRetentionPurgeScheduler()` retourne une stop-fn (`() => clearInterval(interval)`), mais `apps/server/src/services/server-lifecycle.ts:132` appelle `startRetentionPurgeScheduler();` en ignorant le retour. De plus `startTokenResetCron()` (server-lifecycle.ts:12-73) stocke son interval dans le module-level `tokenResetInterval` (ligne 10) sans exposer de stop. `apps/server/src/index.ts:52-84` `gracefulShutdown` stoppe `memoryMonitor` + `closeConnection` mais ni le scheduler de rétention ni le cron de reset. Sous `unref()` ces intervals ne bloquent pas le process, mais le shutdown doit les arrêter proprement (pas de purge déclenchée pendant la fermeture DB).

**Files:**
- Modify: `apps/server/src/services/server-lifecycle.ts`
- Modify: `apps/server/src/index.ts`
- Test: `apps/server/src/tests/server-lifecycle-shutdown.test.ts` (Create)

**Steps:**

- [ ] Écrire le test d'abord. Créer `apps/server/src/tests/server-lifecycle-shutdown.test.ts` :
```ts
/**
 * Vérifie que server-lifecycle expose un arrêt des intervals (scheduler de
 * rétention + cron de reset tokens) appelable au shutdown.
 */
import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { createMockLogger } from './_helpers/mock-logger';

const mockLogger = createMockLogger();
mock.module('../lib/observability', () => ({ logger: mockLogger }));

const stopRetention = mock(() => {});
mock.module('../services/retention-purge.service', () => ({
  startRetentionPurgeScheduler: mock(() => stopRetention),
}));

mock.module('../config/env', () => ({ env: { NODE_ENV: 'test' } }));
mock.module('../db/connection', () => ({
  db: { execute: mock(() => Promise.resolve([{ count: 0 }])) },
}));
mock.module('drizzle-orm', () => ({ sql: (s: unknown) => s }));
mock.module('../lib/encryption', () => ({ validateEncryptionSetup: mock(() => Promise.resolve(true)) }));
mock.module('../middleware/memory-monitor.middleware', () => ({
  memoryMonitor: { startMonitoring: mock(() => {}), stopMonitoring: mock(() => {}) },
}));
mock.module('./token-quota.service', () => ({
  tokenQuotaService: { resetAllDailyTokens: mock(() => Promise.resolve({ resetCount: 0 })) },
}));

const { startTokenResetCron, stopBackgroundJobs } = await import(
  '../services/server-lifecycle'
);

beforeEach(() => {
  stopRetention.mockClear();
});

describe('server-lifecycle background jobs', () => {
  it('stopBackgroundJobs clears the token reset cron without throwing', () => {
    startTokenResetCron();
    expect(() => stopBackgroundJobs()).not.toThrow();
  });

  it('stopBackgroundJobs is idempotent (safe to call twice)', () => {
    startTokenResetCron();
    stopBackgroundJobs();
    expect(() => stopBackgroundJobs()).not.toThrow();
  });
});
```

- [ ] Lancer le test (attendu FAIL — `stopBackgroundJobs` n'existe pas) :
```bash
cd apps/server && bun test src/tests/server-lifecycle-shutdown.test.ts
```
Sortie attendue : échec à l'import (`stopBackgroundJobs` undefined) ou assertion.

- [ ] Implémenter dans `apps/server/src/services/server-lifecycle.ts`. Ajouter une variable module-level pour la stop-fn du scheduler de rétention, capturer le retour de `startRetentionPurgeScheduler()`, et exporter `stopBackgroundJobs()`. Remplacer la ligne 10 par :
```ts
let tokenResetInterval: ReturnType<typeof setInterval> | null = null;
let stopRetentionPurge: (() => void) | null = null;
```
Remplacer la ligne 132 (`startRetentionPurgeScheduler();`) par :
```ts
    stopRetentionPurge = startRetentionPurgeScheduler();
```
Ajouter à la fin du fichier (après `initializeServices`) :
```ts
export function stopBackgroundJobs(): void {
  if (tokenResetInterval) {
    clearInterval(tokenResetInterval);
    tokenResetInterval = null;
  }
  if (stopRetentionPurge) {
    stopRetentionPurge();
    stopRetentionPurge = null;
  }
}
```

- [ ] Câbler l'appel dans `apps/server/src/index.ts`. Dans `gracefulShutdown` (lignes 58-63), ajouter l'import dynamique + appel AVANT `closeConnection()` :
```ts
    const { closeConnection } = await import('./db/connection.js');
    const { memoryMonitor } = await import('./middleware/memory-monitor.middleware.js');
    const { stopBackgroundJobs } = await import('./services/server-lifecycle.js');

    stopBackgroundJobs();
    memoryMonitor.stopMonitoring();
    await closeConnection();
```

- [ ] Relancer le test (attendu PASS) :
```bash
cd apps/server && bun test src/tests/server-lifecycle-shutdown.test.ts
```

- [ ] Valider :
```bash
cd apps/server && bun run typecheck && bun run lint && bun run test
```

- [ ] Commit :
```bash
git add apps/server/src/services/server-lifecycle.ts apps/server/src/index.ts apps/server/src/tests/server-lifecycle-shutdown.test.ts
git commit -m "fix(server): stop retention scheduler and token cron on shutdown"
```

---

### Task 2: Corriger le commentaire périmé "Gemini" dans chat-orchestration

**Contexte vérifié :** `apps/server/src/services/chat/chat-orchestration.service.ts:8` contient `* 4. Orchestrer le streaming Gemini` dans le JSDoc d'en-tête. La stack chat est Mistral (`mistral-chat.service.ts`). Pure correction de commentaire, pas de changement de comportement → pas de test.

**Files:**
- Modify: `apps/server/src/services/chat/chat-orchestration.service.ts`

**Steps:**

- [ ] Dans `apps/server/src/services/chat/chat-orchestration.service.ts`, remplacer la ligne 8 :
```
 * 4. Orchestrer le streaming Gemini
```
par :
```
 * 4. Orchestrer le streaming Mistral
```

- [ ] Vérifier qu'aucune autre occurrence "Gemini" périmée ne subsiste dans ce fichier :
```bash
cd apps/server && grep -n -i gemini src/services/chat/chat-orchestration.service.ts
```
Sortie attendue : aucune ligne (la correction faite couvre la seule occurrence du commentaire d'en-tête). Si d'autres lignes apparaissent (ex. `geminiFileId`, champ schéma réel), NE PAS les toucher — hors scope de cette tâche (renommage de champ DB = autre PR).

- [ ] Valider :
```bash
cd apps/server && bun run typecheck && bun run lint
```

- [ ] Commit :
```bash
git add apps/server/src/services/chat/chat-orchestration.service.ts
git commit -m "docs(chat): fix stale Gemini comment, stack is Mistral"
```

---

### Task 3: Test d'accumulation d'usage multi-itérations dans la boucle agentique

**Contexte vérifié :** `apps/server/src/services/chat/mistral-chat.service.ts:178-349` : `generateStreamChunks` accumule l'usage de CHAQUE itération de la boucle agentique (lignes 240-256, `usageTotal.promptTokens += chunk.usage.promptTokens` etc.) et émet le total dans le chunk `done` final (ligne 357, `usage: usageTotal`). Le seul test d'usage existant (`apps/server/src/tests/mistral-stream-usage.test.ts`) couvre uniquement `chatStream` (le client `mistral-client.ts`), PAS l'accumulation multi-itérations de `generateStreamChunks`. Cette tâche ajoute ce test. `generateStreamChunks` importe `chatStream` depuis `'../../lib/ai/mistral-client.js'` et `executeTool` depuis `'./tool-executor.js'` — tous deux mockables via `mock.module`.

**Files:**
- Test: `apps/server/src/tests/mistral-chat-usage-loop.test.ts` (Create)

**Steps:**

- [ ] Écrire le test. Créer `apps/server/src/tests/mistral-chat-usage-loop.test.ts` :
```ts
/**
 * Vérifie que la boucle agentique de generateStreamChunks additionne l'usage
 * de TOUTES les itérations (pas seulement la première) dans le chunk `done`.
 * Le seul test d'usage préexistant ne couvre que le client chatStream.
 */
import './_helpers/mistral-env';
import { describe, it, expect, mock } from 'bun:test';
import { createMockLogger } from './_helpers/mock-logger';
import type { ChatStreamChunk } from '../lib/ai/mistral-client';

const mockLogger = createMockLogger();
mock.module('../lib/observability', () => ({ logger: mockLogger }));

// Itération 1 : un tool_call + usage. Itération 2 : du texte + usage, pas de tool_call → fin.
let call = 0;
function makeStream(): AsyncIterable<ChatStreamChunk> {
  call++;
  const iteration = call;
  return {
    async *[Symbol.asyncIterator]() {
      if (iteration === 1) {
        yield { type: 'tool_call', toolCall: { id: 'tc_1', name: 'search_educational_content', arguments: '{}' } };
        yield { type: 'done', usage: { promptTokens: 100, completionTokens: 20, totalTokens: 120 } };
      } else {
        yield { type: 'text', text: 'Réponse finale.' };
        yield { type: 'done', usage: { promptTokens: 50, completionTokens: 10, totalTokens: 60 } };
      }
    },
  };
}

mock.module('../lib/ai/mistral-client', () => ({
  chatStream: mock(() => makeStream()),
}));
mock.module('./tool-executor', () => ({
  executeTool: mock(() => Promise.resolve({ ok: true })),
  isDeckCreatedResult: mock(() => false),
}));

const { mistralChatService } = await import('../services/chat/mistral-chat.service');

async function collect(): Promise<ChatStreamChunk[]> {
  const out: ChatStreamChunk[] = [];
  for await (const c of mistralChatService.generateStreamChunks({
    userId: 'u1',
    content: 'Explique Pythagore',
    schoolLevel: 'quatrieme',
    sessionId: 's1',
    userRole: 'student',
    conversationHistory: [],
  })) {
    out.push(c as unknown as ChatStreamChunk);
  }
  return out;
}

describe('generateStreamChunks usage accumulation', () => {
  it('sums usage across both loop iterations in the final done chunk', async () => {
    call = 0;
    const chunks = await collect();
    const done = chunks.find((c) => c.type === 'done');
    expect(done).toBeDefined();
    expect(done?.usage).toEqual({ promptTokens: 150, completionTokens: 30, totalTokens: 180 });
  });

  it('marks usedRAG true when the tool was called', async () => {
    call = 0;
    const chunks = await collect();
    const done = chunks.find((c) => c.type === 'done');
    expect((done?.metadata as { usedRAG?: boolean } | undefined)?.usedRAG).toBe(true);
  });
});
```

- [ ] Lancer le test. Si l'import échoue parce que `mistral-chat.service.ts` tire des modules non mockés (ex. `mistral-helpers.js` → `../../db/connection.js`, ou `intent-classifier`), AJOUTER les `mock.module` manquants en suivant le pattern de `chat-session.test.ts` (lignes 58-127 : mocks de `../db/connection`, `../db/schema`, `drizzle-orm`). Ne PAS mocker ce qui n'est pas tiré. Itérer jusqu'à ce que le test tourne, puis vérifier qu'il décrit bien le comportement (au premier run vert, c'est attendu : le code accumule déjà — ce test est une régression-guard, pas un Red->Green sur du code à écrire).
```bash
cd apps/server && bun test src/tests/mistral-chat-usage-loop.test.ts
```
Sortie attendue après ajustement des mocks : 2 tests PASS.

- [ ] Valider la suite complète (s'assurer qu'aucun mock global ne fuit) :
```bash
cd apps/server && bun run typecheck && bun run lint && bun run test
```

- [ ] Commit :
```bash
git add apps/server/src/tests/mistral-chat-usage-loop.test.ts
git commit -m "test(chat): cover multi-iteration usage accumulation in agentic loop"
```

---

### Task 4: Offload de l'inférence CPU-bound hors de l'event loop (ai-service)

**Contexte vérifié :** `apps/ai-service/src/main.py:78-89` : les handlers `async def embed` et `async def rerank` appellent `embed_encode(req.texts)` (ligne 81) et `rerank_run(...)` (ligne 88) qui sont des appels CPU-bound de plusieurs secondes (`_model.encode()` dans `embed.py:64`, `_model.rank()` dans `rerank.py:43`). Avec `uvicorn --workers 1` (Dockerfile ligne 58), ces appels bloquent l'event loop → `/health` (Koyeb readiness) ne répond plus pendant l'inférence. Les modèles `BGEM3FlagModel`/`CrossEncoder` ne sont pas documentés thread-safe. `anyio` est déjà une dépendance transitive (via FastAPI/Starlette, présent dans `uv.lock`) — `fastapi.concurrency.run_in_threadpool` est disponible sans nouvelle dep.

**Position prise :** offloader chaque appel via `run_in_threadpool`, ET sérialiser l'inférence par modèle avec un `anyio.Lock` (un par modèle) acquis dans le handler async AVANT l'offload. Le lock async (event-loop-bound) garantit qu'une seule inférence par modèle tourne à la fois (thread-safety), tandis que `run_in_threadpool` garde l'event loop libre pour `/health`. Deux locks séparés (embed vs rerank) pour ne pas sérialiser inutilement entre les deux modèles.

**DOC-FIRST OBLIGATOIRE avant d'implémenter :** confirmer dans la doc officielle FastAPI que `from fastapi.concurrency import run_in_threadpool` est l'idiome supporté pour offloader du blocking I/O/CPU (https://fastapi.tiangolo.com/async/ et la référence `fastapi.concurrency`). Citer l'URL dans le message de commit.

**Files:**
- Modify: `apps/ai-service/src/main.py`
- Test: `apps/ai-service/tests/test_endpoints.py` (Modify — ajouter un test de non-régression d'offload)

**Steps:**

- [ ] Écrire le test d'abord. Ajouter à la fin de `apps/ai-service/tests/test_endpoints.py` :
```python
def test_embed_runs_off_event_loop(client: TestClient) -> None:
    """L'inférence embed doit être offloadée (run_in_threadpool) — le handler
    reste responsive. On vérifie que l'endpoint répond toujours 200 quand
    embed_encode est une fonction bloquante (sleep)."""
    import time

    def _slow_embed(texts: list[str]) -> list[EmbedItem]:
        time.sleep(0.05)
        return _fake_embed(texts)

    with patch("src.main.embed_encode", side_effect=_slow_embed):
        r = client.post("/embed", json={"texts": ["hi"]})
        assert r.status_code == 200
        assert len(r.json()["embeddings"]) == 1
```

- [ ] Lancer le test (attendu PASS même avant le fix car TestClient est synchrone — ce test est un garde-fou que l'offload ne casse PAS le contrat). Confirmer qu'il passe AVANT le changement pour avoir une baseline :
```bash
cd apps/ai-service && uv run pytest tests/test_endpoints.py::test_embed_runs_off_event_loop -q
```

- [ ] Implémenter dans `apps/ai-service/src/main.py`. Ajouter l'import (après la ligne 18, regroupé avec les imports FastAPI) :
```python
import anyio
from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.concurrency import run_in_threadpool
```
Ajouter les locks module-level juste après la création de `app` (après la ligne 50) :
```python
# Sérialise l'inférence par modèle : BGEM3FlagModel et CrossEncoder ne sont pas
# documentés thread-safe, et le threadpool FastAPI peut lancer plusieurs threads.
# Le lock (event-loop-bound) est acquis avant l'offload run_in_threadpool.
_embed_lock = anyio.Lock()
_rerank_lock = anyio.Lock()
```
Remplacer le corps de `embed` (lignes 79-82) par :
```python
async def embed(req: EmbedRequest) -> EmbedResponse:
    """BGE-M3 dense + sparse natif en un seul forward pass."""
    async with _embed_lock:
        items = await run_in_threadpool(embed_encode, req.texts)
    return EmbedResponse(model=EMBED_MODEL, embeddings=items)
```
Remplacer le corps de `rerank` (lignes 86-89) par :
```python
async def rerank(req: RerankRequest) -> RerankResponse:
    """bge-reranker-v2-m3 — compat format HuggingFace TEI POST /rerank."""
    async with _rerank_lock:
        results = await run_in_threadpool(rerank_run, req.query, req.texts, req.top_n)
    return RerankResponse(model=RERANK_MODEL, results=results)
```

- [ ] Relancer toute la suite (le mock `patch("src.main.embed_encode", side_effect=_fake_embed)` du fixture client reste valide car `run_in_threadpool` appelle bien `src.main.embed_encode`) :
```bash
cd apps/ai-service && uv run pytest -q
```
Sortie attendue : tous les tests PASS (le fixture patche `src.main.embed_encode`/`src.main.rerank_run`, qui sont exactement les symboles passés à `run_in_threadpool`).

- [ ] Valider lint + format :
```bash
cd apps/ai-service && uv run ruff check . && uv run ruff format --check .
```
Si `ruff format --check` échoue, lancer `uv run ruff format .` puis re-vérifier.

- [ ] Commit (citer la source FastAPI vérifiée) :
```bash
git add apps/ai-service/src/main.py apps/ai-service/tests/test_endpoints.py
git commit -m "perf(rag): offload CPU-bound embed/rerank off the event loop

Wrap _model.encode()/.rank() in run_in_threadpool + per-model anyio.Lock so
/health stays responsive under --workers 1. Validated against
https://fastapi.tiangolo.com/async/ (run_in_threadpool idiom)."
```

---

### Task 5: Activer le cache uv dans les workflows CI Python

**Contexte vérifié :** `.github/workflows/ai-service.yml:26-28` et `.github/workflows/curriculum.yml:28-30` utilisent `astral-sh/setup-uv@fac544c...` avec seulement `python-version: "3.12"`, sans `enable-cache`. `uv.lock` est commité dans les deux apps. Pure config CI → pas de test, validation par lecture + lint YAML implicite.

**DOC-FIRST OBLIGATOIRE :** confirmer dans le README de `astral-sh/setup-uv` (https://github.com/astral-sh/setup-uv) que l'input s'appelle bien `enable-cache` et accepte `true`, et vérifier s'il faut un `cache-dependency-glob` (par défaut l'action hash `uv.lock`/`requirements*.txt`). Citer l'URL+champ dans le commit.

**Files:**
- Modify: `.github/workflows/ai-service.yml`
- Modify: `.github/workflows/curriculum.yml`

**Steps:**

- [ ] Dans `.github/workflows/ai-service.yml`, remplacer le bloc `with` du step setup-uv (lignes 27-28) :
```yaml
      - uses: astral-sh/setup-uv@fac544c07dec837d0ccb6301d7b5580bf5edae39 # main
        with:
          python-version: "3.12"
          enable-cache: true
```

- [ ] Dans `.github/workflows/curriculum.yml`, remplacer le bloc `with` du step setup-uv (lignes 29-30) :
```yaml
      - uses: astral-sh/setup-uv@fac544c07dec837d0ccb6301d7b5580bf5edae39 # main
        with:
          python-version: "3.12"
          enable-cache: true
```

- [ ] Vérifier la syntaxe YAML (indentation 2 espaces sous `with:`) :
```bash
cd /home/ordiv/projets/tomai-monorepo && grep -n -A3 "setup-uv" .github/workflows/ai-service.yml .github/workflows/curriculum.yml
```
Sortie attendue : chaque workflow montre `enable-cache: true` aligné sous `python-version`.

- [ ] Commit (citer la source) :
```bash
git add .github/workflows/ai-service.yml .github/workflows/curriculum.yml
git commit -m "ci: enable uv cache on setup-uv for Python workflows

uv.lock is committed; enable-cache caches the uv wheel store between runs.
Validated against https://github.com/astral-sh/setup-uv#enable-cache."
```

---

### Task 6: Créer le workflow de veille BO hebdomadaire (veille_bo.yml)

**Contexte vérifié :** `apps/curriculum/README.md:126` documente `veille_bo.yml — veille Eduscol hebdomadaire (issue GitHub si changement)` mais le workflow N'EXISTE PAS (`ls .github/workflows/` : pas de `veille_bo.yml`). Le script `apps/curriculum/scripts/veille_programmes.py` fonctionne : il écrit `apps/curriculum/data/raw/.veille_changes.json` (un tableau JSON, vide `[]` si rien — voir lignes 13, 389), exit 0 quoi qu'il arrive, état mémorisé dans `.veille_state.json`. Le contrat de sortie pour le workflow = lire `.veille_changes.json` et n'ouvrir/mettre à jour une issue QUE si le tableau est non-vide. Secrets PISTE optionnels (`PISTE_CLIENT_ID`/`PISTE_CLIENT_SECRET`, lignes 179-180) — source B sautée si absents.

**Position prise (workflow minimal) :** cron hebdo + `workflow_dispatch` manuel ; checkout, setup-uv (avec cache, cohérent Task 5), `uv sync --frozen`, run du script ; lecture du JSON via `actions/github-script` ; si non-vide, créer une issue (titre daté) avec le contenu formaté. Pas de commit de l'état mémorisé dans le repo (garder minimal ; l'état se reconstruit sinon — accepter qu'en CI sans état persistant, chaque run recompare à un état vide, donc rapporte tous les changements détectés ce jour-là : c'est le comportement « veille » voulu et idempotent côté issue via un titre stable + recherche d'issue existante du jour).

**Files:**
- Create: `.github/workflows/veille_bo.yml`

**Steps:**

- [ ] Lire le contrat de sortie du script pour confirmer le chemin et la forme :
```bash
cd /home/ordiv/projets/tomai-monorepo && sed -n '34,40p;385,392p' apps/curriculum/scripts/veille_programmes.py
```
Confirmer : `CHANGES_FILE = RAW / ".veille_changes.json"` avec `RAW = BASE / "data" / "raw"` → chemin relatif `apps/curriculum/data/raw/.veille_changes.json`, contenu = `json.dumps(all_changes)` (tableau).

- [ ] Créer `.github/workflows/veille_bo.yml` :
```yaml
name: Veille BO

on:
  schedule:
    - cron: "0 6 * * 1" # tous les lundis 06:00 UTC
  workflow_dispatch:

permissions:
  contents: read
  issues: write

concurrency:
  group: veille-bo
  cancel-in-progress: false

jobs:
  veille:
    name: Veille programmes Éduscol
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: apps/curriculum
    steps:
      - uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5 # v4.3.1

      - uses: astral-sh/setup-uv@fac544c07dec837d0ccb6301d7b5580bf5edae39 # main
        with:
          python-version: "3.12"
          enable-cache: true

      - name: Sync (frozen)
        run: uv sync --frozen

      - name: Run veille script
        env:
          PISTE_CLIENT_ID: ${{ secrets.PISTE_CLIENT_ID }}
          PISTE_CLIENT_SECRET: ${{ secrets.PISTE_CLIENT_SECRET }}
        run: uv run python scripts/veille_programmes.py

      - name: Open or update issue on changes
        uses: actions/github-script@60a0d83039c74a4aee543508d2ffcb1c3799cdea # v7.0.1
        with:
          script: |
            const fs = require('fs');
            const path = 'apps/curriculum/data/raw/.veille_changes.json';
            let changes = [];
            try {
              changes = JSON.parse(fs.readFileSync(path, 'utf8'));
            } catch (e) {
              core.info(`Pas de fichier de changements lisible (${e.message}) — rien à signaler.`);
              return;
            }
            if (!Array.isArray(changes) || changes.length === 0) {
              core.info('Aucun changement détecté — pas d\'issue.');
              return;
            }
            const today = new Date().toISOString().slice(0, 10);
            const title = `Veille BO — changements détectés (${today})`;
            const lines = changes.map((c) => {
              if (c.source === 'datagouv') {
                return `- **[data.gouv.fr]** ${c.title || '(sans titre)'}\n  - ${c.url}`;
              }
              return `- **[Légifrance]** ${c.titre || ''}\n  - ${c.url_legifrance || ''}`;
            });
            const body = `Le script de veille a détecté **${changes.length}** changement(s) sur les programmes officiels.\n\n${lines.join('\n')}\n\n_Généré automatiquement par \`.github/workflows/veille_bo.yml\`._`;
            const existing = await github.rest.issues.listForRepo({
              owner: context.repo.owner,
              repo: context.repo.repo,
              state: 'open',
              labels: 'veille-bo',
            });
            const match = existing.data.find((i) => i.title === title);
            if (match) {
              await github.rest.issues.createComment({
                owner: context.repo.owner,
                repo: context.repo.repo,
                issue_number: match.number,
                body,
              });
              core.info(`Issue #${match.number} mise à jour.`);
            } else {
              const created = await github.rest.issues.create({
                owner: context.repo.owner,
                repo: context.repo.repo,
                title,
                body,
                labels: ['veille-bo'],
              });
              core.info(`Issue #${created.data.number} créée.`);
            }
```

**DOC-FIRST :** avant commit, confirmer le SHA pinné de `actions/github-script@v7` (vérifier que `60a0d83...` correspond bien à v7.0.1 sur https://github.com/actions/github-script/releases ; sinon utiliser le SHA de la dernière v7 et ajuster le commentaire). Confirmer aussi que le label `veille-bo` peut être créé à la volée par `issues.create` (oui, `createIssue` crée les labels manquants).

- [ ] Vérifier que le README est désormais exact (le workflow référencé existe) :
```bash
cd /home/ordiv/projets/tomai-monorepo && test -f .github/workflows/veille_bo.yml && echo OK
```
Sortie attendue : `OK`.

- [ ] Commit :
```bash
git add .github/workflows/veille_bo.yml
git commit -m "ci(rag): add weekly veille BO workflow opening an issue on changes

Documented in apps/curriculum/README.md:126 but missing. Runs
scripts/veille_programmes.py weekly, reads .veille_changes.json, opens or
updates a labelled GitHub issue when the changes array is non-empty."
```

---

### Task 7: Extraire les helpers QR Pronote dupliqués dans un module partagé

**Contexte vérifié :** `parseQrCode` et `extractEstablishment` sont byte-identiques entre `apps/mobile/src/hooks/usePronoteOnboarding.ts:87-113` et `apps/mobile/src/hooks/usePronoteReconnect.ts:69-95`. La génération de username est identique en corps mais nommée différemment : `generateUsername` (onboarding, lignes 115-124) vs `toUsername` (reconnect, lignes 97-105). Un module `apps/mobile/src/lib/pronote-helpers.ts` existe DÉJÀ (helpers grades/devoirs : `formatDateShort`, `getGradeStyle`, `splitPronoteName`, `toPronoteDedupeKey`, etc.) avec ses tests `apps/mobile/__tests__/lib/pronote-helpers.test.ts`. On AJOUTE les 3 helpers QR à ce module existant (pas un nouveau fichier) et on étend le fichier de test existant. `QrCodeData` vient de `@/services/pronote/pronote-types`.

Note : dans reconnect, `toUsername` est ensuite suffixé par `.${Date.now() % 10000}` (ligne 231) — ce suffixe reste DANS le hook, seul le slug de base est partagé.

**Files:**
- Modify: `apps/mobile/src/lib/pronote-helpers.ts`
- Modify: `apps/mobile/src/hooks/usePronoteOnboarding.ts`
- Modify: `apps/mobile/src/hooks/usePronoteReconnect.ts`
- Modify: `apps/mobile/__tests__/lib/pronote-helpers.test.ts`

**Steps:**

- [ ] Écrire les tests d'abord. Ajouter à la fin de `apps/mobile/__tests__/lib/pronote-helpers.test.ts`, et compléter l'import en tête du fichier (lignes 9-17) pour inclure les 3 nouveaux symboles + le type :
```ts
import {
  formatDateShort,
  formatDateWithDay,
  getDaysUntil,
  getGradeStyle,
  getWeekLabel,
  isLowGrade,
  isOverdue,
  parseQrCode,
  extractEstablishment,
  pronoteUsername,
} from '@/lib/pronote-helpers';
```
Puis ajouter les blocs de test à la fin :
```ts
// ============================================================================
// QR HELPERS
// ============================================================================

describe('parseQrCode', () => {
  it('parses a valid Pronote QR payload', () => {
    const json = JSON.stringify({ jeton: 'abc', login: 'user', url: 'https://x.fr/pronote' });
    expect(parseQrCode(json)).toEqual({ jeton: 'abc', login: 'user', url: 'https://x.fr/pronote' });
  });

  it('returns null on malformed JSON', () => {
    expect(parseQrCode('not json')).toBeNull();
  });

  it('returns null when a required field is missing', () => {
    expect(parseQrCode(JSON.stringify({ jeton: 'abc', login: 'user' }))).toBeNull();
  });
});

describe('extractEstablishment', () => {
  it('extracts the subdomain label from the URL', () => {
    expect(extractEstablishment('https://college-victor-hugo.index-education.net/pronote')).toBe(
      'college-victor-hugo',
    );
  });

  it('falls back to a default for an unparseable URL', () => {
    expect(extractEstablishment('garbage')).toBe('Mon etablissement');
  });
});

describe('pronoteUsername', () => {
  it('lowercases, strips diacritics, and dot-joins', () => {
    expect(pronoteUsername('Élodie Bernard')).toBe('elodie.bernard');
  });

  it('drops non-alphanumeric characters', () => {
    expect(pronoteUsername("Jean-Luc O'Connor")).toBe('jeanluc.oconnor');
  });
});
```

- [ ] Lancer le test (attendu FAIL — les 3 exports n'existent pas encore) :
```bash
cd apps/mobile && pnpm test -- pronote-helpers
```

- [ ] Implémenter. Ajouter à `apps/mobile/src/lib/pronote-helpers.ts` (en haut, l'import du type si absent — vérifier d'abord les imports existants ; ajouter si besoin) :
```ts
import type { QrCodeData } from '@/services/pronote/pronote-types';
```
Puis ajouter à la fin du fichier :
```ts
// ============================================================================
// QR / ONBOARDING HELPERS (partagés onboarding + reconnect)
// ============================================================================

export function parseQrCode(data: string): QrCodeData | null {
  try {
    const parsed = JSON.parse(data) as Record<string, unknown>;
    if (
      typeof parsed.jeton === 'string' &&
      typeof parsed.login === 'string' &&
      typeof parsed.url === 'string'
    ) {
      return { jeton: parsed.jeton, login: parsed.login, url: parsed.url };
    }
    return null;
  } catch {
    return null;
  }
}

export function extractEstablishment(url: string): string {
  try {
    const match = url.match(/^https?:\/\/([^/:]+)/);
    if (match?.[1]) {
      return match[1].split('.')[0] || 'Mon etablissement';
    }
  } catch {
    // ignore
  }
  return 'Mon etablissement';
}

export function pronoteUsername(name: string): string {
  // Remove combining diacritical marks (U+0300 - U+036F).
  const combiningMarks = new RegExp('[\\u0300-\\u036f]', 'g');
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(combiningMarks, '')
    .replace(/\s+/g, '.')
    .replace(/[^a-z0-9.]/g, '');
}
```

- [ ] Relancer le test (attendu PASS) :
```bash
cd apps/mobile && pnpm test -- pronote-helpers
```

- [ ] Refactorer `apps/mobile/src/hooks/usePronoteOnboarding.ts` : supprimer les fonctions locales `parseQrCode` (87-101), `extractEstablishment` (103-113), `generateUsername` (115-124). Étendre l'import existant (ligne 28) :
```ts
import {
  splitPronoteName,
  toPronoteDedupeKey,
  parseQrCode,
  extractEstablishment,
  pronoteUsername,
} from '@/lib/pronote-helpers';
```
Remplacer l'appel ligne 257 `username: generateUsername(child.resource.name),` par `username: pronoteUsername(child.resource.name),`.

- [ ] Refactorer `apps/mobile/src/hooks/usePronoteReconnect.ts` : supprimer `parseQrCode` (69-83), `extractEstablishment` (85-95), `toUsername` (97-105). Étendre l'import existant (ligne 28) :
```ts
import {
  splitPronoteName,
  toPronoteDedupeKey,
  parseQrCode,
  extractEstablishment,
  pronoteUsername,
} from '@/lib/pronote-helpers';
```
Remplacer ligne 230 `const baseUsername = toUsername(resource.name);` par `const baseUsername = pronoteUsername(resource.name);` (la ligne 231 `const username = \`${baseUsername}.${Date.now() % 10000}\`;` reste inchangée).

- [ ] Valider :
```bash
cd apps/mobile && pnpm typecheck && pnpm lint && pnpm test
```

- [ ] Commit :
```bash
git add apps/mobile/src/lib/pronote-helpers.ts apps/mobile/src/hooks/usePronoteOnboarding.ts apps/mobile/src/hooks/usePronoteReconnect.ts apps/mobile/__tests__/lib/pronote-helpers.test.ts
git commit -m "refactor(mobile): extract shared Pronote QR helpers + tests"
```

---

### Task 8: Consolider le build du contexte chat Pronote + supprimer le code mort

**Contexte vérifié :** `apps/mobile/src/hooks/chat/useStreamManager.ts:30-59` `buildPronoteChatContext` et `apps/mobile/src/hooks/usePronote.ts:213-237` `getChatContext` construisent le même `PronoteChatContext` (filtre timetable du jour, top-10 grades récents). **Divergence comportementale réelle :** `buildPronoteChatContext` retourne `undefined` quand les trois listes sont vides (lignes 57-58) ; `getChatContext` retourne toujours un objet (potentiellement `{ homework: undefined, recentGrades: undefined, todayTimetable: undefined }`) après le seul early-return sur `!isConnected`. **Comportement correct = celui de `buildPronoteChatContext`** (ne pas envoyer au serveur un objet de undefined ; le payload SSE ne doit porter `pronoteContext` que s'il a du contenu). `getChatContext` est **du code mort** : vérifié, zéro appelant hors de sa propre définition/return dans `usePronote.ts` (seule autre mention : un doc de spec). On supprime `getChatContext` et on garde l'unique implémentation dans `useStreamManager.ts`.

**Files:**
- Modify: `apps/mobile/src/hooks/usePronote.ts`
- Test: `apps/mobile/__tests__/hooks/useStreamManager.test.ts` (Modify si nécessaire — vérifier la couverture existante du build context)

**Steps:**

- [ ] Confirmer l'absence d'appelant avant suppression :
```bash
cd apps/mobile && grep -rn "getChatContext" src __tests__
```
Sortie attendue : uniquement la définition (`usePronote.ts:213`) et le return (`usePronote.ts:273`). Si un appelant réel apparaît, STOP et rapporter (le scope changerait).

- [ ] Vérifier la couverture de test de `buildPronoteChatContext`. Lire `apps/mobile/__tests__/hooks/useStreamManager.test.ts`. Si la branche « tout vide → undefined » n'est pas testée et que `buildPronoteChatContext` est exporté/testable, ajouter un cas. Si la fonction est interne (non exportée) et non directement testable, ne PAS l'exporter juste pour le test (YAGNI) — la consolidation est couverte par le fait que la divergence disparaît. Documenter le choix retenu (undefined) par un commentaire WHY déjà présent ligne 56-57 ; le conserver.

- [ ] Supprimer `getChatContext` de `apps/mobile/src/hooks/usePronote.ts` : retirer le bloc `const getChatContext = useCallback(...)` (lignes 213-237) ET la ligne `getChatContext,` dans l'objet retourné (ligne 273). Vérifier qu'aucun import devenu inutile ne subsiste (`PronoteChatContext` n'est plus utilisé dans ce fichier après suppression — retirer son import ligne 30 s'il n'est plus référencé ailleurs dans le fichier).

- [ ] Valider :
```bash
cd apps/mobile && pnpm typecheck && pnpm lint && pnpm test
```
Le typecheck confirmera qu'aucun consommateur ne référençait `getChatContext` (sinon erreur TS).

- [ ] Commit :
```bash
git add apps/mobile/src/hooks/usePronote.ts apps/mobile/__tests__/hooks/useStreamManager.test.ts
git commit -m "refactor(mobile): drop dead getChatContext, single chat-context builder"
```
(Si `useStreamManager.test.ts` n'a pas été modifié, ne pas le stager.)

---

### Task 9: Exposer une erreur Pronote + état d'erreur dans le store et les 3 écrans

**Contexte vérifié :** Les fetch Pronote avalent leurs erreurs en `catch (err) { console.error(...) }` : `apps/mobile/src/hooks/usePronote.ts:130-132` (homework), `:164-166` (grades), `:199-201` (timetable). Aucun état d'erreur n'est exposé → les écrans ne montrent rien à l'utilisateur. Le store `apps/mobile/src/stores/pronote-store.ts` n'a pas de champ d'erreur. Trois écrans consomment ces fetch : `apps/mobile/src/app/(student)/(profile)/pronote/homework.tsx:35-39` (`onRefresh` → `fetchHomework`), `.../grades.tsx:25-29` (`fetchGrades`), `apps/mobile/src/app/(student)/(home)/index.tsx:61-72` (`onRefresh` → `fetchHomework`+`fetchGrades`). Pattern d'UI d'erreur existant à réutiliser : `apps/mobile/src/components/chat/ChatErrorBanner.tsx` (banner `accessibilityRole="alert"` + bouton Réessayer, tokens sémantiques `text-destructive`, `bgColors.destructive`).

**Position prise :** ajouter un champ `lastError: string | null` au store + setter `setError` + reset, le set dans les 3 catch de `usePronote.ts` (au lieu de seulement `console.error`), l'exposer via le hook, et afficher un `ChatErrorBanner` (réutilisé) dans les 3 écrans avec retry = re-fetch. Garder `console.error` (utile en debug) EN PLUS du set d'erreur.

**Files:**
- Modify: `apps/mobile/src/stores/pronote-store.ts`
- Modify: `apps/mobile/src/hooks/usePronote.ts`
- Modify: `apps/mobile/src/app/(student)/(profile)/pronote/homework.tsx`
- Modify: `apps/mobile/src/app/(student)/(profile)/pronote/grades.tsx`
- Modify: `apps/mobile/src/app/(student)/(home)/index.tsx`
- Test: `apps/mobile/__tests__/hooks/usePronote.test.ts` (Create)

**Steps:**

- [ ] Écrire le test d'abord. Créer `apps/mobile/__tests__/hooks/usePronote.test.ts`. Mocker `pronoteSessionService` (pour forcer un throw) et le store. Suivre le pattern de mock de `useStudentDashboard.test.ts` (jest.mock avant import). Cibler : après un `fetchGrades` qui throw, `pronote.error` est non-null ; un fetch réussi le remet à null.
```ts
/**
 * usePronote — surface des erreurs de fetch Pronote.
 */
import { renderHook, act, waitFor } from '@testing-library/react-native';

jest.mock('../../src/services/pronote/pronote-session', () => ({
  pronoteSessionService: {
    refreshSession: jest.fn(),
    connectWithQrCode: jest.fn(),
    disconnect: jest.fn(),
  },
}));

import { pronoteSessionService } from '../../src/services/pronote/pronote-session';
import { usePronote } from '../../src/hooks/usePronote';
import { usePronoteStore } from '../../src/stores/pronote-store';

const mockRefresh = pronoteSessionService.refreshSession as jest.Mock;

describe('usePronote error surfacing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    act(() => {
      usePronoteStore.setState({
        isConnected: true,
        metadata: { instanceUrl: 'https://x.fr', username: 'u', deviceUuid: 'd', accountKind: 0 } as never,
        lastGradesFetch: null,
        lastError: null,
      });
    });
  });

  it('sets error when a grades fetch throws', async () => {
    mockRefresh.mockRejectedValueOnce(new Error('network'));
    const { result } = renderHook(() => usePronote('user-1'));

    await act(async () => {
      await result.current.fetchGrades();
    });

    await waitFor(() => {
      expect(result.current.error).not.toBeNull();
    });
  });
});
```

- [ ] Lancer le test (attendu FAIL — `result.current.error` n'existe pas / `lastError` absent du store) :
```bash
cd apps/mobile && pnpm test -- usePronote.test
```

- [ ] Implémenter le store `apps/mobile/src/stores/pronote-store.ts`. Ajouter à l'interface `PronoteState` (après ligne 37) :
```ts
  lastError: string | null;
```
et dans les actions (après ligne 45 `reset`) :
```ts
  setError: (message: string | null) => void;
```
Ajouter à `initialState` (après ligne 58) :
```ts
  lastError: null,
```
Ajouter le setter dans le `create` (après le bloc `setTimetable`, avant `reset`) :
```ts
      setError: (message) => set({ lastError: message }),
```

- [ ] Implémenter `apps/mobile/src/hooks/usePronote.ts`. Sélectionner le champ + setter (après ligne 62) :
```ts
  const lastError = usePronoteStore((s) => s.lastError);
  const storeSetError = usePronoteStore((s) => s.setError);
```
Dans `fetchHomework` : remplacer le `catch (err) { console.error(...) }` (lignes 130-132) par :
```ts
      } catch (err) {
        console.error('[Pronote] fetchHomework failed:', err);
        storeSetError('Impossible de charger les devoirs. Réessaie.');
      }
```
Et set `null` au début du `try` réussi : juste après `if (!handle) return;` (ligne ~110) ajouter `storeSetError(null);`. Faire de même pour `fetchGrades` (catch lignes 164-166 → message `'Impossible de charger les notes. Réessaie.'`, reset null après `if (!handle) return;`) et `fetchTimetable` (catch lignes 199-201 → message `"Impossible de charger l'emploi du temps. Réessaie."`, reset null). Ajouter les setters aux deps des `useCallback` concernés (`storeSetError`). Exposer dans le return (après `timetable,` ligne 261) :
```ts
    error: lastError,
```
et ajouter `clearError: () => storeSetError(null),` dans les actions du return si utile aux écrans (sinon omettre — YAGNI). Ajouter `storeSetError` aux arrays de deps des 3 `useCallback` de fetch.

- [ ] Relancer le test (attendu PASS) :
```bash
cd apps/mobile && pnpm test -- usePronote.test
```

- [ ] Brancher l'UI dans les 3 écrans en réutilisant `ChatErrorBanner`. Dans `apps/mobile/src/app/(student)/(profile)/pronote/homework.tsx` : importer `import { ChatErrorBanner } from '@/components/chat';` et insérer, juste au-dessus du `<ScrollView>` (après le header `</View>` ligne 84) :
```tsx
        {pronote.error && (
          <ChatErrorBanner error={pronote.error} onRetry={onRefresh} />
        )}
```
- [ ] Idem `apps/mobile/src/app/(student)/(profile)/pronote/grades.tsx` : import `ChatErrorBanner`, insérer après le header `</View>` (ligne 53), au-dessus du `<ScrollView>` :
```tsx
        {pronote.error && (
          <ChatErrorBanner error={pronote.error} onRetry={onRefresh} />
        )}
```
- [ ] Idem `apps/mobile/src/app/(student)/(home)/index.tsx` : import `ChatErrorBanner`, insérer dans le `<ScrollView>`, juste après le bloc Header `</View>` (après ligne 162, avant le bloc Due Cards) :
```tsx
        {pronote.error && (
          <ChatErrorBanner error={pronote.error} onRetry={onRefresh} />
        )}
```
Vérifier que `@/components/chat` exporte bien `ChatErrorBanner` (`apps/mobile/src/components/chat/index.ts` le réexporte — confirmé). NE PAS introduire de classe palette brute ; `ChatErrorBanner` utilise déjà les tokens.

- [ ] Valider (typecheck + lint a11y + tests) :
```bash
cd apps/mobile && pnpm typecheck && pnpm lint && pnpm test
```

- [ ] Commit :
```bash
git add apps/mobile/src/stores/pronote-store.ts apps/mobile/src/hooks/usePronote.ts "apps/mobile/src/app/(student)/(profile)/pronote/homework.tsx" "apps/mobile/src/app/(student)/(profile)/pronote/grades.tsx" "apps/mobile/src/app/(student)/(home)/index.tsx" apps/mobile/__tests__/hooks/usePronote.test.ts
git commit -m "feat(mobile): surface Pronote fetch errors with retry banner"
```

---

### Task 10: Tests des boucles de création d'enfants (onboarding + reconnect)

**Contexte vérifié :** `apps/mobile/src/hooks/usePronoteOnboarding.ts:236-292` `handleChildPinComplete` contient la boucle de création de comptes enfants (lignes 251-274 : pour chaque enfant, `splitPronoteName` → `createChild` → `setCredential` → `setResourceMapping`) avec gestion d'erreur (set `error` ligne 278). `apps/mobile/src/hooks/usePronoteReconnect.ts:215-267` `handleImport` a une boucle analogue avec mot de passe temporaire crypto. Aucun test n'existe pour ces hooks (`__tests__/hooks/` ne contient ni `usePronoteOnboarding` ni `usePronoteReconnect`). Cette tâche teste UNIQUEMENT ces deux hooks (PAS les hooks audio — déférés). Pattern de test à suivre : `useStudentDashboard.test.ts` (jest.mock des deps avant import, `renderHook`, `act`/`waitFor`).

**Files:**
- Test: `apps/mobile/__tests__/hooks/usePronoteOnboarding.test.ts` (Create)
- Test: `apps/mobile/__tests__/hooks/usePronoteReconnect.test.ts` (Create)

**Steps:**

- [ ] Écrire `apps/mobile/__tests__/hooks/usePronoteOnboarding.test.ts`. Mocker `@/hooks` (pour `usePronote` + `useParentDashboard`), `@/lib/auth` (`useUser`), `@/stores/child-access-store`, `expo-router` (`useRouter`). Cibler la boucle de création : appeler `handleImport` avec 2 ressources, puis `handleChildPinComplete` deux fois, et vérifier que `createChild` est appelé 2× avec les bons `firstName`/`username`, et que sur le dernier enfant l'étape passe à `parent-pin`. Couvrir aussi le chemin d'erreur (`createChild` rejette → `error` non-null, étape ne progresse pas).
```ts
/**
 * usePronoteOnboarding — boucle de création des comptes enfants (l.251-274).
 */
import { renderHook, act } from '@testing-library/react-native';

const mockCreateChild = jest.fn();
const mockSetCredential = jest.fn();
const mockSetParentCredential = jest.fn();
const mockSetResourceMapping = jest.fn();
const mockReplace = jest.fn();

jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace }) }));
jest.mock('../../src/lib/auth', () => ({ useUser: () => ({ id: 'parent-1' }) }));
jest.mock('../../src/stores/child-access-store', () => ({
  useChildAccessStore: (sel: (s: unknown) => unknown) =>
    sel({ setCredential: mockSetCredential, setParentCredential: mockSetParentCredential }),
}));
jest.mock('../../src/hooks', () => ({
  usePronote: () => ({ connect: jest.fn(), setResourceMapping: mockSetResourceMapping }),
  useParentDashboard: () => ({ createChild: mockCreateChild, children: [] }),
}));

import { usePronoteOnboarding } from '../../src/hooks/usePronoteOnboarding';

const RESOURCES = [
  { id: 'r1', name: 'Marie Dupont' },
  { id: 'r2', name: 'Léo Martin' },
] as never[];

const PIN = (resource: unknown) => ({
  resource,
  schoolLevel: 'sixieme' as const,
  pinType: 'pin' as const,
  pinValue: '1234',
});

describe('usePronoteOnboarding child creation loop', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateChild.mockImplementation(async (d: { username: string }) => ({ id: `id-${d.username}` }));
  });

  it('creates one account per selected child then advances to parent-pin', async () => {
    const { result } = renderHook(() => usePronoteOnboarding());

    act(() => result.current.handleImport(RESOURCES));
    await act(async () => { await result.current.handleChildPinComplete(PIN(RESOURCES[0])); });
    await act(async () => { await result.current.handleChildPinComplete(PIN(RESOURCES[1])); });

    expect(mockCreateChild).toHaveBeenCalledTimes(2);
    expect(mockCreateChild).toHaveBeenCalledWith(
      expect.objectContaining({ firstName: 'Dupont', username: 'marie.dupont' }),
    );
    expect(result.current.step).toBe('parent-pin');
  });

  it('sets an error and stays when child creation fails', async () => {
    mockCreateChild.mockRejectedValueOnce(new Error('boom'));
    const { result } = renderHook(() => usePronoteOnboarding());

    act(() => result.current.handleImport([RESOURCES[0]]));
    await act(async () => { await result.current.handleChildPinComplete(PIN(RESOURCES[0])); });

    expect(result.current.error).not.toBeNull();
    expect(result.current.step).not.toBe('parent-pin');
  });
});
```
Note : vérifier le résultat attendu de `splitPronoteName('Marie Dupont')` — d'après `pronote-helpers.ts`, le premier token est `lastName`, le reste `firstName` (donc `firstName: 'Dupont'`, `lastName: 'Marie'`). Ajuster l'assertion si la lecture du code montre l'inverse. Lire `splitPronoteName` avant de figer l'assertion.

- [ ] Écrire `apps/mobile/__tests__/hooks/usePronoteReconnect.test.ts` sur le même modèle. Mocker en plus `@/components/ui/toast` (`useToast` → objet de jest.fn) et `expo-crypto` (`getRandomBytesAsync` → renvoyer un `Uint8Array` fixe). Cibler `handleImport` : 2 ressources sélectionnées → `createChild` 2× avec un `password` temporaire non vide, `setResourceMapping` 2×, étape passe à `pin-setup` ; et `handleChildPinComplete` final appelle `router.back()`.
```ts
/**
 * usePronoteReconnect — boucle d'import/création (l.215-267).
 */
import { renderHook, act } from '@testing-library/react-native';

const mockCreateChild = jest.fn();
const mockSetCredential = jest.fn();
const mockSetResourceMapping = jest.fn();
const mockBack = jest.fn();
const toast = { success: jest.fn(), error: jest.fn(), warning: jest.fn() };

jest.mock('expo-router', () => ({ useRouter: () => ({ back: mockBack }) }));
jest.mock('expo-crypto', () => ({
  getRandomBytesAsync: jest.fn(async () => new Uint8Array(16).fill(7)),
}));
jest.mock('../../src/lib/auth', () => ({ useUser: () => ({ id: 'parent-1' }) }));
jest.mock('../../src/components/ui/toast', () => ({ useToast: () => toast }));
jest.mock('../../src/stores/child-access-store', () => ({
  useChildAccessStore: (sel: (s: unknown) => unknown) => sel({ setCredential: mockSetCredential }),
}));
jest.mock('../../src/hooks', () => ({
  usePronote: () => ({ connect: jest.fn(), setResourceMapping: mockSetResourceMapping }),
  useParentDashboard: () => ({ createChild: mockCreateChild, children: [] }),
}));

import { usePronoteReconnect } from '../../src/hooks/usePronoteReconnect';

const RESOURCES = [
  { id: 'r1', name: 'Marie Dupont' },
  { id: 'r2', name: 'Léo Martin' },
] as never[];

describe('usePronoteReconnect import loop', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateChild.mockImplementation(async () => ({ id: `child-${Math.random()}` }));
  });

  it('creates an account per resource with a non-empty temp password then goes to pin-setup', async () => {
    const { result } = renderHook(() => usePronoteReconnect());

    await act(async () => { await result.current.handleImport(RESOURCES); });

    expect(mockCreateChild).toHaveBeenCalledTimes(2);
    const firstArg = mockCreateChild.mock.calls[0][0];
    expect(firstArg.password).toEqual(expect.any(String));
    expect(firstArg.password.length).toBeGreaterThan(0);
    expect(result.current.step).toBe('pin-setup');
  });

  it('navigates back when no resource is selected', async () => {
    const { result } = renderHook(() => usePronoteReconnect());
    await act(async () => { await result.current.handleImport([]); });
    expect(mockBack).toHaveBeenCalled();
    expect(mockCreateChild).not.toHaveBeenCalled();
  });
});
```

- [ ] Lancer les deux tests. Ajuster les mocks si un import non couvert apparaît (lire l'erreur, mocker la dépendance manquante en suivant le même style). Vérifier l'assertion `splitPronoteName` contre le code réel.
```bash
cd apps/mobile && pnpm test -- usePronoteOnboarding usePronoteReconnect
```
Sortie attendue : tous les tests PASS (le code existe déjà ; ces tests sont des régression-guards qui passent au vert une fois les mocks corrects).

- [ ] Valider :
```bash
cd apps/mobile && pnpm typecheck && pnpm lint && pnpm test
```

- [ ] Commit :
```bash
git add apps/mobile/__tests__/hooks/usePronoteOnboarding.test.ts apps/mobile/__tests__/hooks/usePronoteReconnect.test.ts
git commit -m "test(mobile): cover Pronote onboarding + reconnect child-creation loops"
```

---

### Task 11: Robustesse du LogoutButton web (try/catch + loading + feedback)

**Contexte vérifié :** `apps/web/components/logout-button.tsx` est un `<button>` brut (lignes 16-23), `handleLogout` (9-13) appelle `await signOut()` sans try/catch ni état de loading → un échec réseau de `signOut` produit une rejection non gérée et l'utilisateur reste sans feedback. `@repo/ui` exporte `Button` (et `buttonVariants`). Pattern de bouton avec spinner + `aria-busy` déjà présent dans `app/login/page.tsx:122-133` (Loader2 + `sr-only`).

**Position prise :** convertir en `Button` de `@repo/ui` (variant `ghost` pour conserver l'apparence discrète), ajouter `loading` state, try/catch autour de `signOut`, et un message d'erreur visible (`role="alert"`) en cas d'échec. La redirection ne se fait que si `signOut` réussit.

**Files:**
- Modify: `apps/web/components/logout-button.tsx`
- Test: `apps/web/components/logout-button.test.tsx` (Create)

**Steps:**

- [ ] Écrire le test d'abord (vitest + Testing Library, env jsdom par défaut). Créer `apps/web/components/logout-button.test.tsx` :
```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const push = vi.fn();
const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh }) }));

const signOut = vi.fn();
vi.mock('@/lib/auth-client', () => ({ signOut: (...a: unknown[]) => signOut(...a) }));

import { LogoutButton } from './logout-button';

describe('LogoutButton', () => {
  beforeEach(() => {
    push.mockClear();
    refresh.mockClear();
    signOut.mockReset();
  });

  it('signs out then redirects on success', async () => {
    signOut.mockResolvedValueOnce(undefined);
    render(<LogoutButton />);
    await userEvent.click(screen.getByRole('button', { name: /déconnexion/i }));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/login'));
  });

  it('shows an error and does not redirect when sign out fails', async () => {
    signOut.mockRejectedValueOnce(new Error('network'));
    render(<LogoutButton />);
    await userEvent.click(screen.getByRole('button', { name: /déconnexion/i }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(push).not.toHaveBeenCalled();
  });
});
```
Vérifier que `@testing-library/user-event` est dispo dans `apps/web` (devDeps liste `@testing-library/react` + `@testing-library/jest-dom`). Si `user-event` n'est PAS présent, NE PAS l'ajouter — remplacer `userEvent.click` par `fireEvent.click` (`import { fireEvent } from '@testing-library/react'`). Vérifier d'abord :
```bash
cd apps/web && node -e "require.resolve('@testing-library/user-event')" 2>/dev/null && echo HAS_USER_EVENT || echo NO_USER_EVENT
```
Adapter le test selon la sortie.

- [ ] Lancer le test (attendu FAIL — pas de `role="alert"`, pas de gestion d'échec) :
```bash
cd apps/web && pnpm test -- logout-button
```

- [ ] Implémenter `apps/web/components/logout-button.tsx` :
```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@repo/ui";
import { signOut } from "@/lib/auth-client";

export function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogout() {
    setError(null);
    setLoading(true);
    try {
      await signOut();
      router.push("/login");
      router.refresh();
    } catch {
      setError("Déconnexion impossible. Vérifiez votre connexion et réessayez.");
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <Button
        type="button"
        variant="ghost"
        onClick={handleLogout}
        disabled={loading}
        aria-busy={loading}
        className="justify-start text-muted-foreground"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            <span className="sr-only">Déconnexion en cours…</span>
            <span>Déconnexion</span>
          </>
        ) : (
          "Déconnexion"
        )}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
```
Note : `Button` de `@repo/ui` (shadcn) accepte `variant`/`disabled`/`className`. Si le variant `ghost` n'existe pas dans `buttonVariants`, lire `packages/ui/src/components/button.tsx` et choisir le variant le plus proche de l'apparence d'origine (texte muted, hover accent) ; ne pas inventer de classe palette brute.

- [ ] Relancer le test (attendu PASS) :
```bash
cd apps/web && pnpm test -- logout-button
```

- [ ] Valider :
```bash
cd apps/web && pnpm typecheck && pnpm lint && pnpm test
```

- [ ] Commit :
```bash
git add apps/web/components/logout-button.tsx apps/web/components/logout-button.test.tsx
git commit -m "fix(web): robust logout button (loading + error feedback, no unhandled rejection)"
```

---

### Task 12: Ajouter error.tsx + loading.tsx (App Router) au web

**Contexte vérifié :** `apps/web/app/` n'a ni `error.tsx` ni `loading.tsx` ni `global-error.tsx` (Glob : aucun). Next.js 16 App Router : `error.tsx` doit être un Client Component recevant `{ error, reset }` ; `loading.tsx` est l'UI de Suspense de segment. Le layout racine (`app/layout.tsx`) utilise les tokens (`bg-background` via globals, fonts). Copie FR minimale, tokens sémantiques, réutiliser `Button` de `@repo/ui` pour le retry.

**DOC-FIRST :** confirmer la signature `error.tsx` (`{ error: Error & { digest?: string }; reset: () => void }`) et la nécessité de `"use client"` dans la doc Next.js (https://nextjs.org/docs/app/api-reference/file-conventions/error). Citer dans le commit.

**Files:**
- Create: `apps/web/app/error.tsx`
- Create: `apps/web/app/loading.tsx`

**Steps:**

- [ ] Créer `apps/web/app/error.tsx` :
```tsx
"use client";

import { Button } from "@repo/ui";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-2xl font-bold">Une erreur est survenue</h1>
      <p className="text-muted-foreground">
        Quelque chose s&apos;est mal passé. Vous pouvez réessayer.
      </p>
      <Button type="button" onClick={reset}>
        Réessayer
      </Button>
    </div>
  );
}
```

- [ ] Créer `apps/web/app/loading.tsx` :
```tsx
import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div
      className="flex min-h-screen items-center justify-center"
      role="status"
      aria-live="polite"
    >
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden="true" />
      <span className="sr-only">Chargement…</span>
    </div>
  );
}
```

- [ ] Valider (build inclus pour confirmer que Next.js accepte les conventions) :
```bash
cd apps/web && pnpm typecheck && pnpm lint
```

- [ ] Commit (citer la doc) :
```bash
git add apps/web/app/error.tsx apps/web/app/loading.tsx
git commit -m "feat(web): add App Router error + loading boundaries

Minimal FR copy, semantic tokens. Validated against
https://nextjs.org/docs/app/api-reference/file-conventions/error (client
component, { error, reset } props)."
```

---

### Task 13: Supprimer l'export mort useUser du client auth web

**Contexte vérifié :** `apps/web/lib/auth-client.ts:26-31` exporte `useUser()`. Recherche des consommateurs (`grep -rn "useUser\|useSession" apps/web`) : `useUser` n'est appelé NULLE PART hors de sa propre définition ; `useSession` n'est utilisé qu'à l'intérieur de `useUser` (ligne 27). Le flux de login (`app/login/page.tsx:38`) lit le rôle directement depuis le résultat synchrone de `signIn.email` (`result.data?.user`), ce qui est CORRECT : `useUser`/`useSession` sont réactifs et ne donnent pas l'utilisateur synchroniquement juste après sign-in. **Position : wiring `useUser` dans le login n'a pas de sens ; on supprime l'export mort `useUser` + l'export standalone `useSession`** (un prior audit les a flaggés morts). On garde `signIn`/`signUp`/`signOut` (utilisés). On garde `useSession` ré-exporté SI on en a besoin pour `useUser` — mais comme on supprime `useUser`, l'export `useSession` devient aussi mort → le retirer de la ligne 19, garder `signIn, signUp, signOut`.

**Files:**
- Modify: `apps/web/lib/auth-client.ts`

**Steps:**

- [ ] Re-confirmer zéro consommateur juste avant la suppression :
```bash
cd apps/web && grep -rn "useUser\|useSession" --include="*.ts" --include="*.tsx" . | grep -v "lib/auth-client.ts"
```
Sortie attendue : aucune ligne (hors `auth-client.ts` lui-même et éventuellement la doc `CLAUDE.md`). Si un `.tsx` consomme `useUser`/`useSession`, STOP et rapporter — la suppression casserait un appelant.

- [ ] Modifier `apps/web/lib/auth-client.ts` : remplacer la ligne 19 :
```ts
export const { useSession, signIn, signUp, signOut } = authClient;
```
par :
```ts
export const { signIn, signUp, signOut } = authClient;
```
Supprimer entièrement le bloc `useUser` (lignes 21-31, incluant le JSDoc `/** Hook : utilisateur connecté ... */`). Si l'import `import type { IAppUser } from "@repo/api/types";` (ligne 13) n'est plus utilisé après suppression, le retirer aussi (le typecheck le confirmera : import inutilisé → erreur lint `no-unused-vars` ou avertissement TS).

- [ ] Valider (le typecheck garantit qu'aucun appelant ne référençait les exports supprimés) :
```bash
cd apps/web && pnpm typecheck && pnpm lint && pnpm test
```

- [ ] Commit :
```bash
git add apps/web/lib/auth-client.ts
git commit -m "refactor(web): drop dead useUser/useSession exports from auth client"
```

---

### Task 14: Logguer le contexte avant le redirect fail-closed du proxy web

**Contexte vérifié :** `apps/web/proxy.ts:32-34` : le `catch { role = null; }` avale silencieusement toute erreur réseau du `fetch` vers `/api/auth/get-session`, puis le flux redirige fail-closed vers `/login` (lignes 38-41). Comportement de sécurité correct (fail-closed) mais opaque en debug — un backend down se manifeste comme « tout le monde déconnecté » sans trace. Ajouter un `console.error` structuré avant de continuer (pas de changement du comportement de redirect). Le test existant `proxy.test.ts:34-38` (« redirects to /login when the session fetch throws ») reste vert.

**Files:**
- Modify: `apps/web/proxy.ts`

**Steps:**

- [ ] Modifier `apps/web/proxy.ts`, remplacer le bloc catch (lignes 32-34) :
```ts
  } catch {
    role = null;
  }
```
par :
```ts
  } catch (err) {
    console.error("[proxy] session fetch failed, failing closed to /login", {
      path: request.nextUrl.pathname,
      serverUrl: SERVER_URL,
      error: err instanceof Error ? err.message : String(err),
    });
    role = null;
  }
```

- [ ] Valider (le test proxy existant doit rester vert) :
```bash
cd apps/web && pnpm typecheck && pnpm lint && pnpm test -- proxy
```
Sortie attendue : les 7 tests de `proxy.test.ts` PASS (le test « fetch throws » loggue maintenant mais redirige toujours vers /login).

- [ ] Commit :
```bash
git add apps/web/proxy.ts
git commit -m "fix(web): log session fetch failure before fail-closed redirect"
```

---

### Task 15: Ajouter .env.example pour apps/web

**Contexte vérifié :** Recherche `process.env`/`NEXT_PUBLIC` dans `apps/web` : seule variable consommée = `NEXT_PUBLIC_SERVER_URL` (`lib/auth-client.ts:15`, `proxy.ts:4`), défaut `http://localhost:3000`. `apps/web/CLAUDE.md:54` documente exactement cette variable. Aucun `.env.example` n'existe dans `apps/web`. Pure doc/config → pas de test.

**Files:**
- Create: `apps/web/.env.example`

**Steps:**

- [ ] Confirmer l'inventaire des variables (aucune autre que `NEXT_PUBLIC_SERVER_URL`) :
```bash
cd apps/web && grep -rn "process.env\." --include="*.ts" --include="*.tsx" .
```
Sortie attendue : uniquement `NEXT_PUBLIC_SERVER_URL` dans `lib/auth-client.ts` et `proxy.ts`. Si une autre variable apparaît, l'ajouter au fichier ci-dessous.

- [ ] Créer `apps/web/.env.example` :
```bash
# URL du backend Elysia (auth Better Auth + API @repo/api).
# En dev, laisser le défaut : le cookie de session est host-only sur localhost,
# partagé entre :3000 (api) et :3002 (web).
NEXT_PUBLIC_SERVER_URL=http://localhost:3000
```

- [ ] Vérifier que le fichier n'est pas ignoré par git (les `.env.example` doivent être commitables) :
```bash
cd /home/ordiv/projets/tomai-monorepo && git check-ignore apps/web/.env.example || echo "NOT_IGNORED_OK"
```
Sortie attendue : `NOT_IGNORED_OK` (le fichier est suivable). S'il est ignoré, vérifier le `.gitignore` (les patterns `.env*` excluent souvent `!.env.example` — confirmer la présence d'une négation ; ne PAS modifier le `.gitignore` sans le signaler).

- [ ] Commit :
```bash
git add apps/web/.env.example
git commit -m "docs(web): add .env.example documenting NEXT_PUBLIC_SERVER_URL"
```

---

## Récapitulatif d'ordre d'exécution

1. Task 1 — fix(server) shutdown scheduler/cron
2. Task 2 — docs(chat) stale Gemini comment
3. Task 3 — test(chat) multi-iteration usage
4. Task 4 — perf(rag) offload inference (ai-service)
5. Task 5 — ci enable uv cache
6. Task 6 — ci(rag) veille BO workflow
7. Task 7 — refactor(mobile) shared QR helpers
8. Task 8 — refactor(mobile) consolidate chat-context + dead code
9. Task 9 — feat(mobile) surface Pronote errors
10. Task 10 — test(mobile) onboarding + reconnect loops
11. Task 11 — fix(web) robust logout button
12. Task 12 — feat(web) error + loading boundaries
13. Task 13 — refactor(web) drop dead auth exports
14. Task 14 — fix(web) log proxy failure
15. Task 15 — docs(web) .env.example

**Exclu (YAGNI, justifié) :** batch S3 DeleteObjects en suppression d'enfant.

**Après toutes les tâches**, avant push : exécuter les suites complètes par app touchée (server : `bun run test:integration` en plus), puis ouvrir une PR `feat/phase5-robustness` → `main` (merge commit, jamais squash).
```

---

J'ai terminé l'exploration et produit le plan complet ci-dessus. Quelques points de vérification importants pour l'orchestrateur :

**Vérifications de lignes effectuées (le code a bougé depuis la revue) :**
- ai-service : le chemin réel est `apps/ai-service/src/main.py` (pas `apps/ai-service/main.py`) ; les handlers `embed`/`rerank` sont aux lignes 78-89, conformes à la revue.
- mobile M11 : `getChatContext` est bien du code mort (zéro appelant réel, confirmé par grep) ; la divergence comportementale est réelle (`getChatContext` retourne un objet-de-undefineds, `buildPronoteChatContext` retourne `undefined` — ce dernier est le bon).
- mobile M10 : `pronote-helpers.ts` existe déjà mais pour grades/devoirs ; les helpers QR sont ailleurs et toujours dupliqués → tâche d'extraction vers le module existant.
- web : `useUser`/`useSession` sont morts ; le cast manuel au login est correct → position prise = suppression, pas wiring.

**Positions prises nécessitant validation humaine éventuelle :**
- Task 4 (ai-service) : `anyio.Lock` par modèle + `run_in_threadpool` — `anyio` est transitif (pas de nouvelle dep). À confirmer doc-first FastAPI avant commit.
- Task 6 (veille BO) : workflow minimal sans persistance d'état entre runs (idempotence côté issue via titre daté). Si une persistance d'état est souhaitée, c'est un sur-scope à discuter.

**Exclusion :** batch S3 DeleteObjects marqué YAGNI (suppression d'UN enfant = volume borné).

Fichiers clés référencés (chemins absolus) : `/home/ordiv/projets/tomai-monorepo/apps/server/src/services/server-lifecycle.ts`, `/home/ordiv/projets/tomai-monorepo/apps/server/src/index.ts`, `/home/ordiv/projets/tomai-monorepo/apps/server/src/services/chat/mistral-chat.service.ts`, `/home/ordiv/projets/tomai-monorepo/apps/ai-service/src/main.py`, `/home/ordiv/projets/tomai-monorepo/.github/workflows/{ai-service,curriculum}.yml`, `/home/ordiv/projets/tomai-monorepo/apps/curriculum/scripts/veille_programmes.py`, `/home/ordiv/projets/tomai-monorepo/apps/mobile/src/hooks/{usePronote,usePronoteOnboarding,usePronoteReconnect}.ts`, `/home/ordiv/projets/tomai-monorepo/apps/mobile/src/hooks/chat/useStreamManager.ts`, `/home/ordiv/projets/tomai-monorepo/apps/mobile/src/stores/pronote-store.ts`, `/home/ordiv/projets/tomai-monorepo/apps/web/{components/logout-button.tsx,lib/auth-client.ts,proxy.ts}`.