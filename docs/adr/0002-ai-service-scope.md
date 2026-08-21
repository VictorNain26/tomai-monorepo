# ADR 0002 — Ce que fait `apps/ai-service`, et comment savoir si une idée y a sa place

- **Statut** : Accepté, amendé le 2026-08-21
- **Date** : 2026-08-21
- **Décideur** : Victor (tech lead)
- **Portée** : raison d'être et frontières du service Python `apps/ai-service`

## Pourquoi ce service existe

Le hybrid search de Qdrant a besoin, pour chaque question d'élève, d'un vecteur
**dense** et d'un vecteur **creux** produits par le même modèle que l'index.
BGE-M3 sait faire les deux en un seul passage, mais son sparse appris
(`lexical_weights`) n'est exposé que par la lib Python officielle BAAI
`FlagEmbedding`. Aucun équivalent TS/Node ne le reproduit — TEI sert un SPLADE
différent, Infinity et Xinference ne l'exposent pas (audit mai 2026).

Le backend Bun ne pouvait donc pas produire lui-même un vecteur cohérent avec
l'index. D'où un service Python, minimal, dont c'est l'unique justification.

C'est un **pont de runtime**, pas un service métier. Cette distinction porte
tout le reste de l'ADR.

## Comment il marche

Un seul chemin, quatre étapes.

```
POST /embed  { "texts": [...] }
   │
   ├─ 1. Authentification de service
   │     Bearer partagé, comparaison constant-time. Pas d'identité
   │     utilisateur — le service ne sait pas qui pose la question.
   │
   ├─ 2. Mise en file
   │     Un verrou global sérialise l'inférence : BGEM3FlagModel n'est pas
   │     documenté thread-safe. L'attente est mesurée séparément du calcul,
   │     parce que les deux appellent des réponses opposées (§Ce qu'on sait).
   │
   ├─ 3. Inférence, hors de l'event loop
   │     run_in_threadpool → BGE-M3 → dense_vecs + lexical_weights,
   │     un seul forward pass pour les deux.
   │
   └─ 4. Traduction
         lexical_weights {token_id: poids} → {indices[], values[]}
         C'est la représentation générique d'un vecteur creux ; le nom du
         vecteur nommé côté index (`bm25`) n'apparaît pas ici.

GET /health  → modèle chargé, identité du modèle, précision (FP16 ou non)
```

Le modèle est préchargé au démarrage (`lifespan`), avant qu'uvicorn n'accepte
la première connexion. Conséquence utile : le port ne s'ouvre qu'une fois le
service réellement prêt, et un healthcheck qui répond est un healthcheck qui
dit vrai.

## La frontière, et comment l'appliquer

> **Le service transforme du texte en vecteurs. Il ne sait rien du produit
> qu'il sert.**

Plutôt qu'une liste d'interdits — forcément incomplète, et qui vieillit mal —
voici les **quatre questions** à poser à toute idée qui voudrait entrer ici.
Une seule réponse « oui » suffit à la faire sortir du périmètre.

| Question | Si oui, alors… | Va plutôt dans |
|---|---|---|
| Est-ce que ça garde un état entre deux requêtes ? | le service cesse d'être remplaçable et redéployable à chaud | `apps/server` |
| Est-ce que ça a besoin de connaître le domaine scolaire — une matière, un niveau, un chunk, un élève ? | le service devient couplé au produit et suit ses évolutions | `apps/server`, `apps/curriculum` |
| Est-ce que **produire la réponse** dépend d'un appel sortant ? | le service hérite de la disponibilité d'un tiers sur son chemin critique | `apps/server` |
| Est-ce que ça fait autre chose que vectoriser — ranger, chercher, générer, juger ? | ce n'est plus un pont, c'est un service métier | selon le cas |

**Ce que ces questions laissent volontairement ouvert** : tout ce qui concerne
*comment* le service vectorise. Batching, quantification, précision, format de
sortie, politique de concurrence, choix de modèle, manière de s'observer — ce
sont des questions internes, et les trancher est précisément le travail du
service. La frontière protège le *quoi*, pas le *comment*.

### Deux cas qui ont déjà servi de test

**`/rerank`, ajouté puis retiré en juillet 2026.** Quatrième question : reranker
n'est pas vectoriser, c'est juger une pertinence. Le périmètre l'aurait
signalé ; c'est la latence mesurée (43 à 180 s pour 20 candidats) qui a
tranché. Les deux allaient dans le même sens.

**Un exporteur de télémétrie, refusé puis accepté le même jour.** J'ai d'abord
invoqué « aucune dépendance sortante » — troisième question. Mais elle
demande si *produire la réponse* en dépend, et un export est asynchrone,
par lots, hors du chemin critique : une destination injoignable n'empêche pas
`/embed` de répondre. La réponse était donc non, et le refus était une
sur-application de la règle.

