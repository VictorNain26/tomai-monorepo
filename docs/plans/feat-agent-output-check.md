# Plan — feat/agent-output-check

Lot 2, point 5, première PR (`docs/roadmap.md`) : le contrôle avant l'élève, sur le message du
chat. Décision et sources : `docs/etudes/2026-10-04/refonte-agent.md` (« À chaque tour », 7),
`docs/agent.md` § 5. Chemins relatifs à `apps/server/src/`. La PR suivante du point 5 ajoute la
modération de sortie et porte les contrôles sur les fiches de révision et le titre.

## Tâches

1. **Message entier, contrôlé, puis envoyé** :
   - le texte du modèle n'est plus transmis au fil de l'eau ; les autres morceaux du flux
     (outils, données, étapes) passent tels quels ; le texte retenu est écrit d'un bloc à la fin,
     avant la fin du flux ;
   - le message envoyé est celui qui est persisté ; un message refait ou remplacé ne se rejoue
     plus tel que le modèle l'a produit mais en texte ;
   - un tour coupé contrôle ce qui a été produit avant la coupure.
2. **Contrôles déterministes**, `modules/tutor/output-check.ts` :
   - la réponse de l'exercice et ses formes, comparées à la fiche comme le harnais les cherche
     (`findLeakForm`) ; une forme que l'élève a écrite et que le diagnostic juge juste peut être
     reprise ; une forme présente dans l'énoncé n'est pas une fuite (« 5 » dans « 3x + 5 = 20 ») ;
     fiche sûre seulement ;
   - aucune balise du prompt (`PROMPT_TAG`) ;
   - les égalités écrites recalculées par mathjs (`writtenEqualities`, `isWrong`).
   - `eval/leak.ts`, `eval/typography.ts` et la lecture des égalités de `eval/verifiers.ts`
     passent dans `lib/`, un seul exemplaire pour le harnais et le tuteur.
3. **Sur un échec** : une régénération sous contrainte, sans outils, qui dit ce qui a été
   retenu sans redonner la réponse au rédacteur ; si elle échoue aussi, une réponse de repli
   fixe. L'événement est journalisé et gardé avec le message.
4. **Tests** : chaque contrôle (fuite, forme de l'élève confirmée, forme de l'énoncé, balise,
   égalité fausse), le flux (texte retenu écrit d'un bloc, outils transmis, régénération,
   repli, persistance du texte envoyé).

5. **Ce que la revue a ajouté** :
   - le flux est gardé entier : un texte qui passe part tel qu'il est venu, ses morceaux dans
     leur ordre ;
   - pas de régénération sur un tour coupé, ni après un appel d'outil, dont l'effet reste : la
     réponse de repli directement ; la conversation rejouée garde les appels d'outils, avec le
     texte lu ;
   - si l'élève part avant la fin, la fin du tour attend le tour contrôlé et stocke son texte ;
   - une réponse juste se confirme dans n'importe quelle notation ; « 3 fois 4 » de l'élève
     vaut « 3 × 4 » pour l'exemption des égalités ;
   - la régénération n'est plus invitée à « réécrire » un texte qu'elle ne voit pas.
   - Rejetés : montrer le premier texte à la régénération (ce serait redonner la réponse au
     rédacteur) ; la latence d'un message entier (décision de l'étude, « À chaque tour », 7).

## Hors périmètre

- Modération de sortie, fiches de révision et titre : PR suivante.
- Latence ajoutée et fausses alarmes : relevées au passage de fin (« Mesure » de l'étude).

## Validation

`bun run typecheck`, `bun run lint`, `bunx knip`, `bun run test` ; `bun run test:live` une fois.
