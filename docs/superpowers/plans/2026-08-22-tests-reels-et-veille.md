# Tests de recherche réels et veille des réformes — Plan 2/3

> **Pour les agents d'exécution :** SOUS-COMPÉTENCE REQUISE — utiliser
> `superpowers:subagent-driven-development` (recommandé) ou
> `superpowers:executing-plans`. Les étapes utilisent des cases à cocher.

**But :** la chaîne reste correcte, **et on sait quand elle ne l'est plus**.

**Architecture :** deux dispositifs indépendants. Les tests de recherche
s'exécutent sur un vrai moteur Qdrant **en processus** (mode local), sans réseau
ni clé — ils remplacent des mocks qui ne vérifiaient que le comportement des
mocks. La veille interroge l'**API PISTE de Légifrance**, seul signal de
fraîcheur exploitable, et **échoue bruyamment** au lieu d'annoncer « aucun
changement » quand elle est cassée.

**Stack :** `qdrant-client` (mode local), `httpx`, `pytest`. Aucune dépendance
nouvelle — `fastembed` est délibérément écarté (voir contraintes).

**Spec :** `docs/superpowers/specs/2026-08-22-refonte-corpus-et-tests-rag-design.md`
**Prérequis :** plan 1 livré (`2026-08-22-corpus-manifeste-et-couverture.md`)

## Contraintes globales

- **`education.gouv.fr` et `legifrance.gouv.fr` renvoient 403 (Cloudflare)** sur
  leurs pages HTML — le flux RSS du BO est inexploitable par machine. Les PDF se
  téléchargent (HTTP 200 vérifié). **On peut tout télécharger, on ne peut pas
  surveiller par le web.**
- **Le seul signal de fraîcheur est l'API PISTE.** Identifiants déjà en secrets
  GitHub : `PISTE_CLIENT_ID`, `PISTE_CLIENT_SECRET`.
- **Jamais `subprocess`** pour du réseau : `httpx` est déjà une dépendance, et le
  secret PISTE transite aujourd'hui par `argv` de `curl`, donc lisible par tout
  utilisateur de la machine (`ps`, `/proc/*/cmdline`).
- **Pas de `fastembed`.** Il tirerait ~200 Mo d'`onnxruntime` pour tester le BM25
  de Qdrant, qui n'est pas notre code. Les tests fournissent le vecteur creux en
  **fixture explicite**.
- **Le mode local a deux limites connues** : les index payload y sont inopérants
  (les filtres fonctionnent, non indexés) et la capacité plafonne vers 20 000
  points. On teste sur des dizaines de chunks, pas sur le corpus.
- Commandes depuis `apps/curriculum/`. `ruff` et `pytest` verts avant chaque commit.

---

### Tâche 1 : Socle de test Qdrant en processus

**Fichiers :**
- Créer : `tests/conftest_qdrant.py`
- Modifier : `tests/conftest.py`

**Interfaces :**
- Produit : fixture pytest `collection_locale` → `(client, nom_collection)`,
  peuplée de chunks connus

- [ ] **Étape 1 : écrire la fixture et son test de sanité**

