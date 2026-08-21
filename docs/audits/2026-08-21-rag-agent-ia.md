# Audit RAG & agent IA — 21 août 2026

Audit conduit **code-first** (lecture intégrale de la chaîne, aucune confiance
accordée aux docs internes ni à la mémoire de session) puis **doc-first** :
chaque choix techno a été revérifié contre la documentation éditeur d'août 2026.
Toutes les affirmations ci-dessous sont soit une lecture de code, soit une
citation sourcée.

## Périmètre

| Brique | Emplacement | Rôle |
|---|---|---|
| Ingestion | `apps/curriculum` (Python `uv`, hors workspace) | PDF Éduscol → chunks → Qdrant |
| Embeddings | `apps/ai-service` (FastAPI + FlagEmbedding) | BGE-M3 dense 1024D + sparse appris |
| Index | Qdrant Cloud `fr-par`, collection `tomai_educational` | Recherche hybride RRF |
| Retrieval | `apps/server/src/services/{rag,qdrant}.service.ts` | Query API prefetch dense+sparse |
| Agent | `apps/server/src/services/chat/*` (AI SDK 7 `streamText`) | Boucle outils, 5 outils, Mistral |
| Mémoire | pgvector + `mistral-embed` | Mémoire épisodique de session |

---

## Verdict

L'architecture est **au-dessus de la moyenne du marché** sur trois points qui
comptent vraiment : les frontières entre services sont justes et documentées, le
choix d'embedder est adossé à un benchmark chiffré et reproductible, et la
défense contre l'injection de prompt est traitée sérieusement (fencing
systématique du contenu tiers, hiérarchie d'instructions explicite).

Elle est **cassée sur un point produit majeur** et **aveugle sur un point
opérationnel majeur** :

1. **Le contrat de matières entre l'agent et l'index est désaligné.** Trois
   slugs exposés au modèle ne peuvent structurellement renvoyer aucun résultat,
   quatorze matières indexées lui sont inaccessibles, et cinq niveaux sont
   proposés sans corpus. Silencieusement.
2. **Rien ne mesure la qualité du RAG en production.** Le seul score persisté
   est un artefact de rang RRF sans signification, et aucun test de non-
   régression retrieval ne tourne en CI.

Le reste relève de la dette normale et se traite au fil de l'eau.

---

## P0 — à corriger avant tout le reste

### P0-1 · Taxonomie de matières désalignée agent ↔ index

`RAG_SUBJECTS` (`tool-declarations.ts`) est l'enum que le modèle utilise pour
remplir l'argument `matiere` de `search_educational_content`. Il ne correspond
pas au vocabulaire réellement indexé (`apps/curriculum/contract.json`) :

| Symptôme | Valeurs |
|---|---|
| Exposé au modèle, **absent de l'index** → 0 résultat garanti | `histoire`, `geographie`, `physique-chimie` |
| Indexé, **inaccessible au modèle** | `histoire_geo`, `physique_chimie`, `emc`, `arts_plastiques`, `education_musicale`, `histoire_des_arts`, `eps`, `italien`, `sciences_technologie`, `langues_vivantes`, `snt`, `enseignement_scientifique`, `hggsp`, `hlp` |
| Niveaux exposés sans corpus | `cp`, `ce1`, `ce2`, `cm1`, `cm2` |
| Matières lycée déclarées au contrat mais sans source ingérée | `philosophie`, `ses`, `nsi` (aucun fichier lycée dans `data/raw`) |

Concrètement : un élève de 4e qui pose une question d'histoire ou de physique
déclenche l'outil, l'outil renvoie `found: false`, et le modèle répond « d'après
mes connaissances générales » — le RAG est contourné sur deux matières du tronc
commun sans que rien ne le signale.

Le test de conformité existe (`src/tests/contract.test.ts`) mais **ne vérifie
pas `matieres`** : il ne couvre que les niveaux, dans un seul sens, et les clés
de payload.

