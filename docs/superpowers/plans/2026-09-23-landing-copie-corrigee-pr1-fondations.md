# Landing « La copie corrigée » — PR 1 : fondations — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Une feuille Seyès peinte une fois par page (bande de tête sans horizontales, marge sans verticales), le texte composé des pages secondaires posé sur des fiches collées, et les deux défauts restants de la première vague (débordement des tarifs, conteneur imbriqué de `/aide`).

**Architecture:** Un composant serveur `NotebookSheet` porte trois calques décoratifs (horizontales, verticales, marge) dessinés par des utilitaires de `globals.css`. Un composant client `Fiche` (Motion `whileInView`) porte le texte composé. Le rythme de ligne de base par `lh` et la réglure par section sont retirés. Le test Playwright `test:grid` est réécrit autour de la feuille.

**Tech Stack:** Next.js 16.3 App Router, Tailwind v4.3 (`@utility`), Motion 13.4 (`motion/react`), Playwright 1.63.

**Spec:** `docs/superpowers/specs/2026-09-23-landing-copie-corrigee-design.md` (§1 Fondations, §5 Contraintes, §7 Tests).

## Point de départ

Plan réécrit le 2026-09-23 après la révision de la spec (commit `4e84b94`) ; il remplace
la version exécutée jusqu'à `5bd89c6`. Registre SDD :
`.superpowers/sdd/2026-09-23-landing-copie-corrigee-pr1-fondations/progress.md`. Déjà sur la
branche et conservé :

- `f227e6b` tokens (`background`, `card`, `note`, `input`) ;
- `a8d3d94` pages légales mises en forme, contact `contact@tomia.fr`, promesses V1 ;
- `7246d21`, `89ed4dc` boutons 48 px ; `760c0e4` + `5bd89c6` Playwright et sa règle.

Remplacé par ce plan : `bg-seyes` par section (`041f884`), rythme `lh` (`e901312`), findings
3, 4, 6, 7 de la revue finale (ligne de base du texte composé). Restent valides et traités
ici : finding 1 (tarifs, Task 2), finding 2 (`/aide`, Task 2), demi-pixel de calage
(Task 1), `reuseExistingServer` (Task 1), prérequis `playwright install` (Task 5). Les
points 5, 8 et 10 de la revue deviennent sans objet (plus de réglure par section, footer
refait en PR 2) ; le 9 (note de marge de la démo) est neutralisé en Task 2, la démo part en
PR 3. Hors de cette PR : en-tête et couvertures (PR 2), écriture et Caveat (PR 3), sections
(PR 4).

## Global Constraints

- Worktree `W=/home/ordiv/projets/tomai-monorepo/.claude/worktrees/landing-cahier-annote`, branche `feat/landing-copie-corrigee`. Git uniquement via `git -C $W …`.
- Stager fichier par fichier (jamais `git add .` / `-A`), jamais `--no-verify`, jamais `--amend`.
- Commits `<type>(<scope>): <description>` en anglais, puis une ligne vide, puis `Co-Authored-By: Claude <noreply@anthropic.com>` et `Claude-Session: https://claude.ai/code/session_01Qg7JXj2n5rfm4fz7f8EKRt`.
- Tokens uniquement : aucune couleur littérale hors `packages/tokens/theme.css` et `app/opengraph-image.tsx`.
- Thème clair seul ; site statique ; la landing n'appelle le serveur que par `joinWaitlist`.
- Cibles interactives ≥ 44 px ; contraste texte ≥ 4.5:1, contrôles ≥ 3:1.
- Aucun moteur d'animation maison : Motion, CSS et SVG natifs. Aucune dépendance runtime nouvelle.
- Pas de style inline ; pas d'`eslint-disable`. Fichiers < 400 lignes. Pas de commentaire sauf WHY non évident.
- Validation avant chaque commit, chacune redirigée vers un log et code de sortie lu (`cmd > $LOG 2>&1; echo "exit=$?"`), jamais pipée dans `tail` : `pnpm --dir $W --filter landing typecheck`, `lint`, `build`, `test:grid`.
- `next dev` / `next build` peut ajouter un bloc « nextjs-agent-rules » à `apps/landing/CLAUDE.md` : `git -C $W restore apps/landing/CLAUDE.md`, jamais commité.
- Arrêter un serveur par son PID ou son port exact, jamais `pkill -f next-server`.
- Ne jamais lire de fichier `.env`.

