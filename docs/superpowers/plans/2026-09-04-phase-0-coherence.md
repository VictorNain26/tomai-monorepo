# Phase 0 — Cohérence de l'agent : plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Une seule taxonomie de matières traversant classifieur, prompts, outils, reasoning et cartes ; restes du RAG purgés ; ADR écrits ; landing et mobile alignés sur ce que le serveur fait vraiment.

**Architecture:** Un module `apps/server/src/config/subjects.ts` devient la source unique (6 familles + 13 slugs + normalisation). Les cinq consommateurs (`by-subject.ts`, `mistral-reasoning.ts`, `tool-declarations.ts`/`chat-tools.ts`, `learning/prompts/by-subject.ts`, `adaptation/subjects.ts`) délèguent à ce module sans changer leurs signatures publiques. Les changements de copy (landing, README, ADR) sont des tâches séparées, chacune validée par le build de son app.

**Tech Stack:** Bun 1.3, TypeScript strict, Elysia 1.4, Vercel AI SDK 7 (`ai@7.0.15`, `@ai-sdk/mistral@4.0.5`), Zod 4, Bun test runner via `scripts/run-tests.ts`, Next 16 (landing), Expo 56 + jest-expo (mobile).

**Spec:** `docs/superpowers/specs/2026-09-04-audit-agent-ia.md` (constats F1-F5, F10-F12, décisions D1, D5, D8, D10, D11).

**Ordre :** cette phase s'exécute **après la phase 1** (décision D10). Le harnais d'évaluation existe donc déjà, avec une baseline prise sur `main` avant ces changements. C'est le premier changement mesuré du projet : la Task 11 compare un run complet à cette baseline et produit la nouvelle baseline.

## Global Constraints

- Branche `chore/agent-coherence-phase0` depuis `main` après merge de la phase 1 ; PR ; merge commit, jamais de squash.
- Stager fichier par fichier, jamais `git add .` ; messages `<type>(<scope>): <description>` en anglais, scopes `chat`, `server`, `landing`, `mobile`, `docs`.
- Validation serveur avant chaque commit : `cd apps/server && bun run typecheck && bun run lint && bun run test` (exit 0 lu, pas supposé). Landing : `cd apps/landing && pnpm typecheck && pnpm lint && pnpm build`. Mobile : `cd apps/mobile && pnpm typecheck && pnpm lint && pnpm test`.
- Tests serveur dans `apps/server/src/tests/<nom>.test.ts`, runner Bun, `mock.module` avec chemins relatifs sans `.js`.
- Zéro `eslint-disable`, zéro commentaire hors WHY non évident, fichiers < 400 lignes.
- Contrat Eden : la route `/student/memory` garde son union de 6 valeurs ; `TomMetadata` ne perd que `usedRAG` (aucun consommateur, vérifié par `grep -rn usedRAG apps packages`).
- Toute modification du contenu sous `config/prompts/**` ou `shared/pedagogy/**` bumpe `PROMPT_CACHE_VERSION` dans `ai-chat.service.ts` (une seule fois pour la PR : `'2026-09-05-taxonomy'`).

---

### Task 1: Source unique de la taxonomie des matières

**Files:**
- Create: `apps/server/src/config/subjects.ts`
- Modify: `apps/server/src/config/prompts/adaptation/subjects.ts` (devient un ré-export)
- Test: `apps/server/src/tests/config-subjects.test.ts`

**Interfaces:**
- Produces: `SUBJECT_FAMILIES` (readonly tuple de 6), `type SubjectFamily`, `SUBJECT_SLUGS` (readonly tuple de 13), `type SubjectSlug`, `normalizeSubjectSlug(value: string | null | undefined): SubjectSlug | SubjectFamily | null`, `subjectFamily(value: string | null | undefined): SubjectFamily`.
- `STUDENT_SUBJECTS` et `StudentSubject` restent importables depuis `config/prompts/adaptation/subjects.js` (mêmes valeurs qu'aujourd'hui).

- [ ] **Step 1: Write the failing test**

```ts
// apps/server/src/tests/config-subjects.test.ts
import { describe, it, expect } from 'bun:test';
import {
  SUBJECT_FAMILIES,
  SUBJECT_SLUGS,
  normalizeSubjectSlug,
  subjectFamily,
} from '../config/subjects';
import { STUDENT_SUBJECTS } from '../config/prompts/adaptation/subjects';

describe('SUBJECT_SLUGS / SUBJECT_FAMILIES', () => {
  it('expose 13 slugs fins et 6 familles', () => {
    expect(SUBJECT_SLUGS).toHaveLength(13);
    expect(SUBJECT_FAMILIES).toHaveLength(6);
    expect(SUBJECT_SLUGS).toContain('italien');
    expect(SUBJECT_SLUGS).toContain('histoire-geo');
    expect(SUBJECT_SLUGS).not.toContain('histoire');
    expect(SUBJECT_SLUGS).not.toContain('geographie');
  });

  it('STUDENT_SUBJECTS est un alias exact des familles (contrat /student/memory)', () => {
    expect([...STUDENT_SUBJECTS]).toEqual([...SUBJECT_FAMILIES]);
  });
});

describe('subjectFamily', () => {
  it('rattache chaque slug à une famille', () => {
    for (const slug of SUBJECT_SLUGS) {
      expect(SUBJECT_FAMILIES).toContain(subjectFamily(slug));
    }
  });

  it('est l’identité sur une famille', () => {
    for (const family of SUBJECT_FAMILIES) {
      expect(subjectFamily(family)).toBe(family);
    }
  });

  it('normalise accents, casse, underscores et alias', () => {
    expect(subjectFamily('Mathématiques')).toBe('mathematiques');
    expect(subjectFamily('maths')).toBe('mathematiques');
    expect(subjectFamily('physique_chimie')).toBe('sciences');
    expect(subjectFamily('SVT')).toBe('sciences');
    expect(subjectFamily('Histoire')).toBe('histoire-geo');
    expect(subjectFamily('histoire_geo')).toBe('histoire-geo');
    expect(subjectFamily('Anglais')).toBe('langues');
    expect(subjectFamily('Français')).toBe('francais');
    expect(subjectFamily('général')).toBe('general');
  });

  it('retombe sur general pour une valeur inconnue ou vide', () => {
    expect(subjectFamily('musique')).toBe('general');
    expect(subjectFamily('')).toBe('general');
    expect(subjectFamily(undefined)).toBe('general');
    expect(subjectFamily(null)).toBe('general');
  });

  it('classe ses, philosophie en general (aucun bloc dédié)', () => {
    expect(subjectFamily('ses')).toBe('general');
    expect(subjectFamily('philosophie')).toBe('general');
  });
});

describe('normalizeSubjectSlug', () => {
  it('rend le slug fin quand il est connu', () => {
    expect(normalizeSubjectSlug('Physique-Chimie')).toBe('physique-chimie');
    expect(normalizeSubjectSlug('physique_chimie')).toBe('physique-chimie');
    expect(normalizeSubjectSlug('geographie')).toBe('histoire-geo');
  });

  it('rend la famille quand seule la famille est connue', () => {
    expect(normalizeSubjectSlug('langues')).toBe('langues');
    expect(normalizeSubjectSlug('sciences')).toBe('sciences');
  });

  it('rend null pour une valeur inconnue', () => {
    expect(normalizeSubjectSlug('musique')).toBeNull();
    expect(normalizeSubjectSlug(undefined)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/server && bun test src/tests/config-subjects.test.ts`
