# Design — Vrai test e2e RAG + Mistral (flux agentique produit)

Date : 2026-06-25
Statut : en revue
Scope : `apps/server` — tests `live` uniquement. Pronote hors sujet.

## 1. Problème

Le pipeline RAG + Mistral est aujourd'hui couvert par deux tests `live`
(`bun run test:live`, local-only, fail-closed) :

- `src/live/rag.test.ts` — retrieval seul sur le golden set du curriculum
  (recall@k, métriques non-LLM, seuils). Solide.
- `src/live/chat-rag.test.ts` — enchaîne **à la main** RAG → Mistral : le test
  récupère le contexte lui-même, le colle dans un system prompt ad hoc, puis
  appelle `generateText`.

Le second ne teste donc **pas le flux produit** : en prod, c'est Mistral qui
**décide** d'appeler le tool `search_educational_content` dans la boucle
agentique (`mistralChatService.generateStreamChunks`), avec le system prompt de
prod (`buildSystemPrompt` → rag-policy). Un RAG cassé (tool jamais déclenché,
mauvais arguments) passerait inaperçu : Mistral répondrait « de mémoire » et
l'assertion de texte resterait verte. C'est le **« corrupt success »**.

## 2. Objectif / non-objectifs

**Objectif** : un test e2e qui exerce le **vrai flux agentique** et prouve, sur
un petit golden set, que (a) Mistral **déclenche** le RAG dans le flux produit
et (b) sa réponse finale est **ancrée** sur le curriculum récupéré.

**Non-objectifs** :
- Pas de couverture HTTP/auth/SSE (orchestration complète, endpoint) — autre
  niveau, déjà couvert ailleurs ; dilue le signal RAG.
- Pas de persistence DB exercée (session, messages, cost, quota).
- Pas de LLM-as-judge dans l'assertion (non déterministe → inadapté à un test).
- Pas d'intégration en gate CI (reste `test:live`, appels Mistral payants).

## 3. État de l'art (justification)

Consensus 2025-2026 sur l'éval d'agents IA :

