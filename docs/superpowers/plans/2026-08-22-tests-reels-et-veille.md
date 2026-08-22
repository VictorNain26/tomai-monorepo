# Tests de recherche réels et veille des réformes — Plan 2/3

> **Pour les agents d'exécution :** SOUS-COMPÉTENCE REQUISE —
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
nouvelle — `fastembed` est délibérément écarté.

**Spec :** `docs/superpowers/specs/2026-08-22-refonte-corpus-et-tests-rag-design.md`
**Prérequis :** plan 1 livré, et `PISTE_CLIENT_ID` / `PISTE_CLIENT_SECRET`
créés puis placés dans `apps/curriculum/.env` **et** dans les secrets du dépôt.
Vérifié le 2026-08-22 : ils n'existent **ni** en secrets GitHub (`gh secret list`
ne renvoie que `ANTHROPIC_API_KEY`, `DATABASE_URL`, `KOYEB_API_TOKEN`) **ni** en
local. La moitié Légifrance de la veille n'a donc jamais tourné, et le workflow
sort vert chaque lundi. Sans ces clés, les tâches 3 à 5 sont bloquées.

## Contraintes globales

- **Aucune page HTML officielle n'est accessible** : `education.gouv.fr`,
  `eduscol.education.fr` et `legifrance.gouv.fr` renvoient 403 (Cloudflare) sur
  toute requête automatisée, agent compris. Le flux RSS du BO est donc
  inexploitable. Les PDF, eux, se téléchargent. **On peut tout télécharger, on ne
  peut rien surveiller par le web.**
- **Le seul signal de fraîcheur est l'API PISTE**, et c'est aussi la **seule voie
  vers le texte des arrêtés** — donc vers le calendrier d'entrée en vigueur que
  `schema/programmes.py` porte aujourd'hui sans preuve primaire, et vers le NOR
  de la technologie cycle 4, laissé à `None`.
- **Obtention des clés** : compte sur <https://piste.gouv.fr/registration>, puis
  onglet APPLICATIONS → « Créer une application » → « Générer » un ID OAuth
  (client_id + client_secret), puis « Consentement CGU API » pour l'API
  Légifrance, puis « Demande de souscription à une API » sur le canal
  PRODUCTION. Jeton :
  `POST https://oauth.piste.gouv.fr/api/oauth/token`,
  `grant_type=client_credentials&client_id=…&client_secret=…&scope=openid`,
  `Content-Type: application/x-www-form-urlencoded`. Quota par défaut : 20
  requêtes/seconde. Source : guide utilisateur PISTE, §6 à §10
  (<https://piste.gouv.fr/images/com_apiportal/documentation/UserGuide_navigation_FR.pdf>).
- **Jamais `subprocess`** pour du réseau : le secret PISTE transite aujourd'hui
  par `argv` de `curl`, donc lisible par tout utilisateur de la machine (`ps`,
  `/proc/*/cmdline`).
- **Pas de `fastembed`** : ~200 Mo d'`onnxruntime` pour tester le BM25 de Qdrant,
  qui n'est pas notre code. Le vecteur creux est fourni en fixture explicite.
- **Le mode local a trois limites connues** : index payload inopérants (les
  filtres fonctionnent, non indexés), capacité plafonnée vers 20 000 points, et
  `models.Document` refusé — l'inférence serveur est une fonctionnalité Cloud.
- **Marqueurs pytest** (posés au plan 1, tâche 2) : `network` pour les appels aux
  API publiques, `qdrant` pour le vrai cluster. `uv run pytest -q` reste
  hors-ligne.
- Commandes depuis `apps/curriculum/`. `ruff` et `pytest` verts avant chaque commit.

---

### Tâche 1 : Socle de test Qdrant en processus

**Fichiers :** créer `tests/conftest_qdrant.py`, `tests/test_qdrant_local.py` ;
modifier `tests/conftest.py`.

- [ ] **Étape 1 : écrire la fixture et son test de sanité**

```python
# tests/conftest_qdrant.py
"""Un vrai moteur Qdrant, en processus, sans réseau ni clé.

Remplace les mocks : ceux-ci vérifiaient que le code appelle de faux objets comme
prévu, donc restaient verts même si Qdrant refusait la requête. Le mode local
exécute la vraie fusion RRF, les vrais filtres, la vraie recherche.

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

Dans `tests/conftest.py`, ajouter
`from .conftest_qdrant import collection_locale  # noqa: F401` (le paquet
`tests/` a bien un `__init__.py`).

