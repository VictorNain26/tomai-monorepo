---
name: mistral-stack
description: Choisir le modèle Mistral et l'appeler correctement — chat, raisonnement, vision, sorties structurées, modération, TTS/STT, cache de prompt, coût. À utiliser quand on ajoute ou modifie un appel IA côté serveur, qu'on hésite entre deux modèles, ou qu'un coût de tokens dérape. Toute la stack IA est Mistral, endpoint UE.
---

# Stack IA — casting et réglages

Contrainte non négociable : **stack 100 % Mistral, inférence en UE** (`api.eu.mistral.ai`,
variable `MISTRAL_SERVER_URL`, +10 % sur le prix). Les rôles, les modèles et leurs réglages :
`docs/tuteur.md` §2 ; le pourquoi : `docs/decisions.md`.

## Casting

- **Mistral Small 4** (`mistral-small-2603`) pour tout rôle de LLM, juge compris : jamais
  Medium, Large ni Ministral. Restent les modèles spécialisés : `mistral-moderation-2603`
  (gratuit), et Voxtral pour la voix, à son arrivée au lot 3 (`voxtral-mini-2602` en
  transcription, en français imposé ; voix `fr_marie_*`, le champ `language` est refusé).
- Un seul modèle texte : une seule variable (`MISTRAL_MODEL`), un seul cache, une seule
  configuration à évaluer.
- **IDs datés uniquement.** `src/config.ts` refuse tout `-latest` au boot : un alias change de
  modèle et de prix sans prévenir (docs.mistral.ai/inference/model-lifecycle).
- **Débit** : en mode gratuit, 100 000 tokens par minute pour l'organisation, et une fiche
  d'exercice en prend environ 78 000. Sur un 429, lire les en-têtes `x-ratelimit-*` : un plafond
  à 0 veut dire « modèle hors offre », pas « quota épuisé ».

## Appeler l'API

- Le client se crée à la racine de composition (`src/main.ts`) et se
  passe en paramètre : `createAi`
  (`src/platform/ai/client.ts`) pour `generateText` et `generateStructured`, `createModeration`
  (`src/platform/ai/moderation.ts`). Jamais un SDK appelé depuis un service, jamais
  l'environnement lu ailleurs : la clé est toujours passée, même vide, sans quoi les SDK liraient
  `MISTRAL_API_KEY` eux-mêmes.
- Réglages Mistral uniquement via `providerOptions.mistral` (`promptCacheKey`,
  `reasoningEffort`, `strictJsonSchema`) — pas de wrapper `fetch`.
- `reasoningEffort` n'accepte que `'none' | 'high'` dans `@ai-sdk/mistral`, et n'est
  envoyé que pour les IDs de sa liste interne : vérifier qu'un nouveau modèle y figure.
- Pas de `safePrompt` : déprécié par Mistral. Ce qui atteint l'élève passe par la modération ; le
  résumé de séance, jamais montré, non.
- Tests : `fakeMistral()` (`src/testing/mistral.ts`), un vrai serveur qui répond comme Mistral ;
  chaque test met en file les réponses qu'il attend.

## Coût

Chaque appel facturé de `createAi` écrit son coût dans `ai_cost`, en micro-euros, au nom de
l'élève (`owner`, `null` hors d'un élève : rien n'est écrit), une réponse hors schéma comprise.
La modération, gratuite, n'est pas tracée. Un appel qui ne passera pas par `createAi` (la voix)
devra écrire son coût lui aussi : jamais un appel facturé hors du quota.

- **Tarif** : `PRICES_USD` (`src/platform/ai/cost.ts`), prix publics en dollars par ID daté. Tokens
  en cache à 10 % du prix d'entrée, endpoint UE +10 %, conversion au taux que Mistral facture
  (`MISTRAL_USD_TO_EUR`). Un modèle sans prix fait échouer `createAi`, donc le démarrage :
  l'ajouter à la table.
- **Quota** : 2 c par élève et par jour pour tous tant que le paiement n'existe pas, puis 2 c en
  Gratuit et 10 c en Complet, voix comprise, remise à zéro
  à 4 h à Paris (`src/domain/quota.ts`, `docs/etudes/2026-10-07/rentabilite.md`), vérifié à
  l'ouverture de chaque tour sur la somme d'`ai_cost`, un tour à la fois par élève. Un appel
  facturé d'un tour compte tout seul ; une route qui appellera Mistral hors d'un tour (la voix)
  vérifiera le quota à son entrée.
- **Réduire le coût** : cache de prompt, clé = ID de session pour le chat, ID de workflow
  versionné pour les tâches templatées, contenu stable en tête du prompt ;
  `maxOutputTokens` fixé par tâche à l'appel, sauf sur un appel qui raisonne (la borne est alors
  le timeout).
- **Endpoint UE** : Batch, Agents et Files n'y sont pas servis : on ne les utilise pas.

Coûts mesurés : `docs/etudes/2026-10-06/passage-de-fin.md` ; quotas et prix :
`docs/etudes/2026-10-07/rentabilite.md`.

## Sources

[Regional inference](https://docs.mistral.ai/inference/regional-inference) ·
[Prompt caching](https://docs.mistral.ai/studio/conversations/advanced/prompt-caching) ·
[Reasoning](https://docs.mistral.ai/studio/conversations/reasoning) ·
[Small 4](https://docs.mistral.ai/models/mistral-small-4-0-26-03) ·
[Known limitations](https://docs.mistral.ai/resources/known-limitations)