- **3 niveaux** : final response (black-box), **trajectory** (glass-box : quel
  tool, quels args), single step (white-box). S'arrêter à l'output laisse passer
  le « corrupt success ». ([Confident AI](https://www.confident-ai.com/blog/llm-agent-evaluation-complete-guide), [MLflow](https://mlflow.org/llm-evaluation))
- **Non-déterminisme → multi-essais** : ne jamais conclure sur un seul run ;
  mesurer un **taux** (cf. métrique `pass^k` de tau-bench).
- **RAG déterministe** ([RAGAS](https://docs.ragas.io)) : faithfulness/groundedness via LLM-judge =
  non déterministe → pour un test reproductible, utiliser **références
  ground-truth + métriques non-LLM** (présence de mots-clés, recall@k).

Le présent design applique : niveau **trajectory** (`usedRAG`) + niveau **final
response ancré** (mots-clés gold, non-LLM), mesurés en **taux** sur un set.

## 4. Design

### 4.1 Point d'entrée

`mistralChatService.generateStreamChunks(params: StreamGenerationParams)`.
C'est le seul niveau qui (1) construit le system prompt de prod, (2) laisse
Mistral décider du tool, (3) expose la trajectoire dans le chunk `done` :

```
done.metadata = { sessionId, usedRAG: boolean, toolsUsed: string[], toolCallsCount, speakable }
```

`params` minimal (le reste optionnel / null) :

```ts
{
  userId: 'e2e-rag',            // factice — l'audit RGPD est fire-and-forget (try/catch interne)
  sessionId: 'e2e-rag-session', // factice
  userRole: 'student',
  schoolLevel: <niveau du golden>,
  subject: <matiere du golden>, // aide Mistral à cadrer la matière du tool-call
  content: <query du golden>,
  conversationHistory: [],
}
```

**Aucune DB seedée requise** : `retrievalAuditRepository.log()` catche ses
erreurs en interne (WARN, non bloquant) — vérifié `retrieval-audit.repository.ts:44-64`.

### 4.2 Golden set

Réutiliser `apps/curriculum/data/golden/questions.json` (déjà chargé par
`rag.test.ts`) : `{ query, matiere, niveau, expected_keywords, gold_chunk_id }`.

Sélection, comme `rag.test.ts` : ne garder que les questions dont
`(niveau, matiere)` sont réellement présents dans la collection Qdrant
(`qdrantService.getStats()`), puis prendre un **petit échantillon déterministe**
(cible : 5 questions, réparties par pas fixe sur le set couvert — pas de
`Math.random`). Chaque question = un appel complet à `generateStreamChunks`.

### 4.3 Assertions (mini-eval à seuil)

Pour chaque question, consommer le générateur, accumuler les chunks `content`
(→ réponse finale) et capturer le chunk `done` :

1. **Trajectoire** : `done.metadata.usedRAG === true` ET
   `toolsUsed.includes('search_educational_content')`.
2. **Ancrage** (non-LLM, déterministe) : la réponse finale contient au moins un
   des `expected_keywords` (comparaison `toLowerCase`).

Agrégation en **taux** sur le set (n ≈ 5) :

- `ragTriggerRate = #(usedRAG) / n` → **seuil ≥ 0.8**.
- `groundingRate = #(grounded parmi ceux qui ont déclenché le RAG) / #(usedRAG)`
  → **seuil ≥ 0.8**.

Logger une ligne récap (comme `[rag.golden]`) :
`[chat.agent] n=5 ragTriggerRate=… groundingRate=… toolCallsAvg=…`.

Garde fail-closed : un `it(...)` initial asserte `HAS_MISTRAL && ragReachable()`
(réutilise `src/live/_creds.ts`) — pas de skip silencieux.

### 4.4 Emplacement

Faire évoluer **`src/live/chat-rag.test.ts`** : remplacer l'enchaînement manuel
par le vrai flux agentique (le but du chantier le rend redondant). Conserver un
unique cas « ancrage pur » (contexte fourni → `generateText` ancré) seulement
s'il apporte un signal distinct ; sinon le supprimer (YAGNI). Décision à
trancher à la revue.

## 5. Gestion du non-déterminisme

- Température fixée à 0.6 dans le service (non surchargeable sans toucher la
  prod — on ne le fait pas). On compose avec la variance via **plusieurs
  questions + seuils tolérants** (proxy économe du `pass^k`), plutôt que de
  répéter k fois la même question (coût Mistral ×k).
- Questions « de cours » non ambiguës pour maximiser le déclenchement du tool ;
  on ne force JAMAIS via `intentReinforcement` (ce serait tricher sur la
  décision qu'on veut justement tester).
- Statut `test:live` (hors gate déterministe) : une variance occasionnelle est
  acceptable ; les seuils ne sont pas à 1.0.

## 6. Dépendances & exécution

- Services réels : Mistral (`MISTRAL_API_KEY`), Qdrant Cloud (`QDRANT_URL`,
  `QDRANT_API_KEY`), ai-service (`AI_SERVICE_URL`). Tous déjà prouvés verts.
- Coût : ~5 questions × ~2 appels Mistral medium (décision + réponse), ≤1024
  tokens/appel → négligeable.
- Temps cible < 180 s (timeout du `it`).
- Lancement : `bun run test:live` (inclut Pronote) ou ciblé
  `bun test src/live/chat-rag.test.ts` (hors Pronote).

## 7. Definition of Done

- [ ] `chat-rag.test.ts` exerce `generateStreamChunks` (vrai flux agentique).
- [ ] Assert trajectoire (`usedRAG`) + ancrage (mots-clés gold), en taux à seuil.
- [ ] Fail-closed via `_creds.ts`, aucun skip silencieux.
- [ ] Récap loggé (`[chat.agent] …`).
- [ ] `bun test src/live/chat-rag.test.ts` vert localement (preuve : sortie + exit 0).
- [ ] `bun run typecheck && bun run lint` verts.

## 8. Hors scope / extensions futures

- **Assertion sur les arguments du tool-call** (niveau/matière exacts) : non
  exposés par l'API publique de `generateStreamChunks` (seuls les *noms* de
  tools le sont). L'ancrage sert de proxy. Exposer `metadata.toolCalls` avec
  args serait une instrumentation produit séparée — non justifiée ici.
- Multi-trial `pass^k` strict (k répétitions/question).
- Gate CI (nécessiterait secrets + budget Mistral + tolérance flakiness).
- LLM-as-judge pour la pertinence pédagogique (eval offline, pas test gate).

## 9. Risques

- **Flakiness** : si Mistral ne déclenche pas le tool sur une question « simple »
  → mitigé par seuil 0.8 + questions de cours ciblées. Si récurrent : resserrer
  la sélection de questions, pas baisser le seuil sous 0.8 sans raison.
- **Dérive du golden set ↔ collection** : déjà géré par le filtrage
  `(niveau, matiere)` présents dans `getStats()`.
