# Design — Test e2e RAG + Mistral via le backend (léger)

Date : 2026-06-25
Statut : implémenté
Scope : `apps/server` — `src/live/chat-rag.test.ts`. Pronote hors sujet.

## Besoin

Un test **simple et rapide** qui exerce le RAG **via le backend** et vérifie
**les réponses de Mistral** — pas une eval lourde (pas de golden set étendu).
Il doit prouver que la décision « RAG ou pas » est **prise par l'agent**
(non hardcodée) et **stable**.

## Problème avec l'existant

`src/live/chat-rag.test.ts` enchaînait RAG → Mistral **à la main** (`generateText`
+ system prompt ad hoc). Ce n'est pas le flux produit : en prod, Mistral
**décide** d'appeler le tool `search_educational_content` dans la boucle
agentique. Un RAG non déclenché passerait inaperçu (« corrupt success »).

## Décision agentique : non hardcodée, fiabilisée par policy

- **Aucun forçage en code** : `mistralChatService.generateStreamChunks` passe
  `tools: agentTools` ; Mistral émet (ou non) le `tool_call`. `metadata.usedRAG`
  n'est qu'un reflet (`toolsUsed.includes('search_educational_content')`).
  Grep `tool_choice/required/forced` = vide.
- **Fiabilité via le system prompt**, pas un `if` : `config/prompts/core/rag-policy.ts`
  impose « pour TOUTE question scolaire, appelle search_educational_content
  avant de répondre ». L'agent applique cette policy → déclenchement stable sur
  le cours, abstention sur le non-scolaire (distinction faite par l'agent).

## Design

`chat-rag.test.ts` passe par le **vrai flux backend** `generateStreamChunks` et
valide la décision dans les **deux sens**, en **multi-essais à seuil** (pass^k)
pour rester stable malgré la nature stochastique du modèle :

- **Cas cours** (`périmètre d'un cercle`, sixieme/mathematiques) : sur `TRIALS=3`
  essais, `usedRAG` déclenché ≥ 2/3, et chaque essai déclenché répond ancré
  (regex non-LLM, déterministe).
- **Cas chitchat** (`Salut, ça va ?`) : sur 3 essais, RAG déclenché **0/3**
  (anti sur-déclenchement), réponse non vide.
- **Pas de DB** (audit RGPD fire-and-forget, try/catch interne).
- **Fail-closed** via `src/live/_creds.ts`. Reste en **`test:live`** (hors CI).

`params` minimal : `userId`/`sessionId` factices, `userRole: 'student'`,
`schoolLevel`, `subject` (cours uniquement), `content`, `conversationHistory: []`.

## Definition of Done

- [x] `chat-rag.test.ts` passe par `generateStreamChunks` (vrai flux agentique).
- [x] Décision testée dans les deux sens, en multi-essais à seuil.
- [x] `bun test src/live/chat-rag.test.ts` vert (3 pass, ~25 s).
- [x] `bun run typecheck && bun run lint` verts.

## Hors scope

Golden set étendu, vérif des args du tool (non exposés par l'API publique),
gate CI (appels Mistral payants), LLM-as-judge (non déterministe → eval offline,
pas test gate). Documentés au cas où le besoin grandit, non implémentés.
