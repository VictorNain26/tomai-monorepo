# Lot 4 — Chat sur Vercel AI SDK — Implementation Plan

> **STATUT : LIVRÉ** — mergé le 2026-07-05 (PR #268). Document conservé comme trace d'exécution ; ne pas exécuter.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer le protocole SSE maison du chat par le Vercel AI SDK (`streamText` + UI Message Stream) côté serveur, basculer les deux clients sur `useChat`, et supprimer le contournement HTTP de `mistral-client.ts`.

**Architecture:** Le serveur reste **autoritaire sur l'historique** (tables `study_sessions`/`messages` inchangées) : le client n'envoie que le dernier message + le contexte (`sessionId`, `subject`, …) ; le serveur réassemble system prompt + historique via l'assembler existant, streame via `streamText` (`@ai-sdk/mistral`), émet `deck-created` en data part typée, persiste dans `onFinish`. Les types `UIMessage` custom sont exportés via l'artefact de types du serveur puis re-exportés par `@repo/api`.

**Tech Stack:** `ai@^7.0.15`, `@ai-sdk/mistral@^4.0.5`, `@ai-sdk/react@^4.0.16` (clients), Zod v4 (déjà en place), Elysia 1.4/Bun.

## Global Constraints

- **Version SDK : majeure 7** (décision 2026-07-05, précise l'audit qui disait « v5 » : v5 supersedée, la v7 conserve l'architecture v5). API v7 : `isStepCount` (pas `stepCountIs`), `telemetry` (pas `experimental_telemetry`), `onFinish` accepté mais `onEnd` canonique — on utilise les noms v7 partout.
- **`prompt_cache_key` obligatoire** sur tout appel chat/completion : le provider Mistral ne l'expose PAS dans `providerOptions` (vérifié doc [ai-sdk.dev/providers/ai-sdk-providers/mistral](https://ai-sdk.dev/providers/ai-sdk-providers/mistral) : seulement `safePrompt`, `documentImageLimit/PageLimit`, `strictJsonSchema`, `structuredOutputs`, `parallelToolCalls`) → injection via `fetch` custom de `createMistral`.
- **Serveur autoritaire** : jamais l'historique complet envoyé par le client. Le client envoie le dernier `UIMessage` + champs contexte.
- **Pas de logique métier dans les route handlers** ; validation HTTP en TypeBox (règle serveur).
- **Aucun `eslint-disable`**, zéro `any`, `--max-warnings 0`.
- Guards existants conservés à l'identique : rate-limit `RateLimitPresets.ai`, quota (`QUOTA_EXCEEDED` 429), streams concurrents (`CONCURRENT_STREAM` 409), sanitisation input, timeout d'inactivité.
- Piège connu : `api-endpoints.test.ts` mocke `drizzle-orm` partiellement — tout nouvel import tiré par `app.ts` doit y être mocké (pattern `retention-purge.service`).
- Validation avant chaque commit : `cd apps/server && bun run typecheck && bun run lint && bun run test`. Avant push : `bun run test:integration` + `pnpm turbo typecheck` (frontière `build:types`).
- Doc consultée : [migration guide 7.0](https://ai-sdk.dev/docs/migration-guides/migration-guide-7-0), [Expo getting-started](https://ai-sdk.dev/docs/getting-started/expo), [chatbot-message-persistence](https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-message-persistence). En cas de doute pendant l'exécution : re-consulter, ne pas inventer.

---

### Task 1: Dépendances + provider Mistral avec `prompt_cache_key`

**Files:**
- Modify: `apps/server/package.json` (deps)
- Create: `apps/server/src/lib/ai/provider.ts`
- Test: `apps/server/src/tests/ai-provider.test.ts`

**Interfaces:**
- Produces: `mistralProvider(promptCacheKey?: string): MistralProvider` — instance `createMistral` dont le `fetch` custom injecte `prompt_cache_key` dans le body JSON de chaque requête chat/completions.

- [ ] **Step 1: Installer les deps**

```bash
cd apps/server && bun add ai@^7.0.15 @ai-sdk/mistral@^4.0.5
```

- [ ] **Step 2: Test qui échoue** — `src/tests/ai-provider.test.ts`

```ts
import { describe, expect, it } from 'bun:test';
import { generateText } from 'ai';
import { mistralProvider } from '../lib/ai/provider';

function fakeMistralResponse() {
  return new Response(
    JSON.stringify({
      id: 'cmpl-1', object: 'chat.completion', created: 0, model: 'mistral-medium-latest',
      choices: [{ index: 0, message: { role: 'assistant', content: 'ok' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    }),
    { headers: { 'content-type': 'application/json' } },
  );
}

describe('mistralProvider', () => {
  it('injecte prompt_cache_key dans le body', async () => {
    let capturedBody: Record<string, unknown> | undefined;
    const provider = mistralProvider('chat-v12', async (_url, init) => {
      capturedBody = JSON.parse(init?.body as string);
      return fakeMistralResponse();
    });
    await generateText({ model: provider('mistral-medium-latest'), prompt: 'hi' });
    expect(capturedBody?.prompt_cache_key).toBe('chat-v12');
  });

  it("n'injecte rien sans clé", async () => {
    let capturedBody: Record<string, unknown> | undefined;
    const provider = mistralProvider(undefined, async (_url, init) => {
      capturedBody = JSON.parse(init?.body as string);
      return fakeMistralResponse();
    });
    await generateText({ model: provider('mistral-medium-latest'), prompt: 'hi' });
    expect(capturedBody && 'prompt_cache_key' in capturedBody).toBe(false);
  });
});
```

- [ ] **Step 3: Vérifier l'échec** — `bun test src/tests/ai-provider.test.ts` → FAIL (module `../lib/ai/provider` absent)

- [ ] **Step 4: Implémentation** — `src/lib/ai/provider.ts`

```ts
import { createMistral, type MistralProvider } from '@ai-sdk/mistral';
import { env } from '../../config/env';

type FetchLike = typeof globalThis.fetch;

export function mistralProvider(
  promptCacheKey?: string,
  baseFetch: FetchLike = globalThis.fetch,
): MistralProvider {
  return createMistral({
    apiKey: env.MISTRAL_API_KEY,
    fetch: (async (url, init) => {
      if (!promptCacheKey || typeof init?.body !== 'string') return baseFetch(url, init);
      const body = JSON.parse(init.body) as Record<string, unknown>;
      body.prompt_cache_key = promptCacheKey;
      return baseFetch(url, { ...init, body: JSON.stringify(body) });
    }) as FetchLike,
  });
}
```

(Le second paramètre `baseFetch` existe pour la testabilité — pas de mock global.)

- [ ] **Step 5: Vérifier PASS + valider + commit**

```bash
bun test src/tests/ai-provider.test.ts && bun run typecheck && bun run lint
git add package.json ../../pnpm-lock.yaml src/lib/ai/provider.ts src/tests/ai-provider.test.ts
git commit -m "feat(chat): add AI SDK mistral provider with prompt_cache_key fetch injection"
```

---

### Task 2: Tools Zod + type `TomChatMessage`

**Files:**
- Create: `apps/server/src/services/chat/chat-tools.ts`
- Create: `apps/server/src/services/chat/chat-ui-message.ts`
- Test: `apps/server/src/tests/chat-tools.test.ts`
- Reference (à convertir, PAS encore supprimer): `src/services/chat/tool-declarations.ts`, `src/services/chat/tool-executor.ts`

**Interfaces:**
- Consumes: les exécuteurs existants de `tool-executor.ts` (recherche RAG avec fencing `wrapCurriculumToolResult`, génération flashcards, etc. — reprendre les 5 outils déclarés dans `tool-declarations.ts`).
- Produces:
  - `buildChatTools(ctx: ChatToolContext): ToolSet` — les 5 outils en `tool()` AI SDK avec `inputSchema` Zod v4, `execute` délégant aux exécuteurs existants. `ChatToolContext = { userId: string; sessionId: string; schoolLevel?: string; emitDeckCreated: (d: DeckCreatedData) => void }` (étendre si un exécuteur existant exige plus).
  - `type TomChatTools = InferUITools<ReturnType<typeof buildChatTools>>`
  - `chat-ui-message.ts` : `type DeckCreatedData = { deckId: string; title: string; cardCount: number; subject: string }` ; `type TomDataParts = { 'deck-created': DeckCreatedData }` ; `type TomMetadata = { usedRAG?: boolean; toolsUsed?: string[]; speakable?: string }` ; `export type TomChatMessage = UIMessage<TomMetadata, TomDataParts, TomChatTools>`.

- [ ] **Step 1: Test qui échoue** — `src/tests/chat-tools.test.ts` : construire `buildChatTools` avec un contexte factice, vérifier (a) que les 5 clés d'outils existent avec les mêmes noms que `tool-declarations.ts` (dont `search_educational_content`), (b) que `search_educational_content.inputSchema` rejette `niveau: 'licence'` et accepte `niveau: '6e'` (reprendre les enums exacts de `tool-declarations.ts:36-73`), (c) qu'un `execute` sur l'outil flashcards appelle `emitDeckCreated` (mocker l'exécuteur sous-jacent comme le fait le test existant de `tool-executor`).
- [ ] **Step 2: `bun test src/tests/chat-tools.test.ts`** → FAIL
- [ ] **Step 3: Implémenter** `chat-tools.ts` : traduire chaque déclaration JSON Schema en Zod v4 (`z.object`, `z.enum` — copier les descriptions existantes mot à mot, elles sont du prompt engineering), `execute` = wrapper fin autour de `tool-executor.ts` (ne pas dupliquer la logique ; le fencing du résultat curriculum reste appliqué au retour). L'outil flashcards appelle `ctx.emitDeckCreated({...})` avec les données que l'exécuteur retourne (aujourd'hui envoyées dans le chunk `deck_created`, cf. `chat-streaming-types.ts:94-99`).
- [ ] **Step 4: PASS + typecheck + lint**
- [ ] **Step 5: Commit** — `feat(chat): AI SDK tools (zod) and TomChatMessage type`

---

### Task 3: Service de streaming AI SDK

**Files:**
- Create: `apps/server/src/services/chat/ai-chat.service.ts`
- Test: `apps/server/src/tests/ai-chat-service.test.ts`
- Reference: `src/services/chat/mistral-chat.service.ts` (assemblage lignes 141-164, boucle 200-379), `chat-message-assembler.ts`, `mistral-helpers.ts`, `lib/ai/mistral-reasoning.ts`

**Interfaces:**
- Consumes: `mistralProvider` (Task 1), `buildChatTools` (Task 2), `buildSystemPromptForChat()`, `assembleChatMessages()` (existants — réutilisés tels quels), `resolveReasoningEffort` de `mistral-reasoning.ts`.
- Produces: `streamChat(params: ChatStreamParams): StreamTextResult` où `ChatStreamParams` reprend les champs de `StreamGenerationParams` (`mistral-client.ts:32-71`) + `{ tools: ToolSet }`. Le service : (1) assemble system + historique en `ModelMessage[]` via l'assembler existant, (2) appelle `streamText` avec `model: mistralProvider(cacheKey)(env.MISTRAL_MODEL)`, `stopWhen: isStepCount(5)` (= `MAX_TOOL_ITERATIONS` actuel), `temperature`/`maxOutputTokens` depuis env, `reasoning: 'high'` si `resolveReasoningEffort(...)` le décide (param top-level v7 supporté par le provider Mistral), `providerOptions: { mistral: { parallelToolCalls: false } }`, `telemetry: { isEnabled: true, functionId: 'chat-stream' }`, `abortSignal: AbortSignal.timeout(env.CHAT_STREAM_TIMEOUT_MS)`.

- [ ] **Step 1: Test qui échoue** — utiliser le mock provider du SDK (`import { MockLanguageModelV3 } from 'ai/test'` — vérifier le nom exact exporté par `ai/test` en v7 dans `node_modules/ai/test.d.ts` avant d'écrire ; si le nom diffère, adapter) + `simulateReadableStream` pour vérifier : (a) le system prompt assemblé est bien le premier message, (b) `stopWhen` coupe après 5 steps, (c) les chunks texte sortent dans l'ordre.
- [ ] **Step 2: FAIL** → **Step 3: Implémenter** (service fin : AUCUNE logique de parsing/boucle — `streamText` gère la boucle agentique qui occupait `mistral-chat.service.ts:200-379`).
- [ ] **Step 4: PASS + typecheck + lint** → **Step 5: Commit** — `feat(chat): streamText chat service (agentic loop via AI SDK)`

---

### Task 4: Route `/api/chat/stream` en UI Message Stream + persistance `onFinish`

**Files:**
- Modify: `apps/server/src/routes/chat-message.routes.ts` (handler lignes 36-196)
- Modify: `apps/server/src/services/chat/chat-orchestration.service.ts` (persistance/post-process branchés sur `onFinish`)
- Test: `apps/server/src/tests/chat-stream-route.test.ts`

**Interfaces:**
- Consumes: `streamChat` (Task 3), `buildChatTools` (Task 2), `createUIMessageStream`/`createUIMessageStreamResponse` (`ai`), services existants : quota, concurrence, sanitisation, `saveMessage`, `tokenQuotaService.incrementTokenUsage`, `costTrackingService.record`, `summarizationService.summarizeIfNeeded`, `autoTitleService.generateTitleIfNeeded`.
- Produces: `POST /api/chat/stream` acceptant `{ message: t.Unknown(), sessionId: t.String(), subject: t.Optional(t.String()), ... }` (mêmes champs contexte que le body actuel ; `message` = dernier `UIMessage` du client, texte extrait de ses parts et sanitizé comme aujourd'hui). Retourne le protocole **UI Message Stream** standard.

Contrat de flux :

```ts
const stream = createUIMessageStream<TomChatMessage>({
  execute: ({ writer }) => {
    const tools = buildChatTools({ userId, sessionId, schoolLevel,
      emitDeckCreated: d => writer.write({ type: 'data-deck-created', data: d }) });
    const result = streamChat({ ...params, tools });
    writer.merge(result.toUIMessageStream());
  },
  onFinish: async ({ responseMessage }) => { /* postProcess() actuel : saveMessage user+assistant, quota, cost, summarize/title fire-and-forget, release concurrence */ },
  onError: error => { /* release concurrence + message safe (jamais l'erreur brute provider) */ },
});
return createUIMessageStreamResponse({ stream });
```

Les erreurs de garde AVANT stream restent des réponses JSON avec les mêmes codes/status qu'aujourd'hui (`QUOTA_EXCEEDED` 429, `CONCURRENT_STREAM` 409) — les clients les traitent hors streaming.

- [ ] **Step 1: Tests qui échouent** : (a) 401 sans session (guard existant), (b) 429 quota dépassé (mock quota service) au format JSON actuel, (c) réponse 200 avec `content-type` du UI Message Stream (`text/event-stream` + header `x-vercel-ai-ui-message-stream: v1` — vérifier la valeur exacte émise par `createUIMessageStreamResponse` dans `node_modules/ai` plutôt que de la deviner), (d) `onFinish` déclenche `saveMessage` pour user + assistant (mock repo), (e) la concurrence est libérée même si le stream jette.
- [ ] **Step 2: FAIL** → **Step 3: Implémenter** (route fine, orchestration dans le service).
- [ ] **Step 4: PASS + typecheck + lint + `bun run test`** (suite complète — la route est un point chaud)
- [ ] **Step 5: Commit** — `feat(chat): serve chat as AI SDK UI message stream with onFinish persistence`

---

### Task 5: Migration interne de `generateText`/`generateStructured` + suppression du fetch brut

**Files:**
- Modify: `apps/server/src/lib/ai/mistral-client.ts` (486 lignes → ~150)
- Modify: `apps/server/package.json` (retirer `@mistralai/mistralai`)
- Test: adapter `src/tests/` existants qui mockent le fetch Mistral (chercher `mistral` dans `src/tests/`)

**Interfaces:**
- Consumes: `mistralProvider` (Task 1), `generateText`/`generateObject` + `jsonSchema()` de `ai`.
- Produces: **signatures publiques inchangées** — `generateText({ messages, model, temperature, maxTokens, promptCacheKey, timeoutMs })`, `generateStructured<T>({ ..., schema })` — mais les internals passent par le SDK (`generateObject` avec `jsonSchema(schema)` pour les schémas JSON bruts existants ; ne PAS convertir les schémas des services appelants dans ce lot). `chatStream` (l'ancien générateur SSE, lignes 319-485) est **supprimé** — plus aucun appelant après Task 4.

- [ ] **Step 1: Écrire/adapter les tests** sur les deux fonctions (mock `baseFetch` comme Task 1 ; asserts : body `prompt_cache_key`, `max_tokens`, `response_format` JSON Schema strict).
- [ ] **Step 2: FAIL** → **Step 3: Implémenter** ; supprimer le parsing SSE manuel (lignes 381-485), le type `ChatStreamChunk` interne (ligne 125 — résout le doublon de nom), et `@mistralai/mistralai` du package.json (`bun remove @mistralai/mistralai`). Vérifier au grep qu'aucun import du SDK Mistral ne subsiste : `grep -rn "@mistralai/mistralai" src/`.
- [ ] **Step 4: PASS + suite complète** → **Step 5: Commit** — `refactor(server): route all Mistral calls through AI SDK, drop raw HTTP client`

---

### Task 6: Suppression du protocole wire maison + export des types via `@repo/api`

**Files:**
- Delete (contenu wire): `apps/server/src/services/chat/chat-streaming-types.ts` (types SSE lignes 73-113 ; conserver dans un fichier séparé ce qui est encore consommé ailleurs, ex. `StreamGenerationParams` → déplacer vers `ai-chat.service.ts`)
- Modify: `apps/server/src/app.ts` (export type-only : `export type { TomChatMessage, TomDataParts, DeckCreatedData } from './services/chat/chat-ui-message'`)
- Modify: `packages/api/src/types.ts` (re-export : `export type { TomChatMessage, TomDataParts, DeckCreatedData } from 'tomai-server/app'`)
- Test: `pnpm turbo typecheck` (monorepo — vérifie que le `.d.ts` buildé reste nommable, piège `build:types` connu)

- [ ] **Step 1: Supprimer les types wire + brancher les exports** (les types doivent être exportés nommés, sinon l'émission `.d.ts` échoue — cf. règle `CredentialOutput` du CLAUDE.md serveur)
- [ ] **Step 2: `grep -rn "chat-streaming-types\|deck_created\|\[DONE\]" apps/server/src/`** → zéro résultat wire côté serveur
- [ ] **Step 3: `cd apps/server && bun run build:types && pnpm turbo typecheck`** → PASS monorepo (web/mobile vont casser sur leurs parseurs — c'est attendu, Tasks 7-8 les migrent ; si le typecheck monorepo bloque, séquencer : committer serveur, puis clients, et ne pousser qu'après Task 8)
- [ ] **Step 4: Commit** — `refactor(chat): drop custom SSE wire protocol, export UIMessage types via @repo/api`

---

### Task 7: Mobile — bascule sur `useChat`

**Files:**
- Modify: `apps/mobile/package.json` (`bun`/`pnpm add @ai-sdk/react@^4.0.16 ai@^7.0.15` ; retirer `react-native-sse`)
- Modify: `apps/mobile/src/hooks/useChat.ts` + Delete: `src/hooks/chat/useStreamManager.ts`, `src/hooks/chat/api.ts` (parsing SSE)
- Modify: l'écran chat `src/app/(student)/(chat)/chat.tsx` (rendu par `parts`)
- Test: `apps/mobile/__tests__/hooks/useChat.test.ts` (adapter)

**Interfaces:**
- Consumes: `TomChatMessage` via `@repo/api` ; `useChat` de `@ai-sdk/react` avec `DefaultChatTransport` :

```ts
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { fetch as expoFetch } from 'expo/fetch';
import type { TomChatMessage } from '@repo/api';

const { messages, sendMessage, status, error } = useChat<TomChatMessage>({
  transport: new DefaultChatTransport({
    fetch: expoFetch as unknown as typeof globalThis.fetch,
    api: `${getBaseUrl()}/api/chat/stream`,
    credentials: 'include',
    prepareSendMessagesRequest: ({ messages, body }) => ({
      body: { message: messages.at(-1), ...body },  // serveur autoritaire : dernier message seul
    }),
  }),
  messages: initialMessagesFromHistory,  // conversion history Eden → TomChatMessage[]
});
```

- Produces: même surface publique pour les écrans (le hook `useChat.ts` maison devient un wrapper fin : historique TanStack Query → `messages` initiaux, `sendMessage` avec body contexte `{ sessionId, subject, pronoteContext... }`, gestion des erreurs 429/409 JSON hors-stream comme aujourd'hui, data part `data-deck-created` → même callback deck qu'actuellement, invalidation des query keys conversations).

- [ ] **Step 1: Adapter les tests du hook** (le mock EventSource disparaît ; mocker le transport)
- [ ] **Step 2: FAIL** → **Step 3: Implémenter** (auth : cookies Better Auth via `credentials: 'include'` + header depuis expo-secure-store comme les appels Eden actuels — reprendre exactement le mécanisme d'auth des requêtes `fetch` existantes de `hooks/chat/api.ts` avant de le supprimer)
- [ ] **Step 4: `pnpm typecheck && pnpm lint && pnpm test`** → PASS
- [ ] **Step 5: Commit** — `feat(mobile): switch chat to AI SDK useChat, drop react-native-sse`

---

### Task 8: Web — bascule sur `useChat`

**Files:**
- Modify: `apps/web/package.json` (`pnpm add @ai-sdk/react@^4.0.16 ai@^7.0.15`)
- Modify: `apps/web/lib/hooks/use-chat.ts` + Delete: `apps/web/lib/chat/stream-chat.ts`
- Test: adapter `apps/web/lib/hooks/use-chat.test.tsx`

Migration miroir de Task 7 sans `expoFetch` (fetch DOM natif), `credentials: 'include'` conservé. Le wrapper garde les query keys de `lib/chat/chat-keys.ts`. (App legacy supprimée au Lot 5 — migration minimale, aucun embellissement.)

- [ ] **Step 1: Adapter les tests** → **Step 2: FAIL** → **Step 3: Implémenter** → **Step 4: `pnpm typecheck && pnpm lint && pnpm test`** PASS
- [ ] **Step 5: Commit** — `feat(web): switch chat to AI SDK useChat`

---

### Task 9: Filet de sécurité final + e2e

**Files:**
- Modify: `apps/server/src/tests/api-endpoints.test.ts` (mocker les nouveaux modules tirés par `app.ts` — piège drizzle partiel)
- Modify: `apps/server/CLAUDE.md` (section « Couche AI » : `chatStream` n'existe plus, décrire provider + `ai-chat.service`), `docs/architecture/system-design.md` (§8 : lot 4 ✅ ; §4 : retirer la mention « 🔄 Lot 4 »)

- [ ] **Step 1: `cd apps/server && bun run test:integration`** → PASS (corriger les mocks sinon)
- [ ] **Step 2: Suite complète monorepo** : `pnpm turbo typecheck && pnpm lint && pnpm turbo test` → tout vert, zéro warning
- [ ] **Step 3: Preuve runtime** (pas seulement les tests) : `pnpm dev` + envoyer un message chat réel depuis le mobile (ou `curl -N` sur `/api/chat/stream` avec un cookie de session seedé) et **voir** les chunks UI Message Stream + la persistance en DB + un `deck-created` sur une demande de flashcards
- [ ] **Step 4: e2e Maestro** `chat-send-message` sur l'émulateur (signal)
- [ ] **Step 5: Mettre à jour les docs + commit final** — `docs(chat): reflect AI SDK migration in server guide and system design`

---

## Self-review (fait à la rédaction)

- **Couverture spec** : streamText/UIMessageStream ✅ (T3-T4), tools Zod ✅ (T2), `prompt_cache_key` ✅ (T1), `onFinish` persistance ✅ (T4), OTel ✅ (T3 `telemetry`), types via `@repo/api` ✅ (T6), obsolescence contournement HTTP ✅ (T5), data parts `deck_created` ✅ (T2/T4/T7), clients ✅ (T7-T8).
- **Écart assumé vs audit** : majeure 7 au lieu de « v5 » (constat npm 2026-07-05 : v5 supersedée ; architecture identique) ; clients inclus dans le lot (sinon `main` casse).
- **Restes hors scope (YAGNI ici)** : résumés/summarization refactor, mémoire épisodique, `toolChoice` forcé (= Lot 7, s'appuiera sur T3), suppression `react-native-sse` du lockfile racine si partagé.
