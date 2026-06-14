# Cost-Tracking Fix — Mesure correcte du coût IA (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendre le `cost_tracking` réellement exact — corriger la table de prix (noms ET valeurs faux), puis facturer les tokens cached au bon taux — pour que le dashboard coût cesse d'afficher 0 et reflète le vrai coût Mistral.

**Architecture :** Deux incréments committables séparément. **A** corrige la table de prix dans `cost-tracking.service.ts` (fix isolé, donne un coût correct en *majorant* car cacheHit=false). **B** propage `usage.prompt_tokens_details.cached_tokens` depuis la réponse Mistral jusqu'au calcul, pour un coût *exact* (cached facturé à 10 %). TDD : `computeCostCents` est exporté et testé en isolation.

**Tech Stack :** Bun test runner, TypeScript, Drizzle (mocké dans les tests), SDK `@mistralai/mistralai` 2.2.1 + POST HTTP direct pour `prompt_cache_key`.

---

## Contexte — findings vérifiés dans le code + doc (2026-06-14)

| Fait | Vérifié |
|---|---|
| Table de prix mal nommée : clés `mistral-medium-3`/`mistral-large-3` | `cost-tracking.service.ts:46-47` — `normalizeModelId` (startsWith) ne matche jamais `mistral-medium-latest` → `unknownModel=true` → `costCents=0` |
| Table de prix avec **valeurs fausses** | `mistral.ai/pricing` : medium = **$1.5/$7.5** (code dit 0.40/2.00), large = $0.5/$1.5 (code dit 2.00/6.00) |
| Modèle réellement tracké = `mistral-medium-latest` | `mistral-chat.service.ts:56` (`const MODEL`), propagé en `chunk.model` → `chat-orchestration.service.ts:294` (seul call site de `record`) |
| `cached_tokens` jamais lu | grep : `prompt_tokens_details` absent du code. Doc Mistral : `usage.prompt_tokens_details.cached_tokens`, billable = `prompt_tokens - cached_tokens`, cached à 10 % |
| Pas de test cost-tracking | `src/tests/` : aucun fichier cost-tracking |
| `CACHE_DISCOUNT = 0.10` | Correct — confirmé doc Mistral (cached billed at 10 % of standard rate) |

**Pricing officiel retenu** (USD/M tokens, source `mistral.ai/pricing`, juin 2026) :

```
mistral-medium   1.5 / 7.5
mistral-small    0.1 / 0.3
mistral-large    0.5 / 1.5
magistral-medium 2.0 / 5.0
magistral-small  0.5 / 1.5
ministral-3b     0.1 / 0.1
ministral-8b     0.15 / 0.15
```

**Hors scope (sortis du chantier, pilotés par mesure ensuite) :** optimisation `prompt_cache_key` (gain non vérifiable à l'aveugle — la doc dit que c'est un hint de routage, le cache matche sur le préfixe de tokens) ; durcissement `MISTRAL_MAX_TOKENS` (tous les call sites passent déjà un `maxTokens` explicite → défaut 16384 jamais atteint → préventif, pas un bug actif).

---

## File Structure

- `apps/server/src/services/cost-tracking.service.ts` — **Modify** : table de prix, export `computeCostCents`, commentaire (incr. A) ; `cachedTokens` dans le calcul + l'interface (incr. B).
- `apps/server/src/tests/cost-tracking.test.ts` — **Create** : tests unitaires de `computeCostCents`.
- `apps/server/src/lib/ai/mistral-client.ts` — **Modify (incr. B)** : lire `prompt_tokens_details.cached_tokens`, ajouter `cachedTokens` à `ChatStreamChunk['usage']`.
- `apps/server/src/services/chat/chat-streaming-types.ts` — **Modify (incr. B)** : ajouter `cachedTokens` à `ChatStreamChunk.usage`.
- `apps/server/src/services/chat/mistral-chat.service.ts` — **Modify (incr. B)** : propager `cachedTokens` dans `usageTotal` + chunk `done`.
- `apps/server/src/services/chat/chat-orchestration.service.ts` — **Modify (incr. B)** : passer `cachedTokens` à `costTrackingService.record`.

