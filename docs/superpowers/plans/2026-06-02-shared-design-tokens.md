# Shared Design Tokens (`@repo/tokens`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extraire les tokens de marque (couleurs, rayons, espacements, fontes) dans un package partagé `@repo/tokens` consommé à la fois par `apps/mobile` (NativeWind v5) et `apps/landing` (Tailwind v4 + shadcn/ui), pour réconcilier la dérive actuelle et poser la fondation du design system multi-front.

**Architecture :** Un package workspace `@repo/tokens` expose un fichier `theme.css` contenant un unique bloc Tailwind v4 `@theme` (les tokens de marque light). Mobile et landing l'`@import`ent au lieu de définir leurs propres `@theme` inline. Les deux apps étant déjà sur Tailwind v4, le même bloc `@theme` est lu nativement par NativeWind (via Metro) et par Next.js (via PostCSS). Le dark mode et les tokens JS restent hors scope de ce plan (suivi Phase 1b).

**Tech Stack :** pnpm workspaces, Turborepo, Tailwind CSS v4, NativeWind v5, Next.js 16, TypeScript 6.

---

## Décision requise AVANT de commencer (Tâche 0)

Ce plan **réconcilie** deux palettes divergentes. Choisir la palette canonique est une décision de marque, pas d'ingénierie. Voir Tâche 0. **Ne pas démarrer la Tâche 1 sans cet arbitrage validé.**

## Périmètre

**Dans le scope :** extraction des tokens **light** partagés (couleurs sémantiques, radius, spacing, fontes) + branchement mobile + landing.

**Hors scope (plans séparés, plus tard) :**
- Dark mode unifié (mobile = JS impératif `useThemeColors.ts` + variante `dark:` ; landing = classe `.dark` + next-themes). Mécanismes légitimement différents → Phase 1b.
- `apps/web` (produit web B2C) et console B2B établissement → net-new, à planifier quand la traction B2C le justifie.
- `@repo/core` (logique métier partagée) → quand un 2ᵉ front la consomme.

## Fichiers touchés

- **Créer** : `packages/tokens/package.json` — manifest du package `@repo/tokens`.
- **Créer** : `packages/tokens/tsconfig.json` — typecheck (calqué sur `@repo/shared-types`).
- **Créer** : `packages/tokens/theme.css` — bloc `@theme` canonique (source unique de vérité).
- **Créer** : `packages/tokens/src/index.ts` — export TS minimal (placeholder typé + parité de test).
- **Créer** : `packages/tokens/src/index.test.ts` — test de parité des tokens.
- **Modifier** : `apps/mobile/src/global.css` — remplacer le `@theme` inline par un import de `@repo/tokens/theme.css`.
- **Modifier** : `apps/mobile/package.json` — ajouter la dépendance `@repo/tokens`.
- **Modifier** : `apps/landing/app/globals.css` — remplacer le `@theme` inline par un import de `@repo/tokens/theme.css`.
- **Modifier** : `apps/landing/package.json` — ajouter la dépendance `@repo/tokens`.

---

### Tâche 0 : Arbitrer la palette canonique (décision, pas de code)

**Files:** aucun (décision documentée).

- [ ] **Step 1 : Choisir la base de marque**

Trancher entre les deux directions actuelles :

| Critère | Base "froide" (landing actuelle) | Base "chaude" (mobile actuelle) |
|---|---|---|
| Background | `#FFFFFF` blanc pur | `#FAFAF9` stone, doux |
| Foreground | `#0F172A` slate 900 | `#1C1917` stone 900 |
| Primary | `#2563EB` Blue 600 | `#3B82F6` Blue 500 |
| Ressenti | Pro, institutionnel, scale B2B | Chaleureux, friendly, B2C ado |
| Aligné shadcn/ui | Oui (landing y est déjà) | Non |

**Recommandation par défaut** (à valider par le propriétaire de la marque) : adopter la **base froide / shadcn-aligned** comme canonique (compatible B2C *et* future console B2B, et la landing y est déjà), avec `--color-primary: #2563EB`. Si la marque veut garder la chaleur côté app, on garde le background `#FAFAF9` mais on aligne `primary`, `foreground` et le reste.

