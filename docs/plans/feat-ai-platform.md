# Plan — la plateforme IA et le faux Mistral (étape 5, PR 1 sur 4)

Pré-vol (2026-10-07) : `ai` 7.0.128, `@ai-sdk/mistral` 4.0.57, `@mistralai/mistralai` 2.7.0
installés ; `reasoningEffort` (`'high' | 'none'`), `promptCacheKey` et `strictJsonSchema`
existent dans les types, et `mistral-small-2603` est dans la liste qui reçoit
`reasoning_effort`. L'ancien code (`048676b4`, `platform/ai/`) lit l'environnement et la base
par import global : il se réécrit par fermetures.

## Problème

Le tuteur (PR 2 à 4) appelle Mistral : texte, sortie structurée, modération. Chaque appel doit
être payé à son élève pour le quota, et les tests doivent tourner sans réseau ni clé, en passant
par le vrai SDK, ses retries et ses délais.

## Critères d'acceptation

- [ ] Config : `MISTRAL_API_KEY` requise en production ; `MISTRAL_SERVER_URL`, par défaut
      l'endpoint UE, imposé en production ; `MISTRAL_MODEL` daté, `-latest` refusé ;
      `MISTRAL_TIMEOUT_MS` et `MISTRAL_RETRY_ATTEMPTS`.
- [ ] `platform/ai` : `createAi({ config, db, logger })` donne `generateText`,
      `generateStructured` (schéma strict, une seule relance sur une réponse hors schéma) et la
      modération (réponse, textes, message de l'élève).
- [ ] Chaque appel facturé écrit son coût dans `ai_cost`, au nom de l'élève (`null` hors élève :
      rien n'est écrit), une réponse hors schéma comprise ; un modèle inconnu écrit une ligne à 0
      marquée et prévient ; une écriture ratée se journalise sans casser l'appel.
- [ ] `testing/mistral.ts` : un vrai serveur qui répond comme Mistral (complétion, sortie
      structurée, modération, erreur, attente sans fin) et garde les requêtes reçues.
- [ ] Tests sur une vraie base contre ce serveur : coût écrit au bon montant, options envoyées
      (`reasoning_effort`, `prompt_cache_key`, schéma strict), relance sur hors-schéma, retry sur
      503, délai dépassé, catégories de modération.
- [ ] Le skill `mistral-stack` et `.env.example` suivent les nouveaux chemins.

## Hors périmètre

Le chat en flux (`streamText`), la voix et la lecture d'image : PR 3 et lot 3. Le quota : PR 4.

## Vérification de bout en bout

`bun run typecheck && bun run lint && bun run test`, knip et `db:check` verts ; la migration
générée par `db:generate`.

## Décision humaine

Étape 5 et son ordre validés par Victor le 2026-10-06 ; découpage en quatre PR et quotas validés
le 2026-10-07.
