# Plan — `feat/eval-judge-v2`

Lot 1, point 4 : juge v2 (`etudes/2026-10-03/refonte-harnais.md`, « Ordre des PR », 1).
Décision de Victor : Small 4 pour tout rôle de LLM, juge compris.

## Pré-vol (contre `main` après #369)

- Juge actuel (`eval/judge.ts`) : Medium 3.5, un appel par critère, échelles 0-2, 0-1 et
  trois crans, un schéma par critère, citation vérifiée avec une relance, température 0,
  graine. Mesures : `etudes/2026-10-03/accord-juge.md` et `reproductibilite-juge.md`.
- AI SDK : un seul choix lu par réponse ; les tirages sont des appels distincts avec des
  graines distinctes. Cache Mistral : préfixe commun par blocs de 64 tokens.
- Jeu : 17 énoncés sur 32 contiennent la tentative de l'élève ; aucun champ ne décrit son
  erreur.

## Tâches

1. **Contrôles oui/non** (`eval/checks.ts`) : chaque critère en deux à cinq questions
   objectives, chacune avec le sens de la réponse attendue ; la sécurité en contrôles propres
   au scénario (`scenarios.json`, S4 et S5). Les notes des critères se recalculent sur les
   échelles actuelles, pour rester comparables aux notes de l'annotateur.
2. **Schéma de sortie unique** (citation, réponse) et préfixe commun : le dernier message
   seul change d'un contrôle à l'autre. Mesure du cache avant et après.
3. **Tirages** : cinq par contrôle, température 0,7, graines fixes et versionnées ; la note
   est la part de « oui », le verdict la majorité ; un tirage dont la citation reste
   introuvable après une relance est perdu, un contrôle avec moins de trois tirages échoue.
4. **Référence** : champ `studentError` des exercices dont l'énoncé contient une tentative,
   passé au juge avec la réponse attendue.
5. **Small 4** : `JUDGE.model` sur `mistral-small-2603`, version du prompt datée.
6. Tests : contrôles applicables par scénario, recalcul des notes, part de « oui » et
   verdict, tirages perdus, schéma unique, référence dans le contexte.
7. **Preuve** : sur l'échantillon du 2026-10-03, accord avec les notes de l'annotateur
   (`labels.claude.json`) comparé à la mesure du juge v1 ; cache et coût mesurés ; rapport
   daté.
8. Doc : `agent.md` (juge, et règle Small 4 précisée), suivi ; suppression du plan.

## Renvoyé

- Cas construits et jeu de calibration élargi, en partie annoté par un humain : PR
  suivante (même étude, décision 4).

## Validation

Typecheck, lint, tests, knip ; mesure réelle avec ses codes de sortie.
