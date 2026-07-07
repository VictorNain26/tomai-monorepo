# Chat Lot 3 — Profil mémoire élève par matière Implementation Plan

> **STATUT : LIVRÉ** — mergé le 2026-06-30 (PR #259). Document conservé comme trace d'exécution ; ne pas exécuter.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Persister un profil mémoire de l'élève **par matière** (concepts vus, difficultés récurrentes, notes de maîtrise), l'alimenter depuis l'extraction épisodique existante, et l'injecter comme bloc compact dans le contexte chat — sans casser le cache prompt partagé.

**Architecture:** Nouvelle table `student_subject_profile (userId, subject)`, distincte de la mémoire épisodique pgvector (rappel sémantique par session) et du profil cognitif global (`studentCognitiveProfiles`, par élève). Alimentée en s'accrochant à `episodicMemoryService.extractAndStore` (déclenché au reset/fin de session). Injectée comme message `role:'user'` **après** le préfixe système stable (cache intact). Endpoint `GET/PATCH /api/student/memory` scopé à l'élève (consultation/édition RGPD).

**Tech Stack:** Bun + Elysia + Drizzle (PostgreSQL pgvector), Mistral. Tests : Bun runner (`src/tests/<name>.test.ts`).

**Découpage en 2 PR (cadence main-à-jour) :** **3a = serveur** (ce plan, branche `feat/chat-lot3-memory-server`) — mergeable et vérifiable seul. **3b = UI web** (élève consulte/édite sa mémoire) — détaillée après merge de 3a, calque Lot 2.

## Global Constraints

- **RGPD mineurs (acté)** : données **strictement pédagogiques** (concepts, difficultés, notes de maîtrise) — **aucune donnée sensible** (santé, opinions, etc.). Accès **élève seul** (endpoint scopé `user.id`). FK `userId` en `onDelete('cascade')` (droit à l'effacement via suppression de compte). **TTL/décroissance** sur le profil (purge des entrées non rafraîchies). Cf. `~/.claude/rules/marketing.md` (CNIL mineurs).
- **Cache prompt intact (critère §6)** : le bloc mémoire s'injecte en message `role:'user'` APRÈS le message système. **NE JAMAIS** le mettre dans `buildSystemPrompt`/`system-prompt.ts` ni toucher `PROMPT_CACHE_VERSION`/la clé `chat-…`.
- **Conventions serveur** : validation HTTP TypeBox `t` natif Elysia sur chaque route ; `authMacro` + `.guard({ auth: true })` ; route fine → service → repository (jamais de DB directe en route, jamais de logique en route) ; une méthode repo = une requête.
- **Migration** : modif `src/db/schema.ts` puis `db:generate` (SQL commité) — pas de `db:push` en prod. Nouvelle colonne nullable d'abord.
- **Validation avant commit** : `cd apps/server && bun run typecheck && bun run lint && bun run test`. Avant push : `bun run test:integration` (penser au mock `drizzle-orm` dans `api-endpoints.test.ts` si la chaîne `app.ts` tire un nouveau module).
- TypeScript strict, zéro `any`, zéro `eslint-disable`.

---

## File Structure (PR 3a)

| Fichier | Rôle | Action |
|---|---|---|
| `apps/server/src/db/schema/learning.schema.ts` | Table `studentSubjectProfiles` + types | Modify |
| `apps/server/src/db/repositories/student-subject-profile.repository.ts` | Data access (upsert agrégatif, findByUser, updateNotes, purge TTL) | Create |
| `apps/server/src/db/repositories/index.ts` | Export du repo | Modify |
| `apps/server/src/services/chat/subject-profile.service.ts` | Agrégation depuis un épisode, lecture, édition, formatage prompt | Create |
| `apps/server/src/services/episodic-memory.service.ts` | Appel d'agrégation après l'insert épisode | Modify |
| `apps/server/src/services/chat/chat-orchestration.service.ts` | Charger le bloc mémoire matière + le passer au stream | Modify |
| `apps/server/src/services/chat/mistral-helpers.ts` | Inclure le bloc dans `wrapStudentContext` | Modify |
| `apps/server/src/routes/api/student.routes.ts` | `GET`/`PATCH /api/student/memory` | Create |
| `apps/server/src/routes/api/index.ts` | Monter `studentApiRoutes` | Modify |
| Tests | `subject-profile.service.test.ts`, `student-memory.routes` (intégration) | Create |

---

## Task 1: Table `studentSubjectProfiles` + migration

**Files:**
- Modify: `apps/server/src/db/schema/learning.schema.ts`
- Test: vérification via typecheck + `db:generate`

**Interfaces:**
- Produces: table `studentSubjectProfiles`, types `StudentSubjectProfile = typeof studentSubjectProfiles.$inferSelect`, `NewStudentSubjectProfile = typeof studentSubjectProfiles.$inferInsert`.

- [ ] **Step 1: Ajouter la table** (à la suite des autres tables de `learning.schema.ts`, en suivant le style de `progress` et `sessionEpisodes`)

```ts
// Profil mémoire élève PAR MATIÈRE — agrégat pédagogique durable, distinct de
// sessionEpisodes (par session, pgvector) et studentCognitiveProfiles (global).
export const studentSubjectProfiles = pgTable('student_subject_profile', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: varchar('user_id', { length: 255 })
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  subject: varchar('subject', { length: 100 }).notNull(),
  // Concepts rencontrés (agrégés depuis episode.conceptsCovered), dédupliqués.
  conceptsSeen: jsonb('concepts_seen').$type<string[]>().notNull().default([]),
  // Difficultés / erreurs récurrentes (texte court orienté pédagogie).
  difficulties: jsonb('difficulties').$type<string[]>().notNull().default([]),
  // Note de maîtrise libre, éditable par l'élève (consultation/édition RGPD).
  masteryNotes: text('mastery_notes'),
  sessionsCount: integer('sessions_count').notNull().default(0),
  lastOutcome: varchar('last_outcome', { length: 32 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  // Décroissance : profil non rafraîchi depuis longtemps → purge (RGPD minimisation).
  ttlUntil: timestamp('ttl_until').notNull(),
}, (table) => [
  uniqueIndex('uq_subject_profile_user_subject').on(table.userId, table.subject),
  index('idx_subject_profile_user').on(table.userId),
  index('idx_subject_profile_ttl').on(table.ttlUntil),
]);

export type StudentSubjectProfile = typeof studentSubjectProfiles.$inferSelect;
export type NewStudentSubjectProfile = typeof studentSubjectProfiles.$inferInsert;
```

Vérifier que les imports (`jsonb`, `integer`, `uniqueIndex`, `index`, `text`, `timestamp`, `varchar`, `uuid`, `pgTable`, `user`) sont déjà présents dans le fichier (ils le sont pour les autres tables ; ajouter seulement ce qui manque).

- [ ] **Step 2: Générer la migration**

Run: `cd apps/server && bun run db:generate`
Expected: un nouveau fichier SQL sous `drizzle/` créant `student_subject_profile`. **Le lire** pour confirmer : colonnes, FK cascade, unique index `(user_id, subject)`.

- [ ] **Step 3: Typecheck + commit**

Run: `cd apps/server && bun run typecheck`

```bash
git add apps/server/src/db/schema/learning.schema.ts apps/server/drizzle/
git commit -m "feat(db): student_subject_profile table (per-subject memory)"
```

---

## Task 2: Repository `studentSubjectProfileRepository`

**Files:**
- Create: `apps/server/src/db/repositories/student-subject-profile.repository.ts`
- Modify: `apps/server/src/db/repositories/index.ts` (export)
- Test: couvert par le test service (Task 3) — repo = requêtes Drizzle fines.

**Interfaces:**
- Consumes: `studentSubjectProfiles`, types (Task 1).
- Produces:
  - `findByUserAndSubject(userId, subject): Promise<StudentSubjectProfile | undefined>`
  - `findByUser(userId): Promise<StudentSubjectProfile[]>`
  - `upsertAggregate(input: { userId; subject; addedConcepts: string[]; addedDifficulties: string[]; outcome?: string; ttlDays: number }): Promise<StudentSubjectProfile>` — insère ou met à jour en **fusionnant/dédupliquant** concepts & difficultés, incrémente `sessionsCount`, repousse `ttlUntil`.
  - `updateNotes(userId, subject, patch: { masteryNotes?: string | null; difficulties?: string[] }): Promise<StudentSubjectProfile | undefined>` — édition élève.

- [ ] **Step 1: Implémenter le repo**

```ts
import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '../client';
import { studentSubjectProfiles, type StudentSubjectProfile } from '../schema';

const MAX_CONCEPTS = 100;
const MAX_DIFFICULTIES = 50;

function mergeDedup(existing: string[], added: string[], cap: number): string[] {
  const seen = new Set(existing.map((s) => s.toLowerCase()));
  const out = [...existing];
  for (const item of added) {
    const key = item.trim().toLowerCase();
    if (key && !seen.has(key)) {
      seen.add(key);
      out.push(item.trim());
    }
  }
  return out.slice(-cap);
}

export const studentSubjectProfileRepository = {
  async findByUserAndSubject(userId: string, subject: string): Promise<StudentSubjectProfile | undefined> {
    const [row] = await db
      .select()
      .from(studentSubjectProfiles)
      .where(and(eq(studentSubjectProfiles.userId, userId), eq(studentSubjectProfiles.subject, subject)))
      .limit(1);
    return row;
  },

  async findByUser(userId: string): Promise<StudentSubjectProfile[]> {
    return db
      .select()
      .from(studentSubjectProfiles)
      .where(eq(studentSubjectProfiles.userId, userId))
      .orderBy(desc(studentSubjectProfiles.updatedAt));
  },

  async upsertAggregate(input: {
    userId: string;
    subject: string;
    addedConcepts: string[];
    addedDifficulties: string[];
    outcome?: string;
    ttlDays: number;
  }): Promise<StudentSubjectProfile> {
    const existing = await this.findByUserAndSubject(input.userId, input.subject);
    const ttlUntil = sql`NOW() + (${input.ttlDays} || ' days')::interval`;

    if (!existing) {
      const [created] = await db
        .insert(studentSubjectProfiles)
        .values({
          userId: input.userId,
          subject: input.subject,
          conceptsSeen: mergeDedup([], input.addedConcepts, MAX_CONCEPTS),
          difficulties: mergeDedup([], input.addedDifficulties, MAX_DIFFICULTIES),
          sessionsCount: 1,
          lastOutcome: input.outcome ?? null,
          ttlUntil: ttlUntil as unknown as Date,
        })
        .returning();
      return created;
    }

    const [updated] = await db
      .update(studentSubjectProfiles)
      .set({
        conceptsSeen: mergeDedup(existing.conceptsSeen, input.addedConcepts, MAX_CONCEPTS),
        difficulties: mergeDedup(existing.difficulties, input.addedDifficulties, MAX_DIFFICULTIES),
        sessionsCount: existing.sessionsCount + 1,
        lastOutcome: input.outcome ?? existing.lastOutcome,
        updatedAt: sql`NOW()`,
        ttlUntil: ttlUntil as unknown as Date,
      })
      .where(eq(studentSubjectProfiles.id, existing.id))
      .returning();
    return updated;
  },

  async updateNotes(
    userId: string,
    subject: string,
    patch: { masteryNotes?: string | null; difficulties?: string[] },
  ): Promise<StudentSubjectProfile | undefined> {
    const [updated] = await db
      .update(studentSubjectProfiles)
      .set({
        ...(patch.masteryNotes !== undefined && { masteryNotes: patch.masteryNotes }),
        ...(patch.difficulties !== undefined && { difficulties: patch.difficulties.slice(0, MAX_DIFFICULTIES) }),
        updatedAt: sql`NOW()`,
      })
      .where(and(eq(studentSubjectProfiles.userId, userId), eq(studentSubjectProfiles.subject, subject)))
      .returning();
    return updated;
  },
};
```

- [ ] **Step 2: Exporter** dans `apps/server/src/db/repositories/index.ts` (suivre le style des exports existants : `export { studentSubjectProfileRepository } from './student-subject-profile.repository';`). Vérifier le vrai chemin du client db (`../client`) en s'alignant sur un repo voisin (ex. `study-sessions.repository.ts`).

- [ ] **Step 3: Typecheck + commit**

Run: `cd apps/server && bun run typecheck`

```bash
git add apps/server/src/db/repositories/student-subject-profile.repository.ts apps/server/src/db/repositories/index.ts
git commit -m "feat(db): studentSubjectProfile repository (aggregate upsert + notes)"
```

---

## Task 3: Service `subjectProfileService` (agrégation, lecture, édition, formatage)

**Files:**
- Create: `apps/server/src/services/chat/subject-profile.service.ts`
- Test: `apps/server/src/tests/subject-profile.service.test.ts`

**Interfaces:**
- Consumes: `studentSubjectProfileRepository` (Task 2), `STUDENT_SUBJECTS` (`config/prompts/adaptation/subjects`).
- Produces:
  - `aggregateFromEpisode(input: { userId; subject; conceptsCovered: string[]; outcome?: string }): Promise<void>` — pas d'agrégation si `subject` ∉ enum réel (skip `general`). TTL = `SUBJECT_PROFILE_TTL_DAYS`.
  - `getMemory(userId): Promise<Array<{ subject; conceptsSeen; difficulties; masteryNotes; sessionsCount; updatedAt }>>`
  - `editMemory(userId, subject, patch): Promise<...>` (validé en amont par la route).
  - `formatSubjectMemoryForPrompt(userId, subject): Promise<string | null>` — bloc compact `<subject_memory>` (concepts récents + difficultés), `null` si pas de profil ou subject indéterminé.

- [ ] **Step 1: Test d'abord** (mock du repo)

```ts
// apps/server/src/tests/subject-profile.service.test.ts
import { describe, it, expect, mock, beforeEach } from 'bun:test';

let store: Record<string, unknown> = {};
mock.module('../db/repositories/student-subject-profile.repository', () => ({
  studentSubjectProfileRepository: {
    upsertAggregate: mock(async (input: Record<string, unknown>) => { store = input; return store; }),
    findByUser: mock(async () => [
      { subject: 'mathematiques', conceptsSeen: ['fractions'], difficulties: ['signe -'], masteryNotes: null, sessionsCount: 2, updatedAt: new Date() },
    ]),
    findByUserAndSubject: mock(async () => ({ subject: 'mathematiques', conceptsSeen: ['fractions'], difficulties: ['signe -'], masteryNotes: null })),
    updateNotes: mock(async (_u: string, _s: string, p: Record<string, unknown>) => ({ subject: 'mathematiques', ...p })),
  },
}));

const { subjectProfileService } = await import('../services/chat/subject-profile.service');

beforeEach(() => { store = {}; });

describe('subjectProfileService', () => {
  it('skips aggregation for the general subject', async () => {
    await subjectProfileService.aggregateFromEpisode({ userId: 'u1', subject: 'general', conceptsCovered: ['x'] });
    expect(store).toEqual({});
  });
  it('aggregates concepts for a real subject', async () => {
    await subjectProfileService.aggregateFromEpisode({ userId: 'u1', subject: 'mathematiques', conceptsCovered: ['fractions'], outcome: 'completed' });
    expect((store as { subject?: string }).subject).toBe('mathematiques');
  });
  it('formats a compact memory block, null when subject is general', async () => {
    expect(await subjectProfileService.formatSubjectMemoryForPrompt('u1', 'general')).toBeNull();
    const block = await subjectProfileService.formatSubjectMemoryForPrompt('u1', 'mathematiques');
    expect(block).toContain('<subject_memory>');
    expect(block).toContain('fractions');
  });
});
```

Run: `cd apps/server && bun test src/tests/subject-profile.service.test.ts` → FAIL (module manquant).

- [ ] **Step 2: Implémenter le service**

```ts
import { studentSubjectProfileRepository } from '../../db/repositories/student-subject-profile.repository.js';
import { STUDENT_SUBJECTS } from '../../config/prompts/adaptation/subjects.js';
import { logger } from '../../lib/observability.js';

const SUBJECT_PROFILE_TTL_DAYS = 180;
const PROMPT_CONCEPTS = 12;
const PROMPT_DIFFICULTIES = 6;

function isRealSubject(subject: string): boolean {
  return (STUDENT_SUBJECTS as readonly string[]).includes(subject) && subject !== 'general';
}

class SubjectProfileService {
  async aggregateFromEpisode(input: {
    userId: string;
    subject: string;
    conceptsCovered: string[];
    outcome?: string;
  }): Promise<void> {
    if (!isRealSubject(input.subject)) return;
    try {
      await studentSubjectProfileRepository.upsertAggregate({
        userId: input.userId,
        subject: input.subject,
        addedConcepts: input.conceptsCovered ?? [],
        addedDifficulties: [],
        outcome: input.outcome,
        ttlDays: SUBJECT_PROFILE_TTL_DAYS,
      });
    } catch (err) {
      logger.warn('Subject profile aggregation failed', {
        operation: 'subject-profile:aggregate',
        _error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  async getMemory(userId: string) {
    const rows = await studentSubjectProfileRepository.findByUser(userId);
    return rows.map((r) => ({
      subject: r.subject,
      conceptsSeen: r.conceptsSeen,
      difficulties: r.difficulties,
      masteryNotes: r.masteryNotes,
      sessionsCount: r.sessionsCount,
      updatedAt: r.updatedAt,
    }));
  }

  async editMemory(userId: string, subject: string, patch: { masteryNotes?: string | null; difficulties?: string[] }) {
    return studentSubjectProfileRepository.updateNotes(userId, subject, patch);
  }

  async formatSubjectMemoryForPrompt(userId: string, subject: string): Promise<string | null> {
    if (!isRealSubject(subject)) return null;
    const profile = await studentSubjectProfileRepository.findByUserAndSubject(userId, subject);
    if (!profile) return null;
    const concepts = profile.conceptsSeen.slice(-PROMPT_CONCEPTS);
    const difficulties = profile.difficulties.slice(-PROMPT_DIFFICULTIES);
    if (concepts.length === 0 && difficulties.length === 0 && !profile.masteryNotes) return null;
    const lines = [`Matière : ${subject}`];
    if (concepts.length) lines.push(`Concepts déjà abordés : ${concepts.join(', ')}`);
    if (difficulties.length) lines.push(`Points de difficulté récurrents : ${difficulties.join(', ')}`);
    if (profile.masteryNotes) lines.push(`Note : ${profile.masteryNotes}`);
    return `<subject_memory>\n${lines.join('\n')}\n</subject_memory>`;
  }
}

export const subjectProfileService = new SubjectProfileService();
```

Run: `cd apps/server && bun test src/tests/subject-profile.service.test.ts` → PASS (3/3).

- [ ] **Step 3: Typecheck + lint + commit**

```bash
git add apps/server/src/services/chat/subject-profile.service.ts apps/server/src/tests/subject-profile.service.test.ts
git commit -m "feat(chat): subject memory profile service (aggregate, read, edit, format)"
```

---

## Task 4: Alimentation — agréger après l'extraction épisodique

**Files:**
- Modify: `apps/server/src/services/episodic-memory.service.ts` (dans `extractAndStore`, après l'insert de l'épisode, ~`:160`)

**Interfaces:**
- Consumes: `subjectProfileService.aggregateFromEpisode` (Task 3), la session (`subject`) et le `parsed` (`conceptsCovered`, `outcome`) déjà disponibles dans `extractAndStore`.

- [ ] **Step 1: Brancher l'agrégation** (fire-and-forget, ne doit pas faire échouer l'extraction). Juste avant le `return` de `extractAndStore`, après l'insert :

```ts
// Lot 3 : agréger la sortie de l'épisode dans le profil mémoire matière.
// Fire-and-forget — un échec ici ne doit pas casser l'extraction épisodique.
void subjectProfileService
  .aggregateFromEpisode({
    userId,
    subject: session.subject,
    conceptsCovered: parsed.conceptsCovered ?? [],
    outcome: parsed.outcome,
  })
  .catch((err) =>
    logger.warn('Subject profile aggregation (post-episode) failed', {
      operation: 'episodic:subject-profile',
      _error: err instanceof Error ? err.message : String(err),
    }),
  );
```

Ajouter l'import `import { subjectProfileService } from './chat/subject-profile.service.js';` (vérifier le chemin relatif réel depuis `episodic-memory.service.ts`). Vérifier les noms exacts des variables locales (`session`, `parsed`, `userId`) dans la fonction et s'y aligner.

- [ ] **Step 2: Typecheck + commit**

```bash
git add apps/server/src/services/episodic-memory.service.ts
git commit -m "feat(chat): feed subject memory profile from episodic extraction"
```

---

## Task 5: Injection du bloc mémoire dans le contexte chat (cache intact)

**Files:**
- Modify: `apps/server/src/services/chat/chat-orchestration.service.ts` (charger le bloc + le fusionner dans le learning context)
- Modify: `apps/server/src/services/chat/mistral-helpers.ts` (`wrapStudentContext` n'a pas à changer si on fusionne en amont — voir ci-dessous)
- Test: `apps/server/src/tests/subject-profile-injection.test.ts` (le bloc n'entre PAS dans le system prompt)

**Approche (la plus simple, cache-safe)** : récupérer le bloc via `subjectProfileService.formatSubjectMemoryForPrompt(userId, effectiveSubject)` dans l'orchestration, et le concaténer dans le `mergedLearningContext` existant (déjà injecté en message `role:'user'` via `<student_context>`, donc APRÈS le préfixe stable — cf. exploration `chat-orchestration.service.ts:204-219`). Aucune modif de `system-prompt.ts`, aucune modif de la clé de cache.

- [ ] **Step 1: Charger le bloc en parallèle** (dans le `Promise.all` du contexte, ou juste après `effectiveSubject` est résolu). Comme `effectiveSubject` est calculé après le classify, charger juste après :

```ts
const subjectMemoryBlock = effectiveSubject
  ? await subjectProfileService.formatSubjectMemoryForPrompt(request.userId, effectiveSubject)
  : null;
```

- [ ] **Step 2: Fusionner dans le learning context** (là où `mergedLearningContext` est construit, `:204-206`) :

```ts
const mergedLearningContext = [learningContext, episodicContext, subjectMemoryBlock]
  .filter(Boolean)
  .join('\n\n');
```

Ajouter l'import `subjectProfileService`. NE PAS toucher `buildSystemPrompt`, `PROMPT_CACHE_VERSION`, ni la clé `chat-…`.

- [ ] **Step 3: Test — le bloc reste hors du system prompt**

```ts
// apps/server/src/tests/subject-profile-injection.test.ts
import { describe, it, expect } from 'bun:test';
import { assembleChatMessages } from '../services/chat/chat-message-assembler';

describe('subject memory injection', () => {
  it('keeps the memory block in a user message, never in the system prompt', () => {
    const out = assembleChatMessages({
      systemPrompt: 'SYS',
      studentContextBlock: '<student_context>\n<subject_memory>\nMatière : mathematiques\n</subject_memory>\n</student_context>',
      historyMessages: [],
      userContent: 'q',
    });
    expect(out[0]).toEqual({ role: 'system', content: 'SYS' });
    expect(String(out[0].content)).not.toContain('subject_memory');
    expect(out.some((m) => m.role === 'user' && String(m.content).includes('<subject_memory>'))).toBe(true);
  });
});
```

Run: `cd apps/server && bun test src/tests/subject-profile-injection.test.ts` → PASS.

- [ ] **Step 4: Typecheck + lint + commit**

```bash
git add apps/server/src/services/chat/chat-orchestration.service.ts apps/server/src/tests/subject-profile-injection.test.ts
git commit -m "feat(chat): inject per-subject memory block into context (cache prefix intact)"
```

---

## Task 6: Endpoint `GET`/`PATCH /api/student/memory`

**Files:**
- Create: `apps/server/src/routes/api/student.routes.ts`
- Modify: `apps/server/src/routes/api/index.ts` (monter `studentApiRoutes`)
- Test: ajouter au harnais d'intégration des routes si pertinent (`api-endpoints.test.ts`), sinon test service déjà couvert.

**Interfaces:**
- Consumes: `subjectProfileService.getMemory` / `.editMemory` (Task 3), `authMacro`.
- Produces: `GET /api/student/memory` → `{ success, memory: [...] }` ; `PATCH /api/student/memory` body `{ subject, masteryNotes?, difficulties? }` → `{ success, profile }`. Scopé à `user.id` (jamais d'`userId` client).

- [ ] **Step 1: Implémenter la route** (calquer `progress.routes.ts` / `chat-session.routes.ts`)

```ts
import { Elysia, t } from 'elysia';
import { authMacro } from '../../lib/auth-macro.js';
import { subjectProfileService } from '../../services/chat/subject-profile.service.js';
import { STUDENT_SUBJECTS } from '../../config/prompts/adaptation/subjects.js';

export const studentApiRoutes = new Elysia({ name: 'api-student' })
  .use(authMacro)
  .guard({ auth: true })
  .get('/student/memory', async ({ user }) => {
    const memory = await subjectProfileService.getMemory(user.id);
    return { success: true, memory };
  })
  .patch(
    '/student/memory',
    async ({ user, body }) => {
      const profile = await subjectProfileService.editMemory(user.id, body.subject, {
        masteryNotes: body.masteryNotes ?? undefined,
        difficulties: body.difficulties ?? undefined,
      });
      return { success: true, profile };
    },
    {
      body: t.Object({
        subject: t.Union(STUDENT_SUBJECTS.map((s) => t.Literal(s))),
        masteryNotes: t.Optional(t.Nullable(t.String({ maxLength: 500 }))),
        difficulties: t.Optional(t.Array(t.String({ maxLength: 120 }), { maxItems: 50 })),
      }),
    },
  );
```

> ⚠️ Eden/TypeBox : `t.Union(STUDENT_SUBJECTS.map(...))` doit recevoir un tuple non vide — si TS se plaint, lister les littéraux à la main (`t.Union([t.Literal('mathematiques'), …])`) en s'alignant sur le pattern de la mémoire projet (« pas de `t.Union(map)` ; unions à la main + garde `Static<>` »). Vérifier ce point AVANT de coder.

- [ ] **Step 2: Monter la route** dans `routes/api/index.ts` : import + `.use(studentApiRoutes)` dans le groupe `/api`.

- [ ] **Step 3: Validation complète + commit**

Run: `cd apps/server && bun run typecheck && bun run lint && bun run test && bun run test:integration`
Expected: tout vert. Si `api-endpoints.test.ts` casse (chaîne `app.ts` → nouveau module tirant Drizzle), mocker `student-subject-profile.repository` sur le pattern de `retention-purge.service` (cf. `.claude/rules/testing-and-commits.md`).

```bash
git add apps/server/src/routes/api/student.routes.ts apps/server/src/routes/api/index.ts
git commit -m "feat(server): GET/PATCH /api/student/memory (student-scoped)"
```

- [ ] **Step 4: Vérification comportementale** (stack lancée) : nouvelle conversation maths → question → reset (déclenche l'extraction) → `SELECT * FROM student_subject_profile WHERE user_id=…` montre `subject='mathematiques'` + `concepts_seen` peuplé ; tour suivant en maths → le bloc `<subject_memory>` est présent dans le contexte (log `Chat context ready` / inspection) ; `GET /api/student/memory` renvoie le profil ; `PATCH` édite `masteryNotes`.

---

## PR 3b — UI web (à détailler après merge de 3a)

Branche `feat/chat-lot3-memory-web`, calque **Lot 2** (hook + composant + page + tests vitest) :
- `apps/web/lib/hooks/use-student-memory.ts` — `useStudentMemory()` : `GET`/`PATCH /api/student/memory` via `@repo/api` (Eden), TanStack Query, type `StudentMemory` dérivé du contrat.
- `apps/web/components/student/memory/…` — affichage par matière (concepts, difficultés, note éditable), états loading/empty/error.
- `apps/web/app/student/memory/page.tsx` + entrée nav student (« Ma mémoire » / « Mon profil ») dans `app/student/layout.tsx`.
- Tests vitest (hook + composant). Vérif comportementale : login élève → page mémoire → voir/éditer.
- Contrainte : zéro `any`/`eslint-disable`, `@repo/ui` + tokens, a11y (form labels, états) — cf. `~/.claude/rules/designer.md`.

---

## Self-Review (3a)

- **Spec §5 Lot 3** : table `(userId,subject)` ✓ (T1) ; alimentation via extraction épisodique ✓ (T4 s'accroche à `extractAndStore`) ; injection bloc compact après préfixe stable ✓ (T5, en message `user`) ; endpoint `GET/PATCH` ✓ (T6). Critères §6 : profil mis à jour après session (T4) ; bloc présent (T5) ; **cache préfixe inchangé** (T5 ne touche ni `system-prompt.ts` ni la clé). ✓
- **RGPD** : données pédagogiques only, accès élève (endpoint scopé `user.id`), FK cascade (effacement), TTL 180j (minimisation). ✓ Accès parent **non** inclus (décision : élève seul).
- **Placeholders** : aucun. Points à vérifier signalés (chemin client db, noms de variables dans `extractAndStore`, `t.Union` tuple). 
- **Cohérence types** : `studentSubjectProfiles`/types (T1) → repo (T2) → service (T3) → alimentation (T4) + injection (T5) + route (T6). `aggregateFromEpisode`/`getMemory`/`editMemory`/`formatSubjectMemoryForPrompt` définis T3, consommés T4/T5/T6.