- [ ] **Step 2 : Geler la liste des tokens canoniques**

Le bloc `@theme` canonique = **union** des deux fichiers actuels. Tokens à inclure (valeurs ci-dessous = proposition base froide, à confirmer) :

```
Couleurs   : background, foreground, primary(+foreground), secondary(+foreground),
             muted(+foreground), accent(+foreground), card(+foreground),
             popover(+foreground), destructive(+foreground), success(+foreground),
             warning(+foreground), info(+foreground), border, input, ring,
             violet(+foreground)
Radius     : --radius (0.75rem) + échelle xs/sm/md/lg/xl/2xl
Spacing    : --spacing-18 (4.5rem), --spacing-22 (5.5rem)
Fontes     : --font-sans, --font-heading, --font-mono
Tailles    : --text-2xs (+ line-height)
```

Note : `--grid-color` reste **spécifique landing** (effet de fond marketing) → ne PAS le mettre dans `@repo/tokens`, le laisser dans `globals.css`.

- [ ] **Step 3 : Commit de la décision**

```bash
git add docs/superpowers/plans/2026-06-02-shared-design-tokens.md
git commit -m "docs(tokens): freeze canonical brand palette for @repo/tokens"
```

---

### Tâche 1 : Spike — confirmer que l'import CSS cross-package résout dans les deux bundlers

**Pourquoi :** un `@import "@repo/tokens/theme.css"` doit résoudre via Metro+NativeWind (mobile) ET PostCSS/Next.js (landing). Le second est standard ; le premier doit être **vérifié, pas supposé** (résolution d'un import CSS d'un package workspace par Metro). Ce spike de-risque tout le reste.

**Files:**
- Create (temporaire) : `packages/tokens/theme.css` (version minimale pour le spike)

- [ ] **Step 1 : Créer un `theme.css` minimal de test**

`packages/tokens/theme.css` :

```css
@theme {
  --color-spike-test: #ff00ff;
}
```

- [ ] **Step 2 : Importer côté mobile et vérifier la résolution Metro**

Dans `apps/mobile/src/global.css`, ajouter temporairement en tête (après les imports tailwind/nativewind existants) :

```css
@import "@repo/tokens/theme.css";
```

Ajouter `"@repo/tokens": "workspace:*"` à `apps/mobile/package.json` (devDependencies), puis :

Run: `pnpm install && cd apps/mobile && pnpm exec expo export --platform web 2>&1 | tail -20`
Expected: build sans erreur de résolution `Unable to resolve "@repo/tokens/theme.css"`. Si la classe `bg-spike-test` est générée → OK.

- [ ] **Step 3 : Vérifier la résolution côté landing**

Dans `apps/landing/app/globals.css`, ajouter temporairement :

```css
@import "@repo/tokens/theme.css";
```

Run: `cd apps/landing && pnpm build 2>&1 | tail -20`
Expected: build Next.js sans erreur d'import CSS.

- [ ] **Step 4 : Décider du mécanisme selon le résultat**

- **Si les deux résolvent** : on garde l'import par nom de package `@repo/tokens/theme.css`. Continuer Tâche 2.
- **Si Metro échoue** : fallback documenté → soit import par chemin relatif (`@import "../../../packages/tokens/theme.css"`), soit exposer les tokens via un preset Tailwind v4 importé dans la config Metro/PostCSS. Choisir le fallback qui résout, le noter dans `packages/tokens/README.md`, puis continuer.

- [ ] **Step 5 : Nettoyer le spike**

Retirer `--color-spike-test` et les imports temporaires (ils seront réintroduits proprement en Tâche 3/4). Ne pas committer le spike.

---

### Tâche 2 : Créer le package `@repo/tokens`

**Files:**
- Create: `packages/tokens/package.json`
- Create: `packages/tokens/tsconfig.json`
- Create: `packages/tokens/theme.css`
- Create: `packages/tokens/src/index.ts`
- Test: `packages/tokens/src/index.test.ts`

