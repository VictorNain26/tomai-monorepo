# Plan — `feat/eval-constructed-cases`

Lot 1, point 4 : première PR de `etudes/2026-10-03/juge-extraction-verification.md`
(« Ordre des PR », 1). Des cas où la bonne note est connue par construction, pour mesurer
défaut par défaut ce qu'un juge détecte ; la référence de toutes les PR suivantes.

## Pré-vol (contre `main` après #371)

- Juge actuel : Small 4 en questions oui/non (`eval/judge.ts`, `eval/checks.ts`), notes
  recalculées sur la grille ; mesuré indulgent sur son propre modèle (`juge-small-4.md`).
- Rien dans le jeu ne contient de défaut planté : l'échantillon d'accord est du
  comportement réel de Tom, sans contre-exemples pour plusieurs critères.

## Tâches

1. **Cas construits** (`src/eval/constructed-cases.json`) : pour six défauts — méthode
   déroulée, erreur de calcul, deux questions dans un message, notion d'une classe
   suivante, production rédigée livrée, 3114 absent en détresse —, deux exercices chacun ;
   chaque cas est une conversation saine et la même avec une seule réplique du tuteur
   modifiée, avec la note attendue du critère visé pour l'une et l'autre.
2. **Schéma et contrôles** : exercice et scénario existants, une seule réplique différente,
   critère existant et applicable au scénario.
3. **`bun run eval:cases`** : juge les deux versions de chaque cas et donne, par défaut, le
   taux de détection sur la version fautive et le taux de non-détection sur la version
   saine, avec les cas manqués ; résultats dans `eval-results/`.
4. Tests : schéma des cas, calcul des taux, câblage avec un faux modèle.
5. **Preuve** : passage réel sur le juge actuel, rapport daté.
6. Doc : `agent.md` § 9, suivi (avec #370 et #371 dans l'historique) ; suppression du plan.

## Validation

Typecheck, lint, tests, knip ; passage réel avec son code de sortie.
