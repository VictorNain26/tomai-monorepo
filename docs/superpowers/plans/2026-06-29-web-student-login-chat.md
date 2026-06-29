# Web — parcours élève : login (username) + chat SSE — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Permettre à un élève de se connecter (username) et de discuter avec le tuteur IA Tom en streaming temps réel.

**Architecture:** Le login web gagne le mode username (better-auth username plugin client). Le chat consomme `POST /api/chat/stream` via `fetch` + `ReadableStream` (le endpoint est POST+SSE, `EventSource` natif ne fait que GET). Sessions/historique via Eden Treaty. État local React + `useUser` pour `schoolLevel`/`firstName`/`id`.

**Tech Stack:** Next.js 16, React 19, better-auth client (username plugin), `@repo/api` (Eden + `getBaseUrl`), `@repo/ui`, TanStack Query (sessions).

## Global Constraints

- **AUCUN Pronote dans le web** : le chat web n'envoie PAS de `pronoteContext` (le backend le gère comme optionnel).
- Pas de tests automatisés écrits (décision utilisateur) — validation typecheck/lint/test + vérification comportementale par le contrôleur. Tests Vitest existants verts.
- Validation avant commit : `cd apps/web && pnpm typecheck && pnpm lint && pnpm test`.
- UI via `@repo/ui` ; tokens `@repo/tokens` ; zéro valeur hardcodée ; zéro commentaire séparateur. TS strict, **zéro `any`**.
- `useUser()` renvoie null pendant le chargement de session ET hors-auth → garder via `enabled`/garde, jamais de redirect dans un composant (proxy protège `/student/*`).
- Stager explicitement ; conventional commits scope `web`. Branche : `feat/web-student-chat`.
- **Hors périmètre de ce lot (différés)** : pièces jointes (presign/upload), entrée vocale (STT/TTS), génération de decks inline (le chunk `deck_created` est ignoré proprement), liste multi-conversations (une session active suffit).

## Contrat SSE (vérifié — référence pour Tasks 2-3)

- **Requête** : `POST {baseUrl}/api/chat/stream`, `credentials: 'include'`, `Content-Type: application/json`.
  Body : `{ content: string, data: { sessionId?: string, schoolLevel: string, firstName?: string, fileIds: string[] } }` (`fileIds: []` en web). Pas de `pronoteContext`.
- **Pré-stream (HTTP)** : si bloqué, le serveur répond en HTTP **avant** le flux — `429` `{ error: { code: "QUOTA_EXCEEDED", ... }, usage }`, `409` `{ error: { code: "CONCURRENT_STREAM" } }`. Donc : `if (!res.ok)` → parse JSON, throw avec code+message.
- **Flux SSE** : lignes `data: {json}\n\n`. Marqueur de fin : `data: [DONE]`. Chaque json = `ChatStreamChunk` :
  - `{ type: "content", content: string, role: "assistant", ... }` — `content` = texte **accumulé complet** (remplacer, ne pas concaténer).
  - `{ type: "status", status: string }` — libellé d'activité (« Recherche… »).
  - `{ type: "deck_created", deck: {...} }` — **ignoré** dans ce lot.
  - `{ type: "done", finishReason, metadata?: { sessionId } }`.
  - `{ type: "error", error: { message } }`.
- **Timeout d'inactivité** : 90 s sans chunk → abort côté client (`AbortController`).

## Endpoints sessions (Eden Treaty)

`POST /api/chat/session` (getOrCreate → `{ session: { id } }`) · `GET /api/chat/session/:id/history` (`{ messages: [{id, role, content}], hasOrphanMessage }`) · `POST /api/chat/session/:id/reset` · `DELETE /api/chat/session/:id`. Dériver les types via Eden, ne pas présumer.

---

### Task 1 : Login élève par username

**Files:**
- Modify: `apps/web/lib/auth-client.ts`
- Modify: `apps/web/app/login/page.tsx`

**Interfaces:**
- Produces: `signIn.username` disponible ; login page accepte email **ou** identifiant.

- [ ] **Step 1: Activer le plugin username client**

Dans `lib/auth-client.ts`, ajouter le plugin : `import { usernameClient } from "better-auth/client/plugins";` puis `createAuthClient({ baseURL, plugins: [usernameClient()] })`. Réexporter `signIn` (inclut maintenant `.username`).

- [ ] **Step 2: Login page — email ou identifiant**

Dans `app/login/page.tsx` (mode `signin`) : renommer le champ en « Email ou identifiant » (`type="text"`, plus `type="email"`). À la soumission, détecter : `const isEmail = value.includes("@");` → `isEmail ? signIn.email({ email: value, password }) : signIn.username({ username: value, password })`. Le `signup` reste email-only (création de compte parent). Conserver `resolveWebRole` + redirection `ROLE_HOME[role]` (un élève a `role: "student"` → `/student`).

