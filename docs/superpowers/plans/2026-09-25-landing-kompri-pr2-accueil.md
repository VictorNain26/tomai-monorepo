# Landing Kompri — PR 2 « Première page » Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refaire la première page sur l'identité (hero, étapes, signes d'école dans leurs
bornes, place de Tom réservée) et consigner la décision mascotte : loutre en rendu 3D toon,
qui grandit avec l'élève.

**Architecture:** Les sections de `apps/landing/components/sections/` gardent leur ordre et
leurs textes, sauf ceux que la spec change. Trois primitives portent les signes d'école :
`Highlight` (un `<mark>` surligné sur la moitié basse), `HandNote` (Caveat rouge incliné) et
`Scribble` (réduit au cercle, couleur héritée). `TomIllustration` réserve une boîte carrée
avec un disque `secondary` en attendant l'image.

**Tech Stack:** Next.js 16.3, React 19.3, Tailwind 4.3.3, Motion 13.4, Playwright 1.63.

**Spec:** `docs/superpowers/specs/2026-09-24-landing-kompri-design.md` (§ 3, § 4, § 6, § 7 PR 2,
§ 8), qui applique `docs/superpowers/specs/2026-09-24-identite-kompri-design.md` (§ 4, § 5).

## Global Constraints

- Tokens uniquement : Tailwind et `@repo/tokens`, aucune valeur de style écrite à la main (hors valeurs animées par Motion et `app/opengraph-image.tsx`).
- Thème clair seul ; site statique ; aucune dépendance runtime nouvelle ; aucun composant d'animation maison au-delà de `FadeIn` et `Scribble`.
- Cibles de 44 px au moins ; contraste AA ; jamais `annotation` sur `highlight` (4,48:1).
- Une seule balise `<h1>` par page ; état final complet sans JavaScript et sous `prefers-reduced-motion`.
- Signes d'école (identité § 4) : un surlignage au plus par titre, une note manuscrite au plus par section, numéros entourés pour les étapes.
- Couleurs à rôle unique (identité § 2) : `primary` actions et liens, `annotation` correction de Tom, numéros entourés et note manuscrite, `success` validé et confiance.
- Polices (identité § 3) : titres en 800, texte en 400, libellés et boutons en 700 ; Caveat pour les seules notes.
- Périmètre V1 : collège, de la 6e à la 3e (`specs/2026-09-22-agent-ia.md`) ; aucune promesse au-delà.
- `BRAND_NAME` et « Tom » restent tels quels (nom et mascotte provisoires, PR 3a et 3b).
- Fichiers de moins de 400 lignes ; zéro commentaire sauf un « pourquoi » non évident ; aucun `eslint-disable`.
- Commits `<type>(landing|docs): …` en anglais, fichiers stagés un par un, pied `Co-Authored-By: Claude <noreply@anthropic.com>` puis `Claude-Session: https://claude.ai/code/session_01Qg7JXj2n5rfm4fz7f8EKRt`.
- Validation avant chaque commit : `cd apps/landing && pnpm typecheck && pnpm lint`, puis `pnpm exec knip` à la racine (exit 0, sortie redirigée dans un fichier de log, jamais via `| tail`).
- Suite navigateur : `pnpm --filter landing test:e2e` (construit et sert sur 3011). `$SCRATCH` désigne le dossier de travail temporaire donné dans la consigne de la tâche.
- Les sections Modes de saisie, Parents et Tarifs sont déjà en cartes `card` depuis la PR 1 : elles ne changent que par la tâche 5.

## Review Focus

1. Titre du hero à 375 px : « la trouver » surligné passe à la ligne ; le surlignage suit chaque morceau de ligne (`box-decoration-clone`) → tâche 3, passe visuelle à 375 px notée dans le rapport.
2. Arrivée de l'image de Tom : la boîte est déjà carrée et à sa place (à droite en bureau, sous le formulaire en mobile) → tâche 2, `tests/hero.spec.ts`.
3. Première page sans JavaScript : la note manuscrite, les cercles et le disque de Tom sont visibles → tests existants `reveals.spec.ts` (« shows every word and every stroke »), à relancer en tâches 2, 3 et 4.
4. Chargement de la première page avec mouvement : aucun décalage de mise en page une fois la démo en bulles retirée → tâche 2, `/` ajouté au test de décalage de `reveals.spec.ts`.
5. Un titre ajouté plus tard en graisse 600 par habitude : la règle des 800 le rattrape → tâche 5, `tests/type.spec.ts`.

