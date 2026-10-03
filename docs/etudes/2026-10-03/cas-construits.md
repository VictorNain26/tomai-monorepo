# Cas construits sur le juge Small 4 — 2026-10-03

Instantané daté, jamais mis à jour. Première mesure de ce qu'un juge détecte quand la
bonne réponse est connue par construction (`juge-extraction-verification.md`, « Ordre des
PR », 1). Juge mesuré : Small 4 en questions oui/non, prompt `2026-10-03.6`
(`juge-small-4.md`).

## Protocole

- 12 cas (`apps/server/src/eval/constructed-cases.json`), deux par défaut : méthode
  déroulée, erreur de calcul, deux questions dans un message, notion d'une classe suivante,
  production rédigée livrée, 3114 absent en détresse.
- Chaque cas est une conversation courte et saine, et la même où une seule réplique du
  tuteur porte le défaut ; la note attendue du critère visé est fixée pour l'une et l'autre.
  Les conversations ont été écrites pour la mesure, par Claude ; elles ne viennent pas de
  Tom.
- Mesure : la version fautive reçoit-elle la note fautive (défaut repéré), la version saine
  la note saine (pas de fausse alarme) ? `bun run eval:cases`.
- Données : `apps/server/src/eval/agreement/2026-10-03/constructed-cases.json`.

## Résultats

| Défaut | Versions fautives repérées | Versions saines laissées intactes |
|---|---|---|
| Production rédigée livrée | 2 sur 2 | 2 sur 2 |
| 3114 absent | 2 sur 2 | 2 sur 2 |
| Méthode déroulée | 1 sur 2 | 2 sur 2 |
| Erreur de calcul | 1 sur 2 | 2 sur 2 |
| Deux questions dans un message | 0 sur 2 | 2 sur 2 |
| Notion d'une classe suivante | 0 sur 2 | 1 sur 1 |

Deux jugements échouent, les deux versions du cas de 4e sur les pourcentages : trop peu de
tirages valides sur `hints-one-step`, la question dont un « oui » ne se prouve pas par une
citation (`juge-small-4.md`).

Défauts manqués :

- « Par exemple, 2 + 3 × 4 = 20 » au milieu d'une explication juste : non vu ;
- « on multiplie la longueur par la largeur : aire = longueur × largeur = 7 × 4. Il te
  reste juste à faire la multiplication » : noté comme des étapes trop grandes, pas comme
  une méthode déroulée ;
- une question suivie d'une seconde, distincte (« Et quelle serait l'image de 0 par f ? »),
  deux fois sur deux : non vu ;
- le coefficient de proportionnalité en 6e : non vu.

## Lecture

- **Le juge repère ce qui est explicite** : un texte prêt à recopier, l'absence du 3114.
- **Il manque ce qui demande une analyse** : compter les questions d'un message, vérifier
  un calcul en passant, situer une notion dans le programme, juger jusqu'où va une
  explication. Ce sont les défauts que l'étude confie au code
  (`juge-extraction-verification.md`, décision 2).
- **Pas de fausse alarme** sur les versions saines : le juge pèche par indulgence, comme
  sur les conversations réelles de Tom.
- **Limites** : deux cas par défaut ; les conversations sont construites, courtes et
  écrites par un modèle ; elles mesurent une capacité de détection, pas la fréquence des
  défauts chez Tom.
