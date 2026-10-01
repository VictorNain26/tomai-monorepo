# Plan — `chore/remove-pronote-waitlist`

Nettoyage de la vision, deuxième PR du lot 0 (`roadmap.md`, « Découpage en PR ») : Pronote
et la liste d'attente sortent du code. Source du périmètre : `suivi.md`, « Reporté »,
« Lot 0 — nettoyage de la vision ». Chemins relatifs à `apps/server/src/` sauf mention
contraire.

## Pré-vol (2026-10-01, contre `main` à `0a011b7`)

- `rg -il pronote` (hors `apps/server/drizzle/`) : 69 fichiers sous `apps/`, plus
  `.github/workflows/ci.yml` et `docker-compose.yml` ; rien sous `packages/` ni `scripts/`.
  `rg -il waitlist` : `app.ts`, `routes/waitlist.routes.ts`,
  `db/repositories/waitlist.repository.ts`, `db/schema/billing.schema.ts`,
  `integration-tests/api-endpoints.test.ts`, et `apps/landing/tests/links.spec.ts`.
- `lib/encryption.ts` n'a pas d'autre appelant que Pronote et `server-lifecycle.ts`
  (confirmé) ; deux tests le mockent (`integration-tests/api-endpoints.test.ts`,
  `tests/server-lifecycle-shutdown.test.ts`).
- Deux tables Pronote, pas une : `pronote_credentials` et `pronote_child_resources`
  (`db/schema/pronote.schema.ts`), plus la relation `pronoteCredentials` de `userRelations`
  (`db/schema/index.ts`).
- Écarts au suivi : `lib/errors.ts` porte un code `PRONOTE_NOT_CONNECTED` ; le commentaire
  de `config/database-url.ts` cite `PRONOTE_ENCRYPTION_KEY` ; `.env.example` porte aussi
  `PRONOTE_TEST_*` ; `tests/rate-limit-ordering.test.ts` prend le preset `pronote` comme
  exemple de clé par utilisateur.

### Arbitrages

- **`dateOfBirth` requis à la création d'un enfant.** Le contrat TypeBox de
  `POST /api/parent/children` (`routes/api/parent.routes.ts`) le rend optionnel pour les
  seuls enfants importés de Pronote (commentaire `TODO(product)`), alors que
  `createChildSchema` (Zod) l'exige déjà. Sans Pronote, il devient requis dans TypeBox et
  dans la signature de `ParentService.createChild` : aucun changement de comportement
  (Zod refusait déjà l'absence), seul le type Eden se resserre. Le format (bornes d'âge)
  reste dans Zod ; E2 le reporte dans TypeBox en supprimant `schemas/validation.ts`.
  Pas de client : le changement de contrat est libre.
- **`ChildInfo.dateOfBirth`** reste optionnel en sortie : la colonne est nullable.
- **Deux migrations**, une par commit (liste d'attente, puis Pronote), générées par
  `bun run db:generate`, jamais écrites à la main (`.claude/rules/database-migrations.md`).
  Aucune base de production : pas de sauvegarde préalable à faire.
- **Prompts** : le texte de `config/prompts/core/safety.ts` et la description de l'outil
  `get_app_help` changent, donc `PROMPT_VERSION` (`services/chat/ai-chat.service.ts`)
  prend la date du jour ; idem `SUMMARIZATION_PROMPT_VERSION`.
- **`get_app_help`** perd seulement le sujet `pronote` et les mentions de Pronote. Le reste
  du guide décrit encore l'app mobile ; sa réécriture reste au lot 3 (suivi).
- **`apps/landing/tests/links.spec.ts`** reste : il garantit que la landing ne mentionne
  plus la liste d'attente.
- **`NEXT_PUBLIC_SERVER_URL` sur Vercel** reste une étape manuelle de Victor.

## Tâches

Une tâche = un commit, typecheck et lint verts à chacun (pre-commit lefthook).

### 1. Contexte Pronote de l'agent — `refactor(chat)`

La liste de `agent.md` § 13 :

- `routes/chat-message.routes.ts` : champ `pronoteContext` retiré du corps et de l'appel à
  `streamChat`. Un client qui l'envoie encore reçoit un 400 (`additionalProperties` à
  vérifier dans le schéma TypeBox ; sinon le champ est ignoré, ce qui suffit).
- `services/chat/ai-chat.service.ts` : `PronoteContext`,
  `StreamGenerationParams.pronoteContext` et l'appel à `wrapPronoteData` retirés ;
  `PROMPT_VERSION` mise à jour.
- `services/chat/mistral-helpers.ts` : `wrapPronoteData` supprimée, `pronote_data` retiré
  de l'expression de `stripPromptTags`. Test `tests/prompt-security.test.ts` : le cas
  `pronote_data` disparaît ; les balises restantes restent couvertes.
- `services/chat/chat-message-assembler.ts` : `pronoteBlock` retiré de
  `ChatMessageParts` et de `assembleChatMessages`, docstring alignée. Son test vérifie
  l'ordre des messages sans le bloc.
- `config/prompts/core/safety.ts` : mentions des données Pronote et du bloc
  `<pronote_data>` retirées.
- `services/chat/chat-tools.ts`, `services/chat/tool-executor.ts`,
  `config/app-guide/app-guide-data.ts` : sujet `pronote` retiré de l'enum, de la
  description, du message d'erreur et des textes. `tests/app-guide-data.test.ts` : la liste
  des sujets attendus perd `pronote`, et un cas vérifie qu'aucun texte du guide ne
  mentionne Pronote.