## Review Focus

1. **Largeur impaire au-delà de 80rem (1441 px)** : `margin-inline: auto` donnerait un bord de feuille à x,5 px et des verticales floues ; le bord doit être entier. Testé en Task 1 (largeur 1441).
2. **Mobile 375 px** : la marge passe à 56 px, le contenu reste à droite d'elle et rien ne déborde (bouton des tarifs). Testé en Tasks 1 et 2.
3. **JavaScript désactivé** : Motion rend l'état `initial` (opacité 0) en ligne ; sans JS, fiches et `FadeIn` resteraient invisibles. Testé en Task 3.
4. **Mouvement réduit** : `MotionConfig reducedMotion="user"` coupe les transformations et garde le fondu ; toute fiche doit finir opaque et à sa place. Testé en Task 3.
5. **Texte composé sur la réglure d'une page secondaire** : tout texte de `/aide`, `/faq`, `/contact` et des pages légales vit sur une fiche. Testé en Task 4.

---

### Task 1: Feuille unique par page

**Files:**
- Create: `apps/landing/components/notebook/notebook-sheet.tsx`
- Create (réécriture complète) : `apps/landing/tests/grid.spec.ts`
- Modify: `apps/landing/app/globals.css`
- Modify: `apps/landing/app/page.tsx`, `apps/landing/components/layout/page-layout.tsx`, `apps/landing/app/faq/page.tsx`
- Modify: les neuf racines de section qui portent `bg-seyes` (`hero`, `problem`, `how-it-works`, `input-modes`, `parents`, `trust`, `pricing`, `faq`, `cta` sous `components/sections/`)
- Modify: `apps/landing/playwright.config.ts`

**Interfaces:**
- Produces: `NotebookSheet({ band?: boolean; className?: string; children: React.ReactNode })`, racine `[data-sheet]` (plus `[data-band]` si `band`), calques enfants directs `[data-sheet-rules]`, `[data-sheet-verticals]`, `[data-sheet-margin]`. Variables CSS globales `--cell`, `--rule`, `--band`, `--margin-x`. Utilitaire `container` recalé sur `--margin-x`. Dans `grid.spec.ts` : `SECONDARY`, `PAGES`, `WIDTHS`, `HEIGHT`, `settle(page)`.

- [ ] **Step 1: Écrire le test qui échoue** — remplacer tout `apps/landing/tests/grid.spec.ts` par :

