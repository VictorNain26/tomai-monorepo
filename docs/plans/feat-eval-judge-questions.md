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

## État au 2026-10-04 (reprise)

- Fait et commité : tâches 1 à 4.
  - L'exactitude se vérifie phrase par phrase (`eval/claims.ts`) plutôt que sur des
    affirmations extraites : l'extracteur séparait une règle de son exception.
  - La répétition est formulée sur deux messages (« Deux messages du tuteur posent-ils la
    même question… »).
  - `docs/agent.md` § 9 est à jour.
- Cas construits (`bun run eval:cases`, 2026-10-04T11h00) :
  - question répétée 2 sur 2, sans fausse alarme ;
  - règle fausse 1 sur 2 : l'anglais (« on ajoute un -s, have compris ») est jugé vrai
    par Small 4, sans source pour une vérification de grammaire par le code ;
  - diagnostic absent 2 sur 2, mais une fausse alarme sur la version saine de 5-M1, quelle
    que soit la formulation testée (trois essayées).
- En cours : tâche 5, le rejugement des 38 conversations, lancé depuis `apps/server` avec
  `bun run eval:agreement ../../docs/etudes/2026-10-03/donnees/results.json --labels ../../docs/etudes/2026-10-04/donnees/labels.claude-exactitude.json`.
  - Le résultat arrive dans `apps/server/eval-results/results.agreement-<date>.json`. S'il
    manque, relancer cette commande.
  - Le fichier de notes porte la lecture ouverte sur l'exactitude : 0 pour #18, 23, 28, 30,
    32, et 1 ailleurs.
- Reste à faire :
  - analyser ce rejugement : accord sur l'exactitude, verdicts de `diagnosis-uses` et de
    `hints-repeats` contre les catégories de `donnees/lecture-ouverte.json`, unanimité,
    coût ;
  - relancer `bun run eval:cases` et copier sa sortie avec le rejugement dans
    `docs/etudes/2026-10-04/donnees/` ;
  - écrire l'étude `docs/etudes/2026-10-04/questions-juge.md` et mettre à jour
    `docs/suivi.md` ;
  - pousser, ouvrir la PR, `/code-review`, corriger, CI verte, merger (Victor a dit de ne
    plus demander jusqu'à la fin).
