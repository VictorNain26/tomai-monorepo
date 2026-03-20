# Design System Refonte Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix WCAG contrast, add semantic CSS tokens, reading variant, Lucide subject icons, and standardize inline styles across the mobile app.

**Architecture:** 5 incremental chantiers applied sequentially. Each chantier produces a working, testable state. Chantiers 1+2 are merged (same files). Subject icons (chantier 4) is the largest change.

**Tech Stack:** NativeWind v5, Tailwind CSS v4, CVA, lucide-react-native, jest-expo

**Spec:** `docs/superpowers/specs/2026-03-20-design-system-refonte-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `src/global.css` | Modify | Add semantic color tokens to `@theme` |
| `src/hooks/useThemeColors.ts` | Modify | Fix muted contrast (stone-500 -> stone-600) |
| `src/lib/styles.ts` | Modify | Fix muted rgba values |
| `src/components/ui/text.tsx` | Modify | Add `reading` variant, migrate `text-stone-500` to `text-muted` |
| `src/constants/subjects.ts` | Modify | Replace emoji with Lucide icon names, update colors, add `getSubjectStyles()` |
| `src/components/common/SubjectIcon.tsx` | Create | Renders Lucide icon for a subject with theme-aware color |
| `src/components/learning/DeckCard.tsx` | Modify | Remove `SUBJECT_EMOJIS`, use `SubjectIcon` |
| `src/app/(student)/(home)/index.tsx` | Modify | Remove `getSubjectEmoji()`, use `enrichSubjectKey()` |
| `src/app/(student)/(chat)/index.tsx` | Modify | Remove `getSubjectEmoji()`, use `SubjectIcon` |
| `src/app/(student)/(chat)/chat.tsx` | Modify | Remove `getSubjectEmoji()`, use `enrichSubjectKey()` |
| `src/app/(student)/_layout.tsx` | Modify | Replace inline styles with NativeWind classes |
| `src/app/(parent)/_layout.tsx` | Modify | Replace inline styles with NativeWind classes |
| `__tests__/constants/subjects.test.ts` | Modify | Update for new type (icon instead of emoji, new colors) |
| 19 files with `text-stone-500` | Modify | Replace with `text-stone-600` or semantic class |

---

### Task 1: Fix muted contrast + semantic CSS tokens (Chantiers 1+2)

**Files:**
- Modify: `src/global.css:14-35`
- Modify: `src/hooks/useThemeColors.ts:34`
- Modify: `src/lib/styles.ts:72-73,104-105`

- [ ] **Step 1: Update `global.css` — add semantic color tokens**

```css
@theme {
  /* Fonts */
  --font-sans: 'NunitoSans';
  --font-heading: 'Poppins';
  --font-mono: 'JetBrainsMono';

  /* Semantic Colors */
  --color-primary: #3B82F6;
  --color-primary-foreground: #FFFFFF;
  --color-success: #059669;
  --color-success-foreground: #FFFFFF;
  --color-warning: #D97706;
  --color-warning-foreground: #FFFFFF;
  --color-destructive: #DC2626;
  --color-destructive-foreground: #FFFFFF;
  --color-info: #0EA5E9;
  --color-info-foreground: #FFFFFF;
  --color-foreground: #1C1917;
  --color-muted: #57534E;
  --color-background: #FAFAF9;
  --color-border: #E7E5E4;
  --color-card: #FFFFFF;

  /* Border Radius */
  --radius-2xl: 16px;
  --radius-xl: 14px;
  --radius-lg: 12px;
  --radius-md: 10px;
  --radius-sm: 8px;
  --radius-xs: 6px;

  /* Spacing additions */
  --spacing-18: 4.5rem;
  --spacing-22: 5.5rem;

  /* Font sizes */
  --text-2xs: 0.625rem;
  --text-2xs--line-height: 0.875rem;
}
```

- [ ] **Step 2: Fix `useThemeColors.ts` — muted contrast**

Change line 34:
```tsx
// Before
muted: '#78716C',
// After
muted: '#57534E',
```

- [ ] **Step 3: Fix `styles.ts` — muted rgba values**

```tsx
// bgColors.muted — change rgba(120, 113, 108, ...) to rgba(87, 83, 78, ...)
muted: {
  30: 'rgba(87, 83, 78, 0.3)',
  50: 'rgba(87, 83, 78, 0.5)',
},

