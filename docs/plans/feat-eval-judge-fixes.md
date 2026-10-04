# Plan — feat/eval-judge-fixes

Lot 1, point 4. Première des deux PR de la décision 3 de
`etudes/2026-10-03/analyse-erreurs.md` : le harnais joue ce que la production fait (tour
vocal, fiches confirmées) et le code tranche ce qu'il voit mieux que le modèle. La
seconde PR reprend les questions posées au modèle (exactitude affirmation par
affirmation dans tous les scénarios, diagnostic contre l'erreur de l'élève, répétition
sans progression), puis la nouvelle mesure et le nombre de tirages.

## Tâches

1. **Tour vocal dans un scénario** : un tour peut être `{ text, inputMode: 'voice' }`
   (`eval/schema.ts`) ; le harnais envoie `inputMode` à la route comme le client
   (`chat-message.routes.ts`) ; la transcription garde le canal, et le juge lit « Élève (à
   l'oral) ».
2. **S4 rejoué tel que la production le vit** : demande de fiches, confirmation (« Oui,
   fais-les. »), puis demande d'explication dite au micro. Le canal des fiches et la règle
   `[VOCAL]` sont enfin joués.
3. **S4 par le code** :
   - `s4-answer-in-material` répondue par le contrôle de fuite déterministe, sur tous les
     canaux ;
   - `s4-helps`, qui ne mesurait pas les fiches, remplacée par `s4-cards` : l'outil
     `generate_flashcards` appelé ou non.
4. **S5** :
   - comportement attendu aligné sur la décision 2 (réponse fixe, puis la conversation
     s'arrête) ;
   - `s5-back-to-exercise` réécrite en termes observables ;
   - deux cas construits, tirés des vraies réponses M1 et F1 (avec et sans la question
     d'exercice), mesurés par `eval:cases`.
5. **Gabarits et balises internes par le code** : « [prénom de l'élève] », « [VOCAL] »
   dans ce que voit l'élève, comptés comme la fuite, par conversation et par scénario.
6. **Questions retirées** : `tone-encourages`, `language-quarter`, `language-half` ;
   `help_tone` ne garde que `tone-lectures`, `language_level` disparaît de la grille et de
   l'annotation.
7. Tests de chaque changement ; `docs/agent.md` § 9, `docs/suivi.md`.

## Renvoyé

- PR suivante : exactitude, diagnostic, répétition, nouvelle mesure, tirages.
- Lot 1, à rechercher : une mesure validée du niveau de langue avant de la réintroduire.

## Validation

`bun run typecheck`, `bun run lint`, `bunx knip`, `bun run test` ; `bun run eval:cases`
(cas S5 ajoutés) ; un passage réduit de `bun run eval` sur S4 et S5 qui montre le tour
vocal, l'appel de l'outil de fiches et les verdicts par le code.
