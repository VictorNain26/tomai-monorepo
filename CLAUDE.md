# Monorepo Tom

Tuteur IA des devoirs pour collégiens, avec un résumé pour le parent.

## Carte

- Pour qui, promesse, périmètre : `docs/vision.md`, qui prime sur tout ; on n'affirme que ce
  qu'on peut prouver.
- **Travaux en cours : `docs/suivi.md`**, à lire avant de reprendre et à mettre à jour dans la PR
  qui fait avancer. Ordre des lots : `docs/roadmap.md`. Refonte en cours :
  `docs/etudes/2026-10-06/refonte-architecture.md`.
- Stack, structure, démarrage : `README.md`. Règles d'une partie du code :
  `.claude/rules/<sujet>.md`, chargées sur ses chemins.

Lors d'une compaction, préserver : PR en cours, branche, plan en cours, dernière tâche
terminée, décisions ouvertes.

## Commandes

Avant un commit : `bun run typecheck && bun run lint`, et `bun run test` quand du code testé
change (Postgres de `docker compose` requis). Formatage : `bun run format`.

## Interdits

- La landing n'appelle jamais le serveur, ni l'auth : `apps/web` est le seul client produit.
- Rien n'entre dans la landing en ligne avant le lot 4, sauf un correctif d'honnêteté ou
  technique (`.claude/rules/landing.md`).
- Jamais de push sur `main` : une branche courte, puis une PR, mergée en merge commit (le
  squash est désactivé).
- Jamais deux versions d'une même chose, ni un fichier sans usage : ce qu'une PR remplace, elle
  le supprime.
- Jamais un type du serveur réécrit côté client : il vient du client typé de `hono/client`.
- Jamais de test décoratif : pas de `mock.module` (refusé au lint), pas d'assertion triviale ;
  un service, un helper ou une validation modifié a son test, cas nominal et cas limites.

## Revue avant merge

`/code-review` relit la branche dans un contexte neuf. Ne retenir que ce qui touche la
correction ou les exigences du plan : un relecteur trouve presque toujours quelque chose, et
tout suivre mène à la sur-ingénierie (code.claude.com/docs/en/best-practices, « Add an
adversarial review step »). Un constat retenu se corrige avant le merge, puis suit la boucle de
`.claude/rules/plans-and-agents.md`.

## Garde-fous déterministes

- `.claude/settings.json` : `permissions.ask` sur `db:push`, `drizzle-kit push`, `dropdb`,
  `DROP DATABASE` ou `SCHEMA` et `docker compose down -v` ; `permissions.deny` sur `.env`,
  `.env.*` (sauf `.env.example`) et les porteurs de clés. La règle porte sur le texte de la
  commande : une autre forme d'appel y échappe ([doc](https://code.claude.com/docs/en/permissions)).
- lefthook : format, lint et typecheck avant un commit ; tests et build avant un push.
- CI (`.github/workflows/ci.yml`) : vérifications, tests, build, e2e, migrations, image, sécurité,
  réunis par `ci-ok`, le seul check à exiger.
