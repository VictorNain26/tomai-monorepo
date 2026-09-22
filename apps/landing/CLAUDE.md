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

- **Frontière stricte** : la landing ne consomme **jamais** Eden Treaty ni l'auth.
  Son unique point d'intégration serveur est la Server Action `joinWaitlist` →
  `POST /api/waitlist`. Toute fonctionnalité « produit » qui la tenterait
  appartient au client applicatif — c'est ce qui l'empêche de dériver en second produit.
- **Aucun composant UI custom** : passer par shadcn (`@/components/ui/`).
- **Aucun CSS custom ni style inline** : Tailwind et les tokens `@repo/tokens`.
- Déploiement Vercel automatique au push. **Jamais `pnpm install --force`** dans
  `vercel.json` : ça masque les conflits de résolution au lieu de les régler.