---

### Task 1: Décision mascotte dans les specs

**Files:**
- Modify: `docs/superpowers/specs/2026-09-24-identite-kompri-design.md`
- Modify: `docs/superpowers/specs/2026-09-24-landing-kompri-design.md`

**Interfaces:**
- Produces: rien pour le code ; les tâches suivantes s'appuient sur `TomIllustration` tel que décrit dans la spec landing § 4.

- [ ] **Step 1: Spec d'identité, tableau des décisions.** Ligne « Illustration » : « Rendu 3D toon fait par Victor dans Blender : aplats de 2 à 3 tons, contour à l'encre, fond transparent ». Ligne « Personnage » : ajouter « qui grandit avec l'élève (§ 5) ».

- [ ] **Step 2: Spec d'identité, § 5 Tom.** Garder la description du personnage (loutre anthropomorphe, pull, stylo quatre couleurs en poche) et les écartés. Remplacer « Style », « Jeu de départ » et « Production » par :
  - **Il grandit avec l'élève** : trois stades calqués sur les cycles officiels : 6e (cycle 3, proportions rondes, grosse tête), 5e à 3e (cycle 4, silhouette plus fine, attitude assurée), lycée (proportions d'adolescent, dessin plus sobre). Un seul modèle, une seule armature, les stades sont des variantes de proportions (*shape keys*). La V1 couvre le collège : le stade lycée n'apparaît nulle part tant que le lycée n'est pas proposé.
  - **Style** : rendu toon dans Blender (EEVEE). Ombrage en 2 à 3 aplats par couleur (nœud *Shader to RGB* suivi d'une *Color Ramp*), contour par le modificateur *Line Art* en `foreground` `#1D1D22`, sans flou ni textures réalistes. Palette : brun loutre, crème du ventre et du museau, bleu `#1F3F9E` du pull, rouge `#C0282D` du stylo. Fond transparent (option *Transparent* du panneau Film d'EEVEE), export PNG.
  - **Jeu de départ** : les cinq poses et la tête gardent leur liste actuelle ; la landing n'utilise que « bonjour » au stade cycle 4, produit en premier.
  - **Production** : Victor modèle le personnage ; l'agent peut piloter Blender par le serveur MCP officiel de Blender Lab (matériaux, contour, éclairage, rendus en série), et vérifie le rendu en 32 px par capture Playwright.
  - Sources, citées dans le texte : `https://docs.blender.org/manual/en/latest/render/shader_nodes/color/shader_to_rgb.html`, `https://docs.blender.org/manual/en/latest/grease_pencil/modifiers/generate/line_art.html`, `https://docs.blender.org/manual/en/latest/render/eevee/render_settings/film.html`, `https://www.blender.org/lab/mcp-server/`.

- [ ] **Step 3: Spec d'identité, prompts et suite.** Supprimer le prompt Recraft et les poses en anglais (fin du § 6), et tout renvoi à Recraft (§ 5, § 7, « Pourquoi pas un dessin maison »). § 7 point 1 : « Tom : modélisation et rendu par Victor dans Blender ». Critère de réussite « les six images » → « les images d'un même stade montrent le même personnage, et les trois stades le même Tom à trois âges ».

- [ ] **Step 4: Spec landing.** § 4 : « À la livraison du SVG » → « À la livraison de l'image (PNG transparent, stade cycle 4) », le reste inchangé. « Hors périmètre » : « Les images de Tom (modélisation par Victor dans Blender, intégration dans une PR à part) ».

