# Landing « La copie corrigée » — PR 1 : fondations — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Poser la feuille Seyès sous tout le texte de la landing : fonds blancs, réglure et marge peintes par section et calées sur le conteneur, ligne de base de chaque bloc de texte sur une ligne, pages légales et footer au format de la nouvelle DA, contact et promesses honnêtes.

**Architecture:** Les couleurs changent dans `@repo/tokens` (testées par `contrast.test.mjs`). Toute la géométrie vit dans `apps/landing/app/globals.css` : un utilitaire `bg-seyes` que chaque section porte, un `container` aligné sur la grille, des hauteurs de ligne multiples de 8 et une règle de base qui décale chaque bloc de texte pour que sa ligne de base tombe sur une ligne (unité `lh`). Aucune nouvelle dépendance ; aucune animation nouvelle.

**Tech Stack:** Tailwind v4.3 (`@theme`, `@utility`, `@layer base`), Next.js 16.3 App Router, `node:test`.

**Spec:** `docs/superpowers/specs/2026-09-23-landing-copie-corrigee-design.md` (§1 Fondations, §4 « Contact et aide », §5-7).

## Global Constraints

- Worktree `W=/home/ordiv/projets/tomai-monorepo/.claude/worktrees/landing-cahier-annote`, branche `feat/landing-copie-corrigee`. Git uniquement via `git -C $W …`.
- Stager fichier par fichier (jamais `git add .` / `-A`), jamais `--no-verify`, jamais `--amend`.
- Commits `<type>(<scope>): <description>` en anglais, suivis d'une ligne vide puis `Co-Authored-By: Claude <noreply@anthropic.com>`.
- Tokens uniquement dans les composants : aucune couleur littérale hors `packages/tokens/theme.css` et `app/opengraph-image.tsx`.
- Thème clair seul ; site statique ; la landing n'appelle le serveur que par `joinWaitlist`.
- Cibles interactives ≥ 44 px ; contraste texte ≥ 4.5:1, contrôles ≥ 3:1.
- Tout espacement vertical (`m*`, `p*`, `space-y-*`, `gap-*` en colonne) est un multiple de 8 px : `-2`, `-4`, `-6`, `-8`, `-10`, `-12`, `-16`, `-20`, `-24`, `-32`. Jamais `-1`, `-3`, `-5`, `-0.5`, `-1.5`.
- Aucune bordure horizontale (`border`, `border-y`, `border-t`, `border-b`) sur un bloc du flux : `ring-*` ou `shadow-*` à la place (1 px décalerait les lignes). `border-l-*` reste permis.
- Aucun utilitaire `leading-*` dans la landing.
- Fichiers < 400 lignes. Pas de commentaire sauf WHY non évident.
- Validation avant chaque commit : `pnpm --dir $W --filter landing typecheck`, `lint`, `build` (et `--filter @repo/tokens test` en Task 1), chacune redirigée vers un log, code de sortie lu (`cmd > /tmp/x.log 2>&1; echo "exit=$?"`), jamais pipée dans `tail`.
- `next dev` / `next build` peut ajouter un bloc « nextjs-agent-rules » à `apps/landing/CLAUDE.md` : `git -C $W restore apps/landing/CLAUDE.md`, jamais commité.
- Ne jamais lire de fichier `.env`.

## Review Focus

1. **Largeur 1248-1263 px avec barre de défilement** : la section est plus étroite que le viewport ; la marge doit rester sur une verticale et le contenu à droite d'elle (le calage lit la largeur de la section, pas le viewport). Testé en Task 5 (iframe 1260).
2. **Titre sur plusieurs lignes à 375 px** : chaque ligne a sa ligne de base sur une ligne de la réglure (hauteur de ligne multiple de 8). Testé en Task 5 (iframe 375, `h1` du hero).
3. **Police pas encore chargée** : les métriques du fallback diffèrent ; la mesure n'a de sens qu'après `document.fonts.ready`. Le script de Task 5 l'attend.
4. **Animations d'entrée en cours** (`FadeIn` translate en y) : une mesure prise pendant l'animation est fausse. Le script de Task 5 tourne après stabilisation et sous `prefers-reduced-motion`.
5. **Zoom navigateur 125 %** : cellules et hauteurs de ligne sont en `rem`, elles changent d'échelle ensemble ; la marge reste sur une verticale. Testé en Task 5 (zoom via `document.documentElement.style.fontSize` à 20px dans l'iframe).