```python
# tests/test_qdrant_local.py
def test_la_collection_de_test_est_peuplee(collection_locale):
    client, nom = collection_locale
    assert client.count(nom).count == 3
```

- [ ] **Étape 2 : vérifier** — `uv run pytest tests/test_qdrant_local.py -q` → 1 passed

- [ ] **Étape 3 : commit**

```bash
git add tests/conftest_qdrant.py tests/conftest.py tests/test_qdrant_local.py
git commit -m "test: run search tests against a real in-process Qdrant"
```

---

### Tâche 2 : Tests de recherche réels, fin des mocks

**Fichiers :** réécrire `tests/test_retrieval.py`.

- [ ] **Étape 1 : écrire les tests sur le moteur réel**

```python
# tests/test_retrieval.py
"""La recherche, vérifiée sur un vrai moteur.

Ces tests portent sur des RÉSULTATS, pas sur des appels. Un test qui vérifie « la
fonction a appelé query_points avec ces arguments » reste vert quand Qdrant
refuse la requête ; celui-ci échoue.
"""

import pytest

from schema.retrieval import HNSW_EF, hybrid_search


@pytest.fixture(autouse=True)
def _recherche_locale(monkeypatch, collection_locale):
    """Fige les deux dépendances externes : l'embedder OVH et le client Qdrant.

    `hybrid_search` importe `ovh_embeddings` comme MODULE à l'intérieur de la
    fonction, donc remplacer son attribut `embed` suffit.
    """
    from src.clients import ovh_embeddings

    client, nom = collection_locale
    monkeypatch.setenv("QDRANT_COLLECTION", nom)
    monkeypatch.setattr("schema.retrieval.get_qdrant_client", lambda: client)
    monkeypatch.setattr(
        ovh_embeddings, "embed",
        lambda textes, **kw: [[1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0] for _ in textes],
    )


def test_la_recherche_dense_remonte_le_chunk_le_plus_proche():
    resultats = hybrid_search("Pythagore", top_k=3, retrieval_mode="dense")
    assert resultats
    assert "Pythagore" in resultats[0].text


def test_le_filtre_matiere_exclut_reellement_les_autres():
    resultats = hybrid_search("Pythagore", top_k=5, matiere="svt", retrieval_mode="dense")
    assert resultats
    assert all(r.matiere == "svt" for r in resultats)


def test_un_filtre_sans_correspondance_ne_leve_pas_et_ne_rend_rien():
    """C'est le comportement qui a coûté le bug P0-1 : Qdrant ne signale pas un
    filtre absurde, il renvoie zéro résultat. Le figer ici documente pourquoi la
    liste des matières exposées à l'agent doit venir du contrat."""
    assert hybrid_search("Pythagore", top_k=5, matiere="philosophie",
                         retrieval_mode="dense") == []


def test_le_filtre_niveau_est_pris_en_compte():
    """La dimension restée ouverte quand P0-1 a fermé celle des matières."""
    assert hybrid_search("Pythagore", top_k=5, niveau="terminale",
                         retrieval_mode="dense") == []


def test_un_mode_inconnu_leve():
    with pytest.raises(ValueError, match="retrieval_mode"):
        hybrid_search("Pythagore", retrieval_mode="colbert")


def test_une_fusion_inconnue_leve():
    with pytest.raises(ValueError, match="fusion"):
        hybrid_search("Pythagore", fusion="borda")


def test_hnsw_ef_est_bien_celui_de_la_production():
    assert HNSW_EF == 128, "doit rester aligné sur apps/server/src/services/rag.service.ts"


@pytest.mark.qdrant
def test_la_fusion_hybride_combine_les_deux_branches():
    """Le mode hybride envoie `models.Document` pour la branche creuse : Qdrant
    Cloud la vectorise côté serveur, le mode local en est incapable. Ce test
    tourne donc sur le vrai cluster."""
    assert hybrid_search("Pythagore", top_k=3)


@pytest.mark.qdrant
def test_le_mode_lexical_seul_fonctionne():
    assert isinstance(hybrid_search("Pythagore", top_k=3, retrieval_mode="sparse"), list)
```

- [ ] **Étape 2 : lancer et traiter l'échec attendu du mode hybride**

`uv run pytest tests/test_retrieval.py -q` : les sept tests hors marqueur passent
en local. Les deux marqués `qdrant` sont exclus par défaut ; ils tournent contre
le vrai cluster, où le `doctor` couvre déjà ce chemin.

**Ne pas ajouter de paramètre à `hybrid_search` pour injecter un vecteur creux.**
Ce serait une couture existant uniquement pour le test, sur le chemin chaud de la
production.

