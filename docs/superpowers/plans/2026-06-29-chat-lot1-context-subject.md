# Chat Lot 1 — Injection du résumé & détection de matière (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Réparer l'injection du résumé de conversation dans le contexte Mistral (bug : le résumé est calculé mais filtré avant l'appel) et ajouter une détection de matière réelle persistée sur la session.

**Architecture:** On extrait l'assemblage du contexte en une fonction pure testable qui injecte un bloc `<conversation_summary>` ; l'optimizer cesse d'émettre un message résumé `role:'system'` voué à être filtré. La matière est détectée dans le même appel que le classifier d'intention (ministral-8b), persistée sur `study_sessions.subject` à la première détection confiante, et utilisée pour le prompt et le routage reasoning. Toute la logique de décision (matière effective, faut-il persister) vit dans des helpers purs.

**Tech Stack:** Bun + Elysia + Drizzle (PostgreSQL), Mistral via `src/lib/ai/mistral-client.ts`. Tests : Bun test runner (`bun run test`), fichiers `src/tests/<name>.test.ts`.

## Global Constraints

- **Préfixe caché chat inchangé** : le bloc résumé est un message `role:'user'` placé **après** le system prompt — il ne modifie pas le préfixe système stable, donc `PROMPT_CACHE_VERSION` (`mistral-chat.service.ts:66`) **n'est pas** bumpé.
- **Cache classifier** : toute modif du prompt/schéma du classifier **bumpe** `INTENT_CLASSIFIER_PROMPT_VERSION` (`intent-classifier.service.ts:24`) pour invalider `intent-classifier-<version>`.
- **Matière = étiquette tolérante**, jamais un routeur : une erreur de détection est sans conséquence destructive ; valeur par défaut/mixte = `'general'`.
- **Enum matière canonique** : `['mathematiques','francais','langues','sciences','histoire-geo','general']`, aligné sur `normalizeSubject` (`adaptation/by-subject.ts:73-89`).
- **Politique anti-thrash** : on ne fixe `study_sessions.subject` qu'à la **première détection confiante** (subject ≠ `'general'`) tant que la session est encore sur le défaut `'général'`. Pas de re-bascule à chaque message.
- **Zéro nouvelle route serveur** dans ce lot.
- **Validation avant commit** (depuis `apps/server`) : `bun run typecheck && bun run lint && bun run test`. Avant push : `bun run test:integration`.

---

## File Structure

- `src/utils/conversation/conversation-optimizer.ts` — **modifié** : ne renvoie plus que la fenêtre verbatim (plus de message résumé `role:'system'`).
- `src/services/chat/chat-message-assembler.ts` — **créé** : fonction pure `assembleChatMessages(parts)` qui construit le tableau `MistralMessage[]` et injecte le bloc `<conversation_summary>`.
- `src/services/chat/mistral-chat.service.ts` — **modifié** : appelle `assembleChatMessages`, tronque le résumé au budget.
- `src/config/prompts/adaptation/subjects.ts` — **créé** : `STUDENT_SUBJECTS` + type `StudentSubject`.
- `src/services/chat/intent-classifier.service.ts` — **modifié** : le schéma/retour inclut `subject` ; version bumpée ; prompt mis à jour.
- `src/db/repositories/study-sessions.repository.ts` — **modifié** : méthode `updateSubject`.
- `src/services/chat/subject-resolution.ts` — **créé** : helpers purs `resolveEffectiveSubject`, `shouldPersistDetectedSubject`.
- `src/services/chat/chat-orchestration.service.ts` — **modifié** : persiste la matière détectée + passe la matière effective au stream.
- Tests créés : `src/tests/conversation-optimizer.test.ts`, `src/tests/chat-message-assembler.test.ts`, `src/tests/subject-resolution.test.ts`, et extension de la couverture classifier.

---

## Task 1: Optimizer — ne plus émettre le message résumé

**Files:**
- Modify: `src/utils/conversation/conversation-optimizer.ts:25-72`
- Test: `src/tests/conversation-optimizer.test.ts`