---

### Task 1: Papier blanc et nouveaux fonds dans `@repo/tokens`

**Files:**
- Modify: `packages/tokens/contrast.test.mjs`
- Modify: `packages/tokens/theme.css`
- Modify: `.claude/rules/design-system.md`

**Interfaces:**
- Produces: tokens `--color-note`, `--color-note-foreground` (utilitaires `bg-note`, `text-note-foreground`) ; nouvelles valeurs `background`, `card`, `popover`, `secondary`, `muted`, `accent`, `border`, `input`.

- [ ] **Step 1: Écrire les tests qui échouent** — dans `packages/tokens/contrast.test.mjs`, ajouter à la fin du tableau `PAIRS` :

```js
  ["note-foreground", "note"],
  ["foreground", "note"],
  ["primary", "note"],
  ["annotation", "note"],
```

puis, après la boucle existante, un second jeu au seuil des contrôles :

```js
const CONTROL_PAIRS = [
  ["input", "background"],
  ["input", "card"],
];

for (const [fg, bg] of CONTROL_PAIRS) {
  test(`${fg} on ${bg} meets WCAG 1.4.11 (3:1)`, () => {
    assert.ok(palette[fg], `missing --color-${fg}`);
    assert.ok(palette[bg], `missing --color-${bg}`);
    const ratio = contrast(palette[fg], palette[bg]);
    assert.ok(ratio >= 3, `${palette[fg]} on ${palette[bg]} = ${ratio.toFixed(2)}`);
  });
}
```

- [ ] **Step 2: Vérifier l'échec** : `pnpm --dir $W --filter @repo/tokens test > /tmp/tok.log 2>&1; echo "exit=$?"` → `exit=1` ; le log contient `missing --color-note` et `input on background` sous 3:1 (`#E7E0D2`).

- [ ] **Step 3: Nouvelles valeurs dans `packages/tokens/theme.css`** — remplacer le commentaire de couleurs par `/* Couleurs sémantiques (light) — « Copie corrigée » : papier blanc, réglure bleue, stylo Bic quatre couleurs */` et fixer exactement :

```css
  --color-background: #FCFCFA;
  --color-secondary: #F3F5FB;
  --color-muted: #F3F5FB;
  --color-accent: #F3F5FB;
  --color-card: #FFFFFF;
  --color-popover: #FFFFFF;
  --color-border: #D9DFF0;
  --color-input: #7F8BB8;
```

et ajouter, juste après `--color-highlight` :

```css
  --color-note: #FFF3B0;
  --color-note-foreground: #1D1D22;
```

Toutes les autres lignes de couleur restent inchangées.

- [ ] **Step 4: Vérifier le succès** : même commande → `exit=0`, `# pass 32`, `# fail 0` (26 existants + 4 paires + 2 contrôles).

- [ ] **Step 5: Règle design-system** — dans `.claude/rules/design-system.md`, sous la puce « A11y AA », ajouter :

```markdown
- **Papier** : fond `background` blanc, objets posés en `card` ou `note` (post-it) ;
  pas de bande de fond pleine largeur. Jamais `annotation` sur `highlight` (4,48:1).
```

- [ ] **Step 6: Valider** : `pnpm --dir $W --filter @repo/ui typecheck` → 0 ; `pnpm --dir $W --filter landing build` → 0.

- [ ] **Step 7: Commit** : `git -C $W add packages/tokens/contrast.test.mjs`, puis `packages/tokens/theme.css`, puis `.claude/rules/design-system.md` ; message `feat(tokens): white paper, note and control-contrast tokens`.

---

### Task 2: Feuille Seyès et marge peintes par section

**Files:**
- Modify: `apps/landing/app/globals.css` (remplacer `@utility bg-notebook` et `@utility container`)
- Modify: `apps/landing/app/layout.tsx:141-142` (supprimer les deux calques `fixed`)
- Modify: `apps/landing/components/layout/page-layout.tsx:13-14`
- Modify: `apps/landing/components/sections/{hero,problem,how-it-works,input-modes,parents,trust,pricing,faq,cta}.tsx` (racine `<section>`)