- [ ] **Étape 3 : commit**

```bash
git add tests/test_retrieval.py
git commit -m "test: assert on search results instead of on mock calls"
```

---

### Tâche 3 : Client PISTE, sans subprocess et sans secret dans argv

**Fichiers :** créer `src/clients/piste.py`, `tests/test_piste.py`.

- [ ] **Étape 1 : vérifier le contrat de l'API — DOC-FIRST, avant d'écrire**

Le corps de la requête `/search` de Légifrance n'est **pas** deviné : le format
(`recherche.champs`, `filtres`, `fond`) et le nom du champ qui porte le NOR dans
la réponse doivent être lus dans la documentation PISTE avant l'implémentation.
Consigner l'URL de la doc et le champ retenu dans la docstring du module — c'est
la seule partie de ce plan qui n'a pas pu être vérifiée contre le serveur, faute
d'identifiants.

Sonder ensuite l'API réelle une fois, avec les identifiants, et garder la réponse
brute d'un appel dans `tests/fixtures/piste_search.json` : elle servira de fixture
au test suivant.

- [ ] **Étape 2 : écrire le test qui échoue**

```python
# tests/test_piste.py
"""Le client Légifrance. Deux exigences, nées de deux défauts réels.

1. Le secret ne transite pas par `argv` : les arguments d'un process sont
   lisibles par tout utilisateur de la machine.
2. Toute panne lève. L'implémentation précédente retournait None sur échec, ce
   qui faisait conclure « aucun changement » à l'appelant.
"""

import datetime

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
        def json():
            return {"access_token": "jwt-test"}

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
    with pytest.raises(RuntimeError, match="500"):
        piste.chercher_arretes(datetime.date(2026, 1, 1))


def test_le_nor_est_extrait_de_la_reponse_reelle(monkeypatch):
    """Fixture capturée sur l'API : c'est elle qui verrouille le nom du champ."""
    import json
    from pathlib import Path

    brut = json.loads(
        (Path(__file__).parent / "fixtures" / "piste_search.json").read_text(encoding="utf-8")
    )

    class Reponse:
        status_code = 200

        @staticmethod
        def json():
            return brut

    monkeypatch.setattr(piste, "jeton", lambda: "jwt")
    monkeypatch.setattr(piste.httpx, "post", lambda *a, **k: Reponse())
    arretes = piste.chercher_arretes(datetime.date(2021, 9, 1))
    assert arretes, "aucun arrêté extrait de la réponse réelle"
    assert all(a["nor"].startswith("MENE") for a in arretes)


@pytest.mark.network
def test_la_recherche_reelle_repond(monkeypatch):
    arretes = piste.chercher_arretes(datetime.date(2021, 9, 1))
    assert isinstance(arretes, list)
```

- [ ] **Étape 3 : implémenter**

```python
# src/clients/piste.py
"""Client Légifrance via PISTE — le seul signal de fraîcheur exploitable.

`education.gouv.fr`, `eduscol` et `legifrance.gouv.fr` renvoient 403 derrière
Cloudflare sur leurs pages HTML : le flux RSS du Bulletin officiel est
inaccessible par machine. L'API PISTE, elle, est officielle et authentifiée.

Les arrêtés créent et abrogent les programmes. Les deux réformes que la veille
précédente a laissé passer portent les NOR `MENE2504620A` (français et
mathématiques cycle 3, 2025) et `MENE2602912A` (cycle 4, 2026).

Toute panne LÈVE. C'est la correction du défaut central de l'implémentation
précédente, qui retournait `None` et faisait conclure « aucun changement ».

Contrat de l'API : voir <URL de la doc PISTE consultée à l'étape 1>.
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
            "PISTE_CLIENT_ID et PISTE_CLIENT_SECRET sont requis. Créer une "
            "application sur https://piste.gouv.fr après avoir accepté les CGU "
            "de l'API Légifrance."
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
    # Corps de requête conforme à la doc consultée à l'étape 1.
    ...
```

- [ ] **Étape 4 : vérifier** — `uv run pytest tests/test_piste.py -q && uv run ruff check .` → 5 passed

- [ ] **Étape 5 : commit**

```bash
git add src/clients/piste.py tests/test_piste.py tests/fixtures/piste_search.json
git commit -m "feat: query Légifrance over its API instead of shelling out to curl"
```

---

### Tâche 4 : La veille qui échoue bruyamment, et qui ne crie pas au loup

