# Documentation

Chaque document dit ici son statut. Un document sans statut explicite est un piège :
on ne sait pas s'il décrit le dépôt ou une intention.

## Fait autorité

| Document | Ce qu'il décide |
|----------|-----------------|
| [`architecture/system-design.md`](./architecture/system-design.md) | L'architecture telle qu'elle est : conteneurs, contrats, flux. Sa §8 liste les écarts ouverts — le seul endroit où vit ce qui n'est pas encore construit. |
| [`adr/0001-universal-consumer-app.md`](./adr/0001-universal-consumer-app.md) | Une seule app Expo pour parents et élèves, Next.js réservé à la landing et au futur B2B. Décision acceptée ; sa cible web n'est pas activée. |
| [`design/design-system.md`](./design/design-system.md) | Le contrat visuel entre landing (DOM) et mobile (RN). Appliqué à chaque PR d'interface via `.claude/rules/design-system.md`. |

Hors de ce dossier : `README.md` pour la stack et le démarrage, `CLAUDE.md` pour les
instructions aux agents, `apps/*/CLAUDE.md` pour le détail de chaque app.

## Photo datée — utile, non maintenue

| Document | Statut |
|----------|--------|
| [`audits/2026-07-01-curriculum-to-frontend-architecture.md`](./audits/2026-07-01-curriculum-to-frontend-architecture.md) | Audit du 2026-07-01. Les lots 1 à 4 ont été livrés depuis ; les lots 5 à 7 sont repris comme écarts ouverts dans `system-design.md` §8. À lire pour le raisonnement, pas pour l'état. |

## Décidé, jamais exécuté

Ces specs ont été validées en brainstorming puis laissées de côté. Elles restent
là parce que l'intention tient toujours — pas parce que le travail est en cours.

| Spec | Ce qu'elle attend |
|------|-------------------|
| [`superpowers/specs/2026-07-07-charte-graphique-design.md`](./superpowers/specs/2026-07-07-charte-graphique-design.md) | La direction artistique définitive. Le design system actuel est neutre en attendant. |
| [`superpowers/specs/2026-07-08-product-truth-design.md`](./superpowers/specs/2026-07-08-product-truth-design.md) | `docs/product/product-truth.md`, la source de vérité produit. N'existe pas : la vision fonctionnelle vit toujours éclatée entre le code et les audits. |
| [`superpowers/specs/2026-08-23-docs-and-claude-config-design.md`](./superpowers/specs/2026-08-23-docs-and-claude-config-design.md) | Exécutée — c'est le design de cette refonte, gardé comme trace des constats. |

## Supprimé le 2026-08-23

Trois documents portaient « superseded » dans leur propre en-tête. Une doc périmée
qu'on lit induit en erreur plus qu'une doc absente ; l'historique git les garde.

- `audits/2026-06-14-audit-backend-produit.md` — P0 tous livrés (#237, #245, #246).
- `audits/2026-06-14-audit-system-prompt.md` — failles traitées depuis.
- `superpowers/plans/2026-06-30-universal-app-migration.md` — la séquence décrite n'a
  pas été suivie (`apps/web` supprimée avant la parité).
