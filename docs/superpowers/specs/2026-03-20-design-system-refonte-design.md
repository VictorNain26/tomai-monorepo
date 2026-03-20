# Design System Refonte — TomAI Mobile

**Date** : 2026-03-20
**Scope** : `apps/mobile` uniquement
**Stack** : NativeWind v5, Tailwind CSS v4, React Native Reusables, CVA, Lucide Icons

## Contexte

Audit du design system mobile a identifie 5 chantiers :
1. Contraste WCAG AA casse sur la couleur `muted`
2. Architecture couleurs en double (classes Tailwind + objets JS)
3. Absence de variant typographique pour contenu educatif
4. Mappings emoji dupliques 3x pour les matieres scolaires
5. Inline styles dans les layouts au lieu de NativeWind

## Chantier 1 : Fix contraste muted

### Probleme

`stone-500` (#78716C) sur `stone-50` (#FAFAF9) = 3.7:1.
WCAG AA exige 4.5:1 pour le texte normal. Non-conforme European Accessibility Act (juin 2025).

### Solution

Remplacer `stone-500` par `stone-600` (#57534E) en light mode partout :

| Fichier | Changement |
|---------|-----------|
| `src/hooks/useThemeColors.ts` | `muted: '#78716C'` -> `muted: '#57534E'` (LIGHT) |
| `src/lib/styles.ts` | `bgColors.muted` et `borderColors.muted` : rgba `120,113,108` -> `87,83,78` |
| `src/global.css` | Nouveau token `--color-muted` avec la valeur corrigee |
| Composants utilisant `text-stone-500` | Remplacer par `text-stone-600` en light, garder `dark:text-stone-400` |

Le dark mode (`stone-400` #A8A29E sur `stone-900` #1C1917 = 5.5:1) est deja conforme.

### Verification

Ratio de contraste `stone-600` (#57534E) sur `stone-50` (#FAFAF9) = 5.3:1 (passe AA).

## Chantier 2 : Migration tokens semantiques CSS

### Probleme actuel

Les couleurs sont definies en deux endroits :
1. **Classes Tailwind** : `bg-blue-600 dark:bg-blue-400` dans les `className`
2. **Objets JS** : `useThemeColors.ts` avec constantes LIGHT/DARK

Consequence : chaque changement de couleur = 2 fichiers a maintenir.

### Solution

Ajouter des couleurs semantiques dans `@theme` de `global.css` :

```css
@theme {
  /* Semantic Colors — Light values (default) */
  --color-primary: #3B82F6;
  --color-primary-foreground: #FFFFFF;
  --color-success: #059669;
  --color-success-foreground: #FFFFFF;
  --color-warning: #D97706;
  --color-warning-foreground: #FFFFFF;
  --color-destructive: #DC2626;
  --color-destructive-foreground: #FFFFFF;
  --color-info: #0EA5E9;
  --color-info-foreground: #FFFFFF;
  --color-foreground: #1C1917;
  --color-muted: #57534E;
  --color-background: #FAFAF9;
  --color-border: #E7E5E4;
  --color-card: #FFFFFF;
}
```

Cela permet d'utiliser `bg-primary`, `text-destructive`, `border-border` comme classes Tailwind.

### Dark mode

NativeWind v5 ne supporte pas les selecteurs `:root`/`.dark` de la meme maniere que le web. Le `dark:` prefix reste necessaire pour les variantes sombres. L'approche est :

- **Classes NativeWind** : `bg-primary dark:bg-blue-400` (semantique en light, explicit en dark)
- **JS imperatives** : `useThemeColors()` reste pour ActivityIndicator, SVG fills, icones Lucide

### Regles de migration

| Avant | Apres |
|-------|-------|
| `bg-blue-600 dark:bg-blue-400` | `bg-primary dark:bg-blue-400` |
| `text-red-600 dark:text-red-400` | `text-destructive dark:text-red-400` |
| `text-stone-500 dark:text-stone-400` | `text-muted dark:text-stone-400` |
| `bg-stone-50 dark:bg-stone-900` | `bg-background dark:bg-stone-900` |
| `border-stone-200 dark:border-stone-700` | `border-border dark:border-stone-700` |

### Fichiers impactes

- `src/global.css` : ajout tokens `@theme`
- `src/hooks/useThemeColors.ts` : sync valeurs avec tokens (muted corrige)
- `src/lib/styles.ts` : sync rgba avec nouvelles valeurs
- Tous les composants UI et screens : migration progressive des classes

### Ce qui ne change PAS

- `useThemeColors()` reste pour les API imperatives (10-15 usages)
- `useIconColors()` reste (alias de useThemeColors)
- Le systeme `dark:` prefix de NativeWind reste le mecanisme dark mode
- `bgColors` et `borderColors` dans `styles.ts` restent pour les opacity variants

## Chantier 3 : Variant typographique `reading`

### Besoin

L'app cible des eleves de CP (6 ans) a Terminale (18 ans). Le body text actuel (16px, leading-normal) est insuffisant pour le contenu pedagogique destine aux plus jeunes.

### Solution

Ajouter un variant `reading` au composant `Text` :

```tsx
reading: 'text-lg font-sans leading-relaxed text-foreground dark:text-stone-100',
```

| Propriete | Valeur | Justification |
|-----------|--------|---------------|
| Font size | 18px (`text-lg`) | Minimum recommande pour lecture prolongee mobile |
| Line height | 1.625 (`leading-relaxed`) | Ameliore comprehension pour jeunes lecteurs |
| Font family | Nunito Sans (`font-sans`) | Coherent avec le body text |
| Font weight | Regular (400) | Confort de lecture longue duree |

### Usage prevu

- Flashcards : contenu de la carte (question/reponse)
- Chat : messages du tuteur IA (explications longues)
- Contenu de cours affiche dans les viewers

### Accessibilite

- `accessibilityRole` : pas de role special (texte courant)
- Respecte Dynamic Type (pas de `maxFontSizeMultiplier` restrictif)

## Chantier 4 : Tokens matieres scolaires

### Probleme actuel

1. `SubjectMetadata.emoji` utilise des emojis Unicode — remplacer par icones Lucide
2. Le champ `color` est un mot (`'blue'`) sans mapping vers des classes Tailwind
3. **3 mappings emoji dupliques** : dashboard, chat, learning DeckCard

### Solution

#### 4.1 Nouveau type `SubjectMetadata`

```tsx
export interface SubjectMetadata {
  name: string;
  description: string;
  icon: string;           // Nom d'icone Lucide (ex: 'Calculator')
  color: SubjectColor;    // Cle couleur Tailwind
}

export type SubjectColor =
  | 'blue' | 'violet' | 'purple' | 'emerald' | 'amber'
  | 'rose' | 'yellow' | 'slate' | 'teal' | 'gray';
```

#### 4.2 Mapping icones Lucide

| Matiere | Icone Lucide | Couleur |
|---------|-------------|---------|
| `mathematiques` | `Calculator` | `blue` |
| `francais` | `BookOpen` | `violet` |
| `physique_chimie` | `FlaskConical` | `purple` |
| `svt` | `Leaf` | `emerald` |
| `histoire_geo` | `Globe` | `amber` |
| `anglais` | `Languages` | `rose` |
| `espagnol` | `MessageCircle` | `yellow` |
| `allemand` | `Book` | `slate` |
| `italien` | `Drama` | `teal` |
| `technologie` | `Cog` | `gray` |
| Fallback | `GraduationCap` | `gray` |

#### 4.3 Helper `getSubjectStyles()`

Nouveau helper qui retourne les classes Tailwind pour une matiere :

```tsx
export function getSubjectStyles(color: SubjectColor): {
  bg: string;        // 'bg-blue-50 dark:bg-blue-950'
  bgSubtle: string;  // 'bg-blue-100/50 dark:bg-blue-900/30'
  text: string;      // 'text-blue-600 dark:text-blue-400'
  border: string;    // 'border-blue-200 dark:border-blue-800'
  iconColor: { light: string; dark: string }; // { light: '#3B82F6', dark: '#60A5FA' }
}
```

Note : `iconColor` retourne les deux variantes. Le composant `SubjectIcon` utilise
`useTheme().isDark` pour selectionner la bonne valeur. Les classes NativeWind (`bg`, `text`, `border`)
gerent le dark mode automatiquement via le prefix `dark:`.

#### 4.4 Composant `SubjectIcon`

```tsx
interface SubjectIconProps {
  subject: string;      // Cle matiere (ex: 'mathematiques', 'maths')
  size?: number;        // Default 20
  className?: string;
}
```

Utilise `enrichSubjectKey()` pour resoudre la matiere, puis rend l'icone Lucide correspondante avec la couleur de la matiere.

#### 4.5 Suppression des duplications

| Fichier | Mapping duplique a supprimer |
|---------|------------------------------|
| `src/app/(student)/(home)/index.tsx` | `getSubjectEmoji()` local |
| `src/app/(student)/(chat)/index.tsx` | `getSubjectEmoji()` local |
| `src/app/(student)/(chat)/chat.tsx` | `getSubjectEmoji()` local |
| `src/components/learning/DeckCard.tsx` | `SUBJECT_EMOJIS` local |

Tous remplaces par `<SubjectIcon subject={key} />` + `enrichSubjectKey(key).name`.

#### 4.6 Palette couleurs revisee

Changements par rapport a l'existant :
- `francais` : `red` -> `violet` (distinction avec anglais)
- `anglais` : `red` -> `rose` (communication, distinction du francais)
- `svt` : `green` -> `emerald` (plus precis, token Tailwind)
- `histoire_geo` : `orange` -> `amber` (token Tailwind standard)
- `italien` : `green` -> `teal` (distinction avec SVT)

### Ordre d'implementation Chantier 1 + 2

Les chantiers 1 et 2 se chevauchent sur les memes lignes (ex: `text-stone-500` dans `text.tsx`).
L'implementation doit les fusionner : remplacer `text-stone-500` directement par `text-muted`
ou le token CSS a la valeur corrigee `stone-600`. Ne pas faire deux passes separees.

## Chantier 5 : Standardiser inline styles layouts

### Probleme

Les layouts tab bar utilisent des inline styles au lieu de NativeWind :
- `(student)/_layout.tsx` : `colors.primary` en inline pour tab bar
- `(parent)/_layout.tsx` : idem
- Banner quick switch etudiant->parent : entierement en inline

### Solution

Remplacer par des classes NativeWind :

| Avant | Apres |
|-------|-------|
| `style={{ backgroundColor: colors.primary }}` | `className="bg-primary dark:bg-blue-400"` |
| `style={{ color: colors.foreground }}` | `className="text-foreground dark:text-stone-100"` |

**Exception** : les props de navigation (Tabs `screenOptions`) qui acceptent uniquement des objets `color` gardent `useThemeColors()` — c'est une API imperative.

### Fichiers impactes

- `src/app/(student)/_layout.tsx`
- `src/app/(parent)/_layout.tsx`

## Fichiers impactes — Resume

| Fichier | Chantiers |
|---------|-----------|
| `src/global.css` | 1, 2 |
| `src/hooks/useThemeColors.ts` | 1, 2 |
| `src/lib/styles.ts` | 1, 2 |
| `src/components/ui/text.tsx` | 3 |
| `src/constants/subjects.ts` | 4 |
| `src/components/common/SubjectIcon.tsx` | 4 (nouveau) |
| `src/app/(student)/(home)/index.tsx` | 4, 5 |
| `src/app/(student)/(chat)/index.tsx` | 4 |
| `src/app/(student)/(chat)/chat.tsx` | 4 |
| `src/components/learning/DeckCard.tsx` | 4 |
| `src/app/(student)/_layout.tsx` | 5 |
| `src/app/(parent)/_layout.tsx` | 5 |
| `__tests__/constants/subjects.test.ts` | 4 |

## Contraintes

- **Zero breaking changes** : memes exports, memes noms de hooks
- **Pas de nouvelle dependance** : Lucide et NativeWind deja installes
- **Tests existants** : mettre a jour `subjects.test.ts` pour le nouveau type
- **400 lignes max** par fichier (contrainte monorepo)
- **TypeScript strict** : pas de `any`

## Hors scope

- Migration complete dark mode vers CSS custom properties (NativeWind v5 ne le supporte pas pleinement en React Native)
- Ajout de nouveaux composants UI (Select, Switch, Badge) — chantier separe
- Storybook ou documentation de composants
- Modifications backend