```python
# tests/conftest_qdrant.py
"""Un vrai moteur Qdrant, en processus, sans réseau ni clé.

Remplace les mocks : ceux-ci vérifiaient que le code appelle de faux objets
comme prévu, donc restaient verts même si Qdrant refusait la requête. Le mode
local exécute la vraie fusion RRF, les vrais filtres, la vraie recherche.

Le vecteur creux est fourni en FIXTURE et non calculé : le BM25 de Qdrant n'est
pas notre code, et le tester exigerait `fastembed` et ses ~200 Mo d'ONNX. Le
`doctor` couvre la chaîne réelle sur Qdrant Cloud, inférence serveur comprise.
"""

from __future__ import annotations

import pytest
from qdrant_client import QdrantClient, models

from schema import chunk_point_id

DIM = 8

# Trois chunks aux vecteurs choisis pour que le classement soit prévisible.
CHUNKS = [
    ("mathematiques", "cinquieme", "Le théorème de Pythagore et sa réciproque",
     [1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0], [10, 11], [0.9, 0.8]),
    ("mathematiques", "cinquieme", "Les nombres relatifs et leurs opérations",
     [0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0], [20, 21], [0.9, 0.8]),
    ("svt", "cinquieme", "La respiration cellulaire chez les êtres vivants",
     [0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 0.0], [30, 31], [0.9, 0.8]),
]


@pytest.fixture
def collection_locale():
    client = QdrantClient(":memory:")
    nom = "test_local"
    client.create_collection(
        nom,
        vectors_config={"dense": models.VectorParams(size=DIM, distance=models.Distance.COSINE)},
        sparse_vectors_config={"bm25": models.SparseVectorParams(modifier=models.Modifier.IDF)},
    )
    client.upsert(nom, points=[
        models.PointStruct(
            id=chunk_point_id(matiere, niveau, texte),
            vector={"dense": dense, "bm25": models.SparseVector(indices=idx, values=val)},
            payload={"text": texte, "matiere": matiere, "niveau": niveau,
                     "cycle": "cycle4", "section": "Test", "chunk_index": 0,
                     "source_file": "fixture"},
        )
        for matiere, niveau, texte, dense, idx, val in CHUNKS
    ], wait=True)
    yield client, nom
    client.delete_collection(nom)
```

Dans `tests/conftest.py`, ajouter : `from .conftest_qdrant import collection_locale  # noqa: F401`

```python
# tests/test_qdrant_local.py
def test_la_collection_de_test_est_peuplee(collection_locale):
    client, nom = collection_locale
    assert client.count(nom).count == 3
```

- [ ] **Étape 2 : lancer et vérifier**

Commande : `uv run pytest tests/test_qdrant_local.py -q`
Attendu : 1 passed

- [ ] **Étape 3 : commit**

```bash
git add tests/conftest_qdrant.py tests/conftest.py tests/test_qdrant_local.py
git commit -m "test: run search tests against a real in-process Qdrant"
```

---

### Tâche 2 : Tests de recherche réels, fin des mocks

**Fichiers :**
- Réécrire : `tests/test_retrieval.py`

- [ ] **Étape 1 : écrire les tests sur le moteur réel**

```python
# tests/test_retrieval.py
"""La recherche, vérifiée sur un vrai moteur.

Ces tests portent sur des RÉSULTATS, pas sur des appels. Un test qui vérifie
« la fonction a appelé query_points avec ces arguments » reste vert quand
Qdrant refuse la requête ; celui-ci échoue.
"""

import pytest

from schema.retrieval import HNSW_EF, hybrid_search


@pytest.fixture(autouse=True)
def _embedder_deterministe(monkeypatch, collection_locale):
    """L'embedding vient d'OVH en production. Ici on le fige : ce test porte
    sur la recherche, pas sur le modèle."""
    from src.clients import ovh_embeddings
    _, nom = collection_locale
    monkeypatch.setenv("QDRANT_COLLECTION", nom)
    monkeypatch.setattr(
        ovh_embeddings, "embed",
        lambda textes, **kw: [[1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0] for _ in textes],
    )


@pytest.fixture(autouse=True)
def _client_local(monkeypatch, collection_locale):
    client, _ = collection_locale
    monkeypatch.setattr("schema.retrieval.get_qdrant_client", lambda: client)


def test_la_recherche_dense_remonte_le_chunk_le_plus_proche():
    resultats = hybrid_search("Pythagore", top_k=3, retrieval_mode="dense")
    assert resultats
    assert "Pythagore" in resultats[0].text


def test_le_filtre_matiere_exclut_reellement_les_autres():
    resultats = hybrid_search("Pythagore", top_k=5, matiere="svt", retrieval_mode="dense")
    assert all(r.matiere == "svt" for r in resultats)


def test_un_filtre_sans_correspondance_ne_leve_pas_et_ne_rend_rien():
    """C'est le comportement qui a coûté le bug P0-1 : Qdrant ne signale pas un
    filtre absurde, il renvoie zéro résultat. Le figer ici documente pourquoi
    la liste des matières exposées à l'agent doit venir du contrat."""
    assert hybrid_search("Pythagore", top_k=5, matiere="philosophie", retrieval_mode="dense") == []


def test_la_fusion_hybride_combine_les_deux_branches():
    resultats = hybrid_search("Pythagore", top_k=3)
    assert resultats, "la fusion RRF n'a rien rendu"


def test_le_mode_lexical_seul_fonctionne():
    resultats = hybrid_search("Pythagore", top_k=3, retrieval_mode="sparse")
    assert isinstance(resultats, list)


def test_un_mode_inconnu_leve():
    with pytest.raises(ValueError, match="retrieval_mode"):
        hybrid_search("Pythagore", retrieval_mode="colbert")


def test_hnsw_ef_est_bien_celui_de_la_production():
    assert HNSW_EF == 128, "doit rester aligné sur apps/server/src/services/rag.service.ts"
```