**Interfaces:**
- Consumes: `--color-primary`, `--color-annotation`, `--color-background` (Task 1).
- Produces: utilitaire `bg-seyes` (section = une feuille : réglure, verticales calées, marge) ; utilitaire `container` aligné sur la grille. Les PR suivantes posent chaque bloc sur ces deux utilitaires.

- [ ] **Step 1: Remplacer les utilitaires** — dans `globals.css`, supprimer le bloc `@utility bg-notebook { … }` et le bloc `@utility container { … }`, et mettre à la place :

```css
/* Seyès : carreau 32 px, interlignes 8 px. Les verticales sont peintes par ::before
 * car les % de background-position ne se rapportent pas à la largeur de la boîte ;
 * `left` en % se rapporte à la largeur de la section, barre de défilement exclue. */
@utility bg-seyes {
  --cell: 2rem;
  --rule: 0.5rem;
  --sheet-x: max(0px, calc((100% - 78rem) / 2));
  --margin-index: 1;
  position: relative;
  isolation: isolate;
  overflow-x: clip;
  background-color: var(--color-background);
  background-image:
    linear-gradient(to bottom, color-mix(in srgb, var(--color-primary) 25%, transparent) 1px, transparent 1px),
    linear-gradient(to bottom, color-mix(in srgb, var(--color-primary) 10%, transparent) 1px, transparent 1px);
  background-size: 100% var(--cell), 100% var(--rule);

  &::before {
    content: "";
    position: absolute;
    inset-block: 0;
    left: calc(var(--sheet-x) - 40 * var(--cell));
    right: 0;
    z-index: -1;
    pointer-events: none;
    background-image: linear-gradient(to right, color-mix(in srgb, var(--color-primary) 25%, transparent) 1px, transparent 1px);
    background-size: var(--cell) 100%;
  }

  &::after {
    content: "";
    position: absolute;
    inset-block: 0;
    left: calc(var(--sheet-x) + var(--margin-index) * var(--cell));
    width: 2px;
    z-index: -1;
    pointer-events: none;
    background-color: var(--color-annotation);
  }

  @media (width >= 48rem) {
    --margin-index: 2;
  }

  @media (width >= 64rem) {
    --margin-index: 3;
  }
}

/* 78rem = 39 carreaux : centré, son bord gauche tombe sur une verticale.
 * Padding gauche = marge + ½ carreau (mobile), + 1 carreau (md, lg). */
@utility container {
  margin-inline: auto;
  width: 100%;
  max-width: 78rem;
  padding-left: 3rem;
  padding-right: 1rem;

  @media (width >= 48rem) {
    padding-left: 6rem;
    padding-right: 4rem;
  }

  @media (width >= 64rem) {
    padding-left: 8rem;
  }
}
```

Source nesting dans `@utility` : https://tailwindcss.com/docs/adding-custom-styles#adding-custom-utilities (exemple `&::-webkit-scrollbar`). Après build, vérifier dans `apps/landing/.next/static/chunks/*.css` que `.bg-seyes::before`, `.bg-seyes::after` et les deux `@media` de `--margin-index` sont émis ; sinon, sortir les pseudo-éléments en `@layer components { .bg-seyes::before { … } }` et le signaler dans le rapport.

- [ ] **Step 2: Supprimer les calques fixes** — dans `app/layout.tsx`, supprimer les lignes :

```tsx
            <div aria-hidden="true" className="bg-notebook pointer-events-none fixed inset-0 -z-50" />
            <div aria-hidden="true" className="pointer-events-none fixed inset-y-0 left-6 -z-40 hidden w-0.5 bg-annotation/70 md:block lg:left-10" />
```

- [ ] **Step 3: Chaque section devient une feuille** — remplacer la `className` de la racine `<section>` :

