# `@repo/ui` sur Base UI

Lot 3, point 1, première PR (`docs/etudes/2026-10-06/client-web.md`, « UI ») : shadcn démarre
sur Base UI depuis juillet 2026, et `@repo/ui` n'a que deux primitives Radix à migrer.

## Pré-vol

- `Button` (`@radix-ui/react-slot` pour `asChild`) et `Sheet` (`@radix-ui/react-dialog`).
- Seule la landing, gelée, consomme `@repo/ui` : `asChild` sert trois liens stylés en bouton et le
  déclencheur du menu mobile. Un correctif technique y est permis (`apps/landing/CLAUDE.md`).
- Base UI remplace `asChild` par `render`. Un `Button` rendu en lien prendrait `role="button"`
  (`nativeButton`, `@base-ui/react/internals/types.d.ts`) : un lien prend `buttonVariants`, comme
  le fait shadcn.

## Tâches

1. `Button` sur `@base-ui/react/button`, `buttonVariants` exporté ; `Sheet` sur
   `@base-ui/react/dialog` (`Backdrop`, `Popup`). Classes inchangées, la landing ne change pas
   d'aspect.
2. Landing : les trois liens prennent `buttonVariants`, le menu mobile passe son bouton par
   `render`.
3. Vérifier : typecheck, lint, build et tests Playwright de la landing (menu mobile, 404, liens).
4. `docs/architecture.md` et `docs/suivi.md` à jour.
