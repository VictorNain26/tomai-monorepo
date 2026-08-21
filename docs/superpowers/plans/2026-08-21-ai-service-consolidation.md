# Consolidation `apps/ai-service` — plan phasé

> **Périmètre gardé par `docs/adr/0002-ai-service-scope.md`.** Toute tâche de ce
> plan se teste contre les quatre propriétés de l'ADR — sans état, agnostique du
> domaine, sans dépendance sortante, vectorisation seule. Une tâche qui en casse
> une sort du plan, elle ne le fait pas évoluer.

**But :** rendre le service **observable, mesuré et dimensionné**, sans élargir
d'un pouce ce qu'il fait. Aucune fonctionnalité nouvelle.

**Principe directeur :** on n'optimise rien qu'on n'a pas mesuré. L'ordre des
phases n'est pas une préférence, c'est une dépendance : A1 produit l'instrument,
A2 produit le chiffre, A3 décide sur le chiffre.

**Déclencheur :** audit `docs/audits/2026-08-21-rag-agent-ia.md`, constat P1-6 —
le composant dont dépend chaque recherche RAG est le seul de la stack sans
observabilité.

## État d'avancement

| Phase | Contenu | Statut |
|---|---|---|
| A0 | Remise à niveau doc + mémoire | ✅ fait le 2026-08-21 (`9521c0b`) |
| A0bis | Contrat de périmètre (ADR 0002) + mesures de référence | ✅ fait le 2026-08-21 |
| A1 | Observabilité : Sentry Python + logs structurés | ✅ fait le 2026-08-21 |
| A2 | Baseline de charge reproductible | 🔴 **bloqué** — aucune instance déployée |
| A3 | Concurrence et dimensionnement, décidés sur A2 | à faire |
| A4 | Montée de versions sous garde-fou | à faire |

---

## A0 — Remise à niveau doc et mémoire · fait

