# Phase 4 — Design System : dark partagé + fondations mobile — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Une seule source de vérité pour les couleurs light **et** dark (`@repo/tokens`), consommée en CSS par web/landing et en JS par mobile (NativeWind v5), avec button/card/input mobile migrés sur les classes sémantiques (M6/M7/M8 de la revue 2026-06-11).

**Architecture:** `@repo/tokens` gagne `theme-dark.css` (bloc `.dark` réconcilié, importé par web et landing qui suppriment leurs copies divergentes) et `src/colors.ts` (palettes light/dark en TS). Mobile injecte ces palettes à runtime via `VariableContextProvider` (pattern documenté NativeWind v5 — la redéfinition de `:root` sous media query n'est PAS documentée, ne pas l'utiliser), ce qui fait basculer les classes sémantiques (`bg-primary`, `bg-card`…) sans variante `dark:`. Un test `bun:test` dans le package garantit la cohérence CSS ↔ TS. `useThemeColors` mobile dérive des mêmes palettes.

**Tech Stack:** Tailwind v4 (`@theme`, `.dark` class via next-themes), NativeWind `5.0.0-preview.4` (`VariableContextProvider`, vérifié exporté dans la version installée — re-export de `react-native-css@3.0.7`, signature `value: Record<\`--${string}\`, StyleDescriptor>`), bun test, jest-expo.

**Sources consultées:** nativewind.dev/v5 « Implement Multiple Themes with Light/Dark Mode » + « Dark Mode » (via Context7 `/websites/nativewind_dev_v5`) ; signature vérifiée dans `node_modules/.pnpm/react-native-css@3.0.7*/…/native-internal/variables.d.ts`.

---

## Décisions de réconciliation (actées)

Valeurs dark : web et landing étaient identiques sur 23 variables (hex web = hsl landing converties — vérifié valeur par valeur, ce sont les canoniques Tailwind slate). Les vraies divergences, tranchées :

