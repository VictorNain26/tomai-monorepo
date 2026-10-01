# Landing Tom

Vitrine marketing et SEO, statique. Next.js + Tailwind + Motion ; versions dans le
`README.md` racine.

**Gelée jusqu'au lot 4** (`docs/superpowers/plans/2026-10-01-roadmap.md`) : seuls des
correctifs d'honnêteté y entrent, c'est-à-dire retirer ou corriger une phrase qui affirme ce
que le produit ne fait pas ou ce qui n'est pas prouvé (`.claude/rules/marketing.md`). Pas
de nouvelle section ni de nouvelle direction visuelle : l'identité est rejetée et se refait
au lot 4, avec le nom du produit.

```bash
pnpm dev          # :3001
pnpm typecheck
pnpm lint         # zéro warning
pnpm build
```

## Contraintes

- **Frontière stricte** : la landing n'appelle **jamais** le serveur, ni Eden Treaty ni
  l'auth. Son seul lien vers le produit sera le bouton « Commencer gratuitement », ajouté au
  lot 4 quand l'app existe. Toute fonctionnalité « produit » appartient au client
  applicatif — c'est ce qui l'empêche de dériver en second produit.
- **Primitives interactives via `@repo/ui`** (bouton, champ, dialog, menu) : c'est
  là que vit leur accessibilité. Sections, annotations et démo sont des composants
  de composition, libres.
- Déploiement Vercel automatique au push. **Jamais `pnpm install --force`** dans
  `vercel.json` : ça masque les conflits de résolution au lieu de les régler.
