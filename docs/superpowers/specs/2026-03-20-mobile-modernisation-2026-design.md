# Modernisation Mobile 2026 — Spec

**Date** : 2026-03-20
**Scope** : apps/mobile
**Objectif** : Aligner le projet mobile sur les meilleures pratiques Expo/React Native/React 19 de mars 2026.

---

## Phase 1 — Config Quick Wins (P0)

Changements de configuration sans impact sur le code applicatif. ~15 min.

### 1.1 React Compiler

Le React Compiler v1.0 (stable depuis oct 2025) effectue la memoisation automatique au build. Elimine le besoin de `useMemo`, `useCallback`, `React.memo` manuels.

**Fichier** : `babel.config.js`
**Action** : Ajouter `babel-plugin-react-compiler` comme premier plugin, avant `react-native-reanimated/plugin` (qui doit rester dernier).
**Dep** : `pnpm add -D babel-plugin-react-compiler`
**Risques** :
- React Compiler + Reanimated : le compiler peut interferer avec les fonctions worklet et shared values. Tester les animations apres activation. Si problemes, utiliser `"use no memo"` en haut des fichiers avec usage intensif de Reanimated.
- React Compiler + NativeWind v5 preview : le CSS interop peut avoir des edge cases avec la memoisation. Tester le styling apres activation.
**Validation** : `pnpm typecheck && pnpm lint && pnpm test` + verification manuelle des animations et du styling

### 1.2 Typed Routes

Deja active dans `app.config.ts` (ligne 145-147). **Aucune action requise.**

### 1.3 Hermes Bytecode Diffing

Reduit la taille des OTA updates (EAS Updates) via diffing binaire du bytecode Hermes.

**Fichier** : `app.config.ts` (plugin `expo-build-properties`, ligne 118)
**Action** : Ajouter `hermesBytecodeOptimizations: true` dans les options android du plugin expo-build-properties. Verifier la documentation SDK 55 pour le nom exact du flag — `enableBsdiffPatchSupport` est le nom cite dans le changelog mais peut differer dans l'API du plugin.
**Validation** : Build de verification non requis (affecte uniquement les builds EAS)

---

## Phase 2 — React 19 Modernization (P1)

Refactoring du code pour adopter les patterns React 19. ~2h.

### 2.1 Supprimer `forwardRef`

En React 19, `ref` est un prop normal. `forwardRef` est deprecie.

**Fichier affecte** : `src/components/ui/input.tsx` (seul fichier utilisant `forwardRef`)
**Action** :
- Supprimer le wrapper `React.forwardRef()`
- Ajouter `ref` comme prop normal dans la signature du composant
- Mettre a jour le type : `ref?: React.Ref<TextInput>`
**Note** : Les composants React Native Reusables ajoutes a l'avenir depuis les templates upstream utiliseront probablement `forwardRef` — appliquer le meme traitement.
**Validation** : `pnpm typecheck && pnpm test`

### 2.2 Remplacer `useContext` par `use`

`use()` de React 19 remplace `useContext()`. Plus flexible (peut etre appele conditionnellement avec des Contexts, pas avec des Promises dans ce cas).

**Fichiers affectes** (5) :
- `src/components/ui/text.tsx`
- `src/components/ui/toast.tsx`
- `src/components/ui/confirm-dialog.tsx`
- `src/components/providers/RevenueCatProvider.tsx`
- `src/hooks/useTheme.ts`

**Action** : Remplacer `import { useContext } from 'react'` par `import { use } from 'react'` et `useContext(Ctx)` par `use(Ctx)`.
**Trade-off** : Les fichiers `text.tsx`, `toast.tsx`, `confirm-dialog.tsx` viennent des templates React Native Reusables. Les modifier diverge de l'upstream, mais c'est un changement mineur et facilement re-applicable.
**Validation** : `pnpm typecheck && pnpm test`

### 2.3 Simplifier les Context Providers

En React 19, `<Context>` peut etre utilise directement comme provider (plus besoin de `.Provider`).

