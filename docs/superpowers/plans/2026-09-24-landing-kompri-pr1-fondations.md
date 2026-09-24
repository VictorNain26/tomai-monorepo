# Landing Kompri — PR 1 « Fondations et pages » Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Retirer la feuille Seyès, poser les tokens et polices Kompri, refaire l'en-tête, le pied
de page et les pages secondaires, puis supprimer tout le code devenu inutile.

**Architecture:** La landing Next.js rend ses pages sans conteneur « feuille » : fond `background`
crème, sections dans l'utilitaire `container`. Les pages secondaires passent par `PageLayout`,
qui rend un `<h1>`. Le menu mobile utilise le `Sheet` ajouté à `@repo/ui`. La suite Playwright
locale est réécrite sans la géométrie Seyès.

**Tech Stack:** Next.js 16.3, React 19.3, Tailwind 4.3, Motion 13.4, Radix Dialog (`@repo/ui`),
Playwright 1.63, `node:test` (`@repo/tokens`).

**Spec:** `docs/superpowers/specs/2026-09-24-landing-kompri-design.md` (§ 1, § 2, § 6, § 7 PR 1,
§ 8), qui applique `docs/superpowers/specs/2026-09-24-identite-kompri-design.md`.

## Global Constraints

- Tokens uniquement : Tailwind et `@repo/tokens`, aucune valeur de style écrite à la main (hors valeurs animées par Motion et `app/opengraph-image.tsx`).
- Thème clair seul ; site statique ; seule intégration serveur : `joinWaitlist` → `POST /api/waitlist`.
- Primitives interactives via `@repo/ui` ; cibles de 44 px au moins ; contraste AA.
- Fichiers de moins de 400 lignes ; aucune dépendance runtime nouvelle.
- `BRAND_NAME` reste « TomIA » et le domaine `tomia.fr` dans cette PR (le renommage est la PR 3).
- Couleurs (identité § 2) : `background` `#FAF7F0`, `secondary`/`muted`/`accent` `#F0EADD`, `card`/`popover` `#FFFDF8` ; les autres tokens restent.
- Polices (identité § 3) : Nunito pour titres et texte, Caveat pour les seules notes ; titres en 800, texte en 400, libellés et boutons en 700.
- Zéro commentaire sauf un « pourquoi » non évident ; aucun `eslint-disable`.
- Commits `<type>(landing|ui|tokens): …` en anglais, fichiers stagés un par un, pied `Co-Authored-By: Claude <noreply@anthropic.com>` puis `Claude-Session: https://claude.ai/code/session_01Qg7JXj2n5rfm4fz7f8EKRt`.
- Validation avant chaque commit : `cd apps/landing && pnpm typecheck && pnpm lint` (exit 0, lus dans un fichier de log, jamais via `| tail`).
- Suite navigateur : `pnpm --filter landing test:e2e` (après la tâche 1) ; prérequis `pnpm --filter landing exec playwright install chromium`.

## Review Focus

1. Saisie de l'e-mail pendant le chargement du JavaScript : ce qui a été tapé reste dans le champ après l'hydratation → tâche 5, `tests/waitlist.spec.ts`.
2. Menu mobile au clavier : Échap ferme le menu et rend le focus au bouton → tâche 4, `tests/menu.spec.ts`.
3. Pages secondaires lues au lecteur d'écran : un `<h1>`, puis des niveaux qui ne sautent pas → tâche 2, `tests/layout.spec.ts`.
4. Page introuvable : statut 404, repère `<main>`, un `<h1>`, pied de page → tâche 5, `tests/not-found.spec.ts`.
5. Largeur de 375 px sans la feuille : aucune page ne défile de côté → tâche 1 (conservé), revérifié par chaque tâche qui touche la mise en page.

---

### Task 1: Suite Playwright sans géométrie Seyès

**Files:**
- Create: `apps/landing/tests/support.ts`, `apps/landing/tests/layout.spec.ts`, `apps/landing/tests/reveals.spec.ts`
- Delete: `apps/landing/tests/grid.spec.ts`
- Modify: `apps/landing/components/motion-provider.tsx`, `apps/landing/package.json`, `.claude/rules/testing-and-commits.md`

