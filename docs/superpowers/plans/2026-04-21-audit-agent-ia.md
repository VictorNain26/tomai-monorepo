# Audit complet — Agent IA Tom (avril 2026)

**Date** : 2026-04-21
**Auteur** : Claude (Opus 4.7)
**Périmètre** : Tout l'agent IA du serveur + outils périphériques (chat, RAG, learning, document, STT/TTS, quotas, observabilité, guardrails)
**Méthode** : Lecture exhaustive du code (`apps/server/src/services/**`, `routes/**`, `config/**`) + recherche état de l'art avril 2026 (modèles, frameworks, patterns agent, évals, sécurité mineurs)

---

## 0. TL;DR — ce qu'il faut savoir en 5 minutes

### Verdict global
L'architecture actuelle est **saine dans ses fondations** (séparation services/routes/repositories, orchestration claire, streaming SSE correct, multi-tenancy sûr). En revanche, la couche IA souffre de **5 problèmes structurels** qui empêchent une montée en qualité :

1. **Un seul modèle pour tous les usages** (chat, résumé, titre, flashcards, analyse de documents) — aucun routing coût/qualité.
2. **Pas de vraie mémoire long-terme** du profil élève (le `cognitive-profile` est lu mais jamais écrit par l'agent).
3. **Safety settings Gemini configurés mais jamais passés à l'API** — risque critique pour une plateforme CP-Terminale.
4. **Quotas désactivés par défaut en production** (`QUOTA_ENFORCEMENT_ENABLED=false`).
5. **Aucune observabilité IA** (pas de traces, pas de métriques de qualité pédagogique, pas de tracking de coûts, pas d'évals).

### Stack recommandée (objectif Q3 2026)

| Domaine | Actuel | Recommandé | Rationale |
|---|---|---|---|
| Chat principal | `gemini-3-flash-preview` (instable, preview) | **Gemini 3 Flash** (GA) avec routing vers **Claude Sonnet 4.6** pour tours socratiques complexes | Meilleur rapport qualité/prix multimodal + calibration socratique Claude supérieure |
| Modèle "helper" (résumé, titre, extraction profil) | même Gemini 3 Flash | **Gemini 3 Flash** en mode `thinkingBudget: 0` OU **Claude Haiku 4.5** | 5× moins cher, qualité suffisante |
| Embeddings | Mistral Embed 1024D | **Rester Mistral** (souveraineté + coût), benchmarker voyage-3-large Q3 | Coût +0,10$/M, FR natif, déjà wiré, gain <5% non prouvé sur votre corpus |
| Reranking | BM25 (RRF) | **Cohere Rerank 3.5** en stage 2 (après BM25+RRF) | +8 à 12 pts nDCG sur contenu FR multilingue |
| STT | Gladia | **Rester Gladia** (EU, RGPD, WER FR correct) | Pilote `gpt-realtime` si mode voix bidirectionnel souhaité |
| TTS | ElevenLabs Flash v2.5 | **ElevenLabs v3** + voix personnalisées enfants | Émotion / tags prosodiques, meilleure tenue d'attention |
| Framework agent | Hand-rolled (orchestration maison) | **Garder** (Vercel AI SDK optionnel si migration) | Mastra tentant mais gain abstraction < coût migration |
| Mémoire élève | Tool read-only vide | **Postgres + pgvector** (déjà installé) avec dual-write extraction fin de session | Pas besoin de Mem0/Zep, vous avez déjà l'infra |
| Observabilité | Logs Pino | **Langfuse self-hosted (EU)** + eval suite maison | Gratuit, open-source, souverain, trace LLM native |
| Évals | Inexistant | Suite `LLM-as-judge` avec 50 personas + 200 scénarios | Base pour détecter régressions prompt/modèle |
| Guardrails | `safetySettings: 'medium'` non appliqué | Safety settings Google **+** classifier intent **+** answer-leak detector **+** hint budget | Obligatoire CP-Terminale + RGPD-K |

### Top 5 fixes à faire cette semaine

1. **F-1** Passer de `gemini-3-flash-preview` à un modèle stable (`gemini-2.5-flash` comme fallback sûr) ou valider que votre `GEMINI_MODEL` env var pointe bien sur un ID GA en production.
2. **F-5** Appliquer `appConfig.ai.gemini.safetySettings` à l'appel `ai.chats.create` — actuellement non passé à l'API.
3. **F-3** Activer `QUOTA_ENFORCEMENT_ENABLED=true` ou flipper le défaut.
4. **F-2** Retirer le `matiere: 'mathematiques'` hardcodé dans `document-analysis.service.ts:232`.
5. **F-7** Wrapper `sendMessageStream` dans un `withTimeout(90s)` pour éviter les SSE fantômes.

---

## 1. État actuel — cartographie fidèle

### 1.1 Stack IA en place

```
┌──────────────────────────────────────────────────────────────────────┐
│ Mobile / Landing  ──►  POST /api/chat/stream (SSE)                   │
└───────────────────────────────┬──────────────────────────────────────┘
                                │
                                ▼
┌───────────────────────────────────────────────────────────────┐
│  chat-message.routes.ts                                        │
│  • requireAuth → tokenQuotaService.checkQuota                  │
│  • sanitizePrompt (C0/C1/null bytes)                           │
│  • activeSSEConnections guard (max 2/user, in-process Map)     │
└───────────────────────────────┬───────────────────────────────┘
                                │
                                ▼
┌───────────────────────────────────────────────────────────────┐
│  chat-orchestration.service.ts  (composition root)             │
│                                                                 │
│  Phase 1  resolveSession (ownership check)                      │
│  Phase 2  Promise.all([                                         │
│            fileContextService.prepareFileContext,               │
│            fileContextService.prepareMultimodalFiles,           │
│            cognitiveProfileService.getProfileSummary,           │
│            getLearningContext  ← raw SQL (helper)               │
│          ])                                                     │
│  Phase 3  chatService.saveMessage(user)                         │
│  Phase 4  geminiChatService.generateStreamChunks (AGENTIC LOOP) │
│  Phase 5  postProcess (saveMessage + incrementTokens            │
│                         + summarize + auto-title)               │
└───────────────────────────────┬───────────────────────────────┘
                                │
                                ▼
┌───────────────────────────────────────────────────────────────┐
│  gemini-chat.service.ts  (loop, max 5 iterations)              │
│  • ai.chats.create({ model, tools, thinkingConfig, history })  │
│  • for await chunk:                                             │
│      if functionCalls → pendingCalls[]                          │
│      if text         → yield 'content'                          │
│  • if pendingCalls: Promise.all(executeTool) → functionResponse│
│  • yield 'done' (usage)                                         │
└────────────────────┬──────────────────────────────────────────┘
                     │
    ┌────────────────┼────────────────────────────────────────┐
    ▼                ▼                                         ▼
┌─────────────┐ ┌──────────────────────┐ ┌─────────────────────────┐
│ 4 outils :  │ │ RAG                  │ │ Learning                │
│ - search_   │ │ rag.service          │ │ learningService         │
│   education │ │  + BM25 (RRF)        │ │  + card-generator       │
│ - generate_ │ │  + Qdrant            │ │  + FSRS-4.5             │
│   flashcards│ │  + Mistral Embed     │ │                         │
│ - get_profile│ │                      │ │                         │
│ - get_help  │ │                      │ │                         │
└─────────────┘ └──────────────────────┘ └─────────────────────────┘
```

### 1.2 Modèles utilisés

**Un seul modèle partout** (`appConfig.ai.gemini.model`, par défaut `gemini-3-flash-preview`) pour :
- Chat principal (`gemini-chat.service.ts`)
- Résumé de conversation (`summarization.service.ts`, T=0.3)
- Titre auto (`auto-title.service.ts`, T=0.3)
- Génération flashcards (`card-generator.service.ts`, T=0.7, topK=40, topP=0.95)
- Analyse de documents (`document-analysis.service.ts`)

**Mistral Embed** (1024D, hardcodé) pour tous les embeddings.
**Gladia Solaria** pour STT, **ElevenLabs** pour TTS.

**5 instances distinctes de `GoogleGenAI`** sont créées (chat, summarization, auto-title, card-generator module-level, document analysis). Aucun client partagé.

### 1.3 Outils exposés à l'agent (`tool-declarations.ts`)

| Outil | Description | Qualité |
|---|---|---|
| `search_educational_content` | Recherche Qdrant avec filtres niveau/matière | Bon — mais la doc dit "sans citer Éduscol" (choix pédagogique discutable) |
| `generate_flashcards` | Crée un deck de 5-10 cartes | Bon — mais pas de validation `topic` non vide |
| `get_student_profile` | Lit le profil cognitif | **Problème** : lecture seule, aucun tool d'écriture |
| `get_app_help` | Aide application (KB statique) | OK |

---

## 2. État de l'art avril 2026 — ce qui a changé

### 2.1 Paysage modèles (synthèse, avril 2026)

| Modèle | Input $/M | Output $/M | Cache | Contexte | Thinking | Multimodal | Note pour Tom |
|---|---|---|---|---|---|---|---|
| **Claude Opus 4.7** | 5 | 25 | 0,50 | 200K (1M beta) | Oui | Texte, image, PDF | Trop cher comme default; utile en "judge" pour évals |
| **Claude Sonnet 4.6** | 3 | 15 | 0,30 | 200K + 1M | Oui | Texte, image, PDF | ★ Routing pour tours socratiques complexes |
| **Claude Haiku 4.5** | ~1 | ~5 | 90% savings | 200K | Limité | Texte, image | Alternative au "helper" Gemini si migration multi-modèle |
| **Gemini 3.1 Pro** | ~2 | ~12 (>200K: 2×) | 90% | 1M | Deep Think | Texte/image/audio/vidéo/PDF | Overkill pour chat K-12 ; utile analyse documents complexes |
| **Gemini 3 Flash** (GA) | ~0,30 | ~2,50 | 90% implicite | 1M | Oui | Full multimodal | ★ **Default chat** (upgrade strict depuis 2.5 Flash) |
| **Gemini 2.5 Flash** | 0,30 | 2,50 | 90% implicite | 1M | Budget configurable | Full multimodal | Fallback sûr si 3 Flash pose souci |
| **GPT-5.4** | ~1,25 | ~10 | 90% | 400K | Intégré | Texte, image, audio | 96,7% τ2-bench tool calling ; envisageable si lock-in OpenAI |
| **GPT-5.4 mini** | ~0,25 | ~2 | 90% | 400K | Oui | Texte, image | Alternative helper model |
| **Mistral Large 3** | 2 | 6 | — | 256K | Oui | Texte, image | Fallback EU souverain |
| **Mistral Medium 3** | 0,40–1 | 2–3 | — | 128K | Oui | Texte, image | Bon rapport qualité/prix FR natif |
| **DeepSeek V4** | ~0,14 | ~0,28 | — | 1M | V4-Thinking | Texte, image, vidéo | Pas recommandé (hosting Chine = RGPD incompatible) |

**Observations clés** :
- Sur les benchs frontier (MMLU-Pro, GPQA), l'écart entre Opus 4.7 / GPT-5.4 / Gemini 3.1 Pro est <1 point → le modèle "le plus intelligent" n'est plus un différenciateur.
- Le vrai levier est le **tool calling** (GPT-5.4 leader τ2-bench 96,7%) et la **calibration pédagogique** (Claude Sonnet 4.6 a le meilleur "self-verification" d'après les benchmarks cités).
- **Le cache de prompt est devenu critique** : hit rate >80% = division des coûts par 4-5× sur un tuteur.
- **Gemini 3 Flash ≈ Gemini 2.5 Flash au même prix** avec raisonnement et contexte améliorés → upgrade gratuit.

### 2.2 Embeddings — état avril 2026

| Modèle | Dim | $/M | FR/multilingue | Notes |
|---|---|---|---|---|
| **voyage-3-large** | 1024 (Matryoshka) | 0,18 | 26 langues | SOTA retrieval, int8/binary quant |
| **Cohere embed-v4** | 1024 | ~0,12 | 100+ langues | MTEB 66,3 |
| **Gemini Embedding 001** | 3072 | 0,15 | Fort multilingue | Text only |
| **Gemini Embedding 2 Preview** | — | 0,20 | Multimodal | ★ unique embedding multimodal unifié (devoirs scannés) |
| **Mistral Embed v2** | 1024 | 0,10 | FR natif | Actuel. Matryoshka-native v2 (Jan 2026) |
| **BGE-M3** | 1024 | Self-host | 100+ langues | Option open-source |

**Recommandation** : garder Mistral Embed v2 (coût, souveraineté FR, déjà câblé). Benchmarker voyage-3-large sur votre corpus Eduscol **avant** toute migration — le gain annoncé (+9,74% vs OpenAI-v3-large) n'est pas universel.

### 2.3 RAG — ce qui est devenu standard

- **RAG agentique** : le modèle décide quand/quoi retrieve (vous le faites déjà via tool).
- **Hybrid search** : BM25 + dense + RRF + reranker stage 2. Vous avez BM25+dense+RRF, **il vous manque le reranker de 2e étage**.
- **Late chunking** (Jina, Aug 2024, défaut en 2026 dans LlamaIndex/LangChain) : embed le document entier puis slicer → préserve le contexte inter-phrases.
- **Contextual retrieval** (Anthropic Sept 2024) : préfixer chaque chunk d'1-2 phrases de contextualisation avant embedding → **-35% échecs retrieval**.
- **Query rewriting** interne au tool : normaliser les requêtes étudiantes argotiques ("c'est quoi l'addition posée" → "algorithme de l'addition posée CE1").

### 2.4 Mémoire conversationnelle — patterns 2026

| Couche | Scope | Stockage | TTL | Statut Tom |
|---|---|---|---|---|
| Working (turn) | Raisonnement | In-prompt | 1 turn | ✅ OK |
| Session/thread | Session tutorat | Postgres `studySessions` | Heures | ✅ OK avec summary |
| Episodic | Sessions passées | Postgres + pgvector | Mois | ❌ absent |
| **Semantic (profil)** | Faits stables élève | `studentCognitiveProfiles` | Persistant | ⚠️ **lu mais jamais écrit** |
| Procedural | Politiques pédago | System prompt | Persistant | ✅ OK (`src/config/prompts/`) |

**Gap principal** : pas de mémoire épisodique (ce qu'on a fait avec cet élève la semaine dernière) ni d'alimentation automatique du profil sémantique.

**Pattern dual-write 2026** : à la fin de chaque session, un petit modèle (Gemini 3 Flash en `thinkingBudget: 0` ou Haiku 4.5) extrait via JSON schema strict les deltas à appliquer au profil (forces, faiblesses, préférences). Rejeter les deltas conflictuels avec faits existants high-confidence.

### 2.5 Safety pour mineurs — obligations 2026

**RGPD-K / CNIL (France)** :
- Âge de consentement : 15 ans.
- Consentement parental vérifié (pas juste demandé).
- DPIA obligatoire pour systèmes adaptatifs (EU AI Act Annex III : "high-risk").
- **Droit à l'effacement cascade sur le vector store** → tagguer chaque embedding avec `userId`.
- Minimisation : purge automatique raw conversations à 90 jours sauf opt-in parent.
- PII redaction **avant** embedding : ne jamais embed un message contenant nom complet ou adresse.

**Prompt injection** — défenses en couches :
1. **Privilege separation** : agent élève n'a aucun tool qui affecte d'autres users ou effets externes.
2. **Instruction hierarchy** : system > developer > user (explicite dans le prompt).
3. **Délimiteurs structurés** pour le contenu utilisateur (`<student_message>...</student_message>`).
4. **Output filters** : 2e passage modération avant retour client.
5. **Indirect injection via fichiers/Pronote** : traiter tout contenu externe comme hostile.

**Le "lethal trifecta" (Simon Willison)** : un agent devient exploitable quand il a simultanément (a) input non fiable + (b) accès à données sensibles + (c) capacité d'effet externe. **Ne jamais combiner (b) + (c) dans le même agent.** → Splitter en "agent élève" et "agent parent".

**Safety Google** : en tant que plateforme CP-Terminale, passer tous les `HarmBlockThreshold` à `BLOCK_LOW_AND_ABOVE` au minimum, ajouter classifier custom pour catégories métier (demande de solution d'exercice directe).

### 2.6 Tutorat socratique — recherche 2024-2026

- **MathTutorBench (EMNLP 2025)** : bench 3 teacher skills × 7 tasks. Finding marquant : *"subject expertise doesn't immediately translate to good teaching"*. Les modèles fine-tunés plus petits battent souvent GPT-4/Claude bruts sur la pédagogie.
- **SocraticLM** : pipeline "Dean-Teacher-Student", 35K dialogues socratiques.
- **TutorBench (2510.02663)** : capacité holistique de tutorat.
- **Learning Gap (Anthropic × Khan Academy, Oct 2025)** : argument clé — les modèles parametric seuls sous-scaffoldent. **Il faut retrieve des stratégies pédagogiques**, pas seulement du contenu.
- **Khanmigo** (architecture publique) : GPT-5 class au cœur, prompt engineering exercice-specifique, moderator layer qui peut interrompre mid-response pour safety, profil élève léger depuis 2025.

**Implication pour Tom** : un modèle frontier + prompt fort est nécessaire, mais la qualité pédagogique ne vient pas gratuitement de la puissance de raisonnement. Il faut :
- Un schéma de sortie structuré imposant `hint_level`, `pedagogical_intent`, `next_question`.
- Un état machine sur le "ladder d'indices" (ZPD Vygotsky, 6 niveaux).
- Un **answer-leak detector** (2e passage LLM) qui vérifie que la réponse ne contient pas le résultat final.
- Un **hint budget** per exercise, visible dans le contexte.

### 2.7 Évals & observabilité — stack 2026

| Framework | Avantage | Inconvénient | Recommandation Tom |
|---|---|---|---|
| **Langfuse** | OSS, self-host EU, tracing LLM natif | UI eval moins poussée que Braintrust | ★ Primary (GDPR, souverain) |
| Braintrust | Meilleure UX eval + régression testing | SaaS, $ | Optionnel si budget |
| Phoenix (Arize) | OSS, OpenInference | UX eval faible | — |
| Helicone | Proxy léger | Évals minces | — |
| LangSmith | Natif LangChain | Lock-in | Non (pas de LangChain) |

**Pattern LLM-as-judge 2026** :
- **Pairwise > absolu** : juger A/B bien plus fiable que scorer 1-5.
- **Rubrique explicite par dimension** : pédagogie / exactitude / sécurité / lisibilité / non-révélation réponse.
- **Chain-of-thought dans le juge** : raisonner avant scorer.
- **Juge ≠ generator** : utiliser Claude Opus 4.7 pour juger Gemini 3 Flash (et vice-versa) → évite les biais corrélés.
- **Calibration humaine** : ~100 labels humains par dimension, fitter une transformation simple.
- **Position bias** : toujours présenter A/B dans les 2 ordres et moyenner.

---

## 3. Findings critiques — liste priorisée

Issue du deep-dive code. Sévérité : **CRITICAL** = bug actif en prod, **HIGH** = risque élevé, **MEDIUM** = bug latent, **LOW** = dette technique.

### CRITICAL

**F-1** `app.config.ts:231` — `gemini-3-flash-preview` comme défaut.
Ce model ID est experimental/preview. En l'absence de `GEMINI_MODEL` env var, l'appel échoue. **Fix** : défaut `gemini-2.5-flash` (stable GA), override via env vers `gemini-3-flash` une fois GA confirmé.

**F-5** `gemini-chat.service.ts:130-140` — Safety settings non appliqués.
`appConfig.ai.gemini.safetySettings = 'medium'` existe mais n'est jamais passé à `ai.chats.create`. Gemini applique ses settings par défaut (qui peuvent varier). **Critical pour CP-Terminale**. **Fix** : mapper la string vers `HarmBlockThreshold` et passer dans `config.safetySettings`.

### HIGH

**F-2** `document-analysis.service.ts:232` — `matiere: 'mathematiques'` hardcodé dans RAG.
Tous les documents reçoivent du contexte programme math, même un PDF d'histoire. **Fix** : détecter matière via extraction préalable ou omettre le filtre.

**F-3** `quota-config.ts:370` — Quotas désactivés par défaut.
`QUOTA_ENFORCEMENT_ENABLED === 'true'` → false si non défini. Tout utilisateur a quota illimité si env var absente. **Fix** : inverser le défaut.

**F-4** `quota-config.ts:121-125` — Reset quotidien faux en été.
`needsDailyReset` calcule `RESET_HOUR_PARIS - 1` en UTC (correct CET, faux CEST). Utilise pas `getParisHour()` déjà défini. **Fix** : dériver l'offset dynamiquement.

**F-6** `file-multimodal.service.ts:96-98` — `import()` dynamique de Drizzle dans `updateFileAnalysis`.
Overhead module-load à chaque analyse. **Fix** : imports statiques top-level.

**F-7** `gemini-chat.service.ts:130` — Pas de timeout sur `sendMessageStream`.
Avec `MAX_TOOL_ITERATIONS=5` + réseau dégradé, SSE peut hang indéfiniment. **Fix** : `withTimeout(90_000)` par itération.

### MEDIUM

**F-8** `chat-orchestration.service.ts:77` — Seul `attachedFileInfos[0]` persisté dans `messages.attachedFile` pour messages multi-fichiers.

**F-9** `document-analysis.service.ts:119` — RAG image avec query hardcodée `"document scolaire image"` (inutile).

**F-10** `cognitive-profile.service.ts` — Profil cognitif lu via tool mais jamais écrit par l'agent. **Fix** : ajouter tool `update_student_profile` OU pattern dual-write en fin de session.

**F-11** `gladia-transcription.service.ts` — Résultat STT retourné dans HTTP `/api/upload/confirm` mais **jamais persisté**. Perdu au refresh. **Fix** : colonne `files.transcription` ou `educationalContext.transcription`.

**F-12** `memory-cache.service.ts:184-187` — `evictOldest` est FIFO, pas LRU malgré le nom du module. **Fix** : on `get` hit, delete + re-insert pour conserver la sémantique LRU.

**F-13** `token-budget.service.ts` — `calculateBudget()` et `truncateToTokenBudget()` définis mais jamais appelés dans le hot path. **Module mort**. **Fix** : brancher en amont de `generateStreamChunks` OU supprimer.

**F-14** `qdrant-hierarchy.service.ts:44-57` — `getMatieresForNiveau` séquentiel alors que `qdrant.service.ts` est paralélisé. **Fix** : `Promise.all`.

**F-15** `education.service.ts:73-77` — `getAvailableLevels` séquentiel sur 13 niveaux. **Fix** : `Promise.all`.

**F-16** `chat-message.routes.ts:20` — `activeSSEConnections` in-process Map → multi-instance ≠ per-user limit global.

### LOW

**F-17** `text-to-speech.service.ts:118-122` — `synthesizeToWav` retourne MP3 (nom mensonger).

**F-18** 5 `GoogleGenAI` clients non partagés (chat, summarization, auto-title, card-generator, document-analysis).

**F-19** `fsrs.service.ts:192-198` — `getDueCards` charge tout en mémoire puis filtre. **Fix** : WHERE SQL sur `fsrsData->>'due'`.

**F-20** Prompts sans version (summarization, auto-title, document-prompts). Régressions invisibles sans `git blame`. **Fix** : `PROMPT_VERSION` constant + log par appel.

**F-21** (nouveau) `safety.ts` — 0 défense prompt injection. "Ignore previous instructions and..." passe. **Fix** : délimiteurs structurés + instruction hierarchy + output filter.

**F-22** (nouveau) `tool-executor.ts:210-214` — Détection `deck-created` par duck-type `r.deckId && r.generated` fragile. **Fix** : type structurel.

**F-23** (nouveau) Aucun test sur le pipeline IA (chat orchestration, Gemini loop, RAG, card generation, document analysis, summarization, FSRS). Seule couverture : `quota-*.test.ts`.

---

## 4. Architecture cible recommandée

### 4.1 Vue d'ensemble

```
┌─────────────────────────────────────────────────────────────────┐
│ Client                                                           │
│   ├── SSE stream → chat                                          │
│   └── WebSocket (optionnel, phase 2) → mode voix bidirectionnel │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ Router / intent classifier (Gemini Flash, ~50ms)                 │
│  → décide : chat simple | socratique complexe | safety-critical │
└────────────────────────────┬────────────────────────────────────┘
                             │
         ┌───────────────────┼─────────────────────────┐
         ▼                   ▼                         ▼
┌─────────────────┐ ┌─────────────────────┐ ┌──────────────────┐
│ Default          │ │ Complex Socratic    │ │ Safety-sensitive │
│ Gemini 3 Flash   │ │ Claude Sonnet 4.6   │ │ Claude Sonnet    │
│ (~80% traffic)   │ │ (~15%, tours durs)  │ │ (ambigu, signaux │
│                  │ │                     │ │ frustration)     │
└────────┬─────────┘ └──────────┬──────────┘ └────────┬─────────┘
         │                      │                      │
         └──────────────────────┼──────────────────────┘
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│ Orchestration unifiée (AI SDK v5 ou current hand-rolled)         │
│                                                                  │
│  Tools (structurés, type-safe, MCP-ready) :                      │
│   • curriculum.search       (RAG hybride + Cohere Rerank 3.5)    │
│   • curriculum.get_section  (JIT, tool-fetched chunks)           │
│   • profile.get_section     (JIT, pas tout le profil préchargé)  │
│   • profile.update_delta    (dual-write nouvelle)                │
│   • flashcards.generate     (structured output strict)           │
│   • flashcards.suggest      (propose avant de créer, UX)         │
│                                                                  │
│  Output schema imposé par turn :                                 │
│   { pedagogical_intent, hint_level (1-6), next_question,         │
│     content_markdown, confidence }                               │
│                                                                  │
│  Guardrails layer :                                              │
│   • answer_leak_detector (2nd pass, mini model)                  │
│   • readability_check (Kandel-Moles FR, per grade)               │
│   • moderator (intercepts before send)                           │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ Post-processing                                                  │
│  • Save message + tokens (atomic)                                │
│  • Summarize if needed (Gemini Flash thinkingBudget:0, cheap)   │
│  • Profile delta extraction (end of session, dual-write)        │
│  • Auto-title (Haiku 4.5 ou Gemini Flash cheap mode)            │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 Séparation des agents

Respecter le "lethal trifecta" (Willison) :

```
┌────────────────────────┐      ┌──────────────────────────┐
│ Agent élève (Tom)      │      │ Agent parent (dashboard) │
│                        │      │                          │
│ Input : élève          │      │ Input : parent auth      │
│ Data scope :           │      │ Data scope :             │
│  - son profil          │      │  - rapports enfants      │
│  - son historique      │      │  - progressions          │
│  - curriculum public   │      │  - quotas                │
│ Tools sans effet       │      │ Tools read-only pour     │
│  externe (pas d'email, │      │  data sensible           │
│  pas d'écriture tiers) │      │                          │
└────────────────────────┘      └──────────────────────────┘
         ⬆                                ⬆
         │                                │
     isolé par userId/role            isolé par parentId
```

### 4.3 Schéma mémoire élève (Postgres + pgvector, déjà en place)

```typescript
// Table existante : studentCognitiveProfiles — à étendre
interface StudentProfile {
  userId: string
  level: {
    grade: 'CP'|'CE1'|...|'Terminale'
    progression_iso: string    // ex: "2026-T3"
  }
  mastery: Array<{
    concept_id: string
    concept_label: string      // "addition posée"
    mastery_0_1: number
    last_seen_at: Date
    decay_half_life_days: number  // Ebbinghaus-style
  }>
  errors_ledger: Array<{
    concept_id: string
    error_type: string         // "oubli retenue", "confusion *1 +1"
    count: number
    last_example_redacted: string  // PII stripped
  }>
  preferences: {
    language_register: 'tutoiement'|'vouvoiement'
    hint_style: 'directive'|'questioning'|'analogique'
    motivation_style: 'gamifié'|'serious'
  }
  scaffolding: {
    current_zpd_band: 1|2|3|4|5
    preferred_modality: 'texte'|'audio'|'schema'
  }
  affect: {
    frustration_ema: number    // 0-1, rolling exponential
    engagement_ema: number
  }
  updated_at: Date
  version: number             // pour conflict resolution dual-write
}

// Nouvelle table : session_episode (embedding pour rappel épisodique)
interface SessionEpisode {
  id: uuid
  userId: string
  sessionId: string
  concepts_covered: string[]
  summary_text: string         // 500 tokens max
  summary_embedding: vector(1024)  // pgvector
  duration_seconds: number
  outcome: 'completed'|'abandoned'|'succeeded'
  created_at: Date
  ttl_until: Date              // purge 90j si pas opt-in parent
}
```

**Pattern dual-write** à la fin de chaque session :

```typescript
// après postProcess
async extractProfileDelta(sessionId: string) {
  const helperModel = geminiFlash({ thinkingBudget: 0 })
  // ou Claude Haiku 4.5 si migration multi-modèle
  const delta = await helperModel.generateObject({
    schema: ProfileDeltaSchema,
    prompt: buildDeltaExtractionPrompt(sessionTurns)
  })
  await profileService.mergeDelta(userId, delta, {
    conflictPolicy: 'reject_if_high_confidence_exists'
  })
  await episodicService.store(sessionId, summary, embedding)
}
```

### 4.4 RAG cible

```
Query from student
   │
   ▼
[Query rewrite] (LLM mini, optional ; skip si query déjà "propre")
   │
   ▼
[Hybrid retrieval]
   ├── Dense : Mistral Embed → Qdrant top-20
   └── BM25 : in-memory over retrieved
   │
   ▼
[RRF fusion] → top-20
   │
   ▼
[Rerank stage 2] : Cohere Rerank 3.5 → top-5
   │
   ▼
[Build context] : contextual retrieval prefix + chunk + citation ID
   │
   ▼
Agent (ou tool result)
```

**Changements vs actuel** :
- Ajouter Cohere Rerank 3.5 en stage 2 (après BM25+RRF).
- Si re-indexation du corpus Eduscol possible : appliquer **contextual retrieval** (Anthropic Sept 2024) — préfixer chaque chunk de 1-2 phrases contextualisantes avant embedding → -35% échecs.
- Stocker les IDs de citation pour pouvoir afficher "📖 Source : Éduscol programme CM1 §3.2" côté client (transparence scientifique > l'actuel "sans citer").

### 4.5 Guardrails stack

```
┌─ Input guard ──────────────────────────────────┐
│ • sanitizePrompt (déjà en place, bon)          │
│ • Délimiteurs structurés <student_message>     │
│ • Intent classifier : détecte "solve-this"     │
│   → route vers mode socratique dur             │
└────────────────────────────────────────────────┘
              │
              ▼
┌─ Runtime guard ────────────────────────────────┐
│ • Gemini safetySettings = BLOCK_LOW_AND_ABOVE  │
│ • hint_budget dans le contexte (visible)       │
│ • instruction hierarchy explicite              │
└────────────────────────────────────────────────┘
              │
              ▼
┌─ Output guard ─────────────────────────────────┐
│ • answer_leak_detector (2e pass LLM mini)      │
│ • readability_check (Kandel-Moles FR, grade)   │
│ • OpenAI Moderation API ou Gemini safety check │
│ • pattern match final : regex "la réponse est" │
│   combiné avec no student engagement → rewrite │
└────────────────────────────────────────────────┘
```

### 4.6 Observabilité cible

- **Langfuse self-hosted EU** (Scaleway ou Koyeb) : traces LLM, chaînes d'outils, coûts par call.
- **Metrics Prometheus** : hit rate cache, latency p50/p95 TTFT/TTLT, tool success rate per tool, quota utilization per plan, SSE connection count.
- **Cost tracking** : alimenter `cost_tracking` table (actuellement existe mais non utilisé) avec input/output tokens × pricing par modèle.
- **Eval suite** : 50 personas élèves × 200 scénarios curriculum-anchored, LLM-as-judge pairwise, calibré sur 100 labels profs humains.

### 4.7 Streaming UX (améliorations côté serveur)

- **Partial JSON streaming** pour structured outputs (exercices générés) : la lib `partial-json` ou parser tolérant permet de rendre `stem` puis `options[0]` puis `options[1]`... progressivement.
- **Événements typés** : `content`, `status`, `tool_started`, `tool_result_summary`, `deck_created`, `citation`, `done`, `error`. Le client sait quoi afficher (carte outil expandable, bandeau citation, etc.).
- **Résilience reconnexion** : stocker le state de conversation après chaque tool call → reprendre sans rejouer.
- **Cooperative cancellation** : check entre tool calls, pas mid-tool sauf safe.

---

## 5. Roadmap priorisée

Estimations en jours-développeur à temps plein. À ajuster selon votre charge.

### Phase 0 — Fixes critiques (cette semaine, 2-3 j)

Aucun gain fonctionnel — réduction de risque.

1. **F-1** Passer `GEMINI_MODEL` prod → `gemini-2.5-flash` ou vérifier pointeur stable. `gemini-3-flash-preview` comme fallback n'est pas safe.
2. **F-5** Appliquer `safetySettings` à `ai.chats.create` — mapper enum vers Gemini `HarmBlockThreshold`.
3. **F-3** Flipper `quotaEnforcementEnabled` défaut → `true`.
4. **F-4** Fixer reset Paris pour DST.
5. **F-2** Retirer `matiere: 'mathematiques'` hardcodé.
6. **F-7** `withTimeout(90_000)` sur `sendMessageStream`.
7. **F-21** Délimiteurs `<student_message>` + instruction hierarchy dans `safety.ts`.

### Phase 1 — Quality wins (2-3 semaines)

**1.1 Sortie structurée pédagogique** (5 j)
Imposer `responseSchema` à chaque tour agent :
```typescript
{
  pedagogical_intent: 'orienter'|'rappeler'|'décomposer'|'indiquer'|'modéliser'|'révéler',
  hint_level: 1|2|3|4|5|6,    // ZPD Vygotsky
  content_markdown: string,
  next_question: string|null,
  affect_observed: 'engaged'|'neutral'|'frustrated'|null,
  confidence: 0|1|2|3          // auto-estimation
}
```
Le client rend `content_markdown` mais le serveur stocke les autres champs → feed l'eval suite et le profil élève.

**1.2 Answer-leak detector** (3 j)
2e passage Gemini Flash `thinkingBudget: 0` sur la sortie finale : détecte la révélation prématurée de la solution → rewrite en mode socratique.

**1.3 Cohere Rerank 3.5 stage 2** (2 j)
Ajouter un appel Cohere après BM25+RRF. Coût marginal (~0,002 $/req), gain nDCG +8-12 pts sur contenu FR multilingue.

**1.4 Mémoire profil : dual-write extraction** (5 j)
- Ajouter tool `update_student_profile` (agent-initiated).
- Ajouter job fin de session (background) : petit modèle extrait delta JSON → merge avec policy.
- Ajouter `session_episode` table + pgvector index.

**1.5 Prompt caching** (2 j)
- Structure des prompts : [IDENTITÉ ★ CACHED ★ | PROFIL ÉLÈVE ★ CACHED si stable ★ | CURRICULUM RAG CONTEXT | HISTORIQUE | TURN].
- Anthropic `cache_control: ephemeral` sur les blocs immutables.
- Gemini : on a déjà caching implicite, mais forcer un `cachedContents` explicite sur les prompts >1024 tokens stables.
- Target : >80% hit rate sur system prompt. **Impact coût : -40 à -60% sur tokens input.**

**1.6 Supprimer le module mort `token-budget`** (0,5 j)
OU le câbler dans l'orchestration.

### Phase 2 — Observabilité & évals (3-4 semaines)

**2.1 Langfuse self-hosted** (3 j)
- Déployer sur Koyeb ou Scaleway (EU, souverain).
- Instrumenter toutes les calls Gemini / Mistral / Cohere / ElevenLabs / Gladia.
- Tracer conversations end-to-end avec user ID + session ID.

**2.2 Suite d'évals** (10 j)
- Définir 5-10 dimensions (pédagogie, exactitude, non-révélation réponse, adaptation niveau, engagement, lisibilité, sécurité).
- Générer dataset : 50 personas × 200 scénarios curriculum-anchored.
- Implémenter 3 judges LLM (différents du generator) avec rubriques pairwise.
- Calibrer avec 100 labels humains (prof partenaire ou Prolific).
- CI : bloquer merge si régression >5% sur dimension critique.

**2.3 Metrics Prometheus + dashboards Grafana** (3 j)
- Hit rate cache (memory + prompt).
- p50/p95 TTFT / TTLT par endpoint.
- Tool success rate per tool.
- Cost per user per day.
- SSE active connections.

**2.4 Cost tracking** (2 j)
- Alimenter table `cost_tracking` après chaque call avec input/output tokens × pricing.
- Dashboard : coût par utilisateur, par matière, par type de tâche.

### Phase 3 — Modèle multi-provider routing (2-3 semaines)

**3.1 Gemini 2.5 Flash → Gemini 3 Flash (stable GA)** (1 j)
String swap + eval de régression pour valider.

**3.2 Routing conditionnel vers Claude Sonnet 4.6** (5 j)
- Classifier simple (Gemini Flash) qui décide : tour socratique complexe (raisonnement multi-step, frustration détectée, désaccord élève) → Claude Sonnet 4.6.
- Abstraction fournisseur : un adapter `ChatProvider` qui cache Gemini / Claude / GPT.
- Fallback : si Claude indispo → Gemini.

**3.3 Helper model distinct** (3 j)
- Résumé / titre / extraction profil → Gemini Flash `thinkingBudget: 0` OU Claude Haiku 4.5.
- Instancier un seul client Gemini partagé (fix F-18).

### Phase 4 — RAG avancé (2-3 semaines)

**4.1 Contextual retrieval** (5 j)
- Script batch : re-indexer corpus Eduscol avec préfixe contextualisant généré par Gemini Flash.
- Chaque chunk = `"[Contexte: §3.2, addition posée CE1, cycle 2]\n{chunk}"`.
- Re-embed + reupload Qdrant.

**4.2 Query rewriting dans le tool** (2 j)
Interne à `curriculum.search` : normaliser l'argot étudiant vers vocabulaire curriculum.

**4.3 Multimodal embedding pilot** (5 j, optionnel)
- Gemini Embedding 2 Preview sur devoirs scannés.
- POC : photo homework → embed image → retrieve curriculum section.
- Eval vs pipeline OCR+text embed actuel.

### Phase 5 — Tests & hardening (2 semaines)

**5.1 Tests agent pipeline** (8 j)
- Integration tests : chat orchestration (mock Gemini SDK).
- Unit tests : tool executor, summarization, card generator, RAG, safety guards.
- E2E : Maestro tests côté mobile sur parcours socratique.

**5.2 Rate limiting TTS** (1 j)
- Middleware rate limit per-user sur `/api/tts/synthesize`.

**5.3 PII redaction pipeline** (3 j)
- Avant embedding, avant long-term storage : détecter nom/adresse/email via regex + spaCy FR.
- CNIL compliance CP-Terminale.

### Phase 6 — Évolutions 2027 (optionnel, exploratoire)

- Mode voix bidirectionnel (`gpt-realtime` ou Gemini Live) pour drill interactif.
- Fine-tune LoRA d'un petit modèle open-source (Mistral Medium / Qwen 3.5) sur dialogues socratiques FR Eduscol → déployer comme "helper model" ultra-cheap.
- Agents multi-étapes : planner (choisit le parcours) + tutor (exécute) + parent-reporter (synthétise pour parent).
- IRT / Rasch model adaptatif pour calibrage de difficulté (au-delà du 1-5 fixe).

---

## 6. Détail par domaine

### 6.1 Chat orchestration

**Actuel** : `chat-orchestration.service.ts` compose 5 phases (resolve → assemble → persist user msg → stream → postProcess). Phase 2 parallèle via `Promise.all`. Bon.

**Amélioration principale** : le `postProcess` bloque la dernière émission SSE `done`. Le client voit la réponse "finie" après DB write + token increment. Passer les writes non-bloquants en background + yield `done` immédiatement. Attention à ne pas perdre les données si le process crash → utiliser un outbox pattern (write en DB dans transaction, worker pour propager).

### 6.2 Gemini agent loop

**Actuel** : `gemini-chat.service.ts` loop max 5 itérations, `Promise.all` sur tools, bonne gestion d'erreurs.

**Améliorations** :
- Timeout per iteration (F-7).
- Abort signal propagé depuis `AbortController` client → annuler upstream (évite tokens gaspillés si disconnect).
- Structured output enforcement (Phase 1.1).
- Télémétrie per-iteration (nb tool calls, tokens).

### 6.3 Outils

**Actuel** : 4 tools (`search_educational_content`, `generate_flashcards`, `get_student_profile`, `get_app_help`).

**Recommandations** :
1. Splitter `get_student_profile` en `profile.get_section(field: 'mastery'|'errors'|'preferences')` → JIT context, pas tout le profil préchargé.
2. Ajouter `profile.update_delta(field, value, confidence)` → agent peut écrire.
3. Ajouter `curriculum.get_section(id)` après `search` → l'agent peut lire une section complète une fois qu'il a identifié la bonne.
4. Ajouter `exercise.suggest(concept, difficulty)` séparé de `flashcards.generate` → UX : propose puis crée seulement sur confirmation explicite.
5. **Attention** : au-delà de 15 tools, dégradation notable (Berkeley Function Calling Leaderboard). Viser 8-12.
6. Exposer les tools via **MCP** si vous voulez les réutiliser ailleurs (Claude Agent SDK, autres frontends).

### 6.4 Summarization / token budget

**Actuel** : `summarization.service.ts` bien conçu (incrémental, timeout, fail-open). `token-budget.service.ts` défini mais jamais appelé = code mort.

**Recommandations** :
- Utiliser modèle plus cheap pour summarization (Gemini Flash `thinkingBudget: 0` ou Haiku 4.5). Gain : ~5× sur coût résumé.
- Brancher `calculateBudget` / `truncateToTokenBudget` OU supprimer.
- **Two-tier summary** (pattern 2026) : running episodic summary (prose) + structured state (JSON jamais résumé, regénéré chaque turn). Le structured state = `{current_exercise, open_hints, error_ledger_session_scope}`.
- **Pinned prefix** : garder les 1-2 premiers tours verbatim → ancre le ton et le niveau.

### 6.5 File/multimodal

**Actuel** : cache analyse DB-side, Gemini Files API re-upload si URI expirée.

**Recommandations** :
- Fix F-6 (imports dynamiques).
- Fix F-2 (matiere hardcodée).
- Fix F-9 (RAG query image inutile).
- Concurrence contrôlée pour analyse multi-fichiers (p-limit 3).
- Passer à `responseMimeType: 'application/json'` + `responseSchema` strict pour l'analyse → éliminer le regex parse fragile (`document-parsers.ts:11`).

### 6.6 RAG

**Actuel** : Mistral Embed + Qdrant + BM25 + RRF. Cache availability 30s.

**Recommandations** (détail §4.4) :
- Ajouter Cohere Rerank 3.5 stage 2 (gain +8-12 pts nDCG).
- Contextual retrieval sur le corpus (gain -35% échecs).
- Paralléliser hierarchy queries (F-14, F-15).
- Embedding cache (clé = hash query text) → éviter re-embed "pythagore" 100 fois/jour.

### 6.7 Learning (flashcards + FSRS)

**Actuel** : 15 types de cartes, génération Gemini avec schéma simplifié + Zod validation, FSRS-4.5 per-level.

**Recommandations** :
- F-19 : `getDueCards` en SQL (pgvector/jsonb query), pas en mémoire.
- F-22 : typer le résultat `deck-created` structurellement.
- Ajouter eval dédié génération de cartes (qualité pédagogique des distracteurs, difficulté calibrée).
- IRT léger (1-param logistic / Rasch) sur réponses élèves → recalibrage empirique de la difficulté.

### 6.8 Document analysis

**Actuel** : extraction (unpdf/mammoth) + Gemini classification + RAG.

**Recommandations** :
- F-2, F-9 (fix RAG queries).
- `responseSchema` Gemini strict (pas de parsing de markdown fence).
- Chunking sémantique pour longs PDFs (actuellement truncate à 4000 chars).
- Late chunking pour préserver le contexte inter-phrases.

### 6.9 Cognitive profile

**Actuel** : tool read-only, profil jamais alimenté par l'agent.

**Recommandations** (détail §4.3) :
- Tool `profile.update_delta` (agent-initiated).
- Pattern dual-write fin de session (extraction automatique).
- Schéma enrichi : mastery avec decay, errors_ledger, scaffolding, affect.
- Table `session_episode` pour mémoire épisodique (retrieve "ce qu'on a fait la semaine dernière").

### 6.10 STT/TTS

**Actuel** : Gladia (STT, EU), ElevenLabs (TTS).

**Recommandations** :
- F-11 : persister la transcription en DB.
- F-17 : renommer `synthesizeToWav` → `synthesize`.
- ElevenLabs Flash v2.5 → v3 (émotion, tags prosodiques) pour voix enfants personnalisées via Voice Design v3.
- Backoff exponentiel polling Gladia (actuellement 2s fixe).
- Rate limit `/api/tts/synthesize` per-user.
- **Phase 2** (optionnel) : pilot `gpt-realtime` pour mode voix bidirectionnel drill interactif (30-40ms latency) — mais lock-in OpenAI + data sovereignty dégradée → flag optionnel, pas default.

### 6.11 Quotas

**Actuel** : `quotaEnforcementEnabled = false` par défaut, bug DST reset, SELECT+UPDATE non-atomique.

**Recommandations** :
- F-3, F-4 fixes.
- `incrementTokenUsage` en une seule UPDATE atomic (UPSERT avec ON CONFLICT).
- Circuit breaker sur DB error → fail-open documenté en runbook.

### 6.12 Memory cache

**Actuel** : in-process Map avec TTL, FIFO déguisé en LRU.

**Recommandations** :
- F-12 fix (true LRU via delete+re-insert on read).
- Conscientiser le gap multi-instance : si Koyeb scale à 2+ replicas, les caches divergent. Acceptable pour stats Qdrant (reconvergence rapide), problématique pour `getSessionWithSummary` si mis en cache. → Documenter ou passer à Valkey/Redis managed.

### 6.13 Safety / guardrails

**Actuel** : `safety.ts` topic-level, sanitize basique, aucune défense injection.

**Recommandations** (détail §4.5) :
- F-5 : `safetySettings` appliqués.
- F-21 : délimiteurs structurés + instruction hierarchy.
- Answer-leak detector (Phase 1.2).
- Intent classifier (homework-solve).
- Readability check per grade.
- OpenAI Moderation API output pass (free).
- Split agent élève / parent.

### 6.14 Prompts

**Actuel** : modulaires (`src/config/prompts/core/` + `adaptation/`), bien organisés. Mais aucune version, aucun A/B test.

**Recommandations** :
- F-20 : `PROMPT_VERSION` constant, logué à chaque appel.
- Considérer prompt store externe (Langfuse offre cette feature) pour edit sans redeploy.
- Ajouter 2-4 negative examples par prompt tuteur ("voici ce qu'il NE faut PAS faire") → pédagogie (pattern Anthropic Nov 2025).

---

## 7. Recommandation finale — stack cible synthèse

### Stack minimale (ship ce trimestre)

```yaml
chat:
  primary: gemini-3-flash      # ou gemini-2.5-flash stable fallback
  temperature: 0.7
  thinking_budget: low
helpers:
  summarization: gemini-3-flash (thinking_budget: 0)
  auto_title:    gemini-3-flash (thinking_budget: 0)
  card_gen:      gemini-3-flash (T: 0.7)
  doc_analysis:  gemini-3-flash
  # unique GoogleGenAI client partagé

embeddings:
  provider: mistral-embed-v2
  dim: 1024
  matryoshka: enabled (256 coarse / 1024 fine)

rag:
  retrieval: qdrant (dense) + bm25-in-memory
  fusion: rrf
  rerank: cohere-rerank-3.5    # ← NOUVEAU stage 2
  contextual_retrieval: true   # ← NOUVEAU (re-index corpus)

memory:
  short_term: study_sessions.conversationSummary (existing)
  long_term_structured: student_cognitive_profiles (writes via dual-write)
  episodic: session_episode pgvector (NEW)

stt: gladia-solaria
tts: elevenlabs-v3 (voix personnalisées Voice Design v3)

observability:
  tracing: langfuse-self-hosted-eu
  metrics: prometheus + grafana
  cost_tracking: cost_tracking table populated
  evals: homemade suite (50 personas × 200 scenarios, judge LLM pairwise)

guardrails:
  safety_settings: BLOCK_LOW_AND_ABOVE across categories
  injection_defense: delimiters + instruction hierarchy
  answer_leak_detector: 2nd pass LLM
  readability: kandel-moles per grade
  moderation: openai-moderation (free) or gemini-safety
  agents_split: student_agent / parent_agent

framework: elysia + hand-rolled (ne pas migrer Mastra)
```

### Stack aspirationnelle (12 mois)

- Multi-provider routing (Gemini 3 Flash default, Claude Sonnet 4.6 pour complex Socratic, Mistral Medium 3 EU-sovereign fallback).
- Gemini Embedding 2 Preview pour multimodal RAG (devoirs scannés).
- Cartesia Sonic 3 40ms TTFA pour drill mode.
- `gpt-realtime` mode voix bidirectionnel (optionnel).
- Fine-tune LoRA Mistral Medium sur dialogues socratiques Eduscol FR → helper model ultra-cheap.
- Agents multi-étapes (planner / tutor / reporter).
- MCP server pour exposer tools.

---

## 8. Sources principales

### Modèles & pricing
- Claude Opus 4.7 : https://www.anthropic.com/news/claude-opus-4-7
- Claude pricing : https://platform.claude.com/docs/en/about-claude/models/whats-new-claude-4-7
- Prompt caching : https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching
- Gemini 3.1 Pro : https://deepmind.google/models/model-cards/gemini-3-1-pro/
- Gemini API pricing : https://ai.google.dev/gemini-api/docs/pricing
- Gemini caching : https://ai.google.dev/gemini-api/docs/caching
- GPT-5.4 : https://openai.com/index/introducing-gpt-5-4-mini-and-nano/
- Mistral pricing : https://mistral.ai/pricing
- Codestral Embed : https://mistral.ai/news/codestral-embed

### Benchmarks & évals
- Vellum LLM leaderboard : https://www.vellum.ai/llm-leaderboard
- MMLU-Pro : https://artificialanalysis.ai/evaluations/mmlu-pro
- MathTutorBench : https://eth-lre.github.io/mathtutorbench/
- SocraticLM : https://openreview.net/forum?id=qkoZgJhxsA
- TutorBench : https://arxiv.org/html/2510.02663v1
- Safe-Child-LLM : https://arxiv.org/abs/2506.13510
- MTEB leaderboard : https://huggingface.co/spaces/mteb/leaderboard
- MMTEB : https://arxiv.org/abs/2502.13595
- Berkeley Function Calling Leaderboard : https://gorilla.cs.berkeley.edu/leaderboard.html

### Engineering & patterns
- Anthropic Effective context engineering : https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents
- Anthropic Writing tools for agents : https://www.anthropic.com/engineering/writing-tools-for-agents
- Anthropic Contextual retrieval : https://www.anthropic.com/news/contextual-retrieval
- Jina late chunking : https://jina.ai/news/late-chunking
- Simon Willison lethal trifecta : https://simonwillison.net/2025/Jun/16/the-lethal-trifecta/

### Embeddings & RAG
- voyage-3-large : https://blog.voyageai.com/2025/01/07/voyage-3-large/
- Cohere embed v4 : https://app.ailog.fr/en/blog/news/cohere-embed-v4
- Gemini Embedding GA : https://developers.googleblog.com/gemini-embedding-available-gemini-api/

### TTS / STT
- ElevenLabs v3 : https://elevenlabs.io/blog/eleven-v3
- Cartesia Sonic 3 : https://cartesia.ai/sonic
- OpenAI audio : https://developers.openai.com/blog/updates-audio-models
- OpenAI Realtime : https://platform.openai.com/docs/guides/realtime
- Gladia : https://www.gladia.io/competitors/benchmarks

### Observabilité & évals
- Langfuse : https://langfuse.com
- Braintrust : https://www.braintrust.dev
- Phoenix : https://phoenix.arize.com

### Mémoire agents
- Mem0 : https://github.com/mem0ai/mem0
- Zep Graphiti : https://www.getzep.com/blog/graphiti
- Letta (ex-MemGPT) : https://docs.letta.com

### Framework
- Vercel AI SDK 5 : https://vercel.com/blog/ai-sdk-5
- Elysia AI SDK : https://elysiajs.com/integrations/ai-sdk
- Mastra 2026 : https://www.generative.inc/mastra-ai-the-complete-guide-to-the-typescript-agent-framework-2026

### Réglementation
- CNIL IA : https://www.cnil.fr/fr/intelligence-artificielle
- EU AI Act Annex III : https://artificialintelligenceact.eu/annex/3/

---

**Fin du rapport.**

Document de travail — discussion ouverte sur les arbitrages (notamment : routing multi-modèle vs simplicité ; Cohere Rerank vs rester BM25-only ; migration Langfuse vs rester Pino+logs).