// borderColors.muted — same
muted: {
  20: 'rgba(87, 83, 78, 0.2)',
  30: 'rgba(87, 83, 78, 0.3)',
},
```

- [ ] **Step 4: Migrate `text-stone-500` to `text-stone-600` across 19 files**

Replace all `text-stone-500` with `text-stone-600` in:
- `src/components/ui/text.tsx` (line 42-43: muted and tiny variants)
- `src/components/ui/avatar.tsx`
- `src/app/(auth)/login.tsx`
- `src/components/subscription/Paywall.tsx`
- `src/components/pronote/HomeworkView.tsx`
- `src/components/pronote/GradesView.tsx`
- `src/components/parent/DeleteChildModal.tsx`
- `src/components/dashboard/HomeworkUrgentCard.tsx`
- `src/components/dashboard/GradesRecentCard.tsx`
- `src/components/common/MermaidDiagram.tsx`
- `src/components/chat/FileLibraryPicker.tsx`
- `src/components/chat/ChatMessage.tsx`
- `src/components/chat/ChatInput.tsx`
- `src/components/chat/AttachmentPreview.tsx`
- `src/app/(student)/(profile)/index.tsx`
- `src/app/(student)/(profile)/files.tsx`
- `src/app/(parent)/(profile)/pricing.tsx`
- `src/app/(parent)/(profile)/index.tsx`
- `src/app/(parent)/(home)/add-child.tsx`

**Important:** Only replace `text-stone-500`, NOT `dark:text-stone-400` (dark mode contrast is already fine).

- [ ] **Step 5: Run typecheck and lint**

Run: `cd apps/mobile && pnpm typecheck && pnpm lint`
Expected: PASS, zero errors

- [ ] **Step 6: Commit**

```bash
git add src/global.css src/hooks/useThemeColors.ts src/lib/styles.ts src/components/ui/text.tsx src/components/ui/avatar.tsx src/app/\(auth\)/login.tsx src/components/subscription/Paywall.tsx src/components/pronote/HomeworkView.tsx src/components/pronote/GradesView.tsx src/components/parent/DeleteChildModal.tsx src/components/dashboard/HomeworkUrgentCard.tsx src/components/dashboard/GradesRecentCard.tsx src/components/common/MermaidDiagram.tsx src/components/chat/FileLibraryPicker.tsx src/components/chat/ChatMessage.tsx src/components/chat/ChatInput.tsx src/components/chat/AttachmentPreview.tsx src/app/\(student\)/\(profile\)/index.tsx src/app/\(student\)/\(profile\)/files.tsx src/app/\(parent\)/\(profile\)/pricing.tsx src/app/\(parent\)/\(profile\)/index.tsx src/app/\(parent\)/\(home\)/add-child.tsx
git commit -m "fix(mobile): WCAG AA muted contrast + semantic CSS tokens

Fix stone-500 to stone-600 (5.3:1 ratio) for muted text.
Add semantic color tokens to global.css @theme."
```

---

### Task 2: Add `reading` text variant (Chantier 3)

**Files:**
- Modify: `src/components/ui/text.tsx:42`

- [ ] **Step 1: Add `reading` variant to textVariants**

In the `variant` object inside `textVariants` cva (after the `muted` line):

```tsx
reading: 'text-lg font-sans leading-relaxed',
```

This sits between `tiny` and `error` in the variants list.

- [ ] **Step 2: Run typecheck**

Run: `cd apps/mobile && pnpm typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/text.tsx
git commit -m "feat(mobile): add reading text variant for educational content

