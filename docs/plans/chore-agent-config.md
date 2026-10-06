# Plan — la configuration des agents, sur les pratiques publiées

Branche `chore/agent-config`, en cascade sur `refactor/server-foundation` (#420), dont elle
modifie les règles.

## Problème

La configuration des agents (CLAUDE.md, `.claude/rules/`) mêle interdits, consignes positives et
descriptions de l'existant. Or seules les interdictions aident un agent, et les consignes
positives dégradent ses résultats (Zhang et al., « Guardrails Beat Guidance », arXiv 2604.11088,
2026) ; la doc de Claude Code demande un fichier court dont chaque ligne évite une erreur, et
des hooks pour ce qui doit arriver sans exception (code.claude.com/docs/en/best-practices).

## Critères d'acceptation

- [ ] La taille de fichier et l'interdiction de `mock.module` sont des règles de lint qui
      échouent, vérifiées par un fichier sonde ; plus en prose.
- [ ] CLAUDE.md et chaque règle ne portent que des commandes, des interdits, des pièges
      vérifiés et des renvois ; ce que le code ou une autre doc dit déjà en est retiré.
- [ ] La règle des plans porte le gabarit d'intention, la boucle « constat de revue → contrôle,
      interdit, skill ou rien », le cadrage du relecteur et l'élagage mensuel.
- [ ] Les défauts marketing qui ne valent qu'au lot 4 passent dans un skill, chargé à la demande.

## Hors périmètre

AGENTS.md (un seul agent, Claude Code), CODEOWNERS (un seul relecteur), Spec Kit, linters de
configuration (jeunes, à tester d'abord).

## Vérification de bout en bout

`bun run lint` vert ; les deux fichiers sonde font échouer le lint ; relecture de chaque ligne
retirée contre la question « la retirer ferait-elle faire une erreur ? ».

## Décision humaine

Validé par Victor le 2026-10-06 (« go »).
