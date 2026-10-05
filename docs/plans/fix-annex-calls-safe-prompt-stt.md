# Plan — fix/annex-calls-safe-prompt-stt

Lot 2, point 7 (`docs/roadmap.md`), première PR : les appels annexes. Décisions :
`docs/etudes/2026-10-04/refonte-agent.md`, « Autres usages de l'IA ». Chemins relatifs à
`apps/server/src/`. Le reste du point 7 suit en deux PR : logs sans contenu d'élève, puis
mémoire (résumé incrémental, épisodes une fois par séance).

## `safePrompt`

« 'safe_prompt' is deprecated. We recommend using Custom Guardrails instead »
(https://docs.mistral.ai/resources/deprecated/guardrailing/safe_prompt, lu le 2026-10-05).
Il est encore activé par défaut dans `platform/ai/mistral-client.ts` (`generateText`,
`generateStructured`) : titre, résumé, épisode, cartes, analyse du tour. Ce qui atteint
l'élève passe par la modération (#389, #390) : message, cartes, titre. Le résumé et
l'épisode ne sont jamais montrés ; ils nourrissent le prompt, et leur entrée, les messages de
la séance, a déjà été modérée. Les versions de ces cinq prompts changent : sans `safe_prompt`,
le modèle ne reçoit plus le même texte.

Analyse du tour remesurée sans `safe_prompt`, trois passages : 1 premier message raté sur 42
(H1, une fois), contre 0 sur 42 ; aucune fausse alarme ; l'énoncé recollé, tranché par le code.

## STT

Mesuré le 2026-10-05 par appels réels, sur des réponses d'élève produites par notre TTS,
propres et mêlées d'un bruit rose (ffmpeg) :
- sans langue : « Non. » devient « No. », propre comme bruité ; « Cinq » bruité, « Thank you. » ;
- `language: 'fr'` : les réponses françaises justes ; mais un « Yes. » bruité devient « Oui. »,
  et « She has got a dog. » bruité, « si a su perro. » ;
- la bonne langue imposée : toutes justes ;
- la réponse ne donne pas la langue (`language: null`), alors que `detectedLanguage` renvoyait
  la langue forcée comme si elle était détectée.

Le français reste donc imposé : c'est la langue de presque toutes les réponses, et l'enlever
casse les plus courtes. Un oral de langue attend que le client déclare sa langue, comme
`inputMode` (lot 3) : le serveur ne la connaît pas, la matière dit seulement « langues ».
L'item « STT sans langue forcée » de l'étude est infirmé par la mesure.

## Tâches

1. `platform/ai/mistral-client.ts` : `safePrompt` retiré, option comprise ; ses appels
   (`exercise-sheet.service.ts`, `exercise-diagnosis.service.ts`, `mistral-vision.ts`,
   `eval/`) aussi ; versions des prompts touchés changées.
2. Transcription : français imposé, mesure en commentaire ; `detectedLanguage`, que rien ne
   lit, retiré ; `audio-transcription.service.ts`, devenu un simple relais, retiré ; l'audio
   passé avec ses seuls octets (`.buffer` d'un `Buffer` emportait le pool autour).
3. Tests : aucune option `safe_prompt` envoyée ; français demandé ; octets exacts.
4. `docs/suivi.md` : S4 repassé après #391 et #392 ; le point 7 commencé ; la langue d'un
   oral au lot 3.

## Validation

`bun run typecheck`, `bun run lint`, `bunx knip`, `bun run test` ; `bun run test:live` une
fois.