18px font with relaxed line-height (1.625) for improved readability
in flashcards, chat explanations, and course content."
```

---

### Task 3: Update subject metadata — types, icons, colors (Chantier 4a)

**Files:**
- Modify: `src/constants/subjects.ts`
- Create: `src/components/common/SubjectIcon.tsx`
- Modify: `__tests__/constants/subjects.test.ts`

- [ ] **Step 1: Update tests for new type**

Replace `__tests__/constants/subjects.test.ts`:

```tsx
/**
 * Subject Metadata Tests
 *
 * Tests for enrichSubjectKey, getSubjectStyles, and subject constants.
 */

import {
  enrichSubjectKey,
  getSubjectStyles,
  SUBJECT_METADATA,
  type SubjectColor,
} from '../../src/constants/subjects';

describe('enrichSubjectKey', () => {
  describe('direct key lookup', () => {
    it('should return metadata for exact key match', () => {
      const result = enrichSubjectKey('mathematiques');
      expect(result.name).toBe('Mathematiques');
      expect(result.icon).toBe('Calculator');
      expect(result.color).toBe('blue');
    });

    it('should return metadata for all known subjects', () => {
      const knownSubjects = Object.keys(SUBJECT_METADATA);
      for (const subject of knownSubjects) {
        const result = enrichSubjectKey(subject);
        expect(result.name).toBeTruthy();
        expect(result.icon).toBeTruthy();
        expect(result.color).toBeTruthy();
      }
    });
  });

  describe('normalized key lookup (tirets to underscores)', () => {
    it('should normalize histoire-geo to histoire_geo', () => {
      const result = enrichSubjectKey('histoire-geo');
      expect(result.name).toBe('Histoire-Geographie');
    });

    it('should normalize physique-chimie to physique_chimie', () => {
      const result = enrichSubjectKey('physique-chimie');
      expect(result.name).toBe('Physique-Chimie');
    });

    it('should handle uppercase keys', () => {
      const result = enrichSubjectKey('MATHEMATIQUES');
      expect(result.name).toBe('Mathematiques');
    });
  });

  describe('alias resolution', () => {
    it('should resolve maths alias to mathematiques', () => {
      const result = enrichSubjectKey('maths');
      expect(result.name).toBe('Mathematiques');
    });

    it('should resolve sciences alias to svt', () => {
      const result = enrichSubjectKey('sciences');
      expect(result.name).toBe('SVT');
    });

    it('should resolve lv1 alias to anglais', () => {
      const result = enrichSubjectKey('lv1');
      expect(result.name).toBe('Anglais');
    });

    it('should resolve techno alias to technologie', () => {
      const result = enrichSubjectKey('techno');
      expect(result.name).toBe('Technologie');
    });
  });

  describe('prefix matching', () => {
    it('should match mathematiques-algebre to mathematiques', () => {
      const result = enrichSubjectKey('mathematiques-algebre');
      expect(result.name).toBe('Mathematiques');
    });
  });

  describe('fallback for unknown subjects', () => {
    it('should return fallback metadata for unknown subjects', () => {
      const result = enrichSubjectKey('unknown-subject');
      expect(result.name).toBe('Unknown Subject');
      expect(result.icon).toBe('GraduationCap');
      expect(result.color).toBe('gray');
    });
  });
});

describe('getSubjectStyles', () => {
  it('should return NativeWind classes for blue', () => {
    const styles = getSubjectStyles('blue');
    expect(styles.bg).toContain('bg-blue');
    expect(styles.text).toContain('text-blue');
    expect(styles.border).toContain('border-blue');
    expect(styles.iconColor.light).toBe('#3B82F6');
    expect(styles.iconColor.dark).toBe('#60A5FA');
  });

  it('should return valid styles for all subject colors', () => {
    const colors: SubjectColor[] = ['blue', 'violet', 'purple', 'emerald', 'amber', 'rose', 'yellow', 'slate', 'teal', 'gray'];
    for (const color of colors) {
      const styles = getSubjectStyles(color);
      expect(styles.bg).toBeTruthy();
      expect(styles.text).toBeTruthy();
      expect(styles.border).toBeTruthy();
      expect(styles.iconColor.light).toBeTruthy();
      expect(styles.iconColor.dark).toBeTruthy();
    }
  });
});