**Interfaces:**
- Consumes: rien (fonction pure existante).
- Produces: `optimizeConversationHistory(history: IAIMessage[], context?: { conversationSummary?: string | null }): IAIMessage[]` — renvoie l'historique tel quel si pas de résumé, sinon **uniquement** la fenêtre verbatim (≤ `RECENT_WINDOW_SIZE`, tronquée au budget), **sans** message `role:'system'`.

- [ ] **Step 1: Write the failing test**

```ts
// src/tests/conversation-optimizer.test.ts
import { describe, it, expect } from "bun:test";
import { optimizeConversationHistory } from "../utils/conversation/conversation-optimizer";

const mkMsgs = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
    content: `m${i}`,
    timestamp: new Date().toISOString(),
  }));

describe("optimizeConversationHistory", () => {
  it("passes history through unchanged when there is no summary", () => {
    const msgs = mkMsgs(6);
    expect(optimizeConversationHistory(msgs)).toEqual(msgs);
  });

  it("returns only the recent verbatim window, with no role:system message, when a summary exists", () => {
    const msgs = mkMsgs(14);
    const out = optimizeConversationHistory(msgs, { conversationSummary: "résumé" });
    expect(out.some((m) => m.role === "system")).toBe(false);
    expect(out.length).toBeLessThanOrEqual(10);
    expect(out[out.length - 1].content).toBe("m13");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/server && bun test src/tests/conversation-optimizer.test.ts`
Expected: FAIL — le 2ᵉ test échoue car la sortie contient aujourd'hui un message `role:'system'` ("[Résumé...]").

- [ ] **Step 3: Implement — remove the summary message from the optimizer**

Remplacer le corps de `optimizeConversationHistory` (`:25-72`) par :

```ts
export function optimizeConversationHistory(
  history: IAIMessage[],
  context?: OptimizationContext
): IAIMessage[] {
  // Pas de résumé → historique complet (déjà borné en amont par afterMessageId/limit)
  if (!context?.conversationSummary) {
    return history;
  }

  const budget = calculateBudget();

  // Une fois résumé, on ne garde que la fenêtre verbatim récente.
  // Le texte du résumé est injecté séparément par chat-message-assembler
  // (un message role:'system' serait filtré avant l'appel Mistral).
  const recentMessages = history.slice(-RECENT_WINDOW_SIZE);

  const historyText = recentMessages.map((m) => m.content).join("\n");
  let currentTokens = estimateTokens(historyText);

  if (currentTokens > budget.historyMaxTokens) {
    const trimmed = [...recentMessages];
    while (trimmed.length > 2 && currentTokens > budget.historyMaxTokens) {
      const removed = trimmed.shift();
      if (removed) currentTokens -= estimateTokens(removed.content);
    }
    return trimmed;
  }

  return recentMessages;
}
```

Puis supprimer l'import devenu inutile `truncateToTokenBudget` de la ligne d'import (`:10-11`) **s'il n'est plus référencé** dans le fichier (garder `calculateBudget` et `estimateTokens`).

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/server && bun test src/tests/conversation-optimizer.test.ts`
Expected: PASS (2/2).

- [ ] **Step 5: Typecheck + commit**

Run: `cd apps/server && bun run typecheck`
Expected: pas d'erreur (notamment pas d'import inutilisé).

```bash
git add apps/server/src/utils/conversation/conversation-optimizer.ts apps/server/src/tests/conversation-optimizer.test.ts
git commit -m "refactor(chat): optimizer returns verbatim window only, no summary message"
```

---

## Task 2: Assembleur de contexte pur + injection du résumé

**Files:**
- Create: `src/services/chat/chat-message-assembler.ts`
- Modify: `src/services/chat/mistral-chat.service.ts:131-165` (assemblage) + imports
- Test: `src/tests/chat-message-assembler.test.ts`

**Interfaces:**
- Consumes: le type `MistralMessage` (même module que celui importé par `mistral-chat.service.ts` — `src/lib/ai/mistral-client`).
- Produces: `assembleChatMessages(parts: ChatMessageParts): MistralMessage[]` — voir signature ci-dessous.

- [ ] **Step 1: Write the failing test**

```ts
// src/tests/chat-message-assembler.test.ts
import { describe, it, expect } from "bun:test";
import { assembleChatMessages } from "../services/chat/chat-message-assembler";

