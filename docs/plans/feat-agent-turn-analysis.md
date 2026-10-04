# Plan — feat/agent-turn-analysis

Lot 2, point 3, première PR (`docs/roadmap.md`). Décisions et sources :
`docs/etudes/2026-10-04/refonte-agent.md` (« À chaque tour », 2 ; « Outils »). Chemins relatifs à
`apps/server/src/`. Les PR suivantes du point 3 : la fiche d'exercice, puis l'analyse de document
réduite à une extraction.

## Tâches

1. **Analyse du tour**, en sortie structurée stricte : Small 4, sans raisonnement,
   température 0. Elle remplace le classifieur d'intention (`intent-classifier.service.ts`).
   Elle lit le message de l'élève et le dernier message de Tom, délimités comme données, et
   rend :
   - la matière ;
   - le nouvel exercice, recopié, quand le message en apporte un ;
   - la proposition de l'élève (réponse ou étape), recopiée ;
   - s'il demande la solution, une explication, des fiches, ou s'il accepte celles que Tom
     propose.
2. **Ce qui en dépend** :
   - les consignes de tour : solution demandée, proposition à vérifier ;
   - le routage du raisonnement : une proposition raisonne toujours ;
   - la matière détectée.
   - L'analyse est gardée avec le message, à la place de l'intention.
3. **Fiches de révision confirmées par le code** : `toolApproval` de `streamText`
   (`ToolApprovalConfiguration`, `ai` 7.0.107).
   - `'approved'` quand l'analyse relève une demande ou un accord de l'élève, `'denied'`
     sinon : le modèle reçoit le refus et propose les fiches.
   - La description de l'outil ne porte plus la règle.
4. **Tests** :
   - analyse : schéma, prompt, échec ;
   - consignes et routage ;
   - approbation des fiches ;
   - un appel réel vérifie que le mode strict accepte le schéma de l'analyse.

## Validation

`bun run typecheck`, `bun run lint`, `bunx knip`, `bun run test` ; `bun run test:live` une
fois. Pas de passage au harnais.
