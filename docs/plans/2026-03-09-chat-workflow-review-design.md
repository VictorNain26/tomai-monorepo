# Chat Workflow Review — Design Document

## Objectif

Revue exhaustive du workflow chat server + mobile : refactor, fiabilite, features incompletes.

## Phase 1 — Refactor controller monolithique (Server)

**Fichiers concernes :** `chat-message.routes.ts`

1. Extraire `ChatOrchestrationService` — pipeline complet (context assembly, streaming, post-processing)
2. Route reduite a validation + appel orchestrateur (~50 lignes)
3. Middleware Elysia dedie pour quota/concurrence

## Phase 2 — Fiabilite du streaming (Server + Mobile)

**Fichiers concernes :** `chat-message.routes.ts`, `gemini-chat.service.ts`, `summarization.service.ts`, `useStreamManager.ts`

1. Detection messages orphelins (dernier msg = user sans reponse) + retry UX
2. Summarization avec retry (max 2) + log d'echec persiste
3. Heartbeat-aware timeout mobile (chunks `status` reset le timer)
4. Retry simple (1 tentative) sur tool calls reseau (RAG, Pronote)

## Phase 3 — Gestion de sessions (Server + Mobile)

**Fichiers concernes :** `chat-session.service.ts`, nouveau ecran mobile

1. Endpoint liste sessions avec pagination + metadata (dernier message, date, sujet)
2. Ecran historique sessions cote mobile
3. Switch entre sessions (navigation)
4. Archivage/suppression de sessions

## Phase 4 — Offline & sync (Mobile)

**Fichiers concernes :** `db/schema.ts`, `useChat.ts`, nouveau `useSyncService.ts`

1. Brancher schema SQLite existant sur useChat
2. Queue messages offline (pendingActions table)
3. Sync au retour connexion (reconciliation)
4. Indicateur visuel online/offline

## Phase 5 — Optimisation du contexte AI (Server)

**Fichiers concernes :** `gemini-chat.service.ts`, `system-prompt.ts`, `tool-declarations.ts`

1. Audit system prompt (taille, pertinence, sections inutiles)
2. Token counting reel vs heuristique dans `optimizeConversationHistory`
3. Seuil adaptatif SummaryBuffer (selon taille contexte restant)
4. Audit tool declarations (descriptions trop verbeuses)

## Phase 6 — UX streaming (Mobile)

**Fichiers concernes :** `ChatMessage.tsx`, `ChatInput.tsx`, `useStreamManager.ts`

1. Status granulaire ("Recherche dans les programmes...", "Creation de flashcards...")
2. Scroll-to-bottom intelligent (pas si user scroll up)
3. Skeleton message pendant loading initial
4. Animations de transition (thinking -> streaming -> done)

## Phase 7 — Error handling coherent (Server + Mobile)

**Fichiers concernes :** tous les services + composants

1. Mapping erreurs unifie server -> client (codes + messages FR)
2. Banniere erreur contextuelle (quota, reseau, AI) + action adaptee
3. Logging structure avec correlation ID par requete
4. Metriques : response time, token usage, tool call success rate

## Ordre d'execution

Phase 1 → 2 → 3 → 4 → 5 → 6 → 7 (chaque phase depend de la precedente pour la stabilite)