| Fichier | Avant | Après |
|---|---|---|
| `sections/hero.tsx:20` | `flex min-h-[calc(100svh-4rem)] items-center py-16 lg:py-24` | `bg-seyes flex min-h-[calc(100svh-4rem)] items-center py-16 lg:py-24` |
| `sections/problem.tsx:6` | `border-y border-border bg-secondary py-20` | `bg-seyes py-20` |
| `sections/how-it-works.tsx:38` | `scroll-mt-20 py-24 lg:py-32` | `bg-seyes scroll-mt-20 py-24 lg:py-32` |
| `sections/input-modes.tsx:12` | `pb-24 lg:pb-32` | `bg-seyes pb-24 lg:pb-32` |
| `sections/parents.tsx:15` | `scroll-mt-20 bg-secondary py-24 lg:py-32` | `bg-seyes scroll-mt-20 py-24 lg:py-32` |
| `sections/trust.tsx:14` | `py-24 lg:py-32` | `bg-seyes py-24 lg:py-32` |
| `sections/pricing.tsx:36` | `scroll-mt-20 py-24 lg:py-32` | `bg-seyes scroll-mt-20 py-24 lg:py-32` |
| `sections/faq.tsx:14` | `scroll-mt-20 bg-secondary py-24 lg:py-32` | `bg-seyes scroll-mt-20 py-24 lg:py-32` |
| `sections/cta.tsx:5` | `scroll-mt-20 py-24` | `bg-seyes scroll-mt-20 py-24` |

- [ ] **Step 4: Pages secondaires** — dans `components/layout/page-layout.tsx` :

```tsx
    <div className="bg-seyes min-h-[calc(100vh-4rem)] py-12 md:py-24">
      <FadeIn className={`container ${maxWidth === "5xl" ? "max-w-5xl" : "max-w-4xl"}`}>
```

(`px-4` et `overflow-hidden` retirés : `bg-seyes` clippe déjà en x, et le `px-4` écrasait le padding aligné.)

- [ ] **Step 5: Vérifier qu'aucun reste n'existe** : `grep -rnE "bg-notebook|bg-secondary py|border-y" $W/apps/landing/app $W/apps/landing/components` → aucune ligne (exit 1).

- [ ] **Step 6: Preuve de rendu** : `pnpm --dir $W --filter landing build` → 0 ; `grep -o "bg-seyes" $W/apps/landing/.next/server/app/index.html | wc -l` → 9 ; et la présence de `.bg-seyes:after` (ou `::after`) dans le CSS compilé.

- [ ] **Step 7: Commit** : typecheck + lint + build à 0, fichiers un par un ; `feat(landing): Seyès sheet and margin painted per section`.

---

### Task 3: Rythme vertical — hauteurs de ligne, ligne de base, espacements, cartes

**Files:**
- Modify: `apps/landing/app/globals.css` (`@theme` des hauteurs de ligne, règle de ligne de base)
- Modify: `apps/landing/components/sections/{hero,problem,how-it-works,input-modes,parents,pricing,faq}.tsx`, `components/atoms/section-header.tsx`, `components/molecules/mobile-cta-bar.tsx`

**Interfaces:**
- Consumes: `bg-seyes`, `container` (Task 2).
- Produces: variable héritée `--ink-ad` ; tout `p`, `h1`-`h6`, `dt`, `dd`, `blockquote` est décalé pour poser sa ligne de base sur le bas de sa ligne. Les PR suivantes n'ajoutent pas de `leading-*` et utilisent des espacements pairs.

- [ ] **Step 1: Hauteurs de ligne multiples de 8** — dans `globals.css`, après les `@import` :

```css
@theme {
  --text-xs--line-height: 1rem;
  --text-sm--line-height: 1.5rem;
  --text-base--line-height: 1.5rem;
  --text-lg--line-height: 2rem;
  --text-xl--line-height: 2rem;
  --text-2xl--line-height: 2rem;
  --text-3xl--line-height: 2.5rem;
  --text-4xl--line-height: 3rem;
  --text-5xl--line-height: 3.5rem;
  --text-6xl--line-height: 4rem;
  --text-7xl--line-height: 5rem;
  --text-8xl--line-height: 6rem;
}
```

Source : https://tailwindcss.com/docs/font-size#customizing-your-theme (`--text-*--line-height`).

- [ ] **Step 2: Ligne de base sur la ligne** — dans le `@layer base` existant de `globals.css`, remplacer `body { @apply bg-background font-sans text-foreground antialiased; }` par :

```css
  /* (ascent − |descent|) / unitsPerEm, @capsizecss/metrics 4.3.0 :
   * Figtree 950/250/1000, Fraunces 1956/510/2000. */
  body {
    --ink-ad: 0.7;
    @apply bg-background font-sans text-foreground antialiased;
  }

  h1, h2, h3, h4, h5, h6, .font-heading {
    --ink-ad: 0.723;
  }

  /* Décale chaque bloc pour que la ligne de base tombe sur le bas de sa ligne,
   * donc sur une ligne de la réglure quand le bloc démarre sur une ligne. */
  p, h1, h2, h3, h4, h5, h6, dt, dd, blockquote {
    position: relative;
    top: calc(0.5lh - var(--ink-ad) * 0.5em);
  }
```

