# Plan — feat/agent-diagnosis-contract

Lot 2, point 4 (`docs/roadmap.md`) : diagnostic contre la fiche, palier décidé par le code,
contrat du tour. Décisions et sources : `docs/etudes/2026-10-04/refonte-agent.md` (« À chaque
tour », 3 à 5), `docs/agent.md` § 4. Chemins relatifs à `apps/server/src/`.

## Tâches

1. **Diagnostic**, `modules/tutor/exercise-diagnosis.service.ts`, quand l'élève propose une
   réponse ou une étape et que l'exercice en cours a une fiche sûre :
   - Small 4 sans raisonnement, température 0, sortie stricte ; il reçoit la fiche (énoncé,
     réponse, étapes, erreurs fréquentes, règle, éléments attendus), le dernier message du
     tuteur et celui de l'élève, délimités comme données ;
   - il rend : juste (réponse finale), étape juste (exercice pas fini), fausse ou indécidable ;
     la première étape fausse ; le type d'erreur selon les catégories de Bridge (« Guess »,
     « Misinterpret », « Careless », « Right-idea », « Imprecise », « Not-sure », « N/A »,
     https://arxiv.org/html/2310.10648) ; la proposition en forme mathjs ;
   - mathjs tranche là où il sait : une équation de l'élève doit garder les racines de celle
     de l'énoncé (juste une fois résolue, étape juste avant, fausse sinon) ; une valeur égale
     à la réponse est la réponse ; une valeur différente peut être un résultat intermédiaire
     juste, mathjs ne fait que réfuter un « juste » du modèle ; une expression égale à la
     réponse peut être l'énoncé recopié, le modèle en juge ;
   - fiche incertaine : pas de diagnostic, « le diagnostic ne tranche pas » ; un échec de
     l'appel vaut indécidable, journalisé.
   - Une erreur n'est pas cherchée derrière une réponse juste.
2. **Palier**, `modules/tutor/hint-ladder.ts`, décidé par le code et gardé par exercice
   (colonnes `hint_level` et `hints` de `exercise_sheets`, migration) :
   - relance, indice conceptuel, indice ciblé, étape intermédiaire, exemple analogue résolu ;
   - il monte d'un cran à chaque proposition jugée fausse, jamais sur un message sans
     tentative ; il redescend d'un cran sur une étape juste ;
   - une réponse finale juste termine l'exercice (colonne `solved_at`) : le tour la confirme,
     les suivants n'ont plus de contrat jusqu'au prochain exercice ;
   - fiche incertaine : il ne dépasse pas l'indice conceptuel, une tentative le fait monter
     jusque-là ;
   - les messages du tuteur sur l'exercice sont gardés (les quatre derniers, coupés) : le
     contrat les liste pour qu'il ne se répète pas.
3. **Contrat du tour**, entre balises `<contrat>`, dans le message du tour à la place de la
   consigne de tour quand l'exercice en cours a une fiche :
   - le palier autorisé, le diagnostic, les indices déjà donnés, la conduite face à une
     demande de solution ;
   - ce que le palier autorise de la fiche, jamais la réponse, ses formes, les faits qui la
     donnent ni les éléments attendus : la règle et les faits d'appui à partir de l'indice
     conceptuel, la première étape fausse à l'indice ciblé, une étape de la fiche à l'étape
     intermédiaire, jamais la dernière ;
   - le prompt système dit que le contrat fait foi et décrit les paliers ; `contrat` rejoint
     `PROMPT_TAG_NAMES` ; sans fiche, la consigne de tour actuelle reste.
4. **Rédaction sans raisonnement sous contrat** : l'exactitude passe par la fiche et le
   diagnostic ; sans fiche, le routage actuel reste.
5. Le diagnostic et le palier sont gardés avec le message, pour la mesure.
6. **Tests** : diagnostic (prompt, mathjs qui tranche, fiche incertaine, échec), palier
   (montée, descente, plafond, message sans tentative), contrat (ce qu'il montre par palier,
   jamais la réponse), orchestration, indices gardés ; un appel réel vérifie le schéma du
   diagnostic.

7. **Ce que la revue a ajouté** :
   - ce que le tour change sur l'exercice (palier, étapes justes, fin ou réouverture, message
     du tuteur) s'écrit en une seule requête atomique une fois le tour vu, jamais pour un tour
     coupé ; deux tours simultanés comptent tous les deux ;
   - l'étape intermédiaire montrée suit les étapes justes de l'élève, pas les messages du
     tuteur ;
   - un exercice résolu garde son énoncé devant le tuteur, sans contrat ; une nouvelle
     tentative le rouvre ; une partie juste d'un exercice à plusieurs questions est une étape
     juste ;
   - tous les champs de la fiche sont débarrassés des balises dans le prompt du diagnostic ;
   - les messages gardés sont coupés sur un point de code.
   - Rejeté : raisonner sous contrat quand le diagnostic ne tranche pas. La rédaction se fait
     sans raisonnement (étude, « À chaque tour », 6) ; une proposition non jugée reçoit
     « demande-lui comment il a trouvé ».

## Hors périmètre

- Contrôle avant l'élève : point 5.
- Fin d'un exercice quand l'élève change de sujet sans le résoudre ni en apporter un nouveau :
  l'exercice reste celui en cours, le contrat aussi.

## Validation

`bun run typecheck`, `bun run lint`, `bunx knip`, `bun run test`, `db:check` ;
`bun run test:live` une fois. Pas de passage au harnais (« Mesure » de l'étude : passage de fin).
