---
description: Plans de PR et suivi — chargé en ouvrant un plan, une spec ou le suivi
paths:
  - "docs/**"
---

# Plans et agents — conventions

- Un plan de PR s'écrit, ou se réécrit, au démarrage de la PR, contre `main` à jour, dans
  `docs/plans/<branche>.md` (`/` de la branche remplacé par `-`). Il vit le temps de la
  PR : son dernier commit le supprime, ce qui reste à faire passe dans `docs/suivi.md`, et
  la PR comme `git log` gardent l'historique. `docs/roadmap.md` ne porte que l'objectif
  des lots, l'ordre des PR et les contraintes globales. Raison : les plans du lot 0,
  écrits d'avance, ont dérivé à chaque PR mergée (10 écarts sur E1, deux tâches E2
  cassées).
- Désigner le code par chemin et symbole, jamais par numéro de ligne. Le code complet ne
  s'écrit que pour les fichiers et tests nouveaux ; la modification d'un fichier existant
  se décrit par comportement attendu, interface et test.
- Avant la première tâche, un pré-vol compare le plan au code et aux `.d.ts` installés ;
  écarts et arbitrages sont consignés en tête du plan.
- Un point reporté dans `docs/suivi.md` nomme une PR ou un lot existant. Quand
  le plan de cette PR s'écrit, le point y devient une tâche ou est explicitement renvoyé.
- Un fait vit à un seul endroit : la doc renvoie au code (`apps/server/src/config/env.ts`
  pour les variables, la route `/health` pour ses statuts) au lieu de le recopier.
