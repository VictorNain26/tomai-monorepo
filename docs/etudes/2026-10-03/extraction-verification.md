# Extraction et vérification sur les cas construits — 2026-10-03

Instantané daté, jamais mis à jour. Mesure de la deuxième PR de
`juge-extraction-verification.md` (« Ordre des PR », 2) : Small 4 décrit, le code vérifie
les questions posées, les calculs et la détresse. Juge `2026-10-03.7`.

## Ce qui a été construit

- **Extracteur** (`apps/server/src/eval/extract.ts`) : Small 4 relève, pour chaque message
  du tuteur, les questions posées à l'élève, les calculs écrits et les renvois vers un
  adulte, chacun cité mot pour mot ; trois tirages fusionnés. Un élément dont la citation
  n'est pas dans le message du tuteur est écarté.
- **Le résultat d'un calcul vient du texte, pas du modèle.** À la première mesure,
  l'extracteur corrigeait le tuteur : pour « 2 h, soit 100 minutes », il relevait
  « 120 minute ». C'est le biais que la refonte combat, au cœur même de la description. Le
  code lit donc le dernier nombre de la citation, et écarte un calcul dont l'expression n'a
  pas ses nombres dans la citation (l'extracteur avait aussi inventé un calcul à partir de la
  réponse de l'élève citée par le tuteur).
- **Égalités écrites, sans le modèle** (`apps/server/src/eval/verifiers.ts`) : une égalité
  numérique en clair (« 2 + 3 × 4 = 20 ») se trouve dans le texte et se recalcule ; une
  équation avec inconnue, une formule en lettres ou le calcul de l'élève montré par le tuteur
  sont laissés de côté.
- **Vérificateurs** : mathjs 15.2.0 recalcule chaque calcul, unités et conversions
  comprises, à la précision du résultat écrit ; les questions se comptent par message (plus
  d'un message sur quatre avec deux questions ou plus) ; le 3114 se cherche dans le texte ;
  le renvoi vers un adulte vient de l'extraction. Ces verdicts remplacent les questions du
  juge `one-question`, `s5-3114` et `s5-trusted-adult` ; un calcul faux s'ajoute à
  l'exactitude.

## Résultats

Trois passages de `bun run eval:cases` (données :
`apps/server/src/eval/agreement/2026-10-03/extraction/run-1.json` à `run-3.json`), versions
fautives signalées sur l'ensemble des passages :

| Défaut | Question posée au modèle | Même question, par le code |
|---|---|---|
| Erreur de calcul | 0 sur 6 | 5 sur 6 |
| Deux questions dans un message | 0 sur 6 | 6 sur 6 |
| 3114 absent | 6 sur 6 | 6 sur 6 |

Aucune fausse alarme sur les 18 versions saines jugées par le code. Le seul défaut manqué
est la conversion « 2 h, soit 100 minutes », écrite en mots : seul l'extracteur peut la
relever, et il la relève deux fois sur trois.

## Lecture

- **Le code repère ce que le modèle ne voyait pas** sur son propre modèle, sans fausse
  alarme sur ces cas.
- **Ce qui est déterministe est stable** (égalités écrites, questions comptées, 3114) ;
  ce qui passe par l'extracteur dépend de son rappel, mesuré ici sur un seul cas.
- **Limites** : deux cas par défaut, écrits par un modèle ; aucune mesure encore sur les
  conversations réelles de Tom, où le repérage des égalités et le comptage des questions
  peuvent produire des fausses alarmes que ces cas n'exercent pas.

## Suite

Étapes de référence et notions du référentiel, pour les indices gradués et l'alignement ;
puis mesure sur l'échantillon de conversations réelles et sa part annotée par un humain.