---

# Incrément A — Table de prix correcte (committable seul)

### Task A1 : Exporter `computeCostCents` + écrire le test rouge

**Files:**
- Modify: `apps/server/src/services/cost-tracking.service.ts:64`
- Test: `apps/server/src/tests/cost-tracking.test.ts` (create)

- [ ] **Step 1 : Exporter la fonction de calcul**

Dans `cost-tracking.service.ts`, préfixer `function computeCostCents` par `export` (ligne 64) :

```typescript
export function computeCostCents(
```

- [ ] **Step 2 : Écrire le test qui échoue**

Créer `apps/server/src/tests/cost-tracking.test.ts` :

```typescript
import { describe, expect, it } from 'bun:test';
import { computeCostCents } from '../services/cost-tracking.service.js';

// USD_TO_EUR par défaut = 0.92 (env.USD_TO_EUR_RATE). Les attendus sont calculés
// avec ce taux. Pricing source : mistral.ai/pricing (juin 2026).
describe('computeCostCents', () => {
  it('facture mistral-medium-latest au tarif réel (pas unknownModel)', () => {
    // 1M input + 1M output : (1.5 + 7.5) USD * 0.92 = 8.28 EUR = 828 cents
    const r = computeCostCents('mistral-medium-latest', 1_000_000, 1_000_000, false);
    expect(r.unknownModel).toBe(false);
    expect(r.costCents).toBe(828);
  });

  it('matche les IDs versionnés via préfixe (mistral-medium-2508)', () => {
    const r = computeCostCents('mistral-medium-2508', 1_000_000, 0, false);
    expect(r.unknownModel).toBe(false);
    // 1.5 USD * 0.92 = 1.38 EUR = 138 cents
    expect(r.costCents).toBe(138);
  });

  it('distingue ministral-3b et ministral-8b', () => {
    const r3 = computeCostCents('ministral-3b-latest', 1_000_000, 1_000_000, false);
    const r8 = computeCostCents('ministral-8b-latest', 1_000_000, 1_000_000, false);
    // 3b: (0.1+0.1)*0.92 = 0.184 EUR = 18 cents ; 8b: (0.15+0.15)*0.92 = 0.276 = 28 cents
    expect(r3.costCents).toBe(18);
    expect(r8.costCents).toBe(28);
  });

  it('signale unknownModel sur un modèle non mappé', () => {
    const r = computeCostCents('gpt-4o', 1000, 1000, false);
    expect(r.unknownModel).toBe(true);
    expect(r.costCents).toBe(0);
  });
});
```

- [ ] **Step 3 : Lancer le test, vérifier l'échec**

Run: `cd apps/server && bun test src/tests/cost-tracking.test.ts`
Expected: FAIL — `mistral-medium-latest` renvoie `unknownModel: true` (clés actuelles `mistral-medium-3`), assertions cents fausses.

### Task A2 : Corriger la table de prix + le commentaire

**Files:**
- Modify: `apps/server/src/services/cost-tracking.service.ts:39-48` et `:1-19`

- [ ] **Step 1 : Remplacer la table de prix**

Remplacer le bloc `MODEL_PRICING_USD_PER_MILLION` (lignes 45-48) par :

```typescript
const MODEL_PRICING_USD_PER_MILLION: Record<string, { input: number; output: number }> = {
  // Clés = préfixes ; normalizeModelId matche via startsWith, donc `mistral-medium`
  // couvre `mistral-medium-latest` ET `mistral-medium-2508`.
  'mistral-medium': { input: 1.5, output: 7.5 },
  'mistral-small': { input: 0.1, output: 0.3 },
  'mistral-large': { input: 0.5, output: 1.5 },
  'magistral-medium': { input: 2.0, output: 5.0 },
  'magistral-small': { input: 0.5, output: 1.5 },
  'ministral-3b': { input: 0.1, output: 0.1 },
  'ministral-8b': { input: 0.15, output: 0.15 },
};
```

- [ ] **Step 2 : Corriger le commentaire d'en-tête et celui de la table**