| Token | web (avant) | landing (avant) | Décision |
|---|---|---|---|
| `--color-card` | `#0F172A` | `hsl(222 47% 13%)` (hors échelle Tailwind) | **`#0F172A`** (slate-900 canonique — déjà un cran plus clair que le fond slate-950, l'intention « better contrast » de la landing est satisfaite sans valeur magique) |
| `--color-violet` | absent (héritait du light `#7C3AED`, illisible sur fond sombre) | `hsl(263 70% 60%)` | **`#8B5CF6`** (violet-500 canonique = l'intention landing « éclaircir d'un cran ») |
| `--color-*-foreground` des statuts (destructive/success/warning/info) | `#1C1917` (stone-900, orphelin dans un système slate) | `#1C1917` | **`#0F172A`** (slate-900, harmonisé) |
| Format | hex | hsl + hex mélangés | **hex partout** |

Light mobile : la palette stone actuelle de `useThemeColors` (`#FAFAF9`, `#1C1917`…) est **remplacée** par les tokens slate de la marque — changement visuel mobile assumé, c'est l'objet de M7.

**Piège n°1 (sémantique)** : la clé mobile `colors.muted` (`#57534E` — un gris de TEXTE) correspond au token `--color-muted-foreground` (`#64748B`), PAS à `--color-muted` (`#F1F5F9` — un FOND). Mapper naïvement rendrait tous les gris de texte quasi blancs sur fond blanc. D'où le renommage `muted` → `mutedForeground` (53 occurrences, mécanique, gardé par typecheck).

**Piège n°2 (runtime vs CSS)** : en CSS, `.dark` ne surcharge que ce qui change et le reste hérite. `VariableContextProvider` ne fait PAS d'héritage de cascade — les deux palettes TS doivent être **exhaustives** (les 27 `--color-*`). Le type `Record<ColorToken, string>` l'impose au typecheck, et `theme-dark.css` liste aussi les 27 pour que le test d'égalité stricte tienne.

**Hors scope** : le sweep des 468 classes palette brute des écrans mobile (chantier de fond séparé, décisions emerald=premium ≠ success / blue lien vs info au cas par cas). Les écrans en `stone-*` + `dark:` continuent de fonctionner pendant la transition (le variant `dark:` NativeWind suit `Appearance` indépendamment des variables).

## File Structure

- Create: `packages/tokens/src/colors.ts` — palettes `lightColors`/`darkColors` (source JS)
- Create: `packages/tokens/src/colors.test.ts` — garde anti-dérive CSS ↔ TS
- Create: `packages/tokens/theme-dark.css` — bloc `.dark` partagé (source CSS dark)
- Modify: `packages/tokens/src/index.ts` — re-export colors, **suppression** `tokenNames`/`TokenName` (zéro consommateur, vérifié par grep — le garde anti-dérive devient le test)
- Modify: `packages/tokens/package.json` — export `./theme-dark.css`, script `test`, devDep `bun-types`
- Modify: `packages/tokens/tsconfig.json` — `"types": ["bun-types"]`
- Modify: `apps/web/app/globals.css` — import du dark partagé, suppression du bloc local
- Modify: `apps/landing/app/globals.css` — idem + conservation du `--grid-color` dark (spécifique marketing, hors tokens)
- Modify: `apps/mobile/src/components/providers/ThemeProvider.tsx` — injection `VariableContextProvider`
- Modify: `apps/mobile/src/hooks/useThemeColors.ts` — dérive de `@repo/tokens`, clé `muted` → `mutedForeground`
- Modify: ~30 fichiers mobile consommant `colors.muted` (sed mécanique)
- Create: `apps/mobile/__tests__/hooks/useThemeColors.test.ts`
- Modify: `apps/mobile/src/components/ui/button.tsx`, `card.tsx`, `input.tsx` — classes sémantiques

Faits vérifiés : `@repo/tokens` est déjà en dependency de `apps/mobile/package.json` (l.40) ; bun 1.3 est installé en CI par `.github/actions/setup-monorepo` (le job Test lance `turbo run test` qui ramassera le nouveau script) ; lefthook pre-push lance `turbo run test --affected` ; jest-expo transforme les packages workspace (résolus hors `.pnpm` via symlink → hors `transformIgnorePatterns`) et `@repo/tokens` n'est PAS mocké dans `moduleNameMapper` (seul `@repo/api` l'est) — il sera résolu réellement, c'est voulu (TS pur).

---

### Task 1: `@repo/tokens` — palettes TS + `theme-dark.css` + test de cohérence

**Files:**
- Create: `packages/tokens/src/colors.test.ts`
- Create: `packages/tokens/src/colors.ts`
- Create: `packages/tokens/theme-dark.css`
- Modify: `packages/tokens/src/index.ts`
- Modify: `packages/tokens/package.json`
- Modify: `packages/tokens/tsconfig.json`

- [ ] **Step 1: Écrire le test de cohérence (failing)**

Créer `packages/tokens/src/colors.test.ts` :

```ts
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { darkColors, lightColors } from "./colors";

function parseColorVars(css: string): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const [, name, value] of css.matchAll(/(--color-[\w-]+):\s*([^;]+);/g)) {
    vars[name as string] = (value as string).trim();
  }
  return vars;
}

const packageRoot = join(import.meta.dir, "..");

describe("cohérence CSS ↔ TS des tokens couleur", () => {
  test("theme.css (light) et lightColors déclarent les mêmes tokens aux mêmes valeurs", () => {
    const cssVars = parseColorVars(readFileSync(join(packageRoot, "theme.css"), "utf8"));
    expect(cssVars).toEqual({ ...lightColors });
  });

  test("theme-dark.css et darkColors déclarent les mêmes tokens aux mêmes valeurs", () => {
    const cssVars = parseColorVars(readFileSync(join(packageRoot, "theme-dark.css"), "utf8"));
    expect(cssVars).toEqual({ ...darkColors });
  });
});
```

- [ ] **Step 2: Brancher le runner et les types**

`packages/tokens/package.json` — remplacer les blocs `exports` et `scripts`, ajouter la devDep (pattern bun-types identique à `apps/server/package.json:81`) :

