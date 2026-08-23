# Monorepo Tom

Assistant scolaire socratique pour élèves français, avec supervision parentale.
Stack, structure et démarrage : `README.md` — pas de duplication ici.

## Commandes

```bash
pnpm install                      # Node 22+, pnpm 11+
pnpm dev                          # infra Docker + server:3000 + landing:3001
pnpm dev:mobile                   # Expo (8081), terminal séparé
pnpm dev:down                     # arrêt de l'infra
pnpm typecheck && pnpm lint       # validation, obligatoire avant commit
pnpm test                         # server (Bun) + mobile (Jest)
pnpm doctor                       # diagnostic de la stack
pnpm doctor:e2e                   # diagnostic strict : un SKIP ou un degraded = échec
pnpm seed                         # comptes parent + élève, dev uniquement
```

L'infra Docker vit à la **racine** (`docker-compose.yml`, pas dans `apps/server`).
`pnpm dev` la démarre et attend que postgres et qdrant soient `healthy` avant de
lancer les apps : si l'infra est incomplète, les apps ne démarrent pas.

## Où travailler

Chaque app porte sa propre doc, chargée à la demande quand tu ouvres un fichier
dedans : `apps/server/CLAUDE.md`, `apps/mobile/CLAUDE.md`, `apps/landing/CLAUDE.md`,
`apps/curriculum/CLAUDE.md`, `apps/ai-service/README.md`.

Les conventions transverses vivent dans `.claude/rules/` et se chargent seules —
ne pas les importer. `database-migrations.md` et `design-system.md` sont scopées par
chemin : elles n'arrivent en contexte que sur les fichiers concernés.

## Git

- **`main`** est la seule branche permanente. Jamais de push direct : branche courte → PR.
- **Merge commit uniquement**, jamais de squash.
- Stager les fichiers explicitement, jamais `git add .`.

## Revue avant merge

`/code-review` (natif) couvre correction et qualité. S'y ajoutent quatre exigences
propres au monorepo, à vérifier explicitement :

- **Contrat Eden** — une modification dans `packages/api/` doit rester rétrocompatible
  pour les clients ; les types viennent du serveur, jamais redéfinis côté client.
- **Frontières workspace** — imports via les packages `@repo/*`, aucune dépendance
  circulaire. `@repo/ui` (DOM) n'entre jamais dans `apps/mobile` (ADR 0001).
- **Taille de fichier** — au-delà de ~400 lignes, le fichier fait trop de choses.
- **Test associé** — tout service, helper ou validation modifié a son `*.test.ts`
  couvrant le cas nominal et les cas limites. Pas de test décoratif (mocks massifs,
  assertions triviales).

## Garde-fous déterministes

Ils s'exécutent que Claude le veuille ou non :

- **`.claude/hooks/block-destructive-db.sh`** (PreToolUse) : refuse `DROP DATABASE`
  et `db:push` visant prod/staging.
- **`.claude/hooks/mark-typescript-edit.sh`** + **`require-validation-before-stop.sh`**
  (PostToolUse + Stop) : si la session a édité du TypeScript et le laisse non commité,
  elle ne peut pas s'arrêter. Le marqueur est consommé, donc le blocage joue une fois.
- **`permissions.deny`** : lecture des `.env` interdite (les `.env.example` restent
  lisibles, ce sont des gabarits).
- **lefthook** : lint + typecheck en pre-commit, tests + build en pre-push.

Ne jamais contourner un hook qui échoue (`--no-verify` est deny-listé) : traiter la cause.

## Review externe

- PR vers `main` : CodeRabbit Free, automatique (`.coderabbit.yaml`).
- E2E Maestro en preview Android sur PR via EAS Workflows
  (`apps/mobile/.eas/workflows/preview-android.yml`) — signal, pas gate.
