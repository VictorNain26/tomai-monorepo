# Design system Tom — contrat des deux surfaces

Source de vérité du design unifié entre `apps/landing` (DOM) et l'app
universelle Expo (`apps/mobile` — natif aujourd'hui, cible web produit + mobile
au Lot 5). `apps/web` a été supprimée (ADR 0001, chapitre web fermé).
Spec d'origine : `2026-07-05-design-system-unifie-design.md` (supprimée, historique git).

## Règle zéro : tout passe par `@repo/tokens`

Toute décision visuelle (couleur, typo, rayon, espacement, durée d'animation)
vit dans `@repo/tokens`. Une valeur visuelle hardcodée dans une app ou un
composant est un bug. La direction artistique définitive (chantier ultérieur)
se fera en éditant uniquement ce package.

## Tokens

- **Couleurs** : sémantiques shadcn-alignées (`background`, `foreground`,
  `primary`, `secondary`, `muted`, `accent`, `card`, `destructive`, `success`,
  `warning`, `info`, `border`, `input`, `ring`, `violet`). Light `theme.css`,
  dark `theme-dark.css`, miroir TS `colors.ts` (testé).
- **Typo** : Poppins (`font-heading`) = titres/display uniquement ;
  Nunito Sans (`font-sans`) = corps, UI, formulaires ;
  JetBrains Mono (`font-mono`) = code et données techniques.
- **Motion** : `duration-fast` 150 ms (micro-feedback), `duration-base` 250 ms
  (transitions standard), `duration-slow` 400 ms (entrées d'écran),
  `duration-pulse` 1000 ms (demi-cycle skeleton). Easings : `ease-out` en
  entrée, `ease-in-out` en déplacement (courbes standard Tailwind ; miroir JS
  `motionEasings` pour Reanimated).
- **Rayons/espacements** : échelle `--radius-*` et `--spacing-*` du package.

## Contrat de parité des composants

Deux implémentations jumelles, jamais de composant partagé DOM/RN (ADR 0001) :
`packages/ui` (DOM, landing) et `apps/mobile/src/components/ui` (RN, app
universelle).

1. **Homonyme = même noyau de variants/sizes.**
   Button : `default | destructive | outline | secondary | ghost` ;
   extensions DOM-only : `link`, `premium` ; sizes : vocabulaire commun
   (`sm | default | lg | icon`), hauteurs par plateforme.
   Avatar : sizes `sm (32) | md (40) | lg (48) | xl (64)`.
   Card : sous-composants `Header | Title | Description | Content | Footer`
   des deux côtés (`CardCompact` RN-only).
2. **Tokens uniquement** — aucune couleur/durée/rayon littéral dans un
   composant ou un écran.
3. **États complets** sur tout interactif : disabled, loading, pressed (RN) /
   hover + active (DOM), focus visible, error le cas échéant.
4. **A11y AA** : cibles ≥ 44 px tactile, `accessibilityLabel`/`aria-*`,
   contraste 4.5:1, navigation clavier côté DOM.
5. **Divergences autorisées** : uniquement l'intrinsèque plateforme —
   haptics et `ActivityIndicator` RN, focus-ring et `hover` DOM, densités
   (h-10 desktop vs h-12 touch), Card bordée (DOM) vs borderless (RN,
   tranché à la DA).

## Patterns UX communs

- **Loading** : skeletons ; spinner uniquement inline (bouton en cours).
- **Empty states** : message + action de sortie, jamais un écran vide.
- **Erreurs** : nommer le problème + l'action corrective. Toast = information
  et succès ; dialog = réservé à l'irréversible.
- **Formulaires** : label toujours visible (jamais placeholder seul),
  validation au blur, champ en erreur jamais vidé, clavier adapté
  (`inputmode`/`autocomplete` DOM, `keyboardType`/`textContentType` RN).
- **Dark mode** : disponible et persistant sur les deux surfaces
  (`.dark` + `theme-dark.css` web, variables runtime NativeWind mobile).
- **Motion** : durées/easings via tokens ; `prefers-reduced-motion` (web) et
  `AccessibilityInfo.isReduceMotionEnabled` (RN) respectés — fallback opacité.

## Double registre (une marque, deux intensités)

- **Sobre** — landing, espace parent, B2B : palette froide, motion minimal,
  pas de haptics superflus.
- **Vivant** — expérience élève (11-18 ans) : accent `violet` autorisé,
  micro-motion, haptics. Jamais infantilisant : pas de mascotte cartoon,
  pas de formes enfantines.

Aucun mécanisme dédié : c'est une convention d'usage des tokens existants.
Si la DA future exige des valeurs distinctes par registre, on introduira une
surcouche de variables (classe CSS web, provider NativeWind RN).