Garder le bloc `h1, h2, … { @apply font-heading tracking-tight; }` existant. Source `lh` : https://developer.mozilla.org/en-US/docs/Web/CSS/length#lh ; support : https://web-platform-dx.github.io/web-features-explorer/features/lh/ (Chrome 109, Firefox 120, Safari 16.4).

- [ ] **Step 3: Retirer les `leading-*`** — supprimer la classe (et elle seule) à ces emplacements :

| Fichier:ligne | Classe retirée |
|---|---|
| `components/layout/footer.tsx:14` | `leading-relaxed` (fichier réécrit en Task 4 : sauter si déjà fait) |
| `components/sections/faq.tsx:61` | `leading-relaxed` |
| `components/sections/hero.tsx:23` | `leading-tight` |
| `components/sections/hero.tsx:39` | `leading-relaxed` |
| `components/sections/problem.tsx:8` | `leading-snug` |
| `components/sections/how-it-works.tsx:49` | `leading-relaxed` |
| `app/contact/page.tsx:36` | `leading-relaxed` (bloc supprimé en Task 4 : sauter) |

`components/sections/chat-demo.tsx` n'est pas touché : il disparaît en PR 4.

- [ ] **Step 4: Espacements pairs** :

| Fichier | Avant | Après |
|---|---|---|
| `components/atoms/section-header.tsx` | `mb-3` | `mb-4` |
| `components/sections/how-it-works.tsx` | `mb-3` | `mb-4` |
| `components/sections/pricing.tsx` | `space-y-3` | `space-y-4` |
| `components/sections/pricing.tsx` | `mt-0.5` | *(retiré)* |
| `components/sections/pricing.tsx` | `gap-3` | `gap-4` |
| `components/sections/parents.tsx` | `mt-1` | `mt-2` |
| `components/sections/parents.tsx` | `mb-1` | `mb-2` |
| `components/sections/input-modes.tsx` | `mt-1` | `mt-2` |
| `components/molecules/mobile-cta-bar.tsx` | `p-3` | `p-4` |

| `components/sections/hero.tsx:20` | `items-center` | `items-start` (un centrage vertical place le texte à une hauteur arbitraire ; la section garde sa hauteur plein écran) |
| `components/sections/hero.tsx:21` | `items-center` (grille du conteneur) | `items-start` |

