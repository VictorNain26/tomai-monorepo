# Lot 0, PR E — Remplacer le code qui réinvente une bibliothèque (E1, E2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Index du lot, contraintes globales, ordre des PR et étapes manuelles :** `docs/superpowers/plans/2026-09-22-lot-0-assainissement.md` — à lire avant ce plan.

**Specs :** `docs/superpowers/specs/2026-09-22-cible-v1.md`, `docs/superpowers/specs/2026-09-22-agent-ia.md`.

---

## PR E — supprimer ou remplacer le code qui réinvente une bibliothèque

Suppose A, B, C et D mergées. Tous les constats ont été revérifiés sur `main` le
2026-09-22 (versions installées : `ai` 7.0.15, `@ai-sdk/mistral` 4.0.5,
`@mistralai/mistralai` 2.2.5, `elysia` 1.4.28, `better-auth` 1.6.23, `next` 16.3.5).
B aura monté ces versions : chaque tâche commence par relire le `.d.ts` cité dans la
version installée, et s'arrête si la signature a changé.

**Découpage proposé : deux PR.** Une seule PR ferait environ 90 fichiers, dont 53
touchés par le codemod du logger, et deviendrait impossible à relire.

- **E1 — appels IA** (`refactor/replace-custom-ai-calls`) : retry, timeout, SDK
  Mistral pour la voix, sorties structurées, télémétrie de l'AI SDK. Constats 1, 2, 9, 11, 12.
- **E2 — infra serveur et outillage** (`refactor/replace-custom-infra`) : code mort,
  validation, env, logger pino, rate limit, scripts, CI, landing. Constats 3 à 8, 10 et 13 à 20.

E1 passe en premier. E2 contient le codemod du logger, qui porte aussi sur les
lignes écrites par E1. Dans les deux PR, le code nouveau garde la forme de log
actuelle (`_error: x instanceof Error ? x.message : String(x)`), sauf après
la tâche E2.1, qui la rend obsolète.

---

## PR E1 — remplacer les appels IA faits à la main par l'AI SDK et le SDK Mistral

**Branche :** `refactor/replace-custom-ai-calls`

**Objectif :** que tout appel Mistral passe par l'AI SDK (texte, sorties
structurées, télémétrie) ou par `@mistralai/mistralai` (embeddings, voix), avec un
timeout qui annule vraiment la requête, sans retry empilé et avec l'usage réel.

**Fichiers :**
- Create : `apps/server/src/lib/ai/mistral-sdk.ts`,
  `src/tests/mistral-embeddings.test.ts`, `src/tests/voxtral-tts.service.test.ts`,
  `src/tests/card-generator.test.ts`, `src/tests/document-analysis.test.ts`,
  `src/tests/ai-telemetry.test.ts`, `src/live/structured-output.test.ts`
- Modify : `src/lib/ai/mistral-client.ts`, `src/services/mistral-embeddings.service.ts`,
  `src/services/voxtral-transcribe.service.ts`, `src/services/voxtral-tts.service.ts`,
  `src/services/text-to-speech.service.ts`, `src/routes/tts.routes.ts`,
  `src/services/learning/card-generator.service.ts`, `src/lib/ai/schemas/cards.schema.ts`,
  `src/lib/ai/schemas/cards-domain.schema.ts`, `src/services/chat/intent-classifier.service.ts`,
  `src/services/episodic-memory.service.ts`, `src/services/document/document-analysis.service.ts`,
  `src/services/document/document-types.ts`, `src/services/document/mistral-vision.ts`,
  `src/services/chat/ai-chat.service.ts`, `src/lib/otel/otel.ts`, `apps/server/package.json`,
  tests `mistral-client.test.ts`, `voxtral-transcribe.service.test.ts`,
  `intent-classifier.test.ts`, `intent-classifier-subject.test.ts`
- Delete : `src/lib/retry.ts`, `src/services/document/document-parsers.ts`,
  `src/tests/document-parsers.test.ts`, `src/lib/otel/spans.ts`, `src/lib/otel/index.ts`

Tous les chemins sont relatifs à `apps/server/` sauf mention contraire.

### Tâche E1.1 — client `@mistralai/mistralai` partagé, embeddings sans `withTimeout`

**Files:** Create `src/lib/ai/mistral-sdk.ts`, `src/tests/mistral-embeddings.test.ts` ;
Modify `src/services/mistral-embeddings.service.ts:8-45,55-62,95-102`.

**Interfaces:** Produces `getMistralSdk(): Mistral`. Consumes `new Mistral({ apiKey,
timeoutMs, serverURL? })` (`node_modules/@mistralai/mistralai/esm/lib/config.d.ts:15-34` :
`serverURL`, `timeoutMs`) ; `timeoutMs` pose `AbortSignal.timeout` sur la requête
(`esm/lib/sdks.js:116-117`) ; le SDK appelle `fetch(request)` au moment de l'appel
(`esm/lib/http.js:11-14`).

`withTimeout` (`lib/retry.ts:117-140`) fait un `Promise.race` : la promesse rejette,
mais la requête HTTP continue. Le test prouve que le signal est bien abandonné.

- [ ] Écrire `src/tests/mistral-embeddings.test.ts` :

```ts
import { describe, it, expect, mock, spyOn, afterEach } from 'bun:test';
import { createMockLogger } from './_helpers/mock-logger';

mock.module('../lib/observability', () => ({ logger: createMockLogger() }));
mock.module('../config/env', () => ({
  env: { MISTRAL_API_KEY: 'test-key', MISTRAL_EMBED_MODEL: 'mistral-embed', MISTRAL_TIMEOUT: 50 },
}));

const { mistralEmbeddingsService } = await import('../services/mistral-embeddings.service');

afterEach(() => mock.restore());

describe('mistralEmbeddingsService timeout', () => {
  it('aborts the underlying HTTP request when the timeout elapses', async () => {
    let captured: AbortSignal | undefined;
    spyOn(globalThis, 'fetch').mockImplementation(((input: Request) => {
      captured = input.signal;
      return new Promise((_, reject) => {
        input.signal.addEventListener('abort', () => reject(input.signal.reason));
      });
    }) as unknown as typeof fetch);

    await expect(mistralEmbeddingsService.embed('bonjour')).rejects.toThrow();
    expect(captured?.aborted).toBe(true);
  });
});
```

- [ ] `cd apps/server && bun test src/tests/mistral-embeddings.test.ts` : **FAIL**.
  Le délai de 30 s du code actuel dépasse le timeout de test de 5 s, et le signal
  n'est jamais abandonné.
- [ ] Créer `src/lib/ai/mistral-sdk.ts`. Avant d'écrire, lancer
  `grep -n "baseURL\|MISTRAL_.*URL" src/lib/ai/provider.ts src/config/env.ts`. Si C a
  introduit une URL de base UE pour `createMistral`, passer la même variable
  d'environnement à `serverURL`. Sinon, supprimer la ligne `serverURL`.

```ts
import { Mistral } from '@mistralai/mistralai';
import { env } from '../../config/env.js';

let client: Mistral | null = null;

export function getMistralSdk(): Mistral {
  if (!env.MISTRAL_API_KEY) throw new Error('MISTRAL_API_KEY is required');
  client ??= new Mistral({
    apiKey: env.MISTRAL_API_KEY,
    timeoutMs: env.MISTRAL_TIMEOUT,
    serverURL: env.MISTRAL_BASE_URL,
  });
  return client;
}
```

- [ ] Dans `mistral-embeddings.service.ts` : supprimer l'import `withTimeout`, les
  constantes `MISTRAL_API_KEY` et `MISTRAL_TIMEOUT_MS`, le champ `client` et
  `getClient()`. `embed` appelle alors
  `await getMistralSdk().embeddings.create({ model: EMBEDDING_MODEL, inputs: [text] })`,
  et `embedBatch` la même chose avec `inputs: texts`.
- [ ] `bun test src/tests/mistral-embeddings.test.ts` : PASS.
- [ ] Commit :
  `git add apps/server/src/lib/ai/mistral-sdk.ts`,
  `git add apps/server/src/services/mistral-embeddings.service.ts`,
  `git add apps/server/src/tests/mistral-embeddings.test.ts` ;
  `git commit -m "refactor(server): abort Mistral embedding requests via SDK timeoutMs" -m "Co-Authored-By: Claude <noreply@anthropic.com>"`

### Tâche E1.2 — transcription Voxtral via le SDK

**Files:** Modify `src/services/voxtral-transcribe.service.ts:1-116`,
`src/tests/voxtral-transcribe.service.test.ts`.

**Interfaces:** Consumes `getMistralSdk().audio.transcriptions.complete(request:
AudioTranscriptionRequest, options?: RequestOptions): Promise<TranscriptionResponse>`
(`esm/sdk/transcriptions.d.ts`). La requête prend `{ model, file?: FileT | Blob, language? }`,
avec `FileT = { fileName, content: Blob | ArrayBuffer | Uint8Array | ReadableStream }`
(`esm/models/components/audiotranscriptionrequest.d.ts:4-30`, `file.d.ts:2-5`).
La réponse est `{ model, text, language, usage }` (`transcriptionresponse.d.ts:6-13`).
Produces : aucun changement de `VoxtralTranscribeResult` ni de `transcribe()`.

Le `fetch` actuel (`voxtral-transcribe.service.ts:61-67`) n'a pas de timeout.

- [ ] Dans `voxtral-transcribe.service.test.ts`, ajouter `MISTRAL_TIMEOUT: 50` à l'env
  mocké, puis ajouter ce test :

```ts
it('aborts a hanging transcription request', async () => {
  let captured: AbortSignal | undefined;
  fetchSpy = spyOn(globalThis, 'fetch').mockImplementation(((input: Request) => {
    captured = input.signal;
    return new Promise((_, reject) => input.signal.addEventListener('abort', () => reject(input.signal.reason)));
  }) as unknown as typeof fetch);

  const result = await getVoxtralTranscribeService().transcribe(makeAudioBuffer(), 'audio/webm');

  expect(result.success).toBe(false);
  expect(captured?.aborted).toBe(true);
});
```

Les tests existants lisent `fetch(url, init)`. Le SDK, lui, appelle
`fetch(request)` : adapter leurs assertions pour lire `request.url` et
`await request.formData()`.
- [ ] `bun test src/tests/voxtral-transcribe.service.test.ts` : le nouveau test
  **échoue** (aucun signal, le test expire).
- [ ] Réécrire le service : supprimer `STT_ENDPOINT`, `apiKey` et le constructeur
  (la clé est vérifiée par `getMistralSdk`). Le cœur de `transcribe` devient :

```ts
const response = await getMistralSdk().audio.transcriptions.complete({
  model: STT_MODEL,
  file: { fileName: 'audio', content: new Blob([audioBuffer], { type: mimeType }) },
  language,
});
if (!response.text) {
  return { success: false, error: 'Voxtral STT returned empty transcription' };
}
return { success: true, transcription: response.text, detectedLanguage: language };
```

Garder le `try/catch` et les logs existants. Le bloc `!response.ok` disparaît :
le SDK lève une erreur, que le `catch` attrape.
- [ ] `bun test src/tests/voxtral-transcribe.service.test.ts` : PASS.
- [ ] Commit :
  `git add apps/server/src/services/voxtral-transcribe.service.ts`,
  `git add apps/server/src/tests/voxtral-transcribe.service.test.ts` ;
  `refactor(server): call Voxtral STT through the Mistral SDK`, suivi de la ligne Co-Authored-By.

### Tâche E1.3 — synthèse Voxtral via le SDK, `voice_id` corrigé, estimation de durée supprimée

**Files:** Modify `src/services/voxtral-tts.service.ts:1-160`,
`src/services/text-to-speech.service.ts:19,69`, `src/routes/tts.routes.ts:60,69` ;
Create `src/tests/voxtral-tts.service.test.ts`.

