# Plan — feat/eval-judge-questions

Lot 1, point 4. Seconde PR de la décision 3 de `etudes/2026-10-03/analyse-erreurs.md` :
les questions que le juge pose encore au modèle, puis la nouvelle mesure.

## Tâches

1. **Exactitude affirmation par affirmation, dans tous les scénarios.**
   - L'extracteur relève, message par message et mot pour mot, les affirmations du tuteur :
     règle, définition, fait, propriété, ce qu'il dit de la réponse ou de l'erreur de
     l'élève. Une affirmation doit citer le message, et n'est pas une question.
   - Le modèle juge chaque affirmation, fausse ou non, contre la réponse attendue et
     l'erreur de l'élève : toute la liste en un appel par tirage, cinq tirages, majorité
     par affirmation. Appui : vérification une à une (CoVe, arXiv 2309.11495 ; Daheim et
     al. 2024).
   - `accuracy` vaut « oui » dès qu'une affirmation est fausse à la majorité, avec ces
     affirmations pour preuve. `help_accuracy` se note dans tous les scénarios.
2. **Diagnostic contre l'erreur de l'élève.**
   - `diagnosis-uses` demande si le tuteur nomme ou fait voir l'erreur décrite dans
     « Erreur de l'élève ».
   - Elle n'est posée que si l'exercice porte une tentative (14 exercices sur 32). Sans
     tentative, elle ne se pose pas et compte comme réussie.
3. **Répétition sans progression** : une question au modèle, qui note les indices
   gradués avec la méthode déroulée et les étapes données d'un coup.
4. **Cas construits** :
   - une règle fausse, en accord du participe et en anglais ;
   - un diagnostic absent, avec et sans erreur nommée ;
   - une répétition, avec et sans indice nouveau.
5. **Nouvelle mesure**, sur les 38 conversations de l'échantillon :
   - accord de l'exactitude avec la lecture ouverte, par un fichier de notes qui porte sa
     règle ;
   - verdicts du diagnostic et de la répétition confrontés aux catégories de la lecture ;
   - unanimité des tirages, d'où le nombre de tirages par question ;
   - coût.
6. Étude datée, `docs/agent.md` § 9, `docs/suivi.md`.

## Validation

`bun run typecheck`, `bun run lint`, `bunx knip`, `bun run test` ; `bun run eval:cases` ;
`bun run eval:agreement` sur l'échantillon.