**Fichiers :** réécrire `scripts/veille_programmes.py` ; créer
`tests/test_veille.py` ; modifier `.github/workflows/veille_bo.yml`.

Le piège à éviter : comparer un NOR aux `reference` du manifeste ne marche pas.
Les entrées venues de l'API portent « arrêté du 19-7-2019 - J.O. du 23-7-2019 »,
**sans NOR** — tout arrêté remonté serait donc « non traité », la veille sortirait
en 1 à chaque exécution, et on réapprendrait à ignorer l'alerte. La comparaison se
fait sur `schema.programmes.nor_traites()`.

- [ ] **Étape 1 : écrire le test qui échoue**

```python
# tests/test_veille.py
"""Un détecteur de changement qui se tait quand il est cassé est pire qu'absent.

L'implémentation précédente retournait None sur tout échec de sous-processus —
`curl` ou `pdftotext` manquants compris, deux dépendances système déclarées nulle
part — puis imprimait « ✓ Aucun changement détecté » et sortait en 0. Elle a
laissé passer trois réformes.
"""

import pytest

from scripts.veille_programmes import arretes_non_traites, main


def test_un_arrete_deja_traite_est_ignore():
    from schema.programmes import nor_traites

    arretes = [{"nor": "MENE2504620A", "title": "…cycle 3"}]
    assert arretes_non_traites(arretes, nor_traites()) == []


def test_un_arrete_inconnu_est_signale():
    assert len(arretes_non_traites(
        [{"nor": "MENE2699999A", "title": "Programme de physique-chimie"}],
        {"MENE2504620A"},
    )) == 1


def test_la_veille_leve_si_elle_ne_peut_pas_conclure(monkeypatch):
    """Le point central : pas de « aucun changement » par défaut."""

    def echec(*a, **k):
        raise RuntimeError("PISTE search → HTTP 503")

    monkeypatch.setattr("scripts.veille_programmes.chercher_arretes", echec)
    with pytest.raises(RuntimeError, match="503"):
        main()


def test_les_reformes_du_manifeste_ne_declenchent_pas_d_alerte():
    """Non-régression sur le cri au loup : le manifeste connaît ces NOR, la
    veille doit rester silencieuse."""
    from schema.programmes import nor_traites

    arretes = [{"nor": n, "title": "…"} for n in nor_traites()]
    assert arretes_non_traites(arretes, nor_traites()) == []
```

- [ ] **Étape 2 : vérifier l'échec** — `cannot import name 'arretes_non_traites'`

- [ ] **Étape 3 : réécrire le script**

Remplacer intégralement `scripts/veille_programmes.py` (395 lignes, aucun test) :

```python
#!/usr/bin/env python3
"""Veille des arrêtés de programme.

Compare les arrêtés `MENE` publiés depuis le dernier passage aux NOR que le
manifeste déclare traités. Tout arrêté inconnu est signalé.

ÉCHOUE BRUYAMMENT. Une veille qui ne peut pas conclure doit le dire : c'est le
défaut exact qui a laissé passer les réformes de 2024, 2025 et 2026.

Usage :
  uv run python scripts/veille_programmes.py                  # depuis le dernier run
  uv run python scripts/veille_programmes.py --depuis 2021-09-01   # rattrapage
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv  # noqa: E402

from schema.programmes import nor_traites  # noqa: E402
from src.clients.piste import chercher_arretes  # noqa: E402

load_dotenv()

ETAT = Path(__file__).resolve().parent.parent / "data" / "raw" / ".veille_state.json"


def arretes_non_traites(arretes: list[dict], nor_traites: set[str]) -> list[dict]:
    """Arrêtés dont le NOR n'est pas déjà porté par le manifeste."""
    return [a for a in arretes if (a.get("nor") or "").strip() not in nor_traites]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--depuis", type=date.fromisoformat)
    args = parser.parse_args()

    depuis = args.depuis
    if depuis is None:
        depuis = date.today() - timedelta(days=30)
        if ETAT.exists():
            try:
                depuis = date.fromisoformat(json.loads(ETAT.read_text())["dernier_run"])
            except (KeyError, ValueError, json.JSONDecodeError) as e:
                raise RuntimeError(f"{ETAT} illisible : {e}") from e

    arretes = chercher_arretes(depuis)  # lève si l'API ne répond pas
    nouveaux = arretes_non_traites(arretes, nor_traites())

    ETAT.write_text(json.dumps({"dernier_run": date.today().isoformat()}), encoding="utf-8")

    print(f"{len(arretes)} arrêté(s) MENE depuis {depuis}, {len(nouveaux)} non traité(s)")
    if nouveaux:
        for a in nouveaux:
            print(f"  ⚠ {a.get('nor')} · {(a.get('title') or '')[:100]}")
        print(
            "\nPour chacun : retrouver les annexes PDF sur education.gouv.fr, "
            "ajouter l'entrée dans schema/programmes.py avec son calendrier "
            "d'application PAR NIVEAU, puis réingérer."
        )
        sys.exit(1)


if __name__ == "__main__":
    main()
```

