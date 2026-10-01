# Monorepo Tom

Tuteur IA des devoirs pour collégiens, avec un résumé pour le parent. Pour qui, promesse
et périmètre : `docs/vision.md`, qui prime sur tout
autre document ; règle qui gouverne le reste : on n'affirme que ce qu'on peut prouver.
Stack, structure et démarrage : `README.md` — pas de duplication ici.

**Travaux en cours : `docs/suivi.md`** — avancement, bloquants, prochaine
action. Le lire avant de reprendre, le mettre à jour dans la PR qui fait avancer.

Lors d'une compaction, préserver : PR en cours, branche, plan en cours, dernière tâche
terminée, décisions ouvertes.

## Commandes

```bash
pnpm install                      # Node 24+, pnpm 12+
pnpm dev                          # infra Docker + server:3000 + landing:3001
pnpm dev:down                     # arrêt de l'infra
pnpm typecheck && pnpm lint       # obligatoire avant tout commit
pnpm test                         # tests serveur, aussi obligatoires si le serveur change
pnpm test:scripts                 # tests de scripts/
pnpm run doctor                   # diagnostic de la stack
pnpm doctor:e2e                   # diagnostic strict : un SKIP = échec
pnpm seed                         # comptes parent + élève, dev uniquement
```

L'infra Docker vit à la **racine** (`docker-compose.yml`, pas dans `apps/server`).
`pnpm dev` la démarre et attend que postgres soit `healthy` avant de lancer les
apps : si l'infra est incomplète, les apps ne démarrent pas.

## Git

- **`main`** est la seule branche permanente. Jamais de push direct : branche courte → PR.
- **Merge commit uniquement** : le squash est désactivé sur le dépôt GitHub.

## Revue avant merge

`/code-review` (natif) couvre correction et qualité. S'y ajoutent quatre exigences
propres au monorepo, à vérifier explicitement :

- **Contrat Eden** — une modification dans `packages/api/` doit rester rétrocompatible
  pour les clients ; les types viennent du serveur, jamais redéfinis côté client.
- **Frontières workspace** — imports via les packages `@repo/*`, aucune dépendance
  circulaire.
- **Taille de fichier** — au-delà de ~400 lignes, le fichier fait trop de choses.
- **Test associé** — tout service, helper ou validation modifié a son `*.test.ts`
  couvrant le cas nominal et les cas limites. Pas de test décoratif (mocks massifs,
  assertions triviales).

## Garde-fous déterministes

Ils s'appliquent que Claude le veuille ou non. Chacun a une portée précise, et la
connaître évite de croire couvert ce qui ne l'est pas :

- **`permissions.ask`** (`.claude/settings.json`) : `db:push`, `drizzle-kit push`,
  `dropdb`, un `DROP DATABASE`/`DROP SCHEMA` et `docker compose down -v` demandent
  confirmation, y compris en mode auto. La règle porte sur le texte de la commande :
  une autre forme d'appel (chemin absolu, `sh -c`) y échappe
  ([doc](https://code.claude.com/docs/en/permissions)).
- **`permissions.deny`** : `.env` et `.env.*` illisibles à toute profondeur, sauf le
  gabarit `.env.example`, rouvert par la négation `Read(!.env.example)`. Les porteurs de
  clés — `*.keystore`, `*.jks`, `*.p8`, `*.p12`, `*.pem` — sont bloqués par des règles
  distinctes.
- **lefthook** : lint + typecheck en pre-commit, tests + build en pre-push.
