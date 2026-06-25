# Design — Test e2e RAG + Mistral via le backend (léger)

Date : 2026-06-25
Statut : approuvé (version légère)
Scope : `apps/server` — `src/live/chat-rag.test.ts`. Pronote hors sujet.

## Besoin

Un test **simple et rapide** qui exerce le RAG **via le backend** et vérifie
**les réponses de Mistral** — pas une eval lourde (pas de golden set étendu, pas
de seuils, pas de multi-trial).

## Problème avec l'existant

`src/live/chat-rag.test.ts` enchaîne RAG → Mistral **à la main** (system prompt
ad hoc + `generateText`). Ce n'est pas le flux produit : en prod, Mistral
**décide** d'appeler le tool `search_educational_content` dans la boucle
agentique. Un RAG non déclenché passerait inaperçu.

## Design

Faire évoluer `chat-rag.test.ts` pour passer par le **vrai flux backend** :
`mistralChatService.generateStreamChunks(params)`.

- **1-2 questions de cours** (niveau/matière indexés, ex. périmètre du cercle).
- Pour chaque : consommer le générateur, accumuler `content`, capter `done`.
- **Assertions simples** (par question, pas de taux) :
  - `done.metadata.usedRAG === true` → Mistral a déclenché le RAG.
  - la réponse finale contient un mot-clé attendu (`toLowerCase`, non-LLM).
- **Pas de DB** (audit RGPD fire-and-forget, try/catch interne).
- **Fail-closed** via `src/live/_creds.ts` (Mistral + Qdrant + ai-service joignables).
- Reste en **`test:live`** (local-only, hors gate CI).

`params` minimal : `userId`/`sessionId` factices, `userRole: 'student'`,
`schoolLevel`, `subject`, `content`, `conversationHistory: []`.

## Definition of Done

- [ ] `chat-rag.test.ts` passe par `generateStreamChunks` (1-2 questions).
- [ ] Assert `usedRAG` + mot-clé attendu.
- [ ] `bun test src/live/chat-rag.test.ts` vert (preuve : sortie + exit 0).
- [ ] `bun run typecheck && bun run lint` verts.

## Hors scope

Golden set étendu, seuils/taux, multi-trial `pass^k`, vérif des args du tool
(non exposés par l'API publique), gate CI, LLM-as-judge. Documentés au cas où le
besoin grandit, non implémentés.
