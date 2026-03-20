# Refonte Design System Mobile — "Warm Minimal"

**Date** : 2026-03-15
**Scope** : `apps/mobile/src/` — UI components, theme, typography, cleanup
**Inspirations** : Pi (warmth), Perplexity (clean), Brilliant (focus)
**Principe** : Un seul design mature premium pour tous les ages (CP-Terminale)

---

## 1. Palette de couleurs

Migration complete Slate → Stone pour une temperature chaude.

### Light Mode

| Token | Valeur | Tailwind |
|-------|--------|----------|
| background | `#FAFAF9` | stone-50 |
| card | `#FFFFFF` | white |
| foreground | `#1C1917` | stone-900 |
| muted | `#78716C` | stone-500 |
| border | `#E7E5E4` | stone-200 |
| primary | `#3B82F6` | blue-500 |
| primary-foreground | `#FFFFFF` | white |
| success | `#059669` | emerald-600 |
| warning | `#D97706` | amber-600 |
| destructive | `#DC2626` | red-600 |

### Dark Mode (par defaut)

| Token | Valeur | Tailwind |
|-------|--------|----------|
| background | `#1C1917` | stone-900 |
| card | `#292524` | stone-800 |
| foreground | `#F5F5F4` | stone-100 |
| muted | `#A8A29E` | stone-400 |
| border | `#44403C` | stone-700 |
| primary | `#60A5FA` | blue-400 |
| primary-foreground | `#1C1917` | stone-900 |
| success | `#34D399` | emerald-400 |
| warning | `#FBBF24` | amber-400 |
| destructive | `#F87171` | red-400 |

### Couleurs matieres

Inchangees — definies dans `src/constants/subjects.ts`.

### Token `info`

Conserve dans les deux modes :
- Light : `#0EA5E9` (sky-500)
- Dark : `#38BDF8` (sky-400)

Utilise dans le login et les toasts.

### Opacity scales (simplifie)

4 niveaux max par couleur : `[5]`, `[10]`, `[15]`, `[20]`. Exception : `bgColors.background[90]` conserve (overlay).

Supprimes :
- `bgColors.white` (0 usage)
- `bgColors.background[5, 10, 20]` (0 usage)
- `bgColors.info[15, 20]` (0 usage)
- `bgColors.primary[30]` — migrer vers `[20]`
- `borderColors.info` (0 usage)
- `borderColors.success[50]` (0 usage)
- `shadows.none` (0 usage)

---

## 2. Typographie

### Fonts

| Usage | Font | Weights |
|-------|------|---------|
| Headings | **Poppins** | 600 SemiBold, 700 Bold |
| Body | **Nunito Sans** | 400 Regular, 500 Medium, 600 SemiBold |
| Code | **JetBrains Mono** | 400 Regular |

Remplacement : Inter → Nunito Sans, Plus Jakarta Sans → Poppins.

### Migration des fonts (native)

1. Installer `@expo-google-fonts/nunito-sans` et `@expo-google-fonts/poppins`
2. Desinstaller `@expo-google-fonts/inter` et `@expo-google-fonts/plus-jakarta-sans`
3. Mettre a jour `useFonts()` dans `src/app/_layout.tsx` :
   - `NunitoSans_400Regular`, `NunitoSans_500Medium`, `NunitoSans_600SemiBold`
   - `Poppins_600SemiBold`, `Poppins_700Bold`
4. Configurer `global.css` avec `@theme { --font-sans: 'NunitoSans'; --font-heading: 'Poppins'; }`
5. Mettre a jour les classes CVA dans `text.tsx` :
   - Variants h1-h4 : ajouter `font-heading` (resolu vers Poppins via le theme token)
   - Variants body (default, large, small, muted, tiny, error, success) : `font-sans` (resolu vers Nunito Sans)
6. **Rebuild natif obligatoire** (`pnpm build:dev`) — les fonts sont des assets natifs

### Echelle (14 → 10 variants)

| Variant | Taille | Font | Weight | Usage |
|---------|--------|------|--------|-------|
| `h1` | 32px | Poppins | Bold | Titres de page |
| `h2` | 24px | Poppins | Bold | Sections |
| `h3` | 20px | Poppins | SemiBold | Sous-sections |
| `h4` | 18px | Poppins | SemiBold | Titres de cards |
| `large` | 18px | Nunito Sans | SemiBold | Texte emphase |
| `default` | 16px | Nunito Sans | Regular | Corps de texte |
| `small` | 14px | Nunito Sans | Medium | Labels, metadata |
| `muted` | 14px | Nunito Sans | Regular | Texte secondaire |
| `tiny` | 12px | Nunito Sans | Medium | Badges, timestamps |
| `error` | 14px | Nunito Sans | Medium | Messages d'erreur |

Supprimes : `lead` (0 usage), `label` (0 usage), `heading` (doublon h2 — migrer son `accessibilityRole` dans le mapping h1-h4), `caption` (2 usages → migrer vers `muted`).

Variant `success` conservee (14px, Nunito Sans Medium, emerald) — utilisee pour les feedbacks positifs.

---

## 3. Composants — Nettoyage

### Supprimes entierement