**Interfaces:** Consumes `getMistralSdk().audio.speech.complete(request: SpeechRequest &
{ stream?: false }, options?): Promise<SpeechResponse>`, avec `SpeechRequest = { model?,
voiceId?, input, responseFormat?: 'pcm'|'wav'|'mp3'|'flac'|'opus' }` et
`SpeechResponse = { audioData: string }` (`esm/sdk/speech.d.ts`,
`esm/models/components/speechrequest.d.ts`,
`esm/models/operations/speechv1audiospeechpost.d.ts:18-23`). La doc de l'API
(https://docs.mistral.ai/api/endpoint/audio/speech) nomme le champ `voice_id` et ne
documente aucun champ `language`. Produces : `VoxtralTTSResult` sans `durationMs`.

Trois constats :
- Le commentaire d'en-tête affirme que le SDK n'expose pas la synthèse. C'est faux
  en 2.2.5 : `esm/sdk/audio.d.ts` expose `speech`.
- Bug réel : le service envoie `voice` (`voxtral-tts.service.ts:99-104`), un champ
  inconnu de l'API. La voix choisie est donc ignorée.
- `language` n'est pas documenté. L'estimation de durée suppose un débit MP3 quel
  que soit le format (`:52,119`). Elle est supprimée plutôt que corrigée : le
  navigateur lit la durée réelle du média.

- [ ] Créer `src/tests/voxtral-tts.service.test.ts` :

```ts
import { describe, it, expect, mock, spyOn, afterEach } from 'bun:test';
import { createMockLogger } from './_helpers/mock-logger';

mock.module('../lib/observability', () => ({ logger: createMockLogger() }));
mock.module('../config/env', () => ({
  env: { MISTRAL_API_KEY: 'test-key', MISTRAL_TTS_MODEL: 'voxtral-tts-latest', MISTRAL_TIMEOUT: 5000 },
}));

const { getVoxtralTTSService } = await import('../services/voxtral-tts.service');

afterEach(() => mock.restore());

describe('VoxtralTTSService', () => {
  it('sends the chosen voice as voice_id and returns the base64 audio', async () => {
    let body: Record<string, unknown> = {};
    spyOn(globalThis, 'fetch').mockImplementation((async (input: Request) => {
      body = (await input.json()) as Record<string, unknown>;
      return new Response(JSON.stringify({ audio_data: 'QUJD' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }) as unknown as typeof fetch);

    const result = await getVoxtralTTSService().synthesize('Bonjour', { voiceId: 'casual_male' });

    expect(body['voice_id']).toBe('casual_male');
    expect(body['voice']).toBeUndefined();
    expect(result).toEqual({ success: true, audioData: 'QUJD', mimeType: 'audio/mpeg' });
  });
});
```

- [ ] `bun test src/tests/voxtral-tts.service.test.ts` : **FAIL** (`voice_id`
  undefined, et `durationMs` présent dans le résultat).
- [ ] Réécrire le service : supprimer `LANGUAGE_MAP`, `MP3_BYTES_PER_SECOND`,
  `baseUrl`, `apiKey`, `readAudio`, le champ `language` de `VoxtralTTSOptions` et
  `durationMs` de `VoxtralTTSResult`. Le cœur de `synthesize` devient :

```ts
const response = await getMistralSdk().audio.speech.complete({
  model: this.model,
  input: text,
  voiceId: voice,
  responseFormat: outputFormat,
});
logger.info('Voxtral TTS synthesis completed', {
  operation: 'voxtral:tts:complete',
  textLength: text.length,
  durationMs: Date.now() - startTime,
});
return { success: true, audioData: response.audioData, mimeType };
```

- [ ] Supprimer `durationMs` de `TTSResult` et du retour (`text-to-speech.service.ts:19,69`),
  puis `audioDurationMs` et `durationMs: result.durationMs` dans `tts.routes.ts:60,69`.
  Enfin, `grep -rn "language:" src/services/text-to-speech.service.ts` : retirer
  l'option `language` passée au service Voxtral.
- [ ] Vérification (non automatisable, clé réelle) : lancer
  `bun -e "import('./src/lib/ai/mistral-sdk.ts').then(async m => console.log((await m.getMistralSdk().audio.voices.list()).items?.map(v => v.id ?? v.name)))"`
  et confirmer que `casual_male` figure dans la liste. Sinon, mettre dans
  `DEFAULT_VOICE` l'identifiant d'une voix française de la liste.
- [ ] `bun test src/tests/voxtral-tts.service.test.ts && bun run typecheck` : PASS, exit 0.
- [ ] Commit, un `git add` par fichier : `voxtral-tts.service.ts`, `text-to-speech.service.ts`,
  `tts.routes.ts`, `voxtral-tts.service.test.ts` ;
  `fix(server): send voice_id to Voxtral TTS through the Mistral SDK`, suivi de la ligne Co-Authored-By.

### Tâche E1.4 — `generateStructured` : Zod, `Output.object`, mode strict, une relance

**Files:** Modify `src/lib/ai/mistral-client.ts:15,58-63,85-98,145-192`,
`src/tests/mistral-client.test.ts:82-130`.

**Interfaces:**
- Consumes, dans `ai/dist/index.d.ts` :
  - `generateText({ output })` et `GenerateTextResult.output` (lignes ~4817 et ~4577) ;
  - `Output.object({ schema, name, description })` (ligne 3798) ;
  - `NoObjectGeneratedError.isInstance`, qui expose `text`, `cause` et `usage`
    (lignes 6686-6709) ;
  - `TypeValidationError`, réexporté depuis `@ai-sdk/provider` ;
  - `LanguageModelUsage.inputTokens` et `outputTokens` (ligne 321) ;
  - `generateObject`, marqué `@deprecated Use generateText with an output setting
    instead` (ligne 7213).
- Option de fournisseur `strictJsonSchema` : `@ai-sdk/mistral/dist/index.d.ts:11`.
  Elle vaut `false` par défaut (`index.js:450`) et devient `json_schema.strict`
  (`index.js:470-474`).
- Produces :

```ts
export interface StructuredUsage { inputTokens: number; outputTokens: number }
export interface StructuredResult<T> { object: T; usage: StructuredUsage }
export async function generateStructured<T>(opts: GenerateStructuredOptions<T>): Promise<StructuredResult<T>>
interface GenerateStructuredOptions<T> extends GenerateTextOptions {
  schema: z.ZodType<T>;
  schemaName: string;
}
```

**Avant d'éditer :** C a modifié ce fichier (modèles, clé de cache, `reasoningEffort`).
Lire l'état post-C et **conserver tel quel** ce que C a mis dans l'appel
`mistralProvider(...)`, le choix de `model` et `providerOptions.mistral`. E1.4 ne
change que la sortie structurée.

- [ ] Remplacer le `describe('generateStructured')` de `mistral-client.test.ts` par :

```ts
describe('generateStructured', () => {
  const schema = z.object({ intent: z.enum(['explain-concept', 'chit-chat']) });

  it('returns the validated object and the real usage', async () => {
    const capture: { body?: Record<string, unknown> } = {};
    mockFetchJson(capture, chatCompletion(JSON.stringify({ intent: 'explain-concept' })));

    const result = await generateStructured({ messages: [{ role: 'user', content: 'classe' }], schema, schemaName: 'intent' });

    expect(result).toEqual({ object: { intent: 'explain-concept' }, usage: { inputTokens: 10, outputTokens: 5 } });
    const wire = (capture.body?.['response_format'] as Record<string, unknown>)['json_schema'] as Record<string, unknown>;
    expect(wire['strict']).toBe(true);
    expect(wire['name']).toBe('intent');
  });

  it('retries once with the validation error, then succeeds', async () => {
    const bodies: Array<Record<string, unknown>> = [];
    const replies = [JSON.stringify({ intent: 'nope' }), JSON.stringify({ intent: 'chit-chat' })];
    globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
      bodies.push(JSON.parse(init?.body as string) as Record<string, unknown>);
      return new Response(JSON.stringify(chatCompletion(replies[bodies.length - 1] ?? '')), {
        status: 200, headers: { 'content-type': 'application/json' },
      });
    }) as unknown as typeof fetch;

    const result = await generateStructured({ messages: [{ role: 'user', content: 'salut' }], schema, schemaName: 'intent' });

    expect(result.object).toEqual({ intent: 'chit-chat' });
    expect(result.usage).toEqual({ inputTokens: 20, outputTokens: 10 });
    const retryMessages = bodies[1]?.['messages'] as Array<{ role: string; content: unknown }>;
    expect(JSON.stringify(retryMessages.at(-1)?.content)).toContain('schéma');
  });

  it('does not retry twice', async () => {
    let calls = 0;
    globalThis.fetch = (async () => {
      calls += 1;
      return new Response(JSON.stringify(chatCompletion(JSON.stringify({ intent: 'nope' }))), {
        status: 200, headers: { 'content-type': 'application/json' },
      });
    }) as unknown as typeof fetch;

    await expect(generateStructured({ messages: [{ role: 'user', content: 'x' }], schema, schemaName: 'intent' })).rejects.toThrow();
    expect(calls).toBe(2);
  });
});
```

(ajouter `import { z } from 'zod';` en tête du fichier).
- [ ] `bun test src/tests/mistral-client.test.ts` : **FAIL** (l'ancienne signature
  attend un wrapper JSON Schema et renvoie l'objet nu).
- [ ] Dans `mistral-client.ts`, remplacer l'import de la ligne 15 par
  `import { generateText as aiGenerateText, Output, NoObjectGeneratedError, TypeValidationError, type ModelMessage, type TextPart, type FilePart } from 'ai';`,
  ajouter `import type { z } from 'zod';`, supprimer `extractJsonSchema` et
  réécrire `generateStructured` :

```ts
export async function generateStructured<T>(opts: GenerateStructuredOptions<T>): Promise<StructuredResult<T>> {
  if (!env.MISTRAL_API_KEY) throw new Error('Mistral non configuré');

  const model = opts.model ?? env.MISTRAL_MODEL;
  const call = (messages: ModelMessage[]) =>
    aiGenerateText({
      model: mistralProvider(opts.promptCacheKey)(model),
      messages,
      allowSystemInMessages: true,
      output: Output.object({ schema: opts.schema, name: opts.schemaName }),
      temperature: opts.temperature ?? env.MISTRAL_TEMPERATURE,
      maxOutputTokens: opts.maxTokens ?? env.MISTRAL_MAX_TOKENS,
      maxRetries: env.MISTRAL_RETRY_ATTEMPTS,
      abortSignal: AbortSignal.timeout(opts.timeoutMs ?? env.MISTRAL_TIMEOUT),
      providerOptions: { mistral: { safePrompt: true, strictJsonSchema: true } },
    });

  const messages = toModelMessages(opts.messages);
  try {
    const result = await call(messages);
    return { object: result.output, usage: toUsage(result.usage) };
  } catch (error) {
    if (!NoObjectGeneratedError.isInstance(error) || !TypeValidationError.isInstance(error.cause)) throw error;
    const retry = await call([
      ...messages,
      { role: 'assistant', content: error.text ?? '' },
      { role: 'user', content: `Ta réponse ne respecte pas le schéma attendu : ${error.cause.message}. Renvoie un JSON corrigé.` },
    ]);
    const first = toUsage(error.usage);
    const second = toUsage(retry.usage);
    return {
      object: retry.output,
      usage: { inputTokens: first.inputTokens + second.inputTokens, outputTokens: first.outputTokens + second.outputTokens },
    };
  }
}

function toUsage(usage: { inputTokens: number | undefined; outputTokens: number | undefined } | undefined): StructuredUsage {
  return { inputTokens: usage?.inputTokens ?? 0, outputTokens: usage?.outputTokens ?? 0 };
}
```

Si `NoObjectGeneratedError` n'est pas levée pendant `await call(...)` mais à la
lecture de `result.output`, rien ne change : les deux sont dans le `try`. Le
deuxième test le vérifie.
- [ ] `bun test src/tests/mistral-client.test.ts` : PASS. `bun run typecheck` : les
  trois appelants cassent. C'est attendu, E1.5 à E1.7 les corrigent.
- [ ] Pas de commit isolé : le typecheck est rouge. Le commit se fait à la fin de E1.5.

### Tâche E1.5 — classifieur d'intention et mémoire épisodique en schémas Zod

**Files:** Modify `src/services/chat/intent-classifier.service.ts:48-75,117-133`,
`src/services/episodic-memory.service.ts:38-42,63-82,122-137`,
`src/tests/intent-classifier.test.ts:33-49`, `src/tests/intent-classifier-subject.test.ts:31`.

**Interfaces:** Consumes `generateStructured<T>` (E1.4). `ClassifiedIntent` et
`extractAndStore` sont inchangés.

- [ ] Dans les deux tests du classifieur, le mock doit renvoyer
  `{ object: mockStructuredResponse, usage: { inputTokens: 0, outputTokens: 0 } }` au
  lieu de l'objet nu. Lancer
  `bun test src/tests/intent-classifier.test.ts src/tests/intent-classifier-subject.test.ts` :
  **FAIL** (le service lit `parsed.intent` sur l'enveloppe).
- [ ] Classifieur : typer `ALLOWED_INTENTS` en
  `['solve-this-for-me', 'check-my-answer', 'explain-concept', 'clarify-question', 'chit-chat', 'unknown'] as const satisfies readonly StudentIntent[]`,
  puis remplacer `RESPONSE_SCHEMA` par :

```ts
const IntentSchema = z.object({
  intent: z.enum(ALLOWED_INTENTS),
  confidence: z.enum(['low', 'medium', 'high']),
  subject: z.enum(STUDENT_SUBJECTS),
});
```

L'appel devient :

```ts
const { object } = await generateStructured({
  model: env.MISTRAL_MODEL_CLASSIFY,
  messages: [{ role: 'user', content: buildPrompt(trimmed, schoolLevel) }],
  temperature: 0,
  maxTokens: 96,
  schema: IntentSchema,
  schemaName: 'intent_classification',
  promptCacheKey: INTENT_CACHE_KEY,
  timeoutMs: 8_000,
});
const { intent, confidence, subject } = object;
```

Les trois contrôles manuels des lignes 127-135 sont supprimés : le schéma les garantit.
Si `STUDENT_SUBJECTS` n'est pas un tuple `as const`, `z.enum` le refuse au
typecheck. Dans ce cas, ajouter `as const` à sa déclaration dans
`config/prompts/adaptation/subjects.ts:1`.
- [ ] Mémoire épisodique : remplacer `ExtractedEpisode` et `EXTRACTION_SCHEMA` par :

```ts
const EpisodeSchema = z.object({
  summary: z.string().min(1),
  conceptsCovered: z.array(z.string().min(1)).max(6),
  outcome: z.enum(['completed', 'abandoned', 'succeeded']),
});
```

L'appel devient
`const { object: parsed } = await generateStructured({ ..., schema: EpisodeSchema, schemaName: 'episode_extraction' })`.
Supprimer le garde `if (!parsed.summary || !Array.isArray(...))` : le schéma
l'assure. Ajouter `import { z } from 'zod';`.
- [ ] `bun test src/tests/intent-classifier.test.ts src/tests/intent-classifier-subject.test.ts` : PASS.
- [ ] Commit, un `git add` par fichier : `mistral-client.ts`, `mistral-client.test.ts`,
  `intent-classifier.service.ts`, `episodic-memory.service.ts`, les deux tests du
  classifieur. Message : `refactor(server): generate structured outputs with Output.object and Zod`,
  suivi de la ligne Co-Authored-By. `bun run typecheck` n'est vert qu'après E1.6 : si
  le hook pre-commit bloque, enchaîner E1.6 et committer les deux tâches ensemble.

### Tâche E1.6 — générateur de cartes : schéma Zod unique, `maxRetries` seul, usage réel ; suppression de `lib/retry.ts`

**Files:** Modify `src/services/learning/card-generator.service.ts:40,61-123,225-255`,
`src/lib/ai/schemas/cards.schema.ts:36-39,106-108`,
`src/lib/ai/schemas/cards-domain.schema.ts:15-18` ; Create `src/tests/card-generator.test.ts` ;
Delete `src/lib/retry.ts`.

**Interfaces:** Consumes `generateStructured` (E1.4). La valeur par défaut de
`maxRetries` est 2 (`ai/dist/index.d.ts:631-637`). Une erreur 4xx est une
`APICallError` avec `isRetryable: false` (`@ai-sdk/provider/dist/index.d.ts:679-690`).
Le SDK ne la relance pas, alors que `withRetry` la relançait : sa détection par
sous-chaîne (`retry.ts:66-68`) ne reconnaît que les messages contenant `INVALID_`.
Produces : `CardGenerationResult.tokensUsed` = tokens d'entrée + tokens de sortie.

Constat vérifié : `withRetry` (3 tentatives) entoure un appel qui a déjà
`maxRetries: env.MISTRAL_RETRY_ATTEMPTS` (3 par défaut, `config/env.ts:85`).
Une panne provoque donc jusqu'à 3 × 4 = 12 appels. L'usage est estimé par
`JSON.stringify(parsed).length / 4` (`:241`), et un JSON Schema écrit à la main
(`:91-123`, `strict: false`) double le Zod de `cards.schema.ts`.

Le Zod contient `z.preprocess` (`coerceIndex`). L'AI SDK convertit le schéma avec
`z4.toJSONSchema(..., { io: "input" })` (`@ai-sdk/provider-utils/dist/index.js:2653-2657`),
et une transformation n'a pas de représentation côté entrée. La conversion
échouerait. `coerceIndex` tolérait un `[0]` renvoyé par le modèle, ce que le mode
strict empêche : on le remplace par `z.number().int().min(0)`.

- [ ] Créer `src/tests/card-generator.test.ts` :

```ts
import './_helpers/mistral-env';
import { describe, it, expect, afterEach } from 'bun:test';
import { generateCards, isGenerationError } from '../services/learning/card-generator.service';

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

const params = { topic: 'Pythagore', subject: 'mathematiques', level: 'quatrieme', cardCount: 1 } as const;

function completion(content: string) {
  return {
    id: 'c', object: 'chat.completion', created: 0, model: 'm',
    choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
    usage: { prompt_tokens: 100, completion_tokens: 40, total_tokens: 140 },
  };
}

describe('generateCards', () => {
  it('reports the real token usage from the API', async () => {
    const cards = { cards: [{ cardType: 'flashcard', content: { front: 'a² + b² ?', back: 'c²' } }] };
    globalThis.fetch = (async () => new Response(JSON.stringify(completion(JSON.stringify(cards))), {
      status: 200, headers: { 'content-type': 'application/json' },
    })) as unknown as typeof fetch;

    const result = await generateCards(params);

    if (isGenerationError(result)) throw new Error(result.error);
    expect(result.tokensUsed).toBe(140);
  });

  it('does not retry a non-retryable 400', async () => {
    let calls = 0;
    globalThis.fetch = (async () => {
      calls += 1;
      return new Response(JSON.stringify({ message: 'bad request' }), { status: 400, headers: { 'content-type': 'application/json' } });
    }) as unknown as typeof fetch;

    const result = await generateCards(params);

    expect(isGenerationError(result)).toBe(true);
    expect(calls).toBe(1);
  }, 15_000);
});
```

Si le type de `params` ne satisfait pas `CardGenerationParams` (`services/learning/types.ts`),
reprendre les valeurs exactes de ce type.
- [ ] `bun test src/tests/card-generator.test.ts` : **FAIL**. On attend
  `tokensUsed` ≠ 140 et `calls` = 3 (les trois tentatives de `withRetry`).
- [ ] Dans `cards.schema.ts` et `cards-domain.schema.ts`, remplacer
  `const coerceIndex = z.preprocess(...)` par `const coerceIndex = z.number().int().min(0);`.
  Dans `cards.schema.ts`, ajouter
  `export const CardGenerationSchema = z.object({ cards: CardGenerationOutputSchema });`
  et l'exporter depuis `lib/ai/schemas/index.ts`.
- [ ] Dans `card-generator.service.ts` : supprimer l'import `withRetry`,
  `cardGenerationSchema` (`:73-123`), l'import `CardGenerationOutputSchema` et le
  bloc `safeParse` (`:257-281`). Remplacer `:229-255` par :

```ts
const { object, usage } = await generateStructured({
  model: env.MISTRAL_MODEL_LIGHT,
  messages: [{ role: 'user', content: prompt }],
  temperature: 0.7,
  maxTokens: 4096,
  schema: CardGenerationSchema,
  schemaName: 'card_generation',
  promptCacheKey: CARD_GENERATOR_CACHE_KEY,
});
const cards = object.cards as ParsedCard[];
const tokensUsed = usage.inputTokens + usage.outputTokens;
```

Une erreur de validation qui persiste après la relance est une
`NoObjectGeneratedError` : ajouter au début du `catch` (`:304`) :
`if (NoObjectGeneratedError.isInstance(error)) return { success: false, error: 'Cartes invalides', code: 'INVALID_OUTPUT' };`
(importer `NoObjectGeneratedError` depuis `ai`).
- [ ] Preuve que `lib/retry.ts` n'a plus de consommateur :
  `grep -rn "lib/retry\|withRetry\|withTimeout" src` doit être vide. Ensuite
  `git rm apps/server/src/lib/retry.ts`.
- [ ] `bun test src/tests/card-generator.test.ts && bun run typecheck` : PASS, exit 0.
- [ ] Commit, un `git add` par fichier (service, deux schémas, `schemas/index.ts`,
  test), plus le `git rm` ; message `refactor(server): drop withRetry and estimated tokens in card generation`,
  suivi de la ligne Co-Authored-By.

### Tâche E1.7 — analyse de document en sortie structurée ; suppression de `document-parsers.ts`

**Files:** Modify `src/services/document/document-analysis.service.ts:29-33,207-268`,
`src/services/document/document-types.ts:12-21` ; Create `src/tests/document-analysis.test.ts` ;
Delete `src/services/document/document-parsers.ts`, `src/tests/document-parsers.test.ts`.

**Interfaces:** Consumes `generateStructured` (E1.4). Produces : `DocumentAnalysisResult`
inchangé pour les consommateurs (`chat/file-context.service.ts:172,179`), avec
`metrics.tokensUsed` réel au lieu de `0`.

Constat vérifié : le JSON est extrait d'un bloc de code par regex
(`document-parsers.ts:11,50`). En cas d'échec, la réponse brute devient
`analysis` avec une classification inventée (`document`/`inconnu`/`low`),
sans aucun signal (`:27-41`).

Nouveau schéma, qui remplace `ClassificationSchema` dans `document-types.ts`.
`detectedLevel` peut manquer dans la source : nullable. L'analyse d'image ajoute
`extractedText`. La taxonomie des matières reste celle d'aujourd'hui, le lot 2 l'unifie.

```ts
export const ClassificationSchema = z.object({
  documentType: z.enum(['exercice', 'cours', 'devoir', 'correction', 'document', 'non-educatif']),
  subject: z.enum(['mathematiques', 'francais', 'anglais', 'espagnol', 'allemand', 'histoire', 'geographie', 'emc', 'svt', 'physique-chimie', 'technologie', 'inconnu']),
  confidence: z.enum(['high', 'medium', 'low']),
  detectedLevel: z.string().nullable(),
});
export const DocumentAnalysisSchema = z.object({ classification: ClassificationSchema, analysis: z.string().min(1) });
export const ImageAnalysisSchema = DocumentAnalysisSchema.extend({ extractedText: z.string() });
```

- [ ] Créer `src/tests/document-analysis.test.ts` :

```ts
import './_helpers/mistral-env';
import { describe, it, expect, afterEach, mock } from 'bun:test';

mock.module('../services/document/document-extraction.service', () => ({
  documentExtractionService: {
    extractText: async () => ({ success: true, text: 'Exercice 1 : calculer 3 + 4.', metadata: { wordCount: 5, extractionMethod: 'pdf' } }),
  },
}));

const { documentAnalysisService } = await import('../services/document/document-analysis.service');
const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

function reply(content: string) {
  globalThis.fetch = (async () => new Response(JSON.stringify({
    id: 'c', object: 'chat.completion', created: 0, model: 'm',
    choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
    usage: { prompt_tokens: 50, completion_tokens: 20, total_tokens: 70 },
  }), { status: 200, headers: { 'content-type': 'application/json' } })) as unknown as typeof fetch;
}

const options = { schoolLevel: 'sixieme', userId: 'u1' } as const;

describe('documentAnalysisService.analyzeDocument', () => {
  it('returns the structured classification and the real usage', async () => {
    reply(JSON.stringify({
      classification: { documentType: 'exercice', subject: 'mathematiques', confidence: 'high', detectedLevel: null },
      analysis: 'Un exercice d’addition.',
    }));
    const result = await documentAnalysisService.analyzeDocument(new ArrayBuffer(8), 'a.pdf', 'application/pdf', options);
    expect(result.success).toBe(true);
    expect(result.classification.documentType).toBe('exercice');
    expect(result.metrics.tokensUsed).toBe(70);
  });

  it('fails explicitly instead of inventing a classification when the output is not JSON', async () => {
    reply('Voici mon analyse sans JSON.');
    const result = await documentAnalysisService.analyzeDocument(new ArrayBuffer(8), 'a.pdf', 'application/pdf', options);
    expect(result.success).toBe(false);
  });
});
```

- [ ] `bun test src/tests/document-analysis.test.ts` : **FAIL**. On attend
  `tokensUsed` = 0 dans le premier test, et `success` = true avec la réponse brute
  dans le second.
- [ ] Dans `document-analysis.service.ts` : `analyzeText` et `analyzeImageWithVision`
  appellent
  `generateStructured({ ..., schema: DocumentAnalysisSchema, schemaName: 'document_analysis' })`,
  respectivement `ImageAnalysisSchema` et `'image_analysis'`, avec les mêmes
  `model`, `temperature`, `maxTokens`, `promptCacheKey` et `timeoutMs`. Elles
  renvoient `{ ...object, tokensUsed: usage.inputTokens + usage.outputTokens }`.
  `metrics.tokensUsed` reprend cette valeur (`:122,189`). Déplacer
  `createErrorResult` (`document-parsers.ts:85-111`) tel quel en fonction locale du
  service. Supprimer l'import de `document-parsers.js`. Dans
  `document-prompts.ts`, retirer la consigne de format JSON en bloc de code si elle
  existe (`grep -n "json" src/services/document/document-prompts.ts`) : le schéma
  porte désormais le format.
- [ ] Preuve : `grep -rn "document-parsers\|parseAnalysisResponse\|parseImageAnalysisResponse" src`
  ne doit plus renvoyer que le service et le test supprimés. Ensuite
  `git rm apps/server/src/services/document/document-parsers.ts apps/server/src/tests/document-parsers.test.ts`.
- [ ] `bun test src/tests/document-analysis.test.ts && bun run typecheck` : PASS, exit 0.
- [ ] Commit, un `git add` par fichier plus le `git rm` ;
  `refactor(server): analyse documents with a strict structured output`, suivi de la ligne Co-Authored-By.

### Tâche E1.8 — télémétrie : intégration `@ai-sdk/otel`, suppression des spans manuels

**Files:** Modify `src/lib/otel/otel.ts:19-33,102`, `src/lib/ai/mistral-client.ts:18,105-143`
et `generateStructured`, `src/services/document/mistral-vision.ts:11,47-65`,
`src/services/chat/ai-chat.service.ts:313-316`, `package.json` ;
Create `src/tests/ai-telemetry.test.ts` ; Delete `src/lib/otel/spans.ts`, `src/lib/otel/index.ts`.

**Interfaces:**
- Consumes, dans `ai/dist/index.d.ts` :
  - `registerTelemetry(...integrations: Telemetry[])` (ligne 8580) ;
  - `TelemetryOptions { isEnabled, recordInputs, recordOutputs, functionId }`
    (lignes 931-979) ;
  - l'option `telemetry` de `generateText` et `streamText`. `experimental_telemetry`
    est dépréciée : « Use `telemetry` instead » (lignes ~4836-4842).
- Doc https://ai-sdk.dev/docs/ai-sdk-core/telemetry : l'intégration OpenTelemetry vient
  de `@ai-sdk/otel` et s'enregistre avec `registerTelemetry(new OpenTelemetry())`. La
  télémétrie est active par défaut dès qu'une intégration est enregistrée.
- `@ai-sdk/otel` 1.0.109 exporte `OpenTelemetry` (`constructor(options?: { tracer?: Tracer, ... })`,
  `dist/index.d.ts:13-65`). Il émet les attributs GenAI de la semconv, dont
  `gen_ai.usage.cache_read.input_tokens` et `gen_ai.input.messages`. Il dépend de
  `ai` **en version exacte** (`npm view @ai-sdk/otel@1.0.109 dependencies` →
  `ai: '7.0.109'`).

Constats vérifiés :
- la vision passe deux fois dans `withGenAiSpan` (`mistral-vision.ts:47` puis
  `mistral-client.ts:113`) ;
- le chat déclare `telemetry: { isEnabled: true }` (`ai-chat.service.ts:313`), mais
  aucune intégration n'est enregistrée, donc aucun span n'est émis ;
- `recordInputs` vaut `true` par défaut. Enregistrer l'intégration sans le couper
  enverrait les messages d'élèves mineurs vers l'exporteur OTLP. `spans.ts:12-14`
  les excluait volontairement.

- [ ] Installer la version de `@ai-sdk/otel` qui correspond à `ai`. Lancer
  `node -p "require('./node_modules/ai/package.json').version"`, puis
  `npm view @ai-sdk/otel versions --json`, et choisir la version `V` telle que
  `npm view @ai-sdk/otel@V dependencies.ai` renvoie exactement la version installée.
  Ensuite `pnpm --filter tomai-server add @ai-sdk/otel@V`. Si aucune version ne
  correspond, s'arrêter et le signaler : on éviterait deux copies de `ai`.
- [ ] Créer `src/tests/ai-telemetry.test.ts` :

```ts
import './_helpers/mistral-env';
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { registerTelemetry } from 'ai';
import { MockLanguageModelV4, simulateReadableStream } from 'ai/test';
import { OpenTelemetry } from '@ai-sdk/otel';
import { BasicTracerProvider, InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { generateText } from '../lib/ai/mistral-client';
import { streamChat } from '../services/chat/ai-chat.service';

const exporter = new InMemorySpanExporter();
const provider = new BasicTracerProvider({ spanProcessors: [new SimpleSpanProcessor(exporter)] });
registerTelemetry(new OpenTelemetry({ tracer: provider.getTracer('test') }));

const originalFetch = globalThis.fetch;
beforeEach(() => exporter.reset());
afterEach(() => { globalThis.fetch = originalFetch; });

function genAiSpans() {
  return exporter.getFinishedSpans().filter((s) => s.attributes['gen_ai.operation.name'] !== undefined);
}

describe('AI SDK telemetry', () => {
  it('emits GenAI spans for generateText without recording prompts or outputs', async () => {
    globalThis.fetch = (async () => new Response(JSON.stringify({
      id: 'c', object: 'chat.completion', created: 0, model: 'm',
      choices: [{ index: 0, message: { role: 'assistant', content: 'ok' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    }), { status: 200, headers: { 'content-type': 'application/json' } })) as unknown as typeof fetch;

    await generateText({ messages: [{ role: 'user', content: 'mon prénom est Léa' }] });

    const spans = genAiSpans();
    expect(spans.length).toBeGreaterThan(0);
    for (const span of spans) {
      expect(span.attributes['gen_ai.input.messages']).toBeUndefined();
      expect(span.attributes['gen_ai.output.messages']).toBeUndefined();
    }
  });

  it('emits GenAI spans for the chat stream without recording messages', async () => {
    const model = new MockLanguageModelV4({
      doStream: async () => ({
        stream: simulateReadableStream({
          chunkDelayInMs: 0, initialDelayInMs: 0,
          chunks: [
            { type: 'stream-start', warnings: [] },
            { type: 'finish', usage: { inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined }, outputTokens: { total: 1, text: 1, reasoning: undefined } }, finishReason: { unified: 'stop', raw: undefined } },
          ],
        }),
      }),
    });

    const result = streamChat({
      userId: 'u', sessionId: 's', content: 'mon prénom est Léa', schoolLevel: 'troisieme',
      userRole: 'student', conversationHistory: [], tools: {}, model,
    });
    await result.text;

    const spans = genAiSpans();
    expect(spans.length).toBeGreaterThan(0);
    for (const span of spans) expect(span.attributes['gen_ai.input.messages']).toBeUndefined();
  });
});
```

- [ ] `bun test src/tests/ai-telemetry.test.ts` : **FAIL**. `gen_ai.input.messages`
  est présent, puisque `recordInputs` vaut `true` par défaut.
- [ ] Dans `otel.ts`, après `sdk.start();` (`:102`), ajouter
  `registerTelemetry(new OpenTelemetry());` avec les imports
  `import { registerTelemetry } from 'ai';` et `import { OpenTelemetry } from '@ai-sdk/otel';`.
  Mettre à jour la ligne 14-16 du commentaire d'en-tête, qui renvoie à `spans.ts`.
- [ ] Dans `mistral-client.ts` : supprimer l'import `withGenAiSpan` et les deux
  enveloppes. Ajouter à chaque appel `aiGenerateText` :
  `telemetry: { functionId: opts.functionId, recordInputs: false, recordOutputs: false },`,
  puis ajouter `functionId: string` à `GenerateTextOptions`. Passer un `functionId`
  explicite à chaque appelant : `grep -rn "generateText(\|generateStructured(" src/services src/lib`.
  Valeurs : `'auto-title'`, `'summarization'`, `'document-analysis'`,
  `'image-analysis'`, `'vision-ocr'`, `'intent-classifier'`, `'episodic-extraction'`,
  `'card-generation'`, et une valeur par fichier pour tout appelant non listé.
- [ ] `mistral-vision.ts` : supprimer l'import `withGenAiSpan` et l'enveloppe
  (`:47-65`) : `const extractedText = await generateText({ ..., functionId: 'vision-ocr' });`.
- [ ] `ai-chat.service.ts:313-316` : `telemetry: { functionId: 'chat-stream', recordInputs: false, recordOutputs: false },`
  (`isEnabled` est retiré : c'est la valeur par défaut).
- [ ] Preuve : `grep -rn "withGenAiSpan\|lib/otel/index\|otel/spans" src` doit être vide.
  Ensuite `git rm apps/server/src/lib/otel/spans.ts apps/server/src/lib/otel/index.ts`.
- [ ] `bun test src/tests/ai-telemetry.test.ts && bun run typecheck` : PASS, exit 0.
- [ ] Commit, un `git add` par fichier (`otel.ts`, `mistral-client.ts`, `mistral-vision.ts`,
  `ai-chat.service.ts`, chaque appelant touché, `package.json`, `pnpm-lock.yaml` à la
  racine, le test) plus le `git rm` ; message
  `refactor(server): trace AI calls with @ai-sdk/otel without recording messages`,
  suivi de la ligne Co-Authored-By.

### Tâche E1.9 — preuve sur l'API réelle du mode strict, puis validation de fin de PR

**Files:** Create `src/live/structured-output.test.ts`.

La doc Mistral des sorties structurées ne donne pas la liste des mots-clés JSON
Schema acceptés en mode strict (`oneOf`/`anyOf` d'une union discriminée,
propriétés optionnelles, `minItems`, `format: uri`). Je n'ai pas pu vérifier ce
point : ni https://docs.mistral.ai/studio/conversations/structured-output/custom
ni la page capabilities ne le documentent. On le prouve donc sur l'API réelle.

- [ ] Créer `src/live/structured-output.test.ts` :

```ts
import { describe, it, expect } from 'bun:test';
import { generateStructured } from '../lib/ai/mistral-client';
import { CardGenerationSchema } from '../lib/ai/schemas';
import { DocumentAnalysisSchema } from '../services/document/document-types';
import { env } from '../config/env';

describe('Mistral strict json_schema accepts our schemas', () => {
  it('card generation (discriminated union, optional fields)', async () => {
    const { object, usage } = await generateStructured({
      model: env.MISTRAL_MODEL_LIGHT,
      messages: [{ role: 'user', content: 'Génère 2 cartes de révision sur le théorème de Pythagore, niveau 4e.' }],
      schema: CardGenerationSchema, schemaName: 'card_generation', functionId: 'live-cards', maxTokens: 2048,
    });
    expect(object.cards.length).toBeGreaterThan(0);
    expect(usage.outputTokens).toBeGreaterThan(0);
  }, 60_000);

  it('document analysis (nullable field)', async () => {
    const { object } = await generateStructured({
      model: env.MISTRAL_MODEL,
      messages: [{ role: 'user', content: 'Classe ce document : « Exercice 1 : résoudre 2x + 3 = 7 ».' }],
      schema: DocumentAnalysisSchema, schemaName: 'document_analysis', functionId: 'live-doc', maxTokens: 512,
    });
    expect(object.classification.subject).toBe('mathematiques');
  }, 60_000);
});
```

- [ ] `cd apps/server && bun run test:live` avec une vraie `MISTRAL_API_KEY` : les
  deux tests doivent passer. Si l'API répond 400 sur le schéma des cartes, le mode
  strict n'accepte pas l'union. Dans ce cas, garder `strictJsonSchema: true` partout
  sauf pour les cartes : ajouter
  `strict?: boolean` (défaut `true`) à `GenerateStructuredOptions`, passer
  `strict: false` dans `card-generator.service.ts`, et écrire le motif et le corps
  de l'erreur 400 dans le message de commit. La validation Zod côté serveur reste
  en place dans tous les cas.
- [ ] Commit : `git add apps/server/src/live/structured-output.test.ts` ;
  `test(server): prove strict structured outputs against the Mistral API`, suivi de la ligne Co-Authored-By.
- [ ] Validation de fin de PR, à la racine : `pnpm typecheck && pnpm lint && pnpm test`,
  puis `cd apps/server && bun run test:integration`. Lire les codes de sortie : tous
  doivent valoir 0. `api-endpoints.test.ts` ne mocke ni `lib/otel` ni `lib/retry`
  (`grep -n "otel\|retry" src/integration-tests/api-endpoints.test.ts`). Si un mock de
  module supprimé y figure, le retirer.

---

## PR E2 — supprimer le code mort de l'infra serveur et remplacer l'outillage maison

> **À réécrire au démarrage d'E2.**
>
> Le plan ci-dessous a été écrit avant le merge des PR C et D et a dérivé (audit du
> 2026-09-22 sur `main` @ 17e8326). Il se réécrit contre `main` à jour avant la
> première tâche (`.claude/rules/plans-and-agents.md`). Écarts vérifiés :
>
> - **Déjà faites** : E2.5 (`apps/server/scripts/` supprimé en `ed4c2be`, PR A) et E2.12
>   (`.npmrc` supprimé en `0bb738e`). La liste « Fichiers » les supprime encore.
> - **Cassées** :
>   - E2.6 — depuis D, `onError({ as: 'global' })` de
>     `src/middleware/error-handler.middleware.ts` répond **400**
>     `{ error: { code: 'VALIDATION_ERROR', message }, requestId }` sur `VALIDATION` et
>     `PARSE` : la note de contrat « 422 d'Elysia » est fausse. Le mock de
>     `rate-limit-ordering.test.ts` vise `../middleware/auth.middleware`, pas
>     `../lib/auth-macro`. `validation.ts` exporte 11 schémas et 2 fonctions. Numéros de
>     ligne de `parent.routes.ts` décalés.
>   - E2.7 — les lignes 91-94 de `env.ts` sont désormais les modèles Mistral. Viser les
>     noms : bloc `Rate limiting` (`RATE_LIMIT_*`), `DEBUG`, `POSTHOG_API_KEY`. Ajouter
>     `TRUSTED_ORIGINS`, lue par aucun fichier de `src/` (seul un mock de
>     `auth-config.test.ts` la cite).
> - **Dérives** :
>   - En-tête de la PR E : versions installées aujourd'hui `ai` 7.0.107,
>     `@ai-sdk/mistral` ^4.0.48, `@mistralai/mistralai` ^2.7.0, `better-auth` 1.7.5 ;
>     relire les `.d.ts` (dont les interfaces `rateLimit` de better-auth, citées pour
>     1.6.23 en E2.8).
>   - E2.1 — le motif du codemod compte 117 sites dans 49 fichiers ; `LOG_LEVEL` est à
>     `env.ts:117` ; `document-extraction.service.ts` n'a pas de log d'`Error` brut
>     (le site cité est un champ `error?: string` de résultat).
>   - E2.3 — `index.ts` a été réécrit par D : l'arrêt passe par
>     `createGracefulShutdown` à six étapes ; retirer **seulement** l'étape
>     `stopMonitoring` et l'import dynamique du moniteur.
>   - E2.8 — `skipPaths` a déjà disparu du middleware : ne pas le réintroduire dans le
>     code cible. Numéros de ligne de `app.ts`, `pronote-sync.routes.ts`,
>     `chat-message.routes.ts`, `lib/auth.ts` et `rate-limit.middleware.ts` décalés.
>   - E2.10 — lignes de `ci.yml` et de `doctor-checks.mjs`/`.test.mjs` décalées ; le
>     message du doctor cite déjà `pnpm run setup`. Le test à faire échouer d'abord reste
>     valable.
>   - E2.11 — le dépôt exige Node ≥ 24 (`package.json` `engines`).
>   - E2.2, E2.15 — mocks d'`api-endpoints.test.ts` décalés de deux lignes.
> - **Docs que E2 rend fausses**, à mettre à jour dans la même PR :
>   `apps/server/README.md` (cache `MemoryCacheService`, « memory monitor » dans
>   `middleware/`), `apps/server/CLAUDE.md` (exception Zod de `src/schemas/`), et
>   `.claude/skills/dev-bootstrap/SKILL.md` (`CREATE EXTENSION` à la main avant
>   `db:migrate`).
> - **Points reportés à absorber** (`docs/superpowers/suivi.md`) : champs morts
>   `IAppUser.parentId` (`packages/api/src/types.ts`) et
>   `ElysiaAuthenticatedUser.parentId` (`apps/server/src/types/index.ts`) ;
>   `pnpm dedupe` (`react@19.2.3` et un second `next` tirés par better-auth côté
>   serveur) ; `ignoreBinaries` et entrées `scripts/**` de l'espace `apps/server` du
>   `knip.json` racine, plus le montage `./apps/server/scripts` de
>   `docker-compose.yml` (dossier supprimé) ; commentaire de l'override `nanoid` à
>   vérifier (l'override n'existe plus) ; commentaires « mobile project » de
>   `src/lib/encryption.ts` et utilité de la copie `toArrayBuffer` (le plan le classe
>   plus bas en « Gardés, non touchés ») ; `TRUSTED_ORIGINS` inutilisée.

**Branche :** `refactor/replace-custom-infra`

**Objectif :** supprimer les modules sans effet réel et remplacer logger, rate limit,
parseur `.env` et attentes de santé par les bibliothèques ou options natives prévues pour.

**Fichiers :**
- Create : `src/tests/logger.test.ts`, `src/lib/school-age.ts`, `src/tests/school-age.test.ts`,
  `src/tests/parent-body-schemas.test.ts`
- Modify : `src/lib/observability.ts`, 53 fichiers touchés par le codemod de l'étape
  E2.1, `src/routes/api/health.routes.ts`, `src/services/server-lifecycle.ts`, `src/index.ts`,
  `src/services/parent/parent-dashboard.service.ts`, `src/routes/api/parent.routes.ts`,
  `src/services/parent.service.ts`, `src/config/env.ts`, `src/middleware/rate-limit.middleware.ts`,
  `src/app.ts`, `src/routes/{pronote-connect,pronote-sync,pronote-data,waitlist,chat-message}.routes.ts`,
  `src/lib/auth.ts`, les tests `rate-limit.test.ts`, `health-routes.test.ts`,
  `parent-service.test.ts`, `auth-config.test.ts`, `server-lifecycle-shutdown.test.ts`,
  `src/integration-tests/api-endpoints.test.ts`, `apps/server/package.json`,
  `scripts/dev.mjs`, `scripts/setup.mjs`, `scripts/doctor-checks.mjs`,
  `scripts/doctor-checks.test.mjs`, `.github/workflows/ci.yml`,
  `.github/actions/setup-monorepo/action.yml`, `apps/landing/app/layout.tsx`
- Delete : `src/services/memory-cache.service.ts`, `src/tests/memory-cache.test.ts`,
  `src/middleware/memory-monitor.middleware.ts`, `src/db/pool-limiter.ts`,
  `scripts/generate-eden-types.ts` (dans `apps/server`), `src/schemas/validation.ts`,
  `src/tests/validation.test.ts`, `.npmrc` (racine)

### Tâche E2.1 — logger pino, même signature d'appel, codemod `_error`

**Files:** Modify `src/lib/observability.ts:1-80` (réécriture), `package.json` ;
Create `src/tests/logger.test.ts` ; codemod sur les fichiers qui contiennent le motif.

**Interfaces:**
- Produces : `createLogger(destination?: DestinationStream)` et `logger`, avec les
  signatures `debug|info|warn(message: string, context?: LogContext)` et
  `error(message: string, context?: ErrorContext)`, où `ErrorContext._error: unknown`.
- Consumes, dans pino 10.3.1 (`pino.d.ts`) :
  - `pino(options, stream?)` (lignes 874 et 906) et l'export nommé `pino` (ligne 876) ;
  - les options `level` (378), `serializers` (366), `mixin` (405), `formatters.level`
    (470-475), `base` (634) et `timestamp` (373) ;
  - `pino.stdSerializers.err` (767) : il renvoie telle quelle une valeur qui n'est
    pas une Error (`pino-std-serializers/lib/err.js:11-13`) ;
  - `pino.stdTimeFunctions.isoTime` (814) ;
  - `DestinationStream { write(msg: string): void }` (282).
- Pino sérialise avec `safe-stable-stringify` (`pino.js:119`) : références
  circulaires marquées `[Circular]`, BigInt écrit en nombre.
- Corrélation de trace : `trace.getActiveSpan()?.spanContext()` (`@opentelemetry/api`).

Constats vérifiés :
- `JSON.stringify` d'une `Error` donne `{}`. Cas réels :
  `chat/chat-session.service.ts:68` (`_error: error`) et
  `document/document-extraction.service.ts:295`.
- 132 sites, dans 53 fichiers, ne loggent que `error.message` et perdent la stack.
- `JSON.stringify` lève sur un BigInt ou un objet circulaire, ce qui fait planter
  l'appel de log.
- `LOG_LEVEL` est validé (`config/env.ts:104`) mais jamais lu.

- [ ] `pnpm --filter tomai-server add pino@^10.3.1`.
- [ ] Créer `src/tests/logger.test.ts` :

```ts
import { describe, it, expect, afterEach } from 'bun:test';
import { createLogger } from '../lib/observability';

function capture() {
  const lines: string[] = [];
  return {
    stream: { write: (msg: string) => { lines.push(msg); } },
    entries: () => lines.map((line) => JSON.parse(line) as Record<string, unknown>),
  };
}

const originalLevel = Bun.env['LOG_LEVEL'];
afterEach(() => { Bun.env['LOG_LEVEL'] = originalLevel; });

describe('logger', () => {
  it('serializes an Error with its message and stack', () => {
    const out = capture();
    createLogger(out.stream).error('boom', { _error: new Error('kaboom'), severity: 'high' });
    const entry = out.entries()[0];
    const err = entry?.['_error'] as { message: string; stack: string };
    expect(entry?.['msg']).toBe('boom');
    expect(entry?.['level']).toBe('error');
    expect(err.message).toBe('kaboom');
    expect(err.stack).toContain('kaboom');
  });

  it('does not throw on circular objects or BigInt', () => {
    const out = capture();
    const circular: Record<string, unknown> = {};
    circular['self'] = circular;
    expect(() => createLogger(out.stream).info('odd', { circular, big: 10n })).not.toThrow();
    expect(out.entries()[0]?.['big']).toBe(10);
  });

  it('honours LOG_LEVEL', () => {
    Bun.env['LOG_LEVEL'] = 'warn';
    const out = capture();
    const logger = createLogger(out.stream);
    logger.info('hidden');
    logger.warn('shown');
    expect(out.entries().map((e) => e['msg'])).toEqual(['shown']);
  });
});
```

- [ ] `cd apps/server && bun test src/tests/logger.test.ts` : **FAIL** (`createLogger`
  n'existe pas. Le bug `{}` est visible avec
  `bun -e "console.log(JSON.stringify({ _error: new Error('x') }))"` → `{"_error":{}}`).
- [ ] Réécrire `src/lib/observability.ts` :

```ts
import { pino, type DestinationStream } from 'pino';
import { trace } from '@opentelemetry/api';

interface LogContext {
  [key: string]: unknown;
}

interface ErrorContext extends LogContext {
  _error: unknown;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export function createLogger(destination?: DestinationStream) {
  const base = pino(
    {
      level: Bun.env['LOG_LEVEL'] ?? 'info',
      base: undefined,
      timestamp: pino.stdTimeFunctions.isoTime,
      formatters: { level: (label) => ({ level: label }) },
      serializers: {
        _error: pino.stdSerializers.err,
        error: pino.stdSerializers.err,
        err: pino.stdSerializers.err,
      },
      mixin() {
        const span = trace.getActiveSpan()?.spanContext();
        return span ? { trace_id: span.traceId, span_id: span.spanId } : {};
      },
    },
    destination,
  );

  return {
    debug: (message: string, context: LogContext = {}) => base.debug(context, message),
    info: (message: string, context: LogContext = {}) => base.info(context, message),
    warn: (message: string, context: LogContext = {}) => base.warn(context, message),
    error: (message: string, context?: ErrorContext) => base.error(context ?? {}, message),
  };
}

export const logger = createLogger();
```

- [ ] `bun test src/tests/logger.test.ts` : PASS.
- [ ] Codemod. Compter d'abord les occurrences :
  `grep -rPc "_error: (\w+) instanceof Error \? \1\.message : String\(\1\)" src --include=*.ts | awk -F: '{s+=$2} END {print s}'`
  (132 sur `main` avant A ; noter la valeur réelle). Puis appliquer :
  `grep -rlP "_error: (\w+) instanceof Error \? \1\.message : String\(\1\)" src --include=*.ts | xargs perl -pi -e 's/_error: (\w+) instanceof Error \? \1\.message : String\(\1\)/_error: $1/g'`.
  Relancer le comptage : il doit donner 0. `git diff --stat` doit montrer autant de
  lignes modifiées que d'occurrences comptées.
- [ ] `bun run typecheck && bun run lint && bun run test` : exit 0.
- [ ] Vérification du bundle, parce que `bun build --minify` doit embarquer pino :
  `bun run build && NODE_ENV=production LOG_LEVEL=info timeout 5 bun dist/index.js; echo $?`.
  Au moins une ligne JSON avec `"level":"info"` doit sortir avant l'arrêt. Le code
  de sortie vaut 124 (timeout) ou 1 si la base n'est pas joignable. Ce qui compte
  est l'absence d'erreur de résolution de module pino.
- [ ] Commit : `git add` de `observability.ts`, `logger.test.ts`, `package.json` et
  `pnpm-lock.yaml` à la racine, puis un `git add` pour chaque fichier listé par
  `git diff --name-only`. Message :
  `refactor(server): log with pino and keep error stacks`, suivi de la ligne Co-Authored-By.

### Tâche E2.2 — supprimer `memory-cache.service` et le faux check `/health`

**Files:** Modify `src/routes/api/health.routes.ts:5,28-32`, `src/services/server-lifecycle.ts`
(champ `cache: 'memory-lru'`), `src/tests/health-routes.test.ts:2,38-40,60-68`,
`src/integration-tests/api-endpoints.test.ts:73-83` ; Delete `src/services/memory-cache.service.ts`,
`src/tests/memory-cache.test.ts`.

Constats vérifiés : le seul consommateur est `/health`. `healthCheck()` renvoie
toujours `healthy` (`memory-cache.service.ts:182-184`), et le constructeur démarre
un `setInterval` dès l'import (`:52-53,200`).

- [ ] Preuve : `grep -rn "memory-cache\|cacheService\|memoryCacheService" src`. Seuls
  `health.routes.ts`, `memory-cache.test.ts` et les mocks des deux tests cités
  doivent sortir.
- [ ] Dans `health-routes.test.ts`, remplacer l'assertion de la ligne 67 par
  `expect(body.checks.cache).toBeUndefined();`, renommer le test en
  `'reports healthy with the database check'`, et supprimer le mock des lignes 38-40.
  `bun test src/tests/health-routes.test.ts` : **FAIL** (`checks.cache` présent).
- [ ] Dans `health.routes.ts`, supprimer l'import de la ligne 5 et les lignes 28-32.
  Supprimer `cache: 'memory-lru',` dans `server-lifecycle.ts`, le mock des lignes
  73-83 de `api-endpoints.test.ts` et la ligne 2 du docblock du test (« + du cache »).
  Ensuite `git rm apps/server/src/services/memory-cache.service.ts apps/server/src/tests/memory-cache.test.ts`.
- [ ] `bun test src/tests/health-routes.test.ts && bun run typecheck` : PASS.
- [ ] Commit, un `git add` par fichier plus le `git rm` ;
  `refactor(server): remove the always-healthy memory cache`, suivi de la ligne Co-Authored-By.

### Tâche E2.3 — supprimer `memory-monitor.middleware`

**Files:** Modify `src/services/server-lifecycle.ts:4,130`, `src/index.ts:63,66-70`,
`src/tests/server-lifecycle-shutdown.test.ts:22-24`, `src/integration-tests/api-endpoints.test.ts:91-93` ;
Delete `src/middleware/memory-monitor.middleware.ts`.

Constats vérifiés :
- la « remédiation » ne fait qu'un `global.gc()` et des logs (`:194-230`), sans vider
  aucun cache ;
- les seuils sont comparés à `heapUsed` (`:83-86,118-140`) alors que le commentaire
  les rapporte à la limite RSS du conteneur (`:31`) ;
- le log périodique repose sur `Date.now() % 300000 < 30000` (`:93`).

La mémoire du processus relève des métriques de l'hébergeur (lot 3).

- [ ] Preuve : `grep -rn "memory-monitor\|memoryMonitor" src`, qui doit donner les
  seuls sites listés.
- [ ] Supprimer l'import et `memoryMonitor.startMonitoring(30000);` dans
  `server-lifecycle.ts`. Dans `index.ts`, supprimer l'import dynamique (`:63`) et
  l'étape `stopMonitoring`, pour ne garder que `stopBackgroundJobs` dans la boucle.
  Retirer les deux mocks des tests. Ensuite
  `git rm apps/server/src/middleware/memory-monitor.middleware.ts`.
- [ ] `bun test src/tests/server-lifecycle-shutdown.test.ts && bun run typecheck` : PASS.
- [ ] Commit, un `git add` par fichier plus le `git rm` ;
  `refactor(server): remove the memory monitor that remediated nothing`, suivi de la ligne Co-Authored-By.

### Tâche E2.4 — supprimer `pool-limiter` et `p-limit`

**Files:** Modify `src/services/parent/parent-dashboard.service.ts:6,27-52`,
`src/tests/parent-service.test.ts:142-144`, `package.json` ; Delete `src/db/pool-limiter.ts`.

Constat vérifié : postgres-js met déjà en file les requêtes au-delà de `max`
(`db/connection.ts:56`, `max: 20` en prod, 5 sinon). Doc :
https://github.com/porsager/postgres#connection-details (« max: Max number of
connections »), où les requêtes au-delà attendent une connexion libre. Le limiteur
ajoute une seconde file devant la première. `p-limit` n'a pas d'autre usage
(`grep -rn "p-limit" src`).

- [ ] Preuve : `grep -rn "pool-limiter\|withPoolLimit" src`, qui doit donner le service,
  le limiteur et le mock de test.
- [ ] Remplacer chacun des trois `withPoolLimit(() => q, label)` par `q`, puis
  supprimer l'import. Retirer le mock de `parent-service.test.ts`. Ensuite
  `git rm apps/server/src/db/pool-limiter.ts` et `pnpm --filter tomai-server remove p-limit`.
- [ ] `bun test src/tests/parent-service.test.ts && bun run typecheck` : PASS.
- [ ] Commit, un `git add` par fichier (dont `package.json` et `pnpm-lock.yaml`) plus le
  `git rm` ; `refactor(server): let postgres-js queue queries instead of p-limit`,
  suivi de la ligne Co-Authored-By.

### Tâche E2.5 — supprimer `scripts/generate-eden-types.ts`

**Files:** Delete `apps/server/scripts/generate-eden-types.ts`.

Constat vérifié : le script écrit un `.d.ts` qui réexporte `App` depuis la source.
C'est le contraire du contrat `build:types` (`apps/server/CLAUDE.md`, « Frontière de
types »). Il n'a aucune référence.

- [ ] Preuve : `grep -rn "generate-eden-types" --exclude-dir=node_modules /home/ordiv/projets/tomai-monorepo`
  ne doit renvoyer que le fichier lui-même.
- [ ] `git rm apps/server/scripts/generate-eden-types.ts`, puis `bun run typecheck` : exit 0.
- [ ] Commit : `chore(server): remove the unused Eden types generator script`, suivi de la ligne Co-Authored-By.

### Tâche E2.6 — une seule validation par route parent (TypeBox) ; suppression de `schemas/validation.ts`

**Files:** Modify `src/routes/api/parent.routes.ts:4-9,59-83,98-139` ;
Modify `src/services/parent.service.ts:107-160,165-195` ;
Create `src/lib/school-age.ts`, `src/tests/school-age.test.ts`, `src/tests/parent-body-schemas.test.ts` ;
Modify `src/integration-tests/api-endpoints.test.ts:212-217` ;
Delete `src/schemas/validation.ts`, `src/tests/validation.test.ts`.

**Interfaces:**
- Produces :
  - `isSchoolAge(dateOfBirth: string, now?: Date): boolean` ;
  - `createChildBody` et `updateChildBody`, deux schémas TypeBox exportés par
    `parent.routes.ts`.
- Consumes :
  - le format `'date'` enregistré par Elysia (`elysia/dist/type-system/format.d.ts:6,47`) ;
  - les options TypeBox `minLength`, `maxLength`, `pattern` et `minProperties` ;
  - `Value.Check` de `@sinclair/typebox/value`, dépendance déjà présente
    (`package.json` : `@sinclair/typebox ^0.34.0`).

Décision : la source unique est **TypeBox, pas Zod**. Elysia 1.4 accepterait bien
un Standard Schema dans `body:` (`elysia/dist/types.d.ts:26,318`), mais la
convention du dépôt réserve la validation des routes à TypeBox, parce que c'est
elle qui alimente les types Eden (`apps/server/CLAUDE.md`, « Patterns »). Passer du
Zod dans le contrat ferait aussi entrer des types `zod` dans le `.d.ts` émis par
`build:types`, sans preuve que l'émission reste nommable. Le contrat Eden garde la
même forme : seules des contraintes s'ajoutent.

Après A, `revenueCatWebhookSchema` a disparu. Vérifier que les seuls consommateurs
restants de `schemas/validation.ts` sont `parent.routes.ts`, `validation.test.ts` et
le mock d'`api-endpoints.test.ts` :
`grep -rln "schemas/validation" src`. Constat vérifié : 9 schémas sur 14
(`emailSchema`, `registerSchema`, `loginSchema`, `chatSessionSchema`,
`chatMessageSchema`, `streamChatQuerySchema`, etc.) ne servent qu'à leur propre test.

Règles reprises de Zod :
- pour les noms, les longueurs et le motif ;
- pour le mot de passe, la longueur et le motif ;
- pour l'identifiant, la longueur et le motif, avec mise en minuscules côté service ;
- pour la date, le format.

La règle d'âge 5-19 ans est une règle métier : elle va dans le service.

- [ ] Créer `src/tests/school-age.test.ts` :

```ts
import { describe, it, expect } from 'bun:test';
import { isSchoolAge } from '../lib/school-age';

const now = new Date('2026-09-22T12:00:00Z');

describe('isSchoolAge', () => {
  it('accepts a 5-year-old and a 19-year-old', () => {
    expect(isSchoolAge('2021-09-22', now)).toBe(true);
    expect(isSchoolAge('2007-09-23', now)).toBe(true);
  });
  it('rejects a 4-year-old and a 20-year-old', () => {
    expect(isSchoolAge('2021-09-23', now)).toBe(false);
    expect(isSchoolAge('2006-09-22', now)).toBe(false);
  });
});
```

- [ ] Créer `src/tests/parent-body-schemas.test.ts` :

```ts
import { describe, it, expect, mock } from 'bun:test';
import { Value } from '@sinclair/typebox/value';
import { createMockLogger } from './_helpers/mock-logger';

mock.module('../lib/observability', () => ({ logger: createMockLogger() }));
mock.module('../services/parent.service', () => ({ parentService: {} }));

const { createChildBody, updateChildBody } = await import('../routes/api/parent.routes');

const valid = { firstName: 'Léa', lastName: "N'Diaye", username: 'lea.n', password: 'Abcdef12', schoolLevel: 'sixieme', dateOfBirth: '2014-03-01' };

describe('parent body schemas', () => {
  it('accepts a valid child', () => expect(Value.Check(createChildBody, valid)).toBe(true));
  it('rejects a weak password', () => expect(Value.Check(createChildBody, { ...valid, password: 'abcdefgh' })).toBe(false));
  it('rejects a username with spaces', () => expect(Value.Check(createChildBody, { ...valid, username: 'le a' })).toBe(false));
  it('rejects a malformed date', () => expect(Value.Check(createChildBody, { ...valid, dateOfBirth: '01/03/2014' })).toBe(false));
  it('rejects an empty update', () => expect(Value.Check(updateChildBody, {})).toBe(false));
});
```

Si `authMacro` tire la base à l'import, ajouter le mock de `../lib/auth-macro` de
`rate-limit-ordering.test.ts:16-21`.
- [ ] `bun test src/tests/school-age.test.ts src/tests/parent-body-schemas.test.ts` :
  **FAIL** (modules et exports absents).
- [ ] Créer `src/lib/school-age.ts`, qui reprend la logique de `schemas/validation.ts:42-56` :

```ts
export function isSchoolAge(dateOfBirth: string, now: Date = new Date()): boolean {
  const birth = new Date(`${dateOfBirth}T00:00:00Z`);
  let age = now.getUTCFullYear() - birth.getUTCFullYear();
  const monthDiff = now.getUTCMonth() - birth.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getUTCDate() < birth.getUTCDate())) age--;
  return age >= 5 && age <= 19;
}
```

- [ ] Dans `parent.routes.ts` : supprimer l'import `schemas/validation`, le log de
  réception (`:60-67`) et les deux blocs `validateSchema` (`:69-83,100-104`).
  `validation.data` devient `body`. Déclarer et exporter les schémas, puis les
  référencer dans `body:` :

```ts
const name = t.String({ minLength: 1, maxLength: 50, pattern: "^[a-zA-ZÀ-ÿ\\s'-]+$" });
const password = t.String({ minLength: 8, maxLength: 128, pattern: '^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)' });

export const createChildBody = t.Object({
  firstName: name,
  lastName: name,
  username: t.String({ minLength: 3, maxLength: 30, pattern: '^[a-zA-Z0-9_.]+$' }),
  password,
  schoolLevel: EDUCATION_LEVEL_UNION,
  dateOfBirth: t.Optional(t.String({ format: 'date' })),
});

export const updateChildBody = t.Object(
  {
    firstName: t.Optional(name),
    lastName: t.Optional(name),
    password: t.Optional(password),
    schoolLevel: t.Optional(EDUCATION_LEVEL_UNION),
    dateOfBirth: t.Optional(t.String({ format: 'date' })),
  },
  { minProperties: 1 },
);
```

Supprimer aussi le commentaire `TODO(product)` des lignes 108-111 : la règle
métier est désormais explicite dans le service.
- [ ] Dans `parent.service.ts` : au début de `createChild`, ajouter
  `if (childData.dateOfBirth && !isSchoolAge(childData.dateOfBirth)) throw new Error('Âge doit être entre 5 et 19 ans');`
  et `const username = childData.username.toLowerCase();`, puis utiliser `username`
  partout où `childData.username` apparaît (`:115,129,137-138,152`). Utiliser
  `childData.firstName.trim()` et `childData.lastName.trim()` là où ils sont écrits.
  Dans `updateChild`, faire le même contrôle d'âge si `updateData.dateOfBirth` est
  défini. Les routes renvoient déjà 400 avec le message (`parent.routes.ts:95,130`).
- [ ] Retirer le mock de `schemas/validation` d'`api-endpoints.test.ts:212-217`. Ensuite
  `git rm apps/server/src/schemas/validation.ts apps/server/src/tests/validation.test.ts`,
  puis `grep -rn "schemas/validation" src`, qui doit être vide.
- [ ] `bun test src/tests/school-age.test.ts src/tests/parent-body-schemas.test.ts src/tests/parent-service.test.ts`,
  puis `bun run typecheck && bun run build:types` : exit 0. `build:types` prouve que
  le contrat Eden s'émet toujours.
- [ ] Commit, un `git add` par fichier plus le `git rm` ;
  `refactor(server): validate parent routes once with TypeBox`, suivi de la ligne Co-Authored-By.
  Dans la PR, signaler un changement de contrat : une entrée invalide renvoie
  désormais la 422 de validation d'Elysia au lieu d'une 400 maison. Aucun client
  n'existe encore (mobile supprimé en A, web au lot 3).

### Tâche E2.7 — variables d'environnement mortes

**Files:** Modify `src/config/env.ts:91-94,105,110`.

Vérification variable par variable (`grep -rn "<VAR>" src ../../scripts ../../.github ../../docker-compose.yml apps/server/.env.example`) :
- `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX_REQUESTS_API`, `RATE_LIMIT_MAX_REQUESTS_CHAT` :
  lues nulle part. Supprimées.
- `POSTHOG_API_KEY` : lue nulle part. Supprimée.
- `DEBUG` : lue nulle part. Supprimée.
- `LOG_LEVEL` : **gardée**. Pino la lit depuis E2.1, et `.env.example:19` comme
  `docker-compose.yml:33` la définissent. Le schéma garde l'enum pour échouer au boot
  sur une valeur invalide.

`.env.example` ne contient aucune des variables supprimées : rien à aligner.

- [ ] Supprimer les lignes 91-94 (bloc `Rate limiting`), 105 et 110. Relancer le grep
  des cinq noms supprimés sur `src` : il doit être vide.
- [ ] `bun run typecheck && bun run test` : exit 0.
- [ ] Commit : `git add apps/server/src/config/env.ts` ;
  `chore(server): drop env variables nothing reads`, suivi de la ligne Co-Authored-By.

### Tâche E2.8 — rate limit : règle better-auth pour la connexion enfant, `rate-limiter-flexible` pour le reste

**Files:** Modify `src/lib/auth.ts` (options `betterAuth`), `src/middleware/rate-limit.middleware.ts:1-250`
(réécriture), `src/app.ts:100`, `src/routes/pronote-connect.routes.ts:28`,
`src/routes/pronote-sync.routes.ts:22`, `src/routes/pronote-data.routes.ts:27`,
`src/routes/waitlist.routes.ts:13`, `src/tests/rate-limit.test.ts`, `src/tests/auth-config.test.ts`,
`package.json`.

**Interfaces:**
- better-auth 1.6.23 : `rateLimit?: { enabled?, window?, max?, customRules?: Record<string, { window, max } | false | fn>, storage?: 'memory'|'database'|'secondary-storage' }`
  (`@better-auth/core/dist/types/init-options.d.mts:135-165`). D'après
  https://www.better-auth.com/docs/concepts/rate-limit, le limiteur est actif par
  défaut en production (60 s, 100 requêtes), en mémoire, avec une règle spéciale
  pour `/sign-in/email` (3 requêtes par 10 s). **Aucune règle ne couvre
  `/sign-in/username`**, qui est la connexion des enfants (plugin `username`,
  `lib/auth.ts:197`).
- `rate-limiter-flexible` 11.2.1 : licence ISC, publiée le 2026-09-17, 2,09 M
  téléchargements par semaine (contre 32 k pour `elysia-rate-limit`).
  `new RateLimiterMemory({ keyPrefix, points, duration })` ; `consume(key)` se
  résout en `RateLimiterRes`, ou rejette avec un `RateLimiterRes`
  `{ msBeforeNext, remainingPoints }` quand la limite est atteinte, ou avec une
  `Error` quand le stockage échoue (`types.d.ts:8-28,269-277,368-412`). La même API
  existe avec stockage Drizzle et Postgres (`RateLimiterDrizzle`, `types.d.ts:470`).
  Au lot 3, si l'hébergement a plusieurs instances, on change d'une ligne le
  stockage sans toucher aux appelants.
- Produces : `createRateLimitMiddleware(config: { keyPrefix: string; maxRequests: number; windowSeconds: number; keyGenerator?; skipPaths? })`
  renvoie un hook `async`. `RateLimitPresets` ne garde que `api`, `ai` et `pronote`.
  `defaultKeyGenerator` est inchangé.

Constats vérifiés :
- fenêtre fixe dans une `Map` maison, avec un `setInterval` à l'import (`:57-67`) ;
- presets `auth`, `upload` et `public` sans consommateur
  (`grep -rn "RateLimitPresets\.\(auth\|upload\|public\)" src` vide) ;
- `skipSuccessfulRequests` jamais lu.

Changement de comportement assumé : chaque famille de routes Pronote
(`pronote-connect`, `pronote-sync`, `pronote-data`) a désormais son propre budget de
10 requêtes par 5 min. Avant, les trois partageaient la même clé. La connexion
Pronote, qui est la route sensible, garde exactement le même plafond.

- [ ] `pnpm --filter tomai-server add rate-limiter-flexible@^11.2.1`.
- [ ] Dans `auth-config.test.ts`, ajouter :

```ts
describe('Rate limit on child sign-in', () => {
  it('limits /sign-in/username like /sign-in/email', () => {
    const options = (auth as { options: { rateLimit?: { customRules?: Record<string, unknown> } } }).options;
    expect(options.rateLimit?.customRules?.['/sign-in/username']).toEqual({ window: 10, max: 3 });
  });
});
```

- [ ] Dans `rate-limit.test.ts`, ajouter :

```ts
describe('createRateLimitMiddleware — limit reached', () => {
  function ctx(): Context {
    return {
      request: new Request('http://localhost/api/x', { headers: { 'x-real-ip': '7.7.7.7' } }),
      set: { headers: {}, status: 200 },
    } as unknown as Context;
  }

  it('answers 429 with Retry-After once the budget is spent', async () => {
    mockIsProduction = false;
    const mw = createRateLimitMiddleware({ keyPrefix: 'test-429', maxRequests: 2, windowSeconds: 60 });
    expect(await mw(ctx())).toBeUndefined();
    expect(await mw(ctx())).toBeUndefined();
    const third = ctx();
    const body = await mw(third);
    expect(third.set.status).toBe(429);
    expect((third.set.headers as Record<string, string>)['Retry-After']).toBeDefined();
    expect(body).toMatchObject({ error: 'Too Many Requests' });
  });
});
```

Dans les `it` existants (lignes 59-160 et 205-220) : rendre les callbacks `async`,
préfixer d'`await` chaque appel au middleware, et ajouter un `keyPrefix` unique à
chaque config passée à `createRateLimitMiddleware`.
- [ ] `bun test src/tests/auth-config.test.ts src/tests/rate-limit.test.ts` : **FAIL**
  (règle absente, et `keyPrefix` inconnu au typecheck du test).
- [ ] Dans `lib/auth.ts`, ajouter aux options de `betterAuth(...)` :

```ts
rateLimit: {
  customRules: {
    '/sign-in/username': { window: 10, max: 3 },
  },
},
```

- [ ] Réécrire `rate-limit.middleware.ts`. `DEFAULT_CONFIG`, la `Map`, le
  `setInterval`, `checkRateLimit`, les presets morts et `skipSuccessfulRequests`
  disparaissent. `defaultKeyGenerator` (`:39-52`) reste à l'identique.

```ts
import type { Context } from 'elysia';
import { RateLimiterMemory, RateLimiterRes } from 'rate-limiter-flexible';
import { logger } from '../lib/observability';
import { isProduction } from '../config/env';

interface RateLimitConfig {
  keyPrefix: string;
  maxRequests: number;
  windowSeconds: number;
  keyGenerator?: (context: Context) => string;
  skipPaths?: string[];
}

function setRateLimitHeaders(context: Context, limit: number, res: RateLimiterRes): void {
  const headers = context.set.headers as Record<string, string>;
  headers['X-RateLimit-Limit'] = String(limit);
  headers['X-RateLimit-Remaining'] = String(res.remainingPoints);
  headers['X-RateLimit-Reset'] = String(Math.ceil((Date.now() + res.msBeforeNext) / 1000));
}

export function createRateLimitMiddleware(config: RateLimitConfig) {
  const limiter = new RateLimiterMemory({
    keyPrefix: config.keyPrefix,
    points: config.maxRequests,
    duration: config.windowSeconds,
  });
  const keyGenerator = config.keyGenerator ?? defaultKeyGenerator;

  return async function rateLimitMiddleware(context: Context) {
    try {
      const pathname = new URL(context.request.url).pathname;
      if (config.skipPaths?.some((prefix) => pathname.startsWith(prefix))) return;

      const identifier = keyGenerator(context);
      const outcome = await limiter.consume(identifier).catch((rejection: unknown) => rejection);
      if (!(outcome instanceof RateLimiterRes)) throw outcome;

      setRateLimitHeaders(context, config.maxRequests, outcome);
      if (outcome.consumedPoints <= config.maxRequests) return;

      const retryAfter = Math.ceil(outcome.msBeforeNext / 1000);
      (context.set.headers as Record<string, string>)['Retry-After'] = String(retryAfter);
      logger.warn('Rate limit exceeded', { operation: 'rate-limit:exceeded', identifier, path: pathname });
      context.set.status = 429;
      return { error: 'Too Many Requests', retryAfter };
    } catch (error) {
      logger.error('Rate limit middleware error', { operation: 'rate-limit:error', _error: error, severity: 'high' as const });
      context.set.status = 503;
      return { error: 'Service Unavailable', message: 'Rate limit check failed. Please try again later.' };
    }
  };
}

export const RateLimitPresets = {
  api: { keyPrefix: 'api', maxRequests: isProduction() ? 100 : 500, windowSeconds: 60 },
  ai: {
    keyPrefix: 'ai',
    maxRequests: isProduction() ? 30 : 100,
    windowSeconds: 60,
    keyGenerator: (context: Context) => {
      const userId = (context as Context & { user?: { id: string } }).user?.id;
      return userId ? `ai:user:${userId}` : defaultKeyGenerator(context);
    },
  },
  pronote: {
    keyPrefix: 'pronote',
    maxRequests: isProduction() ? 10 : 50,
    windowSeconds: 300,
    keyGenerator: (context: Context) => {
      const userId = (context as Context & { user?: { id: string } }).user?.id;
      return userId ? `pronote:user:${userId}` : defaultKeyGenerator(context);
    },
  },
} as const;
```

Le `.catch` qui renvoie le rejet sert à distinguer le dépassement (un
`RateLimiterRes` avec `consumedPoints > points`) d'une panne du stockage (une
`Error`). Garder le commentaire `@see` Cloudflare du preset `pronote` et le
commentaire sur l'ordre avec `.guard({ auth: true })` : ce sont des WHY.
- [ ] Mettre à jour les appelants :
  - `pronote-connect.routes.ts:28` : `createRateLimitMiddleware({ ...RateLimitPresets.pronote, keyPrefix: 'pronote-connect' })` ;
  - `pronote-sync.routes.ts:22` : idem avec `'pronote-sync'` ;
  - `pronote-data.routes.ts:27` : idem avec `'pronote-data'` ;
  - `waitlist.routes.ts:13` : `createRateLimitMiddleware({ keyPrefix: 'waitlist', maxRequests: 5, windowSeconds: 60 })` ;
  - `app.ts:100` et `chat-message.routes.ts:41` restent inchangés.
- [ ] `bun test src/tests/auth-config.test.ts src/tests/rate-limit.test.ts src/tests/rate-limit-ordering.test.ts && bun run typecheck` : PASS.
- [ ] Vérification manuelle en dev (le limiteur better-auth ne tourne qu'en
  production) :
  `cd apps/server && NODE_ENV=production bun run src/index.ts`, puis 4 fois
  `curl -s -o /dev/null -w "%{http_code}\n" -X POST localhost:3000/api/auth/sign-in/username -H 'content-type: application/json' -d '{"username":"x","password":"y"}'`.
  On attend `401 401 401 429`. Si la validation prod de l'env bloque le démarrage
  local, le noter dans la PR comme non vérifié.
- [ ] Commit, un `git add` par fichier (dont `package.json` et `pnpm-lock.yaml`) ;
  `refactor(server): rate limit with rate-limiter-flexible and protect child sign-in`,
  suivi de la ligne Co-Authored-By.

### Tâche E2.9 — `pnpm dev` : une seule attente de santé

**Files:** Modify `scripts/dev.mjs:6,16-28`.

Constat vérifié : trois attentes s'enchaînent. `up -d` (`:17`), puis
`up -d --wait --wait-timeout 120 postgres` (`:20`), puis
`runChecks(buildChecks(ctx, { full: false }))` (`:22-28`), qui ne contrôle que
« daemon joignable » et « conteneurs healthy » (`doctor-checks.mjs:191-196`). Le
profil par défaut ne démarre que `postgres` (`docker-compose.yml` : `backend`,
`drizzle-studio` et `adminer` sont sous `profiles`). Doc :
https://docs.docker.com/reference/cli/docker/compose/up/ — `--wait` : « Wait for
services to be running|healthy. Implies detached mode. » ; `--wait-timeout` :
« Maximum duration in seconds to wait for the project to be running|healthy ».

- [ ] Remplacer les lignes 16-28 par :

```js
console.log("[dev] démarrage de l'infra, attente postgres healthy…");
run("docker", ["compose", "up", "-d", "--wait", "--wait-timeout", "120"]);
```

puis supprimer l'import de `doctor-checks.mjs` (`:6`).
- [ ] Vérifier le code de sortie en cas d'échec (la doc ne le précise pas) :
  `docker compose down && docker compose up -d --wait --wait-timeout 1; echo $?`
  doit renvoyer une valeur non nulle, postgres ne pouvant pas être healthy en 1 s.
  Ensuite `pnpm dev` démarre, et `curl -s localhost:3000/health` renvoie
  `"status":"healthy"`.
- [ ] Commit : `git add scripts/dev.mjs` ; `chore(ci): wait for the dev infra with docker compose --wait`,
  suivi de la ligne Co-Authored-By. Le scope `ci` est la convention la plus proche :
  aucun scope `scripts` n'existe (`.claude/rules/testing-and-commits.md`).

### Tâche E2.10 — `CREATE EXTENSION vector` dans le seul migrateur ; attente CI redondante

**Files:** Modify `scripts/setup.mjs:43-47`, `.github/workflows/ci.yml:115-118`,
`scripts/doctor-checks.mjs:153`, `scripts/doctor-checks.test.mjs:88`.

Constats vérifiés :
- `apps/server/src/db/migrate.ts:70` crée l'extension, sous verrou consultatif,
  avant les migrations. `setup.mjs:46-47` et `ci.yml:118` la recréent juste avant
  d'appeler ce même migrateur. `doctor-checks.mjs:152-153` ne la crée pas : il vérifie
  sa présence, mais son message renvoie à `pnpm run setup`, alors que le bon remède est
  le migrateur.
- `ci.yml:117` boucle sur `pg_isready` sans timeout. Or le service déclare
  `--health-cmd pg_isready` (`:94-97`), et le runner n'exécute les étapes qu'une
  fois les services healthy : la phase « Initialize containers » attend l'état
  `healthy` et échoue le job si les `health-retries` sont épuisés. Source :
  https://github.com/actions/runner/discussions/1640 et le tutoriel
  https://docs.github.com/en/actions/tutorials/use-containerized-services/create-postgresql-service-containers.
  Ce dernier montre les options de santé mais ne décrit pas l'attente : la preuve
  se fait sur le log d'un run (étape ci-dessous).

- [ ] Dans `doctor-checks.test.mjs:88`, remplacer `/vector/i` par `/db:migrate/`.
  `pnpm test:scripts` : **FAIL** (le message actuel cite `pnpm run setup`).
- [ ] `doctor-checks.mjs:153` :
  `throw new Error("extension 'vector' absente — lance 'bun run db:migrate' dans apps/server (le migrateur la crée)");`.
- [ ] `setup.mjs` : supprimer les lignes 46-47 (`docker exec … CREATE EXTENSION …`) et
  remplacer le commentaire de la ligne 43 par `// 3. Postgres up + migrations (le migrateur crée l'extension vector)`.
- [ ] `ci.yml` : l'étape « Prepare integration DB » se réduit à
  `cd apps/server && bun run db:migrate`, renommée `Prepare integration DB (migrations)`.
- [ ] `pnpm test:scripts` : exit 0. Sur une base neuve :
  `docker compose down -v && pnpm run setup`, puis
  `docker exec tomai-postgres-dev psql -U tomai_dev -d tomai_dev -tAc "SELECT count(*) FROM pg_extension WHERE extname='vector'"`
  doit afficher `1`.
- [ ] Après le push, dans le log du job d'intégration, l'étape « Initialize containers »
  doit montrer l'attente du service healthy avant les steps, et l'étape de migration
  doit passer. Ce point n'est vérifiable qu'en CI.
- [ ] Commit, un `git add` par fichier ;
  `chore(ci): create the vector extension only in the migrator`, suivi de la ligne Co-Authored-By.

### Tâche E2.11 — `doctor` : parseur `.env` de Node

**Files:** Modify `scripts/doctor-checks.mjs:7,17-35`, `scripts/doctor-checks.test.mjs`.

**Interfaces:** Consumes `util.parseEnv(content: string): object`, ajouté en
v21.7.0 et v20.12.0, non expérimental depuis v22.21.0
(https://nodejs.org/docs/latest-v22.x/api/util.html#utilparseenvcontent). Le dépôt
exige Node ≥ 22 (`package.json` `engines`) et `.nvmrc` = 24.

Constat vérifié : le parseur maison (`:18-35`) garde le commentaire en ligne dans la
valeur (`KEY=val # note` → `val # note`) et ne gère pas les valeurs multilignes.

- [ ] Exporter la fonction pour la tester (`export function parseEnvFile`), puis ajouter
  à `doctor-checks.test.mjs` :

```js
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseEnvFile } from './doctor-checks.mjs';

test('parseEnvFile: strips inline comments like the dotenv format', () => {
  const dir = mkdtempSync(join(tmpdir(), 'doctor-'));
  const file = join(dir, '.env');
  writeFileSync(file, 'PG_CONTAINER=pg-dev # local container\nDATABASE_URL="postgres://a:b@h/db"\n');
  assert.deepEqual(parseEnvFile(file), { PG_CONTAINER: 'pg-dev', DATABASE_URL: 'postgres://a:b@h/db' });
});

test('parseEnvFile: missing file -> empty object', () => {
  assert.deepEqual(parseEnvFile('/nonexistent/.env'), {});
});
```

- [ ] `pnpm test:scripts` : **FAIL** sur le commentaire en ligne.
- [ ] Remplacer le corps de la fonction :

```js
import { parseEnv } from 'node:util';

export function parseEnvFile(path) {
  try {
    return parseEnv(readFileSync(path, 'utf8'));
  } catch {
    return {};
  }
}
```

- [ ] `pnpm test:scripts && pnpm doctor` : exit 0 (le second avec l'infra démarrée).
- [ ] Commit, un `git add` par fichier ; `refactor(ci): parse .env with node:util parseEnv in doctor`,
  suivi de la ligne Co-Authored-By.

### Tâche E2.12 — (retirée)

`.npmrc` est supprimé par la PR A, tâche A.5. Rien à faire ici ; la numérotation est gardée pour ne pas décaler les renvois.

### Tâche E2.13 — landing : `appleWebApp` de la Metadata API

**Files:** Modify `apps/landing/app/layout.tsx:65-68`.

**Interfaces:** Consumes `AppleWebApp { capable?, title?, statusBarStyle?: 'default'|'black'|'black-translucent' }`
(`next/dist/lib/metadata/types/extra-types.d.ts:55-60`, next 16.3.5). Next rend
`capable` en `<meta name="mobile-web-app-capable">` et `statusBarStyle` en
`apple-mobile-web-app-status-bar-style` (`next/dist/lib/metadata/metadata.js:606,634`).

Point non vérifié : que Safari iOS honore `mobile-web-app-capable` à la place de la
balise préfixée `apple-`. Next a fait ce choix, et le manifeste
(`manifest.webmanifest`) pilote de toute façon l'installation.

- [ ] Remplacer le bloc `other` par
  `appleWebApp: { capable: true, statusBarStyle: 'default', title: 'TomIA' },`.
- [ ] `cd apps/landing && pnpm typecheck && pnpm lint && pnpm build` : exit 0. Ensuite
  `grep -o 'name="[a-z-]*web-app[a-z-]*"' .next/server/app/index.html` doit lister
  `mobile-web-app-capable` et `apple-mobile-web-app-status-bar-style`.
- [ ] Commit : `git add apps/landing/app/layout.tsx` ;
  `refactor(landing): declare web app metadata with appleWebApp`, suivi de la ligne Co-Authored-By.

### Tâche E2.14 — cache Turbo en CI : une seule couche

**Files:** Modify `.github/actions/setup-monorepo/action.yml:5,7-11,27-32` et les
`with: turbo-cache-key` de `.github/workflows/ci.yml`, **ou** `ci.yml:29-30`, selon
la vérification.

Constat vérifié : `actions/cache` sur `.turbo` (`action.yml:27-32`) s'ajoute au cache
distant Turbo configuré par `TURBO_TOKEN`/`TURBO_TEAM` (`ci.yml:29-30`). Je ne peux
pas lire les secrets du dépôt : l'utilisateur vérifie.

- [ ] **Vérification par l'utilisateur :**
  `gh secret list --repo VictorNain26/tomai-monorepo | grep TURBO_`. Ouvrir aussi le
  log d'un run récent de `ci.yml` et chercher `Remote caching enabled` dans la
  sortie de `turbo run`.
- [ ] Si les deux secrets existent et que le log confirme le cache distant : supprimer
  l'étape `actions/cache` (`action.yml:27-32`), l'input `turbo-cache-key`
  (`:7-11`), les `with: turbo-cache-key: …` de `ci.yml` (`grep -n "turbo-cache-key" .github/workflows/ci.yml`),
  et retirer « restore Turbo cache » de la description (`:5`).
- [ ] Sinon, supprimer `TURBO_TOKEN` et `TURBO_TEAM` de `ci.yml:29-30` et garder
  `actions/cache`.
- [ ] Après le push, le job CI passe, et le second run sur le même commit affiche
  `FULL TURBO` ou `cache hit` pour les tâches inchangées.
- [ ] Commit, un `git add` par fichier ; `ci: keep a single Turbo cache layer`,
  suivi de la ligne Co-Authored-By.

### Tâche E2.15 — validation de fin de PR

- [ ] À la racine : `pnpm typecheck && pnpm lint && pnpm test && pnpm test:scripts`,
  puis `cd apps/server && bun run test:integration`. Lire chaque code de sortie :
  tous doivent valoir 0.
- [ ] Piège `api-endpoints.test.ts` : `grep -n "mock.module(" src/integration-tests/api-endpoints.test.ts`
  ne doit plus citer `memory-cache`, `memory-monitor`, `pool-limiter` ni
  `schemas/validation`. Le nouveau module `rate-limiter-flexible` est déjà mocké par
  le module `rate-limit.middleware` (`:94`), et `lib/school-age.ts` n'importe aucun
  schéma Drizzle : aucun mock à ajouter.
- [ ] `pnpm dev`, puis `curl -s localhost:3000/health` : `"status":"healthy"`, sans
  clé `cache`. Les logs du serveur sont en JSON pino avec `"level":"info"`.

#### Notes de section

**Constats écartés ou corrigés :**
- Constat 1 : « empilé sur `maxRetries` de l'AI SDK → jusqu'à 12 appels ». C'est
  exact, mais à une précision près : le générateur de cartes passe par
  `generateStructured`, qui passe lui-même par l'AI SDK (`mistral-client.ts:170-181`).
  Le produit 3 × (1 + 3) = 12 suppose `MISTRAL_RETRY_ATTEMPTS` à sa valeur par
  défaut de 3.
- Constat 7 : « Zod dans `body:` via Standard Schema ». **Écarté comme cible.** La
  source unique reste TypeBox, conformément à `apps/server/CLAUDE.md` (TypeBox
  alimente Eden, Zod est réservé au hors-route) et pour ne pas faire entrer de types
  `zod` dans le `.d.ts` émis. Le support Standard Schema d'Elysia est bien vérifié
  (`elysia/dist/types.d.ts:26,318`).
- Constat 9 : l'en-tête de `voxtral-tts.service.ts` affirmant que le SDK n'expose pas
  la synthèse est faux en 2.2.5. Constat ajouté : le service envoie `voice` au lieu
  de `voice_id`, donc la voix est ignorée. C'est un bug réel, corrigé avec un test en E1.3.
- Constat 11 : `experimental_telemetry` est **déprécié** en `ai` 7 au profit de
  `telemetry` (`ai/dist/index.d.ts`, JSDoc de l'option). Le chat utilise déjà
  `telemetry`, mais aucune intégration n'était enregistrée. Enregistrer
  `@ai-sdk/otel` sans `recordInputs: false` aurait exporté les messages des élèves.
- Constat 14 : les attentes sont deux appels `docker compose` plus un contrôle doctor
  réduit à « daemon + conteneurs healthy », et non trois attentes de santé
  identiques. La conclusion ne change pas.
- Constat 15 : `doctor-checks.mjs:152-153` ne crée pas l'extension, il la vérifie.
  Seul son message est corrigé. Les créations redondantes sont dans `setup.mjs` et `ci.yml`.
- Constat 18 : rien n'est à déplacer dans `pnpm-workspace.yaml`. Les trois réglages
  sont déjà ignorés, et leurs valeurs par défaut conviennent sans le mobile.

**Non vérifié (étape de preuve prévue dans la tâche) :**
- Mots-clés JSON Schema acceptés par le mode strict de Mistral (union discriminée,
  optionnels) : E1.9, sur l'API réelle, avec un repli documenté.
- Identifiant de voix `casual_male` : E1.3, via `audio.voices.list()`.
- Attente de santé des services par le runner GitHub : non décrite par la doc
  officielle, prouvée par le log CI en E2.10.
- Code de sortie de `docker compose up --wait` en cas d'échec : prouvé en E2.9.
- Existence des secrets `TURBO_TOKEN`/`TURBO_TEAM` : vérification utilisateur en E2.14.
- Honneur de `mobile-web-app-capable` par Safari iOS : E2.13.
- Clé IP du limiteur better-auth derrière le proxy de l'hébergeur : sans
  `advanced.ipAddress.trustedProxies`, seuls les en-têtes IP à valeur unique sont
  crus (`init-options.d.mts:197-205`). À régler au lot 3 avec l'hébergement.

**Dépendances avec les autres PR :**
- A : suppression de `revenueCatWebhookSchema` (préalable de E2.6), de la route
  webhook exemptée par `skipPaths: ['/webhooks/']` (garder `skipPaths`, rien ne
  l'utilise plus : `grep -rn "skipPaths" src` après A ; s'il n'y a plus d'appelant,
  retirer l'option en E2.8).
- B : versions installées. E1.8 exige une version de `@ai-sdk/otel` dont la
  dépendance `ai` égale **exactement** la version de `ai` posée par B.
- C : E1.4 et E1.8 éditent `mistral-client.ts` et doivent conserver les options de C
  (modèles, clé de cache, `reasoningEffort`, endpoint UE). E1.1 réutilise l'URL de
  base UE de C pour `serverURL`. `cost-tracking.service.ts` n'est pas touché.
- D : aucune tâche de E ne refait les correctifs de D (requestId, onParse, en-têtes
  OTel, rowCount, quota Paris, cookies d'auth, uuid, gate CI, `PG_CONTAINER` du
  doctor, landing). E2.10 et E2.11 modifient `doctor-checks.mjs` après D : partir de
  la version post-D de `psqlScalar`.
- Lot 1 : `recordInputs`/`recordOutputs` sont à `false` partout. Si le harnais veut
  les entrées dans Langfuse, il les active par appel, sur des données de test
  uniquement.
- Lot 2 : la taxonomie des matières de l'analyse de document (E1.7) reste celle
  d'aujourd'hui, et son unification est au lot 2. `speech-normalize.ts` est réévalué
  au lot 2.
- Lot 3 : stockage du rate limit (mémoire ou `RateLimiterDrizzle`) et proxies de
  confiance, selon l'hébergement.

**Gardés, non touchés :** `lib/encryption.ts`, `.claude/hooks/*`, `speech-normalize.ts`,
`token-budget.service.ts`, `cost-tracking.service.ts` (mis à jour en C).
