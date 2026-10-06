# Monorepo Tom

Tuteur IA des devoirs pour collégiens, avec un résumé pour le parent. Pour qui, promesse
et périmètre : `docs/vision.md`, qui prime sur tout autre document ; règle qui gouverne le
reste : on n'affirme que ce qu'on peut prouver. Stack, structure, commandes et
démarrage : `README.md`. Ce fichier ne porte que les règles de travail des agents ; ce qui ne vaut
que pour une partie du code vit dans `.claude/rules/<sujet>.md`, chargé sur ses chemins.

**Travaux en cours : `docs/suivi.md`** — avancement, bloquants, prochaine action. Le lire
avant de reprendre, le mettre à jour dans la PR qui fait avancer.

Lors d'une compaction, préserver : PR en cours, branche, plan en cours, dernière tâche
terminée, décisions ouvertes.

Avant un commit : `bun run typecheck && bun run lint`, et `bun run test` quand du code testé
change. Prettier formate le code (`bun run format`) ; le pre-commit et la CI le vérifient.

## Frontière des apps

`apps/web` est le seul client produit : toute fonctionnalité produit lui appartient. La
landing n'appelle **jamais** le serveur, ni par `@repo/api` ni par l'auth ; son seul lien
vers le produit sera le bouton « Commencer gratuitement », au lot 4. C'est ce qui l'empêche
de dériver en second produit.

La landing en ligne est **gelée jusqu'au lot 4** : seuls des correctifs d'honnêteté ou techniques
y entrent (`.claude/rules/landing.md`).

## Git

- `main` est la seule branche permanente ; jamais de push direct, une branche courte puis une PR.
- **Merge commit uniquement** : le squash est désactivé sur le dépôt GitHub.

## Revue avant merge

`/code-review` (natif) couvre correction et qualité. S'y ajoutent quatre exigences
propres au monorepo, à vérifier explicitement :

- **Contrat client** — les types du client viennent du serveur (client typé de `hono/client`),
  jamais redéfinis côté client.
- **Frontières** — entre workspaces, imports via les packages déclarés, aucune dépendance
  circulaire ; dans le serveur, les règles de `eslint-plugin-boundaries`.
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
- **lefthook** : lint, format (Prettier) + typecheck en pre-commit, tests + build en pre-push.
