# Lot 0, PR C — Bascule sur Mistral Small 4

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Index du lot, contraintes globales, ordre des PR et étapes manuelles :** `docs/superpowers/plans/2026-09-22-lot-0-assainissement.md` — à lire avant ce plan.

**Specs :** `docs/superpowers/specs/2026-09-22-cible-v1.md`, `docs/superpowers/specs/2026-09-22-agent-ia.md`.

---

## PR C — Bascule sur Mistral Small 4, bien configuré

**Branche** : `feat/mistral-small-4`

**Objectif** : tous les rôles texte et vision passent sur `mistral-small-2603` (IDs datés uniquement) via l'endpoint UE `api.eu.mistral.ai`, avec `promptCacheKey` natif par session de chat, `reasoningEffort` réellement envoyé, le raisonnement qui ne part plus vers le client et un coût calculé au tarif Small 4 majoré pour l'UE.

**Prérequis** : PR A et PR B mergées (`ai@7.0.109`, `@ai-sdk/mistral@4.0.48`, `@mistralai/mistralai@2.7.0` au moment d'écrire). Toutes les références `.d.ts`/`dist` ci-dessous pointent vers ces versions, qui se trouvent après la PR B sous `apps/server/node_modules/<paquet>/`.

**Fichiers touchés**

- Modify : `apps/server/src/config/env.ts`, `apps/server/.env.example`, `apps/server/src/app.ts`, `apps/server/src/lib/ai/provider.ts`, `apps/server/src/lib/ai/mistral-client.ts`, `apps/server/src/services/chat/ai-chat.service.ts`, `apps/server/src/routes/chat-message.routes.ts`, `apps/server/src/services/chat/intent-classifier.service.ts`, `apps/server/src/services/chat/auto-title.service.ts`, `apps/server/src/services/chat/summarization.service.ts`, `apps/server/src/services/learning/card-generator.service.ts`, `apps/server/src/services/episodic-memory.service.ts`, `apps/server/src/services/document/mistral-vision.ts`, `apps/server/src/services/document/document-analysis.service.ts`, `apps/server/src/services/chat/token-budget.service.ts`, `apps/server/src/services/mistral-embeddings.service.ts`, `apps/server/src/services/voxtral-transcribe.service.ts`, `apps/server/src/services/voxtral-tts.service.ts`, `apps/server/src/services/cost-tracking.service.ts`, `scripts/doctor-checks.mjs`, `.claude/skills/mistral-stack/SKILL.md`, `apps/server/README.md`
- Modify (tests) : `apps/server/src/tests/ai-provider.test.ts`, `mistral-client.test.ts`, `ai-chat-service.test.ts`, `chat-stream-route.test.ts`, `cost-tracking.test.ts`, `voxtral-transcribe.service.test.ts`, `intent-classifier-subject.test.ts`, `auth-config.test.ts`, `apps/server/src/integration-tests/api-endpoints.test.ts`, `scripts/doctor-checks.test.mjs`
- Create (tests) : `apps/server/src/tests/env-mistral.test.ts`, `apps/server/src/tests/mistral-embeddings.service.test.ts`, `apps/server/src/tests/voxtral-tts.service.test.ts`, `apps/server/src/live/mistral-eu.test.ts`

**Faits vérifiés dans les sources** (cités dans les tâches) :

| Fait | Source |
|---|---|
| `mistral-small-2603` est dans la liste qui envoie `reasoning_effort` | `@ai-sdk/mistral/dist/index.js:386-404` (Set `reasoningEffortModelIds`), `:454-467`, `:496` |
| `reasoningEffort` n'accepte que `'high' \| 'none'` | `@ai-sdk/mistral/dist/index.d.ts:15-18` |
| `promptCacheKey` natif → `prompt_cache_key` | `dist/index.d.ts:14`, `dist/index.js:510` |
| `createMistral({ baseURL, fetch })`, défaut `https://api.mistral.ai/v1` | `dist/index.d.ts:95-116`, `dist/index.js:1338` |
| Aucun envoi de `stream_options` (0 occurrence) ; l'usage est lu s'il arrive dans un chunk | `grep -c stream_options dist/index.js` = 0 ; `dist/index.js:647-648`, `:722` |
| `cacheRead` lu depuis `prompt_tokens_details.cached_tokens` | `dist/index.js:52-72` |
| IDs datés connus du SDK : `mistral-embed-2312`, `voxtral-mini-2602` (STT), `voxtral-mini-tts-2603` (TTS) | `dist/index.d.ts:22`, `:36`, `:42` |
| `@mistralai/mistralai` : options `server: 'eu'` ou `serverURL` (racine de l'hôte, les chemins portent `/v1`) | `esm/lib/config.d.ts:7-35` ; `esm/funcs/embeddingsCreate.js:31` (`/v1/embeddings`) |
| `LanguageModelUsage.inputTokenDetails.cacheReadTokens` ; `StreamTextResult.reasoningText` / `totalUsage` | `ai/dist/index.d.ts:328-337`, `:2675`, `:2751` |
| `toUIMessageStream` envoie le raisonnement par défaut (`sendReasoning` défaut `true`) | `ai/dist/index.d.ts:2611-2614`, `ai/dist/index.js:8179` |
| L'option `telemetry` de `streamText` n'a d'effet qu'avec une intégration enregistrée ; aucune ne l'est dans le serveur | `ai/dist/index.d.ts:944-983` ; `grep -rn "registerTelemetry\|@ai-sdk/otel" apps/server/src` vide |
| Endpoint UE : +10 % sur input, output, lectures et écritures de cache ; Agents/Batch/Files absents ; modèles disponibles à vérifier par `models.list` sur l'URL régionale | https://docs.mistral.ai/inference/regional-inference |
| Tokens cachés facturés 10 % du prix d'entrée, blocs de 64 tokens, clé recommandée = ID de conversation/session | https://docs.mistral.ai/studio/conversations/advanced/prompt-caching |
| Small 4 : 0,15 $ / 0,60 $ par M tokens, 256k | https://docs.mistral.ai/models/mistral-small-4-0-26-03 |
| « `stream_options.include_usage` must be explicitly set to receive token usage in stream events » — mais le paramètre n'apparaît pas dans la référence de `POST /v1/chat/completions` | https://docs.mistral.ai/resources/known-limitations ; https://docs.mistral.ai/api/endpoint/chat |
| `safe_prompt` déprécié au profit des Custom Guardrails | https://docs.mistral.ai/resources/deprecated/guardrailing/safe_prompt |
| ZDR couvre `/v1/chat/completions`, `/v1/embeddings`, `/v1/audio/speech`, `/v1/audio/transcriptions` ; activation sur demande au support | https://docs.mistral.ai/admin/monitor-comply/zero-data-retention |

**Écart assumé avec la demande** : une seule variable `MISTRAL_SERVER_URL` (racine de l'hôte, défaut `https://api.eu.mistral.ai`) au lieu de `MISTRAL_BASE_URL=…/v1`. Le client `@mistralai/mistralai` attend la racine (ses chemins incluent `/v1`), l'AI SDK attend `…/v1` : une variable à la racine, `/v1` ajouté côté AI SDK et Voxtral, évite deux variables qui peuvent diverger.

---

### Tâche C.1 — Sonde live de l'endpoint UE (manuelle, lancée par l'utilisateur)

Porte bloquante : ses résultats fixent D1-D4 avant tout code. L'agent d'exécution ne lit pas `apps/server/.env` ; c'est l'utilisateur qui lance ces commandes et colle la sortie dans la description de la PR.

**Files:** aucun.

**Interfaces:** Produces les décisions D1 (modèles servis en UE), D2 (usage en streaming), D3 (ID daté des embeddings), D4 (raisonnement + cache sur Small 4 en UE).

- [ ] Vérifier que `apps/server/.env` ne surcharge aucun modèle (les tests unitaires chargent ce fichier) : `grep -E '^MISTRAL_(MODEL|EMBED|STT|TTS|SERVER)' apps/server/.env` doit ne rien afficher. Sinon, supprimer ces lignes.
- [ ] Lister les modèles servis par l'endpoint UE :

```bash
set -a; . apps/server/.env; set +a
EU=https://api.eu.mistral.ai/v1
curl -sS "$EU/models" -H "Authorization: Bearer $MISTRAL_API_KEY" | jq -r '.data[].id' | sort -u > /tmp/eu-models.txt
grep -xE 'mistral-small-2603|mistral-embed|mistral-embed-2312|voxtral-mini-2602|voxtral-mini-tts-2603|mistral-moderation-2603|mistral-medium-2604' /tmp/eu-models.txt
```

Attendu : les 7 IDs. **D1** = liste obtenue. **D3** = `mistral-embed-2312` s'il est listé, sinon `mistral-embed` (pas d'alias `-latest` dans ce nom, il reste accepté par la validation de C.2).

- [ ] Usage en streaming sans puis avec `stream_options` :

```bash
body='{"model":"mistral-small-2603","reasoning_effort":"none","max_tokens":5,"stream":true,"messages":[{"role":"user","content":"Dis bonjour."}]}'
curl -sS -N "$EU/chat/completions" -H "Authorization: Bearer $MISTRAL_API_KEY" -H 'Content-Type: application/json' -d "$body" | grep -c '"usage"'
body2='{"model":"mistral-small-2603","reasoning_effort":"none","max_tokens":5,"stream":true,"stream_options":{"include_usage":true},"messages":[{"role":"user","content":"Dis bonjour."}]}'
curl -sS -N -w '\nHTTP %{http_code}\n' "$EU/chat/completions" -H "Authorization: Bearer $MISTRAL_API_KEY" -H 'Content-Type: application/json' -d "$body2" | grep -E '"usage"|HTTP'
```

**D2** : premier `grep -c` ≥ 1 → l'usage arrive sans rien faire, l'étape conditionnelle de C.3 est sautée. Premier = 0 et second en HTTP 200 avec `"usage"` → l'étape conditionnelle de C.3 s'applique. Premier = 0 et second en erreur → arrêt de la PR : l'usage streamé est inaccessible, quota et coût du chat tomberaient à zéro (`chat-orchestration.service.ts:310` ne compte que si `tokensUsed > 0`) ; remonter à l'utilisateur.

- [ ] Raisonnement et cache sur Small 4 en UE (**D4**) :

```bash
sys=$(printf 'Tu es un tuteur de mathématiques pour collégiens. %.0s' {1..40})
req() { jq -n --arg s "$sys" --arg e "$1" '{model:"mistral-small-2603",reasoning_effort:$e,prompt_cache_key:"probe-session-1",max_tokens:400,messages:[{role:"system",content:$s},{role:"user",content:"Résous 2x + 3 = 11."}]}'; }
curl -sS "$EU/chat/completions" -H "Authorization: Bearer $MISTRAL_API_KEY" -H 'Content-Type: application/json' -d "$(req high)" | jq '{thinking: [.choices[0].message.content[]? | select(.type=="thinking")] | length, usage}'
curl -sS "$EU/chat/completions" -H "Authorization: Bearer $MISTRAL_API_KEY" -H 'Content-Type: application/json' -d "$(req high)" | jq '.usage.prompt_tokens_details'
```

Attendu : `thinking` ≥ 1 au premier appel ; `cached_tokens` > 0 (multiple de 64) au second.

- [ ] Voxtral en UE (complète D1) :

```bash
curl -sS -o /tmp/eu-tts.json -w 'HTTP %{http_code}\n' "$EU/audio/speech" -H "Authorization: Bearer $MISTRAL_API_KEY" -H 'Content-Type: application/json' \
  -d '{"model":"voxtral-mini-tts-2603","input":"Bonjour","voice":"casual_male","language":"French","response_format":"mp3"}'
```

Attendu : HTTP 200. Si les modèles Voxtral manquent de la liste ou si l'appel échoue, appliquer la variante « audio hors UE » de C.5.

- [ ] Procédure manuelle hors code (compte Mistral, accès humain requis) : demander le Zero Data Retention au support Mistral (article « ZDR » du Help Center), puis vérifier son activation dans Admin Panel › API › Privacy. Source : https://docs.mistral.ai/admin/monitor-comply/zero-data-retention.

---

### Tâche C.2 — Un seul modèle daté, endpoint configurable, alias `-latest` refusés au boot

**Files:**
- Modify : `apps/server/src/config/env.ts:71-81`
- Modify : `apps/server/src/services/chat/intent-classifier.service.ts:4,22,118`, `auto-title.service.ts:6-7,14,62`, `summarization.service.ts:9-11,19,217`, `apps/server/src/services/learning/card-generator.service.ts:42,44-45,232`, `apps/server/src/app.ts:161`
- Modify (commentaires périmés) : `apps/server/src/services/episodic-memory.service.ts:119`, `services/document/mistral-vision.ts:5`, `services/document/document-analysis.service.ts:5-8`, `services/chat/token-budget.service.ts:14`
- Modify (mocks) : `apps/server/src/tests/intent-classifier-subject.test.ts:21`, `apps/server/src/tests/auth-config.test.ts:40-46`
- Create : `apps/server/src/tests/env-mistral.test.ts`

**Interfaces:**
- Produces : `env.MISTRAL_SERVER_URL: string` (défaut `https://api.eu.mistral.ai`), `env.MISTRAL_MODEL` (défaut `mistral-small-2603`), `env.MISTRAL_EMBED_MODEL` (défaut D3), `env.MISTRAL_STT_MODEL` (`voxtral-mini-2602`), `env.MISTRAL_TTS_MODEL` (`voxtral-mini-tts-2603`).
- Supprime : `MISTRAL_MODEL_CLASSIFY`, `MISTRAL_MODEL_TITLE`, `MISTRAL_MODEL_LIGHT`. Consommateurs (grep `git grep -n "MISTRAL_MODEL_" apps scripts`) : `intent-classifier.service.ts:118`, `auto-title.service.ts:62`, `summarization.service.ts:217`, `card-generator.service.ts:232`, `app.ts:161`, `tests/intent-classifier-subject.test.ts:21`.
- Zod 4 : paramètre `error` de `refine` (`node_modules/zod/v4/core/api.d.ts:8`) ; Bun `--no-env-file` (`bun --help`, Bun 1.3.14).

- [ ] Écrire le test qui échoue, `apps/server/src/tests/env-mistral.test.ts` :

```ts
import { describe, expect, it } from 'bun:test';
import { tmpdir } from 'node:os';

const ENV_MODULE = new URL('../config/env.ts', import.meta.url).pathname;

function bootEnv(extra: Record<string, string>) {
  return Bun.spawnSync(['bun', '--no-env-file', '-e', `await import(${JSON.stringify(ENV_MODULE)})`], {
    cwd: tmpdir(),
    env: {
      PATH: process.env['PATH'] ?? '',
      DATABASE_URL: 'postgresql://test:test@localhost/test',
      BETTER_AUTH_SECRET: 'x'.repeat(32),
      ...extra,
    },
    stderr: 'pipe',
  });
}

describe('env — Mistral model ids', () => {
  it('boots with the dated defaults', () => {
    expect(bootEnv({}).exitCode).toBe(0);
  });

  it('refuses a -latest alias for the text model', () => {
    const result = bootEnv({ MISTRAL_MODEL: 'mistral-small-latest' });
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr.toString()).toContain('MISTRAL_MODEL');
  });

  it('refuses a -latest alias for the speech model', () => {
    const result = bootEnv({ MISTRAL_TTS_MODEL: 'voxtral-mini-tts-latest' });
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr.toString()).toContain('MISTRAL_TTS_MODEL');
  });

  it('refuses a server URL that is not a URL', () => {
    const result = bootEnv({ MISTRAL_SERVER_URL: 'api.eu.mistral.ai' });
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr.toString()).toContain('MISTRAL_SERVER_URL');
  });
});
```

- [ ] Voir échouer : `cd apps/server && bun test src/tests/env-mistral.test.ts`. Attendu : le premier test passe, les trois autres échouent (`exitCode` 0, alias et URL acceptés).
- [ ] Implémenter dans `env.ts`. Avant `const EnvSchema` (ligne 31) :

```ts
const pinnedModelId = z.string().refine((id) => !id.endsWith('-latest'), {
  error: 'alias -latest interdit : épingler un ID daté (https://docs.mistral.ai/inference/model-lifecycle)',
});
```

Remplacer les lignes 71-81 par :

```ts
  // AI — Mistral. Endpoint UE : inférence garantie en Europe, +10 %
  // (https://docs.mistral.ai/inference/regional-inference).
  MISTRAL_API_KEY: z.string().optional(),
  MISTRAL_SERVER_URL: z.url().default('https://api.eu.mistral.ai'),
  MISTRAL_MODEL: pinnedModelId.default('mistral-small-2603'),
  MISTRAL_EMBED_MODEL: pinnedModelId.default('mistral-embed-2312'),
  MISTRAL_STT_MODEL: pinnedModelId.default('voxtral-mini-2602'),
  MISTRAL_TTS_MODEL: pinnedModelId.default('voxtral-mini-tts-2603'),
```

(`mistral-embed-2312` remplacé par `mistral-embed` si D3 l'impose.)

- [ ] Consommateurs : supprimer la ligne `model: env.MISTRAL_MODEL_CLASSIFY,` (`intent-classifier.service.ts:118`), `model: env.MISTRAL_MODEL_TITLE,` (`auto-title.service.ts:62`), `model: env.MISTRAL_MODEL_LIGHT,` (`summarization.service.ts:217`, `card-generator.service.ts:232`), `model: env.MISTRAL_MODEL_TITLE, // cheapest model for health-check` (`app.ts:161`) : `generateText`/`generateStructured` retombent sur `env.MISTRAL_MODEL` (`mistral-client.ts:108,154`). Dans les quatre services, `env` n'a plus d'usage : supprimer `import { env } from '../../config/env.js';` (`intent-classifier.service.ts:22`, `auto-title.service.ts:14`, `summarization.service.ts:19`, `card-generator.service.ts:42`).
- [ ] Commentaires devenus faux, remplacés mot pour mot :
  - `intent-classifier.service.ts:4` : ` * Runs a lightweight Mistral pass (80 output tokens max) BEFORE`
  - `auto-title.service.ts:6-7` → ` * Output ~15 tokens, latence minimale.`
  - `summarization.service.ts:9-11` → ` * Tâche templatée, modèle de chat par défaut.`
  - `card-generator.service.ts:44-45` : supprimées (la ligne 46 « Prompt cache… » reste).
  - `episodic-memory.service.ts:119` → `      // Extraction structurée FR.` (les lignes 120-121 restent).
  - `mistral-vision.ts:5-6` → ` * Uses the multimodal chat model (Mistral Small 4) to extract text` / ` * content and describe structural elements.`
  - `document-analysis.service.ts:5-8` → ` *              single completion (prompt-cached system instruction).` puis ` * Image path : multimodal chat model, photo encodée base64 → \`image_url\` part inline.`
  - `token-budget.service.ts:14` → ` * Mistral Small 4 has a 256k context window. We conservatively`
- [ ] Mocks : `intent-classifier-subject.test.ts:21` → `env: { MISTRAL_MODEL: 'mistral-small-2603' },` ; `auth-config.test.ts:40-46` → remplacer `MISTRAL_MODEL: 'mistral-medium-latest',` par `MISTRAL_MODEL: 'mistral-small-2603',`, `MISTRAL_TTS_MODEL: 'voxtral-tts-latest',` par `MISTRAL_TTS_MODEL: 'voxtral-mini-tts-2603',`, supprimer `MISTRAL_REASONING_MODEL: 'magistral-medium-latest',`.
- [ ] Voir passer : `cd apps/server && bun test src/tests/env-mistral.test.ts && bun run typecheck && bun run test`. Attendu : 4 pass, typecheck exit 0, suite verte.
- [ ] Commit :

```bash
git add apps/server/src/config/env.ts
git add apps/server/src/tests/env-mistral.test.ts
git add apps/server/src/services/chat/intent-classifier.service.ts
git add apps/server/src/services/chat/auto-title.service.ts
git add apps/server/src/services/chat/summarization.service.ts
git add apps/server/src/services/learning/card-generator.service.ts
git add apps/server/src/services/episodic-memory.service.ts
git add apps/server/src/services/document/mistral-vision.ts
git add apps/server/src/services/document/document-analysis.service.ts
git add apps/server/src/services/chat/token-budget.service.ts
git add apps/server/src/app.ts
git add apps/server/src/tests/intent-classifier-subject.test.ts
git add apps/server/src/tests/auth-config.test.ts
git commit -m "feat(server): pin every Mistral text and vision role to mistral-small-2603

One dated model for chat, vision, summaries, cards, titles and intent
classification; -latest aliases are rejected at boot. Sources:
https://docs.mistral.ai/models/mistral-small-4-0-26-03,
https://docs.mistral.ai/inference/model-lifecycle

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Tâche C.3 — Provider sur l'endpoint UE, `promptCacheKey` natif, raisonnement coupé hors chat

**Files:**
- Modify : `apps/server/src/lib/ai/provider.ts:1-18` (réécriture)
- Modify : `apps/server/src/lib/ai/mistral-client.ts:10-13,22-25,120,124,131,167,171,180`
- Modify : `apps/server/src/services/document/mistral-vision.ts:54`
- Modify : `apps/server/src/tests/ai-provider.test.ts` (réécriture), `apps/server/src/tests/mistral-client.test.ts:11-30,46-58`

**Interfaces:**
- Consumes : `createMistral(options?: MistralProviderSettings): MistralProvider`, `MistralLanguageModelChatOptions` (`@ai-sdk/mistral/dist/index.d.ts:7-20,95-120,128`).
- Produces : `mistralProvider(fetch?: FetchLike): MistralProvider` — l'argument `promptCacheKey` disparaît ; la clé passe par `providerOptions.mistral.promptCacheKey`. Appelants : `mistral-client.ts:124,171`, `ai-chat.service.ts:266` (C.4).

- [ ] Réécrire le test, `apps/server/src/tests/ai-provider.test.ts` :

```ts
import { describe, expect, it } from 'bun:test';
import { generateText } from 'ai';
import type { MistralLanguageModelChatOptions } from '@ai-sdk/mistral';

// Sans clé, @ai-sdk/mistral jette LoadAPIKeyError avant le fetch faké ;
// env.ts lit process.env au chargement, d'où l'import dynamique.
process.env['MISTRAL_API_KEY'] ??= 'test-api-key';
const { mistralProvider } = await import('../lib/ai/provider.js');
const { env } = await import('../config/env.js');

function fakeMistralResponse() {
  return new Response(
    JSON.stringify({
      id: 'cmpl-1', object: 'chat.completion', created: 0, model: 'mistral-small-2603',
      choices: [{ index: 0, message: { role: 'assistant', content: 'ok' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    }),
    { headers: { 'content-type': 'application/json' } },
  );
}

async function captureRequest(mistral: MistralLanguageModelChatOptions) {
  const captured: { url?: string; body?: Record<string, unknown> } = {};
  const provider = mistralProvider(async (url, init) => {
    captured.url = String(url);
    captured.body = JSON.parse(init?.body as string) as Record<string, unknown>;
    return fakeMistralResponse();
  });
  await generateText({ model: provider(env.MISTRAL_MODEL), prompt: 'hi', providerOptions: { mistral } });
  return captured;
}

describe('mistralProvider', () => {
  it('targets the EU regional endpoint', async () => {
    const { url } = await captureRequest({});
    expect(url).toBe('https://api.eu.mistral.ai/v1/chat/completions');
  });

  it('sends prompt_cache_key from providerOptions', async () => {
    const { body } = await captureRequest({ promptCacheKey: 'session-42' });
    expect(body?.['prompt_cache_key']).toBe('session-42');
  });

  it('omits prompt_cache_key without a key', async () => {
    const { body } = await captureRequest({});
    expect(body && 'prompt_cache_key' in body).toBe(false);
  });

  it('sends reasoning_effort for mistral-small-2603', async () => {
    expect((await captureRequest({ reasoningEffort: 'high' })).body?.['reasoning_effort']).toBe('high');
    expect((await captureRequest({ reasoningEffort: 'none' })).body?.['reasoning_effort']).toBe('none');
  });
});
```

- [ ] Voir échouer : `cd apps/server && bun test src/tests/ai-provider.test.ts`. Attendu : échec de typecheck runtime ou d'assertion — `mistralProvider(fetch)` passe la fonction comme `promptCacheKey` (la clé devient une fonction, le fetch réel part vers `api.mistral.ai`) ; au minimum l'URL attendue diffère.
- [ ] Réécrire `apps/server/src/lib/ai/provider.ts` :

```ts
import { createMistral, type MistralProvider } from '@ai-sdk/mistral';
import { env } from '../../config/env.js';

type FetchLike = (url: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export function mistralProvider(fetch?: FetchLike): MistralProvider {
  return createMistral({
    apiKey: env.MISTRAL_API_KEY,
    baseURL: `${env.MISTRAL_SERVER_URL}/v1`,
    fetch: fetch as typeof globalThis.fetch | undefined,
  });
}
```

- [ ] Étendre `mistral-client.test.ts` (tests qui échouent) : remplacer `mockFetchJson` (l. 11-19) par une version qui capture aussi l'URL, et le modèle de la réponse faké (l. 26) par `'mistral-small-2603'` :

```ts
function mockFetchJson(capture: { url?: string; body?: Record<string, unknown> }, responseBody: unknown) {
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    capture.url = String(url);
    capture.body = init?.body ? (JSON.parse(init.body as string) as Record<string, unknown>) : undefined;
    return new Response(JSON.stringify(responseBody), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as unknown as typeof fetch;
}
```

Ajouter dans `describe('generateText')` :

```ts
  it('calls the dated model on the EU endpoint with reasoning off', async () => {
    const capture: { url?: string; body?: Record<string, unknown> } = {};
    mockFetchJson(capture, chatCompletion('ok'));

    await generateText({ messages: [{ role: 'user', content: 'Salut' }] });

    expect(capture.url).toBe('https://api.eu.mistral.ai/v1/chat/completions');
    expect(capture.body?.['model']).toBe('mistral-small-2603');
    expect(capture.body?.['reasoning_effort']).toBe('none');
  });
```

et dans `describe('generateStructured')` :

```ts
  it('keeps reasoning off for structured outputs', async () => {
    const capture: { url?: string; body?: Record<string, unknown> } = {};
    mockFetchJson(capture, chatCompletion(JSON.stringify({ intent: 'explain-concept' })));

    await generateStructured<{ intent: string }>({ messages: [{ role: 'user', content: 'classe' }], schema: SCHEMA });

    expect(capture.body?.['reasoning_effort']).toBe('none');
  });
```

Les deux tests existants sur `prompt_cache_key` (l. 46-58, 105-122) restent : ils deviennent la non-régression du passage au `providerOptions`.

- [ ] Voir échouer : `bun test src/tests/mistral-client.test.ts`. Attendu : les deux nouveaux tests échouent (`reasoning_effort` absent), et les tests `prompt_cache_key` échouent aussi tant que `mistral-client.ts` appelle encore `mistralProvider(opts.promptCacheKey)`.
- [ ] Implémenter dans `mistral-client.ts` :
  - l. 15 : ajouter `import type { MistralLanguageModelChatOptions } from '@ai-sdk/mistral';`
  - en-tête l. 10-12 → ` * Both go through \`mistralProvider\` (\`lib/ai/provider.ts\`, EU endpoint).` / ` * Every call runs with \`reasoningEffort: 'none'\`: reasoning is reserved to the` / ` * chat turn (\`ai-chat.service.ts\`).` ; l. 23-24 → ` * Multimodal content parts (vision). Mistral Small 4 accepts \`image_url\` parts`
  - l. 120 et 167 : `serverAddress: new URL(env.MISTRAL_SERVER_URL).host,`
  - l. 124 et 171 : `model: mistralProvider()(model),`
  - l. 131 :

```ts
        providerOptions: {
          mistral: {
            safePrompt: true,
            reasoningEffort: 'none',
            promptCacheKey: opts.promptCacheKey,
          } satisfies MistralLanguageModelChatOptions,
        },
```

  - l. 180 : idem avec `strictJsonSchema: true` en plus.
  - `mistral-vision.ts:54` : `serverAddress: new URL(env.MISTRAL_SERVER_URL).host,`
- [ ] **Étape conditionnelle — seulement si D2 = « usage absent sans `stream_options`, présent avec ».** Test qui échoue, ajouté à `ai-provider.test.ts` (importer `streamText` depuis `'ai'`) :

```ts
describe('mistralProvider — streaming usage', () => {
  it('asks Mistral for usage on streamed requests only', async () => {
    const bodies: Record<string, unknown>[] = [];
    const sse = `data: ${JSON.stringify({ id: 'c1', object: 'chat.completion.chunk', created: 0, model: 'mistral-small-2603', choices: [{ index: 0, delta: { role: 'assistant', content: 'ok' }, finish_reason: 'stop' }], usage: { prompt_tokens: 3, completion_tokens: 1, total_tokens: 4 } })}\n\ndata: [DONE]\n\n`;
    const provider = mistralProvider(async (_url, init) => {
      const body = JSON.parse(init?.body as string) as Record<string, unknown>;
      bodies.push(body);
      return body['stream'] === true
        ? new Response(sse, { headers: { 'content-type': 'text/event-stream' } })
        : fakeMistralResponse();
    });

    await streamText({ model: provider(env.MISTRAL_MODEL), prompt: 'hi' }).text;
    await generateText({ model: provider(env.MISTRAL_MODEL), prompt: 'hi' });

    expect(bodies[0]?.['stream_options']).toEqual({ include_usage: true });
    expect(bodies[1] && 'stream_options' in bodies[1]).toBe(false);
  });
});
```

Voir échouer (`stream_options` indéfini), puis remplacer le corps de `provider.ts` par :

```ts
export function mistralProvider(fetch: FetchLike = globalThis.fetch): MistralProvider {
  return createMistral({
    apiKey: env.MISTRAL_API_KEY,
    baseURL: `${env.MISTRAL_SERVER_URL}/v1`,
    fetch: withStreamUsage(fetch) as typeof globalThis.fetch,
  });
}

// Mistral only reports usage on a stream when asked
// (https://docs.mistral.ai/resources/known-limitations) and @ai-sdk/mistral
// 4.0.48 never sends stream_options: without it, quota and cost stay at zero.
function withStreamUsage(baseFetch: FetchLike): FetchLike {
  return async (url, init) => {
    if (typeof init?.body !== 'string') return baseFetch(url, init);
    const body = JSON.parse(init.body) as Record<string, unknown>;
    if (body['stream'] !== true) return baseFetch(url, init);
    return baseFetch(url, { ...init, body: JSON.stringify({ ...body, stream_options: { include_usage: true } }) });
  };
}
```

Ouvrir en parallèle une issue sur `vercel/ai` (option manquante), lien dans la PR.

- [ ] Voir passer : `bun test src/tests/ai-provider.test.ts && bun test src/tests/mistral-client.test.ts && bun run typecheck`. Attendu : tout vert, exit 0.
- [ ] Commit :

```bash
git add apps/server/src/lib/ai/provider.ts
git add apps/server/src/lib/ai/mistral-client.ts
git add apps/server/src/services/document/mistral-vision.ts
git add apps/server/src/tests/ai-provider.test.ts
git add apps/server/src/tests/mistral-client.test.ts
git commit -m "feat(server): route Mistral calls through the EU endpoint with native prompt cache key

The homemade fetch wrapper that injected prompt_cache_key is replaced by
providerOptions.mistral.promptCacheKey (@ai-sdk/mistral 4.0.48,
dist/index.d.ts:14). Non-chat calls send reasoning_effort none. Source:
https://docs.mistral.ai/inference/regional-inference

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Tâche C.4 — Tour de chat : clé de cache par session, `PROMPT_VERSION`, raisonnement gardé côté serveur

**Files:**
- Modify : `apps/server/src/services/chat/ai-chat.service.ts:9-15,26,45-46,265-281`
- Modify : `apps/server/src/routes/chat-message.routes.ts:164`
- Modify : `apps/server/src/tests/ai-chat-service.test.ts` (ajouts), `apps/server/src/tests/chat-stream-route.test.ts:23,100-103,118-137` (ajouts)

**Interfaces:**
- Consumes : `mistralProvider()` (C.3), `routeReasoningEffort(params): 'none' | 'high'` (`lib/ai/mistral-reasoning.ts:57`, inchangé ; son type correspond à l'enum du SDK, `dist/index.d.ts:15-18`), `toUIMessageStream({ sendReasoning })` (`ai/dist/index.d.ts:2611-2614`).
- Produces : requête de chat avec `prompt_cache_key = params.sessionId`, `reasoning_effort` routé ; log `chat-stream:start` portant `model` et `promptVersion`.

- [ ] Tests qui échouent, ajoutés à `ai-chat-service.test.ts`. En tête de fichier, première ligne : `import './_helpers/mistral-env';` ; compléter l'import bun : `import { describe, it, expect, afterEach } from 'bun:test';`. En fin de fichier :

```ts
describe('streamChat — Mistral wire request', () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  function mockMistralStream(capture: { url?: string; body?: Record<string, unknown> }) {
    const chunk = (delta: Record<string, unknown>, extra: Record<string, unknown> = {}) =>
      `data: ${JSON.stringify({ id: 'c1', object: 'chat.completion.chunk', created: 0, model: 'mistral-small-2603', choices: [{ index: 0, delta, finish_reason: extra['finish_reason'] ?? null }], ...extra })}\n\n`;
    const sse =
      chunk({ role: 'assistant', content: 'ok' }) +
      chunk({ content: '' }, {
        finish_reason: 'stop',
        usage: { prompt_tokens: 200, completion_tokens: 1, total_tokens: 201, prompt_tokens_details: { cached_tokens: 128 } },
      }) +
      'data: [DONE]\n\n';
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      capture.url = String(url);
      capture.body = JSON.parse(init?.body as string) as Record<string, unknown>;
      return new Response(sse, { headers: { 'content-type': 'text/event-stream' } });
    }) as unknown as typeof fetch;
  }

  it('sends the dated model, the session cache key and high reasoning on a STEM solve turn', async () => {
    const capture: { url?: string; body?: Record<string, unknown> } = {};
    mockMistralStream(capture);

    const result = streamChat({
      ...baseParams,
      subject: 'mathematiques',
      classifiedIntent: { intent: 'solve-this-for-me', confidence: 'high' },
      tools: noopTools,
    });
    await result.text;

    expect(capture.url).toBe('https://api.eu.mistral.ai/v1/chat/completions');
    expect(capture.body?.['model']).toBe('mistral-small-2603');
    expect(capture.body?.['prompt_cache_key']).toBe('session-001');
    expect(capture.body?.['reasoning_effort']).toBe('high');
  });

  it("sends reasoning_effort 'none' outside the STEM hard-intent route", async () => {
    const capture: { url?: string; body?: Record<string, unknown> } = {};
    mockMistralStream(capture);

    await streamChat({ ...baseParams, subject: 'francais', tools: noopTools }).text;

    expect(capture.body?.['reasoning_effort']).toBe('none');
  });

  it('surfaces cached prompt tokens from the streamed usage', async () => {
    mockMistralStream({});

    const usage = await streamChat({ ...baseParams, tools: noopTools }).totalUsage;

    expect(usage.inputTokens).toBe(200);
    expect(usage.inputTokenDetails.cacheReadTokens).toBe(128);
  });
});
```

(Si l'étape conditionnelle de C.3 s'applique, ajouter au premier test `expect(capture.body?.['stream_options']).toEqual({ include_usage: true });`.)

- [ ] Test qui échoue dans `chat-stream-route.test.ts` : l. 23 → `env: { MISTRAL_MODEL: 'mistral-small-2603' },` ; l. 100-103, typer l'option : `toUIMessageStream: (options?: { sendReasoning?: boolean }) => ReadableStream<unknown>;` ; déclarer après ce type `let lastUIStreamOptions: { sendReasoning?: boolean } | undefined;` ; dans le `beforeEach` (l. 127), remplacer `toUIMessageStream: () =>` par `toUIMessageStream: (options) => { lastUIStreamOptions = options; return new ReadableStream({ … }); },` (même corps de flux) et ajouter `lastUIStreamOptions = undefined;` en tête du `beforeEach`. Nouveau test :

```ts
  it('never forwards the model reasoning to the client', async () => {
    currentUser = { id: 'user-001', role: 'student', schoolLevel: 'troisieme', firstName: 'Léo' };
    const res = await app.handle(makeRequest());
    await res.text();

    expect(lastUIStreamOptions).toEqual({ sendReasoning: false });
  });
```

- [ ] Voir échouer : `cd apps/server && bun test src/tests/ai-chat-service.test.ts && bun test src/tests/chat-stream-route.test.ts`. Attendu : `prompt_cache_key` vaut `chat-2026-06-14-voicefmt` au lieu de `session-001` ; `lastUIStreamOptions` est `undefined`.
- [ ] Implémenter dans `ai-chat.service.ts` :
  - l. 9-14 (bloc « Prompt cache ») →

```ts
 * Prompt cache
 *   `promptCacheKey` = the chat session id, as Mistral recommends for
 *   multi-turn conversations: each turn resends the same prefix (system
 *   prompt + history), so turn N+1 reads turn N's prefix from cache.
```

  - l. 26 : `import { mistralProvider } from '../../lib/ai/provider.js';` inchangé ; ajouter `import type { MistralLanguageModelChatOptions } from '@ai-sdk/mistral';` et `import { logger } from '../../lib/observability.js';`
  - l. 45-46 → `/** Bump whenever content under config/prompts/** or shared/pedagogy/** changes. */` puis `const PROMPT_VERSION = '2026-06-14-voicefmt';`
  - l. 265-281 →

```ts
  const model = params.model ?? mistralProvider()(env.MISTRAL_MODEL);

  logger.info('Chat stream started', {
    operation: 'chat-stream:start',
    sessionId: params.sessionId,
    model: env.MISTRAL_MODEL,
    promptVersion: PROMPT_VERSION,
    reasoningEffort,
  });

  return streamText({
    model,
    system,
    messages,
    tools: params.tools,
    stopWhen: isStepCount(MAX_TOOL_ITERATIONS),
    temperature: env.MISTRAL_TEMPERATURE,
    maxOutputTokens: env.MISTRAL_MAX_TOKENS,
    providerOptions: {
      mistral: {
        parallelToolCalls: false,
        reasoningEffort,
        promptCacheKey: params.sessionId,
      } satisfies MistralLanguageModelChatOptions,
    },
```

- [ ] `chat-message.routes.ts:164` → `writer.merge(capturedResult.toUIMessageStream({ sendReasoning: false }));`
- [ ] Voir passer : mêmes commandes, puis `bun run typecheck && bun run lint`. Attendu : vert, exit 0.
- [ ] Commit :

```bash
git add apps/server/src/services/chat/ai-chat.service.ts
git add apps/server/src/routes/chat-message.routes.ts
git add apps/server/src/tests/ai-chat-service.test.ts
git add apps/server/src/tests/chat-stream-route.test.ts
git commit -m "feat(chat): key the prompt cache by session and keep reasoning server-side

prompt_cache_key is now the chat session id (Mistral recommendation,
https://docs.mistral.ai/studio/conversations/advanced/prompt-caching).
Reasoning chunks are no longer streamed to the client, where they could
reveal the answer. PROMPT_VERSION and the model id are logged per turn.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Tâche C.5 — Embeddings et Voxtral sur le même endpoint

**Files:**
- Modify : `apps/server/src/services/mistral-embeddings.service.ts:35`
- Modify : `apps/server/src/services/voxtral-transcribe.service.ts:4,16`, `apps/server/src/services/voxtral-tts.service.ts:4-7,59`
- Modify : `apps/server/src/tests/voxtral-transcribe.service.test.ts:17,36,82,97,105`
- Create : `apps/server/src/tests/mistral-embeddings.service.test.ts`, `apps/server/src/tests/voxtral-tts.service.test.ts`

**Interfaces:**
- Consumes : `new Mistral({ apiKey, serverURL })` (`@mistralai/mistralai/esm/lib/config.d.ts:24-35`, présent dès 2.2.5 installée) ; le fetcher par défaut appelle le `fetch` global avec un `Request` (`esm/lib/http.js:11-14`) ; schéma de réponse embeddings `{ id, object, model, usage, data }` (`esm/models/components/embeddingresponse.js:10-16`).
- Produces : URL `${env.MISTRAL_SERVER_URL}/v1/embeddings|/audio/transcriptions|/audio/speech`.

- [ ] Test qui échoue, `apps/server/src/tests/mistral-embeddings.service.test.ts` :

```ts
import './_helpers/mistral-env';
import { describe, it, expect, afterEach } from 'bun:test';
import { mistralEmbeddingsService } from '../services/mistral-embeddings.service';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('mistralEmbeddingsService', () => {
  it('embeds with the dated model on the EU endpoint and normalises the vector', async () => {
    let request: Request | undefined;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      request = input instanceof Request ? input : new Request(input, init);
      return new Response(
        JSON.stringify({
          id: 'e1', object: 'list', model: 'mistral-embed-2312',
          usage: { prompt_tokens: 1, total_tokens: 1 },
          data: [{ object: 'embedding', index: 0, embedding: [3, 4] }],
        }),
        { headers: { 'content-type': 'application/json' } },
      );
    }) as unknown as typeof fetch;

    const vector = await mistralEmbeddingsService.embed('bonjour');

    expect(request?.url).toBe('https://api.eu.mistral.ai/v1/embeddings');
    expect(((await request?.json()) as { model: string }).model).toBe('mistral-embed-2312');
    expect(vector).toEqual([0.6, 0.8]);
  });
});
```

- [ ] Test qui échoue, `apps/server/src/tests/voxtral-tts.service.test.ts` :

```ts
import { describe, it, expect, afterEach, mock, spyOn } from 'bun:test';
import { createMockLogger } from './_helpers/mock-logger';

mock.module('../lib/observability', () => ({ logger: createMockLogger() }));
mock.module('../config/env', () => ({
  env: {
    MISTRAL_API_KEY: 'test-mistral-key',
    MISTRAL_SERVER_URL: 'https://api.eu.mistral.ai',
    MISTRAL_TTS_MODEL: 'voxtral-mini-tts-2603',
  },
}));

const { getVoxtralTTSService } = await import('../services/voxtral-tts.service');

describe('VoxtralTTSService', () => {
  let fetchSpy: ReturnType<typeof spyOn> | undefined;

  afterEach(() => {
    fetchSpy?.mockRestore();
  });

  it('synthesises with the dated model on the configured endpoint', async () => {
    fetchSpy = spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ audio_data: 'AAAA' }), { headers: { 'content-type': 'application/json' } }),
    );

    const result = await getVoxtralTTSService().synthesize('Bonjour');

    expect(result.success).toBe(true);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.eu.mistral.ai/v1/audio/speech');
    expect((JSON.parse(init.body as string) as { model: string }).model).toBe('voxtral-mini-tts-2603');
  });
});
```

- [ ] Adapter `voxtral-transcribe.service.test.ts` : l. 17 → `env: { MISTRAL_API_KEY: 'test-mistral-key', MISTRAL_SERVER_URL: 'https://api.eu.mistral.ai', MISTRAL_STT_MODEL: 'voxtral-mini-2602' },` ; l. 36 défaut `model = 'voxtral-mini-2602'` ; l. 82 → `'https://api.eu.mistral.ai/v1/audio/transcriptions'` ; l. 97 libellé `'includes model=voxtral-mini-2602 in formData'` ; l. 105 → `toBe('voxtral-mini-2602')`.
- [ ] Voir échouer : `cd apps/server && bun test src/tests/mistral-embeddings.service.test.ts && bun test src/tests/voxtral-tts.service.test.ts && bun test src/tests/voxtral-transcribe.service.test.ts`. Attendu : URLs `https://api.mistral.ai/...` au lieu de l'endpoint UE.
- [ ] Implémenter :
  - `mistral-embeddings.service.ts:35` → `this.client = new Mistral({ apiKey: MISTRAL_API_KEY, serverURL: env.MISTRAL_SERVER_URL });`
  - `voxtral-transcribe.service.ts:16` → ``const STT_ENDPOINT = `${env.MISTRAL_SERVER_URL}/v1/audio/transcriptions`;`` ; l. 4 → ` * Appelle directement POST {MISTRAL_SERVER_URL}/v1/audio/transcriptions via`
  - `voxtral-tts.service.ts:59` → ``private readonly baseUrl = `${env.MISTRAL_SERVER_URL}/v1`;`` ; l. 4-7 → ` * Appelle directement POST {MISTRAL_SERVER_URL}/v1/audio/speech.`
- [ ] **Variante « audio hors UE » — seulement si C.1 montre que Voxtral n'est pas servi en UE.** Ajouter dans `env.ts`, sous `MISTRAL_SERVER_URL` : `MISTRAL_AUDIO_SERVER_URL: z.url().default('https://api.mistral.ai'),` ; utiliser `env.MISTRAL_AUDIO_SERVER_URL` à la place de `env.MISTRAL_SERVER_URL` dans les deux services Voxtral et dans leurs mocks/assertions de test (URL attendue `https://api.mistral.ai/...`). Dans la description de la PR, note de conformité : la voix de l'élève (donnée personnelle d'un mineur) est traitée sur l'endpoint global, sans garantie de localisation UE ; ZDR couvre malgré tout `/v1/audio/*` ; à signaler au conseil (spec agent-ia §11) et à réévaluer quand Mistral ouvrira Voxtral en UE.
- [ ] Voir passer : mêmes commandes + `bun run typecheck`. Attendu : vert, exit 0.
- [ ] Commit :

```bash
git add apps/server/src/services/mistral-embeddings.service.ts
git add apps/server/src/services/voxtral-transcribe.service.ts
git add apps/server/src/services/voxtral-tts.service.ts
git add apps/server/src/tests/mistral-embeddings.service.test.ts
git add apps/server/src/tests/voxtral-tts.service.test.ts
git add apps/server/src/tests/voxtral-transcribe.service.test.ts
git commit -m "feat(server): send embeddings and Voxtral calls to the configured Mistral endpoint

Source: @mistralai/mistralai esm/lib/config.d.ts (serverURL),
https://docs.mistral.ai/inference/regional-inference

Co-Authored-By: Claude <noreply@anthropic.com>"
```

(Si la variante « audio hors UE » s'applique, stager aussi `apps/server/src/config/env.ts` et le dire dans le message.)

---

### Tâche C.6 — Coût au tarif Small 4, majoration UE

**Files:**
- Modify : `apps/server/src/services/cost-tracking.service.ts:1-18,38-101,121-125`
- Modify : `apps/server/src/tests/cost-tracking.test.ts` (réécriture)

**Interfaces:**
- Produces : `computeCostCents(aiModel: string, tokensInput: number, tokensOutput: number, cachedTokens: number, upcharge: number): { costCents: number; unknownModel: boolean }` ; `regionalUpcharge(serverUrl: string): number`. Seul appelant hors tests : `CostTrackingService.record` (`grep -rn computeCostCents apps/server/src` → l. 96).
- Tarifs : Small 4 0,15 $/0,60 $ (https://docs.mistral.ai/models/mistral-small-4-0-26-03) ; cache à 10 % (https://docs.mistral.ai/studio/conversations/advanced/prompt-caching) ; UE ×1,1 sur input, output et cache (https://docs.mistral.ai/inference/regional-inference).

- [ ] Réécrire `cost-tracking.test.ts` (échoue : signature à 4 paramètres, `mistral-small-2603` absent de la table exacte) :

```ts
import { describe, expect, it } from 'bun:test';
import { computeCostCents, regionalUpcharge } from '../services/cost-tracking.service.js';

// USD_TO_EUR par défaut = 0.92.
describe('computeCostCents', () => {
  it('facture mistral-small-2603 au tarif Small 4 majoré UE', () => {
    // (0.15 + 0.60) USD × 1.1 × 0.92 × 100 = 75.9 → 76
    expect(computeCostCents('mistral-small-2603', 1_000_000, 1_000_000, 0, 1.1)).toEqual({ costCents: 76, unknownModel: false });
  });

  it("ne majore pas sur l'endpoint global", () => {
    // 0.75 × 0.92 × 100 = 69
    expect(computeCostCents('mistral-small-2603', 1_000_000, 1_000_000, 0, 1).costCents).toBe(69);
  });

  it('signale unknownModel sur un alias ou un modèle retiré du casting', () => {
    for (const id of ['mistral-small-latest', 'mistral-medium-latest', 'magistral-medium-latest', 'ministral-3b-latest']) {
      expect(computeCostCents(id, 1_000, 1_000, 0, 1.1)).toEqual({ costCents: 0, unknownModel: true });
    }
  });
});

describe('computeCostCents — cached tokens', () => {
  it('facture les tokens cachés à 10 % du tarif input', () => {
    // 2M × 0.15 + 8M × 0.015 = 0.42 USD × 1.1 × 0.92 = 0.42504 EUR → 43 cents
    expect(computeCostCents('mistral-small-2603', 10_000_000, 0, 8_000_000, 1.1).costCents).toBe(43);
  });

  it('0 caché = plein tarif input', () => {
    // 10M × 0.15 = 1.5 USD × 1.1 × 0.92 = 1.518 EUR → 152 cents
    expect(computeCostCents('mistral-small-2603', 10_000_000, 0, 0, 1.1).costCents).toBe(152);
  });

  it('borne cachedTokens à tokensInput si la valeur API est aberrante', () => {
    // 10M tout caché : 0.15 USD × 1.1 × 0.92 = 0.1518 EUR → 15 cents
    expect(computeCostCents('mistral-small-2603', 10_000_000, 0, 50_000_000, 1.1).costCents).toBe(15);
  });
});

describe('regionalUpcharge', () => {
  it("vaut 1.1 sur l'endpoint UE", () => {
    expect(regionalUpcharge('https://api.eu.mistral.ai')).toBe(1.1);
  });

  it("vaut 1 sur l'endpoint global", () => {
    expect(regionalUpcharge('https://api.mistral.ai')).toBe(1);
  });
});
```

- [ ] Voir échouer : `cd apps/server && bun test src/tests/cost-tracking.test.ts`. Attendu : `regionalUpcharge` non exporté, montants faux.
- [ ] Implémenter. En-tête l. 10-13 → ` * Pricing is expressed in USD per million tokens, as published by Mistral,` / ` * keyed by dated model id (no aliases: an alias can silently change price).` / ` * Cached tokens are billed at 10 % of the input rate; the EU regional endpoint` / ` * adds 10 % to everything (docs.mistral.ai/inference/regional-inference).`. Remplacer l. 38-92 par :

```ts
const MODEL_PRICING_USD_PER_MILLION: Record<string, { input: number; output: number }> = {
  'mistral-small-2603': { input: 0.15, output: 0.60 },
};

const CACHE_DISCOUNT = 0.10;
const EU_REGIONAL_UPCHARGE = 1.1;

const USD_TO_EUR = env.USD_TO_EUR_RATE;

export function regionalUpcharge(serverUrl: string): number {
  return new URL(serverUrl).host === 'api.mistral.ai' ? 1 : EU_REGIONAL_UPCHARGE;
}

export function computeCostCents(
  aiModel: string,
  tokensInput: number,
  tokensOutput: number,
  cachedTokens: number,
  upcharge: number,
): { costCents: number; unknownModel: boolean } {
  const pricing = MODEL_PRICING_USD_PER_MILLION[aiModel];
  if (!pricing) {
    return { costCents: 0, unknownModel: true };
  }

  const cached = Math.min(Math.max(cachedTokens, 0), tokensInput);
  const uncachedInput = tokensInput - cached;
  const inputUsd =
    (uncachedInput / 1_000_000) * pricing.input +
    (cached / 1_000_000) * pricing.input * CACHE_DISCOUNT;
  const outputUsd = (tokensOutput / 1_000_000) * pricing.output;
  const totalEur = (inputUsd + outputUsd) * upcharge * USD_TO_EUR;

  return { costCents: Math.round(totalEur * 100), unknownModel: false };
}
```

Dans `record` (l. 95-101) :

```ts
  async record(input: CostRecordInput): Promise<void> {
    const upcharge = regionalUpcharge(env.MISTRAL_SERVER_URL);
    const { costCents, unknownModel } = computeCostCents(
      input.aiModel,
      input.tokensInput,
      input.tokensOutput,
      input.cachedTokens ?? 0,
      upcharge,
    );
```

et ajouter `regionalUpcharge: upcharge,` dans `billingMetadata` (l. 121-125). L'URL est lue à l'appel, pas au chargement : `api-endpoints.test.ts` mocke `env` sans cette clé et importe cette chaîne via `app.ts`.

- [ ] Voir passer : `bun test src/tests/cost-tracking.test.ts && bun run typecheck && bun run lint`. Attendu : vert, exit 0 (knip : `normalizeModelId` supprimé, plus aucune référence).
- [ ] Commit :

```bash
git add apps/server/src/services/cost-tracking.service.ts
git add apps/server/src/tests/cost-tracking.test.ts
git commit -m "feat(server): price chat turns at Mistral Small 4 rates with the EU upcharge

Sources: https://docs.mistral.ai/models/mistral-small-4-0-26-03,
https://docs.mistral.ai/studio/conversations/advanced/prompt-caching,
https://docs.mistral.ai/inference/regional-inference

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Tâche C.7 — Doctor : ping réel sur Small 4 en UE

**Files:**
- Modify : `scripts/doctor-checks.mjs:51-57,162-185`
- Modify : `scripts/doctor-checks.test.mjs:5,49-52,165-178`

**Interfaces:**
- Produces : `loadConfig()` renvoie en plus `mistralServerUrl` (défaut `https://api.eu.mistral.ai`) et `mistralModel` (défaut `mistral-small-2603`), lus comme le serveur (`apps/server/.env` puis shell).

- [ ] Tests qui échouent. `doctor-checks.test.mjs:5` → `const CFG = { serverUrl: 'http://s:3000', mistralServerUrl: 'https://api.eu.mistral.ai', mistralModel: 'mistral-small-2603' };`. Après le test l. 49-52, ajouter :

```js
test('loadConfig: Mistral en UE sur Small 4 par défaut', () => {
  const cfg = loadConfig({ processEnv: {}, readEnvFile: () => ({}) });
  assert.equal(cfg.mistralServerUrl, 'https://api.eu.mistral.ai');
  assert.equal(cfg.mistralModel, 'mistral-small-2603');
});
```

Remplacer le test l. 165-178 par :

```js
test('check mistral chat réel: PASS si la complétion renvoie des choices', async () => {
  let sentUrl = null;
  let sentBody = null;
  const ctx = {
    config: { ...CFG, mistralKey: 'sk-xxx' },
    exec: () => ({}),
    fetchFn: async (url, opts) => {
      sentUrl = url;
      sentBody = opts?.body ? JSON.parse(opts.body) : null;
      return { ok: true, json: async () => ({ choices: [{ message: { content: 'pong' } }] }) };
    },
  };
  const checks = buildChecks(ctx, { full: true, e2e: true });
  await byName(checks, 'mistral').run();
  assert.equal(sentUrl, 'https://api.eu.mistral.ai/v1/chat/completions');
  assert.equal(sentBody?.model, 'mistral-small-2603');
  assert.equal(sentBody?.reasoning_effort, 'none');
});
```

- [ ] Voir échouer : `pnpm test:scripts`. Attendu : `mistralServerUrl` indéfini, URL et modèle `ministral-3b-latest` en échec.
- [ ] Implémenter. `loadConfig` (l. 56) :

```js
    mistralKey:       env('MISTRAL_API_KEY'),
    mistralServerUrl: env('MISTRAL_SERVER_URL') ?? 'https://api.eu.mistral.ai',
    mistralModel:     env('MISTRAL_MODEL')      ?? 'mistral-small-2603',
```

`checkMistralReal` (l. 162-185) :

```js
// Preuve réelle du chemin LLM : un chat completion 1 token sur le modèle et
// l'endpoint du serveur. Échoue sur clé invalide, quota épuisé, modèle absent
// de l'endpoint ou panne API — ce qu'une simple présence de clé ne prouve pas.
function checkMistralReal(ctx) {
  return { name: `mistral chat réel (${ctx.config.mistralModel}, ${ctx.config.mistralServerUrl}, 1 token)`, run: async () => {
    if (!ctx.config.mistralKey) {
      throw new Error('MISTRAL_API_KEY absente — définis-la dans apps/server/.env ou ton shell');
    }
    const res = await ctx.fetchFn(`${ctx.config.mistralServerUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${ctx.config.mistralKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: ctx.config.mistralModel,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 1,
        reasoning_effort: 'none',
      }),
    });
    if (!res.ok) throw new Error(`mistral chat -> HTTP ${res.status} (clé invalide, quota, modèle absent de l'endpoint ou panne API)`);
    const body = await res.json();
    const message = body?.choices?.[0]?.message;
    if (typeof message?.content !== 'string') throw new Error('mistral chat: réponse sans message.content (shape inattendue)');
  }};
}
```

- [ ] Voir passer : `pnpm test:scripts`. Attendu : tous les tests `ok`, exit 0.
- [ ] Commit :

```bash
git add scripts/doctor-checks.mjs
git add scripts/doctor-checks.test.mjs
git commit -m "fix(server): make pnpm doctor:e2e ping the server's Mistral model and endpoint

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Tâche C.8 — Documentation : skill `mistral-stack`, README serveur, gabarit d'environnement

**Files:**
- Modify : `.claude/skills/mistral-stack/SKILL.md` (réécriture), `apps/server/README.md:41-45`, `apps/server/.env.example:45-50`, `apps/server/src/integration-tests/api-endpoints.test.ts:58-64`

- [ ] Réécrire `.claude/skills/mistral-stack/SKILL.md` :

````markdown
---
name: mistral-stack
description: Choisir le modèle Mistral et l'appeler correctement — chat, raisonnement, vision, sorties structurées, embeddings, TTS/STT, cache de prompt, coût. À utiliser quand on ajoute ou modifie un appel IA côté serveur, qu'on hésite entre deux modèles, ou qu'un coût de tokens dérape. Toute la stack IA est Mistral, endpoint UE.
---

# Stack IA — casting et réglages

Contrainte non négociable : **stack 100 % Mistral, inférence en UE** (`api.eu.mistral.ai`,
variable `MISTRAL_SERVER_URL`). Référence de conception : `docs/superpowers/specs/2026-09-22-agent-ia.md` §2-3.

## Casting

| Rôle | Modèle | Réglage |
|---|---|---|
| Chat élève, texte et image | `mistral-small-2603` (Small 4) | `reasoningEffort` routé par `lib/ai/mistral-reasoning.ts`, `promptCacheKey` = ID de session |
| Vision, analyse de document, résumés, cartes, titres, classification d'intention | `mistral-small-2603` | `reasoningEffort: 'none'` (imposé par `lib/ai/mistral-client.ts`) |
| Embeddings mémoire épisodique | `MISTRAL_EMBED_MODEL` (1024D) | — |
| STT / TTS | `voxtral-mini-2602` / `voxtral-mini-tts-2603` | Timeout explicite |

Un seul modèle texte : une seule variable (`MISTRAL_MODEL`), un seul cache, une seule
configuration à évaluer. Un autre modèle (Ministral, Medium 3.5) ne revient que sur une
mesure du harnais d'évaluation (lot 1), jamais sur intuition.

**IDs datés uniquement.** `env.ts` refuse tout `-latest` au boot : un alias change de
modèle et de prix sans prévenir (docs.mistral.ai/inference/model-lifecycle).

## Appeler l'API

- Non-streaming : `generateText` / `generateStructured` de `src/lib/ai/mistral-client.ts`,
  jamais le SDK directement depuis un service.
- Chat : `streamChat` (`src/services/chat/ai-chat.service.ts`, `streamText`), exposé par
  `/api/chat/stream`. Le raisonnement reste côté serveur (`sendReasoning: false`).
- Réglages Mistral uniquement via `providerOptions.mistral` (`promptCacheKey`,
  `reasoningEffort`, `strictJsonSchema`, `parallelToolCalls`) — pas de wrapper `fetch`.
- `reasoningEffort` n'accepte que `'none' | 'high'` dans `@ai-sdk/mistral`, et n'est
  envoyé que pour les IDs de sa liste interne : vérifier qu'un nouveau modèle y figure.
- `safePrompt` est déprécié par Mistral ; il disparaît quand la modération
  entrée/sortie arrive (lot 2).

## Coût

1. **Cache de prompt** : tokens cachés à 10 %, blocs de 64 tokens. Clé = ID de
   session pour le chat, ID de workflow versionné pour les tâches templatées.
   Contenu stable en tête du prompt, variable ensuite.
2. **`maxOutputTokens` par tâche** : titre 64, classification 96, résumé 2048.
3. **JSON Schema strict** pour toute sortie structurée.
4. **Endpoint UE : +10 %** sur tout. Batch, Agents et Files n'y sont pas servis :
   on ne les utilise pas.

`cost-tracking.service.ts` tarifie par ID daté ; un modèle absent de la table
produit une ligne `unknownModel` à 0, à corriger dans la table.

## Sources

[Regional inference](https://docs.mistral.ai/inference/regional-inference) ·
[Prompt caching](https://docs.mistral.ai/studio/conversations/advanced/prompt-caching) ·
[Reasoning](https://docs.mistral.ai/studio/conversations/reasoning) ·
[Small 4](https://docs.mistral.ai/models/mistral-small-4-0-26-03) ·
[Known limitations](https://docs.mistral.ai/resources/known-limitations)
````

- [ ] `apps/server/README.md:41-45` :

```markdown
| AI Chat | Mistral Small 4 (`mistral-small-2603`, streaming + tools + vision), endpoint UE |
| Embeddings | `mistral-embed` 1024D (mémoire épisodique, pgvector) |
| Stockage | Scaleway Object Storage (S3, RGPD France) |
| STT | Voxtral (`voxtral-mini-2602`) |
| TTS | Voxtral (`voxtral-mini-tts-2603`) |
```

- [ ] `apps/server/.env.example`, après `MISTRAL_API_KEY=` (l. 50) :

```bash
# Optional — defaults to the EU regional endpoint (inference in the EU, +10 %).
#           https://docs.mistral.ai/inference/regional-inference
# MISTRAL_SERVER_URL=https://api.eu.mistral.ai
```

- [ ] `api-endpoints.test.ts:61` : ajouter sous `MISTRAL_API_KEY: 'test-key',` la ligne `MISTRAL_SERVER_URL: 'https://api.eu.mistral.ai',` (le mock d'`env` doit refléter la forme réelle pour les modules de la chaîne `app.ts`).
- [ ] Vérifier : `cd apps/server && bun run test:integration`. Attendu : exit 0.
- [ ] Commit :

```bash
git add .claude/skills/mistral-stack/SKILL.md
git add apps/server/README.md
git add apps/server/.env.example
git add apps/server/src/integration-tests/api-endpoints.test.ts
git commit -m "docs(server): describe the Mistral Small 4 casting on the EU endpoint

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Tâche C.9 — Suite live et preuve de bout en bout

**Files:**
- Create : `apps/server/src/live/mistral-eu.test.ts`

**Interfaces:**
- Consumes : `streamChat` (`reasoningText`, `totalUsage`), `generateText`, `mistralEmbeddingsService.embed`, `getVoxtralTTSService().synthesize`, `getVoxtralTranscribeService().transcribe`, `HAS_MISTRAL` (`src/live/_creds.ts`). Suite `test:live` hors CI (`apps/server/package.json:35`), Bun charge `apps/server/.env`.

- [ ] Créer `apps/server/src/live/mistral-eu.test.ts` :

```ts
import { describe, it, expect } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { streamChat } from '../services/chat/ai-chat.service';
import { generateText } from '../lib/ai/mistral-client';
import { mistralEmbeddingsService } from '../services/mistral-embeddings.service';
import { getVoxtralTTSService } from '../services/voxtral-tts.service';
import { getVoxtralTranscribeService } from '../services/voxtral-transcribe.service';
import { HAS_MISTRAL } from './_creds';

// Live contre l'endpoint UE de Mistral. LOCAL-ONLY (`bun run test:live`), fail-closed.

const RED_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAIAAAD8GO2jAAAAJ0lEQVR42u3NsQkAAAjAsP7/tF7hIASyp6lTCQQCgUAgEAgEgi/BAjLD/C5w/SM9AAAAAElFTkSuQmCC';

const mathTurn = {
  userId: 'live-user',
  schoolLevel: 'troisieme' as const,
  subject: 'mathematiques',
  userRole: 'student' as const,
  classifiedIntent: { intent: 'solve-this-for-me', confidence: 'high' as const },
  tools: {},
};

describe('Mistral Small 4 on the EU endpoint (real API)', () => {
  it('MISTRAL_API_KEY is configured (fail-closed, no silent skip)', () => {
    expect(HAS_MISTRAL).toBe(true);
  });

  it('streams a reasoning turn with usage, then reads the prefix from cache on turn 2', async () => {
    const sessionId = randomUUID();
    const first = streamChat({ ...mathTurn, sessionId, content: 'Résous 2x + 3 = 11.', conversationHistory: [] });
    const firstText = await first.text;
    const firstUsage = await first.totalUsage;

    expect(firstText.length).toBeGreaterThan(0);
    expect(((await first.reasoningText) ?? '').length).toBeGreaterThan(0);
    expect(firstUsage.inputTokens ?? 0).toBeGreaterThan(0);
    expect(firstUsage.outputTokens ?? 0).toBeGreaterThan(0);

    const now = new Date().toISOString();
    const second = streamChat({
      ...mathTurn,
      sessionId,
      content: "Je trouve x = 4, c'est juste ?",
      conversationHistory: [
        { role: 'user', content: 'Résous 2x + 3 = 11.', timestamp: now },
        { role: 'assistant', content: firstText, timestamp: now },
      ],
    });
    await second.text;

    expect((await second.totalUsage).inputTokenDetails.cacheReadTokens ?? 0).toBeGreaterThan(0);
  }, 180_000);

  it("emits no reasoning when the route says 'none'", async () => {
    const turn = streamChat({ ...mathTurn, subject: 'francais', sessionId: randomUUID(), content: 'Donne un synonyme de rapide.', conversationHistory: [] });
    await turn.text;

    expect((await turn.reasoningText) ?? '').toBe('');
  }, 60_000);

  it('reads an image (Small 4 is multimodal)', async () => {
    const out = await generateText({
      messages: [{ role: 'user', content: [
        { type: 'text', text: 'De quelle couleur est cette image ? Réponds en un seul mot.' },
        { type: 'image_url', imageUrl: RED_PNG },
      ] }],
      maxTokens: 10,
      temperature: 0,
    });

    expect(out.toLowerCase()).toContain('rouge');
  }, 30_000);

  it('embeds text in 1024 dimensions', async () => {
    expect((await mistralEmbeddingsService.embed('bonjour')).length).toBe(1024);
  }, 30_000);

  it('synthesises then transcribes French speech', async () => {
    const tts = await getVoxtralTTSService().synthesize('Bonjour, je suis Tom.');
    expect(tts.success).toBe(true);

    const audio = new Uint8Array(Buffer.from(tts.audioData ?? '', 'base64'));
    const stt = await getVoxtralTranscribeService().transcribe(audio.buffer, 'audio/mpeg');

    expect(stt.transcription?.toLowerCase()).toContain('bonjour');
  }, 60_000);
});
```

- [ ] Vérifier le typage et le lint : `cd apps/server && bun run typecheck && bun run lint`. Attendu : exit 0. (La suite live elle-même tourne à l'étape manuelle.)
- [ ] Commit :

```bash
git add apps/server/src/live/mistral-eu.test.ts
git commit -m "test(server): prove Small 4 reasoning, cache, vision and audio on the EU endpoint

Co-Authored-By: Claude <noreply@anthropic.com>"
```

- [ ] Validation de fin de PR (agent) : à la racine `pnpm typecheck && pnpm lint && pnpm test && pnpm test:scripts`, puis `cd apps/server && bun run test:integration`. Lire chaque code de sortie ; tous à 0.
- [ ] **Preuve live (utilisateur, clé dans `apps/server/.env`)** :
  1. `pnpm doctor:e2e` → ligne `✓ PASS mistral chat réel (mistral-small-2603, https://api.eu.mistral.ai, 1 token)`, exit 0.
  2. `cd apps/server && bun run test:live` → `mistral-eu.test.ts` : 6 pass (raisonnement non vide en `high`, vide en `none`, `usage` non nul, `cacheReadTokens` > 0 au 2e tour, « rouge », 1024 dimensions, « bonjour » en aller-retour audio) ; `chat.test.ts` vert sur l'endpoint UE.
  3. Tour réel via le seed (terminal 1 : `pnpm dev` ; terminal 2) :

```bash
pnpm seed
curl -sS -c /tmp/tom.cookies -H 'Content-Type: application/json' -H 'Origin: http://localhost:3001' \
  -d '{"username":"dev.eleve","password":"DevEleve123!"}' http://localhost:3000/api/auth/sign-in/username
curl -sS -N -b /tmp/tom.cookies -H 'Content-Type: application/json' \
  -d '{"subject":"mathematiques","message":{"id":"m1","role":"user","parts":[{"type":"text","text":"Aide-moi à résoudre 2x + 3 = 11"}]}}' \
  http://localhost:3000/api/chat/stream > /tmp/turn1.sse
grep -c '"type":"reasoning' /tmp/turn1.sse
SID=$(docker exec tomai-postgres-dev psql -U tomai_dev -d tomai_dev -tAc "select s.id from study_sessions s join \"user\" u on u.id = s.user_id where u.username = 'dev.eleve' order by s.created_at desc limit 1")
curl -sS -N -b /tmp/tom.cookies -H 'Content-Type: application/json' \
  -d "{\"sessionId\":\"$SID\",\"subject\":\"mathematiques\",\"message\":{\"id\":\"m2\",\"role\":\"user\",\"parts\":[{\"type\":\"text\",\"text\":\"Je trouve x = 4, c'est juste ?\"}]}}" \
  http://localhost:3000/api/chat/stream > /tmp/turn2.sse
docker exec tomai-postgres-dev psql -U tomai_dev -d tomai_dev -c "select ai_model, tokens_input, tokens_output, billing_metadata->>'cachedTokens' as cached, billing_metadata->>'regionalUpcharge' as upcharge, cost_cents from cost_tracking where session_id = '$SID' order by created_at"
```

Preuve attendue : `grep -c` = 0 (aucun raisonnement vers le client) ; dans les logs serveur, deux lignes `chat-stream:start` avec `model: mistral-small-2603`, `promptVersion: 2026-06-14-voicefmt` et `reasoningEffort: high` si le classifieur a rendu `solve-this-for-me` ou `check-my-answer` ; deux lignes `cost_tracking` avec `ai_model = mistral-small-2603`, `tokens_input` et `tokens_output` > 0, `upcharge = 1.1`, et `cached` > 0 sur la seconde.

#### Notes de section

**Constats écartés ou corrigés**
- « Mettre `PROMPT_VERSION` dans les métadonnées de télémétrie » : l'option `telemetry` de `streamText` (`ai-chat.service.ts:282-285`) est inerte, aucune intégration n'étant enregistrée (`ai/dist/index.d.ts:944-983` ; aucun `registerTelemetry`/`@ai-sdk/otel` dans le serveur). Les spans OTel maison (`lib/otel/spans.ts`) n'enveloppent pas le chat. D'où le log `chat-stream:start` ; la trace Langfuse arrive au lot 1.
- `MISTRAL_BASE_URL=…/v1` remplacé par `MISTRAL_SERVER_URL` à la racine (justification en tête de section).
- La liste `reasoningEffortModelIds` contient déjà `mistral-medium-latest` en 4.0.48 : le piège « le raisonnement n'a jamais tourné » est levé par la PR B, pas par C. C'est C qui l'expose au client, d'où `sendReasoning: false` (C.4), ajouté hors demande initiale : sans lui, la trace de raisonnement — qui contient souvent la solution — part dans le flux UI de l'élève.
- `mistral-reasoning.ts` n'est pas modifié : son type `'none' | 'high'` correspond à l'enum du SDK. Le routage « tour à risque » et la restriction au collège relèvent du lot 2.

**Non vérifié (vérifié par C.1 ou C.9)**
- Modèles réellement servis sur `api.eu.mistral.ai` (la doc renvoie à `models.list`, sans liste publiée) : C.1.
- Usage en streaming : la page *known limitations* exige `stream_options.include_usage`, la référence de l'endpoint ne documente pas ce paramètre, et le SDK ne l'envoie pas. Tranché par C.1 (D2) ; si l'étape conditionnelle s'applique, un petit wrapper `fetch` subsiste pour cette seule raison.
- `mistral-embed-2312` comme ID servi (connu du SDK, `dist/index.d.ts:22`, non listé dans la doc modèles) : D3.
- Voix preset `casual_male` et Voxtral en UE : C.1 ; variante « audio hors UE » en C.5 sinon.
- ZDR : action de compte manuelle (C.1), non vérifiable par le code.
- `bun -e` avec `await` de premier niveau dans `env-mistral.test.ts` : l'étape « voir échouer » le confirme ; en cas d'échec de syntaxe, remplacer `-e` par un fichier temporaire écrit dans `tmpdir()`.
- Hit de cache au 2e tour : Mistral précise qu'une clé « augmente la probabilité » d'un hit sans le garantir ; un échec isolé de cette assertion live se relance avant d'être tenu pour une régression.

**Hors périmètre, noté**
- `safePrompt: true` (`mistral-client.ts:131,180`) reste : déprécié, retiré avec la modération du lot 2.
- `generateObject` (déprécié en `ai@7`) reste dans `generateStructured` : spec §8, lot 2 ou PR E.
- Le raisonnement des tours précédents n'est pas rejoué (seul le texte est persisté, `chat-orchestration.service.ts:287`) : spec §7, lot 2.
- Les autres clés de cache (`auto-title-…`, `card-generator-…`, `episodic-extract-…`, `document-analysis-…`) restent des identifiants de workflow versionnés, conformes à la recommandation Mistral pour des tâches sans session.

**Dépendances**
- Suppose A (mobile supprimé : aucun client ne consomme les parts `reasoning`) et B (versions citées ; sans B, `mistral-small-2603` n'enverrait pas `reasoning_effort` et `promptCacheKey` n'existerait pas).
- PR E : `@ai-sdk/mistral` 4.0.48 expose `embedding`, `speech` et `transcription` (`dist/index.d.ts:52-94`) ; si E remplace `@mistralai/mistralai` et les `fetch` Voxtral par ces modèles, `mistralProvider()` porte déjà l'endpoint UE et les tests de C.5 restent la non-régression (URL et modèle).
- PR D : ne pas réintroduire de clé de cache globale ni d'alias ; `env-mistral.test.ts` échoue sur un `-latest`.
