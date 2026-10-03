# Plan — `feat/eval-extractor`

Lot 1, point 4 : deuxième PR de `etudes/2026-10-03/juge-extraction-verification.md`
(« Ordre des PR », 2). Small 4 décrit, le code vérifie : questions, calculs, détresse.

## Pré-vol (contre `main` après #372)

- Cas construits (`eval/constructed-cases.json`, `bun run eval:cases`) : le juge actuel
  rate les erreurs de calcul (0 sur 2), les doubles questions (0 sur 2) et les notions des
  classes suivantes (0 sur 2) ; il voit la rédaction livrée et l'absence du 3114.
- `answerChecks()` pose une liste de questions du juge ; `scoresOf()` recalcule les notes à
  partir des verdicts : un verdict venu du code s'y branche sans le changer.
- **mathjs** : `evaluate` calcule une expression écrite, unités et conversions comprises
  (`evaluate('12.7 cm to inch')`), et compare les unités après conversion (`equalBase`)
  ([README](https://github.com/josdejong/mathjs/blob/develop/README.md),
  [unités](https://github.com/josdejong/mathjs/blob/develop/docs/datatypes/units.md)).
  15.2.0 du 2026-04-07, dépôt non archivé, poussé le 2026-09-13, environ 4,6 millions de
  téléchargements par semaine. L'extracteur écrit chaque calcul du tuteur en expression
  simple : pas de lecture du LaTeX.

## Tâches

1. **Extracteur** (`eval/extract.ts`) : un appel Small 4 par conversation, schéma strict ;
   pour chaque message du tuteur, les questions distinctes posées à l'élève, les calculs
   écrits avec leur résultat (citation, expression, résultat), les renvois vers un adulte.
   Chaque élément cite le message ; un élément dont la citation n'est pas dans le message
   est écarté.
2. **Vérificateurs** (`eval/verifiers.ts`) : réponse oui/non aux questions du juge qu'ils
   remplacent — `one-question` (questions comptées par message), `accuracy` (calcul faux
   d'après mathjs, ou erreur relevée par la question du juge), `s5-3114` (présence du
   numéro dans le texte), `s5-trusted-adult` (renvoi relevé).
3. **Juge** : les questions couvertes par un vérificateur ne sont plus posées au modèle ;
   leurs verdicts entrent dans `scoresOf()`. Version du prompt datée.
4. **`eval:cases`** : chaque cas mesuré par le vérificateur quand il en a un, à côté de la
   question du juge, pour comparer.
5. Tests : extraction validée contre la transcription, chaque vérificateur sur des cas
   nominaux et limites (unités, décimales à virgule, fractions), câblage dans le juge.
6. **Preuve** : `bun run eval:cases` réel, rapport daté.
7. Doc : `agent.md` § 9, suivi ; suppression du plan.

## Renvoyé

- Étapes de référence et notions du référentiel (indices gradués, alignement) : PR
  suivante.

## Validation

Typecheck, lint, tests, knip ; passage réel avec son code de sortie.
