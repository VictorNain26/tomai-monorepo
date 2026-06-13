# Design — Dev-env vérifiable (`pnpm doctor`) + audit des tests sans faux positif

**Date** : 2026-06-13
**Statut** : en revue
**Périmètre** : fiabilité de l'environnement de dev local et confiance dans les tests, comme fondation pour reprendre le développement (curriculum #203 en ligne de mire).
**Hors scope** : archi du dev-env (déjà décidée et livrée — `docs/superpowers/specs/2026-06-10-dev-environment-architecture-design.md`), prod/Koyeb, le `smoke-test.yml` CI post-deploy (smoke *prod*, distinct du doctor *local*).

## 1. Problème (constaté de visu, 2026-06-13)

L'archi dev-env hybride (compose racine, `pnpm setup`/`dev`/`dev:down`) est saine et implémentée. Mais **rien ne prouve que la stack complète marche**, et la réalité dérive en silence :

- **qdrant down 17 h sans aucun signal** : `docker compose ps` ne montrait que `postgres` + `ai-service` healthy ; qdrant n'avait jamais été créé (volume créé from scratch quand je l'ai levé). L'audit curriculum échouait sur `Connection refused`. Le RAG — donc curriculum #203 — était mort sans que ce soit visible.
- **Le server dégrade en silence** : `/api/curriculum-health` calcule honnêtement `status: qdrantOk && aiOk ? 'healthy' : 'degraded'` (`health.routes.ts:28`), mais **rien ne l'appelle** dans le flux de démarrage. Un dev lance `pnpm dev`, le server tourne « degraded », et il ne le sait pas.
- **Pas de preuve end-to-end** : les briques honnêtes existent (`/curriculum-health`, `/test-rag`, ai-service `/health` avec `embed_loaded`), mais aucune commande ne les enchaîne pour **échouer bruyamment** quand le RAG ne répond pas.