describe("assembleChatMessages", () => {
  it("injects the summary as a user block right after the system prompt and before history", () => {
    const out = assembleChatMessages({
      systemPrompt: "SYS",
      conversationSummary: "résumé du passé",
      historyMessages: [{ role: "user", content: "hist" }],
      userContent: "question",
    });
    expect(out[0]).toEqual({ role: "system", content: "SYS" });
    expect(out[1].role).toBe("user");
    expect(String(out[1].content)).toContain("<conversation_summary>");
    expect(String(out[1].content)).toContain("résumé du passé");
    expect(out[2]).toEqual({ role: "user", content: "hist" });
    expect(out[out.length - 1]).toEqual({ role: "user", content: "question" });
  });

  it("omits the summary block when there is no summary", () => {
    const out = assembleChatMessages({
      systemPrompt: "SYS",
      historyMessages: [],
      userContent: "q",
    });
    expect(out.some((m) => String(m.content).includes("<conversation_summary>"))).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/server && bun test src/tests/chat-message-assembler.test.ts`
Expected: FAIL — module `chat-message-assembler` introuvable.

- [ ] **Step 3: Create the assembler**

```ts
// src/services/chat/chat-message-assembler.ts
import type { MistralMessage } from "../../lib/ai/mistral-client";

export interface ChatMessageParts {
  systemPrompt: string;
  /** Résumé DÉJÀ tronqué au budget (ou null/undefined si aucun). */
  conversationSummary?: string | null;
  historyMessages: MistralMessage[];
  studentContextBlock?: string;
  pronoteBlock?: string;
  attachedFilesBlock?: string;
  intentReinforcement?: string;
  inputMode?: string;
  userContent: string;
}

/**
 * Assemble le tableau de messages envoyé à Mistral. Ordre : système (préfixe
 * caché) → résumé de conversation → fenêtre verbatim → contexte élève → pronote
 * → fichiers → consigne du tour → marqueur vocal → message courant.
 */
export function assembleChatMessages(parts: ChatMessageParts): MistralMessage[] {
  return [
    { role: "system" as const, content: parts.systemPrompt },
    ...(parts.conversationSummary
      ? [
          {
            role: "user" as const,
            content: `<conversation_summary>\n${parts.conversationSummary}\n</conversation_summary>`,
          },
        ]
      : []),
    ...parts.historyMessages,
    ...(parts.studentContextBlock
      ? [{ role: "user" as const, content: parts.studentContextBlock }]
      : []),
    ...(parts.pronoteBlock ? [{ role: "user" as const, content: parts.pronoteBlock }] : []),
    ...(parts.attachedFilesBlock
      ? [{ role: "user" as const, content: parts.attachedFilesBlock }]
      : []),
    ...(parts.intentReinforcement
      ? [{ role: "user" as const, content: `[Consigne pour ce tour]\n${parts.intentReinforcement}` }]
      : []),
    ...(parts.inputMode === "voice"
      ? [
          {
            role: "user" as const,
            content: "[VOCAL] Ce tour a été dicté à l'oral — réponds en style parlé, sans markdown.",
          },
        ]
      : []),
    { role: "user" as const, content: parts.userContent },
  ];
}
```

Si le type `MistralMessage` n'est pas exporté par `src/lib/ai/mistral-client`, l'importer depuis le même chemin que l'`import` existant en tête de `mistral-chat.service.ts` (copier ce chemin verbatim).

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/server && bun test src/tests/chat-message-assembler.test.ts`
Expected: PASS (2/2).

- [ ] **Step 5: Wire mistral-chat.service.ts to use the assembler + truncate the summary**

En tête du fichier, ajouter les imports :

```ts
import { assembleChatMessages } from "./chat-message-assembler";
import { calculateBudget, truncateToTokenBudget } from "./token-budget.service";
```

Remplacer le bloc d'assemblage (`:148-165`, le `const messages: MistralMessage[] = [ ... ];`) par :

```ts
      const truncatedSummary = params.conversationSummary
        ? truncateToTokenBudget(params.conversationSummary, calculateBudget().summaryMaxTokens).text
        : undefined;

      // The agentic loop appends assistant + tool messages to this array as it iterates.
      const messages: MistralMessage[] = assembleChatMessages({
        systemPrompt,
        conversationSummary: truncatedSummary,
        historyMessages,
        studentContextBlock,
        pronoteBlock,
        attachedFilesBlock,
        intentReinforcement: params.intentReinforcement,
        inputMode: params.inputMode,
        userContent,
      });
```

(`historyMessages`, `studentContextBlock`, `pronoteBlock`, `attachedFilesBlock`, `systemPrompt`, `userContent` sont déjà construits juste au-dessus, `:131-146` — inchangés. `buildHistoryMessages` continue de recevoir `params.conversationSummary` comme **drapeau** pour borner la fenêtre.)

- [ ] **Step 6: Typecheck + commit**

Run: `cd apps/server && bun run typecheck && bun run lint`
Expected: pas d'erreur. Vérifier que `calculateBudget().summaryMaxTokens` existe (sinon utiliser le champ exact exposé par `token-budget.service`, cf. `conversation-optimizer.ts` qui consomme `budget.summaryMaxTokens`).

```bash
git add apps/server/src/services/chat/chat-message-assembler.ts apps/server/src/services/chat/mistral-chat.service.ts apps/server/src/tests/chat-message-assembler.test.ts
git commit -m "feat(chat): inject conversation summary into Mistral context"
```

---

## Task 3: Enum matière canonique + détection dans le classifier

**Files:**
- Create: `src/config/prompts/adaptation/subjects.ts`
- Modify: `src/services/chat/intent-classifier.service.ts:24-68` (type, schéma, version) + `buildPrompt`
- Test: `src/tests/intent-classifier-subject.test.ts`

**Interfaces:**
- Produces: `STUDENT_SUBJECTS: readonly StudentSubject[]`, `type StudentSubject = 'mathematiques' | 'francais' | 'langues' | 'sciences' | 'histoire-geo' | 'general'`.
- Produces (modifié) : `ClassifiedIntent` gagne `subject?: StudentSubject`. `classify(userMessage, schoolLevel)` renvoie ce champ.

- [ ] **Step 1: Create the canonical subjects module**

```ts
// src/config/prompts/adaptation/subjects.ts
export const STUDENT_SUBJECTS = [
  "mathematiques",
  "francais",
  "langues",
  "sciences",
  "histoire-geo",
  "general",
] as const;

export type StudentSubject = (typeof STUDENT_SUBJECTS)[number];
```

- [ ] **Step 2: Write the failing test**

```ts
// src/tests/intent-classifier-subject.test.ts
import { describe, it, expect } from "bun:test";
import { STUDENT_SUBJECTS } from "../config/prompts/adaptation/subjects";

describe("intent classifier subject schema", () => {
  it("exposes the canonical subjects including the 'general' fallback", () => {
    expect(STUDENT_SUBJECTS).toContain("mathematiques");
    expect(STUDENT_SUBJECTS).toContain("histoire-geo");
    expect(STUDENT_SUBJECTS).toContain("general");
  });
});
```

(La sortie LLM de `classify` est couverte en intégration/comportemental — cf. §Verification ; ce test verrouille l'enum partagé que le schéma consomme.)

- [ ] **Step 3: Run test to verify it fails**

Run: `cd apps/server && bun test src/tests/intent-classifier-subject.test.ts`
Expected: FAIL — module `subjects` introuvable (avant création) ; PASS une fois le module créé. Si déjà PASS, continuer.

- [ ] **Step 4: Extend the classifier — type, schema, version, prompt**

Dans `intent-classifier.service.ts` :

1. Import en tête : `import { STUDENT_SUBJECTS, type StudentSubject } from "../../config/prompts/adaptation/subjects";`
2. Bumper la version (`:24`) : `const INTENT_CLASSIFIER_PROMPT_VERSION = '2026-06-29-subject';`
3. Ajouter `subject` à l'interface `ClassifiedIntent` :

```ts
export interface ClassifiedIntent {
  intent: StudentIntent;
  confidence: 'low' | 'medium' | 'high';
  /** Matière détectée ('general' si indéterminée/mixte). */
  subject?: StudentSubject;
  error?: string;
}
```

4. Étendre `RESPONSE_SCHEMA.schema.properties` + `required` :

```ts
      subject: {
        type: 'string',
        enum: STUDENT_SUBJECTS,
      },
```
et `required: ['intent', 'confidence', 'subject']`.

5. Dans `classify`, typer le retour de `generateStructured` et propager `subject` :

```ts
      const parsed = await generateStructured<{ intent?: string; confidence?: string; subject?: string }>({
```
puis, là où l'objet `ClassifiedIntent` est construit à partir de `parsed`, ajouter :
```ts
        subject: (STUDENT_SUBJECTS as readonly string[]).includes(parsed.subject ?? "")
          ? (parsed.subject as StudentSubject)
          : "general",
```
6. Les courts-circuits (`trimmed.length < 3` → `unknown` ; salutations → `chit-chat`) renvoient `subject: "general"`.
7. Mettre à jour `buildPrompt` pour demander aussi la matière (ajouter une ligne du type : « Détermine également la matière scolaire parmi : mathematiques, francais, langues, sciences, histoire-geo, general (si indéterminée/mixte). »).

- [ ] **Step 5: Run tests + typecheck**

Run: `cd apps/server && bun test src/tests/intent-classifier-subject.test.ts && bun run typecheck`
Expected: PASS + pas d'erreur de type.

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/config/prompts/adaptation/subjects.ts apps/server/src/services/chat/intent-classifier.service.ts apps/server/src/tests/intent-classifier-subject.test.ts
git commit -m "feat(chat): classify student subject alongside intent"
```

---

## Task 4: Repository — `updateSubject`

**Files:**
- Modify: `src/db/repositories/study-sessions.repository.ts` (après la méthode `update`, `:170-181`)
- Test: couvert via Task 6 (intégration) ; pas de test unitaire DB ici (mirroir exact du patron `update` existant déjà couvert).

**Interfaces:**
- Produces: `updateSubject(id: string, subject: string): Promise<StudySession | undefined>`.

- [ ] **Step 1: Add the method (mirror of `update`)**

```ts
  async updateSubject(id: string, subject: string): Promise<StudySession | undefined> {
    const [session] = await db
      .update(studySessions)
      .set({ subject, updatedAt: sql`NOW()` })
      .where(eq(studySessions.id, id))
      .returning();

    return session;
  }
```

(Même import `sql`, `eq`, `db`, `studySessions` que la méthode `update` voisine — déjà présents.)

- [ ] **Step 2: Typecheck + commit**

Run: `cd apps/server && bun run typecheck`
Expected: pas d'erreur.

```bash
git add apps/server/src/db/repositories/study-sessions.repository.ts
git commit -m "feat(chat): add updateSubject to study-sessions repository"
```

---

## Task 5: Helpers purs de résolution de matière

**Files:**
- Create: `src/services/chat/subject-resolution.ts`
- Test: `src/tests/subject-resolution.test.ts`

**Interfaces:**
- Consumes: `StudentSubject` de `../../config/prompts/adaptation/subjects`.
- Produces:
  - `resolveEffectiveSubject(opts: { detected?: StudentSubject; sessionSubject?: string | null; requested?: string }): string | undefined`
  - `shouldPersistDetectedSubject(opts: { detected?: StudentSubject; sessionSubject?: string | null }): boolean`

- [ ] **Step 1: Write the failing test**

```ts
// src/tests/subject-resolution.test.ts
import { describe, it, expect } from "bun:test";
import { resolveEffectiveSubject, shouldPersistDetectedSubject } from "../services/chat/subject-resolution";

describe("resolveEffectiveSubject", () => {
  it("prefers a confident detected subject", () => {
    expect(resolveEffectiveSubject({ detected: "mathematiques", sessionSubject: "général" })).toBe("mathematiques");
  });
  it("falls back to the session subject when detection is general", () => {
    expect(resolveEffectiveSubject({ detected: "general", sessionSubject: "francais" })).toBe("francais");
  });
  it("falls back to the requested hint when nothing else is set", () => {
    expect(resolveEffectiveSubject({ detected: "general", sessionSubject: "général", requested: "svt" })).toBe("svt");
  });
  it("returns undefined when nothing resolves", () => {
    expect(resolveEffectiveSubject({ detected: "general", sessionSubject: "général" })).toBeUndefined();
  });
});

describe("shouldPersistDetectedSubject", () => {
  it("persists a confident detection over the default session subject", () => {
    expect(shouldPersistDetectedSubject({ detected: "mathematiques", sessionSubject: "général" })).toBe(true);
  });
  it("does not persist when the session already has a real subject", () => {
    expect(shouldPersistDetectedSubject({ detected: "mathematiques", sessionSubject: "francais" })).toBe(false);
  });
  it("does not persist a 'general' detection", () => {
    expect(shouldPersistDetectedSubject({ detected: "general", sessionSubject: "général" })).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/server && bun test src/tests/subject-resolution.test.ts`
Expected: FAIL — module introuvable.

- [ ] **Step 3: Implement the helpers**

```ts
// src/services/chat/subject-resolution.ts
import type { StudentSubject } from "../../config/prompts/adaptation/subjects";

/** Valeur par défaut posée à la création d'une session (study-sessions.repository create). */
const DEFAULT_SESSION_SUBJECT = "général";

function isReal(detected?: StudentSubject): detected is Exclude<StudentSubject, "general"> {
  return Boolean(detected && detected !== "general");
}

export function resolveEffectiveSubject(opts: {
  detected?: StudentSubject;
  sessionSubject?: string | null;
  requested?: string;
}): string | undefined {
  if (isReal(opts.detected)) return opts.detected;
  if (opts.sessionSubject && opts.sessionSubject !== DEFAULT_SESSION_SUBJECT) return opts.sessionSubject;
  return opts.requested ?? undefined;
}

export function shouldPersistDetectedSubject(opts: {
  detected?: StudentSubject;
  sessionSubject?: string | null;
}): boolean {
  return isReal(opts.detected) && (!opts.sessionSubject || opts.sessionSubject === DEFAULT_SESSION_SUBJECT);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/server && bun test src/tests/subject-resolution.test.ts`
Expected: PASS (7/7).

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/services/chat/subject-resolution.ts apps/server/src/tests/subject-resolution.test.ts
git commit -m "feat(chat): pure subject resolution helpers"
```

---

## Task 6: Orchestration — persister la matière + l'utiliser

**Files:**
- Modify: `src/services/chat/chat-orchestration.service.ts` (resolveSession `:231-264`, after-classify `:96-99`, params passés au stream)

**Interfaces:**
- Consumes: `classifiedIntent.subject` (Task 3), `resolveEffectiveSubject` + `shouldPersistDetectedSubject` (Task 5), `studySessionsRepository.updateSubject` (Task 4).
- Produces: `study_sessions.subject` mis à jour à la 1ʳᵉ détection confiante ; `subject` effectif passé aux params de génération.

- [ ] **Step 1: Make `resolveSession` return the session subject**

Dans `SessionContext` (interface de retour de `resolveSession`), ajouter `subject: string | null`. Dans le `return` de `resolveSession` (`:258-262`), ajouter :
```ts
      subject: sessionSummary?.subject ?? null,
```
(`getSessionWithSummary` renvoie déjà la ligne session ; si `subject` n'y est pas, utiliser `await chatSessionService.getSession(sessionId)` déjà appelé plus haut, ou ajouter `subject` à la projection de `getSessionWithSummary`.)

- [ ] **Step 2: Persist detected subject + compute effective subject after classify**

Juste après la dérivation de `intentReinforcement`/`episodicContext` (`:96-99`), ajouter :

```ts
    const detectedSubject = classifiedIntent.subject;
    const effectiveSubject = resolveEffectiveSubject({
      detected: detectedSubject,
      sessionSubject: sessionCtx.subject,
      requested: request.subject,
    });
    if (shouldPersistDetectedSubject({ detected: detectedSubject, sessionSubject: sessionCtx.subject })) {
      studySessionsRepository
        .updateSubject(sessionCtx.sessionId, detectedSubject as string)
        .catch((err) => logger.warn("subject persist failed", { _error: String(err) }));
    }
```

Imports à ajouter en tête : `resolveEffectiveSubject`, `shouldPersistDetectedSubject` (de `./subject-resolution`) et `studySessionsRepository` (de `../../db/repositories/study-sessions.repository`) s'ils ne sont pas déjà importés.

- [ ] **Step 3: Pass the effective subject to the generation params**

Là où l'orchestration construit les params passés à `mistralChatService` (l'objet qui porte aujourd'hui `subject: request.subject`), remplacer par `subject: effectiveSubject`. (Chercher `subject:` dans la construction des params de stream du même fichier — c'est le champ consommé par `buildSystemPromptForChat`/reasoning.)

- [ ] **Step 4: Typecheck + lint + full test**

Run: `cd apps/server && bun run typecheck && bun run lint && bun run test`
Expected: PASS (toutes suites, dont les nouvelles). Corriger tout type `SessionContext`/import manquant.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/services/chat/chat-orchestration.service.ts
git commit -m "feat(chat): persist detected subject and use it for the turn"
```

---

## Verification (intégration + comportemental, avant de clore le lot)

1. `cd apps/server && bun run typecheck && bun run lint && bun run test && bun run test:integration` — tout vert.
2. Stack up (`docker compose up -d`, `bun run dev`) + `pnpm seed`. Login `dev.eleve`.
3. **Injection résumé** : tenir une conversation > 20 messages, établir un fait tôt (« je m'appelle Léa et je suis en 3e B »), continuer au-delà de la fenêtre verbatim, puis demander un rappel du fait → Tom le restitue (échoue avant le lot). Optionnel : logguer le tableau `messages` et confirmer la présence du bloc `<conversation_summary>`.
4. **Détection matière** : nouvelle conversation → question de maths → vérifier en DB `SELECT subject FROM study_sessions WHERE id = …` = `mathematiques` ; nouvelle conversation → question d'histoire → `histoire-geo`. Vérifier l'anti-thrash : une fois la matière posée, une question d'une autre matière dans la même conversation ne la ré-écrit pas.
5. Pas d'e2e écrits (méthode utilisateur : vérification de visu/comportementale).

---

## Self-Review (rempli)

- **Couverture spec** : §4.1 (injection résumé) → Tasks 1-2 ; §4.2 (détection matière : classifier + persistance + usage) → Tasks 3-4-5-6. ✓
- **Placeholders** : aucun « TODO/à compléter » ; chaque step porte le code réel. Deux points dépendent d'un chemin à confirmer dans le code (type `MistralMessage`, champ `summaryMaxTokens`, projection `subject` de `getSessionWithSummary`) — instruction explicite donnée pour les résoudre, pas un placeholder.
- **Cohérence des types** : `StudentSubject`/`STUDENT_SUBJECTS` définis en Task 3, consommés identiquement en Tasks 5-6 ; `assembleChatMessages`/`ChatMessageParts` définis en Task 2 et appelés avec les mêmes clés ; `updateSubject(id, subject)` défini en Task 4 et appelé en Task 6. ✓