- [ ] **Étape 2 : lancer, et traiter l'échec attendu du mode hybride**

Commande : `uv run pytest tests/test_retrieval.py -q`

**Le mode hybride ÉCHOUERA, et c'est prévu.** `hybrid_search` envoie
`models.Document(text=…, model="bm25")` pour la branche creuse : Qdrant Cloud
la vectorise côté serveur, le mode local en est incapable — c'est une
fonctionnalité de Cloud Inference, absente aussi d'un serveur auto-hébergé.

**Décision, pas alternative** : marquer les deux tests qui traversent la fusion
(`test_la_fusion_hybride_combine_les_deux_branches` et
`test_le_mode_lexical_seul_fonctionne`) avec `@pytest.mark.integration`. Ils
tourneront contre Qdrant Cloud, où le `doctor` couvre déjà ce chemin.

Ce qui reste testé en local, et c'est l'essentiel de notre code : le mode dense,
les filtres, `hnsw_ef`, le rejet d'un mode inconnu, et le comportement silencieux
d'un filtre sans correspondance.

**Ne pas ajouter de paramètre à `hybrid_search` pour injecter un vecteur creux.**
Ce serait une couture existant uniquement pour le test, sur le chemin chaud de
la production.

- [ ] **Étape 3 : commit**

```bash
git add tests/test_retrieval.py
git commit -m "test: assert on search results instead of on mock calls"
```

---

### Tâche 3 : Client PISTE, sans subprocess et sans secret dans argv

**Fichiers :**
- Créer : `src/clients/piste.py`, `tests/test_piste.py`

**Interfaces :**
- Produit : `jeton() -> str`, `chercher_arretes(depuis: date, prefixe_nor: str = "MENE") -> list[dict]`

- [ ] **Étape 1 : écrire le test qui échoue**

