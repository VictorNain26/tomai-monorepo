# Charte « Cahier annoté » et refonte de la landing — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer la charte `@repo/tokens` par la direction « Cahier annoté » et réécrire la landing dessus.

**Architecture:** Deux PR. L1 change la charte partagée (tokens, fontes, `Button`, règles) sans toucher aux sections. L2 réécrit la landing : primitives d'annotation (`motion`), sections, metadata et OG image. Seul point de contact serveur inchangé : `joinWaitlist`.

**Tech Stack:** Next.js 16.3 (App Router), Tailwind v4 (`@theme`), `motion` 13.4, `next-themes`, `@repo/ui` (shadcn), `next/font/google`, `next/og`, `node --test` pour les tokens.

**Spec:** `docs/superpowers/specs/2026-09-22-landing-cahier-annote-design.md`

## Global Constraints

- Worktree : `/home/ordiv/projets/tomai-monorepo/.claude/worktrees/landing-cahier-annote`. Toute commande git s'écrit `git -C <worktree> …` (le wrapper `rtk` bloque git dans une session worktree isolée).
- L1 sur la branche `feat/landing-cahier-annote` (déjà créée, spec commitée) ; L2 sur `feat/landing-cahier-annote-pages`, créée depuis `main` après le merge de L1.
- Aucune couleur, durée ou rayon littéral dans les composants : classes issues des tokens. Exceptions nommées : valeurs animées posées par `motion` dans `style`, et `app/opengraph-image.tsx`.
- Primitives interactives (bouton, champ, dialog, menu) via `@repo/ui` ; composants de composition libres.
- Cibles tactiles ≥ 44 px (`h-11`), focus visible, contraste AA ≥ 4,5:1.
- Toute animation affiche son état final sous `prefers-reduced-motion`.
- Aucun fichier au-delà de ~400 lignes. Aucun commentaire sauf WHY non évident.
- Périmètre annoncé : collège, 6e → 3e. Nom : `BRAND_NAME = "TomIA"`, constante unique.
- Pas de promesse absente des specs V1 : pas de « 10 matières », pas de ville d'hébergement (décision d'hébergement ouverte, lot 3), pas d'affirmation sur l'entraînement des modèles.
- Validation avant chaque commit : `pnpm --filter landing typecheck`, `pnpm --filter landing lint`, et pour L1 `pnpm --filter @repo/tokens test` et `pnpm --filter @repo/ui typecheck`. Codes de sortie lus (rediriger vers un fichier, pas `| tail`).
- Commits : `<type>(landing|ui|tokens): …` en anglais, fichiers stagés un par un, pied `Co-Authored-By: Claude <noreply@anthropic.com>`.
- Merge commit uniquement.

## Review Focus

1. **Reduced motion ou JS absent** : le titre du hero doit se lire « Il aide à la comprendre » (le mot barré est `aria-hidden`) et les tracés doivent être visibles en entier, pas figés à `pathLength: 0`. Vérifié en Task 13 (émulation `prefers-reduced-motion`).
2. **Largeur 375 px** : titre Fraunces géant, démo de chat et notes en marge sans scroll horizontal. Vérifié en Task 13 (`document.documentElement.scrollWidth === 375`).
3. **Email invalide saisi puis champ quitté** : message d'erreur au blur, sans appel serveur ; serveur éteint → message « Erreur de connexion au serveur ». Vérifié en Task 7 et Task 13.
4. **Dark mode** : surligneur, bloc CTA encre et annotations lisibles ; aucune couleur claire codée en dur. Vérifié en Task 6 (captures dark) et Task 13.
5. **Clavier** : menu mobile, bascule de thème, accordéon FAQ et formulaire atteignables au Tab avec un anneau de focus terracotta visible sur fond papier et encre. Vérifié en Task 13.

---

# PR L1 — Charte

### Task 1: Test de contraste des tokens

**Files:**
- Create: `packages/tokens/contrast.test.mjs`
- Modify: `packages/tokens/package.json`

**Interfaces:**
- Produces: script `pnpm --filter @repo/tokens test` (`node --test`), exécuté par `turbo run test` en CI et en pre-push.

- [ ] **Step 1: Écrire le test**