- [ ] **Step 3: Vérifier**

Run: `cd apps/web && pnpm typecheck && pnpm lint && pnpm test` → vert.
Vérification contrôleur : login `dev.eleve` / `DevEleve123!` → redirige vers `/student` (HTTP). (Backend `POST /api/auth/sign-in/username` déjà confirmé fonctionnel.)

- [ ] **Step 4: Commit**

```bash
git add apps/web/lib/auth-client.ts apps/web/app/login/page.tsx
git commit -m "feat(web): support student login by username"
```

---

### Task 2 : Helper de streaming SSE

**Files:**
- Create: `apps/web/lib/chat/stream-chat.ts`

**Interfaces:**
- Produces:
  - `type ChatStreamHandlers = { onContent: (full: string) => void; onStatus: (s: string) => void; onError: (msg: string) => void; onDone: (meta?: { sessionId?: string }) => void }`
  - `class ChatStreamError extends Error { code?: string }`
  - `async function streamChat(body: { content: string; sessionId?: string; schoolLevel: string; firstName?: string }, handlers: ChatStreamHandlers, signal: AbortSignal): Promise<void>`

- [ ] **Step 1: Implémenter `stream-chat.ts`**

Logique :
- `const res = await fetch(`${getBaseUrl()}/api/chat/stream`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: body.content, data: { sessionId: body.sessionId, schoolLevel: body.schoolLevel, firstName: body.firstName, fileIds: [] } }), signal })`.
- `if (!res.ok || !res.body)` → `const err = await res.json().catch(() => null)` ; throw `ChatStreamError` avec `code = err?.error?.code` et message lisible (mapper `QUOTA_EXCEEDED` → « Quota de questions atteint. », `CONCURRENT_STREAM` → « Une réponse est déjà en cours. », défaut → message serveur).
- Lire : `const reader = res.body.getReader(); const decoder = new TextDecoder();` boucle `read()`, accumuler dans un buffer string, séparer sur `"\n\n"`. Pour chaque event : extraire la/les ligne(s) commençant par `"data: "`, prendre le payload ; si `=== "[DONE]"` → `handlers.onDone()` et terminer ; sinon `JSON.parse` → selon `chunk.type` appeler `onContent(chunk.content)` / `onStatus(chunk.status)` / `onError(chunk.error?.message ?? "Erreur")` / `onDone(chunk.metadata)` ; `deck_created` ignoré.
- Timeout d'inactivité : `setTimeout` 90 s réarmé à chaque chunk reçu ; à expiration, abort + `onError("Le serveur ne répond plus. Réessaie.")`. Nettoyer le timer en fin.
- Type local `ChatStreamChunk` (union sur `type`) — ce contrat SSE n'est pas exposé par Eden, le définir ici, aligné sur la section « Contrat SSE ».

- [ ] **Step 2: Vérifier**

Run: `cd apps/web && pnpm typecheck && pnpm lint` → vert (zéro `any` ; le chunk parsé est typé via le type local).

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/chat/stream-chat.ts
git commit -m "feat(web): add SSE streaming helper for chat (fetch + ReadableStream)"
```

---

### Task 3 : Hook `use-chat`

**Files:**
- Create: `apps/web/lib/hooks/use-chat.ts`

**Interfaces:**
- Consumes: `streamChat` (Task 2), `getTreaty`/`unwrap` (`@repo/api`), `useUser` (`@/lib/auth-client`).
- Produces: `useChat()` → `{ messages: ChatMessage[], isLoading, isStreaming, streamStatus, error, sendMessage: (text: string) => void, reset: () => void }` avec `type ChatMessage = { id: string; role: "user" | "assistant"; content: string }`.

- [ ] **Step 1: Implémenter `use-chat.ts`**

- Au montage (user présent) : `useQuery` ou effet → `getOrCreate session` (`getTreaty().api.chat.session.post()`), stocker `sessionId` ; puis charger l'historique (`...session({ id }).history.get()`), peupler `messages`. Garder `enabled: !!user?.id`.
- `sendMessage(text)` : ignorer si vide ou `isStreaming`. Ajouter `{ role: "user", content: text }` + un message assistant vide ; `setIsStreaming(true)`, `setError(null)`. `const ac = new AbortController()` (stocker en ref pour `reset`). Appeler `streamChat({ content: text, sessionId, schoolLevel: user.schoolLevel ?? "", firstName: user.firstName }, handlers, ac.signal)` :
  - `onContent(full)` → remplacer le `content` du dernier message assistant par `full`.
  - `onStatus(s)` → `setStreamStatus(s)`.
  - `onError(msg)` → `setError(msg)` ; retirer le message assistant vide s'il n'a rien reçu ; `setIsStreaming(false)`.
  - `onDone()` → `setIsStreaming(false)`, `setStreamStatus("")`.
  - `.catch` (ChatStreamError) → `setError(err.message)` ; `setIsStreaming(false)`.
- `reset()` : abort le stream courant ; `POST .../reset` ; vider `messages`.
- `id` des messages : un compteur/`crypto.randomUUID()` (côté client, OK).

- [ ] **Step 2: Vérifier**

Run: `cd apps/web && pnpm typecheck && pnpm lint && pnpm test` → vert.

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/hooks/use-chat.ts
git commit -m "feat(web): add use-chat hook (session, history, streaming send)"
```

