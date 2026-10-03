# Accord du juge — 2026-10-03

Première mesure de l'accord du juge daté (`apps/server/src/eval/judge.ts`, modèle
`mistral-medium-2604`, prompt `2026-10-03.4`) avec une annotation indépendante.
Instantané daté, jamais mis à jour.

**Ce n'est pas un accord juge-humain.** À la demande de Victor, l'annotation a été faite
par Claude (Opus 5.5), pas par une personne. La mesure dit où deux modèles divergent ; elle
ne dit pas lequel a raison, et deux modèles peuvent partager un biais. Une relecture
humaine d'un sous-échantillon reste due avant de publier une mesure du juge (`suivi.md`).

## Protocole

- **Échantillon** : 38 conversations fixes (`apps/server/src/eval/agreement-sample.json`) —
  S1, S2 et S3 sur 8 exercices chacun, des quatre classes et de plusieurs matières, S4, S5
  et S6 en entier ; une conversation par paire. Jouées le 2026-10-03 contre Tom
  (`mistral-small-2603`), sans juge, une à la fois.
- **Aveugle** : l'annotateur a lu un dossier construit à partir du passage (briefing et
  transcription, ceux que lit le juge, avec la grille et ses ancres), sans aucune note du
  juge, qui n'avait pas encore tourné. Chaque note porte la citation exacte qui la fonde
  (250 notes, toutes retrouvées dans leur transcription).
- **Juge** : lancé ensuite sur les mêmes transcriptions sauvegardées. 2 jugements sur 38
  échouent au contrôle des citations, même après une relance : le juge corrige une coquille
  de Tom (« toimême ») et paraphrase une phrase du tuteur. Ces deux conversations sont
  exclues ; la mesure porte sur 36.
- **Mesure** : accord brut et α de Krippendorff par critère, ordinal pour les échelles à
  trois crans, nominal pour le binaire, intervalle à 95 % par bootstrap sur les
  conversations (2 000 tirages). Seuil de l'étude : α ≥ 0,800
  (`etudes/2026-10-02/alignement.md`).
- **Fichiers** : `apps/server/src/eval/agreement/2026-10-03/` — passage (`results.json`),
  notes de l'annotateur (`labels.claude.json`), verdicts du juge et mesure
  (`results.agreement.json`). Rejouer : `bun run eval:agreement
  src/eval/agreement/2026-10-03/results.json --labels
  src/eval/agreement/2026-10-03/labels.claude.json` : le juge est rappelé et la mesure
  s'écrit dans `apps/server/eval-results/`, sans toucher à ces fichiers.

## Résultats

| Critère | Conversations | Accord brut | α | Intervalle à 95 % | ≥ 0,800 |
|---|---|---|---|---|---|
| help_diagnosis | 27 | 0,556 | 0,207 | −0,194 à 0,577 | non |
| help_one_question | 27 | 0,370 | −0,300 | −0,619 à 0,034 | non |
| help_graded_hints | 27 | 0,852 | 0,840 | 0,590 à 0,988 | oui |
| help_accuracy | 27 | 0,778 | −0,104 | −0,205 à −0,019 | non |
| help_level | 27 | 0,815 | 0,195 | −0,152 à 0,654 | non |
| help_tone | 27 | 0,926 | −0,019 | −0,082 à 0,000 | non |
| language_level | 27 | 0,852 | −0,060 | −0,152 à 0,000 | non |
| alignment_in_class | 16 | 1,000 | non défini | — | non |
| alignment_later_used | 16 | 1,000 | non défini | — | non |
| leak (rédaction) | 5 | 1,000 | non défini | — | non |
| safety, S4 | 6 | 1,000 | 1,000 | 1,000 à 1,000 | oui |
| safety, S5 | 3 | 0,667 | 0,000 | −0,667 à 0,000 | non |

## Lecture

- **Un seul critère d'aide atteint le seuil, et pas de façon robuste.**
  `help_graded_hints` donne α = 0,840, mais un passage précédent du même juge sur les
  mêmes transcriptions (prompt `2026-10-03.3`, qui ne diffère que par le message de
  relance d'une citation) donnait 0,796 : le juge ne rend pas les mêmes notes d'un passage
  à l'autre, même à température 0, et l'intervalle va de 0,590 à 0,988. `safety` en S4
  atteint le seuil sur six conversations seulement. Aucune conclusion n'est tirée de ces
  deux critères avant une mesure répétée.
- **Bruit du juge** : la reproductibilité du juge (mêmes transcriptions, plusieurs
  passages) n'est pas encore mesurée ; elle borne l'accord qu'il peut atteindre.
- **Désaccords orientés, pas du bruit** :
  - `help_one_question` : le juge met 0 là où l'annotateur met 1 dans 17 cas sur 27. Ses
    citations montrent qu'il compte deux questions là où le tuteur double la sienne d'une
    reformulation (« Comment as-tu trouvé ce résultat […] ? Peux-tu m'expliquer ta
    démarche ? ») ou d'un choix entre parenthèses, alors que l'ancre les compte pour une.
  - `help_diagnosis` : le juge est plus indulgent, 2 là où l'annotateur met 0 ou 1 dans
    10 cas ; ses citations sont des questions de cours (« As-tu repéré le verbe dans cette
    phrase ? »), qu'il prend pour une recherche de ce que l'élève sait ou de ce qui le
    bloque.
  - `help_accuracy`, `help_level`, `help_tone`, `language_level` : le juge met 0 dans
    quelques conversations que l'annotateur juge correctes (2 à 5 par critère) ; en
    exactitude, l'inverse arrive aussi deux fois.
- **Critères sans variation** : alignement, fuite rédigée, ton et niveau de langue ont
  presque toujours la même note des deux côtés. Un accord brut élevé n'y prouve rien : α
  n'est pas défini, ou proche de 0 quand une seule conversation diffère. L'échantillon
  tiré du comportement réel de Tom ne contient pas assez de contre-exemples pour mesurer
  ces critères.
- **Ancre défectueuse** : avec quatre messages, `language_level` ne peut pas valoir
  `partly` (un message difficile donne `adapted`, deux donnent `not`), relevé par
  l'annotateur.
- **Hors grille**, relevés par l'annotateur : en S6 sur P1, Tom affirme « Je n'ai pas lu de
  note dans ton message », ce qui est faux ; en S5 sur F1, il énonce une règle d'accord
  fausse.

## Suite

Recalibration du juge, PR suivante : reproductibilité du juge mesurée d'abord (plusieurs
passages sur les mêmes transcriptions) ; ancres de `oneQuestion` et `diagnosis` réécrites,
celle de `language_level` réparée ; cas construits pour les critères sans variation
(alignement hors programme, rédaction livrée, ton sermonneur) ; validation sur un nouvel
échantillon, pour ne pas ajuster le juge sur les notes qui le mesurent.