**Interfaces:**
- Produces: `tests/support.ts` exporte `SECONDARY`, `PAGES`, `WIDTHS`, `HEIGHT`, `waitForHydration(page)`, `settle(page)`, `hiddenReveals(page)`, `holdScripts(page)` ; l'attribut `html[data-hydrated]` posé par `MotionProvider` ; le script `test:e2e`.

- [ ] **Step 1: Marqueur d'hydratation.** Dans `components/motion-provider.tsx`, un `useEffect` sans dépendance pose `document.documentElement.dataset.hydrated = ""`. Commentaire (le « pourquoi ») : `// Effects run children first, so this marks the whole page as hydrated: the tests wait on it.`

- [ ] **Step 2: Écrire `tests/support.ts`.**

```ts
import type { Page, Route } from "@playwright/test";

declare global {
  interface Window {
    layoutShift: number;
  }
}

export const SECONDARY = ["/aide", "/faq", "/contact", "/cgu", "/confidentialite", "/mentions-legales"];
export const PAGES = ["/", ...SECONDARY];
export const WIDTHS = [375, 768, 1024, 1441];
export const HEIGHT = 861;

export async function waitForHydration(page: Page) {
  await page.locator("html[data-hydrated]").waitFor({ state: "attached" });
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

export async function settle(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  // Reveals only listen once hydrated; a short page would otherwise be scrolled through before they can fire.
  await waitForHydration(page);
  await page.evaluate(async () => {
    const step = window.innerHeight / 2;
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    }
    window.scrollTo(0, 0);
  });
}

export function hiddenReveals(page: Page) {
  return page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("[data-reveal]")]
      .filter((el) => getComputedStyle(el).opacity !== "1" || getComputedStyle(el).transform !== "none")
      .map((el) => el.textContent?.trim().slice(0, 40) ?? ""),
  );
}

export async function holdScripts(page: Page) {
  const held: Route[] = [];
  await page.route("**/_next/static/chunks/*.js", (route) => {
    held.push(route);
  });
  return async () => {
    await Promise.all(held.map((route) => route.continue()));
    await page.unroute("**/_next/static/chunks/*.js");
  };
}
```

- [ ] **Step 3: Écrire `tests/layout.spec.ts`.** Reprendre de `grid.spec.ts`, en important les constantes et `settle` depuis `./support` : « `${path} at ${width}px stays inside its sheet` » renommé `${path} at ${width}px never scrolls sideways`, qui ne garde de `inspectBounds` que le défilement horizontal, le `.container` imbriqué et le débordement du texte hors de la zone utile de chaque `.container` (sélecteur `.container` au lieu de `[data-sheet] .container`, marge de 2 px conservée) ; « `/cgu at 1441px keeps legal lines within 85 characters` » ; « `header and page controls at ${width}px are at least 44px targets` » ; « `/aide at 375px keeps each FAQ question within three lines` » ; « `/ at 375px keeps 8px between a wrapped pricing label and its button edge` ». Corps de test repris à l'identique.

- [ ] **Step 4: Écrire `tests/reveals.spec.ts`.** Reprendre de `grid.spec.ts`, avec `settle` et `hiddenReveals` importés : le bloc `without JavaScript` entier ; `${path} loads without a layout shift` (bloc `with motion`, sans le test de la fiche de `/confidentialite`) ; `${path} ends every reveal opaque and in place under reduced motion`.

- [ ] **Step 5: Supprimer `tests/grid.spec.ts`** (`git rm`). Les tests de feuille, de marge et de texte sur fiches disparaissent avec la feuille.

- [ ] **Step 6: Script.** Dans `apps/landing/package.json`, renommer `test:grid` en `test:e2e` (même commande `playwright test`).

- [ ] **Step 7: Règle du dépôt.** Dans `.claude/rules/testing-and-commits.md`, tableau des runners : `pnpm --filter landing test:e2e` ; paragraphe qui suit : la suite construit le site, le sert sur le port 3011 et couvre la mise en page (aucun défilement horizontal, cibles de 44 px, lignes légales), le rendu sans JavaScript et sous mouvement réduit, le formulaire et le menu mobile ; exemple de localisation `tests/layout.spec.ts`.