Tout bouton posé dans le flux du texte (pas dans une rangée avec d'autres éléments plus hauts) prend `size="lg"` (48 px) : une hauteur de 44 px décalerait tout ce qui suit.

Puis : `grep -rnoE "\b(m[tby]?|p[tby]?|space-y|gap-y)-(1|3|5|7|9|11|0\.5|1\.5|2\.5|3\.5)\b" $W/apps/landing/app $W/apps/landing/components --include=*.tsx | grep -v chat-demo` → seules restent les occurrences de `footer.tsx`, `contact/page.tsx` et `aide/page.tsx` (réécrits en Task 4) ; `gap-*` sur une rangée horizontale (`flex` sans `flex-col`) est permis.

- [ ] **Step 5: Cartes en `ring`** :

| Fichier:ligne | Avant | Après |
|---|---|---|
| `sections/input-modes.tsx:14` | `rounded-2xl border border-border bg-card` | `rounded-2xl bg-card shadow-sm ring-1 ring-border` |
| `sections/faq.tsx:25` | `bg-card border border-border rounded-2xl overflow-hidden transition-colors duration-base hover:border-primary` | `bg-card rounded-2xl overflow-hidden shadow-sm ring-1 ring-border transition-shadow duration-base hover:ring-primary` |
| `sections/parents.tsx:28` | `rounded-2xl border border-border bg-card` | `rounded-2xl bg-card shadow-sm ring-1 ring-border` |
| `sections/pricing.tsx:48` | `rounded-2xl border bg-card p-8` | `rounded-2xl bg-card p-8 shadow-sm` |
| `sections/pricing.tsx:49` | `plan.featured ? "border-2 border-primary" : "border-border"` | `plan.featured ? "ring-2 ring-primary" : "ring-1 ring-border"` |

- [ ] **Step 6: Contrôle** : `grep -rnE "\bborder(-[xytb])?\b [^\"]*border-border|border-2|leading-" $W/apps/landing/components --include=*.tsx | grep -v chat-demo | grep -v "layout/header\|layout/footer"` → aucune ligne. (Header : PR 2 ; footer : Task 4.)

- [ ] **Step 7: Commit** : typecheck + lint + build à 0, fichiers un par un ; `feat(landing): baseline rhythm on the Seyès rules`.

---

### Task 4: Footer en 4e de couverture, pages légales, contact et aide honnêtes

**Files:**
- Modify: `apps/landing/app/globals.css` (utilitaire `legal-copy`)
- Modify: `apps/landing/components/layout/footer.tsx` (réécriture)
- Modify: `apps/landing/app/{cgu,confidentialite,mentions-legales}/page.tsx`
- Modify: `apps/landing/app/contact/page.tsx`, `apps/landing/app/aide/page.tsx`

**Interfaces:**
- Consumes: `bg-seyes`, `container`, `--ink-ad` (Tasks 2-3) ; `BRAND_NAME` (`@/lib/brand`).
- Produces: utilitaire `legal-copy`.

- [ ] **Step 1: Utilitaire `legal-copy`** — dans `globals.css`, après `@utility container` :

```css
@utility legal-copy {
  color: var(--color-muted-foreground);

  & h3 {
    margin-top: 2rem;
    margin-bottom: 0.5rem;
    font-size: var(--text-xl);
    line-height: 2rem;
    font-weight: 600;
    color: var(--color-foreground);
  }

  & h3:first-child {
    margin-top: 0;
  }

  & p,
  & ul {
    margin-bottom: 1rem;
  }

  & ul {
    list-style: disc;
    padding-left: 1.5rem;
  }

  & li {
    position: relative;
    top: calc(0.5lh - var(--ink-ad) * 0.5em);
    margin-bottom: 0.5rem;
  }

  & a {
    color: var(--color-primary);
    text-decoration: underline;
    text-underline-offset: 4px;
  }

  & strong {
    font-weight: 600;
    color: var(--color-foreground);
  }
}
```

Avant d'écrire : `grep -nE "<li>\s*<p|<h2|<h4|<table" $W/apps/landing/app/{cgu,confidentialite,mentions-legales}/page.tsx` ; si un `li` contient un `p` (double décalage) ou si un autre niveau de titre existe, l'ajouter au style et le signaler.

- [ ] **Step 2: Pages légales** — dans chacun des trois fichiers, remplacer :

```tsx
      <div className="rounded-2xl border border-border bg-card p-8 md:p-12">
        <div className="prose prose-slate max-w-none prose-headings:font-bold prose-a:text-primary prose-a:no-underline hover:prose-a:underline">
```

(la seconde ligne peut différer légèrement selon le fichier : remplacer la `className` entière de ce `div` interne) par :

```tsx
      <div className="rounded-2xl bg-card p-8 shadow-sm ring-1 ring-border md:p-12">
        <div className="legal-copy">
```

Puis remplacer chaque `contact@tomai.fr` par `contact@tomia.fr` (`cgu`, `confidentialite`) : `grep -rn "tomai\.fr" $W/apps/landing` → aucune ligne à la fin de la tâche.

- [ ] **Step 3: Footer** — remplacer tout `components/layout/footer.tsx` par :

```tsx
import Link from "next/link";
import { BRAND_NAME } from "@/lib/brand";

const LINK_GROUPS = [
  {
    title: "Produit",
    links: [
      { href: "/#how-it-works", label: "Comment ça marche" },
      { href: "/#parents", label: "Parents" },
      { href: "/#pricing", label: "Tarifs" },
    ],
  },
  {
    title: "Aide",
    links: [
      { href: "/aide", label: "Centre d'aide" },
      { href: "/contact", label: "Contact" },
    ],
  },
  {
    title: "Légal",
    links: [
      { href: "/confidentialite", label: "Confidentialité" },
      { href: "/cgu", label: "CGU" },
      { href: "/mentions-legales", label: "Mentions légales" },
    ],
  },
] as const;

export function Footer() {
  return (
    <footer className="bg-primary text-primary-foreground">
      <div className="container py-16 md:py-20">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-4">
          <div className="space-y-4">
            <p className="font-heading text-2xl font-semibold">{BRAND_NAME}</p>
            <p className="max-w-xs text-sm text-primary-foreground/80">
              L&apos;assistant qui aide les collégiens à comprendre leurs leçons, sans faire leurs exercices à leur place.
            </p>
            <ul className="space-y-2 text-sm text-primary-foreground/80">
              <li>Hébergé dans l&apos;Union européenne</li>
              <li>Sans publicité</li>
              <li>Dans le navigateur, sur ordinateur, tablette ou téléphone</li>
            </ul>
          </div>

          {LINK_GROUPS.map((group) => (
            <nav key={group.title} aria-label={group.title}>
              <p className="mb-4 text-sm font-semibold">{group.title}</p>
              <ul className="space-y-2 text-sm">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="inline-flex min-h-11 items-center text-primary-foreground/80 underline-offset-4 transition-colors duration-base hover:text-primary-foreground hover:underline"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <p className="mt-12 text-sm text-primary-foreground/80">
          © {new Date().getFullYear()} {BRAND_NAME}. Tous droits réservés.
        </p>
      </div>
    </footer>
  );
}
```

Vérifier au calcul que `primary-foreground` à 80 % sur `primary` dépasse 4.5:1 (mélange ≈ `#D2D9EC` sur `#1F3F9E`) et reporter le ratio dans le rapport ; s'il est sous 4.5, passer à `/90`. Le focus des liens sur fond bleu : l'anneau `ring-ring` (bleu) est invisible sur `primary` ; ajouter à la `className` du `Link` : `focus-visible:ring-primary-foreground focus-visible:ring-offset-primary`.

- [ ] **Step 4: Contact** — remplacer tout `app/contact/page.tsx` par :

```tsx
import { PageLayout } from "@/components/layout/page-layout";
import { Button } from "@repo/ui";

const CONTACT_EMAIL = "contact@tomia.fr";

export default function ContactPage() {
  return (
    <PageLayout title="Contactez-nous" description="Une question, une suggestion ? Écrivez-nous.">
      <div className="mx-auto mt-12 max-w-xl rounded-2xl bg-card p-8 text-center shadow-sm ring-1 ring-border">
        <h3 className="mb-4 text-2xl font-semibold">Par email</h3>
        <p className="mb-8 text-muted-foreground">Nous lisons chaque message.</p>
        <Button asChild size="lg">
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
        </Button>
      </div>
    </PageLayout>
  );
}
```

- [ ] **Step 5: Aide** — dans `app/aide/page.tsx` : supprimer l'import `MessageCircle` ; remplacer le bloc carte (du `div` `group rounded-2xl …` jusqu'à sa fermeture) par :