```python
# tests/test_piste.py
"""Le client Légifrance. Deux exigences, nées de deux défauts réels.

1. Le secret ne transite pas par `argv` : les arguments d'un process sont
   lisibles par tout utilisateur de la machine.
2. Toute panne lève. L'implémentation précédente retournait None sur échec,
   ce qui faisait conclure « aucun changement » à l'appelant.
"""

import pytest

from src.clients import piste


def test_le_jeton_exige_les_identifiants(monkeypatch):
    monkeypatch.delenv("PISTE_CLIENT_ID", raising=False)
    monkeypatch.delenv("PISTE_CLIENT_SECRET", raising=False)
    with pytest.raises(RuntimeError, match="PISTE_CLIENT_ID"):
        piste.jeton()


def test_le_secret_passe_par_le_corps_de_la_requete(monkeypatch):
    monkeypatch.setenv("PISTE_CLIENT_ID", "id-test")
    monkeypatch.setenv("PISTE_CLIENT_SECRET", "secret-test")
    capture = {}

    class Reponse:
        status_code = 200
        @staticmethod
        def json(): return {"access_token": "jwt-test"}

    def faux_post(url, **kwargs):
        capture.update(kwargs)
        return Reponse()

    monkeypatch.setattr(piste.httpx, "post", faux_post)
    assert piste.jeton() == "jwt-test"
    assert capture["data"]["client_secret"] == "secret-test"


def test_un_echec_d_authentification_leve(monkeypatch):
    monkeypatch.setenv("PISTE_CLIENT_ID", "x")
    monkeypatch.setenv("PISTE_CLIENT_SECRET", "y")

    class Reponse:
        status_code = 401
        text = "unauthorized"

    monkeypatch.setattr(piste.httpx, "post", lambda *a, **k: Reponse())
    with pytest.raises(RuntimeError, match="401"):
        piste.jeton()


def test_une_recherche_en_erreur_leve(monkeypatch):
    monkeypatch.setattr(piste, "jeton", lambda: "jwt")

    class Reponse:
        status_code = 500
        text = "boom"

    monkeypatch.setattr(piste.httpx, "post", lambda *a, **k: Reponse())
    import datetime
    with pytest.raises(RuntimeError, match="500"):
        piste.chercher_arretes(datetime.date(2026, 1, 1))
```

- [ ] **Étape 2 : lancer et vérifier l'échec**

Commande : `uv run pytest tests/test_piste.py -q`
Attendu : ÉCHEC — `cannot import name 'piste'`

- [ ] **Étape 3 : écrire l'implémentation**

```python
# src/clients/piste.py
"""Client Légifrance via PISTE — le seul signal de fraîcheur exploitable.

`education.gouv.fr` et `legifrance.gouv.fr` renvoient 403 derrière Cloudflare
sur leurs pages HTML : le flux RSS du Bulletin officiel est inaccessible par
machine. L'API PISTE, elle, est officielle et authentifiée.

Les arrêtés créent et abrogent les programmes. Les deux réformes que la veille
précédente a laissé passer portent les NOR `MENE2504620A` (français et
mathématiques cycle 3, 2025) et `MENE2602912A` (cycle 4, 2026).

Toute panne LÈVE. C'est la correction du défaut central de l'implémentation
précédente, qui retournait `None` et faisait conclure « aucun changement ».
"""

from __future__ import annotations

import os
from datetime import date

import httpx

URL_JETON = "https://oauth.piste.gouv.fr/api/oauth/token"
URL_API = "https://api.piste.gouv.fr/dila/legifrance/lf-engine-app"
TIMEOUT_S = 60.0


def jeton() -> str:
    """Jeton OAuth. Le secret passe dans le CORPS de la requête, jamais en
    argument de ligne de commande."""
    identifiant = os.environ.get("PISTE_CLIENT_ID", "")
    secret = os.environ.get("PISTE_CLIENT_SECRET", "")
    if not identifiant or not secret:
        raise RuntimeError(
            "PISTE_CLIENT_ID et PISTE_CLIENT_SECRET sont requis. "
            "Créer une application sur https://piste.gouv.fr après avoir accepté "
            "les CGU de l'API Légifrance."
        )
    reponse = httpx.post(
        URL_JETON,
        data={
            "grant_type": "client_credentials",
            "client_id": identifiant,
            "client_secret": secret,
            "scope": "openid",
        },
        timeout=TIMEOUT_S,
    )
    if reponse.status_code != 200:
        raise RuntimeError(f"PISTE auth → HTTP {reponse.status_code} : {reponse.text[:200]}")
    return reponse.json()["access_token"]


def chercher_arretes(depuis: date, prefixe_nor: str = "MENE") -> list[dict]:
    """Arrêtés publiés depuis `depuis`, filtrés sur le préfixe NOR.

    `MENE` est le préfixe de la direction générale de l'enseignement scolaire :
    c'est sous lui que paraissent les arrêtés de programme.
    """
    entetes = {"Authorization": f"Bearer {jeton()}", "Content-Type": "application/json"}
    corps = {
        "recherche": {
            "champs": [{
                "typeChamp": "TITLE",
                "criteres": [{"typeRecherche": "TOUS_LES_MOTS_DANS_UN_CHAMP",
                              "valeur": "programme enseignement", "operateur": "ET"}],
                "operateur": "ET",
            }],
            "filtres": [{"facette": "DATE_SIGNATURE",
                         "dates": {"start": depuis.isoformat(), "end": date.today().isoformat()}}],
            "pageNumber": 1,
            "pageSize": 100,
            "sort": "SIGNATURE_DATE_DESC",
            "typePagination": "DEFAUT",
        },
        "fond": "JORF",
    }
    reponse = httpx.post(f"{URL_API}/search", json=corps, headers=entetes, timeout=TIMEOUT_S)
    if reponse.status_code != 200:
        raise RuntimeError(f"PISTE search → HTTP {reponse.status_code} : {reponse.text[:200]}")
    resultats = reponse.json().get("results", [])
    return [r for r in resultats if (r.get("nor") or "").startswith(prefixe_nor)]
```