| Composant | Fichier | Lignes | Raison |
|-----------|---------|--------|--------|
| Badge | `ui/badge.tsx` | 91 | 0 import |
| SkeletonText | `ui/skeleton.tsx` | ~15 | 0 import |
| SkeletonAvatar | `ui/skeleton.tsx` | ~10 | 0 import |
| SkeletonCard | `ui/skeleton.tsx` | ~15 | 0 import |
| SkeletonButton | `ui/skeleton.tsx` | ~14 | 0 import |
| ButtonText | `ui/button.tsx` | ~12 | 0 import externe |
| useButtonTextClass (export) | `ui/button.tsx` | ~3 | Lie a ButtonText |

### Button (simplifie)

**Variants** : `default`, `destructive`, `outline`, `ghost` (supprimes : `link`, `secondary`, `subtle`)
**Sizes** : `default` (h-12), `sm` (h-11), `icon` (h-12), `icon-sm` (h-10) (supprimes : `lg`, `icon-lg`)
**Haptics (prop Button uniquement)** : `light`, `heavy` uniquement. Le module `src/lib/haptics.ts` reste inchange (medium/success/error/warning sont utilises par Toast et VoiceInput).
**Spinner** : Logique simplifiee a 2 cas.

Migration `subtle` → `ghost` :
- `src/components/dashboard/HomeworkUrgentCard.tsx` (ligne ~223)
- `src/components/dashboard/GradesRecentCard.tsx` (ligne ~259)

**Nettoyage interne button.tsx** : apres suppression des variants CVA, nettoyer aussi les branches mortes dans `getSpinnerColor()`, `needsActiveOpacity`, et `buttonTextVariants` qui referencent `secondary`, `link`, `lg`, `icon-lg`.

### Text (simplifie)

10 variants (voir section Typographie). Migrer les 2 usages de `caption` vers `muted` ou `tiny`.

### Avatar (conserve tel quel)

Les 4 sizes (`sm`, `md`, `lg`, `xl`) sont toutes utilisees :
- `sm` : ChatHeader, ChatMessage (via TomAvatar)
- `md` : usage general
- `lg` : listes
- `xl` : profil enfant hero (`(parent)/(home)/child/[id]/index.tsx`)

### Progress (simplifie)

**Variants** : `default`, `warning`, `destructive` (supprime : `success`)

### Input — inchange

3 variants (default, error, success), tous utilises.

### Card / CardCompact — inchanges

### Toast / ConfirmDialog — inchanges

### Skeleton (base) — inchange

Seuls les presets sont supprimes.

---

## 4. Theme — Dark mode par defaut

- Default initial : `'dark'` au lieu de `'system'`
- L'utilisateur peut changer (light/dark/system) dans settings
- Persiste en AsyncStorage (deja en place)
- `useThemeColors()` : memes tokens semantiques, valeurs Stone au lieu de Slate

---

## 5. Migration Slate → Stone

Remplacement mecanique dans **deux couches** :

### 5a. Classes Tailwind (`apps/mobile/src/**/*.tsx`)

Toutes les classes Tailwind de `apps/mobile/src/` :

| Pattern | Remplacement |
|---------|-------------|
| `slate-50` | `stone-50` |
| `slate-100` | `stone-100` |
| `slate-200` | `stone-200` |
| `slate-300` | `stone-300` |
| `slate-400` | `stone-400` |
| `slate-500` | `stone-500` |
| `slate-600` | `stone-600` |
| `slate-700` | `stone-700` |
| `slate-800` | `stone-800` |
| `slate-900` | `stone-900` |
| `slate-950` | `stone-950` |

Inclut les variantes `bg-`, `text-`, `border-`, `dark:bg-`, `dark:text-`, `dark:border-`.

### 5b. Valeurs hex dans le code (`useThemeColors.ts` + `styles.ts`)

Ces fichiers contiennent des hex hardcodes Slate qui doivent etre mis a jour manuellement :

**`src/hooks/useThemeColors.ts`** — mettre a jour toutes les valeurs hex vers Stone :
- Light: background `#FAFAF9`, foreground `#1C1917`, muted `#78716C`, border `#E7E5E4`
- Dark: background `#1C1917`, card `#292524`, foreground `#F5F5F4`, muted `#A8A29E`, border `#44403C`

**`src/lib/styles.ts`** — mettre a jour les hex de base dans `bgColors` et `borderColors` vers les equivalents Stone.

---

## 6. Hors scope

| Element | Raison |
|---------|--------|
| Navigation structure (tabs, stacks) | Fonctionne bien |
| Feature components (chat, learning, pronote) | S'adaptent via les tokens |
| global.css architecture | On met a jour les valeurs, pas la structure |
| Providers hierarchy | Infrastructure |
| Subject colors | Fonctionnelles |
| SafeAreaView wrapper | Necessaire NativeWind v5 |
| CVA + cn() pattern | Bon pattern, on le garde |

---

## 7. Bilan

| Metrique | Avant | Apres |
|----------|-------|-------|
| Palette | Slate (froid) | Stone (chaud) |
| Typo | Inter + Plus Jakarta Sans | Nunito Sans + Poppins |
| Dark mode default | system | dark |
| Button variants | 6 + 6 sizes | 4 + 4 sizes |
| Text variants | 14 | 11 (+ success) |
| Avatar sizes | 4 | 4 (conserve) |
| Progress variants | 4 | 3 |
| Badge component | Present | Supprime |
| Skeleton presets | 4 | 0 (base gardee) |
| styles.ts scales | ~30 | ~18 |
| Code mort | ~300 lignes | 0 |
| Fonctionnalites perdues | — | 0 |