- [ ] **Étape 4 : durcir le workflow**

Dans `.github/workflows/veille_bo.yml`, retirer tout `continue-on-error` et toute
redirection qui masquerait un code de sortie. Le job doit échouer quand la veille
échoue.

- [ ] **Étape 5 : vérifier** — `uv run pytest tests/test_veille.py -q && uv run ruff check .` → 4 passed

- [ ] **Étape 6 : commit**

```bash
git add scripts/veille_programmes.py tests/test_veille.py .github/workflows/veille_bo.yml
git commit -m "fix: make the reform watch fail loudly instead of reporting silence"
```

---

### Tâche 5 : Le rattrapage — ce que la veille aurait dû voir depuis 2021

C'est l'étape qui transforme la veille en preuve. Tant qu'elle n'est pas faite,
le manifeste porte les réformes qu'on connaît, pas celles qui existent.

- [ ] **Étape 1 : rejouer quatre ans d'arrêtés**

```bash
uv run python scripts/veille_programmes.py --depuis 2021-09-01
```

Attendu : une liste d'arrêtés `MENE` non traités. Les deux réformes connues
(`MENE2504620A`, `MENE2602912A`) ne doivent **pas** y figurer — elles sont déjà
dans `nor_traites()`. Tout le reste est du travail réel.

- [ ] **Étape 2 : trancher chaque arrêté**

Pour chacun, trois issues possibles, et une seule est acceptable sans trace
écrite :

| Cas | Action |
|---|---|
| programme du périmètre, absent du manifeste | retrouver les annexes PDF, ajouter l'entrée dans `schema/programmes.py` avec son calendrier par niveau |
| programme hors périmètre (voie pro, technologique, primaire) | ajouter le NOR à une table `NOR_HORS_PERIMETRE` avec son motif |
| arrêté qui n'est pas un programme (jury, calendrier, organisation) | idem, motif écrit |

Aucun arrêté ne se referme sans l'une de ces trois lignes. C'est la même règle
que pour le mapping, appliquée au temps.

- [ ] **Étape 3 : confirmer le calendrier d'entrée en vigueur**

Les dates inscrites dans `schema/programmes.py` viennent de sources secondaires.
Le texte de l'arrêté, lui, est dans la réponse PISTE : vérifier pour
`MENE2504621A` (langues) et `MENE2602912A` (français-maths cycle 4) que
l'échelonnement 2025/2026/2027/2028 est bien celui du texte, et corriger le
manifeste sinon.

**C'est le risque principal du lot.** Un calendrier faux sert un programme à un
élève qu'il ne concerne pas, et rien d'autre ne le détecterait.

- [ ] **Étape 4 : réingérer si le manifeste a bougé**

```bash
uv run python scripts/fetch_sources.py
uv run python scripts/ingest.py
uv run python scripts/coverage_report.py
```

- [ ] **Étape 5 : commit**

```bash
git add schema/programmes.py tests/test_programmes.py docs/constats-ouverts.md
git commit -m "fix: close four years of unwatched programme decrees"
```

---

## Critères de fin

1. Les tests de recherche s'exécutent **sans réseau ni clé**, sur un vrai moteur
   Qdrant, et échouent si la fusion, un filtre ou `hnsw_ef` change.
2. Plus aucun mock de Qdrant dans `tests/`.
3. `scripts/veille_programmes.py` **lève** quand il ne peut pas conclure, et
   `tests/test_veille.py` le prouve.
4. La veille est silencieuse sur les NOR déjà portés par le manifeste — elle ne
   sort en 1 que sur du réel.
5. Le rattrapage depuis 2021-09 est fait : chaque arrêté est soit dans le
   manifeste, soit dans une table d'exclusion avec un motif.
6. Le calendrier d'entrée en vigueur du manifeste est confirmé contre le texte
   des arrêtés, ou corrigé.
7. Aucune dépendance ajoutée.

## Ce que ce plan ne fait pas

- **Évaluation qualité** → plan 3
- **Adaptation d'`apps/server`** → lot serveur distinct