La doc décrivait un service qui n'existait plus. Corrigé : modèle de concurrence
documenté (il ne l'était nulle part), port hôte 8001 vs conteneur 8000, chemin
compose, latences sourcées, sections Observabilité et Rerank ajoutées. Côté
`apps/curriculum` : recommandations backend tranchées, section BM25 marquée
terminée, couverture réelle du corpus explicitée (collège seul).

**Correction produite** : la vraie raison de l'abandon du reranker est la
latence CPU mesurée (43–180 s pour 20 candidats), pas l'origine du modèle. Le
mauvais critère avait contaminé l'audit, qui a été rétracté sur ce point.

## A0bis — Contrat de périmètre · fait

`docs/adr/0002-ai-service-scope.md`. Frontière écrite avant modification du code,
avec l'état vérifié (agnosticité du domaine prouvée par recherche, dépendances
sortantes énumérées, surface d'API fermée) et les premières mesures du service.

**Correction produite** : le débit réel est de ~1,7 req/s sur 2 vCPU, pas « une
dizaine » comme l'estimait l'audit.

---

## A1 — Observabilité

**Objectif :** savoir ce que fait le service en production. Rien de plus.

**Décision d'arbitrage (Victor, 2026-08-21) :** aucun backend OTLP n'était
provisionné, donc **Sentry + logs structurés** plutôt qu'un OpenTelemetry qui
émettrait des spans vers le vide.

> **Révisé le 2026-08-21 (fin de journée) : la destination existe désormais.**
> Un projet Langfuse Cloud EU (`tomai`) a été créé, et Victor a tranché de
> passer sur Langfuse. Cela **ne change pas A1**, qui reste livré tel quel, pour
> deux raisons :
>
> 1. Les cinq questions de l'ai-service sont déjà répondues par ses logs
>    structurés — c'est prouvé, le tableau de sérialisation a été reconstitué
>    depuis `docker logs` sans outil externe.
> 2. Un exporteur OTLP ajouterait une **dépendance sortante** à un service dont
>    l'ADR 0002 fait un point d'honneur à n'en avoir aucune, pour un gain
>    marginal : Langfuse est bâti pour des générations LLM, l'ai-service
>    n'en produit aucune.
>
> **La cible de Langfuse est `apps/server`**, où l'instrumentation GenAI existe
> déjà et où l'export ne coûte que deux variables d'environnement. Corréler les
> deux (propagation du contexte de trace du serveur vers l'ai-service) est une
> évolution réelle mais distincte — à ouvrir quand un besoin la justifie, pas
> par principe.

Contenu :

- `sentry-sdk` avec l'intégration FastAPI, activation strictement conditionnée à
  `SENTRY_DSN` (absent en dev = pas d'init), région EU, `environment` aligné sur
  `ENVIRONMENT`.
- Logs structurés JSON sur `/embed` : durée, nombre de textes, longueur totale,
  issue. **Jamais le texte lui-même** — cf. ADR 0002 §Conséquence directe sur
  l'observabilité.
- Mesure de l'attente sur le lock, séparée du temps d'inférence. C'est le seul
  couple de métriques qui permettra à A3 de décider : si l'attente domine, le
  problème est le débit ; si l'inférence domine, c'est le modèle ou le CPU.
- `/health` enrichi de ce qui est déjà connu du processus, sans nouvel état.

Critère de fin : sur une charge concurrente locale, les logs permettent de
retrouver le tableau de sérialisation de l'ADR 0002 sans instrumentation externe.

### Résultat — les quatre critères sont tenus

1. **Reconstitution depuis les logs seuls** : oui. Rafale de 8 requêtes
   simultanées, lue dans `docker logs` sans aucun outil externe —
   `lock_wait_ms` 0 → 2 756 ms (linéaire), `inference_ms` 450 → 404 ms
   (plate, amplitude 84 ms).
2. **Budget de latence** : p50 595 ms contre 577 ms, soit **+3,1 %** — sous
   les 5 % (seuil 606 ms).
3. **Erreur observable sans fuite** : `status: "error"` + `error_type`, jamais
   le message d'exception ni le texte. La réponse HTTP est un 500 opaque.
4. **Test anti-fuite** : deux tests, chemin nominal et chemin d'erreur.

25 tests au vert (13 nouveaux), écrits **avant** l'implémentation et vus
échouer pour la bonne raison.

### Ce que A1 a déjà appris, et qui oriente A3

Le discriminant est tranché : **sous charge, le temps supplémentaire part
intégralement en file d'attente, jamais en inférence**. L'inférence est plate
à ~395 ms quel que soit le nombre de requêtes simultanées.

Conséquence pour A3 : le problème est le **débit**, pas le CPU. Le
micro-batching et la réplication sont les bons leviers ; FP16 et une instance
plus puissante ne répondraient pas au bon problème. A2 reste nécessaire pour
mesurer cela sur l'instance réelle, mais la direction n'est plus une
supposition.

### Trou trouvé et bouché pendant le lot

`emit_record` écrivait sur un logger applicatif en INFO. Uvicorn n'appelle pas
`basicConfig` : sans handler attaché, l'enregistrement était construit,
sérialisé, puis silencieusement jeté. Les tests qui interceptaient `emit_record`
ne pouvaient pas le voir. Un test dédié (`test_emitted_record_actually_reaches_the_log_stream`)
capture désormais la sortie réelle.

**Action hors code, pour Victor :** provisionner le DSN. Recommandation — un
projet Sentry dédié `tomai-ai-service` plutôt que la réutilisation de celui du
serveur : volumes, quotas et destinataires d'alerte différents. Le code est
identique dans les deux cas.

## A2 — Baseline de charge · BLOQUÉ

> **Vérifié le 2026-08-21 : il n'y a pas d'instance à mesurer.**
> `https://tomai-ai-service-tomia-fd296bf5.koyeb.app/health` renvoie la page
> Koyeb « No active service ». `https://api.tomia.fr/health` renvoie 404. Le
> cluster Qdrant Cloud référencé répond 404 sur toutes ses routes, y compris
> `/` — son ID est inconnu de l'ingress, donc il est supprimé. La collection
> locale existe avec le bon schéma mais contient **0 point**.
>
> Le CI le signalait : `smoke-test.yml` pingue `api.tomia.fr` à chaque push sur
> main et n'a **jamais réussi sur les 60 derniers runs, depuis le 2026-06-13**.
>
> A2 ne peut pas démarrer avant une remise en route de l'infrastructure, qui
> est un chantier d'ops distinct de ce lot. La baseline sur conteneur local
> (2 vCPU, cf. ADR 0002) reste valide et suffit à orienter A3.

**Objectif :** un chiffre reproductible, sur l'instance réelle, pas sur un
conteneur de dev.

- Script de charge versionné, rejouable, qui produit le tableau
  concurrence → wall-clock → latence p50/p95 de l'ADR 0002.
- Exécution contre le déploiement Koyeb, pas seulement en local.
- Établir le type d'instance réellement provisionné — non vérifiable depuis le
  dépôt aujourd'hui.
- Mesurer FP16 contre FP32 sur la même instance : le gain RAM est documenté, le
  coût en qualité et l'effet sur la latence CPU ne le sont pas.

Critère de fin : on sait combien d'élèves simultanés le service tient avant que
la latence de recherche ne devienne perceptible, et on sait quel réglage change
ce nombre.

## A3 — Concurrence et dimensionnement

**Ne commence pas avant que A2 ait livré ses chiffres.** Les options ci-dessous
sont des candidats, pas un programme — A2 en éliminera.

- **Micro-batching** : regrouper les requêtes concurrentes en un forward pass.
  Le batch amortit d'un facteur 3,4 (mesuré), c'est le plus gros gain
  identifié. Reste dans le périmètre : la politique de batching appartient au
  processus qui détient le modèle.
- **Réplication horizontale** : plusieurs conteneurs derrière le service Koyeb.
  Simple, sans changement de code, coût linéaire.
- **FP16** : moitié de RAM, donc instance plus petite ou marge plus grande.
  Conditionné à A2.
- **Ce qu'on ne fera pas** : augmenter `--workers`. Chaque worker recharge
  2,4 Go de modèle dans 4 Go de RAM.

## A4 — Montée de versions

Avec la baseline de A2 comme garde-fou de régression, dans cet ordre :
`FlagEmbedding` 1.3 → 1.4 (avril 2026), puis `torch` et `fastapi`. Une montée à
la fois, avec re-mesure entre chaque : un changement de version d'embedder peut
déplacer les vecteurs, donc invalider l'index.

**Point de vigilance** : si les vecteurs produits changent, la collection Qdrant
doit être réindexée — sinon la query et l'index vivent dans deux espaces
différents. Vérification obligatoire avant merge : embedder un texte témoin
avant et après, comparer la similarité cosinus.

---

## Hors périmètre, en file

Ces sujets sont réels mais n'appartiennent pas à ce lot.

- **P0-1 — taxonomie matières agent ↔ index.** Le correctif le plus rentable du
  dépôt : trois slugs exposés au modèle renvoient zéro résultat en permanence.
  Une PR, côté `apps/server` et `apps/curriculum`.
- **Casting des modèles Mistral.** Matrice usage → modèle pinné, absorbe le
  constat P0-3 (`ministral-*-latest` pointent sur des références retirées).
  Sujet `apps/server`, à traiter quand on ouvrira le serveur.
- **Couverture lycée du corpus.** Chantier de données, `apps/curriculum`.