```json
{
  "name": "@repo/tokens",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": {
      "types": "./src/index.ts",
      "import": "./src/index.ts"
    },
    "./theme.css": "./theme.css",
    "./theme-dark.css": "./theme-dark.css"
  },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "bun test"
  },
  "devDependencies": {
    "bun-types": "^1.3.14",
    "typescript": "catalog:"
  }
}
```

`packages/tokens/tsconfig.json` — ajouter `"types": ["bun-types"]` dans `compilerOptions` :

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "declaration": true,
    "declarationMap": true,
    "composite": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "types": ["bun-types"]
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

Puis : `pnpm install` (depuis la racine, met à jour le lockfile pour `bun-types`).

- [ ] **Step 3: Vérifier que le test échoue**

Run: `cd packages/tokens && bun test`
Expected: FAIL — `Cannot find module './colors'`

- [ ] **Step 4: Créer les palettes et le CSS dark**

Créer `packages/tokens/src/colors.ts` :

```ts
/**
 * Tokens couleur en valeurs JS pour les consommateurs hors CSS — NativeWind v5
 * côté mobile (VariableContextProvider) où le bloc `.dark` n'existe pas.
 * Sources CSS : theme.css (light) et theme-dark.css (dark) ; la cohérence
 * CSS ↔ TS est garantie par colors.test.ts. Les deux palettes sont exhaustives
 * (Record<ColorToken, string>) : l'injection runtime ne fait pas d'héritage
 * de cascade, contrairement au CSS.
 */
export const lightColors = {
  "--color-background": "#FFFFFF",
  "--color-foreground": "#0F172A",
  "--color-primary": "#2563EB",
  "--color-primary-foreground": "#FFFFFF",
  "--color-secondary": "#F1F5F9",
  "--color-secondary-foreground": "#0F172A",
  "--color-muted": "#F1F5F9",
  "--color-muted-foreground": "#64748B",
  "--color-accent": "#F1F5F9",
  "--color-accent-foreground": "#0F172A",
  "--color-card": "#FFFFFF",
  "--color-card-foreground": "#0F172A",
  "--color-popover": "#FFFFFF",
  "--color-popover-foreground": "#0F172A",
  "--color-destructive": "#DC2626",
  "--color-destructive-foreground": "#FFFFFF",
  "--color-success": "#059669",
  "--color-success-foreground": "#FFFFFF",
  "--color-warning": "#D97706",
  "--color-warning-foreground": "#FFFFFF",
  "--color-info": "#0EA5E9",
  "--color-info-foreground": "#FFFFFF",
  "--color-border": "#E2E8F0",
  "--color-input": "#E2E8F0",
  "--color-ring": "#2563EB",
  "--color-violet": "#7C3AED",
  "--color-violet-foreground": "#FFFFFF",
} as const;

export type ColorToken = keyof typeof lightColors;

export const darkColors: Record<ColorToken, string> = {
  "--color-background": "#020617",
  "--color-foreground": "#F8FAFC",
  "--color-primary": "#3B82F6",
  "--color-primary-foreground": "#0F172A",
  "--color-secondary": "#1E293B",
  "--color-secondary-foreground": "#F8FAFC",
  "--color-muted": "#1E293B",
  "--color-muted-foreground": "#94A3B8",
  "--color-accent": "#1E293B",
  "--color-accent-foreground": "#F8FAFC",
  "--color-card": "#0F172A",
  "--color-card-foreground": "#F8FAFC",
  "--color-popover": "#0F172A",
  "--color-popover-foreground": "#F8FAFC",
  "--color-destructive": "#F87171",
  "--color-destructive-foreground": "#0F172A",
  "--color-success": "#34D399",
  "--color-success-foreground": "#0F172A",
  "--color-warning": "#FBBF24",
  "--color-warning-foreground": "#0F172A",
  "--color-info": "#38BDF8",
  "--color-info-foreground": "#0F172A",
  "--color-border": "#1E293B",
  "--color-input": "#1E293B",
  "--color-ring": "#3B82F6",
  "--color-violet": "#8B5CF6",
  "--color-violet-foreground": "#FFFFFF",
} as const;
```

⚠️ Les valeurs `lightColors` DOIVENT être copiées exactement depuis `packages/tokens/theme.css` (casse comprise — le test compare en égalité stricte). Si une valeur ci-dessus diffère du theme.css réel, c'est le theme.css qui a raison pour le light.

