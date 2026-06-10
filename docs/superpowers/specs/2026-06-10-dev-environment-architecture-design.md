# Design — Architecture de l'environnement de développement

**Date** : 2026-06-10
**Statut** : en revue
**Périmètre** : environnement de **développement local**. Hors scope : Koyeb, prod, déploiement, CI (sauf si un changement de structure dev l'impacte mécaniquement).

## 1. Problème

L'environnement de dev actuel mélange deux modèles d'exécution incohérents, ce qui rend impossible de « lancer l'app complète » proprement.

1. **Clash de port `:3000`** — `docker compose up` lance le backend **en conteneur** (`apps/server/docker-compose.yml:18`) ; `pnpm dev` (Turbo) lance le server **sur l'host** (`apps/server/package.json:17`). Le quick start du README (lignes 9-10) déclenche littéralement les deux → deux backends sur `:3000`.
2. **Le seul chemin cohérent est incomplet** — `docker:dev` (`apps/server/package.json:51`) ne lève que `postgres`, pas `qdrant` ni `ai-service` → le RAG ne marche pas dans ce mode.
3. **Aucune orchestration unifiée** — l'infra (Docker) et les apps (Turbo host) vivent dans deux mondes ; pas de commande unique pour « tout lancer ».
4. **`.dockerignore` inopérant** — le build backend a pour contexte la racine du monorepo, où il n'existe pas de `.dockerignore` ; celui de `apps/server/` n'est jamais appliqué → ~2,5 Go de contexte (dont `node_modules` 1,5 Go, `curriculum/.venv` 914 Mo) + les `.env` réels envoyés au daemon.

## 2. Objectif

Une commande, un modèle mental : faire tourner **l'app complète en local** (server + web + landing + postgres + qdrant + ai-service ; mobile à part) de façon **fluide, déterministe et sans piège**.

Critères de succès :
- `pnpm install` → `pnpm setup` → `pnpm dev` lève toute la stack, sans collision ni étape implicite.
- Le backend ne tourne qu'à **un seul endroit**.
- Le RAG fonctionne dans le mode par défaut.
- Le build context Docker est réduit aux fichiers utiles et ne contient aucun secret.

## 3. Architecture cible — hybride (infra Docker / apps host)

| Couche | Où | Quoi |
|---|---|---|
| Infra | **Docker** | `postgres`, `qdrant`, `ai-service` |
| Apps | **Host (Turbo)** | `server` (`bun --watch --hot`), `web`, `landing` |
| Mobile | **Host (séparé)** | `expo start` via `pnpm dev:mobile` |

**Justification** : sous WSL2, le file-watching Next/Expo sur volumes Docker est lent/fragile ; le hot-reload natif (Bun/Next/Metro) est nettement supérieur. L'infra (Python+torch ~3,5 Go, pgvector, qdrant) est précisément ce qu'on veut isoler en conteneur. Le backend quitte le conteneur en dev → le clash `:3000` disparaît par construction.

## 4. Composants & changements

### 4.1 Compose remonté à la racine
- `docker-compose.yml` déplacé de `apps/server/` vers la **racine du monorepo** — c'est l'infra de tout le dev (server *et* curriculum consomment qdrant/ai-service). Les chemins (`context`, volumes) sont réécrits en conséquence.
- **Profils** :
  - défaut : `postgres` + `qdrant` + `ai-service` ;
  - `tools` : `drizzle-studio` + `adminer` (inchangé) ;
  - `backend` : **opt-in** — le service backend conteneurisé, conservé pour qui veut tester l'image iso-prod, retiré du démarrage par défaut.
- Les ports host exposés restent identiques (`postgres:5432`, `qdrant:6333/6334`, `ai-service:8001`) → `apps/curriculum/.env` (qui pointe `localhost:8001` / `localhost:6333`) n'est pas impacté.

### 4.2 `.dockerignore` racine
- Création d'un `.dockerignore` à la **racine** (le vrai build context). Exclut `node_modules`, `**/.venv`, `.next`, `.turbo`, `.git`, `dist`, `coverage`, `.expo`, `.env*` (sauf `.env.example`), `docs`, `.claude`. Garde le code source + manifests nécessaires aux `COPY` ciblés des Dockerfiles.
- Effet : contexte de ~2,5 Go → quelques Mo, et aucun secret transmis au daemon.

### 4.3 Commandes (racine)
- `pnpm setup` — **one-time, idempotent** : crée les `.env` manquants depuis `.env.example`, génère `BETTER_AUTH_SECRET`, lève `postgres`, crée l'extension `vector`, applique les migrations (`db:migrate`), et **préchauffe `ai-service`** (le download ~3,5 Go de modèles a lieu ici, explicitement).
- `pnpm dev` — lève l'infra (détaché) + attend `postgres`/`qdrant` *healthy* + `turbo run dev` (server + web + landing). `ai-service` chauffe en arrière-plan ; le serveur démarre en « degraded » jusqu'à ce que le RAG soit prêt (comportement existant).
- `pnpm dev:mobile` — inchangé (Expo, séparé).
- `pnpm dev:down` — coupe l'infra (`docker compose down`).

### 4.4 Env & secrets
- `.env.example` complets et à jour par app (server, curriculum, mobile).
- La séquence « base neuve » documentée dans `apps/server/CLAUDE.md` (extension `vector` + `db:migrate` avant `db:push`) devient **automatique** via `pnpm setup`.

### 4.5 README
- Quick start réécrit et cohérent : `pnpm install` → `pnpm setup` → `pnpm dev` (+ `pnpm dev:mobile`). Suppression du quick start qui lance deux backends.

## 5. Flux

**Premier jour (machine neuve)**
```
pnpm install
pnpm setup     # .env + secrets + postgres + extension vector + migrations + préchauffe ai-service (~3,5 Go)
pnpm dev       # infra + server + web + landing
pnpm dev:mobile (optionnel, terminal séparé)
```

**Au quotidien**
```
pnpm dev       # rapide : modèles déjà en cache, migrations à jour
```

## 6. Décisions

- **Hybride** plutôt que tout-Docker ou devcontainer : DX maximale sous WSL2 (validé).
- **Mobile séparé** : Expo a son propre cycle (device, QR, rebuilds natifs) (validé).
- **`pnpm setup` séparé** plutôt qu'auto-dans-`dev` : le coûteux (download, migrations) est explicite et arrive une fois ; `pnpm dev` reste rapide et prévisible (validé).
- **Backend en profil `backend`** plutôt que supprimé : on garde la capacité de tester l'image serveur sans l'imposer au défaut.
- **Compose à la racine** plutôt que dans `apps/server` : reflète que c'est l'infra partagée du monorepo.

## 7. À vérifier en phase plan (doc-first)

- Mécanisme d'attente *healthy* avant `turbo run dev` (flag `--wait` de Compose v2 vs script d'attente) — confirmer le comportement officiel.
- Réécriture exacte des chemins du compose après déplacement à la racine (`context`, volumes hot-reload, `env_file`).
- Forme de `pnpm setup` : script (`scripts/setup.mjs`) vs enchaînement de scripts npm — choisir le plus simple et lisible, cross-shell.
- Vérifier qu'aucun consommateur (curriculum, scripts) ne dépend du chemin `apps/server/docker-compose.yml`.

## 8. Hors scope (explicite)

- Koyeb, prod, déploiement, parité de version prod.
- Migration Prettier globale et adoption pyright (chantiers planifiés séparément).
- Refactor du code applicatif.
