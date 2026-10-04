# Plan — feat/agent-turn-strict

Lot 2, point 2, seconde PR (`docs/roadmap.md`). Décisions et sources :
`docs/etudes/2026-10-04/refonte-agent.md`. Chemins relatifs à `apps/server/src/`.

## Tâches

1. **Outils stricts** : `strict: true` sur `generate_flashcards` et `update_student_profile`
   (`Tool.strict`, `@ai-sdk/provider-utils` 5.0.45 ; transmis par `@ai-sdk/mistral` 4.0.48).
   - Le mode strict de Mistral a déjà refusé des schémas (cartes : `format: uri`,
     `propertyNames`).
   - Un appel réel le vérifie pour ces deux outils (`bun run test:live`), avec leurs bornes
     (`min`, `max`, `maxLength`, enum).
2. **Usage d'un tour coupé.**
   - Sur un abandon (timeout, client parti), `onAbort` de `streamText` donne les pas
     terminés : leur usage compte au quota et au coût.
   - L'usage du pas coupé n'est pas connu du flux : l'événement est tracé comme tel.
   - Que l'usage arrive dans le flux sans `stream_options.include_usage` se vérifie par le
     test live existant (`live/mistral-eu.test.ts`, usage > 0).
3. **Renommages de l'AI SDK 7**, dépréciés dans `ai` 7.0.107 :
   - `system` devient `instructions` ;
   - `onFinish` devient `onEnd` sur `createUIMessageStream` ;
   - `AbortSignal.timeout` devient l'option `timeout`.
4. Tests du comptage d'un tour coupé et des options envoyées.

## Validation

`bun run typecheck`, `bun run lint`, `bunx knip`, `bun run test` ; `bun run test:live` une
fois. Pas de passage au harnais.
