# Plan — refactor/eval-cleanup

Lot 1, point 4. Nettoyage du harnais d'évaluation relevé par l'audit de #373, avant
l'analyse d'erreurs sur les conversations réelles. Aucun changement de comportement du
juge : mêmes questions, mêmes verdicts, vérifié par les tests et un passage de
`bun run eval:cases`.

## Tâches

1. **Une seule table des critères** (`eval/criteria.ts`) : nom, questions, calcul de la
   note, échelle, règle lue par l'annotateur, section, total d'aide, note par scénario.
   Remplace `HELP_SCORES`, `QUESTIONS_OF` et les notes en ligne de `checks.ts`, la liste
   `HELP` et `PER_SCENARIO_ONLY` de `judge-scores.ts`, `CRITERIA` de `annotation.ts` :
   cinq endroits à tenir d'accord aujourd'hui.
2. **Configuration du juge à part** (`eval/judge-config.ts`) : `JUDGE`, `Generate`,
   l'usage en tokens. Casse le cycle `judge.ts` ↔ `extract.ts`.
3. **Version du juge calculée** : empreinte du modèle, de l'échantillonnage, du préambule,
   des questions, des questions de sécurité et de la consigne de l'extracteur, à la place
   de `promptVersion` incrémenté à la main ; chaque sortie (`eval`, `eval:cases`,
   `eval:agreement`) porte aussi le commit. Le code des vérificateurs est couvert par le
   commit.
4. **`judgeContext` et `resolveEntries`** passent dans `judge-context.ts` : trois scripts
   les importent aujourd'hui depuis `evaluation-run.ts`.
5. **Sorties des scripts** (`eval/output.ts`) : horodatage, écriture dans
   `eval-results/` avec juge et commit, message d'erreur, ligne de tokens ; aujourd'hui
   recopiés dans `run.ts`, `run-cases.ts`, `measure-agreement.ts`, `conversation.ts`.
6. **Relance cachée de `generateStructured`** : une réponse hors schéma est relancée sans
   passer par la limite de débit du harnais, et le juge la compte déjà comme un tirage
   perdu. Option `repairInvalid` (vraie par défaut), fausse pour le juge et l'extracteur ;
   test de la relance et de son absence.
7. **Conversions forcées** : `conversation.ts` valide la réponse de session avec Zod ; les
   `as never` des tests de `judge-rate` et `judge` disparaissent.
8. **Fabriques de test partagées** (`tests/_helpers/eval-fixtures.ts`) : `turn`,
   `transcript`, `input`, redéfinies dans six fichiers.
9. **Données des études hors de `src/`** : `src/eval/agreement/2026-10-03/` passe dans
   `docs/etudes/2026-10-03/donnees/`, à côté des rapports qui les citent ; références
   mises à jour.
10. **`docs/suivi.md`** : date, entrées dépassées (calibration de l'ancien juge, biais à
    mesurer sur des cas construits, déjà fait), PR en cours.

## Renvoyé

- **Nombre de tirages** (5) : se décide sur l'accord par question, mesuré pendant
  l'analyse d'erreurs.
- **File d'annotation Langfuse** : gardée, c'est l'outil de la relecture humaine de
  Victor ; rien à retirer.

## Validation

`bun run typecheck`, `bun run lint`, `bunx knip`, `bun run test`, puis
`bun run eval:cases` : mêmes verdicts que `judge-1.json` et `judge-2.json`, aux tirages
du modèle près.
