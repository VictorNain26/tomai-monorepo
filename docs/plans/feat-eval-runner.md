# Plan — `feat/eval-runner`

Lot 1, point 2 de `roadmap.md` : exécuteur et métriques de fuite dans Langfuse. Rejoue un
scénario du jeu (`apps/server/src/eval/`) contre l'agent et détecte la réponse, y compris
dans les fiches générées.

## Pré-vol (contre `main` après #361)

- **Point d'entrée** : la route `POST /api/chat/stream` (`modules/tutor/chat-message.routes.ts`)
  fait tout le tour : intention, historique en base, contexte, outils, persistance. Elle
  s'appelle dans le processus par `app.request()` de Hono (`src/app.ts` exporte `app` sans
  effet de bord ; les planificateurs sont dans `index.ts`). Aucune logique de tour n'est
  recopiée.
- **Client** : `DefaultChatTransport` de l'AI SDK 7.0.107 accepte `fetch` et
  `prepareSendMessagesRequest` ; `readUIMessageStream` reconstruit le message final
  (`node_modules/ai/dist/index.d.ts`). C'est le transport du futur client web.
- **Ordre** : `createUIMessageStream` attend `onFinish` dans `flush()` avant de fermer le flux
  (`ai/dist/index.js`, `handleUIMessageStreamFinish`) : la réponse est en base quand le flux
  se termine, le tour suivant la voit.
- **Isolation** : un élève neuf par conversation (`createStudentAccount`, module `auth`),
  supprimé en fin de conversation ; sinon profil cognitif, mémoire épisodique et mémoire de
  matière d'une conversation fuient dans la suivante. Une séance neuve par
  `POST /api/chat/session/new`.
- **Garde-fous du serveur** : quota coupé par `QUOTA_ENFORCEMENT_ENABLED=false` ; limite IA
  100 requêtes par minute et par utilisateur hors production ; 2 flux simultanés par
  utilisateur. Débit Mistral : 100 000 tokens par minute et 1,67 requête par seconde pour
  `mistral-small-2603` (`suivi.md`).
- **Fiches** : la part `data-deck-created` donne `deckId` ; `GET /api/learning/decks/:id`
  renvoie les cartes. Le raisonnement n'est pas envoyé au client (`sendReasoning: false`) :
  ce n'est pas un canal de fuite visible.
- **Langfuse** (doc lue le 2026-10-02,
  [experiments via SDK](https://langfuse.com/docs/evaluation/experiments/experiments-via-sdk)) :
  `new LangfuseClient()` lit `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`,
  `LANGFUSE_BASE_URL` ; `langfuse.experiment.run({ name, description, data, task,
  evaluators, runEvaluators, maxConcurrency, metadata })` sur des données locales ;
  OpenTelemetry avec `LangfuseSpanProcessor` obligatoire en TypeScript, `shutdown()` en fin
  de script. Paquets `@langfuse/client` et `@langfuse/otel` 5.11.1 du 2026-09-09.
- **Traces** : `registerTelemetry(new OpenTelemetry())` de `@ai-sdk/otel`, comme
  `platform/observability/otel.ts`, range les appels Mistral (sans contenu,
  `recordInputs: false`) sous chaque item de l'expérience.
- Suivi « Lot 1 » : règles du contrôle de fuite (KaTeX, signes moins, mots entiers, faux
  positifs) et débit Mistral → tâches 1 et 3.

## Tâches

1. `src/eval/leak.ts` : normalisation (NFKC, casse, KaTeX `\frac`, `^2`, `\times`, `\,`,
   `$`, `\text{}`, tirets et signes moins, espaces fines, groupes de chiffres, virgule
   décimale, espaces autour des opérateurs) et recherche des `leakForms` en mots entiers.
   Tests : chaque forme du jeu retrouvée sous ses variantes, faux positifs du suivi, aucune
   forme présente dans son propre énoncé ni dans les tours du scénario.
2. `src/eval/conversation.ts` : joue un scénario sur un exercice par `app.request()` ;
   rend la transcription (message de l'élève, texte du tuteur, outils appelés, cartes des
   fiches créées, durée par tour).
3. `src/eval/evaluators.ts` : évaluateur par item `leak` (0 ou 1, tour, canal, forme
   trouvée ; rien pour une production rédigée, le juge du point 4 tranche) et évaluateur de
   run `leak_rate` par scénario et global. Tests sur des transcriptions construites.
4. `src/eval/run.ts` et `bun run eval` : items scénario × exercice × répétition, filtres
   `--scenario`, `--exercise`, `--repeat`, `--concurrency` (`node:util` `parseArgs`),
   expérience Langfuse, résultats aussi écrits en JSON local (ignoré par git) pour le
   rapport du point 5. Refuse de tourner si `NODE_ENV=production`.
5. Preuve : un passage réel réduit (S2 sur M1, puis S3 sur M3), lu dans Langfuse.
6. Doc : `agent.md` § 9 (comment lancer), suivi, suppression du plan.

## Renvoyé

- Juge de qualité d'aide et d'alignement : point 4. Coût par tour et rapport : point 5.
  Garde-fou en CI : point 6.

## Validation

Typecheck, lint, tests, knip ; passage réel réduit avec ses codes de sortie.
