# Chat — modèle de conversation & mémoire élève (design A+)

Date : 2026-06-29
Statut : design approuvé (go utilisateur). Lot 1 spécifié en détail ; lots 2-3 cadrés.
Branche de départ : à créer par lot.

## 1. Contexte & objectif

Le chat est le cœur produit de Tom (tuteur socratique, élèves collège/lycée, multi-matières).
Le backend possède déjà une infra riche : sessions multiples (`study_sessions`),
résumé roulant (SummaryBuffer), mémoire épisodique pgvector **par élève**, budget tokens,
prompt caching. Mais trois problèmes empêchent un fonctionnement « intelligent » :

1. **Le résumé de conversation n'atteint jamais le modèle** : il est calculé, stocké
   (`study_sessions.conversationSummary`), mais filtré avant l'appel Mistral
   (`apps/server/src/services/chat/mistral-chat.service.ts:92-95`, filtre `role !== 'system'`).
   Seul `summaryUpToMessageId` agit, en **rétrécissant** la fenêtre → après résumé, le modèle
   voit *moins* de messages **et pas** le résumé. La gestion de contexte est à moitié cassée.
2. **La matière d'une conversation est fictive** : `study_sessions.subject` est mis à
   `'général'` à la création (`apps/server/src/db/schema/learning.schema.ts:23`) et **jamais
   mis à jour**. Le `subject` envoyé par le client n'est utilisé qu'au runtime (prompt, routage
   reasoning), jamais persisté. L'icône matière du mobile est donc toujours générique.
3. **Le web est une coquille mono-session** : il fait un get-or-create sur `user.id` et un reset
   destructif ; il n'expose pas le multi-conversation que le backend (et le mobile) supportent déjà.

Objectif : un chat qui **garde le contexte sans exploser les tokens**, où l'on peut
**reset / reprendre une ancienne conversation**, et qui pose les bases d'une **mémoire élève
structurée par matière** (le vrai actif long terme : dashboards parents, B2B école).

## 2. Décision d'architecture : A+ (« structurer la mémoire, pas le chat »)

Choix validé après étude comparative (cf. §8) :

- **Conversations libres et persistantes** (modèle ChatGPT/Claude) : plusieurs conversations
  par élève, liste / reprise / archivage, **matière toujours auto-détectée** (zéro choix imposé,
  fidèle à la philosophie produit et au réel des devoirs souvent multi-matières).
- **La structure « matière » vit dans la MÉMOIRE/PROGRESSION**, pas dans le rangement des chats :
  un profil élève structuré par matière/concept, transverse aux conversations.

Rationale : tout l'écosystème de Tom est déjà structuré par matière (curriculum RAG, notes Pronote,
FSRS, prompts by-subject). Les dashboards parents / B2B ont besoin de **données de progression par
matière**, pas d'un rangement de fils. Des « espaces matière » dans le chat dupliqueraient cette
structure sans capacité supplémentaire, en ajoutant friction (over-structuring — échec documenté
des tuteurs) et risque de routage. A+ est le chemin **superset** : la matière étant détectée et
stockée, on pourra toujours ajouter un filtre/vue par matière, voire des espaces, sans rien casser.

On changerait d'avis seulement si Tom pivotait vers un **produit de parcours** (cours structurés,
progression linéaire imposée) plutôt qu'un tuteur à la demande.

### Décisions transverses (valables tous lots)

| # | Décision | Rationale |
|---|----------|-----------|
| 1 | La matière est une **étiquette tolérante**, jamais un routeur | Une erreur de détection n'a aucune conséquence destructive (≠ B où une conv mal rangée déroute l'élève) |
| 2 | **Préfixe caché global partagé conservé** ; la mémoire élève est un bloc **séparé** placé après | Préserve le gros bucket de cache inter-élèves (`chat-${VERSION}`) ; le bloc mémoire, petit, est caché par élève sur la fenêtre de 5 min |
| 3 | Ne **pas re-résumer à chaque tour** | La summarization agressive casse le prompt caching (préfixe change → cache manqué). Laisser grandir + cache, compresser au seuil |
| 4 | **Verbatim pour les faits précis** | Un résumé seul perd les détails exacts (93 % vs 19 % de rappel). Fenêtre verbatim + RAG épisodique pour le précis |
| 5 | Zéro nouvelle route serveur pour la parité web | `/chat/conversations`, `/session/new`, `/session/:id/history`, DELETE existent déjà |

## 3. Périmètre & découpage

| Lot | Contenu | Surfaces | Risque |
|-----|---------|----------|--------|
| **1** | **Pipeline de contexte réparé** (injection résumé) + **détection de matière réelle** | backend (impacte web + mobile) | Faible |
| 2 | Parité web : liste / reprise / archivage de conversations | web | Faible |
| 3 | Profil mémoire élève par matière + injection préfixe | backend + injection | Moyen |
| 4 (hors scope) | Dashboards parents / B2B consomment le profil | — | — |