```ts
import { expect, test, type Page } from "@playwright/test";

const SECONDARY = ["/aide", "/faq", "/contact", "/cgu", "/confidentialite", "/mentions-legales"];
const PAGES = ["/", ...SECONDARY];
const WIDTHS = [375, 768, 1024, 1441];
const HEIGHT = 861;

interface Geometry {
  marginX: number;
  band: number;
}

function geometryFor(width: number): Geometry {
  return width >= 768 ? { marginX: 96, band: 96 } : { marginX: 56, band: 64 };
}

async function settle(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(async () => {
    const step = window.innerHeight / 2;
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    }
    window.scrollTo(0, 0);
  });
}

function inspectSheets(page: Page, geometry: Geometry) {
  return page.evaluate(({ marginX, band }) => {
    const near = (a: number, b: number) => Math.abs(a - b) <= 0.5;
    const problems: string[] = [];
    const sheets = [...document.querySelectorAll<HTMLElement>("[data-sheet]")];
    const nested = document.querySelectorAll("[data-sheet] [data-sheet]").length;

    for (const sheet of sheets) {
      const box = sheet.getBoundingClientRect();
      const layer = (name: string) => sheet.querySelector<HTMLElement>(`:scope > [data-sheet-${name}]`)?.getBoundingClientRect();
      const rules = layer("rules");
      const verticals = layer("verticals");
      const margin = layer("margin");
      if (!rules || !verticals || !margin) {
        problems.push("sheet without its three layers");
        continue;
      }
      if (Math.abs(box.left - Math.round(box.left)) > 0.01) problems.push(`sheet left not whole: ${box.left}`);
      if (!near(margin.left - box.left, marginX)) problems.push(`margin at ${margin.left - box.left}, expected ${marginX}`);
      if (!near(verticals.left, margin.left)) problems.push(`verticals start at ${verticals.left}, margin at ${margin.left}`);
      const rulesTop = sheet.hasAttribute("data-band") ? band : 0;
      if (!near(rules.top - box.top, rulesTop)) problems.push(`rules start at ${rules.top - box.top}, expected ${rulesTop}`);

      for (const el of sheet.querySelectorAll<HTMLElement>("p, h1, h2, h3, li, a, button, input")) {
        if (el.closest('[aria-hidden="true"]') || el.getClientRects().length === 0) continue;
        const left = el.getBoundingClientRect().left;
        if (left < margin.right - 0.5) problems.push(`<${el.tagName.toLowerCase()}> over the margin at ${left.toFixed(1)}`);
      }
    }
    return { sheets: sheets.length, nested, problems };
  }, geometry);
}

for (const path of PAGES) {
  for (const width of WIDTHS) {
    test(`${path} at ${width}px is drawn on one Seyès sheet`, async ({ page }) => {
      await page.setViewportSize({ width, height: HEIGHT });
      await page.goto(path);
      await settle(page);
      const { sheets, nested, problems } = await inspectSheets(page, geometryFor(width));
      expect(sheets, "no sheet on the page").toBeGreaterThan(0);
      expect(nested, "a sheet inside a sheet").toBe(0);
      expect(problems, problems.join("\n")).toEqual([]);
    });
  }
}
```

- [ ] **Step 2: Lancer le test, vérifier qu'il échoue**

Run: `pnpm --dir $W --filter landing test:grid > $LOG 2>&1; echo "exit=$?"`
Expected: exit ≠ 0, chaque test en échec sur « no sheet on the page ».

- [ ] **Step 3: Créer `NotebookSheet`** — `apps/landing/components/notebook/notebook-sheet.tsx` :

```tsx
import { cn } from "@repo/ui";

interface NotebookSheetProps {
  band?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function NotebookSheet({ band = false, className, children }: NotebookSheetProps) {
  return (
    <div data-sheet="" data-band={band ? "" : undefined} className={cn("sheet", className)}>
      <div aria-hidden="true" data-sheet-rules="" className={cn("sheet-rules", band && "top-(--band)")} />
      <div aria-hidden="true" data-sheet-verticals="" className="sheet-verticals" />
      <div aria-hidden="true" data-sheet-margin="" className="sheet-margin" />
      {children}
    </div>
  );
}
```

Le nom évite le `Sheet` de shadcn que la PR 2 utilisera pour le menu mobile.

- [ ] **Step 4: Réécrire la géométrie dans `apps/landing/app/globals.css`**

Retirer : le bloc `@theme` des hauteurs de ligne, `@utility bg-seyes`, la règle `top: calc(0.5lh − …)` de `@layer base` et de `legal-copy li`, les variables `--ink-ad` et leurs commentaires Capsize. Ajouter, sous les `@import` :

