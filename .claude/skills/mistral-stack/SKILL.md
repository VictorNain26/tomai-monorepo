---
name: mistral-stack
description: Choisir le modèle Mistral et l'appeler correctement — chat, raisonnement, vision, sorties structurées, embeddings, TTS/STT, cache de prompt, coût. À utiliser quand on ajoute ou modifie un appel IA côté serveur, qu'on hésite entre deux modèles, ou qu'un coût de tokens dérape. Toute la stack IA est Mistral, endpoint UE.
---

# Stack IA — casting et réglages

Contrainte non négociable : **stack 100 % Mistral, inférence en UE** (`api.eu.mistral.ai`,
variable `MISTRAL_SERVER_URL`). Référence de conception : `docs/superpowers/specs/2026-09-22-agent-ia.md` §2-3.

## Casting

| Rôle | Modèle | Réglage |
|---|---|---|
| Chat élève, texte et image | `mistral-small-2603` (Small 4) | `reasoningEffort` routé par `lib/ai/mistral-reasoning.ts`, `promptCacheKey` = ID de session |
| Vision, analyse de document, résumés, cartes, titres, classification d'intention | `mistral-small-2603` | `reasoningEffort: 'none'` (imposé par `lib/ai/mistral-client.ts`) |
| Embeddings mémoire épisodique | `MISTRAL_EMBED_MODEL` (1024D) | — |
| STT / TTS | `voxtral-mini-2602` / `voxtral-mini-tts-2603` | Timeout explicite, voix preset `fr_marie_neutral` (champ `language` refusé par l'API) |

Un seul modèle texte : une seule variable (`MISTRAL_MODEL`), un seul cache, une seule
configuration à évaluer. Un autre modèle (Ministral, Medium 3.5) ne revient que sur une
mesure du harnais d'évaluation (lot 1), jamais sur intuition.

**IDs datés uniquement.** `env.ts` refuse tout `-latest` au boot : un alias change de
modèle et de prix sans prévenir (docs.mistral.ai/inference/model-lifecycle).

## Appeler l'API

- Non-streaming : `generateText` / `generateStructured` de `src/lib/ai/mistral-client.ts`,
  jamais le SDK directement depuis un service.
- Chat : `streamChat` (`src/services/chat/ai-chat.service.ts`, `streamText`), exposé par
  `/api/chat/stream`. Le raisonnement reste côté serveur (`sendReasoning: false`).
- Réglages Mistral uniquement via `providerOptions.mistral` (`promptCacheKey`,
  `reasoningEffort`, `strictJsonSchema`, `parallelToolCalls`) — pas de wrapper `fetch`.
- `reasoningEffort` n'accepte que `'none' | 'high'` dans `@ai-sdk/mistral`, et n'est
  envoyé que pour les IDs de sa liste interne : vérifier qu'un nouveau modèle y figure.
- `safePrompt` est déprécié par Mistral ; il disparaît quand la modération
  entrée/sortie arrive (lot 2).

## Coût

1. **Cache de prompt** : tokens cachés à 10 %. Clé = ID de
   session pour le chat, ID de workflow versionné pour les tâches templatées.
   Contenu stable en tête du prompt, variable ensuite.
2. **`maxOutputTokens` par tâche** : titre 64, classification 96, résumé 2048.
3. **JSON Schema strict** pour toute sortie structurée.
4. **Endpoint UE : +10 %** sur tout. Batch, Agents et Files n'y sont pas servis :
   on ne les utilise pas.

`cost-tracking.service.ts` tarifie par ID daté ; un modèle absent de la table
produit une ligne `unknownModel` à 0, à corriger dans la table.

## Sources

[Regional inference](https://docs.mistral.ai/inference/regional-inference) ·
[Prompt caching](https://docs.mistral.ai/studio/conversations/advanced/prompt-caching) ·
[Reasoning](https://docs.mistral.ai/studio/conversations/reasoning) ·
[Small 4](https://docs.mistral.ai/models/mistral-small-4-0-26-03) ·
[Known limitations](https://docs.mistral.ai/resources/known-limitations)