`packages/tokens/contrast.test.mjs` :

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (file) => readFileSync(new URL(file, import.meta.url), "utf8");
const colors = (css) =>
  Object.fromEntries(
    [...css.matchAll(/--color-([a-z-]+):\s*(#[0-9A-Fa-f]{6})/g)].map(([, name, hex]) => [name, hex]),
  );

const light = colors(read("./theme.css"));
const dark = { ...light, ...colors(read("./theme-dark.css")) };

function luminance(hex) {
  const channel = (i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const PAIRS = [
  ["foreground", "background"],
  ["foreground", "card"],
  ["foreground", "secondary"],
  ["foreground", "highlight"],
  ["card-foreground", "card"],
  ["popover-foreground", "popover"],
  ["secondary-foreground", "secondary"],
  ["accent-foreground", "accent"],
  ["muted-foreground", "background"],
  ["muted-foreground", "card"],
  ["muted-foreground", "secondary"],
  ["primary", "background"],
  ["primary", "card"],
  ["primary", "secondary"],
  ["primary-foreground", "primary"],
  ["success-foreground", "success"],
  ["destructive-foreground", "destructive"],
  ["warning-foreground", "warning"],
  ["info-foreground", "info"],
  ["violet-foreground", "violet"],
  ["success", "background"],
  ["destructive", "background"],
  ["info", "background"],
];

for (const [theme, palette] of [["light", light], ["dark", dark]]) {
  for (const [fg, bg] of PAIRS) {
    test(`${theme}: ${fg} on ${bg} meets WCAG AA (4.5:1)`, () => {
      assert.ok(palette[fg], `missing --color-${fg}`);
      assert.ok(palette[bg], `missing --color-${bg}`);
      const ratio = contrast(palette[fg], palette[bg]);
      assert.ok(ratio >= 4.5, `${palette[fg]} on ${palette[bg]} = ${ratio.toFixed(2)}`);
    });
  }
}
```

`packages/tokens/package.json` : ajouter `"scripts": { "test": "node --test" }` après `"private": true,`.

- [ ] **Step 2: Lancer le test, il doit échouer**

Run: `pnpm --filter @repo/tokens test > /tmp/tokens-test.log 2>&1; echo "exit=$?"; grep -E "^# (pass|fail)|not ok" /tmp/tokens-test.log | head`
Expected: `exit=1`, échecs `missing --color-highlight` (le token n'existe pas encore).

- [ ] **Step 3: Pas de commit à ce stade** — le test rouge part avec la Task 2.

### Task 2: Palette, fontes et rayons dans `@repo/tokens`

**Files:**
- Modify: `packages/tokens/theme.css` (réécriture complète)
- Modify: `packages/tokens/theme-dark.css` (réécriture complète)

**Interfaces:**
- Consumes: le test de la Task 1.
- Produces: tokens `--color-highlight`, `--font-heading` / `--font-sans` reliés aux variables next/font `--font-fraunces` et `--font-figtree` (à poser sur `<html>`, Task 3), `--radius-*` +4 px.

- [ ] **Step 1: Réécrire `theme.css`**

```css
/* @repo/tokens — source unique de vérité des tokens de marque (light).
 * Consommé en CSS par les apps Tailwind v4 via :
 *   @import "@repo/tokens/theme.css";
 * Importer APRÈS l'import de Tailwind de l'app.
 * Dark mode : theme-dark.css (classe .dark).
 * Contrastes AA vérifiés par contrast.test.mjs. */

/* inline : les variables next/font sont posées sur <html> par l'app ; sans
 * inline, la fonte se résoudrait là où le token est défini. */
@theme inline {
  --font-sans: var(--font-figtree), ui-sans-serif, system-ui, sans-serif;
  --font-heading: var(--font-fraunces), ui-serif, Georgia, serif;
  --font-mono: 'JetBrains Mono', ui-monospace, monospace;
}

@theme {
  /* Rayons */
  --radius: 1rem;
  --radius-2xl: 20px;
  --radius-xl: 18px;
  --radius-lg: 16px;
  --radius-md: 14px;
  --radius-sm: 12px;
  --radius-xs: 10px;

  /* Espacements additionnels */
  --spacing-18: 4.5rem;
  --spacing-22: 5.5rem;

  /* Tailles de texte */
  --text-2xs: 0.625rem;
  --text-2xs--line-height: 0.875rem;

  /* Couleurs sémantiques (light) — « Cahier annoté » : papier, encre, stylo terracotta */
  --color-background: #FAF7F0;
  --color-foreground: #1C2340;
  --color-primary: #B0421A;
  --color-primary-foreground: #FFFFFF;
  --color-secondary: #F0EADD;
  --color-secondary-foreground: #1C2340;
  --color-muted: #F0EADD;
  --color-muted-foreground: #5B6178;
  --color-accent: #F0EADD;
  --color-accent-foreground: #1C2340;
  --color-card: #FFFDF8;
  --color-card-foreground: #1C2340;
  --color-popover: #FFFDF8;
  --color-popover-foreground: #1C2340;
  --color-destructive: #B42318;
  --color-destructive-foreground: #FFFFFF;
  --color-success: #3F6B4E;
  --color-success-foreground: #FFFFFF;
  --color-warning: #E0A43A;
  --color-warning-foreground: #1C2340;
  --color-info: #2B5C8A;
  --color-info-foreground: #FFFFFF;
  --color-highlight: #F9E08B;
  --color-border: #E7E0D2;
  --color-input: #E7E0D2;
  --color-ring: #B0421A;
  --color-violet: #6D3FC0;
  --color-violet-foreground: #FFFFFF;
  --color-overlay: #000000;

  /* Motion — fast: micro-feedback (press, toggle) ; base: transitions
   * standard ; slow: entrées d'écran ; pulse: demi-cycle skeleton. */
  --duration-fast: 150ms;
  --duration-base: 250ms;
  --duration-slow: 400ms;
  --duration-pulse: 1000ms;
}
```

- [ ] **Step 2: Réécrire `theme-dark.css`**

```css
/* @repo/tokens — overrides dark, classe .dark (next-themes).
 * « Cahier annoté » : fond encre, texte papier ; les foregrounds de statut
 * passent à l'encre pour tenir l'AA sur des teintes claires. */
.dark {
  --color-background: #12162B;
  --color-foreground: #F3EEE3;
  --color-primary: #F08A5D;
  --color-primary-foreground: #12162B;
  --color-secondary: #232846;
  --color-secondary-foreground: #F3EEE3;
  --color-muted: #232846;
  --color-muted-foreground: #A3A9BF;
  --color-accent: #232846;
  --color-accent-foreground: #F3EEE3;
  --color-card: #1A1F38;
  --color-card-foreground: #F3EEE3;
  --color-popover: #1A1F38;
  --color-popover-foreground: #F3EEE3;
  --color-destructive: #F2876F;
  --color-destructive-foreground: #12162B;
  --color-success: #8CC09C;
  --color-success-foreground: #12162B;
  --color-warning: #F2C063;
  --color-warning-foreground: #12162B;
  --color-info: #7FB2E0;
  --color-info-foreground: #12162B;
  --color-highlight: #5C4A12;
  --color-border: #2A3050;
  --color-input: #2A3050;
  --color-ring: #F08A5D;
  --color-violet: #A98BEA;
  --color-violet-foreground: #12162B;
  --color-overlay: #000000;
}
```

- [ ] **Step 3: Lancer le test, il doit passer**

Run: `pnpm --filter @repo/tokens test > /tmp/tokens-test.log 2>&1; echo "exit=$?"; grep -E "^# (pass|fail)" /tmp/tokens-test.log`
Expected: `exit=0`, `# pass 46`, `# fail 0`.

- [ ] **Step 4: Commit**

```bash
W=/home/ordiv/projets/tomai-monorepo/.claude/worktrees/landing-cahier-annote
git -C $W add packages/tokens/contrast.test.mjs
git -C $W add packages/tokens/package.json
git -C $W add packages/tokens/theme.css
git -C $W add packages/tokens/theme-dark.css
git -C $W commit -m "feat(tokens): switch to the Cahier annoté palette" -m "Paper, ink and terracotta palette with a highlight token, Fraunces/Figtree font tokens wired through @theme inline, radii +4px. A node:test checks every text/background pair against WCAG AA.

@theme inline: https://tailwindcss.com/docs/theme#referencing-other-variables

Co-Authored-By: Claude <noreply@anthropic.com>"
```

### Task 3: Fontes et CSS global de la landing

**Files:**
- Modify: `apps/landing/app/layout.tsx:1-20` (imports et fontes), `:124` (`<html>` / `<body>`)
- Modify: `apps/landing/app/globals.css` (réécriture complète)
- Delete: `apps/landing/app/fonts/GeistVF.woff`, `apps/landing/app/fonts/GeistMonoVF.woff`

**Interfaces:**
- Consumes: tokens `--font-heading`, `--font-sans` (Task 2).
- Produces: variables `--font-fraunces`, `--font-figtree` sur `<html>` ; utilitaire `bg-notebook` (consommé par la Task 6).

- [ ] **Step 1: Remplacer les fontes dans `layout.tsx`**

Remplacer les lignes 2 et 10-20 :

```tsx
import { Figtree, Fraunces } from "next/font/google";
```

```tsx
const fraunces = Fraunces({
  subsets: ["latin"],
  display: "swap",
  axes: ["SOFT", "opsz"],
  variable: "--font-fraunces",
});

const figtree = Figtree({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-figtree",
});
```

Remplacer `<html lang="fr" suppressHydrationWarning>` et `<body className={`${inter.variable} ${jakarta.variable}`}>` par :

```tsx
    <html lang="fr" suppressHydrationWarning className={`${fraunces.variable} ${figtree.variable}`}>
      <body>
```

- [ ] **Step 2: Réécrire `globals.css`**

```css
@import "tailwindcss";
@import "@repo/tokens/theme.css";
@import "@repo/tokens/theme-dark.css";
@source "../../../packages/ui/src";

@custom-variant dark (&:where(.dark, .dark *));

@utility bg-notebook {
  background-image:
    repeating-linear-gradient(90deg, color-mix(in srgb, var(--color-foreground) 6%, transparent) 0 1px, transparent 1px calc(var(--spacing) * 8)),
    repeating-linear-gradient(0deg, color-mix(in srgb, var(--color-foreground) 6%, transparent) 0 1px, transparent 1px calc(var(--spacing) * 8));
  mask-image: radial-gradient(ellipse 80% 70% at 50% 30%, black 30%, transparent 100%);
}

* {
  @apply border-border;
}

body {
  @apply bg-background font-sans text-foreground antialiased;
}

h1, h2, h3, h4, h5, h6 {
  @apply font-heading tracking-tight;
}

html {
  scroll-behavior: smooth;
}

*:focus-visible {
  @apply outline-none ring-2 ring-ring ring-offset-2 ring-offset-background;
}

.container {
  @apply mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8;
}

::selection {
  @apply bg-highlight text-foreground;
}

@layer base {
  button:not(:disabled),
  [role="button"]:not(:disabled) {
    cursor: pointer;
  }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

La scrollbar custom disparaît (couleurs primary codées en `color-mix`, sans valeur pour la charte).

- [ ] **Step 3: Supprimer les fontes Geist inutilisées**

```bash
W=/home/ordiv/projets/tomai-monorepo/.claude/worktrees/landing-cahier-annote
grep -rn "Geist" $W/apps/landing --include=*.ts --include=*.tsx --include=*.css; echo "grep exit=$? (1 attendu : aucune référence)"
git -C $W rm apps/landing/app/fonts/GeistVF.woff apps/landing/app/fonts/GeistMonoVF.woff
```

- [ ] **Step 4: Valider**

Run (depuis le worktree) : `pnpm install > /tmp/install.log 2>&1; echo "install=$?"` puis
`pnpm --filter landing typecheck > /tmp/tc.log 2>&1; echo "tc=$?"; pnpm --filter landing lint > /tmp/lint.log 2>&1; echo "lint=$?"; pnpm --filter landing build > /tmp/build.log 2>&1; echo "build=$?"`
Expected: `install=0 tc=0 lint=0 build=0`.

- [ ] **Step 5: Commit**

```bash
git -C $W add apps/landing/app/layout.tsx
git -C $W add apps/landing/app/globals.css
git -C $W commit -m "feat(landing): load Fraunces and Figtree, notebook grid utility" -m "Fonts come from next/font/google (axes SOFT and opsz for Fraunces), exposed on <html> so the @repo/tokens font tokens resolve. Unused Geist files removed.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

### Task 4: `Button` en pilule, cibles 44 px, règles mises à jour

**Files:**
- Modify: `packages/ui/src/components/button.tsx:22-28` (bloc `size`)
- Modify: `.claude/rules/design-system.md:25` et ajout d'une section
- Modify: `apps/landing/CLAUDE.md` (section Contraintes)

**Interfaces:**
- Produces: `Button` sizes `default | sm | lg | xl | icon`, toutes `rounded-full`, hauteur ≥ `h-11`.

- [ ] **Step 1: Remplacer le bloc `size` de `buttonVariants`**

```ts
      size: {
        default: "h-11 px-6 text-sm rounded-full",
        sm: "h-11 px-4 text-sm rounded-full",
        lg: "h-12 px-8 text-base rounded-full [&_svg]:size-5",
        xl: "h-14 px-10 text-lg rounded-full [&_svg]:size-6",
        icon: "size-11 rounded-full",
      },
```

Dans le variant `premium`, remplacer `bg-gradient-to-r from-primary to-violet text-white` par `bg-gradient-to-r from-primary to-violet text-primary-foreground` (texte blanc codé en dur, faux en dark où primary-foreground est l'encre).

- [ ] **Step 2: Mettre à jour `.claude/rules/design-system.md`**

Remplacer la ligne `- **Typo** : Poppins titres, Nunito Sans corps, JetBrains Mono code.` par :

```markdown
- **Typo** : Fraunces titres, Figtree corps, JetBrains Mono code.
- **Exceptions au « tokens uniquement »** : les valeurs que `motion` anime
  lui-même dans `style`, et les images `next/og` (`ImageResponse` ne lit que
  `style`, sans variables CSS). Rien d'autre.
```

- [ ] **Step 3: Mettre à jour `apps/landing/CLAUDE.md`**

Remplacer les deux puces :

```markdown
- **Aucun composant UI custom** : passer par shadcn (`@/components/ui/`).
- **Aucun CSS custom ni style inline** : Tailwind et les tokens `@repo/tokens`.
```

par :

```markdown
- **Primitives interactives via `@repo/ui`** (bouton, champ, dialog, menu) : c'est
  là que vit leur accessibilité. Sections, annotations et démo sont des composants
  de composition, libres.
- **Tokens uniquement** : Tailwind et `@repo/tokens`, aucune valeur de style écrite
  à la main. Exceptions : valeurs animées par `motion`, et `app/opengraph-image.tsx`
  (`ImageResponse` ne lit que `style`).
```

- [ ] **Step 4: Valider**

Run: `pnpm --filter @repo/ui typecheck > /tmp/ui.log 2>&1; echo "ui=$?"; pnpm --filter @repo/ui lint > /tmp/uil.log 2>&1; echo "uilint=$?"; pnpm --filter landing build > /tmp/build.log 2>&1; echo "build=$?"`
Expected: `ui=0 uilint=0 build=0`.

- [ ] **Step 5: Commit**

```bash
git -C $W add packages/ui/src/components/button.tsx
git -C $W add .claude/rules/design-system.md
git -C $W add apps/landing/CLAUDE.md
git -C $W commit -m "feat(ui): pill buttons with 44px targets, rules follow the new brand" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

### Task 5: Preuve visuelle et PR L1

**Files:**
- Modify: `docs/superpowers/suivi.md` (ligne « hors lot 0 » et journal)

- [ ] **Step 1: Lancer la landing** : `pnpm --filter landing dev` en arrière-plan, attendre `Ready` sur `:3001`.
- [ ] **Step 2: Captures Chrome** (skill `claude-in-chrome`) : `/` en 1440 px et 375 px, clair puis sombre (bouton de thème). Attendu : fond papier / encre, boutons pilule terracotta, titres en Fraunces, texte en Figtree (vérifier `getComputedStyle(document.querySelector('h1')).fontFamily` contient `Fraunces`). Les sections gardent leur ancienne mise en page : c'est attendu, L2 les remplace.
- [ ] **Step 3: Mettre à jour `suivi.md`** : sous le tableau « Lot 0 — PR », ajouter :

```markdown
## Hors lot 0

| PR | Plan | Branche | Statut | Lien |
|---|---|---|---|---|
| L1 — Charte « Cahier annoté » | `plans/2026-09-22-landing-cahier-annote.md`, tâches 1-5 | `feat/landing-cahier-annote` | ouverte | — |
| L2 — Refonte de la landing | même plan, tâches 6-13 | `feat/landing-cahier-annote-pages` | à faire | — |
```

et une entrée au journal datée. Commit `docs: track the brand refresh PRs`.
- [ ] **Step 4: Push et PR** : `git -C $W push -u origin feat/landing-cahier-annote`, puis `gh pr create --base main --title "feat(tokens): Cahier annoté brand" --body` (résumé, lien spec, captures, sortie des validations, `Generated with Claude Code`). Reporter le numéro dans `suivi.md` (commit + push).
- [ ] **Step 5: Vérifier la preview Vercel** et les checks requis ; merge commit après accord de l'utilisateur (via `gh api -X PUT repos/{owner}/{repo}/pulls/<n>/merge -f merge_method=merge`).

---

# PR L2 — Landing

Préalable : L1 mergée. `git -C /home/ordiv/projets/tomai-monorepo fetch origin main`, puis dans le worktree `git -C $W switch -c feat/landing-cahier-annote-pages origin/main`.

### Task 6: Socle — marque, motion, grille, header, footer

**Files:**
- Create: `apps/landing/lib/brand.ts`
- Create: `apps/landing/lib/motion.ts`
- Create: `apps/landing/components/motion-provider.tsx`
- Modify: `apps/landing/components/atoms/logo.tsx` (réécriture)
- Modify: `apps/landing/app/layout.tsx` (grille, provider, metadata avec `BRAND_NAME`)
- Modify: `apps/landing/components/layout/header.tsx`
- Modify: `apps/landing/components/layout/footer.tsx`
- Modify: `apps/landing/components/molecules/nav-links.tsx:10-15`
- Delete: `apps/landing/components/atoms/background-pattern.tsx`

**Interfaces:**
- Produces: `BRAND_NAME: "TomIA"` ; `DRAW_SECONDS = 0.8`, `REVEAL_SECONDS = 0.5` ; `<MotionProvider>` ; ancres de section `#how-it-works`, `#parents`, `#pricing`, `#faq`, `#waitlist` (les sections des Tasks 8-11 portent ces `id`).

- [ ] **Step 1: Constantes**

`apps/landing/lib/brand.ts` :

```ts
export const BRAND_NAME = "TomIA";
```

`apps/landing/lib/motion.ts` :

```ts
// motion prend ses durées en secondes côté JS et ne lit pas les variables CSS.
export const DRAW_SECONDS = 0.8;
export const REVEAL_SECONDS = 0.5;
```

- [ ] **Step 2: Provider motion**

`apps/landing/components/motion-provider.tsx` :

```tsx
"use client";

import { MotionConfig } from "motion/react";

export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
```

- [ ] **Step 3: Wordmark**

`apps/landing/components/atoms/logo.tsx` :

```tsx
import Link from "next/link";
import { cn } from "@repo/ui";
import { BRAND_NAME } from "@/lib/brand";

export function Logo({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      aria-label={`${BRAND_NAME} - Accueil`}
      className={cn(
        "font-heading text-2xl font-semibold tracking-tight text-foreground transition-opacity duration-base hover:opacity-80",
        className,
      )}
    >
      {BRAND_NAME}
      <span className="text-primary">.</span>
    </Link>
  );
}
```

- [ ] **Step 4: Layout**

Dans `app/layout.tsx` : importer `BRAND_NAME` et `MotionProvider`, supprimer l'import de `BackgroundPattern`. Remplacer chaque littéral `"TomIA"` des metadata et du JSON-LD par `BRAND_NAME` (template : `` `%s | ${BRAND_NAME}` ``). Réécrire les textes :

```ts
const TITLE = `${BRAND_NAME} - Le tuteur qui ne donne pas la réponse`;
const DESCRIPTION =
  "Assistant scolaire pour collégiens, de la 6e à la 3e. Tom guide votre enfant par des questions, à la manière d'un bon professeur, et vous tient informé sans lire ses conversations.";
```

Utiliser `TITLE` pour `title.default`, `openGraph.title`, `twitter.title` ; `DESCRIPTION` pour `description`, `openGraph.description`, `twitter.description` et la description du JSON-LD `SoftwareApplication`. Retirer `images` de `openGraph` (remplacé par `app/opengraph-image.tsx`, Task 12). Ajouter `"IA européenne"` et `"Mistral"` aux `keywords`.

Remplacer le bloc `<ThemeProvider>…</ThemeProvider>` par :

```tsx
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <MotionProvider>
            <div className="relative flex min-h-screen flex-col">
              <div aria-hidden="true" className="bg-notebook pointer-events-none fixed inset-0 -z-50" />
              <Header />
              <main id="main-content" className="flex-1">
                {children}
              </main>
              <Footer />
              <MobileCTABar />
            </div>
          </MotionProvider>
        </ThemeProvider>
```

Sur le lien d'évitement, remplacer `focus:rounded-md` par `focus:rounded-full`.

- [ ] **Step 5: Nav et header**

`nav-links.tsx`, tableau `LINKS` :

```ts
const LINKS = [
  { href: "/#how-it-works", label: "Comment ça marche" },
  { href: "/#parents", label: "Parents" },
  { href: "/#pricing", label: "Tarifs" },
  { href: "/#faq", label: "FAQ" },
];
```

Dans le même fichier, remplacer `transition-colors` par `transition-colors duration-base` et, en vertical, `block py-2` par `flex min-h-11 items-center`.

`header.tsx` :
- classe du `<header>` : remplacer le `cn(...)` par
  ```tsx
  className={cn(
    "sticky top-0 z-50 w-full border-b transition-colors duration-base",
    scrolled ? "border-border bg-background/90 backdrop-blur-md" : "border-transparent bg-background/70 backdrop-blur",
  )}
  ```
- retirer `className="rounded-full"` des deux `Button size="icon"` (le variant est déjà pilule) ;
- remplacer `transition-all duration-200 ease-in-out` du menu mobile par `transition-all duration-base ease-in-out`.

- [ ] **Step 6: Footer**

Dans `footer.tsx` :
- `border-t border-border bg-secondary/50` → `border-t border-border bg-secondary` ;
- lien `/#features` → `/#parents`, libellé `Parents` ;
- les icônes des badges passent de `text-primary` à `text-success` (confiance = sauge) ;
- `© {new Date().getFullYear()} TomIA.` → `© {new Date().getFullYear()} {BRAND_NAME}.` (import de `@/lib/brand`) ;
- `transition-colors` → `transition-colors duration-base` sur chaque lien.

- [ ] **Step 7: Supprimer le motif de fond**

`git -C $W rm apps/landing/components/atoms/background-pattern.tsx`

- [ ] **Step 8: Valider et regarder**

Run: typecheck, lint, build de `landing` (codes de sortie lus). Puis `pnpm --filter landing dev` et capture Chrome 1440 px clair et sombre : wordmark « TomIA. » en Fraunces, grille de cahier discrète, header translucide. Le contenu des sections est encore l'ancien.

- [ ] **Step 9: Commit**

Fichiers stagés un par un (`lib/brand.ts`, `lib/motion.ts`, `components/motion-provider.tsx`, `components/atoms/logo.tsx`, `app/layout.tsx`, `components/layout/header.tsx`, `components/layout/footer.tsx`, `components/molecules/nav-links.tsx`), message `feat(landing): wordmark, notebook grid and motion policy`.

### Task 7: Primitives d'annotation et formulaire

**Files:**
- Create: `apps/landing/components/annotations/scribble.tsx`
- Create: `apps/landing/components/annotations/highlight.tsx`
- Create: `apps/landing/components/annotations/margin-note.tsx`
- Modify: `apps/landing/components/molecules/waitlist-form.tsx` (réécriture)

**Interfaces:**
- Consumes: `DRAW_SECONDS` (Task 6).
- Produces:
  - `Scribble({ kind: "underline" | "strike" | "circle"; delay?: number; className?: string; children: ReactNode })`
  - `Highlight({ children: ReactNode })`
  - `MarginNote({ children: ReactNode; className?: string })`
  - `WaitlistForm({ source: string; className?: string; buttonText?: string; tone?: "default" | "inverted" })`

- [ ] **Step 1: `scribble.tsx`**

```tsx
"use client";

import { motion, useReducedMotion } from "motion/react";
import { cn } from "@repo/ui";
import { DRAW_SECONDS } from "@/lib/motion";

const SHAPES = {
  underline: {
    viewBox: "0 0 200 12",
    d: "M2 8 C 50 2, 120 12, 198 5",
    position: "-bottom-2 left-0 h-3 w-full",
  },
  strike: {
    viewBox: "0 0 200 20",
    d: "M2 12 C 60 6, 140 16, 198 8",
    position: "left-0 top-1/2 h-5 w-full -translate-y-1/2",
  },
  circle: {
    viewBox: "0 0 200 80",
    d: "M100 4 C 170 2, 198 30, 190 50 C 180 76, 40 80, 12 56 C -6 36, 30 6, 110 8",
    position: "-inset-x-3 -inset-y-2",
  },
} as const;

export type ScribbleKind = keyof typeof SHAPES;

export function Scribble({
  kind,
  delay = 0,
  className,
  children,
}: {
  kind: ScribbleKind;
  delay?: number;
  className?: string;
  children: React.ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  const shape = SHAPES[kind];

  return (
    <span className={cn("relative inline-block", className)}>
      {children}
      <svg
        aria-hidden="true"
        viewBox={shape.viewBox}
        preserveAspectRatio="none"
        fill="none"
        className={cn("pointer-events-none absolute overflow-visible text-primary", shape.position)}
      >
        <motion.path
          d={shape.d}
          stroke="currentColor"
          strokeWidth={3}
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          initial={reduceMotion ? false : { pathLength: 0 }}
          whileInView={{ pathLength: 1 }}
          viewport={{ once: true }}
          transition={{ duration: DRAW_SECONDS, delay, ease: "easeInOut" }}
        />
      </svg>
    </span>
  );
}
```

`initial={false}` (doc motion : l'élément démarre sur sa cible) garantit le trait entier sous reduced motion ; `MotionConfig` ne coupe pas `pathLength`, qui n'est pas une transformation ([doc](https://motion.dev/docs/react-accessibility)).

- [ ] **Step 2: `highlight.tsx`**

```tsx
export function Highlight({ children }: { children: React.ReactNode }) {
  return (
    <span className="box-decoration-clone rounded-xs bg-highlight px-1 text-foreground">{children}</span>
  );
}
```

- [ ] **Step 3: `margin-note.tsx`**

```tsx
import { cn } from "@repo/ui";

export function MarginNote({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn("-rotate-2 font-heading text-lg italic text-primary", className)}>{children}</p>
  );
}
```

- [ ] **Step 4: `waitlist-form.tsx`** — passage à `Input` de `@repo/ui`, validation au blur, variante inversée pour le bloc encre

```tsx
"use client";

import { useState, useTransition } from "react";
import { ArrowRight, CheckCircle2, Info, Loader2 } from "lucide-react";
import { Button, Input, cn } from "@repo/ui";
import { joinWaitlist } from "@/lib/actions/waitlist";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface WaitlistFormProps {
  source: string;
  className?: string;
  buttonText?: string;
  tone?: "default" | "inverted";
}

export function WaitlistForm({
  source,
  className,
  buttonText = "Rejoindre la liste d'attente",
  tone = "default",
}: WaitlistFormProps) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "success" | "already" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [isPending, startTransition] = useTransition();
  const inputId = `waitlist-email-${source}`;
  const errorId = `waitlist-error-${source}`;

  if (status === "success" || status === "already") {
    const Icon = status === "success" ? CheckCircle2 : Info;
    return (
      <div role="status" aria-live="polite" className={cn("flex items-center gap-2 font-medium", className)}>
        <Icon className="size-5 shrink-0 text-success" aria-hidden="true" />
        <span>
          {status === "success"
            ? "C'est noté, vous serez prévenu du lancement."
            : "Cet email est déjà inscrit, vous serez prévenu du lancement."}
        </span>
      </div>
    );
  }

  function showError(message: string) {
    setStatus("error");
    setErrorMsg(message);
  }

  function handleBlur() {
    if (email && !EMAIL_REGEX.test(email)) showError("Adresse email invalide");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("idle");
    setErrorMsg("");
    startTransition(async () => {
      const result = await joinWaitlist(email, source);
      if (!result.success) showError(result.error);
      else setStatus(result.alreadyExists ? "already" : "success");
    });
  }

  return (
    <form onSubmit={handleSubmit} noValidate className={cn("flex flex-col gap-2", className)}>
      <div className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor={inputId} className="sr-only">
          Adresse e-mail
        </label>
        <Input
          id={inputId}
          type="email"
          required
          autoComplete="email"
          placeholder="votre@email.fr"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (status === "error") setStatus("idle");
          }}
          onBlur={handleBlur}
          variant={status === "error" ? "error" : "default"}
          aria-invalid={status === "error"}
          aria-describedby={status === "error" ? errorId : undefined}
          className={cn(
            "h-12 flex-1 rounded-full px-5 text-base",
            tone === "inverted" && "border-background/30 bg-background text-foreground",
          )}
        />
        <Button type="submit" size="lg" disabled={isPending} aria-busy={isPending} className="group">
          {isPending ? (
            <>
              <Loader2 className="animate-spin" aria-hidden="true" />
              <span className="sr-only">Envoi en cours</span>
            </>
          ) : (
            <>
              {buttonText}
              <ArrowRight className="transition-transform duration-base group-hover:translate-x-1" aria-hidden="true" />
            </>
          )}
        </Button>
      </div>
      {status === "error" && (
        <p id={errorId} role="alert" className={cn("text-sm", tone === "inverted" ? "text-background" : "text-destructive")}>
          {errorMsg}
        </p>
      )}
    </form>
  );
}
```

L'`id` suffixé par `source` corrige un doublon existant : le hero et le CTA rendaient tous deux `id="waitlist-email"` sur la même page. En variante inversée, l'erreur s'affiche en `text-background` (papier sur encre, 14,4:1) car `destructive` n'est pas vérifié sur fond `foreground`.

- [ ] **Step 5: Vérifier le formulaire à la main**

`pnpm --filter landing dev` (serveur API **éteint**). Dans Chrome sur `/` : taper `abc`, Tab → « Adresse email invalide » sous le champ, bordure destructive, aucune requête réseau (`read_network_requests` : pas de POST). Taper `test@example.com`, Entrée → « Erreur de connexion au serveur ». Puis `pnpm dev` à la racine (API sur :3000) et soumettre `plan-l2-<timestamp>@example.com` → message de succès ; resoumettre → « déjà inscrit ».

- [ ] **Step 6: Commit**

Stager les quatre fichiers un par un ; message `feat(landing): annotation primitives and blur-validated waitlist form`.

### Task 8: Hero et démo de conversation

**Files:**
- Create: `apps/landing/components/sections/chat-demo.tsx`
- Modify: `apps/landing/components/sections/hero.tsx` (réécriture)
- Delete: `apps/landing/components/atoms/rotating-text.tsx`

**Interfaces:**
- Consumes: `Scribble`, `MarginNote`, `WaitlistForm`, `REVEAL_SECONDS`.
- Produces: `Hero()`, `ChatDemo({ className?: string })`.

- [ ] **Step 1: `chat-demo.tsx`**

```tsx
"use client";

import { motion, useReducedMotion } from "motion/react";
import { cn } from "@repo/ui";
import { REVEAL_SECONDS } from "@/lib/motion";
import { MarginNote } from "../annotations/margin-note";

const MESSAGES = [
  { from: "student", text: "C'est quoi la réponse du 3b ? 3x + 5 = 20" },
  { from: "tom", text: "On la trouve ensemble. Si tu enlèves 5 des deux côtés, il te reste quoi ?" },
  { from: "student", text: "3x = 15" },
  { from: "tom", text: "Exactement. Et pour avoir x tout seul, tu fais quoi ?" },
] as const;

export function ChatDemo({ className }: { className?: string }) {
  const reduceMotion = useReducedMotion();

  return (
    <figure aria-label="Exemple de conversation entre un élève et Tom" className={cn("relative", className)}>
      <ol className="space-y-3 rounded-2xl border border-border bg-card p-5 shadow-sm">
        {MESSAGES.map((message, index) => (
          <motion.li
            key={index}
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: REVEAL_SECONDS, delay: 0.4 + index * 0.6 }}
            className={cn(
              "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
              message.from === "student"
                ? "ml-auto bg-secondary text-secondary-foreground"
                : "bg-primary text-primary-foreground",
            )}
          >
            <span className="sr-only">{message.from === "student" ? "L'élève : " : "Tom : "}</span>
            {message.text}
          </motion.li>
        ))}
      </ol>
      <MarginNote className="mt-4 text-right lg:absolute lg:-right-6 lg:top-24 lg:mt-0 lg:w-36 lg:translate-x-full lg:text-left">
        Une question plutôt qu&apos;une réponse : la méthode socratique.
      </MarginNote>
    </figure>
  );
}
```

`max-w-[85%]` est une proportion de mise en page, pas une valeur de charte.

- [ ] **Step 2: `hero.tsx`**

```tsx
"use client";

import { motion, useReducedMotion } from "motion/react";
import { GraduationCap, Landmark, ShieldCheck } from "lucide-react";
import { DRAW_SECONDS, REVEAL_SECONDS } from "@/lib/motion";
import { Scribble } from "../annotations/scribble";
import { WaitlistForm } from "../molecules/waitlist-form";
import { ChatDemo } from "./chat-demo";

const SIGNALS = [
  { icon: GraduationCap, label: "Collège, de la 6e à la 3e" },
  { icon: Landmark, label: "Hébergé dans l'Union européenne" },
  { icon: ShieldCheck, label: "Gratuit pour commencer" },
];

export function Hero() {
  const reduceMotion = useReducedMotion();

  return (
    <section className="py-16 lg:py-24">
      <div className="container grid items-center gap-16 lg:grid-cols-2">
        <div>
          <h1 className="text-5xl font-semibold leading-tight text-balance text-foreground sm:text-6xl xl:text-7xl">
            Il ne donne pas la réponse. Il aide à la{" "}
            <Scribble kind="strike" delay={0.3}>
              <span aria-hidden="true" className="text-muted-foreground">trouver</span>
            </Scribble>{" "}
            <motion.em
              initial={reduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: REVEAL_SECONDS, delay: 0.3 + DRAW_SECONDS }}
              className="text-primary"
            >
              comprendre
            </motion.em>
            .
          </h1>

          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground md:text-xl">
            Tom accompagne votre enfant dans ses devoirs comme un bon professeur : par des questions,
            à son niveau, jusqu&apos;à ce qu&apos;il trouve seul.
          </p>

          <WaitlistForm source="hero" className="mt-10 max-w-lg" />

          <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
            {SIGNALS.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-2">
                <Icon className="size-4 text-success" aria-hidden="true" />
                {label}
              </li>
            ))}
          </ul>
        </div>

        <ChatDemo className="mx-auto w-full max-w-md lg:mr-24" />
      </div>
    </section>
  );
}
```

Le nom accessible du `h1` se lit « Il ne donne pas la réponse. Il aide à la comprendre. » : « trouver » est `aria-hidden`.

- [ ] **Step 3: Supprimer `rotating-text.tsx`** : `git -C $W rm apps/landing/components/atoms/rotating-text.tsx`

- [ ] **Step 4: Valider et regarder** : typecheck, lint, build. Chrome 1440 px et 375 px : trait qui barre « trouver », puis « comprendre » en terracotta ; messages qui apparaissent l'un après l'autre ; note en marge à droite en desktop, sous la démo en mobile ; `document.documentElement.scrollWidth` égal à la largeur de fenêtre.

- [ ] **Step 5: Commit** : `chat-demo.tsx`, `hero.tsx` stagés un par un ; `feat(landing): hero with struck-through headline and Socratic chat demo`.

### Task 9: Problème, méthode, modes d'entrée

**Files:**
- Create: `apps/landing/components/sections/problem.tsx`
- Create: `apps/landing/components/sections/input-modes.tsx`
- Modify: `apps/landing/components/sections/how-it-works.tsx` (réécriture)
- Modify: `apps/landing/components/atoms/section-header.tsx` (réécriture)
- Delete: `apps/landing/components/sections/stats.tsx`, `apps/landing/components/sections/problem-solution.tsx`, `apps/landing/components/atoms/animated-counter.tsx`

**Interfaces:**
- Consumes: `Scribble`, `Highlight`, `FadeIn` (existant, `components/atoms/fade-in.tsx`).
- Produces: `Problem()`, `HowItWorks()` (section `id="how-it-works"`), `InputModes()`, `SectionHeader({ eyebrow?: string; title: ReactNode; description?: string; align?: "center" | "left"; className?: string })`.

- [ ] **Step 1: `section-header.tsx`**

```tsx
import { cn } from "@repo/ui";

interface SectionHeaderProps {
  eyebrow?: string;
  title: React.ReactNode;
  description?: string;
  align?: "center" | "left";
  className?: string;
}

export function SectionHeader({ eyebrow, title, description, align = "center", className }: SectionHeaderProps) {
  return (
    <div className={cn("mb-16 max-w-3xl", align === "center" ? "mx-auto text-center" : "text-left", className)}>
      {eyebrow && <p className="mb-3 font-heading text-lg italic text-primary">{eyebrow}</p>}
      <h2 className="text-4xl font-semibold text-balance text-foreground sm:text-5xl">{title}</h2>
      {description && <p className="mt-4 text-lg text-muted-foreground">{description}</p>}
    </div>
  );
}
```

`PageLayout` et `Pricing`/`FAQ` passent des `title` en string : compatibles.

- [ ] **Step 2: `problem.tsx`**

```tsx
import { FadeIn } from "../atoms/fade-in";
import { Scribble } from "../annotations/scribble";

export function Problem() {
  return (
    <section className="border-y border-border bg-secondary py-20">
      <FadeIn className="container max-w-4xl text-center">
        <p className="font-heading text-3xl font-medium leading-snug text-balance text-foreground sm:text-4xl">
          Copier une réponse prend dix secondes.{" "}
          <Scribble kind="underline">L&apos;oublier aussi.</Scribble>
        </p>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
          Les outils qui donnent la solution font gagner du temps ce soir et en font perdre le jour
          du contrôle. Ce qu&apos;on comprend soi-même, on le garde.
        </p>
      </FadeIn>
    </section>
  );
}
```

- [ ] **Step 3: `how-it-works.tsx`**

```tsx
import { FadeIn } from "../atoms/fade-in";
import { Scribble } from "../annotations/scribble";
import { Highlight } from "../annotations/highlight";
import { SectionHeader } from "../atoms/section-header";

const STEPS = [
  {
    title: "Il questionne",
    body: (
      <>
        Face à un exercice, Tom ne donne pas la solution. Il pose <Highlight>la question qui débloque</Highlight>, puis
        la suivante, et ne donne un indice plus précis que si votre enfant bloque vraiment.
      </>
    ),
  },
  {
    title: "Il s'adapte",
    body: (
      <>
        Vocabulaire, longueur des explications, notations : tout suit <Highlight>la classe de votre enfant</Highlight>,
        de la 6e à la 3e, et la matière travaillée.
      </>
    ),
  },
  {
    title: "Il fait réviser",
    body: (
      <>
        Ce qui a été compris devient des fiches, revues au bon moment grâce à <Highlight>la répétition espacée</Highlight>,
        pour que ça tienne jusqu&apos;au contrôle.
      </>
    ),
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-20 py-24 lg:py-32">
      <div className="container">
        <SectionHeader eyebrow="La méthode" title="Comment Tom guide votre enfant" />
        <ol className="mx-auto grid max-w-5xl gap-12 md:grid-cols-3">
          {STEPS.map((step, index) => (
            <li key={step.title} className="border-l-2 border-primary pl-6">
              <FadeIn delay={index * 0.15}>
                <Scribble kind="circle" className="mb-4 px-2 font-heading text-3xl text-primary" delay={0.2 + index * 0.15}>
                  {index + 1}
                </Scribble>
                <h3 className="mb-3 text-2xl font-semibold text-foreground">{step.title}</h3>
                <p className="leading-relaxed text-muted-foreground">{step.body}</p>
              </FadeIn>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
```

`FadeIn` rend un `div` : il enveloppe le contenu **à l'intérieur** du `li`, jamais le `li` (`ol > div > li` serait du HTML invalide).

- [ ] **Step 4: `input-modes.tsx`**

```tsx
import { Camera, Keyboard, Mic } from "lucide-react";
import { FadeIn } from "../atoms/fade-in";

const MODES = [
  { icon: Camera, title: "Une photo", body: "de l'exercice, du manuel ou du cahier." },
  { icon: Mic, title: "La voix", body: "pour expliquer où ça coince, sans taper." },
  { icon: Keyboard, title: "Le clavier", body: "pour écrire sa réponse et la vérifier." },
];

export function InputModes() {
  return (
    <section className="pb-24 lg:pb-32">
      <FadeIn className="container max-w-5xl">
        <div className="grid gap-8 rounded-2xl border border-border bg-card p-8 sm:grid-cols-3 sm:p-10">
          {MODES.map(({ icon: Icon, title, body }) => (
            <div key={title} className="flex gap-4">
              <Icon className="mt-1 size-6 shrink-0 text-primary" aria-hidden="true" />
              <p className="text-muted-foreground">
                <span className="block font-heading text-xl font-semibold text-foreground">{title}</span>
                {body}
              </p>
            </div>
          ))}
        </div>
      </FadeIn>
    </section>
  );
}
```

- [ ] **Step 5: Supprimer les anciens composants**

```bash
git -C $W rm apps/landing/components/sections/stats.tsx apps/landing/components/sections/problem-solution.tsx apps/landing/components/atoms/animated-counter.tsx
```

`app/page.tsx` importe encore `Stats` et `ProblemSolution` : il est réécrit à la Task 11 ; d'ici là, retirer ces deux imports et leurs balises, et remplacer `<HowItWorks />` en place pour que le build reste vert.

- [ ] **Step 6: Valider** : typecheck, lint, build ; capture 1440 px et 375 px des trois sections, clair et sombre (surligneur lisible en dark).

- [ ] **Step 7: Commit** : fichiers un par un ; `feat(landing): problem, method and input modes sections`.

### Task 10: Parents et confiance

**Files:**
- Create: `apps/landing/components/sections/parents.tsx`
- Create: `apps/landing/components/sections/trust.tsx`
- Delete: `apps/landing/components/sections/features.tsx`

**Interfaces:**
- Consumes: `SectionHeader`, `Scribble`, `MarginNote`, `FadeIn`.
- Produces: `Parents()` (section `id="parents"`), `Trust()`.

- [ ] **Step 1: `parents.tsx`**

```tsx
import { BellRing, CalendarDays, EyeOff, LineChart } from "lucide-react";
import { FadeIn } from "../atoms/fade-in";
import { SectionHeader } from "../atoms/section-header";
import { Scribble } from "../annotations/scribble";

const POINTS = [
  { icon: LineChart, title: "Un résumé", body: "Matières travaillées, temps passé, notions qui résistent." },
  { icon: BellRing, title: "Des alertes", body: "Quand une difficulté revient, vous êtes prévenu." },
  { icon: CalendarDays, title: "Pronote", body: "Devoirs, notes et emploi du temps : Tom part de ce qui est vraiment à faire." },
  { icon: EyeOff, title: "Pas les conversations", body: "Votre enfant garde un espace à lui. Vous suivez ses progrès, pas ses messages." },
];

export function Parents() {
  return (
    <section id="parents" className="scroll-mt-20 bg-secondary py-24 lg:py-32">
      <div className="container">
        <SectionHeader
          eyebrow="Pour les parents"
          title={
            <>
              Vous savez où il en est, <Scribble kind="underline">sans lire par-dessus son épaule</Scribble>
            </>
          }
        />
        <div className="mx-auto grid max-w-5xl gap-6 sm:grid-cols-2">
          {POINTS.map(({ icon: Icon, title, body }, index) => (
            <FadeIn key={title} delay={index * 0.1}>
              <div className="flex h-full gap-4 rounded-2xl border border-border bg-card p-6">
                <Icon className="mt-1 size-6 shrink-0 text-primary" aria-hidden="true" />
                <div>
                  <h3 className="mb-1 text-xl font-semibold text-foreground">{title}</h3>
                  <p className="text-muted-foreground">{body}</p>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: `trust.tsx`**

```tsx
import { FadeIn } from "../atoms/fade-in";
import { MarginNote } from "../annotations/margin-note";
import { Highlight } from "../annotations/highlight";

const COMMITMENTS = [
  "Données hébergées dans l'Union européenne, traitées selon le RGPD.",
  "Une IA européenne : les modèles de Mistral AI, appelés depuis l'Europe.",
  "Aucune publicité, aucune revente de données.",
  "Consultation, correction et suppression des données sur simple demande.",
];

export function Trust() {
  return (
    <section className="py-24 lg:py-32">
      <FadeIn className="container grid max-w-5xl gap-10 md:grid-cols-[1fr_2fr] md:items-start">
        <MarginNote className="text-2xl md:mt-2">Ce qu&apos;on s&apos;engage à faire, et à ne pas faire.</MarginNote>
        <div>
          <h2 className="mb-6 text-4xl font-semibold text-foreground sm:text-5xl">
            Les données d&apos;un enfant <Highlight>ne sont pas un produit</Highlight>
          </h2>
          <ul className="space-y-4 text-lg text-muted-foreground">
            {COMMITMENTS.map((item) => (
              <li key={item} className="border-l-2 border-success pl-4">
                {item}
              </li>
            ))}
          </ul>
        </div>
      </FadeIn>
    </section>
  );
}
```

- [ ] **Step 3: Supprimer `features.tsx`** : `git -C $W rm apps/landing/components/sections/features.tsx` ; dans `app/page.tsx`, remplacer `<Features />` par `<Parents />` puis `<Trust />` (imports ajustés).

- [ ] **Step 4: Valider** : typecheck, lint, build ; captures 1440 / 375, clair et sombre.

- [ ] **Step 5: Commit** : `feat(landing): parents and trust sections`.

### Task 11: Tarifs, FAQ, CTA et page d'accueil

**Files:**
- Modify: `apps/landing/components/sections/pricing.tsx` (réécriture)
- Modify: `apps/landing/components/sections/faq-data.ts` (réécriture)
- Modify: `apps/landing/components/sections/faq.tsx:12-24,28,36-40`
- Modify: `apps/landing/components/sections/cta.tsx` (réécriture)
- Modify: `apps/landing/app/page.tsx` (réécriture)

**Interfaces:**
- Consumes: `SectionHeader`, `WaitlistForm` (avec `tone="inverted"`), `Scribble`, sections des Tasks 8-10.
- Produces: page d'accueil complète ; `FAQS: { question: string; answer: string; icon: LucideIcon }[]`.

- [ ] **Step 1: `pricing.tsx`**

```tsx
import { ArrowRight, Check } from "lucide-react";
import { Button, cn } from "@repo/ui";
import { SectionHeader } from "../atoms/section-header";

const PLANS = [
  {
    name: "Gratuit",
    price: "0 €",
    tagline: "Pour découvrir",
    cta: "Rejoindre la liste d'attente",
    featured: false,
    features: [
      "Collège, de la 6e à la 3e",
      "Aide aux devoirs par questions",
      "Un volume d'échanges limité chaque jour",
      "Connexion Pronote",
      "Espace parent",
    ],
  },
  {
    name: "Complet",
    price: "Tarif annoncé au lancement",
    tagline: "Pour aller au bout",
    cta: "Être prévenu du lancement",
    featured: true,
    features: [
      "Tout le plan Gratuit",
      "Cinq fois plus d'échanges par jour",
      "Fiches de révision et répétition espacée",
    ],
  },
];

export function Pricing() {
  return (
    <section id="pricing" className="scroll-mt-20 py-24 lg:py-32">
      <div className="container">
        <SectionHeader
          eyebrow="Tarifs"
          title="Deux formules, sans surprise"
          description="L'offre gratuite reste gratuite. Le tarif du plan Complet sera annoncé en premier aux inscrits de la liste d'attente."
        />
        <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-2">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={cn(
                "flex flex-col rounded-2xl border bg-card p-8",
                plan.featured ? "border-2 border-primary" : "border-border",
              )}
            >
              <p className="font-heading text-lg italic text-primary">{plan.tagline}</p>
              <h3 className="mt-2 text-3xl font-semibold text-foreground">{plan.name}</h3>
              <p className="mt-2 text-lg font-semibold text-foreground">{plan.price}</p>
              <ul className="my-8 flex-1 space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3 text-foreground">
                    <Check className="mt-0.5 size-5 shrink-0 text-success" aria-hidden="true" />
                    {feature}
                  </li>
                ))}
              </ul>
              <Button variant={plan.featured ? "default" : "outline"} className="group w-full" asChild>
                <a href="#waitlist">
                  {plan.cta}
                  <ArrowRight className="transition-transform duration-base group-hover:translate-x-1" aria-hidden="true" />
                </a>
              </Button>
            </div>
          ))}
        </div>
        <p className="mt-8 text-center text-sm text-muted-foreground">Aucune carte bancaire pour l&apos;offre gratuite.</p>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: `faq-data.ts`**

```ts
import { BarChart3, BookOpen, BrainCircuit, Cpu, CreditCard, GraduationCap, Globe, MessageSquareX, ShieldCheck } from "lucide-react";

export const FAQS = [
  {
    question: "Tom donne-t-il les réponses à mon enfant ?",
    answer: "Non. Tom pose des questions pour guider votre enfant vers la solution, et ne donne un indice plus précis que s'il bloque vraiment. Votre enfant comprend et retient, au lieu de recopier.",
    icon: BrainCircuit,
  },
  {
    question: "Quelle différence avec ChatGPT ou une appli qui résout les exercices ?",
    answer: "Ces outils donnent la solution : le devoir est fait, la notion n'est pas comprise. Tom est un tuteur : il fait réfléchir, s'adapte à la classe de votre enfant, se connecte à Pronote et vous tient informé.",
    icon: MessageSquareX,
  },
  {
    question: "Tom s'adapte-t-il au niveau de mon enfant ?",
    answer: "Oui. Tom s'adresse aux collégiens, de la 6e à la 3e. Il adapte son vocabulaire, la longueur de ses explications et les notations à la classe de votre enfant et à la matière travaillée.",
    icon: BookOpen,
  },
  {
    question: "Est-ce compatible avec Pronote ?",
    answer: "Oui. Une fois Pronote connecté, Tom voit les devoirs, les dernières notes et l'emploi du temps : l'accompagnement part de ce que votre enfant a réellement à faire.",
    icon: GraduationCap,
  },
  {
    question: "Comment suivre les progrès de mon enfant ?",
    answer: "Votre espace parent présente un résumé : matières travaillées, temps passé, notions qui résistent, et des alertes quand une difficulté revient. Vous n'y lisez pas ses conversations : votre enfant garde un espace à lui.",
    icon: BarChart3,
  },
  {
    question: "Quelle IA utilisez-vous ?",
    answer: "Tom s'appuie sur les modèles de Mistral AI, une entreprise française, appelés depuis leur infrastructure européenne.",
    icon: Cpu,
  },
  {
    question: "Mes données sont-elles en sécurité ?",
    answer: "Vos données sont hébergées dans l'Union européenne et traitées conformément au RGPD. Nous ne vendons jamais vos informations et n'affichons aucune publicité.",
    icon: ShieldCheck,
  },
  {
    question: "Puis-je annuler à tout moment ?",
    answer: "L'offre gratuite, avec un volume d'échanges limité chaque jour, reste accessible sans limite de durée. L'abonnement Complet ouvrira après le lancement, sans engagement ; ses modalités seront publiées à son ouverture.",
    icon: CreditCard,
  },
  {
    question: "Sur quels appareils l'utiliser ?",
    answer: "C'est un service web : il s'utilise dans le navigateur, sur ordinateur, tablette ou téléphone, sans rien installer.",
    icon: Globe,
  },
];
```

- [ ] **Step 3: `faq.tsx`** — changements ponctuels

- `className="py-24 bg-secondary/50"` → `className="scroll-mt-20 bg-secondary py-24 lg:py-32"` ;
- `SectionHeader` : ajouter `eyebrow="Questions"` et `title="Ce que les parents nous demandent"` ;
- conteneur de chaque question : `transition-all duration-200 hover:border-primary/50` → `transition-colors duration-base hover:border-primary` ;
- bouton : ajouter `min-h-11` à sa classe ;
- chevron : `duration-200` → `duration-base` ;
- `transition={{ duration: 0.2 }}` → `transition={{ duration: 0.25 }}` (miroir de `--duration-base`).

- [ ] **Step 4: `cta.tsx`**

```tsx
import { WaitlistForm } from "../molecules/waitlist-form";

export function CTA() {
  return (
    <section id="waitlist" className="scroll-mt-20 py-24">
      <div className="container">
        <div className="mx-auto max-w-4xl rounded-2xl bg-foreground px-6 py-14 text-center text-background sm:px-16">
          <h2 className="text-4xl font-semibold text-balance sm:text-5xl">Soyez prévenu du lancement</h2>
          <p className="mx-auto mt-4 max-w-xl text-lg opacity-80">
            Tom arrive bientôt, dans le navigateur. Laissez votre email pour être prévenu de l&apos;ouverture.
          </p>
          <WaitlistForm source="cta-bottom" tone="inverted" className="mx-auto mt-8 max-w-lg" />
        </div>
      </div>
    </section>
  );
}
```

`opacity-80` sur `text-background` / `bg-foreground` : vérifier le contraste à l'œil en Task 13 ; en dark, le bloc devient papier et le texte encre, contraste identique (14,4:1 à pleine opacité).

- [ ] **Step 5: `app/page.tsx`**

```tsx
import { Hero } from "@/components/sections/hero";
import { Problem } from "@/components/sections/problem";
import { HowItWorks } from "@/components/sections/how-it-works";
import { InputModes } from "@/components/sections/input-modes";
import { Parents } from "@/components/sections/parents";
import { Trust } from "@/components/sections/trust";
import { Pricing } from "@/components/sections/pricing";
import { FAQ } from "@/components/sections/faq";
import { FAQS } from "@/components/sections/faq-data";
import { CTA } from "@/components/sections/cta";

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQS.map(({ question, answer }) => ({
    "@type": "Question",
    name: question,
    acceptedAnswer: { "@type": "Answer", text: answer },
  })),
};

export default function HomePage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <Hero />
      <Problem />
      <HowItWorks />
      <InputModes />
      <Parents />
      <Trust />
      <Pricing />
      <FAQ />
      <CTA />
    </>
  );
}
```

- [ ] **Step 6: Valider** : typecheck, lint, build ; captures de la page entière 1440 / 375, clair et sombre ; `grep -rn "10 matières\|Francfort\|Paris" apps/landing/components apps/landing/app/page.tsx` ne renvoie rien (exit 1).

- [ ] **Step 7: Commit** : fichiers un par un ; `feat(landing): pricing, FAQ, final CTA and new home page order`.

### Task 12: Pages secondaires et OG image

**Files:**
- Modify: `apps/landing/components/layout/page-layout.tsx`
- Modify: `apps/landing/app/aide/page.tsx`, `apps/landing/app/contact/page.tsx`, `apps/landing/app/cgu/page.tsx`, `apps/landing/app/confidentialite/page.tsx`, `apps/landing/app/mentions-legales/page.tsx` (enveloppes visuelles seulement)
- Create: `apps/landing/app/opengraph-image.tsx`
- Create: `apps/landing/assets/fraunces-latin-600-normal.woff`
- Delete: `apps/landing/public/og-image.png`

**Interfaces:**
- Consumes: `SectionHeader`, `BRAND_NAME`.

- [ ] **Step 1: Enveloppe des pages légales**

Dans `cgu`, `confidentialite` et `mentions-legales`, remplacer le bloc :

```tsx
        <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-blue-600/20 rounded-[2.5rem] blur-xl opacity-50" />
        <div className="relative bg-card/80 backdrop-blur-xl border border-border/50 rounded-[2rem] p-8 md:p-12 shadow-2xl">
```

par :

```tsx
        <div className="rounded-2xl border border-border bg-card p-8 md:p-12">
```

et retirer la `</div>` fermante surnuméraire correspondante. Le texte juridique ne change pas.

- [ ] **Step 2: `aide` et `contact`**

Dans les deux fichiers, sur chaque carte : retirer le `div` `absolute inset-0 bg-gradient-to-br …`, remplacer `rounded-3xl bg-card border border-border/50 … hover:shadow-2xl hover:border-primary/50 hover:-translate-y-1` par `rounded-2xl border border-border bg-card … transition-colors duration-base hover:border-primary`. Dans `aide`, retirer le `div` `absolute inset-0 -z-10 bg-secondary/30 rounded-[3rem] blur-3xl`, et remplacer `<Link href="/contact"><Button size="lg">…</Button></Link>` par `<Button size="lg" asChild><Link href="/contact">Contacter le support</Link></Button>` (un bouton dans un lien est un double interactif). Dans `contact`, la carte « Localisation » passe de `info` à `success`.

- [ ] **Step 3: Fonte de l'OG image**

```bash
mkdir -p $W/apps/landing/assets
curl -fsSL https://cdn.jsdelivr.net/fontsource/fonts/fraunces@latest/latin-600-normal.woff -o $W/apps/landing/assets/fraunces-latin-600-normal.woff
file $W/apps/landing/assets/fraunces-latin-600-normal.woff
```

Expected: `Web Open Font Format, TrueType` (~22 Ko). Source : Fontsource (licence OFL de Fraunces).

- [ ] **Step 4: `app/opengraph-image.tsx`**

```tsx
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { BRAND_NAME } from "@/lib/brand";

export const alt = `${BRAND_NAME} - Le tuteur qui ne donne pas la réponse`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// ImageResponse ne lit pas les variables CSS : copie de packages/tokens/theme.css.
const PAPER = "#FAF7F0";
const INK = "#1C2340";
const TERRACOTTA = "#B0421A";

const fraunces = await readFile(join(process.cwd(), "assets/fraunces-latin-600-normal.woff"));

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 80,
          background: PAPER,
          color: INK,
          fontFamily: "Fraunces",
        }}
      >
        <div style={{ display: "flex", fontSize: 44 }}>
          {BRAND_NAME}
          <span style={{ color: TERRACOTTA }}>.</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", fontSize: 76, lineHeight: 1.1 }}>
          <span>Il ne donne pas la réponse.</span>
          <span style={{ display: "flex" }}>
            Il aide à la&nbsp;<span style={{ color: TERRACOTTA }}>comprendre.</span>
          </span>
        </div>
        <div style={{ display: "flex", fontSize: 30, color: TERRACOTTA }}>Collège, de la 6e à la 3e</div>
      </div>
    ),
    { ...size, fonts: [{ name: "Fraunces", data: fraunces, style: "normal", weight: 600 }] },
  );
}
```

Source : [Next.js 16.3 — ImageResponse](https://nextjs.org/docs/app/api-reference/functions/image-response) (flexbox seul, `ttf`/`otf`/`woff`, fonte lue au niveau module) et [opengraph-image](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/opengraph-image).

- [ ] **Step 5: Supprimer l'ancienne image** : `git -C $W rm apps/landing/public/og-image.png`

- [ ] **Step 6: Valider**

Run: typecheck, lint, build (codes lus). Puis `pnpm --filter landing start` en arrière-plan et `curl -s -o /tmp/og.png -w "%{http_code} %{content_type}\n" http://localhost:3001/opengraph-image` → `200 image/png` ; ouvrir `/tmp/og.png` avec Read pour le regarder. `curl -s http://localhost:3001 | grep -o '<meta property="og:image"[^>]*>'` → pointe vers `/opengraph-image…`. Captures des six pages secondaires en 375 px.

- [ ] **Step 7: Commit** : fichiers un par un (dont le `.woff`) ; `feat(landing): restyle secondary pages, generate the OG image`, avec les deux URLs de doc dans le corps.

### Task 13: Vérification complète et PR L2

**Files:**
- Modify: `docs/superpowers/suivi.md`

- [ ] **Step 1: Validation monorepo** : `pnpm typecheck > /tmp/tc.log 2>&1; echo "tc=$?"; pnpm lint > /tmp/lint.log 2>&1; echo "lint=$?"; pnpm --filter landing build > /tmp/build.log 2>&1; echo "build=$?"; pnpm --filter @repo/tokens test > /tmp/tok.log 2>&1; echo "tok=$?"` → tous `0`.
- [ ] **Step 2: Parcours Review Focus dans Chrome** (`pnpm --filter landing dev`) :
  1. Émuler `prefers-reduced-motion: reduce` (DevTools Rendering, ou `javascript_tool` : `matchMedia('(prefers-reduced-motion: reduce)').matches` après émulation) : recharger `/`, capture immédiate → « trouver » barré en entier, « comprendre » visible, messages de la démo tous affichés.
  2. Fenêtre 375 px : `document.documentElement.scrollWidth` = `window.innerWidth` sur `/` et chaque page secondaire.
  3. Formulaire : email invalide + Tab → erreur, pas de POST ; serveur éteint → « Erreur de connexion au serveur » ; serveur allumé → succès (Task 7 Step 5 rejoué sur le CTA encre, erreur lisible en papier).
  4. Dark : captures du hero, du surligneur, du bloc CTA (papier en dark) et des annotations.
  5. Clavier : Tab depuis le haut de page jusqu'au formulaire du CTA ; l'anneau de focus est visible sur chaque élément, le menu mobile s'ouvre et se ferme au clavier, l'accordéon FAQ s'ouvre à Entrée.
- [ ] **Step 3: `suivi.md`** : L1 `mergée` avec son lien, L2 `ouverte`, entrée au journal ; noter en « Reporté » : icônes PNG (`apple-icon.png`, `icon-192.png`, `icon-512.png`, `favicon.ico`, `icon.svg`, `public/logo.svg`) encore dans l'ancien bleu, à régénérer avec le futur logo (chantier branding) ; classes `prose` des pages légales sans effet (`@tailwindcss/typography` non installé). Commit `docs: track the landing redesign PR`.
- [ ] **Step 4: Push et PR** : `git -C $W push -u origin feat/landing-cahier-annote-pages` ; `gh pr create --base main --title "feat(landing): Cahier annoté redesign"` avec captures (clair, sombre, mobile, OG), sortie des validations, `Generated with Claude Code`. Reporter le lien dans `suivi.md`.
- [ ] **Step 5: Revue** : `/code-review` puis les quatre exigences du `CLAUDE.md` racine (contrat Eden non touché, imports `@repo/*`, taille de fichier, tests : seul `@repo/tokens` en porte). Preview Vercel vérifiée ; merge commit après accord de l'utilisateur.