- [ ] **Step 8: Lancer la suite.** `pnpm --filter landing test:e2e > /tmp/e2e.log 2>&1; echo $?` → `0`, tous les tests verts sur le code actuel (la feuille est encore là, rien ne l'interroge).

- [ ] **Step 9: Valider et commiter.** `pnpm typecheck && pnpm lint` dans `apps/landing` : exit 0. Commit `test(landing): replace the Seyès grid suite with layout and reveal specs`.

### Task 2: Retirer la feuille, `<h1>` sur les pages secondaires

**Files:**
- Delete: `apps/landing/components/notebook/notebook-sheet.tsx`, `apps/landing/components/notebook/fiche.tsx`
- Modify: `apps/landing/app/page.tsx`, `apps/landing/components/layout/page-layout.tsx`, `apps/landing/components/atoms/section-header.tsx`, `apps/landing/app/globals.css`, `apps/landing/components/atoms/fade-in.tsx`, les six pages secondaires (`app/{aide,faq,contact,cgu,confidentialite,mentions-legales}/page.tsx`), `packages/tokens/theme.css`, `packages/tokens/contrast.test.mjs`
- Test: `apps/landing/tests/layout.spec.ts`

**Interfaces:**
- Consumes: `tests/support.ts` (tâche 1).
- Produces: `SectionHeader({ as?: "h1" | "h2", eyebrow?, title, description?, align?, className? })`, `as` vaut `"h2"` par défaut ; `PageLayout({ title, description?, maxWidth?, children })` inchangé en interface.

- [ ] **Step 1: Test qui échoue.** Ajouter à `tests/layout.spec.ts` :

```ts
function headingLevels(page: Page) {
  return page.evaluate(() =>
    [...document.querySelectorAll("main h1, main h2, main h3, main h4")]
      .filter((el) => el.getClientRects().length > 0)
      .map((el) => Number(el.tagName.slice(1))),
  );
}

for (const path of PAGES) {
  test(`${path} has one h1 and never skips a heading level`, async ({ page }) => {
    await page.goto(path);
    const levels = await headingLevels(page);
    expect(levels.filter((level) => level === 1), "h1 count").toHaveLength(1);
    expect(levels[0], "first heading").toBe(1);
    const skips = levels.flatMap((level, i) => (i > 0 && level > levels[i - 1] + 1 ? [`h${levels[i - 1]} → h${level}`] : []));
    expect(skips).toEqual([]);
  });
}
```

(`Page` s'importe de `@playwright/test`.) Lancer `pnpm --filter landing test:e2e -g "one h1"` : échec sur les six pages secondaires (aucun `<h1>`).

- [ ] **Step 2: `SectionHeader`.** Nouvelle prop `as` (`"h1" | "h2"`, défaut `"h2"`) qui choisit la balise du titre, mêmes classes.

- [ ] **Step 3: `PageLayout`.** Ne rend plus `NotebookSheet` ni `Fiche` : `<div className={cn("container py-12 md:py-24", MAX_WIDTHS[maxWidth])}>` contenant `<SectionHeader as="h1" title description align="left" className="mb-8" />` puis `children`.

- [ ] **Step 4: Niveaux des pages secondaires.** Dans les six pages, les sous-titres `<h3>` qui suivent directement le titre de page deviennent des `<h2>` (sections légales, « Une question sur … ? » de `/aide`, « Par email » de `/contact`). Dans `app/globals.css`, les règles `legal-copy` sur `h3` passent sur `h2` (`& h2`, `& h2:first-child`).

- [ ] **Step 5: Première page.** `app/page.tsx` rend les sections sans `NotebookSheet`, dans un fragment.

- [ ] **Step 6: `globals.css`.** Supprimer le bloc `:root` (`--cell`, `--rule`, `--band`, `--margin-x`), sa media query, les utilitaires `sheet`, `sheet-rules`, `sheet-verticals`, `sheet-margin`, `fiche-tape` et le commentaire du bord gauche. `container` devient :

```css
@utility container {
  margin-inline: auto;
  width: 100%;
  max-width: 80rem;
  padding-inline: 1rem;

  @media (width >= 48rem) {
    padding-inline: 2rem;
  }

  @media (width >= 64rem) {
    padding-inline: 3rem;
  }
}
```

Dans `@layer base`, `body` passe de `bg-secondary` à `bg-background`.

- [ ] **Step 7: Supprimer `components/notebook/`** (`git rm` des deux fichiers).

- [ ] **Step 8: Token `note`.** Seule la fiche l'utilisait : retirer `--color-note` et `--color-note-foreground` de `packages/tokens/theme.css`, et les quatre paires `note` de `PAIRS` dans `packages/tokens/contrast.test.mjs`. `pnpm --filter @repo/tokens test` : exit 0.

- [ ] **Step 9: Durée de `FadeIn`.** `transition.duration` lit `REVEAL_SECONDS` de `@/lib/motion` au lieu de `0.5`.

- [ ] **Step 10: Aucun reste du cahier.** `grep -rnE "NotebookSheet|Fiche|data-sheet|data-fiche|sheet-|--cell|--band|--margin-x|fiche-tape|bg-note|color-note" apps/landing/app apps/landing/components apps/landing/lib apps/landing/tests packages` : vide.

- [ ] **Step 11: Vérifier.** `pnpm --filter landing test:e2e > /tmp/e2e.log 2>&1; echo $?` → `0`, le test d'étape 1 compris.

- [ ] **Step 12: Valider et commiter.** Typecheck et lint : exit 0. Deux commits : `refactor(landing): drop the Seyès sheet and its fiches` (sheet, globals, notebook, page, FadeIn, tokens) puis `fix(landing): give every secondary page an h1 and ordered headings` (SectionHeader, PageLayout, pages, test).

### Task 3: Tokens et polices Kompri

**Files:**
- Modify: `packages/tokens/theme.css`, `packages/tokens/contrast.test.mjs`, `apps/landing/app/layout.tsx`, `apps/landing/app/globals.css`, `apps/landing/components/atoms/section-header.tsx`, `packages/ui/src/components/button.tsx`

**Interfaces:**
- Produces: utilitaires Tailwind `font-sans` et `font-heading` (Nunito), `font-hand` (Caveat) ; couleurs de l'identité.

- [ ] **Step 1: Test de contraste.** Ajouter à `PAIRS` de `contrast.test.mjs` la paire `["success", "card"]` (badge du hero en PR 2). Mettre les couleurs de la contrainte globale dans `theme.css` (`background`, `secondary`, `muted`, `accent`, `card`, `popover`). Le commentaire des couleurs devient `/* Couleurs sémantiques (light) — Kompri : stylo Bic quatre couleurs sur papier crème */`. `pnpm --filter @repo/tokens test > /tmp/tokens.log 2>&1; echo $?` → `0`.

- [ ] **Step 2: Signatures des polices.** Lire les déclarations `Nunito` et `Caveat` dans les `.d.ts` de `next/font/google` installés (`apps/landing/node_modules/next/dist/compiled/@next/font/dist/google/index.d.ts`) : noter si `weight` est optionnel (police variable) et les `axes` disponibles. Citer ce fichier dans le message de commit.

- [ ] **Step 3: `layout.tsx`.** Remplacer `Fraunces` et `Figtree` par `Nunito({ subsets: ["latin"], display: "swap", variable: "--font-nunito" })` et `Caveat({ subsets: ["latin"], display: "swap", variable: "--font-caveat" })` (ajuster selon l'étape 2 si `weight` est requis : Caveat en `"600"`). La classe de `<html>` porte les deux variables.

- [ ] **Step 4: `theme.css`, polices.** Dans `@theme inline` : `--font-sans: var(--font-nunito), ui-sans-serif, system-ui, sans-serif;`, `--font-heading: var(--font-nunito), ui-sans-serif, system-ui, sans-serif;`, `--font-hand: var(--font-caveat), cursive;`.

- [ ] **Step 5: Graisses.** `globals.css`, `@layer base` : les titres `h1…h6` prennent `font-heading font-extrabold tracking-tight`. `SectionHeader` : titre en `font-extrabold` au lieu de `font-semibold` ; l'eyebrow n'est plus en italique serif mais `text-sm font-bold text-primary`. `@repo/ui` `button.tsx` : `font-semibold` → `font-bold` dans la classe de base.

- [ ] **Step 6: Aucune trace des anciennes polices.** `grep -rnE "Figtree|figtree|--font-fraunces" apps/landing/app apps/landing/components packages` : vide. (`opengraph-image.tsx` et `assets/fraunces-latin-600-normal.woff` restent jusqu'à la PR 3, qui refait l'image Open Graph.)

- [ ] **Step 7: Vérifier.** `pnpm --filter landing build > /tmp/build.log 2>&1; echo $?` → `0` ; `pnpm --filter landing test:e2e` → `0` (les lignes légales et les questions de FAQ sont recalculées avec Nunito).

- [ ] **Step 8: Commiter.** `feat(tokens): switch to the Kompri paper palette and Nunito`, qui cite `apps/landing/node_modules/next/dist/compiled/@next/font/dist/google/index.d.ts`.

### Task 4: En-tête, menu mobile, pied de page, logo

**Files:**
- Create: `packages/ui/src/components/sheet.tsx`, `apps/landing/components/molecules/mobile-menu.tsx`, `apps/landing/tests/menu.spec.ts`
- Modify: `packages/ui/src/index.ts`, `apps/landing/components/layout/header.tsx`, `apps/landing/components/molecules/nav-links.tsx`, `apps/landing/components/layout/footer.tsx`, `apps/landing/components/atoms/logo.tsx`

**Interfaces:**
- Produces: `@repo/ui` exporte `Sheet`, `SheetTrigger`, `SheetClose`, `SheetContent` (prop `side`), `SheetTitle` ; `MobileMenu({ className? })`.

- [ ] **Step 1: Test qui échoue.** `tests/menu.spec.ts` :

```ts
import { expect, test } from "@playwright/test";
import { HEIGHT, waitForHydration } from "./support";

test("the mobile menu opens, lists the sections and closes on Escape", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: HEIGHT });
  await page.goto("/");
  await waitForHydration(page);
  const trigger = page.getByRole("button", { name: "Ouvrir le menu" });
  await trigger.click();
  const menu = page.getByRole("dialog");
  await expect(menu).toBeVisible();
  const nav = menu.getByRole("navigation", { name: "Principale" });
  for (const name of ["Comment ça marche", "Parents", "Tarifs"]) {
    await expect(nav.getByRole("link", { name })).toBeVisible();
  }
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("the desktop header shows its links and hides the menu button", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: HEIGHT });
  await page.goto("/");
  const header = page.getByRole("banner");
  for (const name of ["Comment ça marche", "Parents", "Tarifs", "S'inscrire"]) {
    await expect(header.getByRole("link", { name })).toBeVisible();
  }
  await expect(header.getByRole("button", { name: "Ouvrir le menu" })).toBeHidden();
});
```

`pnpm --filter landing test:e2e tests/menu.spec.ts` : échec (pas de dialogue, pas de lien « S'inscrire »).

- [ ] **Step 2: `sheet.tsx`.** Créer `packages/ui/src/components/sheet.tsx` :

```tsx
import * as React from "react";
import * as SheetPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "../lib/utils";

const Sheet = SheetPrimitive.Root;
const SheetTrigger = SheetPrimitive.Trigger;
const SheetClose = SheetPrimitive.Close;

function SheetContent({
  className,
  children,
  side = "right",
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & { side?: "right" | "left" }) {
  return (
    <SheetPrimitive.Portal>
      <SheetPrimitive.Overlay className="fixed inset-0 z-50 bg-overlay/80" />
      <SheetPrimitive.Content
        className={cn(
          "fixed inset-y-0 z-50 flex h-full w-3/4 flex-col gap-4 bg-background shadow-lg sm:max-w-sm",
          side === "right" ? "right-0 border-l" : "left-0 border-r",
          className,
        )}
        {...props}
      >
        {children}
        <SheetPrimitive.Close className="absolute top-2 right-2 inline-flex size-11 items-center justify-center rounded-full opacity-70 transition-opacity duration-base hover:opacity-100">
          <X className="size-5" aria-hidden="true" />
          <span className="sr-only">Fermer</span>
        </SheetPrimitive.Close>
      </SheetPrimitive.Content>
    </SheetPrimitive.Portal>
  );
}

function SheetTitle({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return <SheetPrimitive.Title className={cn("font-bold text-foreground", className)} {...props} />;
}

export { Sheet, SheetTrigger, SheetClose, SheetContent, SheetTitle };
```

Pas de classes `animate-in`/`slide-in-*` : aucun plugin d'animation n'est chargé (ni `tw-animate-css` ni `tailwindcss-animate` dans le dépôt), elles ne produiraient aucune règle. Ajouter l'export correspondant à `packages/ui/src/index.ts`.

- [ ] **Step 3: `mobile-menu.tsx`.**

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import { Button, Sheet, SheetContent, SheetTitle, SheetTrigger } from "@repo/ui";
import { NavLinks } from "./nav-links";

export function MobileMenu({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className={className} aria-label="Ouvrir le menu">
          <Menu className="size-5" aria-hidden="true" />
        </Button>
      </SheetTrigger>
      <SheetContent aria-describedby={undefined} className="p-6 pt-16">
        <SheetTitle className="sr-only">Menu</SheetTitle>
        <nav aria-label="Principale" className="flex flex-col gap-4">
          <NavLinks orientation="vertical" onLinkClick={() => setOpen(false)} />
          <Button asChild className="w-full">
            <Link href="/#waitlist" onClick={() => setOpen(false)}>
              S&apos;inscrire
            </Link>
          </Button>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 4: `nav-links.tsx`.** `LINKS` garde « Comment ça marche », « Parents », « Tarifs » (le lien FAQ sort de l'en-tête ; la FAQ reste dans le pied de page via `/aide` et sur la première page). Libellés en `font-bold text-foreground`, survol `text-primary`.

- [ ] **Step 5: `header.tsx`.** Garde l'en-tête collant et son fond `background` translucide au défilement. Retire l'état `mobileMenuOpen`, le bouton maison et le panneau déroulant : en dessous de `md`, `<MobileMenu />` ; à partir de `md`, `<nav aria-label="Principale">` avec `NavLinks` puis le bouton « S'inscrire » (`Button size="sm" asChild`, lien `/#waitlist`). Le logo reste à gauche.

- [ ] **Step 6: `footer.tsx`.** Fond `bg-secondary text-secondary-foreground` au lieu de `bg-primary` ; textes secondaires en `text-muted-foreground`, liens `text-foreground` soulignés au survol, anneau de focus par défaut (retirer `focus-visible:ring-primary-foreground` et `focus-visible:ring-offset-primary`) ; nom de marque en `font-extrabold text-primary`.

- [ ] **Step 7: `logo.tsx`.** `font-heading text-2xl font-extrabold text-primary`, sans le point rouge.

- [ ] **Step 8: Vérifier.** `pnpm --filter landing test:e2e > /tmp/e2e.log 2>&1; echo $?` → `0` (menu, cibles de 44 px, aucun défilement horizontal).

- [ ] **Step 9: Commiter.** `feat(ui): add the Sheet primitive` (sheet, index), puis `feat(landing): rebuild the header with a Sheet mobile menu and a light footer` (le reste et le test).

### Task 5: Formulaire non contrôlé et page 404

**Files:**
- Create: `apps/landing/app/not-found.tsx`, `apps/landing/tests/waitlist.spec.ts`, `apps/landing/tests/not-found.spec.ts`
- Modify: `apps/landing/components/molecules/waitlist-form.tsx`

**Interfaces:**
- Consumes: `holdScripts`, `waitForHydration` (tâche 1), `PageLayout` (tâche 2).
- Produces: `WaitlistForm` inchangé en interface (`source`, `className`, `buttonText`, `tone`) ; le champ porte `name="email"`.

- [ ] **Step 1: Tests qui échouent.** `tests/waitlist.spec.ts` :

```ts
import { expect, test } from "@playwright/test";
import { holdScripts, waitForHydration } from "./support";

const TYPED = "parent@exemple.fr";

for (const frame of [{ width: 1440, height: 900 }, { width: 375, height: 667 }]) {
  test(`/ at ${frame.width}px keeps what was typed before hydration`, async ({ page }) => {
    await page.setViewportSize(frame);
    const release = await holdScripts(page);
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const input = page.locator("main input[type=email]").first();
    await input.click();
    await page.keyboard.type(TYPED);

    await release();
    await waitForHydration(page);
    await expect(input).toHaveValue(TYPED);
    await expect(input).toBeFocused();
  });
}

test("/ validates an address typed before hydration", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const release = await holdScripts(page);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const form = page.locator("main form").first();
  await form.locator("input[type=email]").click();
  await page.keyboard.type("parent@");

  await release();
  await waitForHydration(page);
  await page.keyboard.press("Tab");
  await expect(form.getByRole("alert")).toHaveText("Adresse email invalide");
});
```

`tests/not-found.spec.ts` :

```ts
import { expect, test } from "@playwright/test";

test("an unknown path answers 404 with a titled page, one h1 and the footer", async ({ page }) => {
  const response = await page.goto("/cette-page-n-existe-pas");
  expect(response?.status()).toBe(404);
  await expect(page).toHaveTitle(/Page introuvable/);
  await expect(page.getByRole("main")).toHaveCount(1);
  await expect(page.getByRole("heading", { level: 1, name: "Page introuvable" })).toBeVisible();
  await expect(page.getByRole("contentinfo")).toBeVisible();
  await expect(page.getByRole("link", { name: "Retour à l'accueil" })).toBeVisible();
});
```

Lancer les deux fichiers : échec (valeur effacée à l'hydratation ; page 404 par défaut de Next, sans `<h1>` « Page introuvable »).

- [ ] **Step 2: Formulaire non contrôlé.** Dans `waitlist-form.tsx` : retirer l'état `email` ; l'`Input` reçoit `name="email"`, n'a plus de `value`, et son `onChange` ne fait plus que remettre `status` à `"idle"` après une erreur ; `handleBlur(e: React.FocusEvent<HTMLInputElement>)` lit `e.currentTarget.value` ; `handleSubmit(e: React.FormEvent<HTMLFormElement>)` lit l'adresse par `new FormData(e.currentTarget).get("email")` (chaîne vide si ce n'est pas une chaîne). Commentaire au-dessus de l'`Input` : `{/* Uncontrolled: a controlled value would overwrite what the visitor typed before hydration. */}`. La prop `tone` reste (l'appel final de la première page l'utilise jusqu'à la PR 2).

- [ ] **Step 3: `app/not-found.tsx`.**

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@repo/ui";
import { PageLayout } from "@/components/layout/page-layout";

export const metadata: Metadata = {
  title: "Page introuvable",
};

export default function NotFound() {
  return (
    <PageLayout title="Page introuvable" description="Cette page n'existe pas ou plus.">
      <Button asChild size="lg">
        <Link href="/">Retour à l&apos;accueil</Link>
      </Button>
    </PageLayout>
  );
}
```

Le `<main>` et le pied de page viennent de `app/layout.tsx`.

- [ ] **Step 4: Vérifier.** `pnpm --filter landing test:e2e > /tmp/e2e.log 2>&1; echo $?` → `0`.

- [ ] **Step 5: Commiter.** `fix(landing): keep the waitlist address typed before hydration` (formulaire et son test), puis `feat(landing): add the not-found page` (page et son test).

### Task 6: Nettoyage — code, dépendances et documents morts

**Files:**
- Delete: `packages/ui/src/components/{alert-dialog,avatar,badge,card,dialog,label,select,skeleton,sonner,table}.tsx`, `docs/superpowers/specs/2026-09-22-landing-cahier-annote-design.md`, `docs/superpowers/specs/2026-09-23-landing-copie-corrigee-design.md`, `docs/superpowers/plans/2026-09-22-landing-cahier-annote.md`, `docs/superpowers/plans/2026-09-23-landing-copie-corrigee-pr1-fondations.md`
- Modify: `packages/ui/src/index.ts`, `packages/ui/package.json`, `packages/ui/src/components/button.tsx`, `packages/tokens/theme.css`, `packages/tokens/contrast.test.mjs`, `pnpm-lock.yaml`, `docs/superpowers/specs/2026-09-24-identite-kompri-design.md`, `docs/superpowers/specs/2026-09-24-landing-kompri-design.md`, `docs/superpowers/suivi.md`

**Interfaces:**
- Consumes: tout ce qui précède. `@repo/ui` n'a qu'un consommateur, la landing ; ce qu'elle n'importe pas est mort.

- [ ] **Step 1: Constat.** `pnpm exec knip --include-entry-exports --workspace packages/ui > /tmp/knip-ui.log 2>&1; echo $?` → `1`, avec la liste des exports inutilisés (`AlertDialog*`, `Avatar*`, `Badge`, `Card*`, `Dialog*`, `Label`, `Select*`, `Skeleton`, `Toaster`, `toast`, `Table*`, `buttonVariants`…).

- [ ] **Step 2: Composants morts.** `git rm` des dix fichiers de composants listés ; `index.ts` n'exporte plus que `cn`, `Button`, `ButtonProps`, `Input`, `InputProps` et le `Sheet` de la tâche 4 (retirer aussi tout export de type restant sans consommateur, selon knip).

- [ ] **Step 3: `Button`.** Retirer les variantes jamais utilisées par la landing (`destructive`, `secondary`, `link`, `premium`) et la taille `xl` ; `buttonVariants` n'est plus exporté. Vérifier d'abord par `grep -rn "variant=\|size=" apps/landing/app apps/landing/components` : variantes utilisées `default`, `outline`, `ghost` ; tailles `default`, `sm`, `lg`, `icon`.

- [ ] **Step 4: Token `violet`.** Seule la variante `premium` l'utilisait : retirer `--color-violet` et `--color-violet-foreground` de `theme.css`, et la paire `violet` de `contrast.test.mjs`.

- [ ] **Step 5: Dépendances.** Dans `packages/ui/package.json`, retirer `@radix-ui/react-alert-dialog`, `@radix-ui/react-avatar`, `@radix-ui/react-label`, `@radix-ui/react-select`, `sonner` (et toute autre que knip signale). `pnpm install > /tmp/install.log 2>&1; echo $?` → `0` ; le lockfile suit.

- [ ] **Step 6: Documents morts.** `git rm` des deux specs et deux plans des directions « cahier annoté » et « copie corrigée ». Puis `grep -rn "cahier-annote\|copie-corrigee" docs .claude README.md apps/landing` : réécrire chaque référence restante sans lien vers un fichier supprimé — dans l'identité § 2, la phrase sur « la table de la spec du 2026-09-22 » devient « `packages/tokens/contrast.test.mjs` les vérifie » ; l'en-tête de la spec de refonte dit « Remplace les directions « cahier annoté » et « copie corrigée » » sans chemin ; dans `suivi.md`, les lignes terminées gardent leur numéro de PR, sans lien vers les fichiers.

- [ ] **Step 7: Preuve.** Tous doivent sortir `0` : `pnpm exec knip` ; `pnpm exec knip --include-entry-exports --workspace packages/ui` ; `pnpm --filter @repo/tokens test` ; `pnpm typecheck` ; `pnpm lint` ; `pnpm --filter landing build` ; `pnpm --filter landing test:e2e`. Chaque commande redirigée vers un fichier de log, exit code lu.

- [ ] **Step 8: Suivi.** `docs/superpowers/suivi.md` : la ligne de la refonte de la landing indique la PR 1 en cours (branche `feat/landing-kompri-fondations`), et une entrée datée du journal résume la PR.

- [ ] **Step 9: Commiter.** `refactor(ui): drop the components and variants the landing never uses` (ui, tokens, lockfile), puis `docs(landing): drop the notebook direction documents` (docs et suivi).
