# Plan — `feat/eval-judge-stability`

Lot 1, point 4, suite : reproductibilité du juge, avant toute recalibration
(`etudes/2026-10-03/accord-juge.md`, « Suite »). Le même juge sur les mêmes 36
transcriptions a donné α = 0,796 puis 0,840 sur `help_graded_hints` : tant qu'il ne note
pas pareil deux fois, une ancre réécrite ne se mesure pas.

## Pré-vol (contre `main` après #367)

- **Graine** : `random_seed` de l'API Mistral, « If set, different calls will generate
  deterministic results » ([doc](https://docs.mistral.ai/api/endpoint/chat)). L'AI SDK
  passe son option `seed` en `random_seed` (`@ai-sdk/mistral` 4.0.48, `dist/index.js`) ;
  `generateStructured` ne l'expose pas encore.
- **Mesure** : l'α de `eval/agreement.ts` accepte plus de deux codeurs par unité ; des
  passages du juge en sont les codeurs.

## Tâches

1. `generateStructured` : option `seed`, testée sur le corps envoyé.
2. Juge : graine fixe dans `JUDGE`, version du prompt inchangée (le prompt ne change pas).
3. `bun run eval:agreement <résultats> --passes N` : juge N fois chaque transcription et
   donne, par critère, l'α entre passages (reproductibilité), à côté de l'accord avec
   l'annotation quand il y en a une.
4. Preuve : trois passages sur l'échantillon du 2026-10-03, avec graine ; si la graine ne
   rend pas le juge reproductible, la mesure le dit et la suite en tient compte.
5. Doc : rapport daté, `agent.md` § 9, suivi ; suppression du plan.

## Renvoyé

- Ancres réécrites, cas construits et validation sur un nouvel échantillon : PR suivante.

## Validation

Typecheck, lint, tests, knip ; passages réels avec leurs codes de sortie.