Créer `packages/tokens/theme-dark.css` :

```css
/* @repo/tokens — overrides dark, classe .dark (next-themes), web + landing.
 * Réconciliation 2026-06 : canoniques Tailwind slate, format hex unique
 * (divergences web/landing tranchées : card=#0F172A, violet=#8B5CF6,
 * status-foreground stone→slate). Mobile ne consomme PAS ce fichier :
 * NativeWind v5 reçoit darkColors (src/colors.ts) via VariableContextProvider.
 * Exhaustif (les 27 --color-*) pour rester l'égal exact de darkColors —
 * cohérence garantie par src/colors.test.ts. */
.dark {
  --color-background: #020617;
  --color-foreground: #F8FAFC;
  --color-primary: #3B82F6;
  --color-primary-foreground: #0F172A;
  --color-secondary: #1E293B;
  --color-secondary-foreground: #F8FAFC;
  --color-muted: #1E293B;
  --color-muted-foreground: #94A3B8;
  --color-accent: #1E293B;
  --color-accent-foreground: #F8FAFC;
  --color-card: #0F172A;
  --color-card-foreground: #F8FAFC;
  --color-popover: #0F172A;
  --color-popover-foreground: #F8FAFC;
  --color-destructive: #F87171;
  --color-destructive-foreground: #0F172A;
  --color-success: #34D399;
  --color-success-foreground: #0F172A;
  --color-warning: #FBBF24;
  --color-warning-foreground: #0F172A;
  --color-info: #38BDF8;
  --color-info-foreground: #0F172A;
  --color-border: #1E293B;
  --color-input: #1E293B;
  --color-ring: #3B82F6;
  --color-violet: #8B5CF6;
  --color-violet-foreground: #FFFFFF;
}
```

Remplacer intégralement `packages/tokens/src/index.ts` (suppression de `tokenNames`/`TokenName` — zéro consommateur dans le monorepo, vérifié ; le garde anti-dérive est désormais le test) :

```ts
/**
 * @repo/tokens — design system partagé.
 *
 * Les valeurs vivent dans `theme.css` (light) et `theme-dark.css` (dark),
 * consommés en CSS par web et landing. `colors.ts` expose les mêmes palettes
 * aux consommateurs JS (NativeWind v5 mobile) — cohérence CSS ↔ TS garantie
 * par `colors.test.ts`.
 */
export { darkColors, lightColors, type ColorToken } from "./colors";
```

Mettre à jour le header de `packages/tokens/theme.css` : remplacer la ligne `* Dark mode : appliqué par chaque app via son propre mécanisme (hors de ce fichier).` (libellé exact à vérifier dans le fichier) par :

```
 * Dark mode : theme-dark.css (classe .dark, web/landing) et src/colors.ts
 * (variables runtime NativeWind, mobile).
```

- [ ] **Step 5: Vérifier que le test passe**

Run: `cd packages/tokens && bun test`
Expected: PASS (2 tests) — si le test light échoue, corriger `lightColors` d'après les valeurs réelles de theme.css (jamais l'inverse).

- [ ] **Step 6: Typecheck + lint monorepo**

Run: `pnpm typecheck && pnpm lint` (racine)
Expected: vert — la suppression de `tokenNames` ne casse rien (aucun import).

- [ ] **Step 7: Commit**

```bash
git add packages/tokens/src/colors.ts packages/tokens/src/colors.test.ts packages/tokens/theme-dark.css packages/tokens/src/index.ts packages/tokens/package.json packages/tokens/tsconfig.json packages/tokens/theme.css pnpm-lock.yaml
git commit -m "feat(tokens): shared dark palette as CSS + TS with consistency test"
```

---

### Task 2: Web — consommer le dark partagé

**Files:**
- Modify: `apps/web/app/globals.css:1-35`

- [ ] **Step 1: Remplacer le bloc `.dark` local par l'import**

Le fichier commence actuellement par les imports puis un bloc `.dark { … }` de 27 lignes (l.7-35). Remplacer tout le segment l.1-35 par :

