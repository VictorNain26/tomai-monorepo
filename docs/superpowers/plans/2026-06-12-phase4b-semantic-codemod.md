# Phase 4b — Codemod classes sémantiques mobile + gate anti-régression

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Zéro classe palette brute (`bg-stone-800`, `text-blue-600 dark:text-blue-400`…) dans `apps/mobile/src` — tout passe par les classes sémantiques `@repo/tokens` — et un gate ESLint empêche toute régression.

**Architecture:** Trois passes. (1) Un codemod scripté remplace les motifs mécaniques (paires `light dark:` adjacentes puis classes isolées non ambiguës) — ~85 % des 411 occurrences. (2) La longue traîne (fonds pastel des viewers, hex/rgba impératifs) se traite à la main avec les tokens sémantiques + modificateurs d'opacité NativeWind. (3) Une fois le compteur à zéro (mesuré), on active la règle `better-tailwindcss/no-restricted-classes` — jamais avant (cf. règle projet : pas de gate silencieux qui force une migration).

**Tech Stack:** NativeWind v5 (opacités `/N` et `color-mix` supportés en natif — [nativewind.dev/v5/customization/colors](https://www.nativewind.dev/v5/customization/colors)), `@repo/tokens` (déjà injecté au runtime par `ThemeProvider`, phase 4), `eslint-plugin-better-tailwindcss` (règle `no-restricted-classes`, regex + message — [github.com/schoero/eslint-plugin-better-tailwindcss/docs/rules/no-restricted-classes.md](https://github.com/schoero/eslint-plugin-better-tailwindcss/blob/main/docs/rules/no-restricted-classes.md)).

**Pré-requis :** branche `feat/phase4b-semantic-codemod` créée depuis `feat/phase4-design-system-dark-mobile` (PR #222). La PR 4b ciblera d'abord la branche phase 4, re-ciblée sur `main` après merge de #222.

**Changement visuel assumé :** comme en phase 4 (M7), les gris stone (#FAFAF9, #1C1917…) deviennent les slate de la marque (#FFFFFF, #020617…). C'est voulu, pas une régression.

**Exceptions documentées (ne PAS migrer) :**
- `src/constants/subjects.ts` — palette décorative des matières, paires light/dark explicites et typées. Si le gate la flagge : `eslint-disable` de fichier avec justification.
- `text-white` / `bg-black/50`-style sur images, gradients, overlays — invariants par thème, légitimes. Le gate ne bannit que les classes palette **numérotées**.
- `components/ui/google-icon.tsx` (hex de marque Google), `MermaidDiagram.tsx` (thème injecté dans la WebView).

---

### Task 1: Script de codemod (dry-run d'abord)

**Files:**
- Create: `apps/mobile/scripts/codemod-semantic-colors.mjs`

- [ ] **Step 1: Écrire le script**

```js
// apps/mobile/scripts/codemod-semantic-colors.mjs
// Codemod one-shot phase 4b : classes palette brutes -> classes sémantiques @repo/tokens.
// Dry-run par défaut (rapport seul) ; `--write` applique.
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Paires adjacentes `light dark:` -> classe sémantique. Ordre: motifs les plus longs d'abord.
const PAIR_MAP = [
  ['bg-stone-50 dark:bg-stone-900', 'bg-background'],
  ['bg-slate-50 dark:bg-slate-900', 'bg-background'],
  ['bg-white dark:bg-stone-800', 'bg-card'],
  ['bg-white dark:bg-stone-900', 'bg-background'],
  ['bg-stone-100 dark:bg-stone-800', 'bg-muted'],
  ['bg-stone-200 dark:bg-stone-700', 'bg-muted'],
  ['border-stone-200 dark:border-stone-700', 'border-border'],
  ['border-stone-100 dark:border-stone-700', 'border-border'],
  ['border-stone-300 dark:border-stone-600', 'border-border'],
  ['border-slate-200 dark:border-slate-700', 'border-border'],
  ['text-white dark:text-stone-900', 'text-primary-foreground'],
  ['text-stone-900 dark:text-white', 'text-foreground'],
  ['text-stone-900 dark:text-stone-50', 'text-foreground'],
  ['text-stone-900 dark:text-stone-100', 'text-foreground'],
  ['text-stone-800 dark:text-stone-100', 'text-foreground'],
  ['text-stone-600 dark:text-stone-400', 'text-muted-foreground'],
  ['text-stone-500 dark:text-stone-400', 'text-muted-foreground'],
  ['text-slate-600 dark:text-slate-400', 'text-muted-foreground'],
  ['text-blue-600 dark:text-blue-400', 'text-primary'],
  ['bg-blue-600 dark:bg-blue-400', 'bg-primary'],
  ['border-blue-600 dark:border-blue-400', 'border-primary'],
  ['text-red-600 dark:text-red-400', 'text-destructive'],
  ['text-red-500 dark:text-red-400', 'text-destructive'],
  ['bg-red-600 dark:bg-red-400', 'bg-destructive'],
  ['border-red-600 dark:border-red-400', 'border-destructive'],
  ['text-emerald-600 dark:text-emerald-400', 'text-success'],
  ['text-amber-600 dark:text-amber-400', 'text-warning'],
  ['bg-amber-600 dark:bg-amber-400', 'bg-warning'],
  ['text-yellow-600 dark:text-yellow-400', 'text-warning'],
  ['text-purple-600 dark:text-purple-400', 'text-violet'],
  // Surfaces pastel (badges/encarts) -> token + opacité (color-mix, supporté NativeWind v5)
  ['bg-blue-50 dark:bg-blue-950', 'bg-primary/10'],
  ['bg-emerald-50 dark:bg-emerald-950', 'bg-success/10'],
  ['bg-amber-50 dark:bg-amber-950', 'bg-warning/10'],
  ['bg-yellow-50 dark:bg-yellow-950', 'bg-warning/10'],
  ['bg-red-50 dark:bg-red-950', 'bg-destructive/10'],
  ['bg-purple-50 dark:bg-purple-950', 'bg-violet/10'],
  ['border-blue-200 dark:border-blue-800', 'border-primary/30'],
  ['border-emerald-200 dark:border-emerald-800', 'border-success/30'],
  ['border-amber-200 dark:border-amber-800', 'border-warning/30'],
  ['border-yellow-200 dark:border-yellow-800', 'border-warning/30'],
  ['border-purple-200 dark:border-purple-800', 'border-violet/30'],
];

// Classes isolées non ambiguës (appliquées APRÈS les paires).
const LONE_MAP = [
  ['text-stone-900', 'text-foreground'],
  ['text-stone-800', 'text-foreground'],
  ['text-stone-600', 'text-muted-foreground'],
  ['text-stone-500', 'text-muted-foreground'],
  ['text-blue-600', 'text-primary'],
  ['text-red-600', 'text-destructive'],
  ['text-emerald-600', 'text-success'],
  ['text-amber-600', 'text-warning'],
];

const SKIP = ['src/constants/subjects.ts'];
const PALETTE_RE =
  /\b(?:[a-z-]+:)*(?:bg|text|border|divide|ring|fill|stroke|placeholder)-(?:stone|gray|slate|zinc|neutral|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-[0-9]+(?:\/[0-9]+)?\b/g;

const write = process.argv.includes('--write');
const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(tsx?|jsx?)$/.test(name)) files.push(p);
  }
})('src');

const counts = new Map();
let remaining = [];
for (const file of files) {
  if (SKIP.some((s) => file.endsWith(s.replace('src/', '')) || file === s)) continue;
  let content = readFileSync(file, 'utf8');
  const before = content;
  for (const [from, to] of [...PAIR_MAP, ...LONE_MAP]) {
    const re = new RegExp(from.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&') + '(?![\\w/-])', 'g');
    content = content.replace(re, () => {
      counts.set(from, (counts.get(from) ?? 0) + 1);
      return to;
    });
  }
  if (write && content !== before) writeFileSync(file, content);
  const scan = write ? content : content;
  for (const [i, line] of scan.split('\n').entries()) {
    for (const m of line.matchAll(PALETTE_RE)) remaining.push(`${file}:${i + 1} ${m[0]}`);
  }
}

console.log(write ? '== APPLIQUÉ ==' : '== DRY-RUN ==');
for (const [from, n] of [...counts].sort((a, b) => b[1] - a[1])) console.log(`${String(n).padStart(4)}  ${from}`);
console.log(`\nTotal remplacé: ${[...counts.values()].reduce((a, b) => a + b, 0)}`);
console.log(`\nRestant à traiter manuellement (${remaining.length}):`);
for (const r of remaining) console.log('  ' + r);
```

- [ ] **Step 2: Dry-run et inspection du rapport**

Run: `cd apps/mobile && node scripts/codemod-semantic-colors.mjs`
Expected: ~350+ remplacements annoncés, liste « Restant » de l'ordre de 40-80 lignes (viewers, hex isolés, paires non adjacentes). **Lire la liste en entier** : si un motif fréquent y apparaît (paire écrite dans l'ordre inverse, variante non prévue), l'ajouter à `PAIR_MAP`/`LONE_MAP` et relancer le dry-run avant d'écrire.

- [ ] **Step 3: Commit du script seul**

```bash
git add apps/mobile/scripts/codemod-semantic-colors.mjs
git commit -m "chore(mobile): semantic-colors codemod script (phase 4b)"
```

### Task 2: Appliquer le codemod et valider

**Files:**
- Modify: `apps/mobile/src/**/*.tsx` (en masse, via le script)

- [ ] **Step 1: Appliquer**

Run: `cd apps/mobile && node scripts/codemod-semantic-colors.mjs --write`

- [ ] **Step 2: Validation machine**

Run: `cd apps/mobile && pnpm typecheck && pnpm lint && pnpm test`
Expected: PASS (le codemod ne touche que des littéraux de classes).

- [ ] **Step 3: Spot-check visuel**

Run: `pnpm dev:mobile`, vérifier en light ET dark : home élève, chat, dashboard parent, un écran Pronote. Les surfaces passent de stone à slate (assumé), aucun texte illisible.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src
git commit -m "refactor(mobile): migrate screens to semantic token classes via codemod"
```

### Task 3: Longue traîne — viewers learning (bug dark mode)

**Files:**
- Modify: `apps/mobile/src/components/learning/viewers/MathViewers.tsx` (~l.24,30,64)
- Modify: `apps/mobile/src/components/learning/viewers/FrenchViewers.tsx` (~l.37,61)
- Modify: `apps/mobile/src/components/learning/viewers/UniversalViewers.tsx` (occurrences restantes du rapport)

- [ ] **Step 1: Corriger les fonds pastel light-only**

Ces fichiers utilisent `bg-blue-50`, `bg-yellow-50`, `bg-green-100`, `bg-red-100`, `bg-purple-100` **sans variante dark** — illisibles en dark. Règle de remplacement (sémantique par intention, pas par couleur) :
- fond « correct/réussite » (`green-*`) → `bg-success/15`, texte `text-success`
- fond « erreur » (`red-*`) → `bg-destructive/15`, texte `text-destructive`
- fond « attention/indice » (`yellow-*`, `amber-*`) → `bg-warning/15`, texte `text-warning`
- fond « information/neutre » (`blue-*`) → `bg-primary/10` ou `bg-info/10` selon l'intention, texte assorti
- fond « catégorie grammaire » (`purple-*`) → `bg-violet/15`, texte `text-violet`

Lire chaque site, choisir le token par intention, appliquer.

- [ ] **Step 2: Vérifier le rendu des opacités en natif**

Run: `pnpm dev:mobile`, ouvrir un viewer maths et un viewer français en light et dark.
Expected: fonds teintés visibles dans les deux thèmes (NativeWind v5 supporte `/N` via color-mix — si un fond ne rend pas, le signaler et passer ce site sur une paire de tokens dédiée plutôt que de bricoler).

- [ ] **Step 3: Validation + commit**

```bash
cd apps/mobile && pnpm typecheck && pnpm lint && pnpm test
git add src/components/learning/viewers
git commit -m "fix(mobile): learning viewers readable in dark mode via semantic tokens"
```

### Task 4: Longue traîne — hex/rgba impératifs → `useThemeColors`

**Files (sites connus de l'audit, vérifier au rapport):**
- Modify: `apps/mobile/src/app/(parent)/tabs/(home)/child/[id]/index.tsx:139,147,152,359` (LinearGradient `#2563eb`, icônes)
- Modify: `apps/mobile/src/app/(auth)/register.tsx:25-27`
- Modify: `apps/mobile/src/app/(student)/(chat)/index.tsx:214-216` (`color="#fff"`)
- Modify: `apps/mobile/src/components/parent/PinPrompt.tsx:73` (`placeholderTextColor="#9CA3AF"`)
- Modify: `apps/mobile/src/components/chat/FileLibraryPicker.tsx:112`
- Modify: `apps/mobile/src/app/(parent)/tabs/(profile)/index.tsx:173` et `(student)/(learning)/create.tsx:127` (rgba inline)

- [ ] **Step 1: Remplacer chaque hex/rgba par `useThemeColors`**

Le hook (phase 4) expose les 27 tokens des deux palettes. Règles :
- `#2563eb` / `#3b82f6` → `colors.primary`
- `#fff` sur bouton primaire → `colors.primaryForeground`
- `#9CA3AF` placeholder → `colors.mutedForeground`
- `rgba(...)` décoratifs → token + alpha hex 8 digits si besoin (`colors.primary + '1A'` = 10 %) — pas de rgba en dur.

Inventaire de contrôle : `grep -rnE '#[0-9a-fA-F]{3,8}|rgba?\(' src --include='*.tsx' | grep -v google-icon | grep -v MermaidDiagram` — traiter chaque hit ou le justifier.

- [ ] **Step 2: Validation + commit**

```bash
cd apps/mobile && pnpm typecheck && pnpm lint && pnpm test
git add -- <fichiers touchés un par un>
git commit -m "refactor(mobile): imperative hex/rgba colors through useThemeColors"
```

### Task 5: Balayage résiduel → zéro

- [ ] **Step 1: Relancer le rapport**

Run: `cd apps/mobile && node scripts/codemod-semantic-colors.mjs`
Expected: `Restant à traiter manuellement (0)` — sinon, traiter chaque ligne restante (étendre les maps si motif mécanique, sinon à la main), relancer jusqu'à zéro.

- [ ] **Step 2: Migrer aussi les primitives `ui/` restantes si encore dans le rapport**

`text.tsx`, `skeleton.tsx`, `progress.tsx`, `avatar.tsx`, `confirm-dialog.tsx` — même pattern que `button.tsx`/`card.tsx` (phase 4, commits 6090175/1937abc à imiter).

- [ ] **Step 3: Validation + commit**

```bash
cd apps/mobile && pnpm typecheck && pnpm lint && pnpm test
git add apps/mobile/src
git commit -m "refactor(mobile): remaining primitives and stragglers on semantic tokens"
```

### Task 6: Gate anti-régression ESLint

**Files:**
- Modify: `apps/mobile/package.json` (devDep `eslint-plugin-better-tailwindcss`)
- Modify: `apps/mobile/eslint.config.mjs`

**Pré-condition (règle projet « no-silent-migration-gates ») :** le rapport Task 5 est à zéro AVANT d'activer la règle.

- [ ] **Step 1: Installer le plugin**

Run: `pnpm --filter tomai-mobile add -D eslint-plugin-better-tailwindcss`
(Vérifier la compat ESLint 9 du plugin à l'install ; en cas de peer conflict, consulter la doc du plugin avant tout contournement.)

- [ ] **Step 2: Configurer la règle**

Dans `apps/mobile/eslint.config.mjs`, ajouter :

```js
import eslintPluginBetterTailwindcss from 'eslint-plugin-better-tailwindcss';

// ...dans le tableau exporté :
{
  files: ['src/**/*.{ts,tsx}'],
  plugins: { 'better-tailwindcss': eslintPluginBetterTailwindcss },
  settings: {
    'better-tailwindcss': { entryPoint: 'src/global.css' },
  },
  rules: {
    'better-tailwindcss/no-restricted-classes': [
      'error',
      {
        restrict: [
          {
            pattern:
              '^(?:[a-zA-Z0-9_/-]+:)*(?:bg|text|border|divide|ring|fill|stroke|placeholder)-(?:stone|gray|slate|zinc|neutral|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-[0-9]+(?:/[0-9]+)?$',
            message:
              'Classe palette brute interdite — utiliser les classes sémantiques @repo/tokens (bg-background, text-muted-foreground, text-destructive…).',
          },
        ],
      },
    ],
  },
},
```

- [ ] **Step 3: Prouver que le gate mord**

Run: `cd apps/mobile && pnpm lint` → Expected: PASS (zéro violation, mesuré).
Puis ajouter temporairement `className="bg-stone-800"` dans un composant, relancer `pnpm lint` → Expected: FAIL avec le message de la règle. Retirer la violation.

- [ ] **Step 4: Cas `subjects.ts`**

Si la règle flagge `src/constants/subjects.ts` (classes dans des constantes), ajouter en tête de fichier :
`/* eslint-disable better-tailwindcss/no-restricted-classes -- palette décorative des matières, paires light/dark explicites et testées */`

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/package.json apps/mobile/eslint.config.mjs pnpm-lock.yaml
git commit -m "ci(mobile): lint gate banning raw palette classes"
```

### Task 7: Validation finale + PR

- [ ] **Step 1: Validation complète mobile**

Run: `cd apps/mobile && pnpm typecheck && pnpm lint && pnpm test`
Expected: PASS sur les trois.

- [ ] **Step 2: QA visuelle light/dark**

Parcours : auth → home élève → chat (stream) → fiches (viewers) → dashboard parent → Pronote. Les deux thèmes, aucun texte illisible, surfaces cohérentes.

- [ ] **Step 3: PR**

PR `feat/phase4b-semantic-codemod` → base `feat/phase4-design-system-dark-mobile` (re-cibler `main` après merge de #222). Description : mapping appliqué, exceptions documentées, gate activé après mesure zéro.
