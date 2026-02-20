# Agent IA pour Tom - Roadmap & Analyse

> Document de recherche - Fevrier 2026
> Objectif : Evaluer l'interet d'un agent IA pour la plateforme TomAI

---

## 1. Etat actuel de Tom

### Architecture chat existante

```
Eleve --> Message --> Gemini 3 Flash (1 appel) --> RAG optionnel (1 tool call) --> Reponse streaming
```

Tom est aujourd'hui un **chatbot avec RAG**, pas un agent. La difference est fondamentale :

| | Chatbot (Tom actuel) | Agent IA |
|---|---|---|
| Raisonnement | 1 etape (question -> reponse) | Multi-etapes (planification -> execution -> verification) |
| Outils | 1 seul (search_educational_content) | Plusieurs (RAG, flashcards, Pronote, exercices...) |
| Decisions | Aucune (repond a la question) | Autonomes (choisit quelle action faire) |
| Memoire | 20 derniers messages | Long terme (lacunes, progres, preferences) |
| Proactivite | Aucune (attend les questions) | Peut suggerer des actions |

### Stack technique actuelle

- **Modele** : Gemini 3 Flash via `@google/genai`
- **RAG** : Qdrant Cloud + Mistral embeddings 1024D + BM25/RRF reranking
- **Streaming** : SSE (Server-Sent Events) via generators Elysia.js
- **Flashcards** : FSRS (Free Spaced Repetition Scheduler)
- **Donnees scolaires** : Integration Pronote (devoirs, notes, emploi du temps)
- **Auth** : Better Auth + Google OAuth
- **Infra** : Bun + Elysia.js, PostgreSQL, deploye sur Koyeb

---

## 2. Ce qu'un agent IA apporterait a Tom

### 2.1 Orchestration multi-outils

Au lieu d'un seul outil RAG, l'agent aurait acces a un ecosysteme d'outils :

| Outil | Fonction | Exemple d'utilisation |
|-------|----------|----------------------|
| `search_curriculum` | Recherche RAG dans les programmes Eduscol | "Qu'est-ce que le theoreme de Thales ?" |
| `create_flashcards` | Genere des cartes FSRS depuis la conversation | "Cree des cartes sur ce qu'on vient de voir" |
| `check_homework` | Lit les devoirs Pronote de l'eleve | "Quels devoirs j'ai pour demain ?" |
| `check_grades` | Analyse les notes et tendances | "Comment je peux m'ameliorer en maths ?" |
| `check_timetable` | Consulte l'emploi du temps | "J'ai quoi comme cours demain ?" |
| `generate_exercise` | Cree un exercice adapte au niveau | "Donne-moi un exercice sur les fractions" |
| `get_student_progress` | Consulte l'historique de progression | "Sur quoi j'ai du mal ?" |

**Scenario concret - Aujourd'hui vs Agent :**

Eleve : *"Aide-moi a reviser mon controle de maths demain"*

**Aujourd'hui** : Tom repond avec des connaissances generales sur les maths, sans savoir quel controle, quel chapitre, ni les lacunes de l'eleve.

**Avec agent** :
1. Tom verifie l'emploi du temps Pronote -> trouve le controle de maths
2. Tom analyse les derniers devoirs/notes de maths -> identifie les lacunes
3. Tom cherche le programme correspondant via RAG -> trouve le chapitre
4. Tom genere des exercices cibles sur les points faibles
5. Tom propose de creer des flashcards pour les formules cles
6. Tout ca dans une seule conversation fluide

### 2.2 Pedagogie adaptative

L'agent pourrait analyser le comportement de l'eleve en temps reel et adapter sa strategie :

**Detection de frustration** :
- L'eleve dit "je comprends pas" 3 fois -> simplifier automatiquement
- L'eleve envoie des messages courts/agressifs -> proposer une approche differente
- Implementation : compteur de frustration dans la session, seuils configurables

**Detection de maitrise** :
- Les reponses sont correctes et rapides -> augmenter la difficulte
- L'eleve reformule correctement le concept -> passer au sujet suivant
- Implementation : score de confiance par concept dans le profil eleve

**Choix de strategie pedagogique** :
- Socratique (questions guidees) -> eleve qui apprend un nouveau concept
- Explicatif (cours structure) -> eleve perdu qui a besoin de bases
- Exercices pratiques -> eleve qui comprend la theorie mais pas l'application
- Revision espacee -> eleve qui doit consolider des acquis

