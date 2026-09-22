# Monorepo Tom

Assistant scolaire socratique pour élèves français, avec supervision parentale.
Stack, structure et démarrage : `README.md` — pas de duplication ici.

**Travaux en cours : `docs/superpowers/suivi.md`** — avancement, bloquants, prochaine
action. Le lire avant de reprendre, le mettre à jour dans la PR qui fait avancer.

## Commandes

```bash
pnpm install                      # Node 22+, pnpm 11+
pnpm dev                          # infra Docker + server:3000 + landing:3001
pnpm dev:mobile                   # Expo (8081), terminal séparé
pnpm dev:down                     # arrêt de l'infra
pnpm typecheck && pnpm lint       # validation, obligatoire avant commit
pnpm test                         # tous les tests du workspace
pnpm doctor                       # diagnostic de la stack
pnpm doctor:e2e                   # diagnostic strict : un SKIP = échec
pnpm seed                         # comptes parent + élève, dev uniquement
```

L'infra Docker vit à la **racine** (`docker-compose.yml`, pas dans `apps/server`).
`pnpm dev` la démarre et attend que postgres soit `healthy` avant de lancer les
apps : si l'infra est incomplète, les apps ne démarrent pas.

## Où travailler

Chaque app porte sa propre doc, chargée à la demande quand tu ouvres un fichier
dedans : `apps/server/CLAUDE.md`, `apps/mobile/CLAUDE.md`, `apps/landing/CLAUDE.md`.

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
  circulaire. `@repo/ui` (DOM) n'entre jamais dans `apps/mobile`.
- **Taille de fichier** — au-delà de ~400 lignes, le fichier fait trop de choses.
- **Test associé** — tout service, helper ou validation modifié a son `*.test.ts`
  couvrant le cas nominal et les cas limites. Pas de test décoratif (mocks massifs,
  assertions triviales).

## Garde-fous déterministes

Ils s'exécutent que Claude le veuille ou non. Chacun a une portée précise, et la
connaître évite de croire couvert ce qui ne l'est pas :

- **`.claude/hooks/block-destructive-db.sh`** (PreToolUse) : refuse la suppression de
  base ou de schéma, et `drizzle-kit push` dès qu'il vise autre chose qu'une base
  locale — config `*prod*`/`*staging*`, `DATABASE_URL` non locale, ou mention de
  prod/staging. Il ne se déclenche que sur une vraie invocation, pas sur une commande
  qui mentionne ces chaînes. C'est un garde-anti-accident : un contournement
  volontaire (chaîne cassée, script intermédiaire) passe, et ce n'est pas son objet.
- **`.claude/hooks/mark-typescript-edit.sh`** + **`require-validation-before-stop.sh`**
  (PostToolUse + Stop) : la session ne peut pas s'arrêter sur du TypeScript **qu'elle a
  elle-même édité** et laissé non commité. Le blocage ne porte que sur ces fichiers-là,
  jamais sur ce que l'arbre contenait déjà. **Portée** : seules les éditions via Edit et
  Write arment le marqueur — du TypeScript écrit par heredoc, `sed` ou un codegen y
  échappe.
- **`permissions.deny`** : lecture des `.env` interdite **à toute profondeur** — un nom
  de fichier nu suit la sémantique gitignore, donc `Read(.env)` couvre aussi
  `apps/server/.env` ([doc](https://code.claude.com/docs/en/permissions)).
  `.env.example` reste volontairement lisible (c'est un gabarit), d'où une
  **énumération de suffixes** plutôt qu'un `.env.*` qui bloquerait aussi les gabarits :
  une règle `deny` n'admet aucune exception. Un suffixe inhabituel qui porterait des
  secrets doit être ajouté à la main. Les porteurs de clés — `*.keystore`, `*.jks`,
  `*.p8`, `*.p12`, `*.pem` — sont bloqués par des règles distinctes.
- **lefthook** : lint + typecheck en pre-commit, tests + build en pre-push.

Ne jamais contourner un hook qui échoue (`--no-verify` est deny-listé) : traiter la cause.

## Review externe

- E2E Maestro en preview Android sur PR via EAS Workflows
  (`apps/mobile/.eas/workflows/preview-android.yml`) — signal, pas gate.
