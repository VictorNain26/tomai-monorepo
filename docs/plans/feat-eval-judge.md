# Plan — `feat/eval-judge`

Lot 1, point 4 de `roadmap.md`, première PR : le juge daté. Il note la qualité d'aide,
l'alignement au programme, le niveau de langue, la fuite des productions rédigées et la
réponse aux scénarios de sécurité. La relecture humaine d'un échantillon et l'accord mesuré
font la PR suivante : ils demandent des notes humaines.

## Pré-vol (contre `main` après #365)

- **Modèle** : `mistral-medium-2604` (Mistral Medium 3.5, sorti le 2026-04-28, alias
  `mistral-medium-3.5`), listé par `GET /v1/models` sur ce compte le 2026-10-03 ; 1,5 $ par
  million de tokens en entrée, 7,5 $ en sortie, sorties structurées
  ([doc](https://docs.mistral.ai/models/mistral-medium-3-5-26-04)). Épinglé par son id
  daté, jamais par `-latest`. Débit du compte : 500 000 tokens par minute.
- **Appel** : `generateStructured` (`platform/ai/mistral-client.ts`) accepte `model`,
  `temperature`, sortie `Output.object` en JSON strict, une relance si le schéma n'est pas
  respecté ; télémétrie sans contenu.
- **Grille** : celle du protocole (`etudes/2026-10-01/tests-tuteurs/protocole.md`) —
  diagnostic 0 à 2, une question à la fois 0 ou 1, indices gradués 0 à 2, exactitude 0 ou 1,
  niveau 0 ou 1, ton 0 ou 1 —, avec `safety_response` (`agent.md` § 9). Alignement : le
  champ `alignment` du jeu (#365). Niveau de langue : trois crans ancrés, pas de formule
  (`etudes/2026-10-02/alignement.md`, § 7).
- **Fiabilité** (même étude, § 8) : un critère à la fois, justification citée avant la note,
  ancres indépendantes de la longueur, température 0, prompt et date du juge dans git.
- **Coût, estimation** : environ 4 000 tokens en entrée et 600 en sortie par conversation,
  soit environ 1 centime ; une passe complète du jeu (environ 360 conversations) coûte
  environ 3 $ de juge, à mesurer au premier passage.

## Tâches

1. `src/eval/judge.ts` : constantes `JUDGE` (modèle, version du prompt datée), construction
   des messages (exercice, réponse attendue ou éléments attendus, entrées du référentiel et
   notions des classes suivantes, scénario et comportement attendu, transcription), schéma
   de sortie selon la grille du scénario (`help`, `leak` pour une production rédigée,
   `safety`), appel par `generateStructured`.
2. Conversion du verdict en scores Langfuse : `help_*` et `help_total` sur 8,
   `alignment_in_class`, `alignment_later_notions`, `language_level`, `leak_written`,
   `safety` ; moyennes par scénario au niveau du run.
3. `run.ts` : le juge comme évaluateur de l'expérience, ses verdicts dans `eval-results/`,
   la version du juge dans les métadonnées.
4. Tests : messages construits (tout ce que le juge doit voir, rien de plus), schéma selon
   la grille, conversion en scores ; test live sur une transcription fixe.
5. Preuve : passage réel réduit, lu dans Langfuse.
6. Doc : `agent.md` § 9, suivi ; suppression du plan.

## Renvoyé

- Relecture humaine (file d'annotation Langfuse) et accord juge-humain (κ de Cohen par
  critère, α de Krippendorff) : PR suivante du point 4.
- Re-notation des transcriptions des concurrents : point 5.

## Validation

Typecheck, lint, tests, knip ; passage réel réduit avec ses codes de sortie.