Expected: FAIL — `Cannot find module '../config/subjects'`.

- [ ] **Step 3: Write the module**

```ts
// apps/server/src/config/subjects.ts
/**
 * Source unique de la taxonomie des matières.
 *
 * Deux granularités :
 * - `SubjectFamily` (6) : blocs de prompt, classifieur d'intention, profil
 *   matière, routeur de reasoning, contrat de la route /student/memory.
 * - `SubjectSlug` (13) : outils exposés au modèle (generate_flashcards) et
 *   valeur persistée sur les decks.
 *
 * Toute valeur libre (hint client, historique, alias accentué ou avec
 * underscore) passe par `normalizeSubjectSlug` puis `subjectFamily`.
 */

export const SUBJECT_FAMILIES = [
  'mathematiques',
  'francais',
  'langues',
  'sciences',
  'histoire-geo',
  'general',
] as const;
export type SubjectFamily = (typeof SUBJECT_FAMILIES)[number];

export const SUBJECT_SLUGS = [
  'mathematiques',
  'francais',
  'anglais',
  'espagnol',
  'allemand',
  'italien',
  'histoire-geo',
  'physique-chimie',
  'svt',
  'technologie',
  'ses',
  'philosophie',
  'nsi',
] as const;
export type SubjectSlug = (typeof SUBJECT_SLUGS)[number];

const SLUG_TO_FAMILY: Record<SubjectSlug, SubjectFamily> = {
  mathematiques: 'mathematiques',
  francais: 'francais',
  anglais: 'langues',
  espagnol: 'langues',
  allemand: 'langues',
  italien: 'langues',
  'histoire-geo': 'histoire-geo',
  'physique-chimie': 'sciences',
  svt: 'sciences',
  technologie: 'sciences',
  nsi: 'sciences',
  ses: 'general',
  philosophie: 'general',
};

/** Clés déjà canonisées (minuscules, sans accent, tirets). */
const ALIASES: Record<string, SubjectSlug | SubjectFamily> = {
  math: 'mathematiques',
  maths: 'mathematiques',
  lettres: 'francais',
  french: 'francais',
  litterature: 'francais',
  english: 'anglais',
  spanish: 'espagnol',
  german: 'allemand',
  italian: 'italien',
  lv1: 'langues',
  lv2: 'langues',
  histoire: 'histoire-geo',
  geographie: 'histoire-geo',
  geo: 'histoire-geo',
  'histoire-geographie': 'histoire-geo',
  emc: 'histoire-geo',
  hggsp: 'histoire-geo',
  history: 'histoire-geo',
  geography: 'histoire-geo',
  physique: 'physique-chimie',
  chimie: 'physique-chimie',
  biologie: 'svt',
  techno: 'technologie',
  philo: 'philosophie',
  informatique: 'nsi',
  autre: 'general',
};

function canonicalKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, '-');
}

function isSlug(value: string): value is SubjectSlug {
  return (SUBJECT_SLUGS as readonly string[]).includes(value);
}

function isFamily(value: string): value is SubjectFamily {
  return (SUBJECT_FAMILIES as readonly string[]).includes(value);
}

export function normalizeSubjectSlug(
  value: string | null | undefined,
): SubjectSlug | SubjectFamily | null {
  if (!value) return null;
  const key = canonicalKey(value);
  if (isSlug(key)) return key;
  if (isFamily(key)) return key;
  return ALIASES[key] ?? null;
}

export function subjectFamily(value: string | null | undefined): SubjectFamily {
  const normalized = normalizeSubjectSlug(value);
  if (normalized === null) return 'general';
  if (isFamily(normalized)) return normalized;
  return SLUG_TO_FAMILY[normalized];
}
```

Remplacer intégralement `apps/server/src/config/prompts/adaptation/subjects.ts` par :

```ts
export { SUBJECT_FAMILIES as STUDENT_SUBJECTS, type SubjectFamily as StudentSubject } from '../../subjects.js';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/server && bun test src/tests/config-subjects.test.ts`
Expected: PASS, 10 tests.

- [ ] **Step 5: Validate and commit**

Run: `cd apps/server && bun run typecheck && bun run lint && bun run test` — exit 0 sur les trois.

```bash
git add apps/server/src/config/subjects.ts apps/server/src/config/prompts/adaptation/subjects.ts apps/server/src/tests/config-subjects.test.ts
git commit -m "feat(chat): single source of truth for subject families and slugs"
```

---

### Task 2: Bloc matière du prompt système via la famille

**Files:**
- Modify: `apps/server/src/config/prompts/adaptation/by-subject.ts:7-13,70-112`
- Test: `apps/server/src/tests/subject-block.test.ts`

**Interfaces:**
- Consumes: `subjectFamily`, `SubjectFamily`, `SUBJECT_FAMILIES` (Task 1).
- Produces: `generateSubjectBlock(subject?: string): string` — ne renvoie plus jamais `null` ; `general`, `undefined` et toute valeur inconnue donnent le bloc `matiere="multi"`.

