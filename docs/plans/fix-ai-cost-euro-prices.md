# Plan — fix/ai-cost-euro-prices

Correction de #400 : le coût de chaque appel se calcule avec la conversion que Mistral applique
lui-même, pas un taux de change. Chemins relatifs à `apps/server/src/`.

## Pré-vol (2026-10-06, contre `main` à `2f8aeed8`)

- La page Usage › Coûts de l'organisation (admin.mistral.ai, lue le 2026-10-06) facture en
  euros : Small 4 sur l'endpoint UE 0,14 € et 0,56 € par million de tokens, la lecture vocale
  0,00001496 € par caractère, la transcription 0,00004675 € par seconde.
- La règle se vérifie au chiffre près : prix en dollars × 1,1 (endpoint UE) × 0,85. Lecture
  vocale 16 $ × 1,1 × 0,85 = 14,96 € par million ; transcription 0,003 $ par minute × 1,1 × 0,85
  / 60 = 0,00004675 € par seconde ; sur l'endpoint global, Small 4 à 0,13 € et 0,51 €.
- `platform/ai/cost.ts` convertit à 0,92 (`USD_TO_EUR_RATE`, défaut de `platform/config/env.ts`) :
  chaque coût est surestimé d'environ 8 %.

## Tâches

1. Taux de Mistral en constante dans `cost.ts`, avec sa source ; la variable d'environnement
   `USD_TO_EUR_RATE` disparaît (ce n'est pas un réglage de déploiement).
2. Tests du coût recalculés au taux de Mistral, dont les deux prix vérifiés au chiffre près.
3. `docs/suivi.md`.

## Validation

`bun run typecheck`, `bun run lint`, `bunx knip`, `bun run test`.
