# Design — Distribution de ai-service en dev (image pré-buildée)

**Date** : 2026-06-10
**Statut** : en revue
**Périmètre** : fourniture de `ai-service` en **développement local**. Hors scope : déploiement Koyeb/prod (mais l'allègement du Dockerfile en profite).

## 1. Problème

Le `pnpm setup` actuel **build l'image ai-service en local** :
- Build ~**19 min** (`uv pip install` de torch & co + `--no-cache-dir` qui annule le `--mount=type=cache`).
- Image **8,52 Go** : torch installé **avec CUDA** alors que dev/Koyeb tournent en **CPU-only**.
- Boot lent → `unhealthy` au `--wait` : download ~3,5 Go de modèles depuis HF Hub **sans `HF_TOKEN`** (rate-limited).
- Build non déterministe : `uv pip install .` ignore `uv.lock`.

Conséquence : chaque machine neuve paie 19 min de build + un boot qui timeout. Mauvaise DX pour un objectif sain (« tout testable en local »).

## 2. Objectif

Garder le **fully-local** (ai-service tourne en local par défaut), mais l'obtenir **vite et de façon fiable** : l'image est buildée **une fois en CI**, distribuée via **GHCR**, et **pullée** en dev. Les modèles se téléchargent **une seule fois** dans un volume persistant.

Critères de succès :
- `pnpm setup` ne **build** plus ai-service : il **pull** une image ~2-3 Go.
- Build déterministe (torch CPU + `uv.lock`).
- 1er boot : download modèles une fois (volume) ; boots suivants instantanés.
- Itérer sur le service reste possible (`docker compose build ai-service`).

## 3. Architecture

```
CI (push apps/ai-service/**) ──build+push──> ghcr.io/victornain26/tomai-ai-service:latest (+sha)
                                                        │
dev: pnpm dev/setup ──pull──> image (~2-3 Go) ──run──> ai-service ──download once──> volume HF (3,5 Go)
                                  └─ fallback: docker compose build ai-service (itération)
```

## 4. Composants & changements

### 4.1 Dockerfile + pyproject ai-service (image allégée, déterministe)
- `apps/ai-service/pyproject.toml` : ajouter l'index CPU PyTorch et la source torch :
  ```toml
  [[tool.uv.index]]
  name = "pytorch-cpu"
  url = "https://download.pytorch.org/whl/cpu"
  explicit = true

  [tool.uv.sources]
  torch = [{ index = "pytorch-cpu" }]
  ```
- Générer/committer `apps/ai-service/uv.lock` (existe déjà ; à régénérer avec la source CPU).
- `apps/ai-service/Dockerfile` (builder) : remplacer `uv pip install --no-cache-dir .` par `uv sync --frozen --no-dev` (lit `[tool.uv.sources]` + `uv.lock` → torch CPU + déterministe + cache `--mount` réutilisé). Copier `uv.lock` dans le contexte du build.
- Effet attendu : image **~2-3 Go** (vs 8,5), build cache-rapide.

### 4.2 Workflow CI `ai-service-image.yml`
- Trigger : `push` sur `main`, paths `apps/ai-service/**` (+ workflow lui-même).
- `permissions: { contents: read, packages: write }`.
- Étapes : `docker/login-action` (ghcr.io, `github.actor`, `GITHUB_TOKEN`) → `docker/metadata-action` (tags `latest` + `sha`) → `docker/build-push-action` (context `apps/ai-service`, push, cache `type=gha`). Actions SHA-pinnées (convention repo).
- Visibilité du package : **public** (réglage manuel une fois après la 1re publication).

### 4.3 Compose dev
- Service `ai-service` :
  ```yaml
  image: ghcr.io/victornain26/tomai-ai-service:latest
  pull_policy: missing
  build:
    context: ./apps/ai-service
  ```
- `pull_policy: missing` → `up` pull l'image si absente, build en fallback si le pull échoue ; `docker compose build ai-service` force le build local (itération).
- `HF_TOKEN=${HF_TOKEN:-}` ajouté à l'environnement (download rapide si fourni).
- Healthcheck : `start_period` élargi (ex. 300s) pour absorber le 1er download.

### 4.4 Orchestration
- `scripts/setup.mjs` / `scripts/dev.mjs` : inchangés dans la logique (le `up` pull l'image automatiquement). Le `--wait-timeout` du setup reste généreux pour le 1er download.
- `.env.example` (server + ai-service) : documenter `HF_TOKEN` (optionnel).

## 5. Décisions

- **GHCR public** : l'image ne contient aucun secret (libs + code déjà ouvert) ; pull sans `docker login` → DX simple.
- **`uv sync --frozen`** plutôt que `uv pip install` : seul `uv sync` lit `[tool.uv.sources]` (torch CPU) et `uv.lock` (déterminisme).
- **Modèles en volume** (pas bakés) : image légère ; download une fois suffit pour un usage solo.
- **Fallback `build` conservé** : itérer sur le service sans dépendre du registry.

## 6. À vérifier en phase plan / risques

- Régénérer `uv.lock` avec la source CPU (`uv lock` dans `apps/ai-service`) — vérifier que torch résout bien depuis l'index CPU.
- Confirmer le comportement exact `pull_policy: missing` + image absente du registry → fallback build (sinon `pull_policy: build` pour le 1er run avant publication).
- Le CI build initial reste lourd (torch en CI) mais **une seule fois** ; vérifier le cache `type=gha`.
- Le passage du package GHCR en public est manuel (UI GitHub) — à faire après la 1re publication.
- Koyeb : non touché ; le Dockerfile torch-CPU lui profite (image plus légère) mais le déploiement reste tel quel.

## 7. Hors scope

- Déploiement Koyeb/prod (pull depuis GHCR côté prod = chantier séparé éventuel).
- Modèles bakés dans l'image (option B écartée — image trop lourde pour le gain en solo).
