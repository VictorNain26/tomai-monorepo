# Design System Unifié — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Uniformiser le design des trois surfaces (landing, web, mobile/app universelle) via `@repo/tokens` comme unique source de vérité + contrat de parité des composants homonymes.

**Architecture:** Pas de composants partagés DOM/RN (ADR 0001). `@repo/tokens` gagne les tokens motion (CSS `@theme` + miroir TS testé). Les 5 composants homonymes (`button`, `card`, `input`, `avatar`, `skeleton`) sont alignés sur un noyau commun de variants/sizes. Deux docs de gouvernance verrouillent le contrat.

**Tech Stack:** Tailwind CSS v4 (`@theme` namespaces `--duration-*`, validé contre [tailwindcss.com/docs/transition-duration](https://tailwindcss.com/docs/transition-duration)), NativeWind v5, cva, bun:test (tokens), jest-expo (mobile).

**Spec:** `docs/superpowers/specs/2026-07-05-design-system-unifie-design.md`

## Global Constraints

- Branche de travail courte à créer **depuis `main` frais** : `feat/design-system-foundations` (lot A) puis `feat/design-system-parity` (lot B), PR → merge commit (jamais squash).
- Zéro valeur visuelle hardcodée : uniquement classes utilitaires issues des tokens.
- Zéro `eslint-disable`, zéro `any`, lint `--max-warnings 0`.
- Stager fichier par fichier (jamais `git add .`).
- Validation avant chaque commit : voir commandes par package dans chaque tâche (lefthook relance lint+typecheck en pre-commit).
- `apps/web` : aucun investissement (meurt au cutover) ; ses usages des composants `@repo/ui` modifiés doivent juste continuer à typechecker.
- Hauteurs/espacements peuvent différer entre DOM (densité desktop) et RN (touch ≥ 44 px) : la parité porte sur **noms de variants, tokens, états, a11y** — pas sur les pixels.

---

## Lot A — Fondations

### Task 1: Tokens motion (`@repo/tokens`)

**Files:**
- Modify: `packages/tokens/theme.css` (ajout bloc durées)
- Create: `packages/tokens/src/motion.ts`
- Test: `packages/tokens/src/motion.test.ts`
- Modify: `packages/tokens/src/index.ts`

**Interfaces:**
- Produces: `motionDurations: { fast: 150, base: 250, slow: 400, pulse: 1000 }` (nombres en ms) et `motionEasings: { out: [0, 0, 0.2, 1], inOut: [0.4, 0, 0.2, 1] }` (tuples cubic-bezier pour Reanimated), exportés par `@repo/tokens`. Utilitaires Tailwind générés : `duration-fast`, `duration-base`, `duration-slow`, `duration-pulse`.
- Note : les easings ne sont **pas** ajoutés au CSS — Tailwind v4 fournit déjà `ease-out` = `cubic-bezier(0, 0, 0.2, 1)` et `ease-in-out` = `cubic-bezier(0.4, 0, 0.2, 1)` par défaut ; `motionEasings` est le miroir JS de ces courbes standard pour Reanimated.

- [ ] **Step 1: Write the failing test**

Create `packages/tokens/src/motion.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { motionDurations } from "./motion";

function parseDurationVars(css: string): Record<string, number> {
  const vars: Record<string, number> = {};
  for (const [, name, value] of css.matchAll(/--duration-([\w-]+):\s*(\d+)ms;/g)) {
    vars[name as string] = Number(value);
  }
  return vars;
}

const packageRoot = join(import.meta.dir, "..");

describe("cohérence CSS ↔ TS des tokens motion", () => {
  test("theme.css déclare les mêmes durées que motionDurations", () => {
    const cssVars = parseDurationVars(readFileSync(join(packageRoot, "theme.css"), "utf8"));
    expect(cssVars).toEqual({ ...motionDurations });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/tokens && bun test motion`
Expected: FAIL — `Cannot find module './motion'`

- [ ] **Step 3: Write minimal implementation**

Create `packages/tokens/src/motion.ts`:

```ts
/**
 * Tokens motion — miroir TS des variables --duration-* de theme.css
 * (cohérence garantie par motion.test.ts). Les easings reprennent les
 * courbes standard Tailwind (ease-out / ease-in-out) pour Reanimated,
 * qui ne lit pas le CSS.
 */
export const motionDurations = {
  fast: 150,
  base: 250,
  slow: 400,
  pulse: 1000,
} as const;

export const motionEasings = {
  out: [0, 0, 0.2, 1],
  inOut: [0.4, 0, 0.2, 1],
} as const;
```

In `packages/tokens/theme.css`, ajouter à la fin du bloc `@theme` (après `--color-overlay: #000000;`) :

```css
  /* Motion — fast: micro-feedback (press, toggle) ; base: transitions
   * standard ; slow: entrées d'écran ; pulse: demi-cycle skeleton. */
  --duration-fast: 150ms;
  --duration-base: 250ms;
  --duration-slow: 400ms;
  --duration-pulse: 1000ms;
```

In `packages/tokens/src/index.ts`, ajouter :

```ts
export { motionDurations, motionEasings } from "./motion";
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/tokens && bun test`
Expected: PASS (motion + colors, 3 tests)

- [ ] **Step 5: Validate & commit**

Run: `cd packages/tokens && bun run typecheck && cd ../.. && pnpm typecheck && pnpm lint`
Expected: exit 0 partout.

```bash
git add packages/tokens/theme.css packages/tokens/src/motion.ts packages/tokens/src/motion.test.ts packages/tokens/src/index.ts
git commit -m "feat(tokens): motion duration tokens with tested TS mirror"
```

### Task 2: Doc contrat `docs/design/design-system.md`

**Files:**
- Create: `docs/design/design-system.md`

**Interfaces:**
- Produces: le contrat de référence cité par la règle projet (Task 3) et par les revues de PR.

- [ ] **Step 1: Create the document**

Create `docs/design/design-system.md` with exactly this content:

```markdown
# Design system Tom — contrat des trois surfaces

Source de vérité du design unifié entre `apps/landing` (DOM), l'app universelle
Expo (`apps/mobile`, web produit + mobile) et `apps/web` (jusqu'au cutover).
Spec d'origine : `docs/superpowers/specs/2026-07-05-design-system-unifie-design.md`.

## Règle zéro : tout passe par `@repo/tokens`

Toute décision visuelle (couleur, typo, rayon, espacement, durée d'animation)
vit dans `@repo/tokens`. Une valeur visuelle hardcodée dans une app ou un
composant est un bug. La direction artistique définitive (chantier ultérieur)
se fera en éditant uniquement ce package.

## Tokens

- **Couleurs** : sémantiques shadcn-alignées (`background`, `foreground`,
  `primary`, `secondary`, `muted`, `accent`, `card`, `destructive`, `success`,
  `warning`, `info`, `border`, `input`, `ring`, `violet`). Light `theme.css`,
  dark `theme-dark.css`, miroir TS `colors.ts` (testé).
- **Typo** : Poppins (`font-heading`) = titres/display uniquement ;
  Nunito Sans (`font-sans`) = corps, UI, formulaires ;
  JetBrains Mono (`font-mono`) = code et données techniques.
- **Motion** : `duration-fast` 150 ms (micro-feedback), `duration-base` 250 ms
  (transitions standard), `duration-slow` 400 ms (entrées d'écran),
  `duration-pulse` 1000 ms (demi-cycle skeleton). Easings : `ease-out` en
  entrée, `ease-in-out` en déplacement (courbes standard Tailwind ; miroir JS
  `motionEasings` pour Reanimated).
- **Rayons/espacements** : échelle `--radius-*` et `--spacing-*` du package.

## Contrat de parité des composants

Deux implémentations jumelles, jamais de composant partagé DOM/RN (ADR 0001) :
`packages/ui` (DOM, landing) et `apps/mobile/src/components/ui` (RN, app
universelle).

1. **Homonyme = même noyau de variants/sizes.**
   Button : `default | destructive | outline | secondary | ghost` ;
   extensions DOM-only : `link`, `premium` ; sizes : vocabulaire commun
   (`sm | default | lg | icon`), hauteurs par plateforme.
   Avatar : sizes `sm (32) | md (40) | lg (48) | xl (64)`.
   Card : sous-composants `Header | Title | Description | Content | Footer`
   des deux côtés (`CardCompact` RN-only).
2. **Tokens uniquement** — aucune couleur/durée/rayon littéral dans un
   composant ou un écran.
3. **États complets** sur tout interactif : disabled, loading, pressed (RN) /
   hover + active (DOM), focus visible, error le cas échéant.
4. **A11y AA** : cibles ≥ 44 px tactile, `accessibilityLabel`/`aria-*`,
   contraste 4.5:1, navigation clavier côté DOM.
5. **Divergences autorisées** : uniquement l'intrinsèque plateforme —
   haptics et `ActivityIndicator` RN, focus-ring et `hover` DOM, densités
   (h-10 desktop vs h-12 touch), Card bordée (DOM) vs borderless (RN,
   tranché à la DA).

## Patterns UX communs

- **Loading** : skeletons ; spinner uniquement inline (bouton en cours).
- **Empty states** : message + action de sortie, jamais un écran vide.
- **Erreurs** : nommer le problème + l'action corrective. Toast = information
  et succès ; dialog = réservé à l'irréversible.
- **Formulaires** : label toujours visible (jamais placeholder seul),
  validation au blur, champ en erreur jamais vidé, clavier adapté
  (`inputmode`/`autocomplete` DOM, `keyboardType`/`textContentType` RN).
- **Dark mode** : disponible et persistant sur les trois surfaces
  (`.dark` + `theme-dark.css` web, variables runtime NativeWind mobile).
- **Motion** : durées/easings via tokens ; `prefers-reduced-motion` (web) et
  `AccessibilityInfo.isReduceMotionEnabled` (RN) respectés — fallback opacité.

## Double registre (une marque, deux intensités)

- **Sobre** — landing, espace parent, B2B : palette froide, motion minimal,
  pas de haptics superflus.
- **Vivant** — expérience élève (11-18 ans) : accent `violet` autorisé,
  micro-motion, haptics. Jamais infantilisant : pas de mascotte cartoon,
  pas de formes enfantines.

Aucun mécanisme dédié : c'est une convention d'usage des tokens existants.
Si la DA future exige des valeurs distinctes par registre, on introduira une
surcouche de variables (classe CSS web, provider NativeWind RN).
```

- [ ] **Step 2: Commit**

```bash
git add docs/design/design-system.md
git commit -m "docs(design): design system contract for the three surfaces"
```

### Task 3: Règle projet `.claude/rules/design-system.md`

**Files:**
- Create: `.claude/rules/design-system.md`

**Interfaces:**
- Consumes: le contrat de Task 2 (référencé, pas dupliqué in extenso).
- Produces: garde-fou auto-chargé par Claude Code dans toute session du repo.

- [ ] **Step 1: Create the rule**

Create `.claude/rules/design-system.md` with exactly this content:

```markdown
# Design system — règles d'application

Contrat complet : `docs/design/design-system.md`. Ici : ce qui s'applique à
chaque PR touchant de l'UI.

- **Tokens uniquement** : aucune couleur, durée, rayon ou taille littérale
  dans composants et écrans — classes utilitaires issues de `@repo/tokens`
  (`bg-primary`, `duration-base`, `rounded-lg`…). Nouveau token = ajout dans
  `@repo/tokens` (CSS + miroir TS testé si consommé hors CSS).
- **Parité des homonymes** : un composant présent dans `packages/ui` (DOM) ET
  `apps/mobile/src/components/ui` (RN) expose le même noyau de
  variants/sizes. Modifier un côté = vérifier l'autre. Noyau Button :
  `default | destructive | outline | secondary | ghost` (DOM-only : `link`,
  `premium`). Jamais de composant partagé DOM/RN (ADR 0001).
- **États complets** sur tout interactif : disabled, loading, pressed (RN) /
  hover + active (DOM), focus visible, error. Pas de happy-path only.
- **A11y AA** : cibles ≥ 44 px tactile, labels (`accessibilityLabel` /
  `aria-*` / `<label>`), contraste 4.5:1.
- **Patterns UX** : skeletons (pas de spinner pleine page), empty state avec
  action, validation formulaire au blur, toast = info / dialog = irréversible,
  reduced-motion respecté.
- **Registres** : landing/parent = sobre ; élève = vivant (violet,
  micro-motion, haptics) sans infantiliser.
- **Typo** : Poppins titres, Nunito Sans corps, JetBrains Mono code.
```

- [ ] **Step 2: Commit**

```bash
git add .claude/rules/design-system.md
git commit -m "chore(ci): auto-loaded design system rule for agents"
```

*(Fin du lot A → PR `feat/design-system-foundations` vers `main`, merge commit.)*

---

## Lot B — Parité des composants

### Task 4: Button — noyau commun de variants

**Files:**
- Modify: `apps/mobile/src/components/ui/button.tsx`
- Modify: `apps/mobile/src/hooks/useThemeColors.ts`
- Modify: `packages/ui/src/components/button.tsx`
- Test: `apps/mobile/__tests__/components/ui/button.test.tsx`

**Interfaces:**
- Consumes: `motionDurations` (Task 1) — indirectement via l'utilitaire `duration-base`.
- Produces: RN `Button` accepte `variant="secondary"` ; `useThemeColors()` expose `secondary: string` et `secondaryForeground: string` ; DOM `outline` aligné canon shadcn (`border-border`, hover accent).

- [ ] **Step 1: Write the failing test**

Create `apps/mobile/__tests__/components/ui/button.test.tsx`:

```tsx
/**
 * Button — parité design system : variant secondary + état loading.
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

jest.mock('@/hooks/useThemeColors', () => ({
  useThemeColors: () => ({
    primary: '#2563EB',
    primaryForeground: '#FFFFFF',
    secondary: '#F1F5F9',
    secondaryForeground: '#0F172A',
    destructive: '#DC2626',
    destructiveForeground: '#FFFFFF',
    foreground: '#0F172A',
    mutedForeground: '#64748B',
    background: '#FFFFFF',
    border: '#E2E8F0',
    card: '#FFFFFF',
  }),
}));

jest.mock('@/lib/haptics', () => ({
  haptics: { light: jest.fn(), heavy: jest.fn() },
}));

import { Button } from '@/components/ui/button';

describe('Button', () => {
  it('renders the secondary variant with its label', () => {
    const { getByText } = render(<Button variant="secondary">Continuer</Button>);
    expect(getByText('Continuer')).toBeTruthy();
  });

  it('does not fire onPress while loading', () => {
    const onPress = jest.fn();
    const { getByText, rerender } = render(<Button onPress={onPress}>Envoyer</Button>);
    fireEvent.press(getByText('Envoyer'));
    expect(onPress).toHaveBeenCalledTimes(1);

    rerender(<Button onPress={onPress} isLoading>Envoyer</Button>);
    // en loading le label est remplacé par le spinner et le Pressable est disabled
    expect(() => getByText('Envoyer')).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/mobile && pnpm test -- button.test`
Expected: FAIL — TypeScript/variant : `secondary` n'existe pas dans `buttonVariants` (erreur de type au render ou classe absente).
Note : si le test passe à tort (cva ignore les variants inconnus au runtime), vérifier que `pnpm typecheck` échoue sur `variant="secondary"` — c'est le vrai red.

- [ ] **Step 3: Implement**

In `apps/mobile/src/hooks/useThemeColors.ts` :
- ajouter à `ThemeColors` : `secondary: string;` et `secondaryForeground: string;` (après `primaryForeground`)
- ajouter dans `toThemeColors` : `secondary: tokens['--color-secondary'],` et `secondaryForeground: tokens['--color-secondary-foreground'],`

In `apps/mobile/src/components/ui/button.tsx` :
- `buttonVariants` → ajouter dans `variant` : `secondary: 'bg-secondary active:opacity-90',`
- `buttonTextVariants` → ajouter : `secondary: 'text-secondary-foreground',`
- `getSpinnerColor` → ajouter le cas : `case 'secondary': return colors.secondaryForeground;`
- `needsActiveOpacity` → inclure secondary : `variant === 'default' || variant === 'destructive' || variant === 'secondary'`

In `packages/ui/src/components/button.tsx` :
- variant `outline` : remplacer la ligne par le canon shadcn aligné RN :
  ```
  outline:
    "border border-border bg-transparent hover:bg-accent hover:text-accent-foreground active:scale-[0.98]",
  ```
- classe de base : remplacer `duration-200` par `duration-base`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/mobile && pnpm test -- button.test && pnpm typecheck && pnpm lint`
Expected: PASS, exit 0.
Run: `cd packages/ui && pnpm typecheck && pnpm lint && cd ../../apps/landing && pnpm typecheck && pnpm lint`
Expected: exit 0 (les 2 usages `outline` de la landing — pricing, how-it-works — restent valides ; le rendu change vers le canon, c'est voulu).

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/components/ui/button.tsx apps/mobile/src/hooks/useThemeColors.ts apps/mobile/__tests__/components/ui/button.test.tsx packages/ui/src/components/button.tsx
git commit -m "feat(mobile): button secondary variant + shadcn-canon outline parity"
```

### Task 5: Card — parité d'API (sous-composants RN)

**Files:**
- Modify: `apps/mobile/src/components/ui/card.tsx`
- Modify: `packages/ui/src/components/card.tsx`
- Test: `apps/mobile/__tests__/components/ui/card.test.tsx`

**Interfaces:**
- Produces: RN exporte `Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, CardCompact, CardCompactContent`. DOM `Card` passe en `rounded-2xl` (même rayon que RN).

- [ ] **Step 1: Write the failing test**

Create `apps/mobile/__tests__/components/ui/card.test.tsx`:

```tsx
/**
 * Card — parité design system : sous-composants alignés sur packages/ui.
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';

describe('Card', () => {
  it('renders header, title, description and content', () => {
    const { getByText } = render(
      <Card>
        <CardHeader>
          <CardTitle>Mes révisions</CardTitle>
          <CardDescription>3 decks à revoir</CardDescription>
        </CardHeader>
        <CardContent>
          <CardTitle>Contenu</CardTitle>
        </CardContent>
      </Card>
    );
    expect(getByText('Mes révisions')).toBeTruthy();
    expect(getByText('3 decks à revoir')).toBeTruthy();
    expect(getByText('Contenu')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/mobile && pnpm test -- card.test`
Expected: FAIL — `CardHeader` (etc.) n'est pas exporté par `@/components/ui/card`.

- [ ] **Step 3: Implement**

In `apps/mobile/src/components/ui/card.tsx`, ajouter après `CardCompactContent` (import `Text` depuis `./text` en tête de fichier) :

```tsx
function CardHeader({ className, ...props }: ViewProps) {
  return <View className={cn('flex-col gap-1.5 p-4', className)} {...props} />;
}

function CardTitle({ className, ...props }: React.ComponentProps<typeof Text>) {
  return (
    <Text
      className={cn('font-heading text-lg font-semibold text-card-foreground', className)}
      {...props}
    />
  );
}

function CardDescription({ className, ...props }: React.ComponentProps<typeof Text>) {
  return <Text className={cn('text-sm text-muted-foreground', className)} {...props} />;
}

function CardContent({ className, ...props }: ViewProps) {
  return <View className={cn('p-4 pt-0', className)} {...props} />;
}

function CardFooter({ className, ...props }: ViewProps) {
  return <View className={cn('flex-row items-center p-4 pt-0', className)} {...props} />;
}
```

et compléter l'export :

```tsx
export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  CardCompact,
  CardCompactContent,
};
```

(`import type React from 'react';` si nécessaire pour `React.ComponentProps`.)

In `packages/ui/src/components/card.tsx` : dans `cardVariants`, remplacer `rounded-xl` par `rounded-2xl`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/mobile && pnpm test -- card.test && pnpm typecheck && pnpm lint`
Run: `cd packages/ui && pnpm typecheck && pnpm lint`
Expected: PASS / exit 0.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/components/ui/card.tsx apps/mobile/__tests__/components/ui/card.test.tsx packages/ui/src/components/card.tsx
git commit -m "feat(mobile): card subcomponents parity with @repo/ui, unified radius"
```

### Task 6: Input — variants error/success côté DOM

**Files:**
- Modify: `packages/ui/src/components/input.tsx`

**Interfaces:**
- Produces: DOM `Input` accepte `variant?: "default" | "error" | "success"` (mêmes noms que RN) ; rayon aligné `rounded-lg`. RN `Input` inchangé (déjà le plus riche).

- [ ] **Step 1: Implement (pas de runner de tests dans `packages/ui` — validation par typecheck/lint + usage landing)**

Replace `packages/ui/src/components/input.tsx` entièrement par :

```tsx
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/utils";

const inputVariants = cva(
  "flex h-10 w-full rounded-lg border bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "border-input focus-visible:ring-ring",
        error: "border-destructive focus-visible:ring-destructive",
        success: "border-success focus-visible:ring-success",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export type InputProps = React.ComponentProps<"input"> & VariantProps<typeof inputVariants>;

function Input({ className, variant, type, ...props }: InputProps) {
  return (
    <input type={type} className={cn(inputVariants({ variant }), className)} {...props} />
  );
}

export { Input, inputVariants };
```

- [ ] **Step 2: Validate**

Run: `cd packages/ui && pnpm typecheck && pnpm lint`
Run: `cd apps/landing && pnpm typecheck && pnpm lint && cd ../web && pnpm typecheck`
Expected: exit 0 (aucun appel existant ne passe `variant`, defaultVariants couvre).

- [ ] **Step 3: Commit**

```bash
git add packages/ui/src/components/input.tsx
git commit -m "feat(landing): input error/success variants parity with mobile"
```

### Task 7: Avatar (sizes DOM) + Skeleton (motion tokens RN)

**Files:**
- Modify: `packages/ui/src/components/avatar.tsx`
- Modify: `apps/mobile/src/components/ui/skeleton.tsx`

**Interfaces:**
- Consumes: `motionDurations` de `@repo/tokens` (Task 1).
- Produces: DOM `Avatar` accepte `size?: "sm" | "md" | "lg" | "xl"` (mêmes tailles que RN : 32/40/48/64) ; RN `Skeleton` pulse via `motionDurations.pulse` (cycle 2 s = `animate-pulse` web) et rayon par défaut via classe `rounded-md`.

- [ ] **Step 1: Implement Avatar DOM**

In `packages/ui/src/components/avatar.tsx`, remplacer la fonction `Avatar` et ajouter le cva (imports : ajouter `import { cva, type VariantProps } from "class-variance-authority";`) :

```tsx
const avatarVariants = cva("relative flex shrink-0 overflow-hidden rounded-full", {
  variants: {
    size: {
      sm: "h-8 w-8",
      md: "h-10 w-10",
      lg: "h-12 w-12",
      xl: "h-16 w-16",
    },
  },
  defaultVariants: {
    size: "md",
  },
});

function Avatar({
  className,
  size,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Root> & VariantProps<typeof avatarVariants>) {
  return (
    <AvatarPrimitive.Root className={cn(avatarVariants({ size }), className)} {...props} />
  );
}
```

(export inchangé : `export { Avatar, AvatarImage, AvatarFallback };`)

- [ ] **Step 2: Implement Skeleton RN**

In `apps/mobile/src/components/ui/skeleton.tsx` :
- ajouter `import { motionDurations } from '@repo/tokens';`
- remplacer les deux `{ duration: 750 }` par `{ duration: motionDurations.pulse }`
- supprimer le paramètre `borderRadius = 8` (garder `borderRadius?: number` en override) et ajouter `rounded-md` à la classe : `className={cn('rounded-md bg-muted', className)}` — le style inline `borderRadius` ne s'applique que si fourni :

```tsx
      style={[
        { width, height },
        borderRadius !== undefined ? { borderRadius } : null,
        animatedStyle,
        style,
      ]}
```

- [ ] **Step 3: Validate**

Run: `cd packages/ui && pnpm typecheck && pnpm lint`
Run: `cd apps/mobile && pnpm typecheck && pnpm lint && pnpm test`
Run: `cd apps/landing && pnpm typecheck && pnpm lint`
Expected: exit 0 partout (usages existants de Skeleton sans `borderRadius` : rendu passe de 8 px à 10 px `rounded-md` — aligné web, voulu).

- [ ] **Step 4: Commit**

```bash
git add packages/ui/src/components/avatar.tsx apps/mobile/src/components/ui/skeleton.tsx
git commit -m "feat(mobile): avatar size parity and skeleton on motion tokens"
```

*(Fin du lot B → PR `feat/design-system-parity` vers `main`, merge commit.)*

---

## Validation finale (avant chaque PR)

- `pnpm typecheck && pnpm lint` (racine, turbo — zéro warning)
- `cd packages/tokens && bun test`
- `cd apps/mobile && pnpm test`
- Revue : superpowers:requesting-code-review (spec-reviewer puis code-reviewer), findings corrigés avant merge.
