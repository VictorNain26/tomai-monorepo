# Plan — feat/agent-exercise-sheet

Lot 2, point 3, deuxième PR (`docs/roadmap.md`). Décisions et sources :
`docs/etudes/2026-10-04/refonte-agent.md` (« À l'ouverture d'un exercice : la fiche »,
« Préfixe stable », « Programme »). Chemins relatifs à `apps/server/src/`. La PR suivante du
point 3 réduit l'analyse de document à une extraction et y branche les photos : ici, la fiche
ne lit que le texte de l'élève.

## Tâches

1. **Fiche d'exercice**, `modules/tutor/exercise-sheet.service.ts`, produite quand l'analyse du
   tour relève un nouvel exercice :
   - Small 4 en `reasoningEffort: 'high'`, température 0,7 (fiche Hugging Face de Small 4 :
     « 0.7 for `reasoning_effort="high"` »), sans plafond de tokens, bornée par un timeout ;
     sortie structurée stricte. `generateStructured` reçoit l'option `reasoningEffort`.
   - Contenu : énoncé, nature (réponse courte ou production rédigée), réponse attendue et ses
     formes, forme mathjs de l'équation et de la réponse quand il y en a, étapes, erreurs
     fréquentes, règle, faits avec leur nature (réponse du devoir ou fait d'appui), éléments
     attendus d'une production rédigée, notions du programme.
   - Notions : les entrées du référentiel (`referential/`) de la classe et de la matière, et
     celles des classes suivantes, données au modèle avec leurs identifiants ; il rend les
     identifiants travaillés et ceux à ne pas utiliser. Un identifiant inconnu est retiré et
     compté dans les logs. Sans référentiel (matière autre que maths et français, hors
     collège), pas de notions.
   - Trois tirages en parallèle. Une réponse courte se vote : deux tirages concordent si
     mathjs les juge équivalentes, sinon si leurs textes normalisés sont égaux. Sans majorité
     de deux, ou avec un seul tirage réussi, la fiche est marquée incertaine. Une production
     rédigée ne se vote pas. Aucun tirage réussi : pas de fiche, le tour continue, l'échec est
     journalisé.
   - mathjs, `modules/tutor/exercise-math.ts` : deux expressions se comparent par
     `rationalize` de leur différence ; deux équations à une inconnue, de degré 3 au plus, par
     les racines de « gauche − droite » (`rationalize`, puis `polynomialRoot`). La réponse
     retenue est vérifiée contre l'équation de l'énoncé ; un désaccord rend la fiche
     incertaine. Hors de ces cas, pas de vérification, et la fiche le dit.
   - Coût de chaque tirage enregistré dans `cost_tracking` (opération `exercise-sheet`).
2. **Stockage** : table `exercise_sheets` (séance, fiche, incertitude, résultat de la
   vérification mathjs, version du prompt, date) ; migration générée par `db:generate`.
   L'exercice en cours est la dernière fiche de la séance.
3. **Rédacteur** : l'énoncé et les notions de l'exercice en cours, à la suite du prompt
   système (préfixe stable pour le cache), jamais la réponse, les étapes ni les erreurs : le
   contrat du tour (point 4) dira ce que le palier autorise.
   - L'énoncé est une donnée de l'élève : balises retirées, bloc déclaré non fiable dans la
     règle de sécurité ; ses balises rejoignent `PROMPT_TAG_NAMES`.
4. **Tests** :
   - mathjs : expressions et équations équivalentes ou non, cas non couverts ;
   - vote : majorité, désaccord, tirage échoué, production rédigée, vérification contre
     l'équation ;
   - notions : identifiants inconnus retirés, matière sans référentiel ;
   - orchestration : fiche produite sur un nouvel exercice, reprise de la dernière sinon ;
   - prompt : bloc de l'exercice dans le système, sans réponse ;
   - un appel réel vérifie qu'une sortie stricte en raisonnement passe (la doc Mistral ne dit
     rien de cette combinaison, https://docs.mistral.ai/studio/conversations/reasoning).

## Hors périmètre

- Photos et documents : PR suivante.
- Fin d'un exercice, diagnostic, palier, contrat du tour : point 4.
- Quota en tokens de la fiche : point 8.

## Validation

`bun run typecheck`, `bun run lint`, `bunx knip`, `bun run test`, `db:check` ;
`bun run test:live` une fois. Latence et coût d'une fiche relevés sur l'appel réel. Pas de
passage au harnais.