Ce spec détaille le **Lot 1**. Les lots 2-3 sont cadrés ici et auront leur propre spec à leur tour.

## 4. Lot 1 — design détaillé

### 4.1 Réparer le pipeline de contexte (injection du résumé)

**Comportement actuel** (à corriger) :
- `conversation-optimizer.ts:43-71` construit, quand un résumé existe, un message
  `{ role: 'system', content: '[Résumé...]' }` + les 10 derniers messages.
- `mistral-chat.service.ts:89` appelle l'optimizer, puis `:92-95` `buildHistoryMessages`
  **filtre** `msg.role !== 'system'` → le message résumé est supprimé avant l'appel Mistral.
- Net : le texte du résumé n'atteint pas le modèle.

**Cible** :
- Le résumé (`study_sessions.conversationSummary`) est injecté comme un **bloc dédié** dans
  l'assemblage du contexte (`mistral-chat.service.ts`, zone d'assemblage `:147-165`), au même
  titre que `studentContextBlock` / `pronoteBlock` : un message `role:'user'` enveloppé
  `<conversation_summary>…</conversation_summary>`, placé **après** le préfixe système stable et
  **avant** la fenêtre verbatim récente.
- L'optimizer ne crée plus de message résumé `role:'system'` voué à être filtré : il ne renvoie
  que la **fenêtre verbatim** (N derniers messages) ; le résumé est injecté séparément depuis
  `conversationSummary`. Le filtre `role !== 'system'` peut rester (il ne sert plus qu'à exclure
  d'éventuels messages système parasites de l'historique).
- L'ordre final du contexte envoyé à Mistral devient :
  1. system prompt (préfixe stable caché + blocs dynamiques niveau/matière)
  2. `<conversation_summary>` (si présent) — role:user
  3. fenêtre verbatim des N derniers messages (history optimisé, fichiers toujours gardés)
  4. `studentContextBlock` (épisodes + learning context) — role:user
  5. `pronoteBlock` / `attachedFilesBlock` / `intentReinforcement` / `[VOCAL]` (inchangés)
  6. message utilisateur courant
- **Pas de changement des seuils de summarization** (1er résumé à 20 messages, incrémental +10,
  fenêtre verbatim 10 — `summarization.service.ts:26-32`). On ne touche qu'à l'**injection**.
- **Budget tokens** : l'allocation « résumé 15 % » de `token-budget.service.ts:113-123` devient
  réellement utilisée (le bloc résumé est tronqué au budget alloué si nécessaire).

**Vérification** : capturer le prompt assemblé (ou un log) sur une conversation > 20 messages et
confirmer que le texte du résumé est présent dans la charge envoyée à Mistral, et que la fenêtre
verbatim suit. Vérif comportementale : après une longue conversation, Tom se souvient d'un fait
établi tôt (hors fenêtre verbatim) — ce qui échoue aujourd'hui.

### 4.2 Détection de matière réelle

**Comportement actuel** (à corriger) : `subject` figé à `'général'`, jamais détecté ni persisté.

**Cible** :
- Étendre le **classifier d'intention existant** (`intent-classifier.service.ts`, ministral-8b,
  JSON Schema strict, déjà lancé en parallèle à chaque tour — `chat-orchestration.service.ts:93`)
  pour qu'il renvoie **aussi** une `subject` (+ `subjectConfidence`), dans le même appel — pas de
  coût d'un second appel LLM. L'enum matière s'aligne sur la normalisation existante
  (`adaptation/by-subject.ts:73-89` : `mathematiques`, `francais`, `langues`, `physique-chimie`,
  `svt`, `histoire-geographie`, …) + `général` comme valeur par défaut/mixte.
- **Persistance** : mettre à jour `study_sessions.subject` lorsque la détection est **confiante et
  stable** (typiquement au premier tour substantiel). Politique anti-thrash : on fixe la matière à
  la première détection confiante ; si la conversation dérive durablement, on retombe sur
  `'général'` (ou on garde la dominante) plutôt que de basculer à chaque message.
- **Usage** : la matière **détectée** (et non le `data.subject` client peu fiable) alimente
  `generateSubjectBlock` (adaptation prompt) et le routage reasoning
  (`mistral-reasoning.ts:58-64`). Le `data.subject` client reste un *hint* optionnel.
- Cette matière fiable rend l'icône matière du mobile correcte et prépare le filtre (Lot 2) et le
  profil mémoire (Lot 3).

**Vérification** : ouvrir une conversation, poser une question de maths → `study_sessions.subject`
passe à `mathematiques` ; une question d'histoire dans une nouvelle conversation → `histoire-geographie`.