- [ ] **Step 1 : Écrire le test de parité (échoue d'abord)**

Le seul "test" qui a du sens pour des tokens : garantir que la **liste des noms de tokens** exposée en TS reste alignée avec une référence figée (détecte un token ajouté/supprimé par accident, et sert de source unique pour les consommateurs JS futurs).

`packages/tokens/src/index.test.ts` :

```ts
import { expect, test } from "bun:test";
import { tokenNames } from "./index";

test("expose le set canonique de tokens de marque", () => {
  expect(tokenNames).toContain("color-primary");
  expect(tokenNames).toContain("color-background");
  expect(tokenNames).toContain("radius");
  expect(tokenNames).toContain("font-sans");
  // garde-fou anti-dérive : taille du set figée
  expect(tokenNames.length).toBe(40);
});
```

- [ ] **Step 2 : Lancer le test pour le voir échouer**

Run: `cd packages/tokens && bun test`
Expected: FAIL — `Cannot find module './index'`.

- [ ] **Step 3 : Écrire `theme.css` canonique**

`packages/tokens/theme.css` (valeurs = base froide validée en Tâche 0 ; ajuster si la marque a choisi autrement) :

```css
/* @repo/tokens — source unique de vérité des tokens de marque (light).
 * Consommé par apps/mobile (NativeWind v5) et apps/landing (Tailwind v4).
 * Dark mode : appliqué par chaque app via son propre mécanisme (hors scope). */
@theme {
  /* Fontes */
  --font-sans: 'NunitoSans';
  --font-heading: 'Poppins';
  --font-mono: 'JetBrainsMono';

  /* Rayons */
  --radius: 0.75rem;
  --radius-2xl: 16px;
  --radius-xl: 14px;
  --radius-lg: 12px;
  --radius-md: 10px;
  --radius-sm: 8px;
  --radius-xs: 6px;

  /* Espacements additionnels */
  --spacing-18: 4.5rem;
  --spacing-22: 5.5rem;

  /* Tailles de texte */
  --text-2xs: 0.625rem;
  --text-2xs--line-height: 0.875rem;

  /* Couleurs sémantiques (light) */
  --color-background: #FFFFFF;
  --color-foreground: #0F172A;
  --color-primary: #2563EB;
  --color-primary-foreground: #FFFFFF;
  --color-secondary: #F1F5F9;
  --color-secondary-foreground: #0F172A;
  --color-muted: #F1F5F9;
  --color-muted-foreground: #64748B;
  --color-accent: #F1F5F9;
  --color-accent-foreground: #0F172A;
  --color-card: #FFFFFF;
  --color-card-foreground: #0F172A;
  --color-popover: #FFFFFF;
  --color-popover-foreground: #0F172A;
  --color-destructive: #DC2626;
  --color-destructive-foreground: #FFFFFF;
  --color-success: #059669;
  --color-success-foreground: #FFFFFF;
  --color-warning: #D97706;
  --color-warning-foreground: #FFFFFF;
  --color-info: #0EA5E9;
  --color-info-foreground: #FFFFFF;
  --color-border: #E2E8F0;
  --color-input: #E2E8F0;
  --color-ring: #2563EB;
  --color-violet: #7C3AED;
  --color-violet-foreground: #FFFFFF;
}
```

- [ ] **Step 4 : Écrire `src/index.ts`**

`packages/tokens/src/index.ts` — la liste des noms, source unique pour les consommateurs JS et le test de parité :

```ts
/** Noms des tokens exposés par theme.css. Tenir synchronisé avec theme.css. */
export const tokenNames = [
  "font-sans", "font-heading", "font-mono",
  "radius", "radius-2xl", "radius-xl", "radius-lg", "radius-md", "radius-sm", "radius-xs",
  "spacing-18", "spacing-22",
  "text-2xs",
  "color-background", "color-foreground",
  "color-primary", "color-primary-foreground",
  "color-secondary", "color-secondary-foreground",
  "color-muted", "color-muted-foreground",
  "color-accent", "color-accent-foreground",
  "color-card", "color-card-foreground",
  "color-popover", "color-popover-foreground",
  "color-destructive", "color-destructive-foreground",
  "color-success", "color-success-foreground",
  "color-warning", "color-warning-foreground",
  "color-info", "color-info-foreground",
  "color-border", "color-input", "color-ring",
  "color-violet", "color-violet-foreground",
] as const;
```

- [ ] **Step 5 : Écrire `package.json`**

`packages/tokens/package.json` (calqué sur `@repo/shared-types`, + export du CSS) :

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
    "./theme.css": "./theme.css"
  },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "bun test"
  },
  "devDependencies": {
    "typescript": "catalog:"
  }
}
```

- [ ] **Step 6 : Écrire `tsconfig.json`**

`packages/tokens/tsconfig.json` (identique à `@repo/shared-types`) :

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "declaration": true,
    "declarationMap": true,
    "composite": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 7 : Installer et lancer le test**

Run: `pnpm install && cd packages/tokens && bun test`
Expected: PASS (2 assertions, `tokenNames.length === 40`).

- [ ] **Step 8 : Typecheck**

Run: `cd packages/tokens && pnpm typecheck`
Expected: aucune erreur.

- [ ] **Step 9 : Commit**

```bash
git add packages/tokens
git commit -m "feat(tokens): add @repo/tokens shared brand design tokens"
```

---

### Tâche 3 : Brancher `apps/mobile` sur `@repo/tokens`

**Files:**
- Modify: `apps/mobile/package.json` (ajout dépendance)
- Modify: `apps/mobile/src/global.css:14-53` (remplacer le `@theme` inline)

- [ ] **Step 1 : Ajouter la dépendance**

Dans `apps/mobile/package.json`, ajouter à `dependencies` :

```json
"@repo/tokens": "workspace:*"
```

Run: `pnpm install`
Expected: lien workspace créé, pas d'erreur.

- [ ] **Step 2 : Remplacer le `@theme` inline par l'import**

Dans `apps/mobile/src/global.css`, supprimer tout le bloc `@theme { ... }` (lignes 14-53 actuelles) et le remplacer par un import, en gardant les imports tailwind/nativewind existants :

```css
@import "tailwindcss/theme.css" layer(theme);
@import "tailwindcss/preflight.css" layer(base);
@import "tailwindcss/utilities.css";

