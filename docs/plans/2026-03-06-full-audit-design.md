# Full Codebase Audit & Modernization — Design Doc

**Date:** 2026-03-06
**Scope:** Mobile + Server + Packages
**Branch:** staging (direct push, app not in prod)

## Context

Audit complet de la codebase TomAI pour aligner sur les bonnes pratiques 2026.
Le stack est deja moderne (Expo 55, RN 0.83, React 19.2, TS 5.9.3, TanStack Query v5, Elysia 1.4, Tailwind v4). Les axes d'amelioration sont principalement structurels et de qualite.

## Execution Order

### Phase 1 — Migrations de dependances

1. **Drizzle ORM v1** (0.45.1 -> v1)
   - Extraire relations de schema.ts vers relations.ts
   - Modifier connection.ts : `{ schema }` -> `{ relations }`
   - Migrer 11 relational queries (findFirst) dans pronote-auth.service.ts et cognitive-profile.service.ts
   - Mettre a jour drizzle-kit

2. **NativeWind v5 stable** (preview.2 -> stable)
   - Mettre a jour nativewind + react-native-css
   - Verifier configs (deja v5-ready)

3. **React Native Reusables CLI**
   - Regenerer composants UI via `npx @react-native-reusables/cli`
   - Comparer avec les composants existants, garder les customisations

4. **Eden Treaty migration**
   - Supprimer apiClient singleton deprecated
   - Migrer tous les usages vers getTreaty()

### Phase 2 — Refactoring server

5. **Decouper schema.ts** (1410 lignes -> modules par domaine)
   - auth.schema.ts, learning.schema.ts, pronote.schema.ts, billing.schema.ts, files.schema.ts
   - Re-exporter depuis schema/index.ts

6. **Nettoyer le code server**
   - Verifier conformite 400 lignes max
   - Supprimer code mort

### Phase 3 — Refactoring mobile

7. **Supprimer styles.ts** (255 lignes de couleurs hardcodees)
   - Migrer vers tokens CSS/NativeWind
   - Mettre a jour useIconColors.ts

8. **Decouper les fichiers trop longs**
   - useChat.ts (267l) -> sous-hooks
   - ChatMessage.tsx (272l) -> sous-composants
   - auth.ts (306l) -> modules

9. **Supprimer code mort mobile**
   - Confirmer suppression src/services/audio/, src/services/pronote/

### Phase 4 — Tests & qualite

10. **Standardiser patterns de test**
11. **Couvrir services critiques non testes**
12. **Tests de validation migration Drizzle v1**

### Phase 5 — Securite & features

13. **Better Auth Passkeys** (auth biometrique)
14. **Audit securite** (rate limiting, encryption)

## Decisions

- Travail direct sur staging, pas de branches isolees
- Merge commit vers main (jamais squash)
- Chaque phase = 1 ou plusieurs commits atomiques
- Typecheck + lint + tests obligatoires avant chaque commit