```css
:root {
  --cell: 2rem;
  --rule: 0.5rem;
  --band: 4rem;
  --margin-x: 3.5rem;
}

@media (width >= 48rem) {
  :root {
    --band: 6rem;
    --margin-x: 6rem;
  }
}

/* Bord gauche entier : `auto` donnerait x,5 px et des verticales floues sur une largeur impaire. */
@utility sheet {
  position: relative;
  isolation: isolate;
  display: flow-root;
  max-width: 80rem;
  margin-inline: auto;
  background-color: var(--color-background);
  box-shadow: 0 0 0 1px var(--color-border);

  @supports (margin-left: round(down, 1px, 1px)) {
    margin-left: max(0px, round(down, (100% - 80rem) / 2, 1px));
  }
}

@utility sheet-rules {
  position: absolute;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  background-image:
    linear-gradient(to bottom, color-mix(in srgb, var(--color-primary) 25%, transparent) 1px, transparent 1px),
    linear-gradient(to bottom, color-mix(in srgb, var(--color-primary) 10%, transparent) 1px, transparent 1px);
  background-size: 100% var(--cell), 100% var(--rule);
}

@utility sheet-verticals {
  position: absolute;
  inset-block: 0;
  left: var(--margin-x);
  right: 0;
  z-index: -1;
  pointer-events: none;
  background-image: linear-gradient(to right, color-mix(in srgb, var(--color-primary) 25%, transparent) 1px, transparent 1px);
  background-size: var(--cell) 100%;
}

@utility sheet-margin {
  position: absolute;
  inset-block: 0;
  left: var(--margin-x);
  width: 2px;
  z-index: -1;
  pointer-events: none;
  background-color: var(--color-annotation);
}
```

Remplacer le corps de `@utility container` par : `margin-inline: auto; width: 100%; max-width: 80rem; padding-left: calc(var(--margin-x) + 1rem); padding-right: 1rem;` et, à partir de `48rem`, `padding-left: calc(var(--margin-x) + var(--cell)); padding-right: 4rem;`. Dans `@layer base`, `body` passe de `bg-background` à `bg-secondary` (bureau autour du cahier, spec §1).