En parallèle, les suites de tests contiennent des **faux positifs** (tests vacués / sur-mockés qui passent à vide) et des **fallbacks silencieux** (`catch` qui avalent l'erreur) — la phase 5 en a déjà attrapé trois réels (test `refreshSession` qui ne peut pas throw ; `setResourceMapping` jamais appelé car flux non amorcé ; offload trivialement vert sous `TestClient`). Ces patterns donnent une fausse confiance.

## 2. Objectif

Une fondation **vérifiable et honnête** avant de reprendre le dev :

1. **`pnpm doctor`** — une commande qui prouve la stack complète end-to-end (services + RAG réel), avec exit code franc et une ligne PASS/FAIL par check. Zéro « degraded » masqué, zéro skip silencieux.
2. **Fail-fast dans `pnpm dev`** — un sous-ensemble rapide du doctor abort avant de lancer les apps si un service critique est down. « qdrant absent » devient impossible à rater.
3. **Tests dignes de confiance** — audit des suites pour traquer faux positifs et fallbacks silencieux, puis correction des confirmés avec preuve *red-when-broken*.

Critères de succès :
- Sur une stack complète saine : `pnpm doctor` sort `0`, chaque check `PASS`, le roundtrip RAG (embed → qdrant → search) réussit pour de vrai.
- Si **n'importe quel** service critique est down (qdrant, ai-service, postgres) ou si le RAG ne répond pas : `pnpm doctor` sort `≠0` avec le check fautif en `FAIL` et la raison précise. Jamais de vert sur un RAG mort.
- Un token/env manquant requis pour un check ⇒ `FAIL` explicite (« AI_SERVICE_TOKEN absent — roundtrip RAG impossible »), **jamais** un skip silencieux.
- Phase B : chaque finding de test corrigé est prouvé *red-when-broken* (échoue si on casse le comportement testé).

## 3. Architecture

Deux phases, une spec, deux plans d'implémentation distincts. **Phase A d'abord** (petite, débloque curriculum) ; **Phase B ensuite** (plus large, itérable par app).

### Phase A — `scripts/doctor.mjs` (`pnpm doctor`)

Script Node (cohérent avec `scripts/dev.mjs`/`setup.mjs`), **sans nouvelle dépendance** : `node:child_process` pour Docker, `fetch` global pour les probes HTTP et le roundtrip qdrant/ai-service. Lit la config au runtime depuis les `.env` (côté machine du dev — pas une lecture par l'assistant).

**Contrat d'un check** : `{ name, run: async () => void }`. `run` lève une `Error` (message = raison du FAIL) ou résout (PASS). Le runner imprime `PASS <name>` / `FAIL <name> — <raison>`, agrège, et `process.exit(nbFail > 0 ? 1 : 0)`. Un check **conditionnel non applicable** (ex. server pas lancé) est imprimé `SKIP <name> — <raison visible>` et ne compte pas comme PASS — la raison est toujours affichée (pas de silence).

**Liste des checks (ordre = dépendances)** :

| # | Check | Comment | FAIL si |
|---|-------|---------|---------|
| 1 | Docker daemon | `docker version` | daemon injoignable |
| 2 | Conteneurs healthy | `docker compose ps --format json` | postgres / qdrant / ai-service absent ou non-`healthy` |
| 3 | Postgres + `vector` + migrations | `psql` extension `vector` présente ; `drizzle` migrations appliquées (compare le dossier `drizzle/` au `__drizzle_migrations`) | extension absente, ou migrations en retard |
| 4 | qdrant `/healthz` | `fetch http://localhost:6333/healthz` | non-200 / refused |
| 5 | ai-service `/health` | `fetch :8001/health`, exige `embed_loaded===true && rerank_loaded===true` | `loading` ou un modèle non chargé |
| 6 | **Roundtrip RAG réel** | embed → qdrant → search, collection jetable `_doctor_smoke` (voir §4) | toute étape échoue |
| 7 | Server `/api/curriculum-health` *(conditionnel)* | si `:3000` répond : exige `status==='healthy'` ; sinon `SKIP` (« server non lancé ») | server up **et** `degraded` |

Les valeurs (URLs, ports, token, collection) viennent de l'env réel du dev pour rester aligné sur ce que server/curriculum consomment (`QDRANT_URL`, `QDRANT_API_KEY`, `AI_SERVICE_URL`, `AI_SERVICE_TOKEN`). Un env requis manquant ⇒ FAIL explicite du check concerné.

### Phase A bis — fail-fast dans `pnpm dev`

`scripts/dev.mjs` exécute, **avant** `turbo run dev`, un sous-ensemble « infra » du doctor (checks 1, 2, 4, 5 — services seulement, **pas** le roundtrip RAG complet ni les migrations, pour rester rapide). Si un check critique échoue, `dev` abort avec le message du doctor au lieu de lancer les apps sur une infra cassée. Implémentation : factoriser les checks dans `scripts/doctor-checks.mjs` (réutilisé par `doctor.mjs` et `dev.mjs`) pour une seule source de vérité.

**Pas de gate pre-push/CI sur le doctor** : le roundtrip RAG est infra-dépendant et trop lent pour bloquer chaque push (cohérent avec la règle « no-silent-migration-gates » : pas de gate lourd ajouté en douce). Le doctor est **manuel + fail-fast léger dans `dev`**.

### Phase B — audit des tests (faux positifs + fallbacks silencieux)

Audit adversarial multi-agents, **par app**, **chemins critiques d'abord** (auth, RAG/curriculum, mutations de données, paiements), puis élargissement. Chaque agent traque deux familles :

- **Fallback silencieux** : `catch` qui logge/avale sans remonter ni à l'UI ni à l'appelant, là où l'erreur devrait être visible ; valeurs de retour ignorées ; `try/finally` sans `catch` masquant un rejet.
- **Faux positif** : test sans assertion sur l'effet ; test qui mocke la logique même qu'il prétend vérifier ; assertion trivialement vraie (état jamais modifié avant l'assertion) ; mock d'un chemin impossible en prod (ex. fonction qui ne peut pas throw).

Sortie par agent : liste `fichier:ligne` + sévérité + nature. On corrige les **confirmés** (un second agent vérifie que ce n'est pas un faux signalement), chaque correction prouvée *red-when-broken* (le test doit échouer si on retire le comportement). Méthode déjà éprouvée sur ce repo (phase 5). Option de fin de phase, **après mesure** : une garde lint minimale « pas de test sans assertion » si la valeur est démontrée — jamais activée en douce.

## 4. Roundtrip RAG du doctor (check #6, détail)

Auto-suffisant, **ne dépend pas** de la collection `tomai_educational` (qui peut ne pas exister avant l'indexation curriculum — c'est justement #203) :

1. `POST {AI_SERVICE_URL}/embed` avec `Authorization: Bearer {AI_SERVICE_TOKEN}`, body `{ texts: ["doctor smoke test"] }` → vecteur dense 1024-D (+ sparse). Token absent ⇒ FAIL explicite.
2. `PUT {QDRANT_URL}/collections/_doctor_smoke` (header `api-key` si `QDRANT_API_KEY`) — crée la collection (size 1024, distance Cosine).
3. `PUT .../collections/_doctor_smoke/points?wait=true` — upsert 1 point avec le vecteur dense.
4. `POST .../collections/_doctor_smoke/points/search` avec le même vecteur, `limit:1` → attend le point en retour (score ≈ 1).
5. `DELETE .../collections/_doctor_smoke` — nettoyage (dans un `finally` pour ne pas laisser de résidu même en cas d'échec partiel).

Tout échec d'étape ⇒ check #6 FAIL avec l'étape fautive. Prouve la chaîne embed→qdrant que curriculum utilisera, sans coupler le doctor à l'état d'indexation.

## 5. Flux

```
pnpm doctor          # preuve complète : services + migrations + RAG réel. Exit 0/1, PASS/FAIL par ligne.
pnpm dev             # fail-fast infra (checks 1,2,4,5) -> sinon abort ; puis apps
```

Reprise curriculum #203 : `pnpm setup` (si besoin) → `pnpm doctor` (vert) → on sait que la fondation RAG tient avant d'écrire l'indexation.

## 6. Décisions (positions tech-lead)

- **Doctor en script ops, pas en test unitaire** : c'est de la santé d'environnement, pas une assertion de code ; manuel + fail-fast `dev`. Ne pollue pas les suites bun/jest/pytest.
- **Roundtrip sur collection jetable** plutôt que sur `tomai_educational` : prouve la chaîne sans dépendre de l'indexation (découplé de #203).
- **FAIL explicite, jamais SKIP silencieux** sur un check applicable : un token/env manquant requis pour un check est une panne, pas une dispense.
- **Pas de gate pre-push** sur le doctor : trop infra-dépendant ; fail-fast `dev` suffit à rendre les pannes visibles au quotidien.
- **Phase B adversariale + red-when-broken** : la seule méthode qui a déjà prouvé sa valeur ici ; bornée d'abord au critique pour rester maîtrisée.
- **Source unique des checks** (`doctor-checks.mjs`) partagée `doctor`/`dev` : pas de divergence entre la commande de preuve et le fail-fast.

## 7. À vérifier en phase plan (doc-first)

- API REST qdrant v1.18.2 : forme exacte de create-collection / upsert / search / delete (champs `vectors.size`/`distance`, `points`, `?wait=true`) — confirmer contre la doc qdrant de la version épinglée.
- Détection « migrations à jour » Drizzle : comparer `drizzle/` à la table `__drizzle_migrations` (lire comment `db:migrate` la peuple) plutôt qu'un re-run.
- Noms de conteneurs (`tomai-postgres-dev`, `tomai-qdrant-dev`, `tomai-ai-service-dev` ?) et format `docker compose ps --format json` (vérifier les clés `Service`/`Health`).
- Garde de `/api/curriculum-health` (`health.routes.ts:14` renvoie 404 sous condition) : confirmer qu'elle est appelable en dev.

## 8. Hors scope (explicite)

- Toute modif de l'archi dev-env (compose, `setup`/`dev`) au-delà du fail-fast et de la lecture des checks.
- L'indexation curriculum elle-même (#203) — le doctor en est le prérequis, pas le contenu.
- Refactor applicatif non lié aux findings de tests.