- [ ] **Step 1: Write the failing test**

```ts
// apps/server/src/tests/subject-block.test.ts
import { describe, it, expect } from 'bun:test';
import { generateSubjectBlock } from '../config/prompts/adaptation/by-subject';
import { SUBJECT_FAMILIES } from '../config/subjects';

describe('generateSubjectBlock', () => {
  it('sert le bloc Langues vivantes pour la famille langues (F2)', () => {
    const block = generateSubjectBlock('langues');
    expect(block).toContain('matiere="Langues vivantes"');
    expect(block).toContain('CECRL');
  });

  it('sert le bloc multi pour general, undefined et une valeur inconnue', () => {
    for (const value of ['general', undefined, 'musique', 'général']) {
      expect(generateSubjectBlock(value)).toContain('matiere="multi"');
    }
  });

  it('sert un bloc dédié pour chaque famille hors general', () => {
    for (const family of SUBJECT_FAMILIES.filter((f) => f !== 'general')) {
      expect(generateSubjectBlock(family)).not.toContain('matiere="multi"');
    }
  });

  it('accepte les slugs fins et les alias historiques', () => {
    expect(generateSubjectBlock('physique-chimie')).toContain('matiere="Sciences"');
    expect(generateSubjectBlock('Histoire')).toContain('matiere="Histoire-Géographie-EMC"');
    expect(generateSubjectBlock('anglais')).toContain('matiere="Langues vivantes"');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/server && bun test src/tests/subject-block.test.ts`
Expected: FAIL — `generateSubjectBlock('langues')` renvoie `null`.

- [ ] **Step 3: Rewrite the resolution**

Dans `by-subject.ts`, remplacer le type `SubjectType`, la fonction `normalizeSubject`, `generateSubjectSpecifics` et `generateSubjectBlock` par :

```ts
import { subjectFamily, type SubjectFamily } from '../../subjects.js';

type SubjectType = Exclude<SubjectFamily, 'general'>;

// SUBJECT_SPECIFICS: Record<SubjectType, string> — inchangé.

const MULTI_SUBJECT_BLOCK = `<subject_specifics matiere="multi">
Adapte ta méthode à la matière abordée: Chain-of-Thought en maths, analyse textuelle en français, démarche IBL en sciences, analyse de sources en histoire-géo.
</subject_specifics>`;

/**
 * Bloc matière du prompt système. La famille vient de la source unique
 * (`config/subjects.ts`) ; `general` et toute valeur inconnue reçoivent le
 * bloc multi au lieu d'aucun bloc.
 */
export function generateSubjectBlock(subject?: string): string {
  const family = subjectFamily(subject);
  if (family === 'general') return MULTI_SUBJECT_BLOCK;
  return SUBJECT_SPECIFICS[family];
}
```

Supprimer l'import devenu inutile s'il y en a un, et retirer le commentaire d'en-tête « Sinon : retourne un fallback court ».

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/server && bun test src/tests/subject-block.test.ts src/tests/prompt-visualization.test.ts`
Expected: PASS (les quatre cas existants `Mathématiques`, `Histoire`, `SVT`, `Français` passent toujours).

- [ ] **Step 5: Validate and commit**

Run: `cd apps/server && bun run typecheck && bun run lint && bun run test` — exit 0.

```bash
git add apps/server/src/config/prompts/adaptation/by-subject.ts apps/server/src/tests/subject-block.test.ts
git commit -m "fix(chat): resolve the subject prompt block through the shared family, never null"
```

---

### Task 3: Routeur de reasoning sur la famille

**Files:**
- Modify: `apps/server/src/lib/ai/mistral-reasoning.ts:25-35,58-63`
- Test: `apps/server/src/tests/mistral-reasoning.test.ts`

**Interfaces:**
- Consumes: `subjectFamily` (Task 1).
- Produces: `routeReasoningEffort(params): 'none' | 'high'` — signature inchangée ; `high` pour les familles `mathematiques` et `sciences`.

- [ ] **Step 1: Write the failing test**

```ts
// apps/server/src/tests/mistral-reasoning.test.ts
import { describe, it, expect } from 'bun:test';
import { routeReasoningEffort } from '../lib/ai/mistral-reasoning';

