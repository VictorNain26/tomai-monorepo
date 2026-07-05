# Design — Système UI/UX unifié (landing, web, mobile)

- **Date** : 2026-07-05
- **Statut** : validé par Victor (cadrage), spec en revue
- **Portée** : uniformisation du design sur les trois surfaces. La direction artistique définitive est un chantier ultérieur — ce design structure les fondations pour qu'elle soit un simple échange de valeurs de tokens.

## Contexte

Post-ADR 0001, le produit vit dans **deux mondes UI** : la landing Next.js (DOM, shadcn via `@repo/ui`) et l'app universelle Expo (React Native, React Native Reusables), qui servira le produit web et mobile. `apps/web` disparaît au cutover. `@repo/tokens` existe déjà (couleurs sémantiques light/dark, fontes, rayons, espacements) et est consommé par les trois apps.

État des lieux vérifié (2026-07-05) : les composants des deux côtés sont déjà tokens-first (aucune valeur hex hardcodée détectée dans `packages/ui/src/components` ni `apps/mobile/src/components/ui`), et les composants RN suivent déjà la grammaire cva/variants de shadcn.

## Décisions

### D1 — Pas de composants partagés entre DOM et RN

Conforme ADR 0001 (Tamagui rejeté, landing reste Next.js). Le partage se fait au niveau **tokens + contrat de parité**, pas au niveau code des composants.

### D2 — `@repo/tokens` est l'unique source de vérité du design

Toute décision visuelle (couleur, typo, rayon, espacement, motion) vit dans `@repo/tokens`. Une valeur visuelle qui n'est pas un token est un bug. La DA future = éditer `theme.css`/`theme-dark.css`/`src/colors.ts`, zéro changement dans les apps.

### D3 — Palette actuelle conservée comme placeholder structuré

Pas de restyling maintenant. La palette shadcn-alignée actuelle (primary `#2563EB`, etc.) reste en place ; sa **structure sémantique** (background/foreground/primary/…/violet) est le contrat que la DA future remplira.

### D4 — Double registre par convention d'usage, pas par mécanisme

Une seule identité de marque, deux registres d'expression :

- **Sobre** (landing, espace parent, B2B) : palette froide, motion minimal, pas de haptics superflus.
- **Vivant** (expérience élève, 11-18 ans) : accent `violet` autorisé, micro-motion (durées tokens), haptics. Jamais infantilisant — pas de mascotte cartoon, pas de formes enfantines.

Aucun nouveau token ni scope CSS pour l'instant : c'est une règle d'usage des tokens existants, documentée. Si la DA future exige des valeurs distinctes par registre, on introduira alors une surcouche de variables (classe CSS côté web, provider NativeWind côté RN) — YAGNI aujourd'hui.

## Architecture

```
@repo/tokens        ← source de vérité (CSS @theme + miroir TS testé)
   ├── apps/landing     (Tailwind v4 + @repo/ui — DOM)
   ├── apps/web         (idem, jusqu'au cutover — aucun investissement)
   └── apps/mobile      (NativeWind v5 + RNR — app universelle)
```

- **`@repo/ui`** : implémentation DOM des composants (shadcn). Consommateur pérenne : landing.
- **`apps/mobile/src/components/ui`** : implémentation RN (RNR). Vit dans l'app (ADR 0001 : pas de package de logique/UI partagée pour le conso).
- Les deux implémentations sont des **jumeaux par contrat** (voir Contrat de parité).

## Tokens ajoutés (lot uniformisation)

### Motion (nouveau)

Dans `theme.css` :

```css
--duration-fast: 150ms;   /* micro-feedback : press, toggle */
--duration-base: 250ms;   /* transitions standard : fade, slide court */
--duration-slow: 400ms;   /* entrées d'écran, éléments larges */
--ease-out: cubic-bezier(0, 0, 0.2, 1);   /* entrées */
--ease-in-out: cubic-bezier(0.4, 0, 0.2, 1); /* déplacements */
```

Miroir TS dans `src/motion.ts` (consommé par Reanimated côté RN), cohérence CSS ↔ TS garantie par test sur le modèle de `colors.test.ts`.

### Rôles typographiques (règle d'usage figée)

Les fontes sont déjà dans les tokens ; on fige leur usage :

- **Poppins** (`--font-heading`) : titres et display uniquement.
- **Nunito Sans** (`--font-sans`) : corps, UI, formulaires.
- **JetBrains Mono** (`--font-mono`) : code, données techniques.

### Non ajoutés (YAGNI, revisités à la DA)

- Tokens couleur supplémentaires (registres, dégradés, élévations colorées).
- Breakpoints custom : défauts Tailwind v4/NativeWind suffisants.
- Tokens d'ombre : défauts Tailwind côté web ; côté RN, élévation au cas par cas.

