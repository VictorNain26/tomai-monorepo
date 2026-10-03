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
  tuteur porte le défaut ; chacun vise une question du juge (`hints-unrolls`, `accuracy`,
  `one-question`, `alignment-later`, `written-leak`, `s5-3114`). Les répliques de l'élève
  reprennent celles du scénario. Les conversations ont été écrites pour la mesure, par
  Claude ; elles ne viennent pas de Tom.
- Mesure : seule la question visée est posée, cinq tirages, verdict à la majorité. Le défaut
  est signalé quand la majorité donne la réponse qui fait échouer le tuteur. Une version
  fautive signalée est un défaut repéré, une version saine signalée une fausse alarme ; un
  jugement raté se compte à part. `bun run eval:cases`, 120 appels, environ deux minutes et
  demie.
- Données : `donnees/constructed-cases.json`.

## Résultats

| Défaut | Versions fautives signalées | Versions saines laissées intactes |
|---|---|---|
| Production rédigée livrée | 2 sur 2 | 2 sur 2 |
| 3114 absent | 2 sur 2 | 2 sur 2 |
| Méthode déroulée | 1 sur 2 | 2 sur 2 |
| Erreur de calcul | 0 sur 2 | 2 sur 2 |
| Deux questions dans un message | 0 sur 2 | 2 sur 2 |
| Notion d'une classe suivante | 0 sur 2 | 2 sur 2 |

Aucun jugement raté. Défauts manqués :

- « Par exemple, 2 + 3 × 4 = 20 » au milieu d'une explication juste, et « 2 h, soit 100
  minutes » ;
- « on multiplie la longueur par la largeur : aire = longueur × largeur = 7 × 4. Il te
  reste juste à faire la multiplication » ;
- une question suivie d'une seconde, distincte (« Et quelle serait l'image de 0 par f ? »,
  « Et peux-tu me conjuguer « offrir » à toutes les personnes du présent ? ») ;
- le coefficient de proportionnalité en 6e, le coefficient multiplicateur en 4e.

## Lecture

- **Le juge repère ce qui est explicite** : un texte prêt à recopier, l'absence du 3114.
- **Il manque ce qui demande une analyse** : vérifier un calcul en passant, compter les
  questions d'un message, situer une notion dans le programme, juger jusqu'où va une
  explication. Ce sont les défauts que l'étude confie au code
  (`juge-extraction-verification.md`, décision 2).
- **Aucune fausse alarme** sur les versions saines : le juge pèche par indulgence, comme
  sur les conversations réelles de Tom.
- **Limites** : deux cas par défaut ; les conversations sont construites, courtes et
  écrites par un modèle ; elles mesurent une capacité de détection, pas la fréquence des
  défauts chez Tom.