```tsx
        <div className="rounded-2xl bg-card p-8 shadow-sm ring-1 ring-border md:p-12">
          <h3 className="mb-4 text-2xl font-semibold">Une question sur {BRAND_NAME} ?</h3>
          <p className="mx-auto mb-8 max-w-md text-muted-foreground">
            Écrivez-nous : nous lisons chaque message.
          </p>
          <Button size="lg" asChild>
            <Link href="/contact">Nous écrire</Link>
          </Button>
        </div>
```

avec `import { BRAND_NAME } from "@/lib/brand";`, et remplacer `description="Trouvez les réponses à vos questions et apprenez à utiliser Tom."` par `description={`Les réponses aux questions fréquentes sur ${BRAND_NAME}.`}`. Le wrapper `max-w-3xl mx-auto mb-24 text-center` reste.

- [ ] **Step 6: Contrôle** : `grep -rnE "tomai\.fr|24 ?h|équipe( de)? support|Notre équipe" $W/apps/landing/app $W/apps/landing/components` → aucune ligne ; `grep -rn "lucide-react" $W/apps/landing/components/layout/footer.tsx $W/apps/landing/app/aide/page.tsx $W/apps/landing/app/contact/page.tsx` → aucune ligne.

- [ ] **Step 7: Commit** : typecheck + lint + build à 0, fichiers un par un ; `feat(landing): notebook back cover, legal typography, honest contact`.

---

### Task 5: Script de contrôle de la grille et passe de vérification

**Files:**
- Create: `apps/landing/scripts/check-grid.js`
- Modify: `docs/superpowers/suivi.md`

