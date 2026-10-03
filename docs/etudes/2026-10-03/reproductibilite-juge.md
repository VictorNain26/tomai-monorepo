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
  (`bun run eval:agreement src/eval/agreement/2026-10-03/results.json --labels
  src/eval/agreement/2026-10-03/labels.claude.json --passes 3`). Les trois passages sont
  les trois codeurs de l'α de Krippendorff.
- Deux conversations échouent au premier passage, comme à la mesure précédente
  (citations introuvables) ; la mesure porte sur 36.
- Données : `apps/server/src/eval/agreement/2026-10-03/results.stability.json`.

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
  les sept critères d'aide, 4 notes sur 189 (27 conversations × 7) changent. L'effet de
  la graine n'est pas isolé, faute de passages sans graine dans les mêmes conditions ;
  elle reste, sans coût.
- **Le juge est reproductible** : α d'au moins 0,842 sur chaque critère mesurable, 1,000
  sur la moitié. Un changement isolé suffit à faire bouger l'accord avec l'annotation
  d'environ 0,03 : `help_graded_hints` y donne 0,779 au premier passage de cette mesure,
  après 0,796 et 0,840. Un critère proche du seuil ne se juge que sur plusieurs passages.
- **Le faible accord avec l'annotation n'est donc pas du bruit** : sur `oneQuestion`,
  `diagnosis`, `accuracy`, `level`, le juge diverge de l'annotation de façon stable. C'est
  l'objet de la recalibration (`accord-juge.md`, « Suite »).