- [ ] **Étape 4 : lancer et vérifier**

Commande : `uv run pytest tests/test_piste.py -q && uv run ruff check .`
Attendu : 4 passed

- [ ] **Étape 5 : commit**

```bash
git add src/clients/piste.py tests/test_piste.py
git commit -m "feat: query Légifrance over its API instead of shelling out to curl"
```

---

### Tâche 4 : La veille qui échoue bruyamment

**Fichiers :**
- Réécrire : `scripts/veille_programmes.py`
- Créer : `tests/test_veille.py`
- Modifier : `.github/workflows/veille_bo.yml`

**Interfaces :**
- Consomme : `chercher_arretes()` (tâche 3), `charger_manifeste()` (plan 1)
- Produit : `arretes_non_traites(arretes, manifeste) -> list[dict]`

- [ ] **Étape 1 : écrire le test qui échoue**

```python
# tests/test_veille.py
"""Un détecteur de changement qui se tait quand il est cassé est pire
qu'absent. L'implémentation précédente retournait None sur tout échec de
sous-processus — `curl` ou `pdftotext` manquants compris, deux dépendances
système déclarées nulle part — puis imprimait « ✓ Aucun changement détecté »
et sortait en 0. Elle a laissé passer deux réformes.
"""

import pytest

from scripts.veille_programmes import arretes_non_traites, main


def test_un_arrete_deja_dans_le_manifeste_est_ignore():
    arretes = [{"nor": "MENE2504620A", "title": "…cycle 3"}]
    manifeste_refs = {"BO 2025 · NOR MENE2504620A"}
    assert arretes_non_traites(arretes, manifeste_refs) == []


def test_un_arrete_inconnu_est_signale():
    arretes = [{"nor": "MENE2699999A", "title": "Programme de physique-chimie"}]
    assert len(arretes_non_traites(arretes, {"BO 2025 · NOR MENE2504620A"})) == 1


def test_la_veille_leve_si_elle_ne_peut_pas_conclure(monkeypatch):
    """Le point central : pas de « aucun changement » par défaut."""
    def echec(*a, **k):
        raise RuntimeError("PISTE search → HTTP 503")

    monkeypatch.setattr("scripts.veille_programmes.chercher_arretes", echec)
    with pytest.raises(RuntimeError, match="503"):
        main()


def test_les_deux_reformes_ratees_seraient_detectees():
    """Test de non-régression sur l'incident réel."""
    arretes = [
        {"nor": "MENE2504620A", "title": "français et mathématiques cycle 3"},
        {"nor": "MENE2602912A", "title": "français et mathématiques cycle 4"},
    ]
    assert len(arretes_non_traites(arretes, set())) == 2
```