Remplacer la mention `Gemini streaming response` (lignes 12-14) et la date du commentaire table (lignes 39-44). Header (lignes 10-18) → reformuler sans « Gemini » :

```typescript
 * Pricing is expressed in USD per million tokens, as published at
 * mistral.ai/pricing (juin 2026). We convert to cents at insert time using a
 * fixed USD/EUR rate (configurable via env). Cached input is billed at 10% of
 * the standard input rate (Mistral prompt caching).
 *
 * Unknown models: we insert a row with cost_cents=0 and a
 * billingMetadata.unknownModel flag rather than silently dropping the call.
 * Monitoring can alert on these.
```

Et le commentaire de la table (lignes 39-44) :

```typescript
/**
 * Published pricing in USD per million tokens (input / output), source
 * mistral.ai/pricing (juin 2026). Keys are prefixes (see normalizeModelId).
 * Cached input is charged at 10% of standard input (CACHE_DISCOUNT).
 */
```

- [ ] **Step 3 : Lancer le test, vérifier le succès**

Run: `cd apps/server && bun test src/tests/cost-tracking.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 4 : Validation + commit**

Run: `cd apps/server && bun run typecheck && bun run lint && bun test src/tests/cost-tracking.test.ts`
Expected: 0 erreur, tests verts.

```bash
git add apps/server/src/services/cost-tracking.service.ts apps/server/src/tests/cost-tracking.test.ts
git commit -m "fix(server): correct cost-tracking model pricing table (real Mistral rates)"
```

---

# Incrément B — Coût exact via cached_tokens

> **Vérif runtime faite (2026-06-14, via la vraie route `POST /api/chat/stream`)** :
> l'`usage` est bien renvoyé (`promptTokens:2536, completionTokens:457`) ; le champ cached réel est
> **`prompt_tokens_details.cached_tokens`** (confirmé sur appel réel — PAS `num_cached_tokens`) ;
> `cost_tracking` insère désormais `cost_cents=1, unknownModel=false` (fix A prouvé end-to-end).
> Conséquences pour B : (a) lire `prompt_tokens_details.cached_tokens` ; (b) **retirer** la sonde
> temporaire `usage-probe` (info) de `mistral-client.ts` ; (c) **conserver** le garde `usage-missing`
> (warn) comme protection permanente contre le retour silencieux à 0.

### Task B1 : Étendre les types `usage` avec `cachedTokens`

**Files:**
- Modify: `apps/server/src/lib/ai/mistral-client.ts:124`
- Modify: `apps/server/src/services/chat/chat-streaming-types.ts:70-74`

- [ ] **Step 1 : `mistral-client.ts` — champ optionnel sur `ChatStreamChunk['usage']`**

Ligne 124, remplacer :

```typescript
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
```

par :

```typescript
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number; cachedTokens: number };
```

- [ ] **Step 2 : `chat-streaming-types.ts` — même champ**

Lignes 70-74, ajouter `cachedTokens` :

```typescript
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    cachedTokens: number;
  };
```

### Task B2 : Lire `cached_tokens` dans `mistral-client.ts` (path POST stream du chat)

**Files:**
- Modify: `apps/server/src/lib/ai/mistral-client.ts:427-433` et `:331-339`

- [ ] **Step 1 : POST stream path (utilisé par le chat car promptCacheKey présent)**

Lignes 427-433, étendre la lecture `usage` :

```typescript
        const u = event.usage as { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number; prompt_tokens_details?: { cached_tokens?: number } } | null | undefined;
        if (u) {
          usage = {
            promptTokens: u.prompt_tokens ?? 0,
            completionTokens: u.completion_tokens ?? 0,
            totalTokens: u.total_tokens ?? ((u.prompt_tokens ?? 0) + (u.completion_tokens ?? 0)),
            cachedTokens: u.prompt_tokens_details?.cached_tokens ?? 0,
          };
        }
