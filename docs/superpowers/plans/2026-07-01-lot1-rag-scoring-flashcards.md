# Lot 1 — RAG scoring P0 + déblocage génération flashcards — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendre la couche scoring RAG cohérente avec la fusion RRF (scores ~0.016, pas cosine) : débloquer la génération de flashcards (400 systématique aujourd'hui), supprimer les pseudo-pourcentages montrés au LLM, supprimer le paramètre mort `minSimilarity`, et corriger la double amplification prefetch (16× au lieu de 4×).

**Architecture:** Aucun changement de structure — corrections chirurgicales dans `rag.service.ts`, `qdrant.service.ts` (appel seulement), `card-generate.routes.ts` (gate extrait en helper testable dans `routes/learning/helpers.ts`) et `document-analysis.service.ts`. Référence : audit `docs/audits/2026-07-01-curriculum-to-frontend-architecture.md` (findings P0 n°1 + importants scoring).

**Tech Stack:** Bun 1.3, Elysia 1.4, Qdrant Query API (fusion RRF), Bun test runner (`mock.module`).

## Global Constraints

- Validation avant chaque commit : `cd apps/server && bun run typecheck && bun run lint && bun run test` (zéro warning).
- Avant push : AUSSI `bun run test:integration` (piège connu : `api-endpoints.test.ts` mocke `drizzle-orm` partiellement).
- Stager les fichiers explicitement (jamais `git add .`). Jamais `--amend`.
- Commits conventionnels, scope `server`, anglais.
- Branche de travail : `fix/rag-scoring-flashcards` depuis `origin/main`.
- Sémantique à préserver : en mode RRF les scores absolus n'ont AUCUN sens métier (magnitude dépend du `k` de la version Qdrant serveur — https://qdrant.tech/documentation/concepts/hybrid-queries/). Aucun nouveau seuil sur ces scores.

---

### Task 0: Branche de travail

**Files:** aucun.

- [ ] **Step 1: Créer la branche depuis main**

```bash
cd /home/ordiv/projets/tomai-monorepo
git fetch origin main --quiet
git checkout -b fix/rag-scoring-flashcards origin/main
```

- [ ] **Step 2: Vérifier l'état vert de départ**

Run: `cd apps/server && bun run typecheck && bun run lint && bun run test`
Expected: exit 0, tous tests PASS (baseline avant modification).

---

### Task 1: `rag.service.ts` — contexte LLM par rang (plus de faux %) + suppression de `minSimilarity`

**Files:**
- Modify: `apps/server/src/services/rag.service.ts` (interface `HybridSearchOptions` l.36-52, `buildContext` l.304-318)
- Test: `apps/server/src/tests/rag.service.test.ts`