*Base scientifique : 4 piliers CSEN (Dehaene) deja integres dans les prompts Tom*

### 2.3 Actions proactives

Au lieu d'attendre les questions, l'agent pourrait :

- **Avant un controle** : "Tu as un controle de SVT jeudi. On revise ensemble ?"
- **Apres une mauvaise note** : "Ta note en histoire a baisse. Veux-tu qu'on revoit le chapitre ?"
- **Revision espacee** : "Ca fait 3 jours qu'on n'a pas revu les fractions. Un petit quiz ?"
- **Flashcards auto** : Apres chaque session de chat, proposer de creer des cartes sur les concepts abordes

### 2.4 Memoire long terme

Aujourd'hui : Tom a acces aux 20 derniers messages de la session.

Avec un agent : Tom pourrait maintenir un **profil cognitif** de l'eleve :

```
Profil eleve:
  - Lacunes identifiees: [fractions, accord du participe passe]
  - Concepts maitrises: [theoreme de Pythagore, present simple anglais]
  - Style d'apprentissage prefere: exercices pratiques > cours theorique
  - Sujets ou il decroche vite: histoire-geo
  - Meilleur moment pour reviser: apres 17h (analyse des sessions)
```

Ce profil serait stocke en base et consulte a chaque nouvelle conversation.

---

## 3. Recherche : Frameworks agents IA (2026)

### 3.1 Comparatif des frameworks

| Framework | Langage | Forces | Faiblesses | Pertinence Tom |
|-----------|---------|--------|------------|----------------|
| **Google ADK** | TypeScript/Python | Natif Gemini, open-source, multi-agent | Ecosystem jeune | Tres haute (meme modele) |
| **LangGraph** | Python/TypeScript | Controle fin, performant, mature | Complexite, courbe d'apprentissage | Moyenne |
| **CrewAI** | Python | Rapide, role-based, populaire | Python only, moins de controle | Basse (pas de TS natif) |
| **Anthropic Agent SDK** | TypeScript/Python | Elegant, bien documente | Lie a Claude (pas Gemini) | Basse (changement de modele) |
| **OpenAI Agents SDK** | Python | Performant, bien integre | Lie a GPT | Basse (changement de modele) |

### 3.2 Recommandation : Google ADK (TypeScript)

**Pourquoi ADK est le choix naturel pour Tom :**

1. **Meme modele** : Tom utilise deja Gemini 3 Flash. ADK est optimise pour Gemini.
2. **TypeScript natif** : Le backend Tom est en TypeScript (Bun + Elysia). Pas de Python a maintenir.
3. **Open-source** : Pas de lock-in, code auditable.
4. **Multi-agent** : Supporte l'orchestration de plusieurs agents specialises.
5. **Function calling natif** : Reutilise le pattern deja en place dans `gemini-chat.service.ts`.
6. **Deployable partout** : Compatible Koyeb (infra actuelle).

**Ce que ADK apporte par rapport au code actuel :**

```typescript
// Aujourd'hui : function calling manuel dans gemini-chat.service.ts
const chat = this.ai.chats.create({
  model: this.model,
  config: {
    tools: [{ functionDeclarations: [ragSearchDeclaration] }]
  }
});

// Avec ADK : agent declaratif avec plusieurs outils
const tutorAgent = new Agent({
  name: 'tom-tutor',
  model: 'gemini-3-flash',
  instruction: systemPrompt,
  tools: [
    searchCurriculumTool,
    createFlashcardsTool,
    checkHomeworkTool,
    checkGradesTool,
    generateExerciseTool,
  ],
});
```

### 3.3 Sources

