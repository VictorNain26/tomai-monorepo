# Plan — fix/annex-calls-safe-prompt-stt

Lot 2, point 7 (`docs/roadmap.md`), première PR : les appels annexes. Décisions :
`docs/etudes/2026-10-04/refonte-agent.md`, « Autres usages de l'IA ». Chemins relatifs à
`apps/server/src/`. Le reste du point 7 suit en deux PR : logs sans contenu d'élève, puis
mémoire (résumé incrémental, épisodes une fois par séance).

## `safePrompt`

« 'safe_prompt' is deprecated. We recommend using Custom Guardrails instead »
(https://docs.mistral.ai/resources/deprecated/guardrailing/safe_prompt, lu le 2026-10-05).
Il est encore activé par défaut dans `platform/ai/mistral-client.ts` (`generateText`,
`generateStructured`) : titre, résumé, épisode, cartes, analyse du tour. La modération
d'entrée et de sortie (#389, #390) fait ce travail par le code ; `safePrompt` ajoute un
prompt système de Mistral à des tâches qui n'en ont pas besoin.

## STT

Mesuré le 2026-10-05 par appels réels sur `MISTRAL_STT_MODEL` :
- un extrait anglais (l'échantillon de la doc Mistral) est transcrit en anglais avec ou sans
  `language: 'fr'` : la traduction en français que l'étude annonçait ne se reproduit pas ;
- trois phrases françaises d'élève, produites par notre TTS : transcriptions identiques avec
  ou sans `language` ;
- la réponse ne donne pas la langue (`language: null`), alors que `detectedLanguage` renvoie
  la langue forcée comme si elle était détectée.

`language` est optionnel (« Providing the language can boost accuracy », doc de
`POST /v1/audio/transcriptions`) : sans gain mesuré en français, et faux pour un oral
d'anglais, d'espagnol ou d'allemand, il n'est plus forcé.

## Tâches

1. `platform/ai/mistral-client.ts` : `safePrompt` retiré, option comprise ; ses appels
   (`exercise-sheet.service.ts`, `exercise-diagnosis.service.ts`, `mistral-vision.ts`,
   `eval/`) aussi.
2. `modules/voice/voxtral-transcribe.service.ts`, `audio-transcription.service.ts`,
   `documents/upload.routes.ts` : plus de langue forcée ; `detectedLanguage` vient de la
   réponse de l'API, absent quand elle ne le donne pas.
3. Tests : aucune option `safePrompt` envoyée ; transcription sans `language`, langue
   détectée prise de la réponse.
4. `docs/suivi.md` : S4 repassé après #391 et #392 ; le point 7 commencé.

## Validation

`bun run typecheck`, `bun run lint`, `bunx knip`, `bun run test` ; `bun run test:live` une
fois.