- [ ] **Step 5: Relire.** `grep -n -i "recraft\|svgo\|sans contour" docs/superpowers/specs/2026-09-24-identite-kompri-design.md docs/superpowers/specs/2026-09-24-landing-kompri-design.md` ne renvoie rien.

- [ ] **Step 6: Commit.**

```bash
git add docs/superpowers/specs/2026-09-24-identite-kompri-design.md
git add docs/superpowers/specs/2026-09-24-landing-kompri-design.md
git commit -m "docs(landing): record the mascot as a toon 3D otter that grows with the student"
```

---

### Task 2: Hero, place de Tom, note manuscrite

**Files:**
- Create: `apps/landing/components/atoms/tom-illustration.tsx`
- Create: `apps/landing/components/annotations/hand-note.tsx`
- Create: `apps/landing/tests/hero.spec.ts`
- Modify: `apps/landing/components/sections/hero.tsx`
- Modify: `apps/landing/tests/reveals.spec.ts`
- Delete: `apps/landing/components/sections/chat-demo.tsx`

**Interfaces:**
- Produces: `TomIllustration({ className }: { className?: string })`, racine `data-testid="tom"` ; `HandNote({ children, className }: { children: React.ReactNode; className?: string })`, qui rend un `<p>` en `font-hand`.

- [ ] **Step 1: Écrire le test qui échoue, `tests/hero.spec.ts`.**

```ts
import { expect, test } from "@playwright/test";
import { HEIGHT, settle } from "./support";

test("the hero keeps a square place for Tom beside the text on desktop", async ({ page }) => {
  await page.setViewportSize({ width: 1441, height: HEIGHT });
  await page.goto("/");
  await settle(page);
  const tom = await page.getByTestId("tom").boundingBox();
  const title = await page.locator("h1").boundingBox();
  expect(tom).not.toBeNull();
  expect(title).not.toBeNull();
  if (!tom || !title) return;
  expect(Math.abs(tom.width - tom.height)).toBeLessThanOrEqual(1);
  expect(tom.width).toBeGreaterThanOrEqual(240);
  expect(tom.x).toBeGreaterThanOrEqual(title.x + title.width);
});

test("the hero puts Tom's place under the sign-up form on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: HEIGHT });
  await page.goto("/");
  await settle(page);
  const tom = await page.getByTestId("tom").boundingBox();
  const form = await page.locator("section").first().locator("form").boundingBox();
  expect(tom).not.toBeNull();
  expect(form).not.toBeNull();
  if (!tom || !form) return;
  expect(Math.abs(tom.width - tom.height)).toBeLessThanOrEqual(1);
  expect(tom.y).toBeGreaterThanOrEqual(form.y + form.height);
});
```

Dans `tests/reveals.spec.ts`, la boucle du test de décalage (`with motion`) passe de `["/aide", "/cgu"]` à `["/", "/aide", "/cgu"]`.

- [ ] **Step 2: Lancer, constater l'échec.** `pnpm --filter landing exec playwright test hero.spec.ts reveals.spec.ts > $SCRATCH/t2-red.log 2>&1; echo $?` → non nul : `getByTestId("tom")` introuvable. Noter dans le rapport si le test de décalage sur `/` échoue aussi sur l'état actuel (démo en bulles).

- [ ] **Step 3: Créer `components/atoms/tom-illustration.tsx`.**

```tsx
import { cn } from "@repo/ui";

export function TomIllustration({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" data-testid="tom" className={cn("aspect-square w-full max-w-sm", className)}>
      <div className="size-full rounded-full bg-secondary" />
    </div>
  );
}
```

- [ ] **Step 4: Créer `components/annotations/hand-note.tsx`.**

```tsx
import { cn } from "@repo/ui";

export function HandNote({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn("-rotate-2 font-hand text-2xl font-semibold text-balance text-annotation", className)}>{children}</p>
  );
}
```

