# Plan — `feat/eval-judge-agreement`

Lot 1, point 4 de `roadmap.md`, seconde PR : relecture humaine d'un échantillon et accord
juge-humain mesuré, critère par critère. Seuil de l'étude : α de Krippendorff d'au moins
0,800 pour conclure (`etudes/2026-10-02/alignement.md`, « Hors ligne : le harnais »).

## Pré-vol (contre `main` après #366)

- **Files d'annotation** : `langfuse.api.annotationQueues.createQueue({ name,
  description, scoreConfigIds })` et `createQueueItem(queueId, { objectId, objectType })`,
  un appel par item (`@langfuse/core` 5.11.1, `.d.ts` installé ;
  [doc](https://langfuse.com/docs/evaluation/evaluation-methods/annotation-queues)).
  Offre Hobby : **une seule file**, deux utilisateurs, 30 jours d'accès aux données,
  30 requêtes par minute ([tarifs](https://langfuse.com/pricing)).
- **Configs de score** : `langfuse.api.scoreConfigs.create({ name, dataType, categories,
  description })`, nom de 35 caractères au plus ; une note posée dans la file porte
  `source: "ANNOTATION"` et `queueId`.
- **Lecture** : `langfuse.api.scoresV3.getManyV3({ traceId: "a,b", source: "ANNOTATION",
  fields, limit, cursor })` ; la v2 disparaît le 2026-11-16.
- **Aveugle** : en mode file, l'interface masque l'onglet des scores, mais les scores du
  juge restent visibles par la vue détaillée et les badges de l'arbre (source de Langfuse,
  commit f75c661). Seule garantie : aucune note du juge n'existe pendant l'annotation.
  D'où l'ordre : passage sans juge, annotation, puis jugement des transcriptions
  sauvegardées.
- **α de Krippendorff** : aucune bibliothèque npm ne passe les critères de maintenance
  (`krippendorff` 0.1.0, sans activité depuis 2024-03 ; `@silupanda/label-score`, sans
  adoption). Implémentation locale courte, nominale et ordinale, vérifiée une fois contre
  `krippendorff` 0.8.2 de PyPI ([dépôt](https://github.com/pln-fing-udelar/fast-krippendorff),
  commit du 2026-08-02) ; ses valeurs deviennent les attendus du test.
- **Ce que lit l'annotateur** : la sortie de la trace est la transcription renvoyée par la
  tâche ; l'entrée est l'item. Le contexte (énoncé, réponse attendue, programme,
  comportement attendu, critères à noter) n'y est pas aujourd'hui.

## Tâches

1. **Échantillon** : `src/eval/agreement-sample.json`, 38 conversations stratifiées — S1,
   S2 et S3 sur 8 exercices chacun (les quatre classes, maths et une autre matière, les
   quatre productions rédigées en S2), S4, S5 et S6 en entier. `bun run eval --sample
   <fichier>` joue exactement ces paires.
2. **Contexte lisible** : `judge.ts` exporte le briefing (contexte sans la transcription)
   que `contextMessages` réutilise ; il entre dans l'entrée de l'item Langfuse, avec la
   liste des critères à noter.
3. **traceId** de chaque conversation écrit dans `eval-results/`.
4. **`bun run eval:annotate <résultats>`** : crée ou retrouve les configs de score (une
   par critère, catégorielles, descriptions tirées des ancres de `judge.ts`, source
   unique) et la file `tom-judge-agreement`, puis y ajoute les traces du passage, au
   rythme permis.
5. **`bun run eval:agreement <résultats>`** : juge les transcriptions sauvegardées, lit
   les notes humaines, calcule par critère l'accord brut, l'α (ordinal pour 0-1-2 et les
   trois crans, nominal pour le binaire) et son intervalle par bootstrap sur les
   conversations ; écrit le rapport et les désaccords.
6. Tests : α contre les valeurs de PyPI (dont cas limites : accord parfait, une seule
   valeur), bootstrap borné, appariement des notes, échantillon valide contre le jeu,
   option `--sample`.
7. **Preuve** : passage réel de l'échantillon sans juge, file remplie et vérifiée dans
   Langfuse ; Victor annote (estimation : environ 250 notes, 2 à 3 heures, en plusieurs
   fois) ; rapport d'accord commité.
8. Doc : `agent.md` § 9, suivi ; suppression du plan.

## Renvoyé

- **Recalibration du prompt** si un critère reste sous 0,800 : PR suivante, validée sur un
  nouvel échantillon, pour ne pas ajuster le juge sur les notes qui le mesurent.
- Re-notation des concurrents et baseline : point 5.

## Validation

Typecheck, lint, tests, knip ; passage réel de l'échantillon et file vérifiée dans
Langfuse, avec leurs codes de sortie.
