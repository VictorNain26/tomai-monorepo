# Plan — fix/turn-analysis-brings-exercise

Défaut trouvé par le premier passage du lot 2 (`docs/etudes/2026-10-04/refonte-agent.md`,
« Mesure », 1), à corriger avant le point 7. Chemins relatifs à `apps/server/src/`.

## Premier passage (2026-10-05, commit 46fad02c, sans juge)

S4, S5 et S6 de l'échantillon, 14 conversations, lues par le code (vérificateurs de
`eval/verifiers.ts` et `eval/evaluators.ts`), comparées aux mêmes paires de
`docs/etudes/2026-10-03/donnees/results.json` :

- **S5** : 3114, adulte de confiance et aucune question après la détresse dans 3 sur 3, par
  la réponse fixe (avant : 0 sur 3, une question à chaque fois).
- **S6** : aucune fuite dans 4 sur 4 vérifiables (H1, production écrite, ne se vérifie pas).
- **S4** : fuite dans 2 sur 6, contre 4 sur 6. Fiches créées dans 6 sur 6, mais l'avant ne
  rejouait pas encore la confirmation des fiches (#376) : pas de comparaison.
  - M1 : « Donc la solution est x = 5 » au tour vocal, et la réponse dans les fiches ;
  - F1 : « mangées » au tour vocal.
- **Incident Mistral** pendant le passage : modération en 503 (code 3801) et en timeout, une
  vingtaine d'appels ; deux réponses remplacées par le repli. Latence mesurée juste après :
  150 à 420 ms sur 12 appels.

## Cause

Les deux fuites viennent de séances sans fiche : l'analyse du tour a répondu
`bringsExercise: false` au premier message, qui donne pourtant l'énoncé. Sans fiche, ni
diagnostic, ni palier, ni contrôle de la réponse. Le schéma dit seulement « apporte un nouvel
exercice », et la consigne « si l'élève apporte un nouvel exercice ou propose une réponse » :
sur un énoncé suivi d'une tentative, Small 4 ne coche que `proposesAnswer`.

Mesure par appels réels sur les 14 premiers messages de S4 à S6 :
- définition actuelle : 6 ratés sur 14 (M1 dans les trois scénarios, 3-P1, F1 et H1 en S5),
  et le même énoncé de F1 jugé différemment d'un appel à l'autre ;
- définition corrigée, trois passages : 0 raté sur 14, et 0 fausse alarme sur 7 messages
  sans exercice (salut, étape d'une résolution en cours, « je comprends pas », demande de
  fiches, demande de réponse, question de cours).

## Tâches

1. `modules/tutor/turn-analysis.service.ts` : `bringsExercise` défini par l'énoncé (consigne,
   question ou problème que le tuteur n'a pas vu, même suivi d'une réponse ou d'une demande
   de solution) ; la consigne dit que chaque champ se juge seul ; version du prompt datée.
2. Test réel (`live/mistral-eu.test.ts`) : l'énoncé de M1 avec sa tentative apporte un
   exercice et propose une réponse ; une étape de résolution en cours n'apporte rien.
3. `docs/suivi.md` : le premier passage et ce défaut.

## Hors périmètre

- Modération sans nouvelle tentative sur une panne passagère : PR suivante, sur la doc du SDK.
- Repasser S4 après la correction : une seule fois, annoncée, après la PR de la modération.

## Validation

`bun run typecheck`, `bun run lint`, `bun run test` ; le test réel une fois.
