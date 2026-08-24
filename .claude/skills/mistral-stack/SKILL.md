---
name: mistral-stack
description: Choisir le modèle Mistral pour une tâche donnée et appeler l'API sans gaspiller de tokens — chat, reasoning, vision, documents, TTS/STT, extraction structurée. À utiliser quand on ajoute ou modifie un appel IA côté serveur, qu'on hésite entre deux modèles, ou qu'un coût de tokens dérape. Toute la stack IA est Mistral, souveraineté EU.
---

# Stack IA — casting des modèles et coût

Contrainte non négociable : **stack 100 % Mistral, souveraineté EU**. C'est un
critère éliminatoire pour tout nouveau provider, pas une préférence.

Les identifiants vivent dans `apps/server/src/config/env.ts` (`MISTRAL_MODEL_*`,
aliases `-latest`). Ce document donne le **raisonnement** derrière chaque choix,
que les identifiants seuls ne portent pas.

## Un modèle par tâche

| Tâche | Modèle | Pourquoi celui-là |
|---|---|---|
| Chat tutorat (streaming + tools) | `mistral-medium-latest` | Le seul à tenir la qualité pédagogique en streaming avec appel d'outils |
| Reasoning (STEM, collège+, intention difficile) | le même, `reasoning_effort: high` | **Magistral est déprécié** : le reasoning est devenu un *paramètre*, plus un modèle dédié. Routé par `lib/ai/mistral-reasoning.ts` |
| Vision (photos d'exercices) | `mistral-medium-latest` | Multimodal natif depuis la fusion Pixtral — pas de modèle vision séparé à router |
| Extraction structurée nuancée (épisodes, analyses) | `mistral-medium-latest` | La nuance se perd sur les petits modèles ; c'est le seul cas où medium se justifie hors chat |
| Titres, classification d'intention, génération templatée | `ministral-3b` / `ministral-8b` / `mistral-small` | Tâches courtes et cadrées : payer medium ici est du gaspillage pur |
| Documents (PDF, photos) | `mistral-vision.ts` + parsers, dans `services/document/` | Aucun modèle OCR n'est épinglé en configuration : l'extraction passe par la vision et des parsers, pas par un endpoint OCR séparé |
| TTS | `voxtral-tts-latest` | FR, voice cloning, EU |
| STT | `voxtral-mini-latest` | EU |
| Embeddings mémoire épisodique | `mistral-embed` (1024D) | — |

**Jamais `mistral-large` par défaut** : à réserver aux cas où medium a échoué, constaté.

## Toujours passer par le client centralisé

`src/lib/ai/mistral-client.ts` — jamais le SDK directement depuis un service.

- `generateText({ messages, model, temperature, maxTokens, promptCacheKey, timeoutMs })`
- `generateStructured<T>({ ..., schema })` — JSON Schema strict, ce qui élimine le
  retry de parsing plutôt que de le gérer
- Chat streaming : `streamChat` dans `src/services/chat/ai-chat.service.ts`
  (Vercel AI SDK `streamText`), exposé par `/api/chat/stream`

## Les quatre leviers de coût

1. **`prompt_cache_key` versionné** sur tout service à system prompt stable —
   environ −90 % de tokens facturés en entrée. Le versionner, sinon un changement
   de prompt sert un cache périmé.
2. **`max_tokens` strict par tâche** : titre 64, classification 80, résumé 2048,
   chat 1024. Une borne large coûte même quand le modèle ne l'atteint pas.
3. **JSON Schema strict** pour toute sortie structurée — supprime la boucle de
   retry, qui est le vrai coût caché.
4. **Batch API** pour les jobs hors ligne : −50 %.

## Migration Gemini terminée

`@google/genai` est retiré du `package.json` et aucun appel sortant Google ne
subsiste au runtime. Si une piste de code suggère le contraire, c'est un vestige
à supprimer, pas un chemin à maintenir.

## Sources

[Mistral API](https://docs.mistral.ai/api/) ·
[Modèles](https://docs.mistral.ai/getting-started/models/models_overview/) ·
[BGE-M3](https://huggingface.co/BAAI/bge-m3)