- [ ] **Step 5: Réécrire `components/sections/hero.tsx`.** Comportement attendu, dans cet ordre dans la colonne de texte :
  - un badge « Collège, de la 6e à la 3e » : `inline-flex` avec l'icône `GraduationCap` en `text-success`, fond `card`, `ring-1 ring-border`, `rounded-full`, `text-sm font-bold` ;
  - le `<h1>` « Tom ne donne pas la réponse. Il aide votre enfant à <Highlight>la trouver</Highlight>. », sans classe de graisse (la base met 800) ;
  - le paragraphe d'accroche actuel, inchangé ;
  - `<HandNote>c&apos;est toi qui l&apos;écris !</HandNote>`, texte `text-2xl`, sans animation ;
  - `WaitlistForm source="hero"` comme aujourd'hui ;
  - la liste des signaux réduite à `Landmark` « Hébergé dans l'Union européenne » et `ShieldCheck` « Gratuit pour commencer ».
  
  Colonne de droite : `<TomIllustration className="mx-auto lg:mr-0" />` à la place de `ChatDemo`. Le composant n'est plus `"use client"` : plus de `motion`, `useReducedMotion`, `Scribble`, `DRAW_SECONDS` ni `REVEAL_SECONDS` dans ce fichier. La grille `lg:grid-cols-2` et `items-center` placent Tom à droite en bureau et sous le formulaire en mobile.

- [ ] **Step 6: Supprimer `components/sections/chat-demo.tsx`.** `grep -rn "ChatDemo\|chat-demo" apps/landing --include=*.ts --include=*.tsx` ne renvoie rien.

- [ ] **Step 7: Vérifier.** `pnpm --filter landing exec playwright test hero.spec.ts reveals.spec.ts layout.spec.ts > $SCRATCH/t2-green.log 2>&1; echo $?` → 0 ; puis typecheck, lint et knip (exit 0).

- [ ] **Step 8: Commit.**

```bash
git add apps/landing/components/atoms/tom-illustration.tsx
git add apps/landing/components/annotations/hand-note.tsx
git add apps/landing/components/sections/hero.tsx
git add apps/landing/components/sections/chat-demo.tsx
git add apps/landing/tests/hero.spec.ts
git add apps/landing/tests/reveals.spec.ts
git commit -m "feat(landing): rebuild the hero around Tom's reserved place"
```

---

### Task 3: Signes d'école dans leurs bornes

**Files:**
- Create: `apps/landing/tests/signs.spec.ts`
- Modify: `apps/landing/components/annotations/highlight.tsx`
- Modify: `apps/landing/components/annotations/scribble.tsx`
- Modify: `apps/landing/components/sections/problem.tsx`, `parents.tsx`, `trust.tsx`, `how-it-works.tsx`
- Delete: `apps/landing/components/annotations/margin-note.tsx`

**Interfaces:**
- Consumes: `HandNote` (tâche 2).
- Produces: `Highlight({ children })` rend un `<mark>` ; `Scribble({ delay, className, children })` sans prop `kind`, trait en `currentColor` hérité du parent.

- [ ] **Step 1: Écrire le test qui échoue, `tests/signs.spec.ts`.**

```ts
import { expect, test } from "@playwright/test";
import { PAGES } from "./support";

for (const path of PAGES) {
  test(`${path} keeps school signs rare`, async ({ page }) => {
    await page.goto(path);
    const problems = await page.evaluate(() => {
      const found: string[] = [];
      for (const mark of document.querySelectorAll("main mark")) {
        if (!mark.closest("h1, h2, h3")) found.push(`highlight outside a heading: ${mark.textContent}`);
      }
      for (const heading of document.querySelectorAll("main :is(h1, h2, h3)")) {
        if (heading.querySelectorAll("mark").length > 1) found.push(`several highlights in: ${heading.textContent}`);
      }
      for (const section of document.querySelectorAll("main section")) {
        if (section.querySelectorAll(".font-hand").length > 1) {
          found.push(`several hand notes in: ${section.querySelector("h1, h2")?.textContent ?? section.id}`);
        }
      }
      return found;
    });
    expect(problems).toEqual([]);
  });
}
```

