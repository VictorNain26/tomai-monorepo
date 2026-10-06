---
description: Plans de PR, suivi et configuration des agents — chargé en ouvrant la doc ou la config
paths:
  - "docs/**"
  - "CLAUDE.md"
  - ".claude/**"
---

# Plans, suivi et configuration des agents

## Le plan d'une PR

S'écrit au démarrage de la PR, contre `main` à jour, dans `docs/plans/<branche>.md` (`/`
remplacé par `-`), et se supprime au dernier commit : un plan écrit d'avance dérive à chaque
merge. Si le changement tient en une phrase, pas de plan. Le gabarit, une demi-page au plus :

```
# Plan — <titre>
## Problème            qui est gêné, dans quelle situation, comment on le sait
## Critères d'acceptation   vérifiables, en cases à cocher
## Hors périmètre      ce que la PR ne fait pas
## Vérification de bout en bout   la commande ou le scénario qui prouve que c'est fini
## Décision humaine    validé par Victor, date
```

Avant la première tâche, un pré-vol compare le plan au code et aux types installés ; écarts et
arbitrages se consignent en tête du plan. Le code se désigne par chemin et symbole, jamais par
numéro de ligne.

## Interdits

- Jamais un point reporté dans `docs/suivi.md` sans l'étape ou le lot qui le reprend ; quand le
  plan de celle-ci s'écrit, le point y devient une tâche ou est renvoyé explicitement.
- Jamais un fait recopié : la doc renvoie au code qui le porte (`apps/server/src/config.ts`
  pour l'environnement, par exemple).
- Jamais une règle en prose quand un contrôle automatique peut la tenir.

## La boucle d'apprentissage

Chaque constat de revue corrigé, ou chaque erreur d'agent reprise par Victor, va dans cet ordre
vers : un contrôle automatique (lint, hook, CI) ; sinon un interdit dans CLAUDE.md ou une règle ;
sinon un skill, si c'est une procédure ; sinon rien, si l'erreur ne se répète pas. Une consigne
s'écrit en interdit : seules les interdictions aident un agent, les consignes positives
dégradent ses résultats (Zhang et al., « Guardrails Beat Guidance », arXiv 2604.11088, 2026).

## L'élagage

Chaque mois, et quand un agent ignore une règle écrite : relire CLAUDE.md, `.claude/rules/` et
`.claude/skills/` ligne par ligne, en se demandant si la retirer ferait faire une erreur ;
retirer sinon, ou transformer en contrôle automatique
([best practices](https://code.claude.com/docs/en/best-practices)). Les chemins cités doivent
exister.