Aggravant : `apps/curriculum` n'est pas un package pnpm, donc `turbo --affected`
ne considère jamais une modification de `contract.json` comme affectant
`apps/server` — le test de contrat ne se déclencherait pas sur le changement
qu'il est censé garder.

**Correctif** : générer `RAG_SUBJECTS` (et l'enum `niveau`) depuis
`contract.json` au build ; étendre `contract.test.ts` à une vérification
bidirectionnelle des matières ; ajouter `apps/curriculum/contract.json` aux
entrées du pipeline turbo du serveur ; logguer `resultsCount === 0` comme
anomalie et non comme cas nominal.

### P0-2 · Aucun signal de qualité du retrieval en production

`rag.service.ts` calcule `averageSimilarity` en moyennant les scores retournés
par Qdrant. En fusion RRF ce sont des scores de rang (~`1/(k+rank)`, ordre de
grandeur 0,016), pas des similarités — le code le documente explicitement en
commentaire, puis persiste quand même cette valeur dans `retrieval_audit.avg_score`.

Conséquence : la seule colonne de qualité de la table d'audit est ininterprétable,
et il n'existe aucune alerte sur le taux de `found: false`. Un effondrement du
recall (réindexation ratée, dérive de corpus, régression de l'embedder) est
**invisible**.

Symétriquement : le golden set de 189 questions existe (`data/golden/questions.json`),
`scripts/evaluate.py` mesure `chunk_id Recall@k` et MRR de façon déterministe en
~10 s… et ne tourne dans aucun job CI. Les tests `src/live/*.test.ts` sont
explicitement hors gate.

**Correctif** : remplacer `avg_score` par un signal exploitable — soit le rang du
premier chunk retenu, soit un second passage de scoring dense pur — ; alerter sur
le taux de `found:false` par matière ; brancher `evaluate.py` en CI avec un seuil
plancher sur le golden set.

### P0-3 · Modèles de classification pointant sur des références retirées

`env.ts` fixe `MISTRAL_MODEL_CLASSIFY = 'ministral-8b-latest'` et
`MISTRAL_MODEL_TITLE = 'ministral-3b-latest'`.

Or `ministral-8b-2410` et `ministral-3b-2410` sont **dépréciés le 02/12/2025 et
retirés le 31/12/2025**, remplacés par Ministral 3 8B / Ministral 3 3B
([docs.mistral.ai — models overview](https://docs.mistral.ai/getting-started/models/models_overview)).

Plus largement, toute la configuration repose sur des alias `-latest`, alors que
la doc de cycle de vie Mistral est explicite : un alias « pointe vers la dernière
version GA, toutes générations confondues » et « utiliser un alias vous expose à
des changements silencieux de comportement et de tarification » — la
recommandation est de **pinner en `major.minor`** en production
([model lifecycle](https://docs.mistral.ai/inference/model-lifecycle)).

**Correctif** : migrer vers `ministral-3-8b` / `ministral-3-3b`, pinner les
versions datées pour tous les modèles, et documenter la procédure de bump.

---

## P1 — dette qui coûte déjà

### P1-4 · Quantization int8 sans rescore : du recall perdu gratuitement

La collection est créée avec `ScalarQuantization(int8, quantile=0.99, always_ram=True)`
(`migrate_collection.py`). Côté requête, `qdrant.service.ts` ne passe que
`hnsw_ef: 128` — jamais `quantization.rescore` ni `oversampling`.

La doc Qdrant est nette : « par défaut, le rescoring n'est activé que pour quatre
méthodes : binary quantization, TurboQuant 1 bit, 1.5 bit et 2 bit. Les autres
méthodes ne rescore pas par défaut »
([quantization](https://qdrant.tech/documentation/guides/quantization/)).

Les vecteurs originaux sont donc en RAM (`always_ram=True`) mais jamais utilisés
pour réévaluer le top-k. C'est du recall abandonné pour un coût quasi nul.

À noter aussi : Qdrant 1.18 introduit **TurboQuant**, « environ le double du taux
de compression de la quantization scalaire pour un recall et une vitesse
similaires », et le recommande comme choix par défaut ; Qdrant 1.19 (04/08/2026)
ajoute le datatype Turbo4 et les tiers mémoire.

### P1-5 · Le routage `reasoningEffort` est une branche morte

`mistral-reasoning.ts` déclenche `reasoning_effort: 'high'` si
`STEM_SUBJECTS.has(subject)`, avec
`STEM_SUBJECTS = {mathematiques, physique-chimie, svt, technologie, nsi}`.

Mais le `subject` qui arrive jusqu'à `streamChat` vient de `effectiveSubject`,
c'est-à-dire du classifieur d'intention, dont l'enum est
`STUDENT_SUBJECTS = {mathematiques, francais, langues, sciences, histoire-geo, general}`.

Intersection = `{mathematiques}`. Les quatre autres valeurs sont **inatteignables**,
et `sciences` — qui couvre physique-chimie et SVT — n'est pas dans le set STEM.
Le mode raisonnement ne s'active donc jamais en dehors des maths.

(Vérifié par ailleurs : `reasoningEffort` **est** bien supporté par le provider
installé — `@ai-sdk/mistral@4.0.5/dist/index.d.ts` l'expose dans
`mistralLanguageModelChatOptions`, même si la page publique du provider ne le
liste pas encore. Le câblage est bon, c'est la table de correspondance qui est
fausse.)

### P1-6 · `ai-service` : SPOF non instrumenté sur le chemin chaud

C'est le composant dont dépend chaque recherche RAG, et c'est le seul de la stack
qui n'a **ni Sentry ni OpenTelemetry** — alors que le serveur, la landing et le
mobile en sont équipés.

S'y ajoutent trois contraintes de débit cumulées :

- un `anyio.Lock` global sérialise **toute** inférence du processus
  (`main.py`) — un seul embed à la fois, quelle que soit la charge ;
- `USE_FP16=false` par défaut, donc BGE-M3 en fp32 sur CPU (~3 Go de RAM,
  ~50–150 ms/requête d'après le README) ;
- une instance Koyeb `eco-medium`, sans réplique.

Mesuré le 2026-08-21 sur 2 vCPU : **577 ms par requête à chaud, ~1,7 req/s de
débit maximum**, et un wall-clock qui croît linéairement avec la concurrence
(521 / 1 153 / 1 734 / 3 245 ms pour 1 / 2 / 4 / 8 requêtes simultanées). Toute
requête lente bloque les suivantes.

> Correction : cette section estimait initialement « de l'ordre de la dizaine de
> requêtes/s ». La mesure donne 1,7 — un ordre de grandeur d'écart. Protocole et
> chiffres complets dans `docs/adr/0002-ai-service-scope.md`. Le lock est justifié (`BGEM3FlagModel` n'est pas
documenté thread-safe) mais la réponse correcte à ce constat est la réplication
horizontale, pas la sérialisation d'un singleton.

### P1-7 · Zéro évaluation de la génération

`docs/ARCHITECTURE.md` du curriculum assigne explicitement l'éval réponse
(faithfulness, hallucination, style socratique) au backend, dans un tableau de
frontière « non négociable ». Recherche exhaustive côté `apps/server` :
aucune occurrence de `faithfulness`, `groundedness`, `hallucination`, `judge`.

La promesse produit — « les résultats des programmes officiels priment sur tes
connaissances » (`rag-policy.ts`) — n'est donc vérifiée par aucune mesure.

Corollaire : la politique RAG elle-même n'est qu'un souhait de prompt. Rien dans
le code ne force l'appel de `search_educational_content` avant une réponse
scolaire. AI SDK 7 fournit le mécanisme pour en faire une garantie —
`prepareStep` permet de contraindre `activeTools` / `toolChoice` par étape
([loop control](https://ai-sdk.dev/docs/agents/loop-control)).

### P1-8 · Chunking calibré sur le mauvais tokenizer

`ingest.py` découpe à `chunk_size=400` **tokens Mistral réels**, via
`mistral_common` — un héritage de l'époque `mistral-embed`, où l'embedder
partageait ce tokenizer. L'embedder est désormais BGE-M3, qui utilise le
tokenizer XLM-RoBERTa et accepte 8192 tokens.

Deux conséquences : la taille de chunk n'est plus calibrée sur ce qui est
réellement embeddé, et l'ingestion charge ~500 Mo d'état de tokenizer Mistral
pour un usage devenu arbitraire. La piste « 400 → 512 tokens » listée dans
`ARCHITECTURE.md` doit être reformulée en tokens BGE-M3 avant d'être testée.

---

## P2 — à mesurer / à tenir à jour

| # | Sujet | État |
|---|---|---|
| P2-9 | `ai` pinné en **exact** `7.0.15`, dernière `7.0.73` ; `@ai-sdk/mistral` résolu `4.0.5` vs `4.0.31` ; `@qdrant/js-client-rest` `1.18.0` vs `1.19.0` | 58 patches de retard sur le SDK qui porte la boucle agentique |
| P2-10 | `Modifier.IDF` appliqué à du sparse **appris** (BGE-M3 `lexical_weights`) | Non standard : Qdrant ne configure pas l'IDF pour les modèles type SPLADE, dont les poids encodent déjà l'importance des termes. A/B on/off jamais fait |
| P2-11 | RRF pondéré (Qdrant ≥ 1.17) et `k` configurable (≥ 1.16) | Jamais testés — seul RRF vs DBSF a été mesuré. Levier de tuning dense/sparse à coût nul |
| P2-12 | L'éval offline n'emprunte pas le chemin de prod | `hybrid_search()` Python ne passe ni `hnsw_ef` ni les paramètres de quantization. Le `cid_recall@5 = 0,894` ne mesure pas ce que sert le serveur |
| P2-13 | `prompt_cache_key` unique et global (`chat-2026-06-14-voicefmt`) partagé par tous les élèves | La doc Mistral recommande « un identifiant applicatif stable, tel qu'un ID de conversation, de session ou de workflow ». Le taux de hit est déjà collecté (`usage.inputTokenDetails.cacheReadTokens` → `cost_tracking`) : mesurable avant de trancher ([prompt caching](https://docs.mistral.ai/studio-api/conversations/advanced/prompt-caching)) |

---

## À supprimer

| Cible | Justification |
|---|---|
| `agentTools` et les 5 déclarations de `tool-declarations.ts` | Code mort : seul son propre test le consomme. La boucle agentique passe intégralement par `chat-tools.ts` (AI SDK). Ne garder que `RAG_SUBJECTS` — et le dériver de `contract.json` (P0-1) |
| `mistral-embeddings.service.ts` + dépendance `mistral-embed` | Second système d'embeddings (mémoire épisodique, pgvector) : deuxième modèle, deuxième espace vectoriel, deuxième mode de panne, pour la même dimension (1024D) que BGE-M3 déjà déployé. `mistral-embed-2312` est un modèle de décembre 2023 |
| `apps/web/` | Répertoire fantôme : ne contient plus qu'un `tsconfig.tsbuildinfo` orphelin alors que l'ADR 0001 a acté la suppression de l'app |
| `schema/bm25.py` + `dump_bm25_fixture.py` + fixtures TS associées (curriculum) | Chemin de migration terminé : la cible prod est le sparse natif BGE-M3, le backend a migré. Le BM25 FNV-1a maison n'a plus de consommateur |
| Blocs d'export vides de `src/config/prompts/index.ts` | Résidus syntaxiques (`export { buildSystemPrompt,,, }`, `;` isolés) |

---

## À mettre en place

### 1. Un garde-fou de sécurité dédié — priorité produit

Le produit s'adresse à des mineurs et ingère des **photos prises par des élèves**
(`file-multimodal.service.ts` → vision Mistral). La défense actuelle est
`safePrompt: true` plus un bloc `<safety>` en prompt système : un raisonnement
du modèle génératif sur lui-même, non mesurable et contournable.

**Shieldstral** (Mistral, 4 août 2026) est un classifieur de sûreté 3B
open-weights **Apache 2.0**, multimodal texte + image, qui prend la politique en
langage naturel **au moment de l'inférence** plutôt qu'un jeu de catégories figé,
couvre 12 langues et tient sur un seul GPU 16 Go
([mistral.ai/news/shieldstral](https://mistral.ai/news/shieldstral/)). Il évalue
un prompt, une réponse, une paire, ou une image — exactement les quatre surfaces
du produit. Une politique du type « ce contenu est-il approprié pour un mineur ? »
s'écrit en une phrase.

Deux voies : self-host dans `ai-service` (mutualise l'infra, garde tout en interne)
ou API Mistral Moderation 2. La première est cohérente avec la doctrine de
souveraineté du projet.

### 2. Reranker — correction de ce rapport (22 août)

> **Cette recommandation était fausse et est retirée.** Elle disait de rouvrir
> la décision reranker au motif qu'elle reposait sur un critère invalide
> (« origine Chine »). Ce critère figure bien dans `ARCHITECTURE.md`, mais
> **ce n'est pas lui qui a tranché** — j'ai lu la doc sans vérifier la décision
> réelle, tracée en mémoire de chantier.

Ce qui a réellement tranché, le 2026-07-01 :

- `bge-reranker-v2-m3` était le **meilleur** candidat retenu (Apache 2.0,
  MIRACL 69,32), devant `jina-reranker-v3` (licence CC-BY-NC, incompatible
  avec un produit payant) et `Qwen3-Reranker` (4B/8B, trop lourd). Il n'a
  jamais été écarté pour son origine.
- Il est tombé sur la **latence CPU mesurée** : 43 à 180 s pour 20 candidats
  (mesure du 2026-06-25 ; 15–19 s pour 25 chunks, en sentence-transformers
  comme en TEI-candle). Face au timeout de quelques secondes du client, le
  rerank aurait timeouté systématiquement.
- Les options managées restent exclues pour la souveraineté des **données** —
  Jina appartient à Elastic (US, CLOUD Act), Cohere est US, le « rerank »
  Scaleway est une similarité cosinus et non un cross-encoder.

**La décision est saine, seule sa justification écrite était fausse.** Le
texte de `ARCHITECTURE.md` a été corrigé le 22/08 pour porter la vraie
raison. Rouvrir le sujet suppose de résoudre d'abord la latence — ONNX/INT8
généré à la main, ou GPU à Tensor Cores — puis de mesurer le gain de
`cid_recall@5` sur le golden set. Ce n'est pas un chantier prioritaire.

### 3. Une boucle d'évaluation qui ferme le cycle

- `evaluate.py` en CI avec un seuil plancher sur le golden set (le corpus et le
  script existent, il ne manque que le job) ;
- une éval LLM-judge de faithfulness sur un échantillon de conversations réelles,
  pour vérifier que le modèle s'appuie effectivement sur `<curriculum_excerpt>` ;
- un tableau de bord : taux de `found:false` par matière, latence `ai-service`,
  taux de hit du prompt cache.

### 4. Combler le corpus, ou retirer ce qui n'existe pas

Le lycée est déclaré au contrat (`seconde`/`premiere`/`terminale`, `philosophie`,
`ses`, `nsi`, `hggsp`, `hlp`) sans qu'aucune source lycée ne soit ingérée. Le
primaire est exposé côté serveur sans corpus. Deux options, aucune troisième :
ingérer, ou retirer ces valeurs des enums exposés au modèle.

### 5. Moderniser l'usage de l'AI SDK 7

- `toModelOutput` sur les outils remplace `wrapCurriculumToolResult` : c'est le
  hook prévu pour contrôler ce que le modèle voit, sans détruire le résultat
  structuré destiné à l'UI ;
- `prepareStep` pour faire de la politique RAG un mécanisme (cf. P1-7) ;
- `contextSchema` pour le contexte d'exécution des outils, à la place du contexte
  capturé par fermeture dans `buildChatTools`.

---

## Sur la topologie de services

**Oui, le découpage est solide** — et pour la bonne raison, ce qui est plus rare
que le découpage lui-même.

Le service Python n'existe pas par goût du polyglotte : le sparse appris de
BGE-M3 (`lexical_weights`) n'est exposé que par la lib officielle FlagEmbedding,
sans équivalent TS/Node, et l'audit qui a mené à ce choix est tracé. Les lignes de
coupe sont justes : l'ingestion offline ne partage rien avec le runtime, l'index
est source unique de vérité, la couche LLM appartient exclusivement au serveur.
Un contrat de données versionné (`contract.json`) matérialise la frontière, et le
CI est découpé par app avec des filtres de chemin propres. C'est un design que
peu d'équipes de cette taille tiennent.

Trois réserves, par ordre de gravité :

1. **Le contrat est un contrat de schéma, pas de couverture.** Il fige la forme
   du payload et l'identité du vecteur — il ne dit rien de ce qui est réellement
   indexé, et il n'est pas vérifié dans les deux sens. C'est exactement par là
   que P0-1 est passé, et l'absence de `apps/curriculum` du graphe turbo fait que
   le test censé garder cette frontière ne se déclenche pas quand elle bouge.
2. **Le maillon le plus critique est le moins protégé.** `ai-service` est une
   dépendance dure de la promesse produit, en instance unique, à inférence
   sérialisée, sans trace ni alerte. Le reste de la stack est instrumenté ; cette
   asymétrie est le vrai risque opérationnel de l'architecture.
3. **Deux systèmes d'embeddings et deux stores vectoriels.** Qdrant + pgvector se
   défend (données, cycles de vie et contraintes RGPD différents), mais deux
   *modèles* d'embeddings pour la même dimension ne se défend pas. À unifier sur
   BGE-M3.

Aucune de ces réserves ne remet en cause la topologie. Ce sont des chantiers de
consolidation, pas de refonte.

---

## Ordre d'exécution proposé

| Lot | Contenu | Effet |
|---|---|---|
| 1 | P0-1 taxonomie + test bidirectionnel + entrée turbo | Rétablit le RAG sur histoire-géo et physique-chimie |
| 2 | P0-3 modèles pinnés + P2-9 bump deps | Sort du risque de rupture silencieuse |
| 3 | P0-2 signal de qualité + `evaluate.py` en CI | Rend toute régression ultérieure visible |
| 4 | P1-4 rescore + P2-11 RRF pondéré + P2-10 A/B IDF, mesurés sur le golden set | Gain de recall à coût quasi nul |
| 5 | P1-6 observabilité + réplication `ai-service` | Supprime le SPOF |
| 6 | Suppressions (code mort, second embedder, `apps/web`) | Réduit la surface |
| 7 | Shieldstral, mesuré | Sécurité mineurs |

## Sources

- [Mistral — Models overview](https://docs.mistral.ai/getting-started/models/models_overview)
- [Mistral — Model lifecycle](https://docs.mistral.ai/inference/model-lifecycle)
- [Mistral — Prompt caching](https://docs.mistral.ai/studio-api/conversations/advanced/prompt-caching)
- [Mistral — Shieldstral](https://mistral.ai/news/shieldstral/)
- [Qdrant — Hybrid queries](https://qdrant.tech/documentation/search/hybrid-queries/)
- [Qdrant — Quantization](https://qdrant.tech/documentation/guides/quantization/)
- [Qdrant 1.19 release](https://qdrant.tech/blog/qdrant-1.19.x/)
- [Anthropic — Contextual Retrieval](https://www.anthropic.com/news/contextual-retrieval)
- [AI SDK 7 — Loop control](https://ai-sdk.dev/docs/agents/loop-control)
- Types installés : `node_modules/.pnpm/@ai-sdk+mistral@4.0.5_zod@4.4.3/…/dist/index.d.ts`