@import "nativewind/theme";

/* Tokens de marque partagés (source unique : packages/tokens/theme.css) */
@import "@repo/tokens/theme.css";
```

(Si la Tâche 1 a imposé un fallback chemin relatif, utiliser ce chemin au lieu du nom de package.)

- [ ] **Step 3 : Vérifier le build web mobile**

Run: `cd apps/mobile && pnpm exec expo export --platform web 2>&1 | tail -20`
Expected: build sans erreur ; classes utilitaires de couleur (ex. `bg-primary`) toujours générées.

- [ ] **Step 4 : Typecheck mobile**

Run: `cd apps/mobile && pnpm typecheck`
Expected: aucune erreur.

- [ ] **Step 5 : Smoke test natif (manuel)**

Run: `cd apps/mobile && pnpm dev` puis ouvrir le dev client.
Expected: l'app rend avec les couleurs canoniques (le `primary` peut **changer visuellement** si la base froide a été choisie — c'est attendu et voulu). Vérifier qu'aucun écran ne casse.

- [ ] **Step 6 : Commit**

```bash
git add apps/mobile/package.json apps/mobile/src/global.css
git commit -m "refactor(mobile): consume shared @repo/tokens theme"
```

---

### Tâche 4 : Brancher `apps/landing` sur `@repo/tokens`

**Files:**
- Modify: `apps/landing/package.json` (ajout dépendance)
- Modify: `apps/landing/app/globals.css:5-54` (remplacer le `@theme` inline ; garder `.dark`, base styles et `--grid-color`)

- [ ] **Step 1 : Ajouter la dépendance**

Dans `apps/landing/package.json`, ajouter à `dependencies` :

```json
"@repo/tokens": "workspace:*"
```

Run: `pnpm install`
Expected: lien workspace créé.

- [ ] **Step 2 : Remplacer le `@theme` inline par l'import**

Dans `apps/landing/app/globals.css`, supprimer le bloc `@theme { ... }` (lignes 5-54 actuelles) et le remplacer par l'import, en **conservant** : la ligne `@import "tailwindcss";`, le `@custom-variant dark`, le bloc `.dark { ... }`, les base styles, le scrollbar et `--grid-color`. Début du fichier après modification :

```css
@import "tailwindcss";

