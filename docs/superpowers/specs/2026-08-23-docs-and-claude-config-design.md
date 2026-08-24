# Refonte doc + configuration Claude Code — design

Date : 2026-08-23. Statut : validé en brainstorming avec Victor, exécuté dans la foulée.

## Objectif

La documentation racine et `.claude/` affirment des choses que le dépôt contredit.
Cette refonte les remet en accord avec `main`, et remplace la configuration Claude Code
par une version conforme à la documentation officielle.

**Périmètre exclu** : `apps/**` et `packages/**` — aucune modification, y compris les
`apps/*/CLAUDE.md` et `apps/*/README.md` (~750 lignes), à la demande de Victor.

## Constats (vérifiés sur `main`, pas de mémoire)

### Documentation

| Affirmation | Réalité |
|---|---|
| `CLAUDE.md` : « `cd apps/server && docker compose up -d` » | `docker-compose.yml` est à la racine ; `apps/server/docker-compose.yml` n'existe pas |
| `README.md` : stack « Gladia (STT) » | `apps/server/src/config/env.ts` ne déclare que `MISTRAL_STT_MODEL` ; zéro occurrence de Gladia |
| `README.md` : « Qdrant Cloud — source unique de vérité, aucune ingestion locale » | `docker-compose.yml` déclare un service `qdrant` **sans `profiles:`** (donc démarré par défaut) et `scripts/dev.mjs:20` l'attend `healthy` |
| `README.md` : « sans ces vars, l'app tourne en `degraded` » | `health.routes.ts:166` répond `not_configured` sans dégrader le statut global |
| `README.md` : « Source de vérité : les `CLAUDE.md` de chaque app » | `docs/architecture/system-design.md:3` se déclare « doc de référence vivant » — deux sources concurrentes |
| `system-design.md` | décrit `apps/app`, renommage jamais effectué ; marqueurs `🔄 Lot 5/6/7` d'une roadmap close |
| 2 audits + 1 plan | portent « STATUT : superseded » dans leur propre en-tête |

### Configuration Claude Code

Vérifiée contre [hooks](https://code.claude.com/docs/en/hooks),
[settings-reference](https://code.claude.com/docs/en/settings-reference),
[memory](https://code.claude.com/docs/en/memory).

| Problème | Détail |
|---|---|
| Stop hook piégeux | `exit 2` dès qu'un `.ts` non commité existe, **même pré-existant et non touché par la session** : une question sans édition devient impossible à terminer |
| PreToolUse fragile | parse stdin avec `grep -o '"command":"[^"]*"'` : casse sur tout `"` échappé et prend le premier `"command":` du payload. La doc impose `jq` |
| `deny` redondant | les 8 règles `.env` du projet sont un sous-ensemble strict de `~/.claude/settings.json`, et ratent `packages/*/.env` |
| `deny` trop large | `Read(./apps/server/.env.*)` bloque `.env.example`, un gabarit fait pour être lu (constaté en session) |
| Référence morte | `ai-workflow.md` route vers un agent `architecture-reviewer` absent de `.claude/agents/` **et** de `~/.claude/agents/` |
| Règle non scopée | `design-system.md` n'a pas de `paths:` → chargée à chaque session, y compris en travail backend |
| `/review` redondant | duplique `/code-review` natif (multi-agent, passe de vérification, `ReportFindings`) en moins capable |

## Décisions

1. **Un fait, un seul endroit.** La stack n'est tabulée que dans `README.md`. `CLAUDE.md`
   ne porte que des instructions d'agent ; `system-design.md` que des flux et contrats.
2. **La doc décrit `main` tel qu'il est.** Le prévu vit dans une section datée, jamais
   dans le corps.
3. **`system-design.md` : truth pass ciblé, pas réécriture à blanc.** Le document est sain ;
   le réécrire perdrait de l'exactitude. On corrige le cadrage (« cible » → « réel + écarts »),
   les noms (`apps/app` → `apps/mobile`), la contradiction Qdrant et les liens morts.
4. **Suppression des documents auto-déclarés superseded.** Git garde l'historique ; une doc
   périmée qu'on lit induit en erreur.
5. **Les garde-fous restent déterministes, mais cessent d'être des pièges.** Le Stop hook ne
   se déclenche que si *la session* a édité du TypeScript, et bloque une seule fois.
6. **Ne pas réinventer la roue.** `/review` disparaît au profit de `/code-review` natif ;
   ses seuls checks spécifiques au monorepo migrent en règle projet.

## Cible

```
README.md                    réécrit — porte d'entrée humaine, seule table de stack
CLAUDE.md                    réécrit — instructions agent, < 100 lignes
docs/
├── README.md                nouveau — index : ce qui fait autorité, ce qui est en attente
├── adr/0001-…               intact (une décision ne se réécrit pas)
├── architecture/system-design.md   truth pass
├── audits/2026-07-01-…      conservé (feuille de route encore citée)
├── design/design-system.md  renvois morts corrigés
└── superpowers/specs/       2 specs 2026-07 validées non exécutées + celle-ci
.claude/
├── settings.json            deny purgés, hooks externalisés
├── hooks/*.sh               nouveaux — parsing jq, sortie JSON conforme
├── rules/                   design-system scopé, ai-workflow dédoublonné
└── agents/, skills/verify/  inchangés
```

Supprimés : `docs/audits/2026-06-14-audit-backend-produit.md`,
`docs/audits/2026-06-14-audit-system-prompt.md`,
`docs/superpowers/plans/2026-06-30-universal-app-migration.md`,
`.claude/commands/review.md`.

## Critères de succès

- Zéro affirmation dans la doc racine qui contredise le dépôt — chaque commande et chaque
  chemin cité vérifié par exécution ou lecture du fichier.
- Aucun renvoi mort entre documents, ni vers un agent ou un fichier inexistant.
- Les hooks passent un test d'exécution réel (payload JSON en entrée, code de sortie lu),
  pas seulement une relecture.
- `pnpm typecheck && pnpm lint` verts (aucun code touché, mais le dépôt doit rester sain).
