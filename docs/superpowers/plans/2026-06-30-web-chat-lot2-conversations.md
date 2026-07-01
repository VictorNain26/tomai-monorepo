> **⚠️ SUPERSEDED (2026-07-01)** — `apps/web` est legacy : décision [ADR 0001](../../adr/0001-universal-consumer-app.md) (app conso universelle Expo, PR #260) + audit `docs/audits/2026-07-01-curriculum-to-frontend-architecture.md`. Aucun nouveau lot web Next ; suppression d'apps/web au cutover. Document conservé comme trace historique.

# Web Chat Lot 2 — Liste de conversations (parité web) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Donner au chat élève web la parité fonctionnelle du mobile : liste de conversations, nouvelle conversation non destructive, reprise au clic, suppression — en layout sidebar split (style ChatGPT/Claude).

**Architecture:** 100 % `apps/web` — le serveur expose déjà tous les endpoints (`GET /api/chat/conversations`, `POST /api/chat/session/new`, `DELETE /api/chat/session/:id`). On transpose la logique mobile (`useConversations`) en hook web, on rend `use-chat` piloté par un `sessionId` actif (au lieu d'un getOrCreate implicite), et la page `/student/chat` devient un container [sidebar présentationnelle | panneau conversation active]. Pas de nouvelle route, pas de changement serveur, pas de touche au mobile.

**Tech Stack:** Next.js 16 (App Router), React 19, TanStack Query v5, `@repo/api` (Eden Treaty), `@repo/ui` (shadcn), TailwindCSS 4 + `@repo/tokens`, lucide-react. Tests : Vitest + `@testing-library/react` (jsdom), fichiers `*.test.ts(x)` colocalisés.

## Global Constraints

- **Web ne partage aucun composant avec le mobile** (primitives RN ≠ DOM) — on partage le backend (`@repo/api`) et les tokens. Transposer la *logique*, pas le JSX.
- **JAMAIS de composant UI custom** → `@repo/ui` (Button, Badge, Skeleton, AlertDialog…). **JAMAIS de CSS custom ni style inline** → Tailwind + tokens `@repo/tokens` (zéro couleur/espacement hardcodé).
- **TypeScript strict, zéro `any`.** React 19 : pas de `forwardRef` (ref = prop), pas de `useContext`.
- **Lint = zéro warning** (`eslint . --max-warnings 0`).
- **a11y non négociable** : rôles sémantiques, `aria-*`, focus visible, cibles ≥44px, contraste AA. Tout interactif a hover/focus/disabled ; toute vue a loading/empty/error.
- **Mobile-first responsive** : sidebar en colonne sur `md+`, en drawer overlay sur petit écran.
- **Types serveur dérivés du contrat Eden** (source unique de vérité) via `ResponseData<...>` — jamais retapés à la main.
- **Pas de nouvelle entrée nav** : le sidebar split garde l'unique entrée « Chat ».
- **Validation avant commit** : `cd apps/web && pnpm typecheck && pnpm lint && pnpm test`.

---

## File Structure

| Fichier | Rôle | Action |
|---|---|---|
| `apps/web/lib/chat/chat-keys.ts` | Clés TanStack Query partagées (`conversations`, `history`) — invalidation cross-hook cohérente, alignées sur la convention mobile | Create |
| `apps/web/lib/chat/format-relative-date.ts` | Helper pur date relative FR | Create |
| `apps/web/lib/hooks/use-conversations.ts` | Hook liste : fetch + create + delete via `@repo/api` (miroir du hook mobile) | Create |
| `apps/web/lib/hooks/use-chat.ts` | Piloté par `{ sessionId }` : charge l'historique de la conversation active, stream, invalide la liste au `done`. Retrait du getOrCreate implicite et du `reset` | Modify |
| `apps/web/components/student/chat/conversation-list-item.tsx` | Ligne présentationnelle : matière (Badge), titre, preview, date, suppression (AlertDialog) | Create |
| `apps/web/components/student/chat/conversation-sidebar.tsx` | Panneau présentationnel : header « + Nouvelle », liste, états loading/empty/error | Create |
| `apps/web/app/student/chat/page.tsx` | Container : `useConversations` + `useChat` + sélection active + layout responsive sidebar/panneau | Modify |

Tests colocalisés : `format-relative-date.test.ts`, `use-conversations.test.tsx`, `conversation-list-item.test.tsx`, `conversation-sidebar.test.tsx`, `use-chat.test.tsx`.

**Décision tranchée (clé de session)** : la divergence « web keye sur `user.id`, mobile sur clé fixe » portait sur la query *getOrCreate session*. En Lot 2, la conversation rendue est keyée **par `sessionId`** (`history(sessionId)`) et la liste par `conversations()` — exactement la convention mobile. Le getOrCreate implicite disparaît côté web (la conversation active est explicite). On harmonise donc au niveau de la **convention de clés** (`chat-keys.ts`), sans toucher au mobile (qui fonctionne et serait hors scope).

---

## Task 1: Clés de query partagées + helper date

**Files:**
- Create: `apps/web/lib/chat/chat-keys.ts`
- Create: `apps/web/lib/chat/format-relative-date.ts`
- Test: `apps/web/lib/chat/format-relative-date.test.ts`

**Interfaces:**
- Produces: `chatQueryKeys.conversations(): readonly ['chat','conversations']`, `chatQueryKeys.history(sessionId: string): readonly ['chat','history', string]`.
- Produces: `formatRelativeDate(iso: string): string`.

- [ ] **Step 1: Create the shared query keys**

```ts
// apps/web/lib/chat/chat-keys.ts
/**
 * Clés TanStack Query partagées par use-chat et use-conversations, pour que
 * l'invalidation cross-hook touche les mêmes entrées de cache. Alignées sur la
 * convention mobile (apps/mobile/src/hooks/chat/api.ts).
 */
export const chatQueryKeys = {
  conversations: () => ["chat", "conversations"] as const,
  history: (sessionId: string) => ["chat", "history", sessionId] as const,
};
```

- [ ] **Step 2: Write the failing test for the date helper**

```ts
// apps/web/lib/chat/format-relative-date.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { formatRelativeDate } from "./format-relative-date";

describe("formatRelativeDate", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-30T12:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("returns 'à l'instant' under a minute", () => {
    expect(formatRelativeDate("2026-06-30T11:59:30Z")).toBe("à l'instant");
  });
  it("returns minutes under an hour", () => {
    expect(formatRelativeDate("2026-06-30T11:30:00Z")).toBe("il y a 30 min");
  });
  it("returns hours under a day", () => {
    expect(formatRelativeDate("2026-06-30T09:00:00Z")).toBe("il y a 3 h");
  });
  it("returns days under a week", () => {
    expect(formatRelativeDate("2026-06-28T12:00:00Z")).toBe("il y a 2 j");
  });
  it("returns an absolute short date beyond a week", () => {
    expect(formatRelativeDate("2026-06-01T12:00:00Z")).toMatch(/1.*juin/);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd apps/web && pnpm test format-relative-date`
Expected: FAIL — module `./format-relative-date` introuvable.

- [ ] **Step 4: Implement the date helper**

```ts
// apps/web/lib/chat/format-relative-date.ts
/** Date relative FR pour la liste de conversations (« il y a 3 h », « 1 juin »). */
export function formatRelativeDate(iso: string): string {
  const date = new Date(iso);
  const diffMin = Math.floor((Date.now() - date.getTime()) / 60_000);
  if (diffMin < 1) return "à l'instant";
  if (diffMin < 60) return `il y a ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `il y a ${diffH} h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `il y a ${diffD} j`;
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd apps/web && pnpm test format-relative-date`
Expected: PASS (5/5).

- [ ] **Step 6: Commit**

```bash
git add apps/web/lib/chat/chat-keys.ts apps/web/lib/chat/format-relative-date.ts apps/web/lib/chat/format-relative-date.test.ts
git commit -m "feat(web): shared chat query keys + relative date helper"
```

---

## Task 2: Hook `useConversations`

**Files:**
- Create: `apps/web/lib/hooks/use-conversations.ts`
- Test: `apps/web/lib/hooks/use-conversations.test.tsx`

**Interfaces:**
- Consumes: `chatQueryKeys` (Task 1), `getTreaty`/`unwrap`/`ResponseData` de `@repo/api`, `useUser` de `@/lib/auth-client`.
- Produces:
  - `type Conversation = ResponseData<ChatApi['conversations']['get']>['conversations'][number]` (champs : `id`, `title`, `subject`, `status`, `messageCount`, `lastMessagePreview`, `lastMessageRole`, `lastActivityAt`, `startedAt`).
  - `useConversations()` → `{ conversations: Conversation[]; isLoading: boolean; error: string | null; refetch; isRefetching: boolean; createConversation: () => Promise<string>; deleteConversation: (id: string) => Promise<void>; isCreating: boolean; isDeleting: boolean }`.

- [ ] **Step 1: Write the failing test**

```tsx
// apps/web/lib/hooks/use-conversations.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const conversationsGet = vi.fn();
const sessionNewPost = vi.fn();
const sessionDelete = vi.fn();
vi.mock("@repo/api", () => ({
  getTreaty: () => ({
    api: {
      chat: {
        conversations: { get: conversationsGet },
        session: Object.assign(
          (_: { id: string }) => ({ delete: sessionDelete }),
          { new: { post: sessionNewPost } },
        ),
      },
    },
  }),
  unwrap: (r: { data: unknown }) => r.data,
}));
vi.mock("@/lib/auth-client", () => ({ useUser: () => ({ id: "u1" }) }));

import { useConversations } from "./use-conversations";

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  conversationsGet.mockReset().mockResolvedValue({
    data: { conversations: [{ id: "s1", title: null, subject: "mathematiques", status: "active", messageCount: 2, lastMessagePreview: "Salut", lastMessageRole: "assistant", lastActivityAt: "2026-06-30T10:00:00Z", startedAt: "2026-06-30T09:00:00Z" }] },
  });
  sessionNewPost.mockReset().mockResolvedValue({ data: { sessionId: "s2" } });
  sessionDelete.mockReset().mockResolvedValue({ data: { success: true } });
});

describe("useConversations", () => {
  it("loads the conversation list", async () => {
    const { result } = renderHook(() => useConversations(), { wrapper });
    await waitFor(() => expect(result.current.conversations).toHaveLength(1));
    expect(result.current.conversations[0].subject).toBe("mathematiques");
  });

  it("createConversation calls the new-session endpoint and returns the id", async () => {
    const { result } = renderHook(() => useConversations(), { wrapper });
    let newId = "";
    await act(async () => { newId = await result.current.createConversation(); });
    expect(sessionNewPost).toHaveBeenCalledOnce();
    expect(newId).toBe("s2");
  });

  it("deleteConversation calls the delete endpoint", async () => {
    const { result } = renderHook(() => useConversations(), { wrapper });
    await act(async () => { await result.current.deleteConversation("s1"); });
    expect(sessionDelete).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/web && pnpm test use-conversations`
Expected: FAIL — module `./use-conversations` introuvable.

- [ ] **Step 3: Implement the hook**

```ts
// apps/web/lib/hooks/use-conversations.ts
/**
 * useConversations (web) — gestion de la liste de conversations.
 * Miroir du hook mobile (apps/mobile/src/hooks/useConversations.ts) : même
 * contrat serveur via @repo/api, même forme TanStack Query.
 */
import { useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getTreaty, unwrap, type ResponseData } from "@repo/api";
import { useUser } from "@/lib/auth-client";
import { chatQueryKeys } from "@/lib/chat/chat-keys";

type ChatApi = ReturnType<typeof getTreaty>["api"]["chat"];

/** Élément de liste — dérivé de `GET /api/chat/conversations`. */
export type Conversation = ResponseData<ChatApi["conversations"]["get"]>["conversations"][number];

async function fetchConversations(): Promise<Conversation[]> {
  const { conversations } = unwrap(await getTreaty().api.chat.conversations.get());
  return conversations;
}

async function createNewSession(): Promise<string> {
  const { sessionId } = unwrap(await getTreaty().api.chat.session.new.post());
  return sessionId;
}

async function deleteChatSession(sessionId: string): Promise<void> {
  unwrap(await getTreaty().api.chat.session({ id: sessionId }).delete());
}

export function useConversations() {
  const queryClient = useQueryClient();
  const user = useUser();

  const conversationsQuery = useQuery({
    queryKey: chatQueryKeys.conversations(),
    queryFn: fetchConversations,
    enabled: !!user,
    staleTime: 5_000,
    refetchOnMount: "always",
  });

  const createMutation = useMutation({
    mutationFn: createNewSession,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: chatQueryKeys.conversations() });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteChatSession,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: chatQueryKeys.conversations() });
    },
  });

  const createConversation = useCallback(() => createMutation.mutateAsync(), [createMutation]);
  const deleteConversation = useCallback(
    (sessionId: string) => deleteMutation.mutateAsync(sessionId),
    [deleteMutation],
  );

  return {
    conversations: conversationsQuery.data ?? [],
    isLoading: conversationsQuery.isLoading,
    error: conversationsQuery.error instanceof Error ? conversationsQuery.error.message : null,
    refetch: conversationsQuery.refetch,
    isRefetching: conversationsQuery.isRefetching,
    createConversation,
    deleteConversation,
    isCreating: createMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/web && pnpm test use-conversations`
Expected: PASS (3/3).

- [ ] **Step 5: Typecheck + commit**

Run: `cd apps/web && pnpm typecheck`
Expected: pas d'erreur (vérifie notamment que `session.new.post` et `session({id}).delete` existent dans le contrat Eden — ils sont déjà consommés par le mobile).

```bash
git add apps/web/lib/hooks/use-conversations.ts apps/web/lib/hooks/use-conversations.test.tsx
git commit -m "feat(web): useConversations hook (list/create/delete)"
```

---

## Task 3: Composant `ConversationListItem`

**Files:**
- Create: `apps/web/components/student/chat/conversation-list-item.tsx`
- Test: `apps/web/components/student/chat/conversation-list-item.test.tsx`

**Interfaces:**
- Consumes: `Conversation` (Task 2), `formatRelativeDate` (Task 1), `@repo/ui` (`Badge`, `Button`, `AlertDialog*`), `lucide-react` (`Trash2`).
- Produces: `ConversationListItem({ conversation, isActive, onSelect, onDelete, isDeleting }: { conversation: Conversation; isActive: boolean; onSelect: (id: string) => void; onDelete: (id: string) => void; isDeleting: boolean })`.
- Produces (interne, exporté pour réutilisation) : `subjectLabel(subject: string): string` mappant le slug matière → libellé FR (`mathematiques`→`Maths`, `francais`→`Français`, `langues`→`Langues`, `sciences`→`Sciences`, `histoire-geo`→`Histoire-Géo`, défaut → `Général`).

- [ ] **Step 1: Write the failing test**

```tsx
// apps/web/components/student/chat/conversation-list-item.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ConversationListItem } from "./conversation-list-item";
import type { Conversation } from "@/lib/hooks/use-conversations";

const base: Conversation = {
  id: "s1", title: null, subject: "mathematiques", status: "active",
  messageCount: 3, lastMessagePreview: "On revoit les fractions",
  lastMessageRole: "assistant", lastActivityAt: new Date().toISOString(),
  startedAt: new Date().toISOString(),
};

describe("ConversationListItem", () => {
  it("shows a fallback title and the subject label", () => {
    render(<ConversationListItem conversation={base} isActive={false} onSelect={vi.fn()} onDelete={vi.fn()} isDeleting={false} />);
    expect(screen.getByText("Nouvelle conversation")).toBeInTheDocument();
    expect(screen.getByText("Maths")).toBeInTheDocument();
  });

  it("prefixes the preview with 'Tom : ' when the last message is from the assistant", () => {
    render(<ConversationListItem conversation={base} isActive={false} onSelect={vi.fn()} onDelete={vi.fn()} isDeleting={false} />);
    expect(screen.getByText(/Tom : On revoit les fractions/)).toBeInTheDocument();
  });

  it("calls onSelect when the row is activated", () => {
    const onSelect = vi.fn();
    render(<ConversationListItem conversation={base} isActive={false} onSelect={onSelect} onDelete={vi.fn()} isDeleting={false} />);
    fireEvent.click(screen.getByRole("button", { name: /ouvrir la conversation/i }));
    expect(onSelect).toHaveBeenCalledWith("s1");
  });

  it("confirms before deleting", () => {
    const onDelete = vi.fn();
    render(<ConversationListItem conversation={base} isActive={false} onSelect={vi.fn()} onDelete={onDelete} isDeleting={false} />);
    fireEvent.click(screen.getByRole("button", { name: /supprimer la conversation/i }));
    fireEvent.click(screen.getByRole("button", { name: /^supprimer$/i }));
    expect(onDelete).toHaveBeenCalledWith("s1");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/web && pnpm test conversation-list-item`
Expected: FAIL — module introuvable.

- [ ] **Step 3: Implement the component**

```tsx
// apps/web/components/student/chat/conversation-list-item.tsx
"use client";

import {
  Badge, Button,
  AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader,
  AlertDialogTitle, AlertDialogDescription, AlertDialogFooter,
  AlertDialogCancel, AlertDialogAction,
} from "@repo/ui";
import { Trash2 } from "lucide-react";
import { cn } from "@repo/ui";
import { formatRelativeDate } from "@/lib/chat/format-relative-date";
import type { Conversation } from "@/lib/hooks/use-conversations";

const SUBJECT_LABELS: Record<string, string> = {
  mathematiques: "Maths",
  francais: "Français",
  langues: "Langues",
  sciences: "Sciences",
  "histoire-geo": "Histoire-Géo",
};

export function subjectLabel(subject: string): string {
  return SUBJECT_LABELS[subject] ?? "Général";
}

export function ConversationListItem({
  conversation, isActive, onSelect, onDelete, isDeleting,
}: {
  conversation: Conversation;
  isActive: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  isDeleting: boolean;
}) {
  const title = conversation.title ?? "Nouvelle conversation";
  const preview = conversation.lastMessagePreview
    ? `${conversation.lastMessageRole === "assistant" ? "Tom : " : ""}${conversation.lastMessagePreview}`
    : "Pas encore de message";

  return (
    <div
      className={cn(
        "group relative flex flex-col gap-1 rounded-md border px-3 py-2 transition-colors",
        isActive ? "border-primary bg-accent" : "border-transparent hover:bg-accent/60",
      )}
    >
      <button
        type="button"
        onClick={() => onSelect(conversation.id)}
        aria-label={`Ouvrir la conversation ${title}`}
        aria-current={isActive ? "true" : undefined}
        className="flex flex-col gap-1 pr-7 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-medium">{title}</span>
          <Badge variant="secondary" className="shrink-0">{subjectLabel(conversation.subject)}</Badge>
        </div>
        <span className="truncate text-xs text-muted-foreground">{preview}</span>
        <span className="text-xs text-muted-foreground">{formatRelativeDate(conversation.lastActivityAt)}</span>
      </button>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            disabled={isDeleting}
            aria-label={`Supprimer la conversation ${title}`}
            className="absolute right-1 top-1 size-7 opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
          >
            <Trash2 className="size-4" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette conversation ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est définitive. Les messages de « {title} » seront effacés.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => onDelete(conversation.id)}>Supprimer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
```

> Note d'implémentation : vérifier que `cn` est bien réexporté par `@repo/ui` (il l'est — utilisé partout dans web). `Button` accepte `size="icon"` et `variant="ghost"` (variants shadcn standard).

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/web && pnpm test conversation-list-item`
Expected: PASS (4/4).

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/student/chat/conversation-list-item.tsx apps/web/components/student/chat/conversation-list-item.test.tsx
git commit -m "feat(web): ConversationListItem with subject badge + delete confirm"
```

---

## Task 4: Composant `ConversationSidebar`

**Files:**
- Create: `apps/web/components/student/chat/conversation-sidebar.tsx`
- Test: `apps/web/components/student/chat/conversation-sidebar.test.tsx`

**Interfaces:**
- Consumes: `ConversationListItem` (Task 3), `Conversation` (Task 2), `@repo/ui` (`Button`, `Skeleton`), `lucide-react` (`Plus`).
- Produces (présentationnel, sans hook de données — la donnée vient du container Task 5) :
  `ConversationSidebar({ conversations, activeSessionId, isLoading, error, isCreating, isDeleting, onSelect, onNew, onDelete }: { conversations: Conversation[]; activeSessionId: string | null; isLoading: boolean; error: string | null; isCreating: boolean; isDeleting: boolean; onSelect: (id: string) => void; onNew: () => void; onDelete: (id: string) => void })`.

- [ ] **Step 1: Write the failing test**

```tsx
// apps/web/components/student/chat/conversation-sidebar.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ConversationSidebar } from "./conversation-sidebar";
import type { Conversation } from "@/lib/hooks/use-conversations";

const conv: Conversation = {
  id: "s1", title: "Fractions", subject: "mathematiques", status: "active",
  messageCount: 1, lastMessagePreview: "ok", lastMessageRole: "user",
  lastActivityAt: new Date().toISOString(), startedAt: new Date().toISOString(),
};
const noop = { onSelect: vi.fn(), onNew: vi.fn(), onDelete: vi.fn() };

describe("ConversationSidebar", () => {
  it("shows a skeleton while loading", () => {
    render(<ConversationSidebar conversations={[]} activeSessionId={null} isLoading error={null} isCreating={false} isDeleting={false} {...noop} />);
    expect(screen.getByLabelText(/chargement des conversations/i)).toBeInTheDocument();
  });
  it("shows an empty state when there are no conversations", () => {
    render(<ConversationSidebar conversations={[]} activeSessionId={null} isLoading={false} error={null} isCreating={false} isDeleting={false} {...noop} />);
    expect(screen.getByText(/aucune conversation/i)).toBeInTheDocument();
  });
  it("shows an error state", () => {
    render(<ConversationSidebar conversations={[]} activeSessionId={null} isLoading={false} error="boom" isCreating={false} isDeleting={false} {...noop} />);
    expect(screen.getByRole("alert")).toHaveTextContent(/boom|conversations/i);
  });
  it("renders the list and triggers onNew", () => {
    const onNew = vi.fn();
    render(<ConversationSidebar conversations={[conv]} activeSessionId="s1" isLoading={false} error={null} isCreating={false} isDeleting={false} onSelect={vi.fn()} onNew={onNew} onDelete={vi.fn()} />);
    expect(screen.getByText("Fractions")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /nouvelle conversation/i }));
    expect(onNew).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/web && pnpm test conversation-sidebar`
Expected: FAIL — module introuvable.

- [ ] **Step 3: Implement the component**

```tsx
// apps/web/components/student/chat/conversation-sidebar.tsx
"use client";

import { Button, Skeleton } from "@repo/ui";
import { Plus } from "lucide-react";
import { ConversationListItem } from "./conversation-list-item";
import type { Conversation } from "@/lib/hooks/use-conversations";

export function ConversationSidebar({
  conversations, activeSessionId, isLoading, error, isCreating, isDeleting,
  onSelect, onNew, onDelete,
}: {
  conversations: Conversation[];
  activeSessionId: string | null;
  isLoading: boolean;
  error: string | null;
  isCreating: boolean;
  isDeleting: boolean;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="flex h-full flex-col gap-2 p-2">
      <Button onClick={onNew} disabled={isCreating} className="w-full justify-start gap-2">
        <Plus className="size-4" />
        Nouvelle conversation
      </Button>

      <nav aria-label="Conversations" className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex flex-col gap-2 p-1" aria-busy="true" aria-label="Chargement des conversations">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : error ? (
          <div role="alert" className="m-1 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            Impossible de charger les conversations.
          </div>
        ) : conversations.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">
            Aucune conversation. Démarre la première avec Tom.
          </p>
        ) : (
          conversations.map((c) => (
            <ConversationListItem
              key={c.id}
              conversation={c}
              isActive={c.id === activeSessionId}
              onSelect={onSelect}
              onDelete={onDelete}
              isDeleting={isDeleting}
            />
          ))
        )}
      </nav>
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/web && pnpm test conversation-sidebar`
Expected: PASS (4/4).

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/student/chat/conversation-sidebar.tsx apps/web/components/student/chat/conversation-sidebar.test.tsx
git commit -m "feat(web): ConversationSidebar (list + states + new)"
```

---

## Task 5: Refactor `use-chat` — piloté par `sessionId`

**Files:**
- Modify: `apps/web/lib/hooks/use-chat.ts`
- Test: `apps/web/lib/hooks/use-chat.test.tsx`

**Interfaces:**
- Consumes: `chatQueryKeys` (Task 1), `streamChat`/`ChatStreamError` (existant), `getTreaty`/`unwrap` (`@repo/api`), `useUser`.
- Produces (signature modifiée) : `useChat({ sessionId }: { sessionId: string | null })` → `{ messages: ChatMessage[]; isLoading: boolean; isStreaming: boolean; streamStatus: string; error: string | null; sendMessage: (text: string) => void }`. **Retrait** de `reset` et du getOrCreate implicite : la conversation active est désormais fournie par le container.

- [ ] **Step 1: Write the failing test**

```tsx
// apps/web/lib/hooks/use-chat.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const historyGet = vi.fn();
vi.mock("@repo/api", () => ({
  getTreaty: () => ({
    api: { chat: { session: (_: { id: string }) => ({ history: { get: historyGet } }) } },
  }),
  unwrap: (r: { data: unknown }) => r.data,
}));
vi.mock("@/lib/auth-client", () => ({ useUser: () => ({ id: "u1", schoolLevel: "sixieme", firstName: "Léa" }) }));
vi.mock("@/lib/chat/stream-chat", () => ({
  streamChat: vi.fn(),
  ChatStreamError: class extends Error {},
}));

import { useChat } from "./use-chat";

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  historyGet.mockReset().mockResolvedValue({
    data: { messages: [{ id: "m1", role: "user", content: "bonjour", timestamp: "x" }], hasOrphanMessage: false },
  });
});