---

### Task 4 : Composants UI du chat

**Files:**
- Create: `apps/web/components/student/chat/chat-message.tsx`
- Create: `apps/web/components/student/chat/chat-message-list.tsx`
- Create: `apps/web/components/student/chat/chat-input.tsx`
- Create: `apps/web/components/student/chat/chat-status.tsx`

**Interfaces:**
- Consumes: `ChatMessage` (Task 3), primitives `@repo/ui`.

- [ ] **Step 1: Composants**

- `chat-message.tsx` : bulle alignée droite (user) / gauche (assistant), tokens (`bg-primary text-primary-foreground` pour user, `bg-muted` pour assistant), texte avec `whitespace-pre-wrap`, lisible (≥44px d'interaction non requis, c'est du texte).
- `chat-message-list.tsx` : conteneur scrollable, `role="log"` `aria-live="polite"`, auto-scroll vers le bas quand `messages` change ou pendant le streaming (ref + `useEffect`).
- `chat-input.tsx` : `textarea` (Enter pour envoyer, Shift+Enter = nouvelle ligne) + bouton `Button` envoyer ; `disabled` pendant `isStreaming` ; label accessible. Props : `onSend(text)`, `disabled`.
- `chat-status.tsx` : ligne discrète affichant `streamStatus` (spinner `Loader2` + texte) quand non vide.

- [ ] **Step 2: Vérifier**

Run: `cd apps/web && pnpm typecheck && pnpm lint` → vert.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/student/chat
git commit -m "feat(web): add chat UI components (message list, input, status)"
```

---

### Task 5 : Page `/student/chat` + navigation + vérification visuelle

**Files:**
- Create: `apps/web/app/student/chat/page.tsx`
- Modify: layout/nav student (le `DashboardShell` du groupe `/student` — repérer le fichier `app/student/layout.tsx` ou équivalent) pour ajouter un lien « Chat ».

**Interfaces:**
- Consumes: `useChat` (Task 3), composants chat (Task 4).

- [ ] **Step 1: Page chat**

`app/student/chat/page.tsx` (`"use client"`) : `useChat()` → header (titre + bouton « Nouvelle conversation » appelant `reset`), `ChatMessageList` (avec état vide « Pose ta première question à Tom » si `messages` vide et pas en chargement, skeleton si `isLoading`), `ChatStatus`, bannière `error` (`role="alert"` + tokens), `ChatInput` en bas (`onSend={sendMessage}`, `disabled={isStreaming}`). Layout pleine hauteur (input collé en bas).

- [ ] **Step 2: Nav student**

Ajouter l'entrée « Chat » → `/student/chat` dans la navigation du groupe student (mécanisme `NavItem`/`DashboardShell` déjà utilisé pour le parent). Vérifier que `/student` reste accessible.

- [ ] **Step 3: Vérifier (typecheck + lint + tests)**

Run: `cd apps/web && pnpm typecheck && pnpm lint && pnpm test` → vert.

- [ ] **Step 4: Vérification visuelle/comportementale (contrôleur)**

Backend lancé (Mistral configuré). Login `dev.eleve` → `/student/chat`. Envoyer « Explique-moi le théorème de Pythagore » → une réponse de Tom arrive en **streaming** (le contenu s'affiche progressivement), le `streamStatus` apparaît, puis se termine. Vérifier : état vide initial, message user à droite, réponse assistant à gauche, bannière d'erreur si backend coupé, « Nouvelle conversation » vide la vue. (Vérification comportementale via `curl` sur `/api/chat/stream` si pas de navigateur : confirmer la réception des chunks SSE.)

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/student/chat apps/web/app/student
git commit -m "feat(web): wire student chat page with streaming + nav"
```

---

## Self-Review

- **Coverage** : login username → Task 1 ; streaming helper → Task 2 ; hook session/history/send → Task 3 ; UI → Task 4 ; page + nav + vérif → Task 5. Contrat SSE (pré-stream HTTP errors, chunks, [DONE], timeout 90s) couvert Task 2.
- **Types** : `ChatMessage` (Task 3) réutilisé Tasks 4-5 ; `ChatStreamHandlers`/`streamChat` (Task 2) consommés Task 3.
- **Hors scope explicite** : pièces jointes, vocal, decks inline, multi-conversations — différés (lots ultérieurs).