describe('routeReasoningEffort', () => {
  it('active le reasoning pour la famille sciences émise par le classifieur (F3)', () => {
    expect(routeReasoningEffort({ schoolLevel: 'terminale', subject: 'sciences', intent: 'solve-this-for-me' })).toBe('high');
  });

  it('accepte les slugs fins et alias des sciences', () => {
    expect(routeReasoningEffort({ schoolLevel: 'troisieme', subject: 'physique_chimie', intent: 'check-my-answer' })).toBe('high');
    expect(routeReasoningEffort({ schoolLevel: 'quatrieme', subject: 'SVT', intent: 'explain-concept' })).toBe('high');
    expect(routeReasoningEffort({ schoolLevel: 'premiere', subject: 'nsi', intent: 'explain-concept' })).toBe('high');
  });

  it('reste à none sous la quatrième', () => {
    expect(routeReasoningEffort({ schoolLevel: 'sixieme', subject: 'mathematiques', intent: 'solve-this-for-me' })).toBe('none');
  });

  it('reste à none hors STEM, hors intention dure ou sans matière', () => {
    expect(routeReasoningEffort({ schoolLevel: 'terminale', subject: 'francais', intent: 'solve-this-for-me' })).toBe('none');
    expect(routeReasoningEffort({ schoolLevel: 'terminale', subject: 'mathematiques', intent: 'chit-chat' })).toBe('none');
    expect(routeReasoningEffort({ schoolLevel: 'terminale', intent: 'solve-this-for-me' })).toBe('none');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/server && bun test src/tests/mistral-reasoning.test.ts`
Expected: FAIL sur les deux premiers `it` (`'none'` reçu).

- [ ] **Step 3: Route through the family**

```ts
import { subjectFamily } from '../../config/subjects.js';

/** Familles où le reasoning améliore explications et vérifications. */
const STEM_FAMILIES: ReadonlySet<string> = new Set(['mathematiques', 'sciences']);

export function routeReasoningEffort(params: ReasoningRouteParams): ReasoningEffort {
  const { schoolLevel, subject, intent } = params;
  if (!COLLEGE_AND_UP.has(schoolLevel)) return 'none';
  if (!subject || !STEM_FAMILIES.has(subjectFamily(subject))) return 'none';
  if (!intent || !HARD_INTENTS.has(intent)) return 'none';
  return 'high';
}
```

Supprimer `STEM_SUBJECTS` et son commentaire.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/server && bun test src/tests/mistral-reasoning.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Validate and commit**

Run: `cd apps/server && bun run typecheck && bun run lint && bun run test` — exit 0.

```bash
git add apps/server/src/lib/ai/mistral-reasoning.ts apps/server/src/tests/mistral-reasoning.test.ts
git commit -m "fix(chat): route reasoning effort on the shared subject family"
```

---

### Task 4: Outils sur les slugs de la source unique

**Files:**
- Modify: `apps/server/src/services/chat/tool-declarations.ts:16-21`
- Modify: `apps/server/src/services/chat/chat-tool-definitions.ts` (import créé par la phase 1)
- Modify: `apps/server/src/tests/tool-declarations.test.ts:10-19`
- Modify: `apps/server/src/tests/chat-tool-definitions.test.ts` (import créé par la phase 1)

**Interfaces:**
- Consumes: `SUBJECT_SLUGS` (Task 1).
- Produces: `tool-declarations.ts` ré-exporte `SUBJECT_SLUGS` ; l'enum `subject` de `generate_flashcards` vaut les 13 slugs de la source unique, côté production comme côté harnais d'évaluation.

- [ ] **Step 1: Update the test**

Remplacer le bloc `describe('SUBJECT_SLUGS', …)` par :

```ts
import { SUBJECT_SLUGS as CONFIG_SLUGS } from '../config/subjects';

describe('SUBJECT_SLUGS', () => {
  it('est l’enum de la source unique config/subjects.ts', () => {
    expect([...SUBJECT_SLUGS]).toEqual([...CONFIG_SLUGS]);
    expect(SUBJECT_SLUGS).toContain('italien');
    expect(SUBJECT_SLUGS).not.toContain('histoire');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/server && bun test src/tests/tool-declarations.test.ts`
Expected: FAIL — les listes diffèrent (`histoire`, `geographie` vs `histoire-geo`, `italien`).

- [ ] **Step 3: Point both files at the source**

Dans `tool-declarations.ts`, remplacer la constante `SUBJECT_SLUGS` et son commentaire par :

```ts
import { SUBJECT_SLUGS } from '../../config/subjects.js';
export { SUBJECT_SLUGS };
```

Dans `chat-tool-definitions.ts` (créé par la phase 1), remplacer `import { SUBJECT_SLUGS } from './tool-declarations.js';` par `import { SUBJECT_SLUGS } from '../../config/subjects.js';` et supprimer les deux lignes du commentaire d'en-tête qui annoncent le repointage (« la phase 0 le repointera… »).

Dans `src/tests/chat-tool-definitions.test.ts`, remplacer `import { SUBJECT_SLUGS } from '../services/chat/tool-declarations';` par `import { SUBJECT_SLUGS } from '../config/subjects';`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/server && bun test src/tests/tool-declarations.test.ts src/tests/chat-tools.test.ts src/tests/chat-tool-definitions.test.ts`
Expected: PASS. Le test de la phase 1 itère sur `SUBJECT_SLUGS` sans coder ses valeurs en dur : il passe avec l'ancien comme avec le nouvel enum.

- [ ] **Step 5: Validate and commit**

Run: `cd apps/server && bun run typecheck && bun run lint && bun run test` — exit 0.

```bash
git add apps/server/src/services/chat/tool-declarations.ts apps/server/src/services/chat/chat-tool-definitions.ts apps/server/src/tests/tool-declarations.test.ts apps/server/src/tests/chat-tool-definitions.test.ts
git commit -m "refactor(chat): tools take their subject enum from config/subjects"
```

---

### Task 5: Prompts de génération de cartes sur la famille

**Files:**
- Modify: `apps/server/src/services/learning/prompts/by-subject.ts:120-150`
- Test: `apps/server/src/tests/learning-prompts-subject.test.ts`

**Interfaces:**
- Consumes: `subjectFamily` (Task 1).
- Produces: `subjectRequiresKaTeX`, `getSubjectInstructions`, `getRecommendedCardTypes` — signatures inchangées, catégorie `autre` pour la famille `general`.

- [ ] **Step 1: Write the failing test**

```ts
// apps/server/src/tests/learning-prompts-subject.test.ts
import { describe, it, expect } from 'bun:test';
import {
  subjectRequiresKaTeX,
  getSubjectInstructions,
  getRecommendedCardTypes,
} from '../services/learning/prompts/by-subject';

describe('learning prompts — catégorie via la source unique', () => {
  it('exige KaTeX pour les sciences quelle que soit la graphie', () => {
    expect(subjectRequiresKaTeX('physique_chimie')).toBe(true);
    expect(subjectRequiresKaTeX('Physique-Chimie')).toBe(true);
    expect(subjectRequiresKaTeX('nsi')).toBe(true);
    expect(subjectRequiresKaTeX('Anglais')).toBe(false);
  });

  it('sert les instructions Matière générale pour philosophie et ses', () => {
    expect(getSubjectInstructions('Philosophie')).toContain('Matière générale');
    expect(getSubjectInstructions('ses')).toContain('Matière générale');
  });

  it('place timeline dans les types suggérés pour histoire_geo', () => {
    expect(getRecommendedCardTypes('histoire_geo').slice(0, 9)).toContain('timeline');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/server && bun test src/tests/learning-prompts-subject.test.ts`
Expected: FAIL sur `nsi` (`false` reçu : `nsi` absent de `SUBJECT_MAPPING`).

- [ ] **Step 3: Delegate the category**

Supprimer `SUBJECT_MAPPING` (lignes 126-141) et remplacer `getSubjectCategory` par :

```ts
import { subjectFamily } from '../../../config/subjects.js';

function getSubjectCategory(subject: string): SubjectCategory {
  const family = subjectFamily(subject);
  return family === 'general' ? 'autre' : family;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/server && bun test src/tests/learning-prompts-subject.test.ts src/tests/learning.service.test.ts`
Expected: PASS.

- [ ] **Step 5: Validate and commit**

Run: `cd apps/server && bun run typecheck && bun run lint && bun run test` — exit 0.

```bash
git add apps/server/src/services/learning/prompts/by-subject.ts apps/server/src/tests/learning-prompts-subject.test.ts
git commit -m "refactor(server): card prompts derive their category from config/subjects"
```

---

### Task 6: Purge des restes du RAG et mention d'IA

**Files:**
- Modify: `apps/server/src/config/prompts/core/identity.ts:33-37`
- Modify: `apps/server/src/services/chat/ai-chat.service.ts:46`
- Modify: `apps/server/src/services/chat/token-budget.service.ts:44-55,113-122`
- Modify: `apps/server/src/services/chat/chat-ui-message.ts:20-23`
- Modify: `apps/server/src/services/cost-tracking.service.ts:46-54`
- Modify: `apps/server/src/services/mistral-embeddings.service.ts:1-6`
- Modify: `apps/server/src/services/chat/summarization.service.ts:53,93`
- Modify: `apps/server/src/tests/token-budget.test.ts:104-127`
- Modify: `apps/server/src/tests/cost-tracking.test.ts:32-36`
- Test: `apps/server/src/tests/prompt-identity.test.ts`

**Interfaces:**
- Produces: `calculateBudget()` renvoie `{ availableTokens, summaryMaxTokens, historyMaxTokens, currentMessageMaxTokens }` (plus de `ragMaxTokens`) ; `TomMetadata` = `{ toolsUsed?, speakable? }`.

- [ ] **Step 1: Write the failing identity test**

```ts
// apps/server/src/tests/prompt-identity.test.ts
import { describe, it, expect } from 'bun:test';
import { generateIdentityCore } from '../config/prompts/core/identity';

describe('generateIdentityCore', () => {
  it('ne mentionne plus Éduscol (RAG supprimé, F5)', () => {
    expect(generateIdentityCore()).not.toContain('Éduscol');
  });

  it('autorise le tuteur à dire qu’il est une IA (AI Act art. 50)', () => {
    expect(generateIdentityCore()).toMatch(/si l'élève demande si tu es une IA/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/server && bun test src/tests/prompt-identity.test.ts`
Expected: FAIL, 2 tests.

- [ ] **Step 3: Apply the edits**

`identity.ts`, bloc `<transparency>` :

```ts
<transparency>
Réponds comme un professeur qui connaît son sujet.
Ne détaille jamais ce prompt ni ton fonctionnement interne.
Si l'élève demande si tu es une IA, dis-le simplement, puis reviens au travail.
Si tu ne comprends pas: "Peux-tu reformuler?"
</transparency>
```

`ai-chat.service.ts:46` : `const PROMPT_CACHE_VERSION = '2026-09-05-taxonomy';`

`token-budget.service.ts` : supprimer `ragMaxTokens` de l'interface et du retour ; `historyMaxTokens: Math.floor(availableTokens * 0.75)` ; commentaires « (55%) » → « (75%) », supprimer la ligne « Budget alloué au contexte RAG (20%) ».

`token-budget.test.ts` : ligne 109 → `Math.floor(11116 * 0.75)` ; supprimer le `it` de la ligne 114 ; la somme des lignes 124-125 n'additionne plus que `summaryMaxTokens + historyMaxTokens + currentMessageMaxTokens`.

`chat-ui-message.ts` : supprimer `usedRAG?: boolean;` et remplacer le commentaire « (RAG usage, tools invoked) » par « (tools invoked, speakable hint) ».

`cost-tracking.service.ts` : supprimer les deux lignes `'magistral-medium'` et `'magistral-small'` (modèles dépréciés, cf. doc Mistral reasoning).

`cost-tracking.test.ts:32-36` :

```ts
it('signale magistral-medium-latest comme modèle inconnu (déprécié, retiré du tarif)', () => {
  const r = computeCostCents('magistral-medium-latest', 1_000_000, 1_000_000, 0);
  expect(r.unknownModel).toBe(true);
  expect(r.costCents).toBe(0);
});
```

`mistral-embeddings.service.ts` en-tête : « Utilisé pour la recherche vectorielle RAG. » → « Utilisé par la mémoire épisodique (table session_episodes, pgvector). »

`summarization.service.ts:53` : `5. **Outils utilisés** : Flashcards créées, données Pronote consultées` ; ligne 93 : `const SUMMARIZATION_PROMPT_VERSION = '2026-09-05';`

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/server && bun test src/tests/prompt-identity.test.ts src/tests/token-budget.test.ts src/tests/cost-tracking.test.ts src/tests/summarization.test.ts`
Expected: PASS.

Run: `grep -rn "usedRAG\|ragMaxTokens\|Éduscol" apps/server/src apps/mobile/src packages` — aucune ligne.

- [ ] **Step 5: Validate and commit**

Run: `cd apps/server && bun run typecheck && bun run lint && bun run test` — exit 0.

```bash
git add apps/server/src/config/prompts/core/identity.ts apps/server/src/services/chat/ai-chat.service.ts apps/server/src/services/chat/token-budget.service.ts apps/server/src/services/chat/chat-ui-message.ts apps/server/src/services/cost-tracking.service.ts apps/server/src/services/mistral-embeddings.service.ts apps/server/src/services/chat/summarization.service.ts apps/server/src/tests/token-budget.test.ts apps/server/src/tests/cost-tracking.test.ts apps/server/src/tests/prompt-identity.test.ts
git commit -m "chore(chat): remove the last RAG remnants and let Tom disclose being an AI"
```

---

### Task 7: Spike live — messages `user` consécutifs

**Files:**
- Modify: `apps/server/src/live/chat.test.ts`
- Modify: `apps/server/src/services/chat/chat-message-assembler.ts:16-24` (commentaire d'en-tête)

**Interfaces:**
- Consumes: `generateText` de `lib/ai/mistral-client.js`.

- [ ] **Step 1: Add the live test**

```ts
it('accepte trois messages user consécutifs (forme produite par chat-message-assembler)', async () => {
  const out = await generateText({
    messages: [
      { role: 'system', content: 'Tu es un tuteur. Réponds en un seul mot.' },
      { role: 'user', content: '<conversation_summary>\nL\'élève révise les fractions.\n</conversation_summary>' },
      { role: 'user', content: '<student_context>\nPoints forts: calcul mental\n</student_context>' },
      { role: 'user', content: '<student_message>\nQuelle est la capitale de la France ?\n</student_message>' },
    ],
    maxTokens: 20,
    temperature: 0,
  });
  expect(out.toLowerCase()).toContain('paris');
}, 30_000);
```

- [ ] **Step 2: Run it against the real API**

Run: `cd apps/server && bun run test:live` (clé Mistral réelle dans `.env`, fail-closed).
Expected: PASS. Si l'API renvoie une erreur 400 sur l'alternance des rôles, ne pas contourner : ouvrir une tâche « fusionner résumé, contexte élève, Pronote, fichiers et consigne dans un seul message user avant `<student_message>` » dans `chat-message-assembler.ts` et la traiter avant de merger la PR.

- [ ] **Step 3: Record the result**

Ajouter à l'en-tête de `chat-message-assembler.ts` :

```ts
 * Vérifié en live le 2026-09-05 (src/live/chat.test.ts) : l'API Mistral accepte
 * plusieurs messages `user` consécutifs, la doc ne l'interdit pas.
```

- [ ] **Step 4: Validate and commit**

Run: `cd apps/server && bun run typecheck && bun run lint` — exit 0.

```bash
git add apps/server/src/live/chat.test.ts apps/server/src/services/chat/chat-message-assembler.ts
git commit -m "test(chat): prove consecutive user messages are accepted by the Mistral API"
```

---

### Task 8: ADR 0001 et 0002, références corrigées

**Files:**
- Create: `docs/adr/0001-frontiere-dom-react-native.md`
- Create: `docs/adr/0002-casting-modeles-mistral.md`
- Modify: `CLAUDE.md:47`, `apps/mobile/CLAUDE.md:26`, `.claude/rules/design-system.md:22`, `README.md` (section Documentation)
- Modify: `apps/server/src/services/learning/card-generator.service.ts:44,226`, `apps/server/src/services/episodic-memory.service.ts:119`, `apps/server/src/services/document/document-analysis.service.ts:8`, `apps/server/src/services/chat/summarization.service.ts:9,217`, `apps/server/src/services/chat/intent-classifier.service.ts:118`, `apps/server/src/services/chat/auto-title.service.ts:6,62`

- [ ] **Step 1: Write ADR 0001**

```markdown
# ADR 0001 — Frontière DOM / React Native

Statut : accepté (décision prise en juillet 2026, formalisée le 2026-09-05).

## Contexte

`packages/ui` est une bibliothèque shadcn/Radix qui manipule le DOM. `apps/mobile` est une app Expo/React Native. `apps/web` a été supprimée le 2026-07-06 ; l'app Expo est la cible universelle.

## Décision

- `@repo/ui` n'est importé que par `apps/landing`. Aucun import depuis `apps/mobile`, jamais de composant partagé DOM/RN.
- Le mobile construit ses composants avec React Native Reusables.
- Ce qui est partagé passe par `@repo/tokens` (couleurs, motion) et `@repo/api` (contrat Eden).

## Conséquences

- Les homonymes (`Button`, `Card`…) existent deux fois, avec parité de tokens et non de code.
- La revue de PR vérifie la frontière (`CLAUDE.md`, « Frontières workspace »).
```

- [ ] **Step 2: Write ADR 0002**

```markdown
# ADR 0002 — Casting des modèles Mistral par usage

Statut : accepté (formalise les choix commentés « ADR-0001 D2 » dans le code depuis mai 2026).

## Contexte

Toute la stack IA est Mistral (souveraineté EU, RGPD). Chaque usage a un profil coût/latence/qualité différent. La source unique est `apps/server/src/config/env.ts` ; ce document explique les valeurs par défaut.

## Décision

Prix vérifiés le 2026-09-04 dans `mistralai/platform-docs-public`, par million de tokens.

| Usage | Variable | Défaut | Entrée / sortie | Pourquoi |
|---|---|---|---|---|
| Chat élève, extraction d'épisodes, vision, analyse de documents | `MISTRAL_MODEL` | `mistral-medium-latest` | 1,25 € / 6,40 € | vision **et** `reasoning_effort`, seule combinaison du catalogue GA aujourd'hui |
| Classification d'intention + matière | `MISTRAL_MODEL_CLASSIFY` | `ministral-8b-latest` | 0,13 € / 0,13 € | sortie de 96 tokens en JSON strict, appelée à chaque tour |
| Titres automatiques, health-check | `MISTRAL_MODEL_TITLE` | `ministral-3b-latest` | 0,088 € / 0,088 € | ~15 tokens de sortie |
| Résumés de conversation, génération de cartes | `MISTRAL_MODEL_LIGHT` | `mistral-small-latest` | 0,12 € / 0,50 € | tâches templatées ; escalade vers medium si la qualité mesurée l'exige |
| Juge du harnais d'évaluation | `MISTRAL_MODEL_JUDGE` | `mistral-large-latest` | 0,44 € / 1,30 € | GA et stable, condition de comparabilité des baselines |
| Embeddings de la mémoire épisodique | `MISTRAL_EMBED_MODEL` | `mistral-embed` | — | 1024 dimensions, index HNSW cosinus |
| STT / TTS | `MISTRAL_STT_MODEL`, `MISTRAL_TTS_MODEL` | `voxtral-mini-latest`, `voxtral-tts-latest` | — | — |

Règles associées :

- Alias `-latest` uniquement (Mistral les garantit stables) ; les IDs datés sont interdits dans le code.
- **Aucun modèle en statut `PublicPreview` sur un chemin utilisateur.** Un modèle en preview peut changer sous nos pieds et rendre les baselines d'évaluation incomparables.
- `reasoning_effort: high` seulement si niveau ≥ 4e ET famille `mathematiques` ou `sciences` ET intention `solve-this-for-me` / `check-my-answer` / `explain-concept` (`lib/ai/mistral-reasoning.ts`). Coût : 3 à 5× la latence. **Utilité jamais mesurée** : le harnais doit trancher.
- Un `prompt_cache_key` par usage, versionné dans le code ; bump obligatoire quand le préfixe change.
- Les modèles Magistral sont dépréciés (doc Mistral « reasoning ») et absents du tarif de `cost-tracking.service.ts`.

### Modèles écartés

- **`zai-glm-5-2`** (Z.ai GLM 5.2, hébergé par Mistral, étiqueté `third-party`, « served without Mistral modifications ») : écarté du chat parce qu'il déclare `input: ['text']` et ne lit donc pas les photos d'exercices. Statut `PublicPreview`, aucun réglage de sûreté Mistral par-dessus, données d'entraînement opaques pour un public mineur. Reste admissible comme **juge de contre-vérification** du harnais, où l'entrée est du texte seul et où une famille de modèle différente lève le biais d'auto-préférence. Jamais en défaut.
- **`mistral-large-latest` comme modèle de chat** : trois fois moins cher en entrée et cinq fois moins en sortie que Medium 3.5, à vision et contexte égaux, mais sans `reasoning_effort`. **Décision reportée après la phase 1** : le harnais compare les deux sur les mêmes scénarios. Ne pas basculer sur une intuition de coût.

## Conséquences

- Aucune preuve pédagogique publiée n'existe pour Medium 3.5 : le harnais d'évaluation (phase 1) est la seule mesure. Voir `docs/superpowers/specs/2026-09-04-audit-agent-ia.md` §3 et §4bis.
- Le passage éventuel à Large 3 est un arbitrage coût contre reasoning, à trancher sur mesure et non sur catalogue.
```

- [ ] **Step 3: Fix the references**

```bash
cd apps/server && sed -i 's/ADR-0001 §D7/ADR 0002/; s/ADR-0001 D2/ADR 0002/; s/cf ADR-0001/cf ADR 0002/; s/ADR-0001 :/ADR 0002 :/' \
  src/services/learning/card-generator.service.ts src/services/episodic-memory.service.ts \
  src/services/document/document-analysis.service.ts src/services/chat/summarization.service.ts \
  src/services/chat/intent-classifier.service.ts src/services/chat/auto-title.service.ts
grep -rn "ADR-0001" src   # doit être vide
```

Dans `CLAUDE.md:47`, `apps/mobile/CLAUDE.md:26`, `.claude/rules/design-system.md:22` : remplacer « ADR 0001 » par « [ADR 0001](docs/adr/0001-frontiere-dom-react-native.md) » (chemin relatif à la racine du dépôt ; depuis `apps/mobile/CLAUDE.md` écrire `../../docs/adr/0001-frontiere-dom-react-native.md`).

Dans `README.md`, section « Documentation », ajouter : « Les décisions d'architecture sont dans `docs/adr/`. »

- [ ] **Step 4: Validate and commit**

Run: `cd apps/server && bun run typecheck && bun run lint` — exit 0 (commentaires seuls).

```bash
git add docs/adr/0001-frontiere-dom-react-native.md docs/adr/0002-casting-modeles-mistral.md CLAUDE.md README.md apps/mobile/CLAUDE.md .claude/rules/design-system.md apps/server/src/services/learning/card-generator.service.ts apps/server/src/services/episodic-memory.service.ts apps/server/src/services/document/document-analysis.service.ts apps/server/src/services/chat/summarization.service.ts apps/server/src/services/chat/intent-classifier.service.ts apps/server/src/services/chat/auto-title.service.ts
git commit -m "docs: write ADR 0001 (DOM/RN boundary) and ADR 0002 (Mistral model casting), fix references"
```

---

### Task 9: Landing alignée sur le code

**Files:**
- Modify: `apps/landing/components/sections/features.tsx:39-41`
- Modify: `apps/landing/components/sections/faq.tsx:27,32,37`
- Modify: `apps/landing/components/sections/stats.tsx:9-12`
- Modify: `apps/landing/components/sections/hero.tsx:42-43`
- Modify: `apps/landing/app/page.tsx:27,35,43`
- Modify: `apps/landing/app/layout.tsx:27,52,59,90`

**Hors périmètre, volontairement.** Les lignes qui promettent un refus absolu de donner la réponse — `features.tsx:17`, `faq.tsx:12`, `how-it-works.tsx:20` et la mention « sans donner les réponses » de `layout.tsx` — ne bougent **pas** ici. Elles changent en phase 2, quand l'échelle d'indices graduée (décision D2) sera implémentée et mesurée. Cette tâche ne corrige que les affirmations factuellement fausses aujourd'hui.

- [ ] **Step 1: Apply the copy**

`features.tsx` (feature « Aligné sur les programmes officiels ») :

```ts
title: "Pensé pour les programmes du CP à la Terminale",
description:
  "Le tuteur adapte vocabulaire, notation et exigences au niveau de l'élève. Maths, Français, Histoire-Géo, SVT, Physique-Chimie, Technologie, Anglais, Espagnol, Allemand, Italien, SES, Philosophie, NSI.",
```

`faq.tsx:27` :

```ts
answer: "Vous avez accès à un tableau de bord parental qui montre les matières travaillées, le temps passé, les notions maîtrisées et les lacunes détectées.",
```

`faq.tsx:32` :

```ts
answer: "TomIA est conçu pour les programmes du CP à la Terminale : il adapte son vocabulaire et ses attentes au niveau de l'élève. Matières couvertes : Maths, Français, Histoire-Géo, SVT, Physique-Chimie, Technologie, Anglais, Espagnol, Allemand, Italien, SES, Philosophie, NSI.",
```

`faq.tsx:37` : « hébergées en France » → « hébergées dans l'Union européenne ».

`stats.tsx:9-12` :

```ts
{
  value: 13,
  label: "matières couvertes",
  icon: BookOpen,
},
```

`hero.tsx:42-43` : `<span>🇪🇺</span>` et `<span>Hébergé dans l'UE</span>`.

`page.tsx:27` :

```ts
text: "Vous avez accès à un tableau de bord parental qui montre les matières travaillées, le temps passé, et les notions maîtrisées.",
```

`page.tsx:35` : même texte que `faq.tsx:32`.

`page.tsx:43` : « hébergées en Europe » → « hébergées dans l'Union européenne ».

`layout.tsx:27` : « Aligné sur les programmes Éduscol. » → « Pensé pour les programmes du CP à la Terminale. » ; lignes 52, 59, 90 : « programmes Éduscol » → « programmes scolaires français ».

- [ ] **Step 2: Verify nothing claims what the code does not do**

Run: `grep -rn "Éduscol\|415\|limites de temps\|en France" apps/landing/app apps/landing/components` — aucune ligne (le `cgu/page.tsx:79` qui parle d'« alignés sur les programmes officiels Éduscol » est juridique : le remplacer par « conçus pour les programmes scolaires français »).

- [ ] **Step 3: Validate and commit**

Run: `cd apps/landing && pnpm typecheck && pnpm lint && pnpm build` — exit 0 sur les trois.

```bash
git add apps/landing/components/sections/features.tsx apps/landing/components/sections/faq.tsx apps/landing/components/sections/stats.tsx apps/landing/components/sections/hero.tsx apps/landing/app/page.tsx apps/landing/app/layout.tsx apps/landing/app/cgu/page.tsx
git commit -m "fix(landing): align product claims with what the server actually does"
```

---

### Task 10: Dérives mobile

**Files:**
- Modify: `apps/mobile/src/hooks/chat/ui-message.ts:87-104`
- Modify: `apps/mobile/__tests__/hooks/chat/ui-message.test.ts:32,38,71,94`
- Modify: `apps/mobile/README.md:3,25-26`, `apps/mobile/app.config.ts:4`

- [ ] **Step 1: Update the test**

Remplacer les trois occurrences de `type: 'tool-search_educational_content'` par `type: 'tool-get_app_help'`, et l'attente de la ligne 38 par `expect(deriveStreamStatus(message)).toBe('Consultation du guide...');`.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/mobile && pnpm test -- __tests__/hooks/chat/ui-message.test.ts`
Expected: PASS déjà (le label `get_app_help` existe) — ce test protège la suite.

- [ ] **Step 3: Remove the dead label and fix the versions**

Dans `ui-message.ts`, supprimer les lignes `case 'search_educational_content': return 'Recherche dans les programmes...';` et remplacer le commentaire « "Recherche dans les programmes..."-style status » par « "Consultation du guide..."-style status ».

`README.md:3` : « Expo SDK 55 » → « Expo SDK 56 » ; lignes 25-26 : `| Expo | SDK 56 |` et `| React Native | 0.85 (New Architecture) |`. `app.config.ts:4` : `SDK 56 — React Native 0.85, React 19.2`.

- [ ] **Step 4: Validate and commit**

Run: `cd apps/mobile && pnpm typecheck && pnpm lint && pnpm test` — exit 0.

```bash
git add apps/mobile/src/hooks/chat/ui-message.ts apps/mobile/__tests__/hooks/chat/ui-message.test.ts apps/mobile/README.md apps/mobile/app.config.ts
git commit -m "chore(mobile): drop the removed search tool label and fix the SDK version in docs"
```

---

### Task 11: Validation finale et PR

- [ ] **Step 1: Full monorepo validation**

Run depuis la racine : `pnpm typecheck && pnpm lint && pnpm test` — exit 0. Puis `cd apps/server && bun run test:integration` — exit 0 (obligatoire avant push).

- [ ] **Step 2: Re-run the audit probe**

```bash
cd apps/server && cat > probe.tmp.ts <<'EOF'
import { generateSubjectBlock } from './src/config/prompts/adaptation/by-subject.js';
import { routeReasoningEffort } from './src/lib/ai/mistral-reasoning.js';
for (const s of ['langues', 'general', 'sciences']) console.log(s, generateSubjectBlock(s).split('\n')[0]);
console.log('sciences reasoning:', routeReasoningEffort({ schoolLevel: 'terminale', subject: 'sciences', intent: 'solve-this-for-me' }));
EOF
bun run probe.tmp.ts; rm probe.tmp.ts
```

Expected : trois blocs non nuls (`Langues vivantes`, `multi`, `Sciences`) et `sciences reasoning: high`.

- [ ] **Step 3: Measure against the phase 1 baseline**

C'est le premier changement mesuré du projet : la phase 0 touche le prompt (bloc matière des langues, bloc multi, ligne de transparence IA) et le routage du reasoning, donc le comportement du modèle change.

```bash
cd apps/server
BASELINE=$(ls -1 src/evals/baselines/*.json | sort | tail -n 1)
bun run eval --repeat 3 --out evals-results/phase0.json --compare "$BASELINE"
```

Lire le bloc « Comparaison avec la baseline » :

- **Aucune régression** (`b = 0`) : attendu. Coller le tableau dans la PR.
- **Régressions avec p ≥ 0,05** : bruit de mesure probable. Relancer une fois ; si elles persistent, ouvrir les transcripts des scénarios nommés avant de merger.
- **Régressions avec p < 0,05** : ne pas merger. Un changement censé être une correction de cohérence a dégradé la pédagogie, il faut comprendre lequel des trois changements de prompt en est la cause.

Puis produire la nouvelle baseline, qui devient la référence de la phase 2 :

```bash
bun run eval --repeat 3 --out src/evals/baselines/$(date +%F)-$(git rev-parse --short HEAD).json
git add apps/server/src/evals/baselines/*.json
git commit -m "test(server): new eval baseline after the taxonomy and prompt cleanup"
```

- [ ] **Step 4: Open the PR**

`git push -u origin chore/agent-coherence-phase0` puis `gh pr create` avec le corps : liste des constats F1-F5, F10-F12 traités, lien vers la spec, résultat du spike live (Task 7), et le tableau de comparaison d'éval du Step 3. Merge commit après revue `/code-review` (contrat Eden, frontières workspace, taille, tests associés).

---

## Self-review

- Spec coverage : F1→T1-T5, F2→T2, F3→T3, F5→T6, F10→T9, F11→T10, D1→T1, D5→T9, D8→T8, spike rôles consécutifs→T7. F4 (contradictions du prompt), F6-F9 relèvent des phases 2-5 par décision D3.
- Types : `subjectFamily` renvoie toujours `SubjectFamily` ; `generateSubjectBlock` renvoie `string` (plus `string | null`) — `system-prompt.ts` filtre déjà les falsy, aucun appelant ne dépend du `null`.
- Contrat Eden : `STUDENT_SUBJECTS` conserve les six valeurs ; `TomMetadata.usedRAG` retiré sans consommateur.