- [ ] **Step 2: `Highlight`.** Rend `<mark className="box-decoration-clone bg-linear-to-t from-highlight from-50% to-transparent to-50% px-1 text-foreground">`. Le surligneur couvre la moitié basse du texte (identité § 4) et suit chaque morceau de ligne quand le groupe passe à la ligne. Tant que `Highlight` rendait un `<span>`, le test ne voyait aucun surlignage : c'est ce changement qui le rend capable d'échouer.

- [ ] **Step 3: Lancer, constater l'échec.** `pnpm --filter landing exec playwright test signs.spec.ts > $SCRATCH/t3-red.log 2>&1; echo $?` → non nul sur `/` : trois « highlight outside a heading » venus du corps des étapes de `how-it-works.tsx`.

- [ ] **Step 4: `Scribble` réduit au cercle.** Supprimer `SHAPES`, `ScribbleKind` et la prop `kind` ; garder le tracé et la position du cercle actuels, `data-reveal`, `initial={reduceMotion ? false : { pathLength: 0 }}` et `DRAW_SECONDS`. Retirer `text-annotation` du `<svg>` : le trait prend `currentColor`, la couleur vient du `className` de l'appelant.

- [ ] **Step 5: Sections.**
  - `problem.tsx` : la phrase « Copier une réponse prend dix secondes. L'oublier aussi. » devient un `<h2>` (classes de taille actuelles, sans `font-medium`), « L'oublier aussi. » en `Highlight`.
  - `parents.tsx` : « sans lire par-dessus son épaule » passe de `Scribble kind="underline"` à `Highlight`.
  - `trust.tsx` : `MarginNote` devient `HandNote` (même texte, `className="md:mt-2"`).
  - `how-it-works.tsx` : les trois `Highlight` du corps des étapes deviennent du texte simple ; l'appel `Scribble` perd `kind="circle"` et garde `text-annotation` dans son `className`.

- [ ] **Step 6: Supprimer `components/annotations/margin-note.tsx`.** `grep -rn "MarginNote\|kind=\"" apps/landing/components` ne renvoie rien.

- [ ] **Step 7: Vérifier.** `pnpm --filter landing test:e2e > $SCRATCH/t3-green.log 2>&1; echo $?` → 0 ; typecheck, lint, knip (exit 0). Capture de `/` à 375 px sous mouvement réduit : le surlignage de « la trouver » suit la coupure de ligne (Review Focus 1), noté dans le rapport.

- [ ] **Step 8: Commit.**

```bash
git add apps/landing/tests/signs.spec.ts
git add apps/landing/components/annotations/highlight.tsx
git add apps/landing/components/annotations/scribble.tsx
git add apps/landing/components/annotations/margin-note.tsx
git add apps/landing/components/sections/problem.tsx
git add apps/landing/components/sections/parents.tsx
git add apps/landing/components/sections/trust.tsx
git add apps/landing/components/sections/how-it-works.tsx
git commit -m "feat(landing): keep school signs to one highlight per title and one note per section"
```

---

### Task 4: Comment ça marche en trois étapes

**Files:**
- Modify: `apps/landing/components/sections/how-it-works.tsx`

**Interfaces:**
- Consumes: `Scribble` sans `kind` (tâche 3).

- [ ] **Step 1: Étapes.** Remplacer `STEPS` par les trois étapes de la spec landing § 3, titres et corps en texte simple :
  1. « Il pose sa question » — « Une photo de l'exercice ou quelques mots, dans n'importe quelle matière. »
  2. « Tom le guide » — « Une question, puis un indice, puis un autre, à son niveau de la 6e à la 3e ; jamais la réponse de son exercice. »
  3. « Il trouve seul » — « Et ce qu'il a compris revient en révision au bon moment, jusqu'au contrôle. »

- [ ] **Step 2: Cartes et numéros.** Chaque `<li>` devient une carte `rounded-2xl bg-card p-8 shadow-sm ring-1 ring-border` (plus de `border-l-2 border-annotation`). Le numéro reste dans `Scribble`, en `text-annotation` pour les deux premières étapes et `text-success` pour la troisième (identité § 4), avec les délais actuels. `<h3>` sans classe de graisse. `SectionHeader` inchangé.