```

- [ ] **Step 2 : SDK stream path (cohérence du type, même si le chat ne l'emprunte pas)**

Lignes 333-339, ajouter `cachedTokens` (le SDK 2.2.1 peut ne pas exposer le détail → fallback 0, lu défensivement) :

```typescript
      if (u) {
        usage = {
          promptTokens: u.promptTokens ?? 0,
          completionTokens: u.completionTokens ?? 0,
          totalTokens: u.totalTokens ?? ((u.promptTokens ?? 0) + (u.completionTokens ?? 0)),
          cachedTokens: (u as { promptTokensDetails?: { cachedTokens?: number } }).promptTokensDetails?.cachedTokens ?? 0,
        };
      }
```

- [ ] **Step 3 : Typecheck**

Run: `cd apps/server && bun run typecheck`
Expected: PASS (les deux `usage` satisfont le type étendu).

### Task B3 : Propager `cachedTokens` dans `mistral-chat.service.ts`

**Files:**
- Modify: `apps/server/src/services/chat/mistral-chat.service.ts:178`, `:241-246`, et chaque `done` chunk émettant `usage`

- [ ] **Step 1 : Initialiser l'accumulateur avec `cachedTokens`**

Ligne 178, remplacer :

```typescript
      const usageTotal = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
```

par :

```typescript
      const usageTotal = { promptTokens: 0, completionTokens: 0, totalTokens: 0, cachedTokens: 0 };
```

- [ ] **Step 2 : Accumuler `cachedTokens`**

Lignes 244-246, ajouter sous les trois accumulations existantes :

```typescript
              usageTotal.cachedTokens += chunk.usage.cachedTokens;
```

- [ ] **Step 3 : Vérifier que les chunks `done` émettant `usage: usageTotal` compilent**

Les sites qui yield `usage: usageTotal` (lignes ~185, 286, 354, 418) héritent automatiquement du champ. Aucun changement supplémentaire si l'objet émis est `usageTotal`.

Run: `cd apps/server && bun run typecheck`
Expected: PASS.

### Task B4 : Calcul cached + interface `record` + orchestration → test

**Files:**
- Modify: `apps/server/src/services/cost-tracking.service.ts:28-37`, `:64-83`, `:86-92`
- Modify: `apps/server/src/services/chat/chat-orchestration.service.ts:291-298`
- Test: `apps/server/src/tests/cost-tracking.test.ts`

- [ ] **Step 1 : Écrire le test rouge du split cached**

Ajouter dans `cost-tracking.test.ts` :

```typescript
describe('computeCostCents — cached tokens', () => {
  it('facture les tokens cached à 10% du tarif input', () => {
    // 1M prompt dont 800k cached, 0 output, mistral-medium (input 1.5)
    // uncached 200k @1.5 + cached 800k @0.15 = 0.3 + 0.12 = 0.42 USD * 0.92 = 0.3864 EUR = 39 cents
    const r = computeCostCents('mistral-medium-latest', 1_000_000, 0, 800_000);
    expect(r.costCents).toBe(39);
  });

  it('0 cached = plein tarif (majorant)', () => {
    const r = computeCostCents('mistral-medium-latest', 1_000_000, 0, 0);
    expect(r.costCents).toBe(138); // 1.5 * 0.92 * 100
  });
});
```

- [ ] **Step 2 : Changer la signature `computeCostCents` (4e param = `cachedTokens: number`)**

Remplacer la signature et le corps (lignes 64-83) :

```typescript
export function computeCostCents(
  aiModel: string,
  tokensInput: number,
  tokensOutput: number,
  cachedTokens: number,
): { costCents: number; unknownModel: boolean } {
  const key = normalizeModelId(aiModel);
  const pricing = MODEL_PRICING_USD_PER_MILLION[key];
  if (!pricing) {
    return { costCents: 0, unknownModel: true };
  }

  const cached = Math.min(Math.max(cachedTokens, 0), tokensInput);
  const uncachedInput = tokensInput - cached;
  const inputUsd =
    (uncachedInput / 1_000_000) * pricing.input +
    (cached / 1_000_000) * pricing.input * CACHE_DISCOUNT;
  const outputUsd = (tokensOutput / 1_000_000) * pricing.output;
  const totalEur = (inputUsd + outputUsd) * USD_TO_EUR;

  return { costCents: Math.round(totalEur * 100), unknownModel: false };
}
```

- [ ] **Step 3 : Mettre à jour les tests A pour la nouvelle signature**

Dans les tests de Task A1, remplacer le 4e argument `false` par `0` (cachedTokens). Ex : `computeCostCents('mistral-medium-latest', 1_000_000, 1_000_000, 0)`.

- [ ] **Step 4 : Adapter `CostRecordInput` + `record()`**

`cost-tracking.service.ts` lignes 28-37, remplacer `cacheHit?: boolean` par :

```typescript
  /** Cached prompt tokens (usage.prompt_tokens_details.cached_tokens), billed at 10%. */
  cachedTokens?: number;
