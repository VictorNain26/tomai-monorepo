# Reproductibilité du juge — 2026-10-03

Le juge note-t-il pareil deux fois la même conversation ? Mesure préalable à toute
recalibration : la première mesure d'accord (`accord-juge.md`) avait donné 0,796 puis
0,840 sur `help_graded_hints`, sur les mêmes transcriptions. Instantané daté, jamais mis
à jour.

## Protocole

- Juge `mistral-medium-2604`, prompt `2026-10-03.4`, température 0, graine fixe
  (`random_seed` 20261003). Selon la documentation de Mistral, une graine donne des
  résultats déterministes ([doc](https://docs.mistral.ai/api/endpoint/chat)).
- Les 38 transcriptions de l'échantillon du 2026-10-03, jugées trois fois chacune
  (`bun run eval:agreement ../../docs/etudes/2026-10-03/donnees/results.json --labels
  ../../docs/etudes/2026-10-03/donnees/labels.claude.json --passes 3`). Les trois passages sont
  les trois codeurs de l'α de Krippendorff.
- Deux conversations échouent au premier passage, comme à la mesure précédente
  (citations introuvables) ; la mesure porte sur 36.
- Données : `donnees/results.stability.json`.

## Résultats

| Critère | Conversations | Accord brut (3 passages identiques) | α | Intervalle à 95 % |
|---|---|---|---|---|
| help_diagnosis | 27 | 0,926 | 0,842 | 0,453 à 1,000 |
| help_one_question | 27 | 1,000 | 1,000 | 1,000 à 1,000 |
| help_graded_hints | 27 | 0,963 | 0,993 | 0,962 à 1,000 |
| help_accuracy | 27 | 1,000 | 1,000 | 1,000 à 1,000 |
| help_level | 27 | 1,000 | 1,000 | 1,000 à 1,000 |
| help_tone | 27 | 0,963 | 0,863 | 0,481 à 1,000 |
| language_level | 27 | 1,000 | 1,000 | 1,000 à 1,000 |
| alignment_in_class | 16 | 1,000 | non défini | — |
| alignment_later_used | 16 | 1,000 | non défini | — |
| leak (rédaction) | 5 | 1,000 | non défini | — |
| safety, S4 | 6 | 1,000 | 1,000 | 1,000 à 1,000 |
| safety, S5 | 3 | 1,000 | non défini | — |

Quatre conversations changent de note d'un passage à l'autre : `help_tone` en S2 sur H1
(0, 0, 1), `help_graded_hints` en S3 sur 3-F1 (1, 0, 0), `help_diagnosis` en S6 sur M3
(2, 2, 0) et sur F1 (2, 2, 1).

## Lecture

- **La graine ne rend pas le juge déterministe**, contrairement à la documentation : sur
  les sept critères d'aide, 4 notes sur 189 (27 conversations × 7) changent. La cause
  n'est pas isolée : faute de passages sans graine dans les mêmes conditions, l'effet de
  la graine reste inconnu, et l'état du cache de prompt n'est pas contrôlé (le premier
  passage d'une conversation part d'un cache froid, les suivants d'un cache chaud ; trois
  des quatre changements touchent le deuxième ou le troisième passage).
- **Reproductibilité établie sur cinq critères seulement** : `oneQuestion`, `accuracy`,
  `level` et `languageLevel` (α = 1,000, intervalle réduit à 1,000) et `gradedHints`
  (0,993, borne basse 0,962). Sur `diagnosis` (0,842) et `tone` (0,863), l'estimation
  passe le seuil mais l'intervalle descend à 0,453 et 0,481 : 27 conversations ne
  suffisent pas à conclure. Les critères sans variation n'ont pas d'α.
- **Désaccords stables là où le juge est reproductible** : sur `oneQuestion`, `accuracy`
  et `level`, le juge rend la même note à chaque passage et diverge de l'annotation ; ce
  désaccord n'est pas du bruit. Sur `diagnosis`, la mesure ne permet pas de le dire.
- **Accord avec l'annotation selon les passages** : `help_graded_hints` donne 0,779 au
  premier passage de cette mesure, avec graine, après 0,796 et 0,840 sans graine. Les
  réglages diffèrent : ces écarts ne mesurent pas le bruit du juge, ils montrent qu'un
  critère proche du seuil ne se juge pas sur un seul passage.
- **Limite du calcul** : cette mesure a été faite avant une correction du script ; une
  conversation dont un passage échouait sortait de la mesure entière. Les deux
  conversations concernées échouaient au premier passage et sont absentes des deux
  tableaux. Le script les garde désormais, sur les passages réussis.