**Interfaces:**
- Consumes: `qdrantService.searchHybrid` (inchangé dans cette task), mocks existants du fichier de test.
- Produces: `HybridSearchResult.context` sans aucun `%` ; `HybridSearchOptions` SANS champ `minSimilarity` (Task 3 dépend de cette suppression). `averageSimilarity` reste dans le résultat (consommé par l'audit RGPD et les logs) mais n'est plus jamais comparé à un seuil.

- [ ] **Step 1: Écrire les tests qui échouent**

Ajouter à la fin de `apps/server/src/tests/rag.service.test.ts` :

```typescript
describe('RAGService — contexte LLM (scores RRF jamais affichés en %)', () => {
  it('builds context with rank markers and no percentage', async () => {
    // Scores RRF réalistes (~1/(k+rank)) : le contexte ne doit JAMAIS les
    // présenter comme des pourcentages de similarité.
    mockSearchHybrid.mockImplementationOnce(async () => [
      { id: 'c1', score: 0.016, text: 'chunk one', section: 'S1', matiere: 'maths', niveau: 'sixieme' },
      { id: 'c2', score: 0.015, text: 'chunk two', section: 'S2', matiere: 'maths', niveau: 'sixieme' },
    ]);

    const result = await ragService.hybridSearch(BASE_OPTIONS);

    expect(result.context).toContain('[1] S1 (sixieme - maths)');
    expect(result.context).toContain('[2] S2 (sixieme - maths)');
    expect(result.context).toContain('chunk one');
    expect(result.context).not.toContain('%');
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `cd apps/server && bun test src/tests/rag.service.test.ts`
Expected: FAIL — le contexte actuel contient `[2%]` (donc `not.toContain('%')` échoue).

- [ ] **Step 3: Implémenter**

Dans `apps/server/src/services/rag.service.ts` :

(a) Supprimer la ligne `minSimilarity?: number;` de `HybridSearchOptions` (l.43). Le doc-comment au-dessus de `auditUserId` reste inchangé.

(b) Remplacer `buildContext` (l.304-318) par :

```typescript
  private buildContext(results: QdrantSearchResult[]): string {
    if (results.length === 0) return '';

    // Scores RRF (~1/(k+rank)) non affichés : leur magnitude dépend de la
    // version Qdrant et n'est pas une similarité — seul le rang est fiable.
    const contextParts = results.map((result, index) => {
      return `[${index + 1}] ${result.section} (${result.niveau} - ${result.matiere})
${result.text}`;
    });

    return `📚 PROGRAMMES OFFICIELS

${contextParts.join('\n\n---\n\n')}

⚠️ Utilise UNIQUEMENT ces informations officielles pour répondre.`;
  }
```

(c) Mettre à jour le bloc de constantes (l.25-30) : `MIN_SCORE` et `GOOD_SCORE` deviennent morts après la Task 4 mais `getThresholds()` est encore appelé par `card-generate.routes.ts` jusqu'à la Task 4 — **ne pas les supprimer dans cette task** (la Task 4 s'en charge).

- [ ] **Step 4: Vérifier le vert**

Run: `cd apps/server && bun test src/tests/rag.service.test.ts`
Expected: PASS (tous, y compris les 3 tests rerank existants).

- [ ] **Step 5: Typecheck (le champ supprimé doit casser document-analysis)**

Run: `cd apps/server && bun run typecheck`
Expected: **FAIL** sur `src/services/document/document-analysis.service.ts:318` (`minSimilarity` n'existe plus). C'est attendu — corrigé en Task 2. **Ne pas committer encore.**

---

### Task 2: `document-analysis.service.ts` — retirer le no-op `minSimilarity` et l'affichage de score RRF

**Files:**
- Modify: `apps/server/src/services/document/document-analysis.service.ts` (l.313-328)

**Interfaces:**
- Consumes: `ragService.hybridSearch` sans `minSimilarity` (Task 1).
- Produces: contexte document avec `[Source N]` sans score. Aucun changement de signature publique.

- [ ] **Step 1: Implémenter**

Dans `apps/server/src/services/document/document-analysis.service.ts`, remplacer l'appel (l.313-319) :

```typescript
      const response = await ragService.hybridSearch({
        query: truncated,
        niveau: schoolLevel,
        limit: 5,
        auditUserId: auditUserId ?? null,
      });
```

(suppression de la ligne `minSimilarity: 0.6,` — c'était un no-op silencieux : l'option n'a jamais été lue par `hybridSearch`.)

Puis remplacer la construction du contexte (l.325-327) :

```typescript
      const context = response.semanticChunks
        .map((c, i) => `[Source ${i + 1}]\n${c.text}`)
        .join('\n\n---\n\n');
```

(suppression de `- Score: ${c.score.toFixed(2)}` : score RRF ~0.02 affiché au LLM = même bug de classe que le `[2%]`.)

- [ ] **Step 2: Validation complète**

Run: `cd apps/server && bun run typecheck && bun run lint && bun run test`
Expected: exit 0 partout (l'erreur de la Task 1 Step 5 est résolue).

- [ ] **Step 3: Commit (Tasks 1+2 ensemble — même invariant sémantique)**

```bash
cd /home/ordiv/projets/tomai-monorepo
git add apps/server/src/services/rag.service.ts apps/server/src/services/document/document-analysis.service.ts apps/server/src/tests/rag.service.test.ts
git commit -m "fix(server): stop presenting RRF fusion scores as cosine percentages

RRF scores (~1/(k+rank), magnitude depends on Qdrant server version) were
shown to the LLM as similarity percentages ([2%]) in both the chat RAG
context and document analysis, and the dead minSimilarity option let
callers believe they were filtering. Rank markers only from now on.

Audit ref: docs/audits/2026-07-01-curriculum-to-frontend-architecture.md"
```

---

### Task 3: `rag.service.ts` — corriger la double amplification prefetch (16× → 4×)

**Files:**
- Modify: `apps/server/src/services/rag.service.ts` (l.113-139)
- Test: `apps/server/src/tests/rag.service.test.ts`

**Interfaces:**
- Consumes: `qdrantService.searchHybrid(queryDense, querySparse, filter, limit, options)` — signature INCHANGÉE : `limit` = nombre de résultats fusionnés retournés, prefetch par branche = `max(limit*4, 20)` calculé en interne (`qdrant.service.ts:143`).
- Produces: `searchHybrid` appelé avec `limit = topK` quand le rerank est off, `limit = candidateK` (candidats du cross-encoder) quand il est on. Comportement observable pour les mocks : 4e argument de `mockSearchHybrid`.

- [ ] **Step 1: Écrire les tests qui échouent**

Ajouter à la fin de `apps/server/src/tests/rag.service.test.ts` :

```typescript
describe('RAGService — limites de recherche (pas de double amplification)', () => {
  it('requests exactly topK fused results when rerank is disabled', async () => {
    rerankEnabled = false;

    await ragService.hybridSearch({ ...BASE_OPTIONS, limit: 5 });

    // 4e argument de searchHybrid = limit fusionné. Avant fix : max(5*4,20)=20
    // (puis re-amplifié ×4 en interne → prefetch 80 = 16× topK).
    const call = mockSearchHybrid.mock.calls[0] as unknown[];
    expect(call[3]).toBe(5);
  });

  it('requests the rerank candidate pool as fused limit when rerank is enabled', async () => {
    rerankEnabled = true;

    await ragService.hybridSearch({ ...BASE_OPTIONS, limit: 5 });

    const call = mockSearchHybrid.mock.calls[0] as unknown[];
    expect(call[3]).toBe(20); // max(5*4, 20) candidats pour le cross-encoder
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `cd apps/server && bun test src/tests/rag.service.test.ts`
Expected: FAIL — le premier test reçoit `20` au lieu de `5`.

- [ ] **Step 3: Implémenter**

Dans `apps/server/src/services/rag.service.ts`, remplacer le bloc l.113-139 (de `const topK = ...` jusqu'à l'appel `searchHybrid` inclus) par :

```typescript
      const topK = options.limit ?? 5;
      // Limite FUSIONNÉE demandée à Qdrant (le prefetch par branche est dérivé
      // en interne par searchHybrid : max(limit*4, 20)) :
      // - rerank off : on veut exactement topK résultats fusionnés ;
      // - rerank on  : on élargit au pool de candidats du cross-encoder
      //   (RAG_RERANK_CANDIDATES, défaut 4× topK) qui re-trie puis coupe à topK.
      const candidateK = env.RAG_RERANK_CANDIDATES ?? Math.max(topK * 4, 20);
      const fusedLimit = isRerankEnabled() ? candidateK : topK;

      // NOTE : on ne passe PAS scoreThreshold à searchHybrid. La fusion RRF
      // côté Qdrant retourne des scores de rang (1/(k+rank), magnitude dépendant
      // de la version serveur) qui ne sont PAS des similarités cosine — aucun
      // seuil absolu n'a de sens dessus ; seul le rang est exploitable.
      //
      // Pré-requis collection (vérifié par boot check ou déploiement coordonné) :
      // - sparse_vectors_config.bm25 avec Modifier.IDF (cf. migrate_collection.py
      //   du curriculum). Si absent, Qdrant renvoie 400 "vector name not found"
      //   et l'erreur propage — on ne masque PAS le problème avec un fallback
      //   silencieux qui rendrait la régression invisible en observabilité.
      let results = await qdrantService.searchHybrid(
        queryDense,
        querySparse,
        { niveau: options.niveau, matiere: options.matiere },
        fusedLimit,
        { hnswEf: 128 },
      );
```

(La variable `prefetchK` disparaît ; les slices `results.slice(0, topK)` existants l.159/166/169 restent — no-ops en mode sans rerank, coupe réelle après rerank.)

- [ ] **Step 4: Vérifier le vert**

Run: `cd apps/server && bun test src/tests/rag.service.test.ts`
Expected: PASS (les tests rerank existants restent verts : avec `RAG_RERANK_CANDIDATES: undefined` et limit 2, fusedLimit rerank = max(8,20)=20, off = 2).

- [ ] **Step 5: Validation + commit**

Run: `cd apps/server && bun run typecheck && bun run lint && bun run test`
Expected: exit 0.

```bash
cd /home/ordiv/projets/tomai-monorepo
git add apps/server/src/services/rag.service.ts apps/server/src/tests/rag.service.test.ts
git commit -m "fix(server): remove double prefetch amplification in hybrid search

rag.service passed max(topK*4,20) as the fused limit to searchHybrid,
which internally re-multiplies by 4 for per-branch prefetch — actual
prefetch was 16x topK instead of the intended 4x. The fused limit is now
topK (no rerank) or the cross-encoder candidate pool (rerank on)."
```

---

### Task 4: Gate flashcards — générer dès que le programme répond (fin du seuil cosine sur scores RRF)

**Files:**
- Modify: `apps/server/src/routes/learning/helpers.ts` (ajout d'une fonction)
- Modify: `apps/server/src/routes/learning/card-generate.routes.ts` (l.78-126)
- Modify: `apps/server/src/services/rag.service.ts` (suppression `RAG_THRESHOLDS`/`getThresholds`)
- Test: `apps/server/src/tests/learning-rag-gate.test.ts` (créer)

**Interfaces:**
- Consumes: `HybridSearchResult` (`strategy: string`, `semanticChunks: SemanticChunk[]`) de `rag.service.ts`.
- Produces: `evaluateRagGate(ragResult: Pick<HybridSearchResult, 'strategy' | 'semanticChunks'>): RagGateResult` exportée de `routes/learning/helpers.ts` avec :

```typescript
export type RagGateResult =
  | { ok: true }
  | { ok: false; reason: 'rag_disabled'; httpStatus: 503 }
  | { ok: false; reason: 'no_results'; httpStatus: 400 };
```

- [ ] **Step 1: Écrire les tests qui échouent**

Créer `apps/server/src/tests/learning-rag-gate.test.ts` :

```typescript
/**
 * Non-régression audit 2026-07-01 P0 n°1 : le gate de génération de flashcards
 * comparait averageSimilarity (scores RRF ≈ 0.02) au seuil cosine GOOD_SCORE
 * (0.5) → 400 TOPIC_NOT_IN_CURRICULUM systématique en mode qdrant-hybrid-rrf.
 * Le gate ne doit dépendre QUE de la présence de résultats, jamais de la
 * magnitude des scores RRF.
 */

import { describe, it, expect } from 'bun:test';
import { evaluateRagGate } from '../routes/learning/helpers';

const chunk = (score: number) => ({
  id: 'c1',
  score,
  text: 'Les fractions au programme de sixième',
  section: 'Nombres et calculs',
  matiere: 'maths',
  niveau: 'sixieme',
});

describe('evaluateRagGate', () => {
  it('passes with realistic RRF-scale scores (regression: was rejected by cosine threshold)', () => {
    const result = evaluateRagGate({
      strategy: 'qdrant-hybrid-rrf',
      semanticChunks: [chunk(0.016), chunk(0.015), chunk(0.014)],
    });
    expect(result).toEqual({ ok: true });
  });

  it('passes with rerank strategy too', () => {
    const result = evaluateRagGate({
      strategy: 'qdrant-hybrid-rrf+rerank-bge-m3',
      semanticChunks: [chunk(0.92)],
    });
    expect(result).toEqual({ ok: true });
  });

  it('returns 503 when the RAG service is disabled', () => {
    const result = evaluateRagGate({ strategy: 'disabled', semanticChunks: [] });
    expect(result).toEqual({ ok: false, reason: 'rag_disabled', httpStatus: 503 });
  });

  it('returns 400 when the curriculum has no match', () => {
    const result = evaluateRagGate({ strategy: 'qdrant-hybrid-rrf', semanticChunks: [] });
    expect(result).toEqual({ ok: false, reason: 'no_results', httpStatus: 400 });
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `cd apps/server && bun test src/tests/learning-rag-gate.test.ts`
Expected: FAIL — `evaluateRagGate` n'existe pas (erreur d'import).

- [ ] **Step 3: Implémenter le helper**

Dans `apps/server/src/routes/learning/helpers.ts`, ajouter (en conservant l'existant, dont `getUserLevel`) :

```typescript
export type RagGateResult =
  | { ok: true }
  | { ok: false; reason: 'rag_disabled'; httpStatus: 503 }
  | { ok: false; reason: 'no_results'; httpStatus: 400 };

/**
 * Gate de génération : on génère dès que le programme officiel répond.
 * Volontairement AUCUN seuil sur les scores : en fusion RRF ce sont des
 * scores de rang (~1/(k+rank)), pas des similarités — toute comparaison
 * absolue est un bug (audit 2026-07-01, P0 n°1).
 */
export function evaluateRagGate(
  ragResult: { strategy: string; semanticChunks: readonly unknown[] },
): RagGateResult {
  if (ragResult.strategy === 'disabled') {
    return { ok: false, reason: 'rag_disabled', httpStatus: 503 };
  }
  if (ragResult.semanticChunks.length === 0) {
    return { ok: false, reason: 'no_results', httpStatus: 400 };
  }
  return { ok: true };
}
```

- [ ] **Step 4: Vérifier le vert du helper**

Run: `cd apps/server && bun test src/tests/learning-rag-gate.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Câbler la route**

Dans `apps/server/src/routes/learning/card-generate.routes.ts` :

(a) Étendre l'import l.12 : `import { getUserLevel, evaluateRagGate } from './helpers';`

(b) Supprimer la ligne l.78 `const ragThresholds = ragService.getThresholds();`

(c) Dans le log `'RAG context retrieved'` (l.80-87), supprimer la ligne `threshold: ragThresholds.GOOD_SCORE,` (garder `avgSimilarity` : utile en observabilité, plus jamais en décision).

(d) Remplacer le bloc gate l.89-126 par :

```typescript
        const gate = evaluateRagGate(ragResult);

        if (!gate.ok) {
          const isRagDisabled = gate.reason === 'rag_disabled';
          const errorReason = isRagDisabled
            ? 'Service RAG temporairement indisponible'
            : isFullDomaineMode
              ? 'Domaine non trouvé dans ton programme'
              : 'Thème non trouvé dans ton programme';

          logger.warn('RAG validation failed - cannot generate without official context', {
            operation: 'learning:generate:rag-validation-failed',
            userId: user.id, subject, domaine,
            topic: topic ?? null,
            mode: isFullDomaineMode ? 'full_domaine' : 'specific_topic',
            level,
            reason: gate.reason,
            chunksFound: ragResult.semanticChunks.length,
          });
          return status(gate.httpStatus, {
            error: errorReason,
            message: isRagDisabled
              ? 'Le service de programmes officiels est temporairement indisponible. Réessaie dans quelques minutes.'
              : `Je n'ai pas trouvé "${searchQuery}" dans le programme de ${subject} pour ton niveau. Cela peut arriver si le thème n'est pas au programme ou si l'orthographe est différente.`,
            suggestions: isRagDisabled
              ? ['Réessaie dans quelques minutes']
              : [
                  'Vérifie l\'orthographe du thème',
                  'Essaie avec des mots-clés plus simples',
                  'Choisis un chapitre de ton livre scolaire',
                ],
            code: isRagDisabled ? 'RAG_SERVICE_UNAVAILABLE' : 'TOPIC_NOT_IN_CURRICULUM',
            level, subject,
          });
        }
```

(e) Dans `apps/server/src/services/rag.service.ts`, supprimer le bloc `RAG_THRESHOLDS` (l.25-30) et la méthode `getThresholds()` (l.272-277) — plus aucun consommateur. Vérifier avec :

Run: `grep -rn "getThresholds\|RAG_THRESHOLDS\|GOOD_SCORE\|MIN_SCORE\|EXCELLENT_SCORE" apps/server/src --include="*.ts"`
Expected: aucune occurrence restante.

- [ ] **Step 6: Validation complète + commit**

Run: `cd apps/server && bun run typecheck && bun run lint && bun run test`
Expected: exit 0, tous tests PASS.

```bash
cd /home/ordiv/projets/tomai-monorepo
git add apps/server/src/routes/learning/helpers.ts apps/server/src/routes/learning/card-generate.routes.ts apps/server/src/services/rag.service.ts apps/server/src/tests/learning-rag-gate.test.ts
git commit -m "fix(server): unblock flashcard generation gated on RRF scores

The generation gate compared averageSimilarity (RRF rank scores ~0.02)
against the cosine-calibrated GOOD_SCORE (0.5), returning 400
TOPIC_NOT_IN_CURRICULUM for every request in the default hybrid mode.
The gate now only checks service availability and result presence
(evaluateRagGate helper, unit-tested with RRF-scale scores); the dead
cosine thresholds are removed."
```

---

### Task 5: Validation finale de branche + push + PR

**Files:** aucun nouveau.

- [ ] **Step 1: Suite complète y compris intégration**

Run: `cd apps/server && bun run typecheck && bun run lint && bun run test && bun run test:integration`
Expected: exit 0 partout. Si `api-endpoints.test.ts` échoue sur un import Drizzle : vérifier qu'aucun nouveau module tirant les schémas n'est entré dans la chaîne `app.ts` (aucun attendu dans ce lot — on n'a ajouté aucun import).

- [ ] **Step 2: Committer le plan**

```bash
cd /home/ordiv/projets/tomai-monorepo
git add docs/superpowers/plans/2026-07-01-lot1-rag-scoring-flashcards.md
git commit -m "docs(server): lot 1 implementation plan (RAG scoring P0)"
```

- [ ] **Step 3: Push + PR**

```bash
git push -u origin fix/rag-scoring-flashcards
gh pr create --base main --title "fix(server): RAG scoring coherence + unblock flashcard generation (audit lot 1)" --body "$(cat <<'EOF'
## Summary
Lot 1 of docs/audits/2026-07-01-curriculum-to-frontend-architecture.md (P0 n°1 + scoring findings):
- Flashcard generation was returning 400 TOPIC_NOT_IN_CURRICULUM for every request in default hybrid mode (RRF scores ~0.02 compared to cosine threshold 0.5) — gate now checks availability + result presence only (evaluateRagGate, unit-tested at RRF scale)
- LLM contexts no longer present RRF rank scores as similarity percentages (chat RAG + document analysis)
- Dead minSimilarity option removed (was a silent no-op for document-analysis)
- Fixed 16x prefetch double amplification (fused limit = topK, or rerank candidate pool)
- Dead cosine thresholds (MIN_SCORE/GOOD_SCORE/EXCELLENT_SCORE) removed

## Test plan
- [x] bun run typecheck && bun run lint && bun run test
- [x] bun run test:integration
- New: learning-rag-gate.test.ts (4 tests, regression at RRF scale), rag.service.test.ts (+4 tests: context format, fused limits)

Generated with Claude Code
EOF
)"
```

Expected: PR ouverte vers `main`, CI verte, review CodeRabbit automatique.

---

## Hors scope de ce lot (rappel)

- Propagation du score reranker (`rag.service.ts:155-159`) : le rerank est supprimé au Lot 3 (ai-service embed-only) — inutile de le corriger ici.
- `averageSimilarity` reste calculé (audit RGPD `retrieval_audit.avgScore` + logs) — sa suppression éventuelle se décidera au Lot 3.
- Retrieval forcé (`toolChoice`) : Lot 7.