C'est la raison de la formulation actuelle : une liste d'interdits invite à
chercher si l'idée y figure ; une question invite à comprendre pourquoi.

## La seule règle qui ne se discute pas

**Le texte reçu n'est attaché à aucun signal** — log, span, trace, ou événement
d'erreur. Longueurs, comptes, durées, types d'erreur : oui. Contenu : jamais.

Elle ne découle pas d'un principe d'architecture mais du produit : les textes
qui passent ici sont des questions d'enfants. Aucune commodité d'exploitation
ne la relativise. Deux tests la tiennent, sur le chemin nominal et sur le
chemin d'erreur — c'est celui-là qui fuit d'habitude, en faisant remonter
l'entrée dans le message d'exception.

Corollaire agréable : puisque aucune identité utilisateur n'atteint ce service,
son instrumentation n'a **aucun masquage à faire**. Une frontière est plus
simple à tenir qu'un filtre.

## Ce qu'on sait du service, mesuré

Conteneur de dev, 2 vCPU, 4 Go, FP32, modèle en cache. Premières mesures
réelles ; elles remplacent des estimations qui circulaient sans source.

| Grandeur | Mesure |
|---|---|
| Embed d'une query courte, à chaud | **577 ms** (p50, n=12) |
| Premier appel après inactivité | ~3,5 s |
| Débit d'un conteneur | **~1,7 requête/s** |
| Empreinte mémoire sous charge | **1,15 Gio** en FP32 |
| Batch : 1 → 8 → 32 textes courts | 454 → 166 → 133 ms/texte |
| Chunk long (~1 600 caractères) | ~3 s/texte — le temps croît avec la longueur |
| Sortie | dense 1024D, norme L2 = 1,000000 ; sparse creux |

**La sérialisation est prouvée, pas déduite.** Wall-clock selon la concurrence :

| Requêtes simultanées | 1 | 2 | 4 | 8 |
|---|---|---|---|---|
| Wall-clock | 521 ms | 1 153 ms | 1 734 ms | 3 245 ms |

Croissance linéaire, et la requête la plus lente voit toujours une latence
égale au wall-clock total : les appels font la queue.

**Ce que ça dit, et c'est le plus utile** : sous charge, le temps supplémentaire
part *intégralement* en attente, jamais en inférence — celle-ci reste plate
autour de 395 ms. Le goulot est le **débit**, pas le CPU. Micro-batching et
réplication répondent au bon problème ; FP16 et une instance plus puissante
répondent au mauvais.

> Deux estimations corrigées par ces mesures : l'audit annonçait « une dizaine
> de requêtes/s » (c'est 1,7) et le README « ~3 Go de RAM » (c'est 1,15 Gio).

## État vérifié, pas déclaré

- **Agnosticité du domaine** — recherche de `matiere|niveau|cycle|qdrant|mistral|chunk|eleve|student|postgres|collection`
  sur `src/` : 5 occurrences, **toutes en commentaire**, zéro dans le code
  exécuté.
- **Dépendances** — `fastapi`, `pydantic`, `anyio`, `FlagEmbedding`, `torch`,
  `numpy`, plus la stdlib. Aucun client base, aucun appel HTTP sortant sur le
  chemin de réponse.
- **Surface** — deux routes, `POST /embed` et `GET /health`. Un test de
  non-régression garde `/rerank` fermé.
- **Consommateurs** — deux : `apps/server` (une query à la fois) et
  `apps/curriculum` (batch, à l'ingestion).

## Quand rouvrir cet ADR

Il a déjà été amendé une fois, le jour de sa rédaction. C'est normal et ça
doit rester possible. Trois situations le justifieraient :

- **Un consommateur tiers apparaît.** Le contrat de sortie devient public et
  mérite un versionnage explicite.
- **Le modèle change.** Le service existe pour le sparse appris de BGE-M3 ; si
  un embedder plus adapté émerge — ou si un serveur mature expose enfin ce
  sparse — la raison d'être change et l'ADR avec.
- **Une des quatre questions gêne une évolution manifestement saine.** C'est le
  signal que la question est mal formulée, pas que l'évolution est mauvaise.
  L'épisode de l'exporteur en est l'exemple : la règle avait raison sur le
  principe et tort sur ce cas.

## Alternatives écartées

- **TEI (HuggingFace)** — apporte le dynamic batching et la maintenance, mais
  sert un SPLADE différent du sparse appris BGE-M3 : il ne produit pas le
  vecteur attendu par l'index. Pas d'authentification native non plus.
- **Réintégrer l'embedding dans `apps/server`** — impossible, c'est la raison
  d'être du service.
- **En faire un « service IA » généraliste** (rerank, génération, OCR) — chaque
  ajout couple un cycle de vie de modèle supplémentaire au chemin chaud du RAG.
  L'épisode `/rerank` en a montré le coût : 2 Go de RAM et une latence
  inexploitable, pour zéro effet en production.
