# Plan — `refactor/server-voice`

Refonte du serveur, module `voice` (lot 0, `roadmap.md`, point 7), pilote du rangement par
module de `architecture.md` (« Monolithe modulaire »). Chemins relatifs à
`apps/server/src/`. Comportement inchangé.

## Pré-vol (contre `main` après #348)

- Code du module (661 lignes) : `services/voxtral-transcribe.service.ts`,
  `services/voxtral-tts.service.ts`, `services/audio-transcription.service.ts`,
  `services/text-to-speech.service.ts`, `routes/tts.routes.ts`,
  `lib/text/speech-normalize.ts`.
- Consommateurs hors module : `app.ts` (routes TTS) et `routes/file-upload.routes.ts`
  (`audioTranscriptionService`). Les tests et `live/` importent les fichiers internes, ce
  qui reste permis pour un test.
- Aucune table propre au module.

## Tâches

1. `git mv` vers `modules/voice/` : `voice.routes.ts`, `text-to-speech.service.ts`,
   `audio-transcription.service.ts`, `voxtral-tts.service.ts`,
   `voxtral-transcribe.service.ts`, `speech-normalize.ts`.
2. `modules/voice/index.ts` : `voiceRoutes` et `audioTranscriptionService`, seuls points
   d'entrée des autres modules ; `app.ts` et l'upload passent par lui.
3. Doc : ligne `voice` d'`architecture.md`, suivi, roadmap, suppression du plan.

Les défauts fonctionnels du module (langue ignorée par le TTS, voix annoncées sans voix
réelle) restent au lot 2, où le suivi les range.

## Validation

Typecheck, lint, tests unitaires et d'intégration, knip, build et boot.
