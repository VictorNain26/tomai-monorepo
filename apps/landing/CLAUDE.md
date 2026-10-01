# Landing Tom

Vitrine marketing et SEO, statique. Next.js + Tailwind + Motion ; versions dans le
`README.md` racine.

**Gelée jusqu'au lot 4** (`docs/roadmap.md`) : seuls des
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

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