## Contrat de parité composants

### Inventaire (2026-07-05)

| Composant | `@repo/ui` (DOM) | RN (`ui/`) | Action |
|---|---|---|---|
| `button` | ✓ | ✓ | Aligner variants/sizes |
| `card` | ✓ | ✓ | Aligner |
| `input` | ✓ | ✓ | Aligner |
| `avatar` | ✓ | ✓ | Aligner |
| `skeleton` | ✓ | ✓ | Aligner |
| `badge`, `label`, `select`, `table`, `dialog`, `alert-dialog`, `sonner` | ✓ | — | Spécifique DOM, OK |
| `text`, `screen`, `toast`, `progress`, `confirm-dialog` | — | ✓ | Spécifique RN, OK |

### Règles

1. **Homonyme = mêmes variants et sizes** des deux côtés (ex. Button : `default | destructive | outline | ghost | secondary` ; l'alignement exact est fixé au plan d'implémentation après lecture des deux fichiers).
2. **Zéro valeur hardcodée** : uniquement des classes utilitaires issues des tokens. S'applique aussi aux écrans, pas seulement aux composants.
3. **États complets** sur tout élément interactif : disabled, loading, pressed (RN) / hover+active (DOM), focus visible, error le cas échéant.
4. **A11y AA** : cibles tactiles ≥ 44 px, `accessibilityLabel`/`aria-*`, contraste 4.5:1, navigation clavier côté DOM.
5. **Divergences autorisées** : uniquement ce qui est intrinsèque à la plateforme (haptics RN, focus-ring DOM, ActivityIndicator vs spinner CSS).

## Patterns UX communs

Applicables aux trois surfaces :

- **Loading** : skeletons (jamais de spinner pleine page) ; spinner seulement inline (bouton en cours).
- **Empty states** : toujours un message + une action de sortie, jamais un écran vide.
- **Erreurs** : nommer le problème + l'action corrective ; toast pour l'information/le succès, dialog réservé à l'irréversible.
- **Formulaires** : label toujours visible (jamais placeholder seul), validation au blur (pas à la frappe, pas seulement à la soumission), champ en erreur jamais vidé, `inputmode`/`autocomplete`/type de clavier adaptés.
- **Dark mode** : disponible et **persistant** sur les trois surfaces (classe `.dark` web, `useThemeColors`/variables runtime RN — mécanismes existants).
- **Motion** : durées/easings via tokens uniquement ; `prefers-reduced-motion` (web) et `AccessibilityInfo.isReduceMotionEnabled` (RN) respectés — fallback opacité.
- **Double registre** : cf. D4 — sobre (landing/parent), vivant (élève).

## Gouvernance

- **`docs/design/design-system.md`** : le contrat complet ci-dessus, en doc humaine pérenne (ce fichier-ci est la spec du chantier ; le doc design est le livrable).
- **`.claude/rules/design-system.md`** : version condensée (~30 lignes) auto-chargée par Claude Code — règles de parité, tokens-only, états, a11y, registres. C'est le garde-fou quotidien.
- **Test tokens** : `colors.test.ts` étendu (ou dupliqué en `motion.test.ts`) pour chaque token à miroir TS.
- **Revue** : la parité composants est vérifiée en revue de PR (spec-reviewer/code-reviewer) — pas de tooling custom supplémentaire (YAGNI).

## Hors scope (explicitement)

- La direction artistique définitive (palette, illustrations, iconographie de marque, mascotte éventuelle) — chantier ultérieur, préparé par D2/D3.
- Tout investissement dans `apps/web` (meurt au cutover).
- Storybook / catalogue visuel outillé — revisité si le nombre de composants le justifie.
- `packages/chat-core` (coquille vide constatée dans le repo — à traiter dans le chantier chat, pas ici).

## Séquencement proposé

Chantier léger, indépendant des lots de l'audit en cours (n'interfère pas avec le lot 4 chat) :

1. **Lot A — Fondations** : tokens motion + miroir TS + test ; `docs/design/design-system.md` ; `.claude/rules/design-system.md`.
2. **Lot B — Parité** : alignement variants des 5 composants homonymes ; audit rapide états/a11y sur ces composants ; corrections.

Chaque lot = branche courte → PR → merge (workflow main-first).

## Critères de succès

- Un changement de couleur de marque se fait en éditant uniquement `@repo/tokens` et se propage aux trois surfaces.
- Les 5 composants homonymes exposent les mêmes variants des deux côtés.
- Les règles de design sont chargées automatiquement dans toute session Claude Code du repo.
- `pnpm typecheck && pnpm lint && pnpm test` verts sur le monorepo après chaque lot.