**Interfaces:**
- Consumes: `bg-seyes`, `container`, règle de ligne de base (Tasks 2-4).
- Produces: `check-grid.js`, réutilisé par les PR 2 à 5 (chaque passe visuelle l'exécute).

- [ ] **Step 1: Écrire le script** — `apps/landing/scripts/check-grid.js` :

```js
// Contrôle de la réglure, à exécuter dans la page (console ou javascript_tool) après
// chargement des polices et fin des animations. Retourne { checked, problems }.
async function checkGrid({ rule = 8, cell = 32, sheet = 1248, tolerance = 1 } = {}) {
  await document.fonts.ready;
  const problems = [];
  let checked = 0;
  const offGrid = (value, step) => {
    const r = ((value % step) + step) % step;
    return Math.min(r, step - r) > tolerance;
  };
  const baselineOf = (el) => {
    const probe = document.createElement("span");
    probe.style.cssText = "display:inline-block;width:0;height:0;vertical-align:baseline";
    el.prepend(probe);
    const y = probe.getBoundingClientRect().top;
    probe.remove();
    return y;
  };
  for (const section of document.querySelectorAll(".bg-seyes")) {
    const box = section.getBoundingClientRect();
    const sheetX = Math.max(0, (section.clientWidth - sheet) / 2);
    const marginLeft = parseFloat(getComputedStyle(section, "::after").left);
    if (offGrid(marginLeft - sheetX, cell)) {
      problems.push({ kind: "margin", section: section.id || section.className, marginLeft, sheetX });
    }
    for (const el of section.querySelectorAll("p, h1, h2, h3, h4, h5, h6, dt, dd, blockquote, .legal-copy li")) {
      if (!el.textContent.trim() || el.getClientRects().length === 0) continue;
      if (el.closest("[aria-hidden='true']")) continue;
      checked += 1;
      const y = baselineOf(el) - box.top;
      if (offGrid(y, rule)) {
        problems.push({ kind: "baseline", text: el.textContent.trim().slice(0, 40), y: Math.round(y * 10) / 10 });
      }
      if (el.getBoundingClientRect().left < box.left + marginLeft + 2) {
        problems.push({ kind: "over-margin", text: el.textContent.trim().slice(0, 40) });
      }
    }
  }
  return { checked, problems };
}
```

Le `style.cssText` est dans un outil de contrôle, pas dans l'application : l'exception « pas de style inline » ne s'applique qu'au code livré (`app/`, `components/`).

- [ ] **Step 2: Passe de vérification** (agent de vérification avec les outils Chrome, `pnpm --dir $W --filter landing dev` sur :3001) :
  1. Injecter `check-grid.js` et l'exécuter sur `/`, `/aide`, `/contact`, `/cgu`, `/confidentialite`, `/mentions-legales` à 1440 px (onglet), puis dans des iframes same-origin de largeur 375, 768, 1024, 1260 (`iframe.contentWindow.eval(source)` puis `await iframe.contentWindow.checkGrid()`), sous émulation `prefers-reduced-motion: reduce` si disponible, sinon après 3 s de stabilisation. Attendu : `problems` vide partout, `checked` > 0.
  2. Zoom : dans l'iframe 1024, `document.documentElement.style.fontSize = "20px"` puis `checkGrid({ rule: 10, cell: 40, sheet: 1560 })` → marge sur une verticale (`kind: "margin"` absent).
  3. Captures : hero, Problème, Parents, FAQ, footer, une page légale, à 1440 et 375 ; la marge rouge traverse chaque section, le fond est blanc, aucune bande.
  4. Clavier : focus visible sur les liens du footer bleu.
  5. Tout `problems` non vide est corrigé (espacement impair restant, bordure, hauteur non multiple de 8), avec un commit `fix(landing): …` par cause, puis la passe est rejouée.

- [ ] **Step 3: `suivi.md`** — dans `docs/superpowers/suivi.md`, section « Hors lot 0 », ajouter une ligne pour `feat/landing-copie-corrigee` (PR 1 fondations, état « ouverte » au push) et une entrée de journal datée du jour : feuille Seyès, papier blanc, rythme de ligne de base, footer couverture, contact `contact@tomia.fr`.

- [ ] **Step 4: Commit** : `git -C $W add apps/landing/scripts/check-grid.js`, puis `docs/superpowers/suivi.md` ; message `test(landing): grid and baseline checker, track the foundations PR`.