- [Google ADK Documentation](https://google.github.io/adk-docs/)
- [ADK TypeScript Announcement - Google Developers Blog](https://developers.googleblog.com/introducing-agent-development-kit-for-typescript-build-ai-agents-with-the-power-of-a-code-first-approach/)
- [Gemini 3 Multi-Agent Systems - Medium](https://jubinsoni.medium.com/google-cloud-ai-agents-with-gemini-3-building-multi-agent-systems-that-actually-work-f41f462bc2a9)
- [Gemini Function Calling Docs](https://ai.google.dev/gemini-api/docs/function-calling)
- [AI Agent Frameworks Comparison 2026 - Turing](https://www.turing.com/resources/ai-agent-frameworks)
- [Top Agentic AI Frameworks 2026 - AlphaMatch](https://www.alphamatch.ai/blog/top-agentic-ai-frameworks-2026)

---

## 4. Recherche : Agents IA dans l'education (2026)

### 4.1 Etat de l'art

Les systemes de tutorat intelligents (ITS) avec agents IA en 2026 montrent des resultats significatifs :

- **+40% de gains en comprehension** par rapport aux outils e-learning classiques (conversations socratiques soutenues par LLM)
- Les systemes multi-agents avec tuteur + agent de motivation travaillant en parallele surpassent les agents uniques
- L'architecture hierarchique (agent routeur + agents specialises) est le pattern dominant
- La combinaison humain-IA (enseignants moderent les sorties LLM) donne les meilleurs resultats

### 4.2 Patterns architecturaux valides

**Pattern 1 : Agent unique avec outils** (recommande pour Phase 1)
```
Agent Tuteur (Gemini)
  |-- Outil RAG (programmes officiels)
  |-- Outil Pronote (devoirs, notes)
  |-- Outil Flashcards (creation FSRS)
  |-- Outil Exercices (generation adaptee)
```

**Pattern 2 : Multi-agent hierarchique** (Phase 3)
```
Agent Routeur (decide qui appeler)
  |-- Agent Tuteur (explications, socratique)
  |-- Agent Pronote (donnees scolaires)
  |-- Agent Revision (flashcards, exercices, quiz)
  |-- Agent Analyse (detection lacunes, suivi progres)
```

**Pattern 3 : Agent avec planification** (avance)
```
Agent Planificateur
  |-- Analyse le contexte (controle demain, lacunes detectees)
  |-- Genere un plan de revision (3 etapes)
  |-- Execute chaque etape avec les outils
  |-- Adapte en temps reel selon les reponses
```

### 4.3 Sources

- [Agentic AI in Education: Use Cases, Risks, and Implementation - 8allocate](https://8allocate.com/blog/agentic-ai-in-education-use-cases-risks-and-an-implementation-playbook/)
- [AI Agents for Education 2026: Top 7 Innovations - Disco](https://www.disco.co/blog/ai-agents-for-education-2026)
- [AI-based Tutoring Systems in K-12: Systematic Review - Nature](https://www.nature.com/articles/s41539-025-00320-7)
- [AI Tutor App: Complete Guide 2026 - Jenova](https://www.jenova.ai/en/resources/ai-tutor-app)
- [Evolution of AI in Education: Agentic Workflows - arXiv](https://arxiv.org/pdf/2504.20082)
- [AI-Powered Educational Agents: Opportunities and Challenges - MDPI](https://www.mdpi.com/2078-2489/16/6/469)

---

## 5. Plan d'implementation en 3 phases

### Phase 1 : Agent leger (2-3 jours)

**Principe** : Ajouter des outils au chat existant sans changer l'architecture.

**Ce qui change** :
- Nouvelles `FunctionDeclaration` dans `gemini-chat.service.ts`
- Nouveaux handlers dans `executeToolCall()` (remplace `executeRagSearch()`)
- Le system prompt mentionne tous les outils disponibles

**Outils a ajouter** :

```
search_educational_content  (existe deja)
create_study_flashcards     (nouveau - appelle le service deck existant)
get_student_homework        (nouveau - appelle l'API Pronote)
get_student_grades          (nouveau - appelle l'API Pronote)
get_student_timetable       (nouveau - appelle l'API Pronote)
```

**Impact** :
- Latence : +1-3s par tool call supplementaire
- Cout : +500-1500 tokens par outil appele
- Complexite : faible (meme pattern que le RAG actuel)
- Valeur utilisateur : haute

**Fichiers a modifier** :
- `apps/server/src/services/chat/gemini-chat.service.ts` : ajouter tool declarations + handlers
- `apps/server/src/config/prompts/system-prompt.ts` : enrichir les instructions outils
- Aucun changement mobile necessaire (le streaming reste identique)

### Phase 2 : Memoire et adaptation (1 semaine)

**Principe** : Ajouter un profil cognitif persistant par eleve.

**Ce qui change** :
- Nouvelle table `student_cognitive_profile` en base
- Apres chaque session, extraction automatique des lacunes/maitrise
- Le system prompt inclut le profil de l'eleve
- Detection de frustration en temps reel (analyse du ton des messages)

**Schema DB** :
```sql
student_cognitive_profile:
  - user_id (FK)
  - subject
  - identified_gaps (jsonb)        -- lacunes detectees
  - mastered_concepts (jsonb)      -- concepts maitrises
  - preferred_style (text)         -- socratique / explicatif / exercices
  - frustration_threshold (int)    -- seuil avant simplification
  - last_analysis_at (timestamp)
```

**Impact** :
- Latence : +200ms (lecture profil au debut de session)
- Complexite : moyenne (nouveau service + migration DB)
- Valeur utilisateur : tres haute (personnalisation reelle)

### Phase 3 : Multi-agent avec Google ADK (2-3 semaines)

**Principe** : Migrer vers une architecture multi-agent pour l'orchestration complexe.

**Quand c'est justifie** :
- Les outils de Phase 1 sont utilises par les eleves (metriques d'usage)
- La complexite de routage entre outils depasse le function calling simple
- Besoin de planification multi-etapes (plan de revision sur plusieurs jours)

**Architecture cible** :

```
                    +-------------------+
                    |   Agent Routeur   |  <-- Decide quel agent appeler
                    |   (Gemini Flash)  |
                    +--------+----------+
                             |
            +----------------+----------------+
            |                |                |
    +-------v------+ +------v-------+ +------v--------+
    | Agent Tuteur | | Agent Pronote| | Agent Revision |
    |              | |              | |                |
    | - RAG        | | - Devoirs    | | - Flashcards   |
    | - Exercices  | | - Notes      | | - FSRS         |
    | - Socratique | | - Emploi tps | | - Quiz         |
    +--------------+ +--------------+ +----------------+
```

**Prerequis** :
- `@google/adk` package installe
- Refactor du streaming (ADK gere le streaming differemment)
- Tests end-to-end pour chaque agent

**Impact** :
- Latence : +3-10s (multi-hop entre agents)
- Cout tokens : x2-4 par rapport a Phase 1
- Complexite : haute (nouveau framework, tests, debugging)
- Valeur utilisateur : excellente (experience tuteur humain)

---

## 6. Trade-offs et risques

### Comparatif des phases

| | Chat actuel | Phase 1 (outils) | Phase 2 (memoire) | Phase 3 (ADK) |
|---|---|---|---|---|
| **Latence** | 2-4s | 3-6s | 3-6s | 5-15s |
| **Cout tokens/msg** | 500-1500 | 1000-3000 | 1000-3000 | 3000-8000 |
| **Complexite code** | Simple | Moderee | Moderee | Haute |
| **Valeur utilisateur** | Bonne | Tres bonne | Tres bonne | Excellente |
| **Temps de dev** | - | 2-3 jours | 1 semaine | 2-3 semaines |
| **Debugging** | Facile | Moyen | Moyen | Difficile |
| **Risque technique** | Nul | Faible | Faible | Moyen |

### Risques identifies

| Risque | Probabilite | Impact | Mitigation |
|--------|------------|--------|------------|
| Latence trop haute (>10s) | Moyenne | Fort | Streaming progressif, cache agressif |
| Cout tokens explose | Haute | Moyen | Quotas stricts, monitoring, choix du modele par tache |
| Hallucinations augmentent avec multi-outils | Moyenne | Fort | RAG obligatoire, validation des resultats |
| Complexite de debugging | Haute | Moyen | Logging structure, traces, replay des sessions |
| Eleves n'utilisent pas les outils | Moyenne | Fort | Suggestions proactives, onboarding UX |

---

## 7. Conclusion et recommandation

### Recommandation : demarrer par Phase 1

La Phase 1 (ajouter des outils au chat existant) est le **sweet spot**. Elle apporte **80% de la valeur d'un agent complet avec 20% de la complexite**.

**Ce que l'eleve gagne immediatement :**
- "Cree des flashcards sur ce qu'on vient de voir" -> Tom genere les cartes
- "Aide-moi avec mes devoirs de demain" -> Tom va chercher dans Pronote
- "Comment m'ameliorer en maths ?" -> Tom analyse les notes

**Ce qui ne change pas :**
- Architecture streaming SSE existante
- Code mobile (aucune modification)
- Infra de deploiement (Koyeb)

**Decision a prendre :**
- [ ] Valider Phase 1 et commencer l'implementation
- [ ] Prioriser la Phase 2 (memoire) avant les outils
- [ ] Aller directement en Phase 3 (ADK) pour l'architecture definitive
- [ ] Reporter et consolider le chat actuel d'abord

---

*Document genere le 19 fevrier 2026*
*Basee sur l'audit complet de la pipeline chat Tom + recherche frameworks agents IA 2026*