### 4.3 Fichiers Lot 1 (indicatif)

- `apps/server/src/services/chat/mistral-chat.service.ts` (injection résumé, assemblage)
- `apps/server/src/services/chat/conversation-optimizer.ts` (ne plus émettre le message résumé filtré)
- `apps/server/src/services/chat/intent-classifier.service.ts` (+ `subject`/`subjectConfidence` au schéma)
- `apps/server/src/services/chat/chat-orchestration.service.ts` (persister `subject` détecté, passer la matière détectée au prompt/reasoning)
- `apps/server/src/db/repositories/study-sessions.repository.ts` (méthode update `subject`)
- Tests : `apps/server/src/tests/` (injection résumé présente dans le contexte assemblé ; détection+persistance matière)

## 5. Lots 2-3 — cadrage

### Lot 2 — Parité web (liste / reprise / archivage)
- Câbler dans `apps/web` les endpoints **déjà exposés** via `@repo/api` : `GET /chat/conversations`
  (liste), `POST /chat/session/new` (nouvelle), `GET /chat/session/:id/history` (reprise),
  `DELETE /chat/session/:id` (suppression).
- UI : panneau liste de conversations (preview dernier message + matière détectée + date),
  bouton « Nouvelle conversation » **non destructif** (l'ancienne reste dans la liste), reprise au clic.
- Harmoniser la clé de session (web keye sur `user.id`, mobile sur clé fixe) — choisir une clé par
  conversation. Reset reste une rotation ; « archiver » (optionnel) = masquer sans détruire.

### Lot 3 — Profil mémoire élève par matière
- Nouvelle table `student_subject_profile` : `(userId, subject)` → `masteryNotes`,
  `difficulties[]` (erreurs/misconceptions récurrentes), `conceptsSeen[]`, `updatedAt`,
  TTL/décroissance. Complète (ne remplace pas) la **mémoire épisodique pgvector** existante
  (rappel sémantique d'une session précise).
- Alimentation : **étendre l'extraction épisodique** (qui tourne déjà au reset —
  `episodic-memory.service.ts`) pour agréger ses sorties (`conceptsCovered`, outcome, summary)
  dans le profil de la matière concernée. Envisager aussi une synthèse périodique (façon Claude 24 h),
  candidate au **batch Mistral -50 %**.
- Injection : un **bloc compact** « ce que Tom sait de l'élève en [matière] » placé **après** le
  préfixe stable partagé (décision #2) → caché par élève sans casser le bucket partagé.
- Endpoint `GET/PATCH /api/student/memory` (injection + futur affichage/édition).
- **RGPD (mineurs)** : données minimales, pas d'info sensible, consultables/éditables, EU, TTL.

## 6. Vérification (par lot, avant le suivant)

- Lot 1 : tests serveur (`bun run test` + `test:integration`) ; vérif comportementale (mémoire
  d'un fait ancien ; matière persistée correcte). Pas d'e2e écrits (méthode utilisateur : vérif de visu).
- Lot 2 : login élève web → liste de conversations → nouvelle / reprise / suppression, états
  loading/empty/error réels.
- Lot 3 : profil mis à jour après une session ; bloc mémoire présent dans le contexte ; cache
  partagé non cassé (préfixe global inchangé).

## 7. Risques & points ouverts

- **Cache vs mémoire (Lot 3)** : injecter la mémoire élève segmente le cache par élève sur sa part ;
  on conserve le gros bucket partagé en gardant le bloc mémoire **après** le préfixe global (décision #2).
  À mesurer (taux de hit) avant/après.
- **Dérive de matière** dans une conversation longue multi-matières : politique « première détection
  confiante, sinon général » à valider à l'usage (Lot 1).
- **Détection matière** : qualité de ministral-8b sur l'enum ; prévoir `général` comme filet.
- **RGPD** profil élève mineur (Lot 3) : cadrer minimisation + consultation/édition avant build.

## 8. Annexe — étude A vs B (résumé)

Comparées : **A** (conversations libres + mémoire) vs **B** (espaces par matière). Verdict : la
structure matière dont Tom a besoin (progression pour parents/B2B) est une **donnée**, qui vit mieux
dans la mémoire que dans le rangement des chats. B impose une friction (over-structuring, échec connu
des tuteurs) et un risque de routage, sans donnée long terme supplémentaire. Les analogues tuteurs
(Khanmigo, LearnLM) structurent surtout la **mémoire/progression** + ancrage activité, pas le rangement
des fils. A+ = modèle A pour les conversations + structure de B dans la mémoire. Sources : prompt
caching Anthropic/Mistral (compression agressive casse le cache), CogCanvas (verbatim 93 % vs résumé
19 % sur faits précis), ChatGPT memory, Claude Projects, Khanmigo, LearnLM.