describe('SUBJECT_METADATA', () => {
  it('should contain all 10 required subjects', () => {
    const requiredSubjects = [
      'mathematiques', 'francais', 'physique_chimie', 'svt',
      'histoire_geo', 'anglais', 'espagnol', 'allemand',
      'italien', 'technologie',
    ];
    for (const subject of requiredSubjects) {
      expect(SUBJECT_METADATA[subject]).toBeDefined();
    }
  });

  it('should have valid metadata structure for all subjects', () => {
    for (const metadata of Object.values(SUBJECT_METADATA)) {
      expect(metadata).toHaveProperty('name');
      expect(metadata).toHaveProperty('description');
      expect(metadata).toHaveProperty('icon');
      expect(metadata).toHaveProperty('color');
    }
  });

  it('should have unique colors for similar subjects', () => {
    const francais = SUBJECT_METADATA['francais'];
    const anglais = SUBJECT_METADATA['anglais'];
    expect(francais.color).not.toBe(anglais.color);

    const svt = SUBJECT_METADATA['svt'];
    const italien = SUBJECT_METADATA['italien'];
    expect(svt.color).not.toBe(italien.color);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/mobile && pnpm test -- --testPathPattern=subjects`
Expected: FAIL (tests reference `icon` but code still has `emoji`)

- [ ] **Step 3: Update `src/constants/subjects.ts`**

```tsx
/**
 * Subject Metadata - Donnees UI pour les matieres scolaires
 *
 * Source de verite frontend pour l'affichage (icon, color, description).
 * Le backend RAG retourne uniquement les cles des matieres disponibles.
 */

// =============================================================================
// Types
// =============================================================================

export type SubjectColor =
  | 'blue' | 'violet' | 'purple' | 'emerald' | 'amber'
  | 'rose' | 'yellow' | 'slate' | 'teal' | 'gray';

export interface SubjectMetadata {
  name: string;
  description: string;
  icon: string;
  color: SubjectColor;
}

// =============================================================================
// Color Styles Mapping
// =============================================================================

const SUBJECT_COLOR_STYLES: Record<SubjectColor, {
  bg: string;
  bgSubtle: string;
  text: string;
  border: string;
  iconColor: { light: string; dark: string };
}> = {
  blue: {
    bg: 'bg-blue-50 dark:bg-blue-950',
    bgSubtle: 'bg-blue-100/50 dark:bg-blue-900/30',
    text: 'text-blue-600 dark:text-blue-400',
    border: 'border-blue-200 dark:border-blue-800',
    iconColor: { light: '#3B82F6', dark: '#60A5FA' },
  },
  violet: {
    bg: 'bg-violet-50 dark:bg-violet-950',
    bgSubtle: 'bg-violet-100/50 dark:bg-violet-900/30',
    text: 'text-violet-600 dark:text-violet-400',
    border: 'border-violet-200 dark:border-violet-800',
    iconColor: { light: '#7C3AED', dark: '#A78BFA' },
  },
  purple: {
    bg: 'bg-purple-50 dark:bg-purple-950',
    bgSubtle: 'bg-purple-100/50 dark:bg-purple-900/30',
    text: 'text-purple-600 dark:text-purple-400',
    border: 'border-purple-200 dark:border-purple-800',
    iconColor: { light: '#9333EA', dark: '#C084FC' },
  },
  emerald: {
    bg: 'bg-emerald-50 dark:bg-emerald-950',
    bgSubtle: 'bg-emerald-100/50 dark:bg-emerald-900/30',
    text: 'text-emerald-600 dark:text-emerald-400',
    border: 'border-emerald-200 dark:border-emerald-800',
    iconColor: { light: '#059669', dark: '#34D399' },
  },
  amber: {
    bg: 'bg-amber-50 dark:bg-amber-950',
    bgSubtle: 'bg-amber-100/50 dark:bg-amber-900/30',
    text: 'text-amber-600 dark:text-amber-400',
    border: 'border-amber-200 dark:border-amber-800',
    iconColor: { light: '#D97706', dark: '#FBBF24' },
  },
  rose: {
    bg: 'bg-rose-50 dark:bg-rose-950',
    bgSubtle: 'bg-rose-100/50 dark:bg-rose-900/30',
    text: 'text-rose-600 dark:text-rose-400',
    border: 'border-rose-200 dark:border-rose-800',
    iconColor: { light: '#E11D48', dark: '#FB7185' },
  },
  yellow: {
    bg: 'bg-yellow-50 dark:bg-yellow-950',
    bgSubtle: 'bg-yellow-100/50 dark:bg-yellow-900/30',
    text: 'text-yellow-600 dark:text-yellow-400',
    border: 'border-yellow-200 dark:border-yellow-800',
    iconColor: { light: '#CA8A04', dark: '#FACC15' },
  },
  slate: {
    bg: 'bg-slate-50 dark:bg-slate-900',
    bgSubtle: 'bg-slate-100/50 dark:bg-slate-800/30',
    text: 'text-slate-600 dark:text-slate-400',
    border: 'border-slate-200 dark:border-slate-700',
    iconColor: { light: '#475569', dark: '#94A3B8' },
  },
  teal: {
    bg: 'bg-teal-50 dark:bg-teal-950',
    bgSubtle: 'bg-teal-100/50 dark:bg-teal-900/30',
    text: 'text-teal-600 dark:text-teal-400',
    border: 'border-teal-200 dark:border-teal-800',
    iconColor: { light: '#0D9488', dark: '#2DD4BF' },
  },
  gray: {
    bg: 'bg-stone-50 dark:bg-stone-900',
    bgSubtle: 'bg-stone-100/50 dark:bg-stone-800/30',
    text: 'text-stone-600 dark:text-stone-400',
    border: 'border-stone-200 dark:border-stone-700',
    iconColor: { light: '#57534E', dark: '#A8A29E' },
  },
};

export function getSubjectStyles(color: SubjectColor) {
  return SUBJECT_COLOR_STYLES[color];
}

// =============================================================================
// Subject Metadata (cles RAG backend)
// =============================================================================

export const SUBJECT_METADATA: Record<string, SubjectMetadata> = {
  mathematiques: {
    name: 'Mathematiques',
    description: 'Calculs, geometrie, algebre et problemes',
    icon: 'Calculator',
    color: 'blue',
  },
  francais: {
    name: 'Francais',
    description: 'Lecture, ecriture, grammaire et litterature',
    icon: 'BookOpen',
    color: 'violet',
  },
  physique_chimie: {
    name: 'Physique-Chimie',
    description: 'Sciences physiques et chimiques',
    icon: 'FlaskConical',
    color: 'purple',
  },
  svt: {
    name: 'SVT',
    description: 'Sciences de la Vie et de la Terre',
    icon: 'Leaf',
    color: 'emerald',
  },
  histoire_geo: {
    name: 'Histoire-Geographie',
    description: 'Histoire et geographie de France et du monde',
    icon: 'Globe',
    color: 'amber',
  },
  anglais: {
    name: 'Anglais',
    description: 'Comprehension, expression et culture anglophone',
    icon: 'Languages',
    color: 'rose',
  },
  espagnol: {
    name: 'Espagnol',
    description: 'Vocabulaire, grammaire et culture hispanophone',
    icon: 'MessageCircle',
    color: 'yellow',
  },
  allemand: {
    name: 'Allemand',
    description: 'Expression orale, ecrite et culture germanique',
    icon: 'Book',
    color: 'slate',
  },
  italien: {
    name: 'Italien',
    description: 'Langue et civilisation italiennes',
    icon: 'Drama',
    color: 'teal',
  },
  technologie: {
    name: 'Technologie',
    description: 'Decouverte technique et numerique',
    icon: 'Cog',
    color: 'gray',
  },
};

// =============================================================================
// Helpers
// =============================================================================

const RAG_KEY_ALIASES: Record<string, string> = {
  'histoire-geo': 'histoire_geo',
  'histoire-geographie': 'histoire_geo',
  'histoire_geographie': 'histoire_geo',
  'physique-chimie': 'physique_chimie',
  sciences: 'svt',
  'sciences-vie-terre': 'svt',
  'langues-vivantes': 'anglais',
  lv1: 'anglais',
  lv2: 'espagnol',
  maths: 'mathematiques',
  math: 'mathematiques',
  techno: 'technologie',
  info: 'technologie',
  informatique: 'technologie',
};

function normalizeSubjectKey(key: string): string {
  return key.toLowerCase().replace(/-/g, '_');
}

export function enrichSubjectKey(key: string): SubjectMetadata {
  if (SUBJECT_METADATA[key]) {
    return SUBJECT_METADATA[key];
  }

  const normalizedKey = normalizeSubjectKey(key);
  if (SUBJECT_METADATA[normalizedKey]) {
    return SUBJECT_METADATA[normalizedKey];
  }

  const aliasKey = RAG_KEY_ALIASES[normalizedKey];
  if (aliasKey && SUBJECT_METADATA[aliasKey]) {
    return SUBJECT_METADATA[aliasKey];
  }

  for (const metaKey of Object.keys(SUBJECT_METADATA)) {
    if (normalizedKey.startsWith(metaKey)) {
      return SUBJECT_METADATA[metaKey];
    }
  }

  const displayName = key
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (l) => l.toUpperCase());

  return {
    name: displayName,
    description: `Cours de ${displayName.toLowerCase()}`,
    icon: 'GraduationCap',
    color: 'gray',
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/mobile && pnpm test -- --testPathPattern=subjects`
Expected: PASS

- [ ] **Step 5: Create `SubjectIcon` component**

Create `src/components/common/SubjectIcon.tsx`:

```tsx
/**
 * SubjectIcon - Renders a Lucide icon for a school subject
 *
 * Uses enrichSubjectKey() to resolve the subject, then renders
 * the corresponding Lucide icon with theme-aware color.
 */

import { type LucideIcon } from 'lucide-react-native';
import {
  Calculator,
  BookOpen,
  FlaskConical,
  Leaf,
  Globe,
  Languages,
  MessageCircle,
  Book,
  Drama,
  Cog,
  GraduationCap,
} from 'lucide-react-native';
import { enrichSubjectKey, getSubjectStyles } from '@/constants/subjects';
import { useTheme } from '@/hooks/useTheme';

const ICON_MAP: Record<string, LucideIcon> = {
  Calculator,
  BookOpen,
  FlaskConical,
  Leaf,
  Globe,
  Languages,
  MessageCircle,
  Book,
  Drama,
  Cog,
  GraduationCap,
};

interface SubjectIconProps {
  subject: string;
  size?: number;
  className?: string;
}

export function SubjectIcon({ subject, size = 20, className }: SubjectIconProps) {
  const { isDark } = useTheme();
  const metadata = enrichSubjectKey(subject);
  const styles = getSubjectStyles(metadata.color);
  const IconComponent = ICON_MAP[metadata.icon] ?? GraduationCap;
  const color = isDark ? styles.iconColor.dark : styles.iconColor.light;

  return <IconComponent size={size} color={color} className={className} />;
}
```

- [ ] **Step 6: Export SubjectIcon from common index**

Check if `src/components/common/index.ts` exists and add the export. If there is no barrel file, skip this step — consumers will import directly.

- [ ] **Step 7: Run typecheck**

Run: `cd apps/mobile && pnpm typecheck`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/constants/subjects.ts src/components/common/SubjectIcon.tsx __tests__/constants/subjects.test.ts
git commit -m "feat(mobile): subject icons with Lucide + color styles

Replace emoji with Lucide icon names in SubjectMetadata.
Add getSubjectStyles() for theme-aware Tailwind classes.
Create SubjectIcon component. Update color palette:
francais violet, anglais rose, svt emerald, italien teal,
histoire_geo amber."
```

---

### Task 4: Remove duplicate emoji mappings (Chantier 4b)

**Files:**
- Modify: `src/app/(student)/(home)/index.tsx:34-55`
- Modify: `src/app/(student)/(chat)/index.tsx:35-44`
- Modify: `src/app/(student)/(chat)/chat.tsx:58-67`
- Modify: `src/components/learning/DeckCard.tsx:23-42,74,80-86`

- [ ] **Step 1: Update `DeckCard.tsx` — replace emoji with SubjectIcon**

Remove lines 23-42 (`SUBJECT_EMOJIS` and `getSubjectEmoji`).

Add import:
```tsx
import { SubjectIcon } from '@/components/common/SubjectIcon';
import { enrichSubjectKey, getSubjectStyles } from '@/constants/subjects';
```

Replace `const emoji = getSubjectEmoji(deck.subject);` (line 74) with:
```tsx
const subjectMeta = enrichSubjectKey(deck.subject);
const subjectStyles = getSubjectStyles(subjectMeta.color);
```

Replace the emoji display block (lines 83-86):
```tsx
{/* Before */}
<View className="h-12 w-12 items-center justify-center rounded-lg" style={{ backgroundColor: bgColors.primary[10] }}>
  <Text className="text-2xl">{emoji}</Text>
</View>

{/* After */}
<View className={cn('h-12 w-12 items-center justify-center rounded-lg', subjectStyles.bgSubtle)}>
  <SubjectIcon subject={deck.subject} size={24} />
</View>
```

Add `cn` import from `@/lib/utils` if not already present.

Replace the subject name display (line 93-95):
```tsx
{/* Before */}
<Text variant="muted" className="text-sm capitalize">
  {deck.subject.replace('-', ' ')}
</Text>

{/* After */}
<Text variant="muted" className="text-sm">
  {subjectMeta.name}
</Text>
```

- [ ] **Step 2: Update `(home)/index.tsx` — remove getSubjectEmoji**

Remove lines 34-55 (`getSubjectEmoji` function).

Add import:
```tsx
import { enrichSubjectKey } from '@/constants/subjects';
```

Find all usages of `getSubjectEmoji(...)` in the file and replace with `enrichSubjectKey(...).name` (since the dashboard cards expect a text string, not an icon component — the emoji was used as text in HomeworkUrgentCard/GradesRecentCard props).

**Note:** Read the file fully to find exact usage sites. The `getSubjectEmoji` return value is likely passed as `subjectEmoji` prop to `HomeworkUrgentCard`/`GradesRecentCard`. These components will need the prop renamed from `subjectEmoji` to `subjectName` or similar — check the component interfaces.

- [ ] **Step 3: Update `(chat)/index.tsx` — remove getSubjectEmoji**

Remove lines 35-44 (`getSubjectEmoji` function).

Add import:
```tsx
import { enrichSubjectKey } from '@/constants/subjects';
```

Replace `getSubjectEmoji(conversation.subject)` (around line 58) with `enrichSubjectKey(conversation.subject).name`.

Update the rendering: instead of displaying emoji text, display the subject name or use `<SubjectIcon>`. Read the full component to determine which approach matches the existing UI.

- [ ] **Step 4: Update `(chat)/chat.tsx` — remove getSubjectEmoji**

Remove lines 58-67 (`getSubjectEmoji` function).

Add import:
```tsx
import { enrichSubjectKey } from '@/constants/subjects';
```

Replace all `getSubjectEmoji(...)` calls with `enrichSubjectKey(...).name`.

- [ ] **Step 5: Run typecheck and tests**

Run: `cd apps/mobile && pnpm typecheck && pnpm lint && pnpm test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/learning/DeckCard.tsx src/app/\(student\)/\(home\)/index.tsx src/app/\(student\)/\(chat\)/index.tsx src/app/\(student\)/\(chat\)/chat.tsx
git commit -m "refactor(mobile): consolidate subject display via enrichSubjectKey

Remove 4 duplicate emoji mappings. Use SubjectIcon component
and enrichSubjectKey() as single source of truth for subject
display across dashboard, chat, and learning screens."
```

---

### Task 5: Standardize inline styles in layouts (Chantier 5)

**Files:**
- Modify: `src/app/(student)/_layout.tsx:98-108,115-117,120,126-149`
- Modify: `src/app/(parent)/_layout.tsx:69-79,86-88`

- [ ] **Step 1: Update student layout loading view**

Replace lines 97-108:
```tsx
// Before
return (
  <View
    style={{
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background,
    }}
  >
    <ActivityIndicator size="large" color={colors.primary} />
  </View>
);

// After
return (
  <View className="flex-1 items-center justify-center bg-background dark:bg-stone-900">
    <ActivityIndicator size="large" color={colors.primary} />
  </View>
);
```

Note: `ActivityIndicator color` is an imperative prop — it stays with `useThemeColors()`.

- [ ] **Step 2: Update student layout Suspense fallback**

Replace lines 114-118:
```tsx
// Before
<View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
  <ActivityIndicator size="large" color={colors.primary} />
</View>

// After
<View className="flex-1 items-center justify-center">
  <ActivityIndicator size="large" color={colors.primary} />
</View>
```

- [ ] **Step 3: Update student layout main wrapper**

Replace line 120:
```tsx
// Before
<View style={{ flex: 1 }}>

// After
<View className="flex-1">
```

- [ ] **Step 4: Update Quick Switch banner**

Replace lines 123-149:
```tsx
<TouchableOpacity
  onPress={handleReturnToParent}
  disabled={isRestoring}
  className="flex-row items-center justify-center gap-2 bg-primary dark:bg-blue-400 px-4 pb-2"
  style={{ paddingTop: insets.top + 4 }}
  accessibilityLabel="Retour au compte parent"
  accessibilityRole="button"
>
  <ArrowLeft color={colors.primaryForeground} size={16} />
  <Text className="text-sm font-semibold text-white dark:text-stone-900">
    {isRestoring ? 'Retour en cours...' : 'Retour au compte parent'}
  </Text>
</TouchableOpacity>
```

Note: `paddingTop` with `insets.top` stays inline — it's a dynamic runtime value.

- [ ] **Step 5: Update parent layout loading view**

Replace lines 68-79:
```tsx
// Before
return (
  <View
    style={{
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background,
    }}
  >
    <ActivityIndicator size="large" color={colors.primary} />
  </View>
);

// After
return (
  <View className="flex-1 items-center justify-center bg-background dark:bg-stone-900">
    <ActivityIndicator size="large" color={colors.primary} />
  </View>
);
```

- [ ] **Step 6: Update parent layout Suspense fallback**

Replace lines 85-88:
```tsx
// Before
<View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>

// After
<View className="flex-1 items-center justify-center">
```

- [ ] **Step 7: Run typecheck and lint**

Run: `cd apps/mobile && pnpm typecheck && pnpm lint`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/app/\(student\)/_layout.tsx src/app/\(parent\)/_layout.tsx
git commit -m "refactor(mobile): replace inline styles with NativeWind in layouts

Migrate loading views, suspense fallbacks, and quick switch banner
from React Native style objects to className. Keep imperative props
(ActivityIndicator color, dynamic paddingTop) as inline styles."
```

---

### Task 6: Final validation

- [ ] **Step 1: Run full validation suite**

Run: `cd apps/mobile && pnpm typecheck && pnpm lint && pnpm test`
Expected: ALL PASS

- [ ] **Step 2: Verify no remaining `getSubjectEmoji` or `SUBJECT_EMOJIS`**

Run: `grep -r "getSubjectEmoji\|SUBJECT_EMOJIS" src/`
Expected: No matches

- [ ] **Step 3: Verify no remaining `text-stone-500` (light mode)**

Run: `grep -r "text-stone-500" src/`
Expected: No matches (only `dark:text-stone-400` should remain)

- [ ] **Step 4: Verify `stone-500` not in styles.ts**

Run: `grep "120, 113, 108" src/lib/styles.ts`
Expected: No matches