@custom-variant dark (&:where(.dark, .dark *));

/* Tokens de marque partagés (source unique : packages/tokens/theme.css) */
@import "@repo/tokens/theme.css";

/* --grid-color reste spécifique landing (fond marketing) */
@theme {
  --grid-color: hsl(214 32% 80% / 0.25);
}

/* Dark mode overrides (class-based via next-themes) — inchangé */
.dark {
  /* ... bloc existant conservé tel quel ... */
}
```

(Conserver le reste du fichier — base styles, focus, container, selection, scrollbar, reduced-motion — inchangé.)

- [ ] **Step 3 : Vérifier le build landing**

Run: `cd apps/landing && pnpm build 2>&1 | tail -20`
Expected: build Next.js OK.

- [ ] **Step 4 : Typecheck + lint landing**

Run: `cd apps/landing && pnpm typecheck && pnpm lint`
Expected: aucune erreur, zéro warning.

- [ ] **Step 5 : Smoke test visuel (manuel)**

Run: `cd apps/landing && pnpm dev` puis ouvrir `http://localhost:3001`.
Expected: la landing rend avec les tokens canoniques ; le dark mode (toggle next-themes) fonctionne toujours.

- [ ] **Step 6 : Commit**

```bash
git add apps/landing/package.json apps/landing/app/globals.css
git commit -m "refactor(landing): consume shared @repo/tokens theme"
```

---

### Tâche 5 : Validation monorepo + documentation

**Files:**
- Create: `packages/tokens/README.md`
- Modify: `CLAUDE.md` racine (mentionner `@repo/tokens` dans le tableau packages)

- [ ] **Step 1 : Validation globale Turborepo**

Run: `pnpm typecheck && pnpm lint`
Expected: tout vert sur les 3 apps + packages.

- [ ] **Step 2 : Écrire le README du package**

`packages/tokens/README.md` :

```markdown
# @repo/tokens

Source unique de vérité des tokens de marque (Tailwind v4 `@theme`).
Consommé par `apps/mobile` (NativeWind v5) et `apps/landing` (Tailwind v4).

## Usage

Dans le CSS d'entrée de chaque app :

    @import "@repo/tokens/theme.css";

## Règles

- Toute couleur/rayon/fonte de marque vit ICI, jamais en inline dans une app.
- `theme.css` = tokens **light**. Le dark mode est appliqué par chaque app
  via son propre mécanisme (mobile : JS + variante `dark:` ; landing : `.dark`).
- À chaque ajout/retrait de token : mettre à jour `src/index.ts` (`tokenNames`)
  ET la taille attendue dans `src/index.test.ts`.
```

- [ ] **Step 3 : Mettre à jour le CLAUDE.md racine**

Ajouter une ligne au descriptif du monorepo mentionnant `@repo/tokens` comme design system partagé (à côté de `@repo/api`).

- [ ] **Step 4 : Commit final**

```bash
git add packages/tokens/README.md CLAUDE.md
git commit -m "docs(tokens): document @repo/tokens shared design system"
```

---

## Self-review

- **Couverture spec :** extraction tokens (T2), branchement mobile (T3), branchement landing (T4), réconciliation de la dérive (T0 fige la palette canonique), de-risk du mécanisme d'import (T1), validation (T5). ✅
- **Hors scope assumé :** dark mode unifié, `apps/web`, console B2B, `@repo/core` — explicitement différés.
- **Cohérence des noms :** `tokenNames` (index.ts) ↔ `tokenNames` (test) ↔ tokens de `theme.css` ; `@repo/tokens/theme.css` utilisé identiquement en T1/T3/T4.
- **Point de fragilité connu :** résolution de l'import CSS cross-package par Metro (NativeWind v5) — traité en Tâche 1 (spike) avec fallback documenté avant tout engagement.
