# Landing Tom

Vitrine marketing et SEO, statique. Next.js + Tailwind + Framer Motion ; versions
dans le `README.md` racine.

```bash
pnpm dev          # :3001
pnpm typecheck
pnpm lint         # zéro warning
pnpm build
```

## Contraintes

- **Frontière stricte** : la landing n'appelle **jamais** le serveur, ni Eden Treaty ni
  l'auth. Son seul lien vers le produit sera le bouton « Commencer gratuitement », ajouté à
  l'ouverture de l'app (lot 3). Toute fonctionnalité « produit » appartient au client
  applicatif — c'est ce qui l'empêche de dériver en second produit.
- **Primitives interactives via `@repo/ui`** (bouton, champ, dialog, menu) : c'est
  là que vit leur accessibilité. Sections, annotations et démo sont des composants
  de composition, libres.
- Déploiement Vercel automatique au push. **Jamais `pnpm install --force`** dans
  `vercel.json` : ça masque les conflits de résolution au lieu de les régler.