describe("useChat", () => {
  it("loads history for the active sessionId", async () => {
    const { result } = renderHook(() => useChat({ sessionId: "s1" }), { wrapper });
    await waitFor(() => expect(result.current.messages).toHaveLength(1));
    expect(result.current.messages[0]).toMatchObject({ role: "user", content: "bonjour" });
    expect(historyGet).toHaveBeenCalled();
  });

  it("does not load history when sessionId is null", async () => {
    const { result } = renderHook(() => useChat({ sessionId: null }), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.messages).toHaveLength(0);
    expect(historyGet).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/web && pnpm test use-chat`
Expected: FAIL — `useChat` attend encore l'ancienne signature (sans argument) / appelle getOrCreate.

- [ ] **Step 3: Rewrite the hook**

Remplacer **tout** le contenu de `apps/web/lib/hooks/use-chat.ts` par :

```ts
/**
 * useChat Hook (web) — piloté par la conversation active (`sessionId`).
 *
 * La conversation active est fournie par le container (page chat) ; ce hook
 * charge l'historique de cette conversation et gère le streaming SSE en state
 * local pour un rendu incrémental. La création / rotation de conversation
 * vit dans useConversations (non destructif).
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getTreaty, unwrap } from "@repo/api";
import { useUser } from "@/lib/auth-client";
import { streamChat, ChatStreamError } from "@/lib/chat/stream-chat";
import { chatQueryKeys } from "@/lib/chat/chat-keys";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type BaseUser = NonNullable<ReturnType<typeof useUser>>;
type ExtendedUser = BaseUser & {
  firstName?: string | null;
  schoolLevel?: string | null;
};

type ChatApi = ReturnType<typeof getTreaty>["api"]["chat"];
type HistoryMessage = NonNullable<
  Awaited<ReturnType<ReturnType<ChatApi["session"]>["history"]["get"]>>["data"]
>["messages"][number];

async function fetchHistory(sessionId: string): Promise<HistoryMessage[]> {
  const data = unwrap(
    await getTreaty().api.chat.session({ id: sessionId }).history.get(),
  );
  return data.messages;
}

export function useChat({ sessionId }: { sessionId: string | null }) {
  const user = useUser() as ExtendedUser | null;
  const queryClient = useQueryClient();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamStatus, setStreamStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [syncedSessionId, setSyncedSessionId] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  const historyQuery = useQuery({
    queryKey: chatQueryKeys.history(sessionId ?? "__none__"),
    queryFn: () => fetchHistory(sessionId!),
    enabled: !!sessionId,
    staleTime: Infinity,
  });

  // Switching conversation: clear local state immediately (before the new
  // history resolves) and abort any in-flight stream.
  useEffect(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setMessages([]);
    setSyncedSessionId(null);
    setError(null);
    setIsStreaming(false);
    setStreamStatus("");
  }, [sessionId]);

  // Populate from server history once it arrives (React 19: state update during
  // render so the first render after data lands already shows the history).
  if (historyQuery.data && sessionId && syncedSessionId !== sessionId) {
    setSyncedSessionId(sessionId);
    setMessages(
      historyQuery.data.map((m) => ({
        id: m.id,
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    );
  }

  // Abort on unmount
  useEffect(() => () => abortRef.current?.abort(), []);

  const sendMessage = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isStreaming || !user || !sessionId) return;

      const userMessageId = crypto.randomUUID();
      const assistantMessageId = crypto.randomUUID();

      setMessages((prev) => [
        ...prev,
        { id: userMessageId, role: "user", content: trimmed },
        { id: assistantMessageId, role: "assistant", content: "" },
      ]);
      setIsStreaming(true);
      setError(null);

      const ac = new AbortController();
      abortRef.current = ac;

      function handleStreamError(msg: string) {
        setError(msg);
        setMessages((prev) => {
          const placeholder = prev.find((m) => m.id === assistantMessageId);
          return placeholder?.content === ""
            ? prev.filter((m) => m.id !== assistantMessageId)
            : prev;
        });
        setIsStreaming(false);
      }

      void streamChat(
        {
          content: trimmed,
          sessionId,
          schoolLevel: user.schoolLevel ?? "",
          firstName: user.firstName ?? undefined,
        },
        {
          onContent: (full) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMessageId ? { ...m, content: full } : m,
              ),
            );
          },
          onStatus: (s) => setStreamStatus(s),
          onError: handleStreamError,
          onDone: () => {
            setIsStreaming(false);
            setStreamStatus("");
            // Refresh the list so the new preview/subject/order shows up.
            void queryClient.invalidateQueries({
              queryKey: chatQueryKeys.conversations(),
            });
          },
        },
        ac.signal,
      ).catch((err: unknown) => {
        const msg =
          err instanceof ChatStreamError
            ? err.message
            : "Le chat est indisponible. Réessaie.";
        handleStreamError(msg);
      });
    },
    [isStreaming, user, sessionId, queryClient],
  );

  return {
    messages,
    isLoading: !!sessionId && historyQuery.isLoading,
    isStreaming,
    streamStatus,
    error:
      error ??
      (historyQuery.error instanceof Error ? historyQuery.error.message : null),
    sendMessage,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/web && pnpm test use-chat`
Expected: PASS (2/2).

- [ ] **Step 5: Typecheck (page.tsx will be red until Task 6 — that is expected)**

Run: `cd apps/web && pnpm test use-chat use-conversations conversation-list-item conversation-sidebar format-relative-date`
Expected: tous PASS. (Ne pas lancer `typecheck` global ici : `page.tsx` consomme encore l'ancienne signature `useChat()` — réparé en Task 6, qui commit le tout ensemble.)

- [ ] **Step 6: Commit**

```bash
git add apps/web/lib/hooks/use-chat.ts apps/web/lib/hooks/use-chat.test.tsx
git commit -m "refactor(web): useChat driven by active sessionId, drop implicit getOrCreate"
```

---

## Task 6: Page chat — layout sidebar split + sélection active

**Files:**
- Modify: `apps/web/app/student/chat/page.tsx`

**Interfaces:**
- Consumes: `useConversations` (Task 2), `useChat` (Task 5), `ConversationSidebar` (Task 4), composants chat existants (`ChatMessageList`, `ChatInput`, `ChatStatus`), `@repo/ui` (`Button`, `Skeleton`), `lucide-react` (`Menu`, `X`).
- Produces: la page `/student/chat` complète (container). Pas d'export consommé ailleurs.

- [ ] **Step 1: Rewrite the page**

Remplacer **tout** le contenu de `apps/web/app/student/chat/page.tsx` par :

```tsx
"use client";

import { useEffect, useState } from "react";
import { Button, Skeleton, cn } from "@repo/ui";
import { Menu, X } from "lucide-react";
import { useChat } from "@/lib/hooks/use-chat";
import { useConversations } from "@/lib/hooks/use-conversations";
import { ConversationSidebar } from "@/components/student/chat/conversation-sidebar";
import { ChatMessageList } from "@/components/student/chat/chat-message-list";
import { ChatInput } from "@/components/student/chat/chat-input";
import { ChatStatus } from "@/components/student/chat/chat-status";

export default function StudentChatPage() {
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const {
    conversations, isLoading: listLoading, error: listError,
    isCreating, isDeleting, createConversation, deleteConversation,
  } = useConversations();

  // Land on the most recent conversation once the list is available.
  useEffect(() => {
    if (!activeSessionId && conversations.length > 0) {
      setActiveSessionId(conversations[0].id);
    }
  }, [conversations, activeSessionId]);

  const { messages, isLoading, isStreaming, streamStatus, error, sendMessage } =
    useChat({ sessionId: activeSessionId });

  async function handleNew() {
    const id = await createConversation();
    setActiveSessionId(id);
    setSidebarOpen(false);
  }

  function handleSelect(id: string) {
    setActiveSessionId(id);
    setSidebarOpen(false);
  }

  async function handleDelete(id: string) {
    await deleteConversation(id);
    if (id === activeSessionId) setActiveSessionId(null);
  }

  return (
    <div className="flex h-full">
      {/* Sidebar — colonne sur md+, drawer overlay sur mobile */}
      <aside
        className={cn(
          "z-40 w-72 shrink-0 border-r bg-background md:static md:block",
          sidebarOpen
            ? "fixed inset-y-0 left-0 block"
            : "hidden md:block",
        )}
      >
        <ConversationSidebar
          conversations={conversations}
          activeSessionId={activeSessionId}
          isLoading={listLoading}
          error={listError}
          isCreating={isCreating}
          isDeleting={isDeleting}
          onSelect={handleSelect}
          onNew={handleNew}
          onDelete={handleDelete}
        />
      </aside>

      {/* Backdrop mobile */}
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Fermer la liste"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
        />
      )}

      {/* Panneau conversation active */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-2 border-b px-4 py-3">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-label={sidebarOpen ? "Fermer la liste" : "Ouvrir la liste des conversations"}
            onClick={() => setSidebarOpen((o) => !o)}
          >
            {sidebarOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </Button>
          <h1 className="text-lg font-semibold">Tom</h1>
        </header>

        <main className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 overflow-y-auto">
            {!activeSessionId ? (
              <div className="flex h-full items-center justify-center px-4 py-8 text-center text-muted-foreground">
                <p>Choisis une conversation ou démarre-en une nouvelle.</p>
              </div>
            ) : isLoading ? (
              <div className="flex flex-col gap-3 px-4 py-4" aria-busy="true" aria-label="Chargement de la conversation">
                <Skeleton className="h-10 w-3/4" />
                <Skeleton className="h-10 w-1/2 self-end" />
                <Skeleton className="h-10 w-2/3" />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex h-full items-center justify-center px-4 py-8 text-center text-muted-foreground">
                <p>Pose ta première question à Tom</p>
              </div>
            ) : (
              <ChatMessageList messages={messages} />
            )}
          </div>

          {error && (
            <div
              role="alert"
              className="mx-4 mb-2 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </div>
          )}

          <ChatStatus status={streamStatus} />
          <ChatInput onSend={sendMessage} disabled={isStreaming || !activeSessionId} />
        </main>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Full validation**

Run: `cd apps/web && pnpm typecheck && pnpm lint && pnpm test`
Expected: typecheck propre (la nouvelle signature `useChat({ sessionId })` est désormais respectée par la page), lint zéro warning, tous les tests PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/student/chat/page.tsx
git commit -m "feat(web): chat sidebar split — conversation list, resume, new, delete"
```

- [ ] **Step 4: Vérification comportementale (méthode utilisateur — pas d'e2e écrit)**

Stack lancée (`pnpm dev` à la racine — backend + web). Login élève (`pnpm seed` fournit le compte dev élève), puis sur `/student/chat` vérifier :
1. **Liste** : les conversations existantes s'affichent (titre/`Nouvelle conversation`, badge matière, preview avec `Tom : ` si dernier message assistant, date relative). États **loading** (skeletons) puis **liste** réels.
2. **Reprise** : clic sur une conversation → son historique se charge dans le panneau ; l'item est surligné (`aria-current`).
3. **Nouvelle (non destructive)** : « + Nouvelle conversation » → nouvelle session vide ouverte ; l'ancienne **reste** dans la liste. Envoyer un message → après `done`, la liste se rafraîchit (preview + matière détectée par le Lot 1 apparaissent).
4. **Suppression** : icône poubelle → AlertDialog → « Supprimer » → la conversation disparaît ; si c'était l'active, le panneau repasse en état vide.
5. **Responsive** : en < `md`, la sidebar est masquée ; le bouton menu l'ouvre en overlay + backdrop ; un clic sur le backdrop ou une sélection la referme.
6. **Empty** : sur un compte sans conversation, la sidebar montre « Aucune conversation… » et le panneau invite à démarrer.

---

## Self-Review

**1. Spec coverage (design §5 Lot 2) :**
- « Câbler `GET /chat/conversations`, `POST /chat/session/new`, `GET /chat/session/:id/history`, `DELETE /chat/session/:id` » → Task 2 (conversations/new/delete) + Task 5 (history). ✓
- « panneau liste (preview + matière + date) » → Task 3. ✓
- « bouton Nouvelle conversation non destructif » → `createNewSession` (Task 2) + handler page (Task 6), l'ancienne reste listée. ✓
- « reprise au clic » → sélection active + `useChat({ sessionId })` (Tasks 5-6). ✓
- « harmoniser la clé de session » → `chat-keys.ts` convention partagée + keying par `sessionId` (décision documentée, mobile non touché — hors scope). ✓
- « archiver (optionnel) » → **descopé** (décision produit : suppression seule, parité mobile). Conforme.
- Vérification §6 Lot 2 (login → liste → nouvelle/reprise/suppression + états) → Task 6 Step 4. ✓

**2. Placeholder scan :** aucun « TODO/à compléter ». Tout le code des fichiers créés/réécrits est fourni intégralement. Seules notes : vérifier `cn`/`size="icon"` (existants dans `@repo/ui`).

**3. Type consistency :** `Conversation` défini Task 2, consommé Tasks 3-4-6 (mêmes champs `id/title/subject/lastMessagePreview/lastMessageRole/lastActivityAt`). `chatQueryKeys.{conversations,history}` défini Task 1, consommé Tasks 2 et 5. `useChat({ sessionId })` défini Task 5, consommé Task 6. `subjectLabel` Task 3. Cohérent.

**Note d'ordonnancement** : Task 5 réécrit `useChat` mais `page.tsx` (Task 6) consomme l'ancienne signature jusqu'à sa réécriture — d'où le `typecheck` global reporté à la fin de Task 6 (Task 5 ne valide que ses tests). Les deux tasks forment une paire ; ne pas pousser entre les deux.