**Fichiers affectes** (5) :
- `src/components/ui/toast.tsx`
- `src/components/ui/confirm-dialog.tsx`
- `src/components/ui/button.tsx`
- `src/components/providers/ThemeProvider.tsx`
- `src/components/providers/RevenueCatProvider.tsx`

**Action** : Remplacer `<XxxContext.Provider value={...}>` par `<XxxContext value={...}>` et les closing tags correspondants.
**Validation** : `pnpm typecheck && pnpm test`

### 2.4 `useOptimistic` pour le chat — DIFFERE

~~Initialement prevu pour cette phase.~~

**Raison du report** : `useOptimistic` est concu pour des operations async discretes (submit → reponse). Le chat utilise du SSE streaming (tokens delivres incrementalement), ce qui cree une incompatibilite :
- L'etat optimiste est remplace quand l'action "complete", mais le SSE n'a pas de point de completion unique
- Risque de flickering : le message optimiste pourrait etre prematurerement remplace par le premier token SSE

**Decision** : Reporter a une session dediee avec un spike technique pour concevoir l'interaction optimiste + SSE. Documenter dans la Phase 3.

---

## Phase 3 — Testing & Securite (P2) — Session future

### 3.1 Verification compat tests React 19

**Action** : Verifier qu'aucun test n'importe `react-test-renderer` (incompatible React 19). Migrer vers `@testing-library/react-native` si necessaire.

### 3.2 Maestro E2E

**Action** : Setup Maestro pour les flows critiques (login, chat, flashcards). Integrer dans EAS Workflows (`eas/maestro-test`).

### 3.3 SSL Certificate Pinning

**Action** : Ajouter `react-native-ssl-pinning` pour securiser les appels API contre les attaques MITM.
**Contrainte** : Planifier la rotation des certificats (expiry 1-2 ans).

### 3.4 Audit bundle size — FAIT (quick wins appliques)

**Realise** :
- Supprime `@expo/vector-icons` (inutilise, ~50KB) — commit `998a8ee`
- Mis a jour 27 packages Expo vers les derniers patchs

**A faire (session future, ~400-500KB de savings potentiels)** :
- Lazy-load des 13 card viewers dans `CardViewer.tsx` via `React.lazy()` (~150-200KB)
- Lazy-load `MathText.tsx` et `MermaidDiagram.tsx` (WebView, ~50-80KB)
- Refactorer les barrel exports (`export *`) en imports directs (~30-60KB)
- Evaluer remplacement de `lucide-react-native` (250KB full, seuls 53 icons utilises)

### 3.5 Spike `useOptimistic` + SSE chat

**Action** : Concevoir l'interaction entre `useOptimistic` et le flow SSE streaming dans `useChat.ts`. Determiner si `useOptimistic` est le bon outil ou si un pattern custom (etat local + rollback manuel) est preferable.

---

## Phase 4 — UX Native & Accessibilite (P3) — Session future

### 4.1 Evaluer `@expo/ui`

**Action** : Tester les composants natifs SwiftUI/Jetpack Compose (DatePicker, Toggle, ListItem) pour les ecrans settings/profil.
**Decision** : A prendre apres evaluation — potentiellement remplacer certains composants React Native Reusables.

### 4.2 Stack.Protected pour l'auth

**Action** : Remplacer la redirection manuelle dans `index.tsx` par `<Stack.Protected />` d'Expo Router v7.

### 4.3 Audit accessibilite WCAG 2.2 AA

**Action** :
- `accessibilityLabel` sur tous les elements interactifs custom
- Test text scaling a 200%
- Considerer `react-native-ama` pour les checks automatiques
- Tests VoiceOver (iOS) + TalkBack (Android) sur appareils physiques

---

## Principes

- **Un commit par sous-etape logique** (ex: un commit pour React Compiler, un pour forwardRef, etc.)
- **Validation entre chaque etape** : typecheck + lint + tests
- **Zero regression** : si un test casse, on corrige avant de continuer
- **Phases 3-4 documentees ici** pour ne rien perdre, implementees dans des sessions futures