```css
@import "tailwindcss";
@import "@repo/tokens/theme.css";
@import "@repo/tokens/theme-dark.css";
@source "../../../packages/ui/src";

@custom-variant dark (&:where(.dark, .dark *));
```

Le reste du fichier (body, headings, focus-visible, cursor) est inchangé. Net : le bloc `.dark` local disparaît ; web gagne `--color-violet` en dark (jusqu'ici il héritait du violet light illisible) ; `--color-card` et les `status-foreground` gardent/prennent les valeurs réconciliées.

- [ ] **Step 2: Vérifier le build web**

Run: `cd apps/web && pnpm typecheck && pnpm lint && pnpm build`
Expected: vert. Puis `grep -n '\.dark' apps/web/app/globals.css` → seule la ligne `@custom-variant` doit rester.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/globals.css
git commit -m "refactor(web): consume shared dark tokens from @repo/tokens"
```

---

### Task 3: Landing — consommer le dark partagé

**Files:**
- Modify: `apps/landing/app/globals.css:1-42`

- [ ] **Step 1: Remplacer le bloc `.dark` local**

Le fichier a : imports (l.1-5), un `@theme { --grid-color: … }` local (l.7-10), puis `.dark { … }` de 30 lignes (l.12-42) qui mélange tokens partagés et `--grid-color` spécifique landing. Remplacer le segment l.1-42 par :

```css
@import "tailwindcss";
@import "@repo/tokens/theme.css";
@import "@repo/tokens/theme-dark.css";
@source "../../../packages/ui/src";

@custom-variant dark (&:where(.dark, .dark *));

/* Spécifique landing : motif de fond marketing (hors @repo/tokens) */
@theme {
  --grid-color: hsl(214 32% 80% / 0.25);
}

.dark {
  --grid-color: hsl(215 28% 30% / 0.25);
}
```

Le reste du fichier (base styles, container, selection, scrollbar, reduced-motion) est inchangé. Changements visuels assumés : `--color-card` dark passe de `hsl(222 47% 13%)` à `#0F172A` (un cran plus sombre, reste contrasté sur le fond slate-950) ; violet dark `hsl(263 70% 60%)` → `#8B5CF6` (quasi identique, canonique).

- [ ] **Step 2: Vérifier le build landing**

Run: `cd apps/landing && pnpm typecheck && pnpm lint && pnpm build`
Expected: vert. Puis `grep -c 'color-' apps/landing/app/globals.css` → ne doivent rester que les usages utilitaires (`var(--color-primary)` du scrollbar), aucune déclaration `--color-*:`.

- [ ] **Step 3: Commit**

```bash
git add apps/landing/app/globals.css
git commit -m "refactor(landing): consume shared dark tokens from @repo/tokens"
```

---

### Task 4: Mobile — injecter les palettes à runtime (ThemeProvider)

**Files:**
- Modify: `apps/mobile/src/components/providers/ThemeProvider.tsx` (23 lignes, remplacement intégral)

- [ ] **Step 1: Brancher VariableContextProvider**

```tsx
/**
 * ThemeProvider Component
 *
 * Provides theme context to the app.
 * Les palettes @repo/tokens sont injectées en variables NativeWind à runtime
 * (VariableContextProvider, pattern NativeWind v5) : les classes sémantiques
 * (bg-primary, bg-card…) suivent le mode sans variante dark: par classe.
 * L'injection est exhaustive — pas d'héritage de cascade à runtime.
 */

import { VariableContextProvider } from 'nativewind';
import { darkColors, lightColors } from '@repo/tokens';
import { useThemeProvider, ThemeContext } from '@/hooks/useTheme';

interface ThemeProviderProps {
  children: React.ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const theme = useThemeProvider();

  return (
    <ThemeContext value={theme}>
      <VariableContextProvider value={theme.isDark ? darkColors : lightColors}>
        {children}
      </VariableContextProvider>
    </ThemeContext>
  );
}
```

- [ ] **Step 2: Vérifier typecheck + tests mobile**

Run: `cd apps/mobile && pnpm typecheck && pnpm lint && pnpm test`
Expected: vert (le provider n'a pas de test dédié ; les suites existantes ne montent pas ThemeProvider). Si jest échoue à résoudre `@repo/tokens` (improbable — package workspace TS pur, transformé car résolu hors `.pnpm`), ajouter dans `apps/mobile/jest.config.js` → `moduleNameMapper` : `'^@repo/tokens$': '<rootDir>/../../packages/tokens/src/index.ts',`.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/components/providers/ThemeProvider.tsx
git commit -m "feat(mobile): inject @repo/tokens palettes as NativeWind runtime variables"
```

---

### Task 5: Mobile — `useThemeColors` dérivé de `@repo/tokens` (TDD)

**Files:**
- Create: `apps/mobile/__tests__/hooks/useThemeColors.test.ts`
- Modify: `apps/mobile/src/hooks/useThemeColors.ts` (remplacement intégral)
- Modify: ~30 fichiers consommant `colors.muted` (sed)

- [ ] **Step 1: Écrire le test (failing)**

Créer `apps/mobile/__tests__/hooks/useThemeColors.test.ts` :

```ts
import { renderHook } from '@testing-library/react-native';
import { darkColors, lightColors } from '@repo/tokens';
import { useThemeColors } from '@/hooks/useThemeColors';
import { useTheme } from '@/hooks/useTheme';

jest.mock('@/hooks/useTheme');
const mockUseTheme = jest.mocked(useTheme);

function mockScheme(isDark: boolean) {
  mockUseTheme.mockReturnValue({ isDark } as ReturnType<typeof useTheme>);
}

describe('useThemeColors', () => {
  it('dérive la palette light de @repo/tokens', () => {
    mockScheme(false);
    const { result } = renderHook(() => useThemeColors());
    expect(result.current.primary).toBe(lightColors['--color-primary']);
    expect(result.current.background).toBe(lightColors['--color-background']);
    expect(result.current.card).toBe(lightColors['--color-card']);
  });

  it('dérive la palette dark de @repo/tokens', () => {
    mockScheme(true);
    const { result } = renderHook(() => useThemeColors());
    expect(result.current.primary).toBe(darkColors['--color-primary']);
    expect(result.current.background).toBe(darkColors['--color-background']);
  });

  it('mappe mutedForeground sur --color-muted-foreground (texte, pas le fond --color-muted)', () => {
    mockScheme(false);
    const { result } = renderHook(() => useThemeColors());
    expect(result.current.mutedForeground).toBe(lightColors['--color-muted-foreground']);
  });
});
```

- [ ] **Step 2: Vérifier que le test échoue**

Run: `cd apps/mobile && pnpm test -- useThemeColors`
Expected: FAIL — `mutedForeground` n'existe pas et les valeurs actuelles sont les hex stone hardcodés.

- [ ] **Step 3: Réécrire le hook**

Remplacement intégral de `apps/mobile/src/hooks/useThemeColors.ts` :

```ts
import { useMemo } from 'react';
import { darkColors, lightColors, type ColorToken } from '@repo/tokens';
import { useTheme } from './useTheme';

/**
 * Tokens couleur en valeurs JS pour les API RN impératives (ActivityIndicator,
 * placeholderTextColor, icônes lucide…) — mêmes palettes @repo/tokens que les
 * classes NativeWind injectées par ThemeProvider.
 */
export interface ThemeColors {
  primary: string;
  primaryForeground: string;
  success: string;
  successForeground: string;
  warning: string;
  warningForeground: string;
  destructive: string;
  destructiveForeground: string;
  info: string;
  infoForeground: string;
  foreground: string;
  mutedForeground: string;
  background: string;
  border: string;
  card: string;
}

function toThemeColors(tokens: Record<ColorToken, string>): ThemeColors {
  return {
    primary: tokens['--color-primary'],
    primaryForeground: tokens['--color-primary-foreground'],
    success: tokens['--color-success'],
    successForeground: tokens['--color-success-foreground'],
    warning: tokens['--color-warning'],
    warningForeground: tokens['--color-warning-foreground'],
    destructive: tokens['--color-destructive'],
    destructiveForeground: tokens['--color-destructive-foreground'],
    info: tokens['--color-info'],
    infoForeground: tokens['--color-info-foreground'],
    foreground: tokens['--color-foreground'],
    mutedForeground: tokens['--color-muted-foreground'],
    background: tokens['--color-background'],
    border: tokens['--color-border'],
    card: tokens['--color-card'],
  };
}

const LIGHT = toThemeColors(lightColors);
const DARK = toThemeColors(darkColors);

export function useThemeColors(): ThemeColors {
  const { isDark } = useTheme();
  return useMemo(() => (isDark ? DARK : LIGHT), [isDark]);
}
```

- [ ] **Step 4: Renommer les 53 call sites `colors.muted` → `colors.mutedForeground`**

D'abord vérifier qu'il n'y a pas de destructuring (`const { muted }`) qui échapperait au sed :

```bash
grep -rn 'muted' apps/mobile/src --include='*.ts' --include='*.tsx' | grep -v 'mutedForeground\|colors\.muted\|text-muted\|variant="muted"\|useThemeColors'
```

(Inspecter ce qui sort ; les accès via variable intermédiaire — ex. `c.muted` — sont à renommer à la main.) Puis :

```bash
grep -rl 'colors\.muted\b' apps/mobile/src | xargs sed -i 's/colors\.muted\b/colors.mutedForeground/g'
```

Note : `\b` ne matche pas `colors.mutedForeground` (pas de frontière entre `d` et `F`), le sed est idempotent.

- [ ] **Step 5: Vérifier**

Run: `cd apps/mobile && pnpm typecheck && pnpm lint && pnpm test`
Expected: vert, dont le nouveau test useThemeColors (3 tests). Le typecheck attrape tout accès `.muted` résiduel.
Puis: `grep -rn 'colors\.muted\b' apps/mobile/src | wc -l` → 0.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/hooks/useThemeColors.ts apps/mobile/__tests__/hooks/useThemeColors.test.ts
git add $(git diff --name-only -- apps/mobile/src)
git commit -m "refactor(mobile): derive useThemeColors from @repo/tokens palettes"
```

---

### Task 6: Mobile — `button.tsx` sur classes sémantiques

**Files:**
- Modify: `apps/mobile/src/components/ui/button.tsx:25-68`

- [ ] **Step 1: Migrer les deux cva**

Remplacer `buttonVariants` (l.25-47) et `buttonTextVariants` (l.49-68) par :

```ts
const buttonVariants = cva(
  'flex-row items-center justify-center gap-2 rounded-lg web:ring-offset-background web:transition-colors web:focus-visible:outline-none web:focus-visible:ring-2 web:focus-visible:ring-ring web:focus-visible:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'bg-primary',
        destructive: 'bg-destructive',
        outline: 'border border-border bg-background active:bg-accent',
        ghost: 'active:bg-accent',
      },
      size: {
        default: 'h-12 px-6 py-3',
        sm: 'h-11 px-4 py-2', // 44px minimum touch target (WCAG 2.1)
        icon: 'h-12 w-12',
        'icon-sm': 'h-11 w-11', // 44px minimum touch target (was 40px)
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

const buttonTextVariants = cva('font-semibold text-center', {
  variants: {
    variant: {
      default: 'text-primary-foreground',
      destructive: 'text-destructive-foreground',
      outline: 'text-foreground',
      ghost: 'text-foreground',
    },
    size: {
      default: 'text-base',
      sm: 'text-sm',
      icon: 'text-base',
      'icon-sm': 'text-sm',
    },
  },
  defaultVariants: {
    variant: 'default',
    size: 'default',
  },
});
```

Correspondance d'intention (aucun `dark:` ne survit — les variables runtime gèrent le mode) : `bg-blue-600 dark:bg-blue-400` → `bg-primary` ; bordure+fond neutres de outline → `border-border bg-background` ; feedback press `blue-50/blue-900` → `bg-accent` ; ring focus `blue-600/400` → `ring-ring` ; textes `white|stone-*` → `*-foreground`/`foreground`. Le reste du fichier (props, haptics, spinner via `useThemeColors`) est inchangé.

- [ ] **Step 2: Vérifier**

Run: `cd apps/mobile && pnpm typecheck && pnpm lint && pnpm test`
Expected: vert. Puis `grep -n 'stone-\|blue-\|red-' apps/mobile/src/components/ui/button.tsx` → 0 occurrence.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/components/ui/button.tsx
git commit -m "refactor(mobile): button on semantic token classes"
```

---

### Task 7: Mobile — `card.tsx` + `input.tsx` sur classes sémantiques

**Files:**
- Modify: `apps/mobile/src/components/ui/card.tsx:8,15,67`
- Modify: `apps/mobile/src/components/ui/input.tsx:20-37,89,129`

- [ ] **Step 1: card.tsx**

- l.8 (commentaire) : `Borderless design: depth via bg-white dark:bg-stone-800 contrast + subtle elevation.` → `Borderless design: depth via bg-card contrast + subtle elevation.`
- l.15 (`Card`) : `'rounded-2xl bg-white dark:bg-stone-800'` → `'rounded-2xl bg-card'`
- l.67 (`CardCompact`) : `'rounded-xl bg-white dark:bg-stone-800'` → `'rounded-xl bg-card'`

- [ ] **Step 2: input.tsx**

Remplacer `inputVariants` (l.20-37) par :

```ts
const inputVariants = cva(
  'h-12 w-full rounded-lg border bg-background px-4 py-3 text-base text-foreground web:ring-offset-background web:focus-visible:outline-none web:focus-visible:ring-2 web:focus-visible:ring-offset-2',
  {
    variants: {
      variant: {
        default:
          'border-input native:focus:border-primary web:focus-visible:ring-ring',
        error:
          'border-destructive native:focus:border-destructive web:focus-visible:ring-destructive',
        success:
          'border-success native:focus:border-success web:focus-visible:ring-success',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);
```

(`border-input` = le token bordure de champ `--color-input`, pattern shadcn ; le fond `bg-stone-50` → `bg-background`.)

- l.89 (label) : `className="text-stone-800 dark:text-stone-100"` → `className="text-foreground"`
- l.129 (errorMessage) : `className="text-red-600 dark:text-red-400"` → `className="text-destructive"`

Les couleurs impératives (`colors.destructive`, `colors.success`, `colors.mutedForeground` pour placeholder et icônes Eye/EyeOff) viennent déjà de useThemeColors aligné en Task 5 — rien d'autre à toucher.

- [ ] **Step 3: Vérifier**

Run: `cd apps/mobile && pnpm typecheck && pnpm lint && pnpm test`
Expected: vert. Puis `grep -n 'stone-\|blue-\|red-\|emerald-\|bg-white' apps/mobile/src/components/ui/card.tsx apps/mobile/src/components/ui/input.tsx` → 0 occurrence.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/components/ui/card.tsx apps/mobile/src/components/ui/input.tsx
git commit -m "refactor(mobile): card and input on semantic token classes"
```

---

### Task 8: Validation finale + PR

- [ ] **Step 1: Validation monorepo complète**

```bash
pnpm typecheck && pnpm lint
cd packages/tokens && bun test
cd ../../apps/mobile && pnpm test
cd ../web && pnpm build
cd ../landing && pnpm build
```

Expected: tout vert. (Server non touché — pas de `test:integration` requis ; aucun nouveau module dans la chaîne `app.ts`/`server-lifecycle.ts`.)

- [ ] **Step 2: Push + PR**

```bash
git push -u origin feat/phase4-design-system-dark-mobile
gh pr create --base main --title "feat(tokens): shared dark palette + mobile token foundations" --body "…(M6/M7/M8, lien revue 2026-06-11, tableau de réconciliation, validation)…"
```

(Le pre-push lefthook rejoue tests + build en `--affected`.)

- [ ] **Step 3: Vérification visuelle (signal, pas gate)**

La preview E2E Maestro Android tourne sur la PR. Changements visuels attendus côté mobile : palette stone (chaude) → slate (froide) sur button/card/input et toutes les couleurs impératives ; le dark mobile passe de stone-900 (#1C1917) au slate-950 (#020617) de la marque. À vérifier sur dev client si possible avant merge.
