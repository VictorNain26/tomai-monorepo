---
name: mistral-stack
description: Choisir le modèle Mistral et l'appeler correctement — chat, raisonnement, vision, sorties structurées, modération, TTS/STT, cache de prompt, coût. À utiliser quand on ajoute ou modifie un appel IA côté serveur, qu'on hésite entre deux modèles, ou qu'un coût de tokens dérape. Toute la stack IA est Mistral, endpoint UE.
---

# Stack IA — casting et réglages

Contrainte non négociable : **stack 100 % Mistral, inférence en UE** (`api.eu.mistral.ai`,
variable `MISTRAL_SERVER_URL`). Référence de conception : `docs/tuteur.md` §2-3.

## Casting

| Rôle | Modèle | Réglage |
|---|---|---|
| Chat élève, texte et image | `mistral-small-2603` (Small 4) | `reasoningEffort` routé par `modules/tutor/mistral-reasoning.ts`, `promptCacheKey` = ID de session |
| Lecture d'image (transcription seule), résumés, cartes, titres, analyse du tour, diagnostic | `mistral-small-2603` | `reasoningEffort: 'none'` (défaut de `platform/ai/mistral-client.ts`) |
| Fiche d'exercice | `mistral-small-2603` | `reasoningEffort: 'high'` passé à `generateStructured`, sans plafond de tokens, température 0,7, trois tirages votés (`modules/tutor/exercise-sheet.service.ts`) |
| Modération d'entrée et de sortie | `mistral-moderation-2603` (gratuit) | `platform/ai/moderation.ts`, drapeaux au seuil de Mistral. Entrée : `moderateStudentTurn`, le message de l'élève avec le dernier message du tuteur, `selfharm` décide la détresse, les autres catégories se gardent sans bloquer ; indisponible = les règles seules jugent la détresse. Sortie : catégories bloquantes `OUTPUT_BLOCKING` ; indisponible = rien ne part sans contrôle |
| STT / TTS | `voxtral-mini-2602` / `voxtral-mini-tts-2603` | STT en français imposé (sans langue, les réponses courtes basculent en anglais, mesuré) ; TTS en voix preset `fr_marie_neutral` (champ `language` refusé par l'API) |

Un seul modèle texte : une seule variable (`MISTRAL_MODEL`), un seul cache, une seule
configuration à évaluer. Un autre modèle (Ministral, Medium 3.5) ne revient que sur une
mesure du harnais d'évaluation (lot 1), jamais sur intuition.

**IDs datés uniquement.** `env.ts` refuse tout `-latest` au boot : un alias change de
modèle et de prix sans prévenir (docs.mistral.ai/inference/model-lifecycle).

## Appeler l'API

- Non-streaming : `generateText` / `generateStructured` de `src/platform/ai/mistral-client.ts`,
  jamais le SDK directement depuis un service.
- Chat : `streamChat` (`src/modules/tutor/ai-chat.service.ts`, `streamText`), exposé par
  `/api/chat/stream`. Le raisonnement reste côté serveur (`sendReasoning: false`).
- Réglages Mistral uniquement via `providerOptions.mistral` (`promptCacheKey`,
  `reasoningEffort`, `strictJsonSchema`, `parallelToolCalls`) — pas de wrapper `fetch`.
- `reasoningEffort` n'accepte que `'none' | 'high'` dans `@ai-sdk/mistral`, et n'est
  envoyé que pour les IDs de sa liste interne : vérifier qu'un nouveau modèle y figure.
- Pas de `safePrompt` : déprécié par Mistral. Ce qui atteint l'élève
  (message, cartes, titre) passe par la modération (`platform/ai/moderation.ts`) ; le résumé
  de séance, jamais montré, non.

## Coût

Chaque appel facturé est tracé dans `cost_tracking`, en micro-euros, par
`recordAiCost` (`src/platform/ai/cost.ts`) : `generateText` et `generateStructured` le
font par construction, le tour de chat et la voix l'appellent eux-mêmes. Un nouvel appel
qui contourne `mistral-client.ts` doit l'appeler aussi, avec son `owner` (l'élève et sa
séance ; `null` hors d'un élève, harnais ou tests réels, et rien n'est écrit). La
modération, gratuite, n'est pas tracée.

- **Tarif** : `MODEL_PRICING_USD`, prix publics en dollars par ID daté (tokens, minutes
  d'audio, caractères lus). Tokens en cache à 10 % du prix d'entrée, endpoint UE +10 %,
  conversion au taux que Mistral facture (`MISTRAL_USD_TO_EUR`). Un modèle absent de la table
  produit une ligne à 0 marquée `unknownModel` et un avertissement : l'ajouter à la table.
- **Quota** : un budget du jour par formule, en micro-euros (`modules/billing/quota-config.ts`),
  comparé à la somme de `cost_tracking` depuis la dernière remise à zéro, à 10 h à Paris
  (`modules/billing/quota.ts`, `checkQuota`). Un appel au coût connu d'avance, la lecture
  vocale, passe ce coût à `checkQuota` et n'est pas lancé s'il dépasse le budget.
- **Réduire le coût** : cache de prompt, clé = ID de session pour le chat, ID de workflow
  versionné pour les tâches templatées, contenu stable en tête du prompt ;
  `maxTokens` fixé par tâche à l'appel, sauf sur un appel qui raisonne (la borne est alors le
  timeout).
- **Endpoint UE** : Batch, Agents et Files n'y sont pas servis : on ne les utilise pas.

Coûts mesurés : `docs/etudes/2026-10-01/couts.md`, `docs/etudes/2026-10-06/passage-de-fin.md`.

## Sources

[Regional inference](https://docs.mistral.ai/inference/regional-inference) ·
[Prompt caching](https://docs.mistral.ai/studio/conversations/advanced/prompt-caching) ·
[Reasoning](https://docs.mistral.ai/studio/conversations/reasoning) ·
[Small 4](https://docs.mistral.ai/models/mistral-small-4-0-26-03) ·
[Known limitations](https://docs.mistral.ai/resources/known-limitations)