- [ ] **Step 3: Vérifier.** Pas de test nouveau : les textes sont une décision de la spec. Les gardes sont les tests existants, qu'un défaut de cette tâche ferait échouer : niveau de titre sauté (`layout.spec.ts`), cercle qui déborde à 375 px (`layout.spec.ts`), cercle non tracé sans JavaScript ou étape masquée sous mouvement réduit (`reveals.spec.ts`), surlignage revenu dans le corps (`signs.spec.ts`). `pnpm --filter landing test:e2e > $SCRATCH/t4.log 2>&1; echo $?` → 0 ; typecheck, lint, knip (exit 0).

- [ ] **Step 4: Commit.**

```bash
git add apps/landing/components/sections/how-it-works.tsx
git commit -m "feat(landing): show how it works as three circled steps"
```

---

### Task 5: Graisses, rôles de couleur et suivi

**Files:**
- Create: `apps/landing/tests/type.spec.ts`
- Modify: `apps/landing/components/sections/parents.tsx`, `trust.tsx`, `pricing.tsx`, `input-modes.tsx`, `cta.tsx`
- Modify: `docs/superpowers/suivi.md`

- [ ] **Step 1: Écrire le test qui échoue, `tests/type.spec.ts`.**

```ts
import { expect, test } from "@playwright/test";
import { PAGES } from "./support";

for (const path of PAGES) {
  test(`${path} sets every title in weight 800`, async ({ page }) => {
    await page.goto(path);
    const light = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>("main :is(h1, h2, h3)")]
        .filter((el) => getComputedStyle(el).fontWeight !== "800")
        .map((el) => `${el.tagName} ${getComputedStyle(el).fontWeight} ${el.textContent?.trim().slice(0, 30)}`),
    );
    expect(light).toEqual([]);
  });
}
```

- [ ] **Step 2: Lancer, constater l'échec.** `pnpm --filter landing exec playwright test type.spec.ts > $SCRATCH/t5-red.log 2>&1; echo $?` → non nul sur `/` (titres en `font-semibold` de `parents`, `trust`, `pricing`, `cta`).

- [ ] **Step 3: Graisses.** Retirer `font-semibold` des `<h2>` et `<h3>` de `parents.tsx`, `trust.tsx`, `pricing.tsx` et `cta.tsx` (la base met 800). Dans `input-modes.tsx`, le libellé de mode passe de `font-semibold` à `font-bold`. Dans `pricing.tsx`, le prix passe de `font-semibold` à `font-bold`.

- [ ] **Step 4: Rôles de couleur.** Dans `pricing.tsx`, l'accroche de formule (`plan.tagline`) quitte le rouge italique, réservé aux notes de Tom : `text-sm font-bold text-muted-foreground`.

- [ ] **Step 5: Vérifier.** `pnpm --filter landing test:e2e > $SCRATCH/t5.log 2>&1; echo $?` → 0 ; typecheck, lint, knip (exit 0).

- [ ] **Step 6: Suivi.** Dans `docs/superpowers/suivi.md`, la ligne de la refonte landing passe à « PR 1 mergée (#325), PR 2 en cours » avec la branche `feat/landing-kompri-accueil`, et le plan est cité. Ajouter en décision : mascotte loutre en 3D toon faite dans Blender, qui grandit avec l'élève (spec d'identité § 5).

- [ ] **Step 7: Commit.**

```bash
git add apps/landing/tests/type.spec.ts
git add apps/landing/components/sections/parents.tsx
git add apps/landing/components/sections/trust.tsx
git add apps/landing/components/sections/pricing.tsx
git add apps/landing/components/sections/input-modes.tsx
git add apps/landing/components/sections/cta.tsx
git add docs/superpowers/suivi.md
git commit -m "feat(landing): set titles in 800 and keep red for Tom's notes"
```

---

## Fin de PR

Build, suite complète et passe visuelle à 375, 768 et 1440 px, avec mouvement réduit et au
clavier ; captures dans la description de la PR (spec landing § 7).