```

Lignes 86-92, remplacer l'appel :

```typescript
    const { costCents, unknownModel } = computeCostCents(
      input.aiModel,
      input.tokensInput,
      input.tokensOutput,
      input.cachedTokens ?? 0,
    );
```

Et dans `billingMetadata` (lignes 113-117), remplacer `cacheHit: input.cacheHit ?? false` par `cachedTokens: input.cachedTokens ?? 0`.

- [ ] **Step 5 : Orchestration passe `cachedTokens`**

`chat-orchestration.service.ts` lignes 291-298, ajouter le champ :

```typescript
        await costTrackingService.record({
          userId,
          sessionId,
          aiModel: chunk.model,
          operation: 'chat',
          tokensInput: chunk.usage.promptTokens,
          tokensOutput: chunk.usage.completionTokens,
          cachedTokens: chunk.usage.cachedTokens,
        });
```

- [ ] **Step 6 : Lancer les tests, vérifier le succès**

Run: `cd apps/server && bun test src/tests/cost-tracking.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 7 : Validation complète + commit**

Run: `cd apps/server && bun run typecheck && bun run lint && bun run test`
Expected: 0 erreur, suite complète verte (les 406 tests existants + cost-tracking).

```bash
git add apps/server/src/services/cost-tracking.service.ts apps/server/src/tests/cost-tracking.test.ts apps/server/src/lib/ai/mistral-client.ts apps/server/src/services/chat/chat-streaming-types.ts apps/server/src/services/chat/mistral-chat.service.ts apps/server/src/services/chat/chat-orchestration.service.ts
git commit -m "feat(server): bill cached prompt tokens at 10% for exact AI cost tracking"
```

---

## Self-Review

- **Spec coverage** : table de prix (A2), matching robuste (A2 + test A1), cached_tokens propagés (B1-B4), coût exact (B4). Cache `prompt_cache_key` et `maxTokens` explicitement hors scope avec justification. ✓
- **Placeholder scan** : aucun TODO/TBD ; tout le code est fourni. ✓
- **Type consistency** : `cachedTokens` ajouté de façon cohérente — `ChatStreamChunk['usage']` (client + chat-streaming-types), `usageTotal`, `CostRecordInput.cachedTokens`, 4e param `computeCostCents`. La signature passe de `cacheHit: boolean` à `cachedTokens: number` partout (Task B4 met à jour les tests A en conséquence). ✓
- **Vérification finale** : `bun run test` complet (pas seulement le fichier cost-tracking) en B4-Step7, pour prouver l'absence de régression sur les 406 tests existants. ✓

## Hors-scope acté (chantiers ultérieurs, pilotés par la mesure)

1. **Optimisation `prompt_cache_key`** — une fois ce tracking en place, mesurer le `cached_tokens` réel par session ; décider alors si scoper la clé par conversation (reco doc Mistral) ou par matière améliore le hit-rate. Décision *sur données*, pas à l'aveugle.
2. **Durcissement `MISTRAL_MAX_TOKENS`** — rendre `maxTokens` obligatoire (supprimer le défaut 16384) après audit confirmant qu'aucun call site ne compte dessus.
3. **Étendre le tracking aux autres opérations** — aujourd'hui seul le chat appelle `record()` ; titre/classif/résumé/cartes/OCR ne sont pas trackés.
