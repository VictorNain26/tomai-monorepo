# ADR 0002 — Périmètre de `apps/ai-service` : vectoriser du texte, rien d'autre

- **Statut** : Accepté
- **Date** : 2026-08-21
- **Décideur** : Victor (tech lead)
- **Portée** : responsabilités et frontières du service Python `apps/ai-service`

## Contexte

`apps/ai-service` a été monté pour une raison unique et étroite : le sparse
appris de BGE-M3 (`lexical_weights`) n'est exposé que par la lib Python
officielle BAAI `FlagEmbedding`, sans équivalent TS/Node (audit mai 2026 :
TEI sert un SPLADE différent, Infinity et Xinference ne l'exposent pas). Le
backend Bun ne pouvait donc pas produire lui-même un vecteur creux cohérent
avec l'index.

C'est un **pont de runtime**, pas un service métier. Mais un service qui
existe attire du travail : au premier semestre 2026, un endpoint `/rerank`
y avait été ajouté, puis retiré le 2026-07-01 faute de tenir la latence.
Sans frontière écrite, le même glissement se reproduira — et c'est
précisément le risque au moment d'ouvrir un chantier de consolidation.

Cet ADR fige la frontière avant que le code ne soit modifié.

## Décision

> **`apps/ai-service` transforme du texte en vecteurs BGE-M3 (dense + sparse
> appris). Il est sans état, agnostique du domaine, et ne parle à aucun autre
> service.**

Toute évolution qui viole une de ces quatre propriétés sort du périmètre et
appartient à `apps/server` (runtime produit) ou `apps/curriculum` (pipeline
de données).

### Dans le périmètre

| Responsabilité | Pourquoi elle est ici |
|---|---|
| Charger et détenir le modèle BGE-M3 | C'est la raison d'être du service |
| Produire `dense` (1024D, L2-normé) + `sparse` (`{indices, values}`) | Le contrat de sortie |
| Politique de concurrence et de batching | Propriété du processus qui détient le modèle |
| Cycle de vie : préchargement au boot, readiness | Personne d'autre ne peut l'observer |
| Authentification **de service** (bearer partagé) | Protège l'endpoint, sans notion d'utilisateur |
| Observabilité de son propre travail | Un service non instrumenté n'est pas exploitable |

### Hors périmètre — et pourquoi

| Interdit | Raison | Propriétaire réel |
|---|---|---|
| Accès à Qdrant (lecture ou écriture) | Le service produit des vecteurs, il ne les range pas. Y toucher le rendrait dépendant du schéma de payload. | `apps/server`, `apps/curriculum` |
| Logique de recherche : fusion, filtres, seuils, top-k | Le service ne sait pas ce qu'est une recherche. | `rag.service.ts` |
| Chunking, préfixe contextuel, extraction PDF | Il reçoit du texte déjà découpé et déjà préfixé. | `apps/curriculum` |
| Tout appel à un LLM : génération, rerank, classification | Le service ne génère rien. C'est exactement ce qui a été retiré en juillet. | `apps/server` |
| Connaissance du domaine scolaire : matière, niveau, cycle, chunk | Il embedde du texte, point. | partout ailleurs |
| Identité utilisateur, quotas, RGPD, données élève | Il porte un bearer de service, pas une identité. | `apps/server` |
| Persistance, cache applicatif, file d'attente | Sans état par construction : toute mémoire le rendrait non remplaçable. | — |

### Conséquence directe sur l'observabilité

Puisque aucune donnée personnelle ne peut légitimement atteindre ce service,
son instrumentation n'a **aucun scrubbing PII à faire** — contrairement à
`apps/server`. Le seul contenu sensible qui transite est le texte de la
requête élève au moment de l'embed de query : il ne doit donc **jamais** être
attaché à une trace, un log ou un événement d'erreur. Longueurs, comptes,
durées et codes d'erreur uniquement.

C'est une frontière plus simple à tenir qu'un scrubbing, et elle découle du
périmètre plutôt que d'une règle ajoutée.

## État vérifié au 2026-08-21

Le périmètre décrit ci-dessus n'est pas un objectif : c'est l'état réel, mesuré
et vérifié avant rédaction.

**Agnosticité du domaine** — recherche de `matiere|niveau|cycle|qdrant|mistral|chunk|eleve|student|postgres|collection`
sur `src/` : 5 occurrences, **toutes dans des commentaires ou docstrings**,
zéro dans le code exécuté. Le seul couplage nominal restant est la mention
« format Qdrant SparseVector » dans `schemas.py` et `embed.py` : `{indices,
values}` est la représentation générique d'un vecteur creux, et le nom du
named vector (`bm25`) vit côté serveur. Le couplage est cosmétique, pas
structurel.

**Dépendances sortantes** — `fastapi`, `pydantic`, `anyio`, `FlagEmbedding`,
`torch`, `numpy`, plus la stdlib. Aucun client base de données, aucun appel
HTTP sortant. Le service est une fonction pure avec un modèle en mémoire.

**Surface d'API** — deux routes : `POST /embed`, `GET /health`. Un test de
non-régression (`test_rerank_endpoint_is_gone`) garde `/rerank` fermé.

**Consommateurs** — deux, et seulement deux :
`apps/server/src/services/ai-service.client.ts` (un texte à la fois, embed de
query) et `apps/curriculum/src/clients/ai_service.py` (batch, ingestion).

## Mesures de référence (2026-08-21)

Conteneur de dev `tomai-ai-service-dev` : **2 vCPU, 4 Go, FP32**, modèle en
cache. Ce sont les premières mesures du service ; elles remplacent les
estimations qui circulaient jusqu'ici.

| Grandeur | Mesure |
|---|---|
| Embed 1 texte, à chaud, p50 | **577 ms** (min 523, max 678, écart-type 59, n=12) |
| Premier appel après inactivité | ~3,5 s |
| Débit maximum d'un conteneur | **~1,7 requête/s** |
| Amortissement du batch | 454 ms/texte à n=1 → 166 à n=8 → **133 à n=32** (×3,4) |
| Sortie | dense 1024D, norme L2 = 1,000000 ; sparse creux |

**Sérialisation confirmée par la mesure.** Wall-clock en fonction du nombre de
requêtes concurrentes, contre une baseline à chaud de 577 ms :

| Concurrence | Wall-clock | Rapport au p50 | Latence max observée |
|---|---|---|---|
| 1 | 521 ms | 0,90 | 521 ms |
| 2 | 1 153 ms | 2,00 | 1 152 ms |
| 4 | 1 734 ms | 3,00 | 1 731 ms |
| 8 | 3 245 ms | 5,62 | 3 237 ms |

La croissance est linéaire et la requête la plus lente voit systématiquement
une latence égale au wall-clock total : les appels font la queue. C'est
l'effet combiné de `--workers 1` (Dockerfile) et du `anyio.Lock` global
(`main.py`), ce dernier étant nécessaire car `BGEM3FlagModel` n'est pas
documenté thread-safe.

> Correction : l'audit du 2026-08-21 estimait « de l'ordre de la dizaine de
> requêtes par seconde ». La mesure donne **1,7 req/s** sur 2 vCPU, soit un
> ordre de grandeur d'écart. L'estimation était fausse.

## Amendement du 2026-08-21 — l'export de télémétrie est dans le périmètre

> Cet ADR a servi, le jour même de sa rédaction, à refuser un exporteur
> OpenTelemetry vers Langfuse au motif « aucune dépendance sortante ». **C'était
> une sur-application de la règle**, et l'amendement le corrige explicitement
> plutôt que de laisser une décision changer en silence.

La quatrième propriété — « ne parle à aucun autre service » — vise les
dépendances **fonctionnelles** : celles sans lesquelles le service ne peut pas
rendre son service. Un exporteur de télémétrie n'en est pas une :

- il est **hors du chemin de réponse** : l'export est asynchrone et par lots,
  une destination injoignable n'empêche pas `/embed` de répondre ;
- il ne crée **aucun couplage de données** : aucun schéma partagé, aucun
  contrat à maintenir avec un autre service du produit ;
- le tableau « Dans le périmètre » listait déjà « observabilité de son propre
  travail » — exporter ce qu'on observe en fait partie.

Le besoin qui a fait bouger la ligne est concret : aujourd'hui, pour savoir
pourquoi la question d'un élève a été lente, il faut lire les logs du conteneur
sur la plateforme d'hébergement et les croiser à la main avec la trace du
serveur. Deux systèmes, deux horloges, aucune corrélation. C'est un défaut
d'exploitation réel, pas un confort.

**Reste inchangé, et non négociable** : le texte embeddé n'est attaché à aucun
signal — log, span ou erreur. Un exporteur élargit la destination, jamais le
contenu.

**Reste interdit** : tout appel sortant dont dépend la production du résultat
(base, index, LLM, service tiers). La distinction est là : le service peut
*raconter* ce qu'il fait, il ne peut pas *demander de l'aide* pour le faire.

## Conséquences

1. **Le levier de débit est la réplication ou le micro-batching**, jamais
   l'augmentation des workers dans un conteneur : chaque worker rechargerait
   2,4 Go de modèle dans 4 Go de RAM.
2. Le batch amortit d'un facteur 3,4. Un micro-batching qui regrouperait les
   requêtes concurrentes en un seul forward pass est donc le gain le plus
   important disponible — et il reste dans le périmètre, puisque la politique
   de batching appartient au processus qui détient le modèle.
3. Toute proposition d'ajout au service se teste contre les quatre propriétés
   de la décision. Si elle en casse une, elle est refusée ou déplacée.
4. Cet ADR est le garde-fou du chantier de consolidation en cours
   (`docs/superpowers/plans/2026-08-21-ai-service-consolidation.md`).

## Alternatives écartées

- **Remplacer le service par TEI (HuggingFace)** : TEI apporte le dynamic
  batching et la maintenance, mais sert un SPLADE différent du sparse appris
  BGE-M3 — il ne produit pas le vecteur attendu par l'index. Il n'a pas non
  plus d'authentification native, alors que le service actuel porte un bearer.
- **Réintégrer l'embedding dans `apps/server`** : impossible, c'est la raison
  d'être du service (pas d'implémentation TS du sparse appris).
- **Élargir le service à un « service IA » généraliste** (rerank, génération,
  OCR) : c'est le glissement que cet ADR interdit. Chaque ajout couple un
  cycle de vie de modèle supplémentaire au chemin chaud du RAG, et l'épisode
  `/rerank` a montré le coût — 2 Go de RAM et une latence inexploitable pour
  zéro effet en production.