- `services/chat/summarization.service.ts` : « recherches Pronote » retiré du prompt,
  `SUMMARIZATION_PROMPT_VERSION` mise à jour.

### 2. Liste d'attente — `refactor(server)`

- Supprimés : `routes/waitlist.routes.ts`, `db/repositories/waitlist.repository.ts` et
  leurs tests éventuels.
- `app.ts` : import et `.use(waitlistRoutes)` retirés.
- `db/schema/billing.schema.ts` : `waitlistEntries`, `WaitlistEntry`, `NewWaitlistEntry`
  retirés.
- `integration-tests/api-endpoints.test.ts` : mock de `routes/waitlist.routes` retiré.
- Migration générée (`DROP TABLE waitlist_entries`).

### 3. Intégration Pronote — `refactor(server)`

- Supprimés : `services/pronote/`, `services/pronote-sync.service.ts`,
  `routes/pronote-*.routes.ts`, `lib/pronote-onboarding.ts`,
  `lib/pronote-url-allowlist.ts`, `lib/encryption.ts`, `db/schema/pronote.schema.ts`,
  `db/repositories/pronote-child-resources.repository.ts`, `live/pronote.test.ts`, les
  tests `tests/pronote-*.test.ts`, `tests/pawnote-*.test.ts`, `tests/encryption.test.ts`,
  `integration-tests/pronote-*.integration.test.ts`,
  `integration-tests/helpers/pronote-credentials-login.ts`.
- `app.ts` : les trois routes Pronote retirées.
- `db/schema.ts`, `db/schema/index.ts` : export et relation `pronoteCredentials` retirés.
- `services/server-lifecycle.ts` : bloc de validation du chiffrement retiré ; le mock de
  `lib/encryption` disparaît de `tests/server-lifecycle-shutdown.test.ts` et de
  `integration-tests/api-endpoints.test.ts` (avec les mocks des routes Pronote et
  `pronoteSchema`).
- `config/env.ts` : `PRONOTE_ENCRYPTION_KEY` et son contrôle de production retirés.
  `tests/env-mistral.test.ts` : la clé sort des fixtures de production, et
  « accepts the EU server URL in production » démontre qu'elle n'est plus requise.
- `config/database-url.ts` : commentaire aligné.
- `lib/errors.ts` : code `PRONOTE_NOT_CONNECTED` retiré.
- `middleware/rate-limit.middleware.ts` : preset `pronote` retiré. `tests/rate-limit.test.ts`
  perd ses deux cas ; `tests/rate-limit-ordering.test.ts` garde ses deux cas sur le preset
  `ai` (même `keyGenerator` par utilisateur, clé attendue `ai:user:U1`).
- `services/parent.service.ts`, `services/parent/parent-types.ts` : `hasPronote`,
  `pronoteCredentialId` et la lecture `pronoteChildResourcesRepository` retirés de
  `getParentChildren`, `createChild` et `updateChild` ; `dateOfBirth` requis dans
  `createChild`. `routes/api/parent.routes.ts` : `dateOfBirth` requis, commentaire
  `TODO(product)` retiré. `tests/parent-service.test.ts` : cas `hasPronote`,
  `pronoteCredentialId` et « without dateOfBirth (Pronote path) » retirés ; les cas
  nominaux de `getParentChildren` restent.
- `apps/server/package.json` : dépendance `pawnote` retirée, lockfile régénéré.
- Migration générée (`DROP TABLE` des deux tables Pronote).

### 4. Configuration et doc — `docs` / `chore`

- `apps/server/.env.example` : bloc Pronote (`PRONOTE_ENCRYPTION_KEY`, `PRONOTE_TEST_*`)
  retiré. `docker-compose.yml` : `PRONOTE_ENCRYPTION_KEY` retiré du commentaire.
  `.github/workflows/ci.yml` : commentaire du service postgres sans l'exemple Pronote.
- `apps/server/CLAUDE.md` : puce Pronote retirée, mention des tests de « round-trip de
  chiffrement » retirée. `apps/server/README.md` : `PRONOTE_ENCRYPTION_KEY`, « encryption »
  dans `lib/`, lignes Pronote de l'arborescence retirées. `README.md` racine : phrase
  « encore présent côté serveur » retirée.
- `docs/architecture.md` : ligne Pronote du tableau au passé, paragraphe « Ce qui
  disparaît au lot 0 » retiré. `docs/agent.md` : § 13 supprimé, § 14 renuméroté 13 ;
  renvois alignés (`docs/agent.md` « §14 », `.claude/skills/mistral-stack/SKILL.md`
  « § 14 »).
- `docs/roadmap.md` : PR 2 du lot 0 marquée mergée avec son numéro.
- `docs/suivi.md` : section « Lot 0 — nettoyage de la vision » retirée, prochaine action
  = E2, historique complété.

### 5. Suppression de ce plan — `docs(plans)`

## Validation

Avant chaque push, exit codes lus :

```bash
pnpm typecheck && pnpm lint
pnpm test
pnpm --filter tomai-server test:integration   # infra Docker démarrée
cd apps/server && bun run db:check             # migrations cohérentes avec le schéma
pnpm exec knip                                 # ni export ni dépendance orphelins
rg -il 'pronote|pawnote|waitlist' apps packages scripts .github docker-compose.yml \
  -g '!apps/server/drizzle/**' -g '!apps/landing/tests/links.spec.ts'   # vide attendu
```

Plus un boot réel : `pnpm dev`, `GET /health` répond, migrations appliquées sur une base
neuve (`dev-bootstrap`).