`round()` : Baseline newly available depuis 2024-05-17 (Chrome 125, Firefox 118, Safari 17.2 — https://web-platform-dx.github.io/web-features-explorer/features/round-mod-rem/) ; `@supports` garde `auto` ailleurs. À citer dans le corps du commit.

- [ ] **Step 5: Poser une feuille par page**

- Retirer `bg-seyes` des neuf racines de section (garder leurs autres classes).
- `app/page.tsx` : envelopper toutes les sections dans un seul `<NotebookSheet band>`.
- `components/layout/page-layout.tsx` : la `div` `bg-seyes` devient `<NotebookSheet band className="min-h-[calc(100svh-4rem)] py-12 md:py-24">` autour du `FadeIn` existant.
- `app/faq/page.tsx` : envelopper `<FAQ />` dans `<NotebookSheet band>` (la page passe sur `PageLayout` en Task 4).

- [ ] **Step 6: Toujours tester un build neuf** — dans `apps/landing/playwright.config.ts`, `reuseExistingServer: false` : un serveur resté sur :3011 servirait un ancien build (https://playwright.dev/docs/test-webserver).

- [ ] **Step 7: Lancer le test, vérifier qu'il passe**

Run: `pnpm --dir $W --filter landing test:grid > $LOG 2>&1; echo "exit=$?"`
Expected: exit=0, 28 tests passés (7 pages × 4 largeurs).

- [ ] **Step 8: Valider et commiter** — typecheck, lint, build (codes de sortie lus), `git -C $W restore apps/landing/CLAUDE.md` si besoin, puis :

```bash
git -C $W add apps/landing/components/notebook/notebook-sheet.tsx apps/landing/tests/grid.spec.ts apps/landing/app/globals.css apps/landing/app/page.tsx apps/landing/components/layout/page-layout.tsx apps/landing/app/faq/page.tsx apps/landing/playwright.config.ts apps/landing/components/sections/hero.tsx apps/landing/components/sections/problem.tsx apps/landing/components/sections/how-it-works.tsx apps/landing/components/sections/input-modes.tsx apps/landing/components/sections/parents.tsx apps/landing/components/sections/trust.tsx apps/landing/components/sections/pricing.tsx apps/landing/components/sections/faq.tsx apps/landing/components/sections/cta.tsx
git -C $W commit -m "feat(landing): one Seyès sheet per page with a header band and a plain margin"
```

---

### Task 2: Rien ne déborde de la feuille, `/aide` sans conteneur imbriqué

**Files:**
- Create: `apps/landing/components/sections/faq-list.tsx`
- Modify: `apps/landing/components/sections/faq.tsx`, `apps/landing/app/aide/page.tsx`
- Modify: `apps/landing/components/sections/pricing.tsx`, `apps/landing/components/sections/chat-demo.tsx`
- Test: `apps/landing/tests/grid.spec.ts`

**Interfaces:**
- Consumes: `NotebookSheet`, `[data-sheet]`, `PAGES`, `WIDTHS`, `HEIGHT`, `settle` (Task 1).
- Produces: `FaqList()` — la liste des questions (état ouvert/fermé inclus), sans section, sans `container`, sans en-tête.

- [ ] **Step 1: Écrire les tests qui échouent** — dans `grid.spec.ts`, ajouter à la fin :

```ts
function inspectBounds(page: Page) {
  return page.evaluate(() => {
    const problems: string[] = [];
    if (document.documentElement.scrollWidth > window.innerWidth) {
      problems.push(`page scrolls sideways: ${document.documentElement.scrollWidth} > ${window.innerWidth}`);
    }
    if (document.querySelectorAll(".container .container").length > 0) problems.push("a container inside a container");
    for (const sheet of document.querySelectorAll<HTMLElement>("[data-sheet]")) {
      const box = sheet.getBoundingClientRect();
      for (const el of sheet.querySelectorAll<HTMLElement>("*")) {
        if (el.closest('[aria-hidden="true"]') || el.getClientRects().length === 0) continue;
        const rect = el.getBoundingClientRect();
        if (rect.left < box.left - 0.5 || rect.right > box.right + 0.5) {
          problems.push(`<${el.tagName.toLowerCase()} class="${el.className}"> spans ${rect.left.toFixed(1)}–${rect.right.toFixed(1)}, sheet ${box.left}–${box.right}`);
        }
      }
    }
    return problems;
  });
}

for (const path of PAGES) {
  for (const width of WIDTHS) {
    test(`${path} at ${width}px stays inside its sheet`, async ({ page }) => {
      await page.setViewportSize({ width, height: HEIGHT });
      await page.goto(path);
      await settle(page);
      const problems = await inspectBounds(page);
      expect(problems, problems.join("\n")).toEqual([]);
    });
  }
}
```

- [ ] **Step 2: Lancer, vérifier l'échec** — `test:grid` : exit ≠ 0. Échecs attendus : `/` à 375 et 768 (bouton des tarifs, `size="lg"` = `px-8 whitespace-nowrap`) ; `/` à 1024 et plus si la note de marge de la démo sort à droite (`lg:translate-x-full`) ; `/aide` à toutes les largeurs (« a container inside a container »). Noter tout autre échec et sa cause dans le rapport.

- [ ] **Step 3: Extraire `FaqList`** — `faq-list.tsx` (`"use client"`) reçoit tel quel le bloc `div.space-y-4` de `faq.tsx` (liste, `useState` d'ouverture, `AnimatePresence`). `FAQ` garde sa section, son `container`, son `SectionHeader`, rend `<FaqList />` puis la ligne « Vous avez une autre question ? » ; il n'a plus besoin de `"use client"`. `app/aide/page.tsx` rend `<FaqList />` à la place de `<FAQ />` : un seul conteneur, celui de `PageLayout`.

- [ ] **Step 4: Tarifs** — dans `pricing.tsx`, la grille devient `grid-cols-1 md:grid-cols-2` (pistes `minmax(0, 1fr)` qui ne grandissent plus sur le contenu) ; le bouton garde `size="lg"` (48 px) et reçoit `h-auto min-h-12 whitespace-normal px-6 text-center`, pour que le libellé passe à la ligne au lieu de pousser la carte.

- [ ] **Step 5: Démo** — dans `chat-demo.tsx`, la `MarginNote` perd ses classes `lg:absolute lg:-right-6 lg:mt-0 lg:translate-y-24 lg:w-36 lg:translate-x-full lg:text-left` et reste dans le flux sous la démo (la démo est supprimée en PR 3).

- [ ] **Step 6: Relancer** — `test:grid` : exit=0, 56 tests passés.

- [ ] **Step 7: Valider et commiter** — typecheck, lint, build, puis un commit par cause :

```bash
git -C $W add apps/landing/components/sections/pricing.tsx apps/landing/components/sections/chat-demo.tsx apps/landing/tests/grid.spec.ts
git -C $W commit -m "fix(landing): pricing cards and the demo note stay inside the sheet"
git -C $W add apps/landing/components/sections/faq-list.tsx apps/landing/components/sections/faq.tsx apps/landing/app/aide/page.tsx
git -C $W commit -m "fix(landing): render the help page FAQ inside its own container"
```

---

### Task 3: Fiche collée, visible sans JS et sous mouvement réduit

**Files:**
- Create: `apps/landing/components/notebook/fiche.tsx`
- Modify: `apps/landing/components/atoms/fade-in.tsx`
- Modify: `apps/landing/app/layout.tsx`
- Modify: `apps/landing/app/globals.css`
- Test: `apps/landing/tests/grid.spec.ts`

**Interfaces:**
- Consumes: `settle` (Task 1).
- Produces: `Fiche({ tilt?: "none" | "left" | "right"; variant?: "paper" | "note"; delay?: number; className?: string; children: React.ReactNode })`, racine `[data-fiche][data-reveal]`. Attribut `data-reveal` sur tout bloc que Motion masque avant son entrée (`Fiche`, `FadeIn`). Utilitaire `fiche-tape`.

- [ ] **Step 1: Écrire les tests qui échouent** — dans `grid.spec.ts`, ajouter :

```ts
function hiddenReveals(page: Page) {
  return page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("[data-reveal]")]
      .filter((el) => getComputedStyle(el).opacity !== "1" || getComputedStyle(el).transform !== "none")
      .map((el) => el.textContent?.trim().slice(0, 40) ?? ""),
  );
}

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  for (const path of ["/", "/cgu"]) {
    test(`${path} shows every revealed block`, async ({ page }) => {
      await page.goto(path);
      expect(await page.locator("[data-reveal]").count()).toBeGreaterThan(0);
      expect(await hiddenReveals(page)).toEqual([]);
    });
  }
});

for (const path of ["/", "/cgu"]) {
  test(`${path} ends every reveal opaque and in place under reduced motion`, async ({ page }) => {
    await page.goto(path);
    await settle(page);
    await expect.poll(() => hiddenReveals(page)).toEqual([]);
  });
}
```

`javaScriptEnabled` et `reducedMotion` sont des `TestOptions` de Playwright 1.63 (`playwright/types/test.d.ts` ; https://playwright.dev/docs/api/class-testoptions) ; la config impose déjà `reducedMotion: "reduce"`.

- [ ] **Step 2: Lancer, vérifier l'échec** — `test:grid` : les deux tests « without JavaScript » échouent (`[data-reveal]` absent) ; noter le résultat des tests « reduced motion ».

- [ ] **Step 3: Créer `Fiche`** — `apps/landing/components/notebook/fiche.tsx` :

```tsx
"use client";

import { motion, type Variants } from "motion/react";
import { cn } from "@repo/ui";

const TILTS = {
  none: "",
  left: "-rotate-[0.6deg]",
  right: "rotate-[0.8deg]",
} as const;

const PASTE: Variants = {
  hidden: { opacity: 0, y: -12, rotate: -2.5, scale: 1.03 },
  shown: { opacity: 1, y: 0, rotate: 0, scale: 1 },
};

interface FicheProps {
  tilt?: keyof typeof TILTS;
  variant?: "paper" | "note";
  delay?: number;
  className?: string;
  children: React.ReactNode;
}

export function Fiche({ tilt = "left", variant = "paper", delay = 0, className, children }: FicheProps) {
  return (
    <motion.div
      data-fiche=""
      data-reveal=""
      variants={PASTE}
      initial="hidden"
      whileInView="shown"
      viewport={{ once: true, margin: "0px 0px -10% 0px" }}
      transition={{ duration: 0.65, delay, ease: [0.2, 0.8, 0.2, 1] }}
      className={cn(
        "relative p-6 shadow-md md:p-8",
        variant === "paper" ? "fiche-tape bg-card text-card-foreground" : "bg-note text-note-foreground",
        TILTS[tilt],
        className,
      )}
    >
      {children}
    </motion.div>
  );
}
```

La rotation de repos passe par la propriété CSS `rotate` (Tailwind 4.3 compile `-rotate-[0.6deg]` en `rotate: calc(0.6deg * -1)`), celle de l'entrée par le `transform` de Motion : les deux se composent.

- [ ] **Step 4: Ruban adhésif et état final sans JS** — dans `globals.css` :

```css
@utility fiche-tape {
  &::before {
    content: "";
    position: absolute;
    top: -0.75rem;
    left: -1rem;
    width: 5rem;
    height: 1.5rem;
    rotate: -30deg;
    background-color: color-mix(in srgb, var(--color-note) 55%, transparent);
    box-shadow: 0 1px 2px color-mix(in srgb, var(--color-foreground) 12%, transparent);
  }
}
```

Dans `app/layout.tsx`, en tête de `<body>` :

```tsx
<noscript>
  <style>{"[data-reveal]{opacity:1!important;transform:none!important}"}</style>
</noscript>
```

Vérifier sur le HTML du build que la règle est émise : `curl -s localhost:3011/cgu | grep -c 'data-reveal\]{opacity'` doit valoir 1. Sinon, passer par `dangerouslySetInnerHTML={{ __html: "<style>…</style>" }}` sur le `<noscript>`, comme le JSON-LD voisin, et le dire dans le rapport.

- [ ] **Step 5: `FadeIn`** — ajouter `data-reveal=""` à son `motion.div`.

- [ ] **Step 6: Relancer** — `test:grid` : exit=0, 60 tests passés. Si un test « reduced motion » échoue sur un `transform` identité écrit autrement que `none` (`matrix(1, 0, 0, 1, 0, 0)`), accepter aussi cette valeur dans `hiddenReveals` et le justifier dans le rapport.

- [ ] **Step 7: Valider et commiter**

```bash
git -C $W add apps/landing/components/notebook/fiche.tsx apps/landing/components/atoms/fade-in.tsx apps/landing/app/layout.tsx apps/landing/app/globals.css apps/landing/tests/grid.spec.ts
git -C $W commit -m "feat(landing): pasted card component, visible without JavaScript"
```

---

### Task 4: Texte composé des pages secondaires sur des fiches

**Files:**
- Modify: `apps/landing/components/layout/page-layout.tsx`
- Modify: `apps/landing/app/aide/page.tsx`, `apps/landing/app/contact/page.tsx`, `apps/landing/app/faq/page.tsx`, `apps/landing/app/cgu/page.tsx`, `apps/landing/app/confidentialite/page.tsx`, `apps/landing/app/mentions-legales/page.tsx`
- Test: `apps/landing/tests/grid.spec.ts`

**Interfaces:**
- Consumes: `NotebookSheet` (Task 1), `FaqList` (Task 2), `Fiche` (Task 3), `SECONDARY`, `settle` (Task 1).

- [ ] **Step 1: Écrire le test qui échoue** — dans `grid.spec.ts`, ajouter :

```ts
function textOffCards(page: Page) {
  return page.evaluate(() => {
    const loose: string[] = [];
    const walker = document.createTreeWalker(document.querySelector("main") ?? document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node.textContent?.trim();
      const parent = node.parentElement;
      if (!text || !parent || parent.closest('[aria-hidden="true"], script, style, noscript')) continue;
      if (parent.getClientRects().length === 0) continue;
      if (!parent.closest("[data-fiche]")) loose.push(text.slice(0, 40));
    }
    return loose;
  });
}

for (const path of SECONDARY) {
  test(`${path} keeps its typed text on cards`, async ({ page }) => {
    await page.goto(path);
    await settle(page);
    expect(await textOffCards(page)).toEqual([]);
  });
}
```

- [ ] **Step 2: Lancer, vérifier l'échec** — les six tests échouent (titres de `SectionHeader` et textes posés sur la feuille).

- [ ] **Step 3: `PageLayout`** — dans la feuille de Task 1, le `FadeIn` est remplacé par une `div` `container` (même largeur max) qui contient une seule `<Fiche tilt="none">` : `SectionHeader` (`align="left"`, `className="mb-8"`) puis `children`. La fiche porte déjà son entrée ; garder `FadeIn` empilerait deux animations sur le même contenu. Les pages ne posent plus leur propre carte.

- [ ] **Step 4: Pages**
  - Pages légales et contact : retirer la `div` carte (`rounded-2xl bg-card … ring-1 ring-border`) autour du contenu ; garder `legal-copy` et le contenu tels quels.
  - `/aide` : le bloc « Une question ? » perd sa carte ; `<FaqList />` le suit, avec `mt-12`, dans la même fiche.
  - `/faq` : `PageLayout` (`title="Questions fréquentes"`, `description` reprise de la métadonnée de la page) avec `<FaqList />` puis la ligne « Vous avez une autre question ? Contactez-nous » ; la `NotebookSheet` posée en Task 1 disparaît au profit de celle de `PageLayout`.

- [ ] **Step 5: Relancer** — `test:grid` : exit=0, 66 tests passés.

- [ ] **Step 6: Valider et commiter**

```bash
git -C $W add apps/landing/components/layout/page-layout.tsx apps/landing/app/aide/page.tsx apps/landing/app/contact/page.tsx apps/landing/app/faq/page.tsx apps/landing/app/cgu/page.tsx apps/landing/app/confidentialite/page.tsx apps/landing/app/mentions-legales/page.tsx apps/landing/tests/grid.spec.ts
git -C $W commit -m "feat(landing): secondary pages set their text on pasted cards"
```

---

### Task 5: Règles, suivi et passe visuelle

**Files:**
- Modify: `.claude/rules/testing-and-commits.md`
- Modify: `docs/superpowers/suivi.md`
- Modify: toute mention vivante de `bg-seyes`, du rythme `lh` ou de Capsize, hors specs et plans datés (repérage : `grep -rln "bg-seyes\|ink-ad\|capsize" $W/.claude $W/apps/landing --include=*.md`)

- [ ] **Step 1: Règle de test** — dans `.claude/rules/testing-and-commits.md`, ligne Landing : prérequis unique `pnpm --filter landing exec playwright install chromium`, et ce que couvre `test:grid` (feuille, bornes, fiches, sans JS, mouvement réduit).

- [ ] **Step 2: Suivi** — dans `docs/superpowers/suivi.md`, section « Hors lot 0 » : la ligne PR 1 décrit la feuille unique et les fiches ; ajouter trois lignes « à faire » — PR 2 Couvertures, PR 3 Écriture, PR 4 Sections — plan « à écrire au démarrage ». Au journal, compléter l'entrée 2026-09-23 : pivot « fiches collées », couvertures, spec révisée (`4e84b94`), commits remplacés (`041f884`, `e901312`).

- [ ] **Step 3: Passe visuelle et UX** — build puis `next start --port 3011` ; captures Playwright de `/`, `/aide`, `/cgu` à 375, 768 et 1440, sous mouvement réduit et normal ; chemins dans le rapport. Contrôler et rapporter, avec la mesure :
  - largeur utile du texte à 375 px (≥ 280 px) et longueur de ligne des pages légales à 1440 px (≤ ~85 caractères, sinon `max-w-prose` sur `legal-copy`) ;
  - contenu au-dessus de la ligne de flottaison lisible en moins de 0,7 s après le chargement (une seule animation par bloc, aucune attente de défilement) ;
  - aucun saut de mise en page à l'apparition des fiches (`y` et `scale` passent par `transform`) ;
  - ruban adhésif qui ne recouvre aucun texte ; cibles ≥ 44 px ; focus visible au clavier sur les liens et boutons des fiches ;
  - lignes de la réglure discrètes sous le texte des fiches (aucune ne transparaît).
  Tout défaut se corrige dans cette tâche, commit `fix(landing): …` séparé. Arrêter le serveur par son PID.

- [ ] **Step 4: Valider et commiter** — typecheck, lint, build, `test:grid` (codes de sortie lus), puis :

```bash
git -C $W add .claude/rules/testing-and-commits.md docs/superpowers/suivi.md
git -C $W commit -m "docs: record the one-sheet foundations and the notebook PR sequence"
```