- [ ] **Étape 2 : lancer et vérifier l'échec**

Commande : `uv run pytest tests/test_veille.py -q`
Attendu : ÉCHEC — `cannot import name 'arretes_non_traites'`

- [ ] **Étape 3 : réécrire le script**

Remplacer intégralement `scripts/veille_programmes.py` :

```python
#!/usr/bin/env python3
"""Veille des arrêtés de programme.

Compare les arrêtés `MENE` publiés depuis le dernier passage aux références
déjà portées par le manifeste. Tout arrêté inconnu est signalé.

ÉCHOUE BRUYAMMENT. Une veille qui ne peut pas conclure doit le dire : c'est le
défaut exact qui a laissé passer les réformes de 2025 et 2026.
"""

from __future__ import annotations

import json
import sys
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv  # noqa: E402

from schema.sources import charger_manifeste  # noqa: E402
from src.clients.piste import chercher_arretes  # noqa: E402

load_dotenv()

ETAT = Path(__file__).resolve().parent.parent / "data" / "raw" / ".veille_state.json"


def arretes_non_traites(arretes: list[dict], references_connues: set[str]) -> list[dict]:
    """Arrêtes dont le NOR n'apparaît dans aucune référence du manifeste."""
    return [a for a in arretes
            if not any((a.get("nor") or "") in ref for ref in references_connues)]


def main() -> None:
    depuis = date.today() - timedelta(days=30)
    if ETAT.exists():
        try:
            depuis = date.fromisoformat(json.loads(ETAT.read_text())["dernier_run"])
        except (KeyError, ValueError) as e:
            raise RuntimeError(f"{ETAT} illisible : {e}") from e

    arretes = chercher_arretes(depuis)  # lève si l'API ne répond pas
    references = {s.reference for s in charger_manifeste()}
    nouveaux = arretes_non_traites(arretes, references)

    ETAT.write_text(json.dumps({"dernier_run": date.today().isoformat()}), encoding="utf-8")

    print(f"{len(arretes)} arrêté(s) MENE depuis {depuis}, {len(nouveaux)} non traité(s)")
    if nouveaux:
        for a in nouveaux:
            print(f"  ⚠ {a.get('nor')} · {(a.get('title') or '')[:100]}")
        print("\nAjouter ces programmes au manifeste (schema/sources.py) après vérification.")
        sys.exit(1)


if __name__ == "__main__":
    main()
```

- [ ] **Étape 4 : durcir le workflow**

Dans `.github/workflows/veille_bo.yml`, retirer tout `continue-on-error` et
toute redirection qui masquerait un code de sortie. Le job doit échouer quand la
veille échoue.

- [ ] **Étape 5 : lancer et vérifier**

Commande : `uv run pytest tests/test_veille.py -q && uv run ruff check .`
Attendu : 4 passed

- [ ] **Étape 6 : commit**

```bash
git add scripts/veille_programmes.py tests/test_veille.py .github/workflows/veille_bo.yml
git commit -m "fix: make the reform watch fail loudly instead of reporting silence"
```

---

## Critères de fin

1. Les tests de recherche s'exécutent **sans réseau ni clé**, sur un vrai moteur
   Qdrant, et échouent si la fusion, un filtre ou `hnsw_ef` change.
2. Plus aucun mock de Qdrant dans `tests/`.
3. `scripts/veille_programmes.py` **lève** quand il ne peut pas conclure, et
   `tests/test_veille.py` le prouve.
4. Rejouer les NOR `MENE2504620A` et `MENE2602912A` les fait détecter.
5. Aucune dépendance ajoutée.

## Ce que ce plan ne fait pas

- **Évaluation qualité** → plan 3
- **Adaptation d'`apps/server`** → lot serveur distinct
