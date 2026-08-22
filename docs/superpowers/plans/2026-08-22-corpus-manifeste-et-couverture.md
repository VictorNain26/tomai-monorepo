# Corpus piloté par un manifeste daté et test de couverture — Plan 1/3

> **Pour les agents d'exécution :** SOUS-COMPÉTENCE REQUISE —
> `superpowers:subagent-driven-development` (recommandé) ou
> `superpowers:executing-plans`. Les étapes utilisent des cases à cocher.

**But :** produire un corpus **complet et à jour des réformes** (collège + lycée
général), avec un test qui échoue tant qu'il ne l'est pas.

**Architecture :** un *manifeste daté* dérivé de deux sources officielles décrit
ce qui **doit** exister à une rentrée donnée ; l'index Qdrant décrit ce qui
**existe** ; un test compare les deux. Aucune des deux moitiés n'est écrite à la
main.

**Stack :** Python 3.12, `uv`, `httpx`, `pymupdf`, `chonkie`, `qdrant-client`,
`pydantic`. Aucune dépendance nouvelle.

**Spec :** `docs/superpowers/specs/2026-08-22-refonte-corpus-et-tests-rag-design.md`

## Contraintes globales

- **Périmètre** : collège (cycle 3, cycle 4) + lycée **général**. Les voies
  technologique et professionnelle sont hors périmètre — notre payload ne porte
  pas la série, et mélanger STMG avec la voie générale sous `premiere`
  remplacerait un silence par une confusion.
- **Le manifeste est daté.** Une entrée vaut pour un couple (matière, niveau) à
  partir d'une rentrée donnée. Les réformes 2025 et 2026 entrent en vigueur
  **échelonnées par niveau** : à la rentrée 2026, un élève de 4e suit encore le
  programme BO2020. Ne jamais associer un programme à un cycle entier.
- **Aucune ligne du périmètre ne peut être ignorée en silence** : soit mappée,
  soit exclue **avec un motif écrit**. Un test échoue sinon, un autre échoue si
  le périmètre se vide.
- **Aucune page HTML officielle n'est accessible** (403 Cloudflare sur
  `education.gouv.fr`, `eduscol`, `legifrance`). Les PDF se téléchargent en 200.
  Ne jamais scraper ; utiliser les URL de PDF directes, toutes vérifiées ici.
- **Aucun miroir tiers.** Les URL non officielles sont interdites, même si elles
  répondent.
- **Modèle d'embedding** : `Qwen3-Embedding-8B` @1024D via OVH — ne pas y toucher
  (`docs/adr/0002-embeddings-manages.md`).
- **Qualité** : `uv run ruff check . && uv run ruff format --check .` et
  `uv run pytest -q` passent avant chaque commit.
- Toutes les commandes s'exécutent depuis `apps/curriculum/`.

---

### Tâche 1 : Un seul point de définition pour l'identifiant de chunk

L'identifiant `uuid5(matière:niveau:texte)` relie l'index, le manifeste et
l'évaluation. Il existe en **quatre copies** (`scripts/ingest.py:450`,
`scripts/generate_golden.py:156`, `tests/test_ingest.py:292`,
`tests/test_golden.py:86`) et le test censé le verrouiller **réécrit la formule**
au lieu d'importer la source. Si quelqu'un ajoute un champ au seed, les tests
restent verts et la réindexation crée des identifiants neufs.

**Fichiers :** modifier `schema/document.py`, `schema/__init__.py`,
`scripts/ingest.py` ; créer `tests/test_document_id.py`.

**Interface produite :** `chunk_point_id(matiere: str, niveau: str, text: str) -> str`

- [ ] **Étape 1 : écrire le test qui échoue**

```python
# tests/test_document_id.py
"""L'identifiant de point est le lien entre l'index et tout le reste.

Ces tests importent la SEULE définition. Une copie qui diverge doit casser ici,
pas six mois plus tard sur un index à moitié orphelin.
"""

import uuid
from pathlib import Path

from schema import chunk_point_id


def test_identifiant_stable_pour_le_meme_contenu():
    a = chunk_point_id("mathematiques", "cinquieme", "Théorème de Pythagore")
    b = chunk_point_id("mathematiques", "cinquieme", "Théorème de Pythagore")
    assert a == b


def test_la_matiere_fait_partie_de_l_identite():
    """Les préambules pédagogiques sont identiques entre langues vivantes.
    Sans la matière dans le seed, le dernier upsert écraserait les autres."""
    a = chunk_point_id("anglais", "cinquieme", "Préambule commun")
    b = chunk_point_id("espagnol", "cinquieme", "Préambule commun")
    assert a != b


def test_le_niveau_fait_partie_de_l_identite():
    a = chunk_point_id("mathematiques", "cinquieme", "Nombres relatifs")
    b = chunk_point_id("mathematiques", "quatrieme", "Nombres relatifs")
    assert a != b


def test_le_texte_fait_partie_de_l_identite():
    a = chunk_point_id("mathematiques", "cinquieme", "Nombres relatifs")
    b = chunk_point_id("mathematiques", "cinquieme", "Nombres rationnels")
    assert a != b


def test_forme_uuid_acceptee_par_qdrant():
    assert uuid.UUID(chunk_point_id("svt", "sixieme", "La respiration cellulaire"))


def test_ingest_utilise_la_fonction_partagee():
    """Garde-fou contre la réapparition d'une copie."""
    source = Path(__file__).resolve().parent.parent / "scripts" / "ingest.py"
    assert "uuid5" not in source.read_text(encoding="utf-8"), (
        "ingest.py recalcule un identifiant au lieu d'importer chunk_point_id"
    )
```

- [ ] **Étape 2 : vérifier l'échec**

`uv run pytest tests/test_document_id.py -q` → `ImportError: cannot import name 'chunk_point_id'`

- [ ] **Étape 3 : implémenter**

Ajouter à la fin de `schema/document.py` (`import hashlib` en tête si absent ;
`uuid` y est déjà) :

```python
def chunk_point_id(matiere: str, niveau: str, text: str) -> str:
    """Identifiant stable et idempotent d'un point Qdrant.

    Dérivé du CONTENU seul : réingérer ne crée pas de doublon, et modifier un
    texte crée un point neuf. La matière et le niveau font partie du seed parce
    que le même texte existe légitimement plusieurs fois — les préambules
    pédagogiques sont identiques entre langues vivantes, et un chunk de cycle est
    dupliqué sur les niveaux du cycle.

    SEULE définition de cette formule. La réécrire ailleurs romprait le lien
    entre l'index et le manifeste sans qu'aucun test ne le voie.
    """
    seed = f"{matiere}:{niveau}:{text}"
    digest = hashlib.sha256(seed.encode("utf-8")).hexdigest()
    return str(uuid.uuid5(uuid.NAMESPACE_URL, digest))
```

Dans `schema/__init__.py`, ajouter `chunk_point_id` à l'import depuis `.document`
**et** à `__all__` (ordre alphabétique).

- [ ] **Étape 4 : brancher `ingest.py`**

Remplacer le bloc de calcul (autour de la ligne 445) par
`point_id = chunk_point_id(matiere, niveau, text)`, ajouter l'import, retirer
`hashlib`/`uuid` s'ils ne servent plus (ruff le signalera).

- [ ] **Étape 5 : vérifier** — `uv run pytest tests/test_document_id.py -q && uv run ruff check .` → 6 passed

- [ ] **Étape 6 : commit**

```bash
git add schema/document.py schema/__init__.py scripts/ingest.py tests/test_document_id.py
git commit -m "refactor: give the chunk point id a single definition"
```

---

### Tâche 2 : Le catalogue officiel vient de l'API, plus d'une copie figée

`data/raw/programmes_second_degre_datagouv.json` est une copie CSV commitée. Le
jeu est publié par une **API** : `data.education.gouv.fr`, Explore v2.1, dataset
`fr-en-programmes-enseignement-2nd-degre` (688 enregistrements). Une copie figée
dans le dépôt ne peut pas signaler qu'elle a vieilli ; un cache daté, comparé à
l'API par un test, le peut.

**Fichiers :** créer `scripts/refresh_catalogue.py`, `tests/test_catalogue.py` ;
supprimer `data/raw/programmes_second_degre_datagouv.json`.

**Interface produite :** `charger_catalogue() -> list[dict]`,
`telecharger_catalogue() -> list[dict]`

- [ ] **Étape 1 : écrire le test qui échoue**

```python
# tests/test_catalogue.py
"""Le catalogue officiel, et la preuve qu'il n'a pas vieilli sans qu'on le voie.

Le jeu de données est GELÉ à la rentrée 2021 (vérifié : 11 entrées en 2021, zéro
après). Ce n'est pas un défaut du code, c'est un fait sur la source — et c'est
exactement pourquoi le manifeste a une seconde moitié.
"""

import pytest

from scripts.refresh_catalogue import CHAMPS_ATTENDUS, charger_catalogue


def test_le_cache_est_present_et_substantiel():
    lignes = charger_catalogue()
    assert len(lignes) >= 600, f"catalogue anormalement court : {len(lignes)}"


def test_les_champs_attendus_sont_tous_la():
    """Une colonne renommée en amont doit casser ici, pas produire un manifeste
    vide qui passerait tous les autres tests au vert."""
    manquants = CHAMPS_ATTENDUS - set(charger_catalogue()[0])
    assert not manquants, f"champs absents du catalogue : {manquants}"


@pytest.mark.network
def test_le_cache_est_identique_a_l_api():
    """Rougit quand le ministère publie. C'est le signal qu'on attend depuis
    2021 : il ne s'est encore jamais déclenché."""
    from scripts.refresh_catalogue import telecharger_catalogue

    distant = telecharger_catalogue()
    local = charger_catalogue()
    assert len(distant) == len(local), (
        f"l'API renvoie {len(distant)} lignes, le cache en a {len(local)} — "
        "relancer scripts/refresh_catalogue.py et vérifier ce qui a changé"
    )
```

- [ ] **Étape 2 : vérifier l'échec** — `uv run pytest tests/test_catalogue.py -q` → module absent

- [ ] **Étape 3 : implémenter**

```python
#!/usr/bin/env python3
"""Catalogue officiel des programmes du second degré.

Source : API Opendatasoft du ministère (Explore v2.1), dataset
`fr-en-programmes-enseignement-2nd-degre`. 688 enregistrements, 334 en vigueur.

Le cache est commité pour que les tests et l'ingestion tournent sans réseau ;
`tests/test_catalogue.py::test_le_cache_est_identique_a_l_api` rougit quand
l'amont bouge. Une copie figée sans ce test serait exactement le dispositif qui
nous a fait rater trois réformes.

Usage : uv run python scripts/refresh_catalogue.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import httpx

BASE = Path(__file__).resolve().parent.parent
CACHE = BASE / "data" / "raw" / "catalogue_second_degre.json"
API = (
    "https://data.education.gouv.fr/api/explore/v2.1/catalog/datasets/"
    "fr-en-programmes-enseignement-2nd-degre/records"
)
TIMEOUT_S = 60.0
CHAMPS_ATTENDUS = {
    "descriptif",
    "voie",
    "niveau_d_enseignement",
    "discipline",
    "texte_officiel",
    "contenu_sur_le_site",
    "entre_en_vigueur_a_la_rentree",
    "abroge_a_la_rentree",
}


def telecharger_catalogue() -> list[dict]:
    """Pagination complète. Lève sur toute réponse non 200."""
    lignes: list[dict] = []
    offset = 0
    while True:
        reponse = httpx.get(API, params={"limit": 100, "offset": offset}, timeout=TIMEOUT_S)
        if reponse.status_code != 200:
            raise RuntimeError(f"API catalogue → HTTP {reponse.status_code} : {reponse.text[:200]}")
        charge = reponse.json()
        lignes.extend(charge["results"])
        offset += 100
        if offset >= charge["total_count"]:
            return lignes


def charger_catalogue() -> list[dict]:
    return json.loads(CACHE.read_text(encoding="utf-8"))


def main() -> None:
    lignes = telecharger_catalogue()
    ancien = len(charger_catalogue()) if CACHE.exists() else 0
    CACHE.write_text(json.dumps(lignes, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{len(lignes)} enregistrements écrits dans {CACHE} (avant : {ancien})")
    if ancien and ancien != len(lignes):
        print("⚠ le nombre d'entrées a changé — vérifier ce que le ministère a publié")
        sys.exit(1)


if __name__ == "__main__":
    main()
```

Déclarer les marqueurs dans `pyproject.toml`. **Ne pas réutiliser `integration`**,
qui existe déjà dans `tests/conftest.py` avec un autre sens (« lit les vrais
fichiers, sans appel réseau ») :

```toml
[tool.pytest.ini_options]
addopts = "-m 'not network and not qdrant'"
markers = [
  "network: appelle une API publique (data.education.gouv.fr, PISTE)",
  "qdrant: interroge le vrai cluster Qdrant Cloud (clé requise)",
]
```

`uv run pytest -q` reste donc hors-ligne ; `uv run pytest -m network -q` et
`-m qdrant` s'appellent explicitement.

- [ ] **Étape 4 : produire le cache et supprimer la copie figée**

```bash
uv run python scripts/refresh_catalogue.py
git rm data/raw/programmes_second_degre_datagouv.json
```

- [ ] **Étape 5 : vérifier** — `uv run pytest tests/test_catalogue.py -q` puis
`uv run pytest tests/test_catalogue.py -m network -q` → tout passe

- [ ] **Étape 6 : commit**

```bash
git add scripts/refresh_catalogue.py tests/test_catalogue.py pyproject.toml data/raw/catalogue_second_degre.json
git commit -m "feat: read the official programme catalogue from its API, not a frozen copy"
```

---

### Tâche 3 : Table de correspondance, et la règle du zéro silence

L'API porte 59 libellés de discipline sur le périmètre ; notre schéma en a 24. La
table qui les relie est exactement l'endroit d'où venait le bug P0-1 (l'agent
demandait `histoire`, l'index portait `histoire_geo`).

**Fichiers :** créer `schema/mapping.py`, `tests/test_mapping.py`.

**Interfaces produites :** `lignes_du_perimetre(lignes) -> list[dict]`,
`DISCIPLINE_VERS_SLUG`, `DISCIPLINES_EXCLUES`, `NIVEAU_VERS_NIVEAU`,
`NIVEAUX_EXCLUS`, `URLS_EXCLUES`

- [ ] **Étape 1 : écrire le test qui échoue**

```python
# tests/test_mapping.py
"""Aucune ligne du périmètre ne peut disparaître en silence.

Une discipline officielle ni mappée ni exclue est un trou dans le corpus que rien
d'autre ne signalerait : Qdrant ne renvoie pas d'erreur pour un filtre qui ne
matche rien, il renvoie zéro résultat.
"""

from schema.mapping import (
    DISCIPLINE_VERS_SLUG,
    DISCIPLINES_EXCLUES,
    NIVEAU_VERS_NIVEAU,
    NIVEAUX_EXCLUS,
    URLS_EXCLUES,
    lignes_du_perimetre,
)
from scripts.refresh_catalogue import charger_catalogue


def _perimetre():
    return lignes_du_perimetre(charger_catalogue())


def test_le_perimetre_n_est_pas_vide():
    """Le garde-fou du garde-fou : une colonne renommée en amont ferait passer
    tous les autres tests au vert sur un périmètre vide."""
    lignes = _perimetre()
    assert len(lignes) >= 90, f"périmètre anormalement petit : {len(lignes)} lignes"


def test_chaque_discipline_du_perimetre_est_mappee_ou_exclue():
    manquantes = sorted(
        {
            (r["discipline"] or "").strip()
            for r in _perimetre()
            if (r["discipline"] or "").strip() not in DISCIPLINE_VERS_SLUG
            and (r["discipline"] or "").strip() not in DISCIPLINES_EXCLUES
        }
    )
    assert not manquantes, f"disciplines ni mappées ni exclues : {manquantes}"


def test_chaque_niveau_du_perimetre_est_mappe_ou_exclu():
    manquants = sorted(
        {
            (r["niveau_d_enseignement"] or "").strip()
            for r in _perimetre()
            if (r["niveau_d_enseignement"] or "").strip() not in NIVEAU_VERS_NIVEAU
            and (r["niveau_d_enseignement"] or "").strip() not in NIVEAUX_EXCLUS
        }
    )
    assert not manquants, f"niveaux ni mappés ni exclus : {manquants}"


def test_chaque_ligne_sans_pdf_est_exclue_avec_un_motif():
    """12 lignes du périmètre ne pointent pas un PDF. Les filtrer en silence
    serait la même faute que celle qu'on répare, en plus discret."""
    orphelines = sorted(
        {
            (r["descriptif"] or "").strip()
            for r in _perimetre()
            if not (r["contenu_sur_le_site"] or "").strip().lower().endswith(".pdf")
            and (r["descriptif"] or "").strip() not in URLS_EXCLUES
        }
    )
    assert not orphelines, f"lignes sans PDF ni motif d'exclusion : {orphelines}"


def test_toute_exclusion_porte_un_motif_non_vide():
    for table in (DISCIPLINES_EXCLUES, NIVEAUX_EXCLUS, URLS_EXCLUES):
        vides = [k for k, motif in table.items() if not motif.strip()]
        assert not vides, f"exclusions sans motif : {vides}"


def test_les_slugs_cibles_existent_dans_le_schema():
    from schema import Matiere

    inconnus = sorted(set(DISCIPLINE_VERS_SLUG.values()) - {m.value for m in Matiere})
    assert not inconnus, f"slugs absents de l'enum Matiere : {inconnus}"


def test_les_niveaux_cibles_existent_dans_le_schema():
    from schema import NiveauCollege, NiveauLycee

    connus = {n.value for n in NiveauCollege} | {n.value for n in NiveauLycee}
    inconnus = sorted(set(NIVEAU_VERS_NIVEAU.values()) - connus)
    assert not inconnus, f"niveaux absents des enums : {inconnus}"
```

- [ ] **Étape 2 : vérifier l'échec** — `ModuleNotFoundError: schema.mapping`

- [ ] **Étape 3 : créer le squelette**

```python
# schema/mapping.py
"""Correspondance entre les libellés officiels et nos slugs.

L'API porte 59 disciplines sur le périmètre ; notre schéma en a 24. Cette table
fait le pont — et c'est précisément là qu'un décalage devient invisible : Qdrant
ne renvoie pas d'erreur pour un filtre qui ne matche rien, il renvoie zéro
résultat, et l'agent conclut que le programme ne dit rien.

RÈGLE : toute entrée du périmètre est soit mappée, soit exclue AVEC UN MOTIF.
`tests/test_mapping.py` échoue sinon. Si le ministère publie une discipline l'an
prochain, le test rougit au lieu de la laisser disparaître.

PÉRIMÈTRE : collège + lycée GÉNÉRAL. La voie technologique est exclue parce que
notre payload ne porte pas la série : indexer le programme de maths STMG sous
`premiere` le servirait à un élève de première générale.
"""

from __future__ import annotations

NIVEAUX_COLLEGE = frozenset({"Collège", "Cycle 3", "Cycle 4"})
NIVEAUX_LYCEE_GENERAL = frozenset(
    {"Seconde générale et technologique", "Première générale", "Terminale générale"}
)


def lignes_du_perimetre(lignes: list[dict]) -> list[dict]:
    """Entrées en vigueur du périmètre produit.

    « Abrogé à la rentrée » vaut `-` ou `None` quand le texte est toujours en
    vigueur : tester la vacuité seule exclurait tout le jeu de données.
    """
    retenues = []
    for r in lignes:
        if (r.get("abroge_a_la_rentree") or "-").strip() not in ("", "-"):
            continue
        niveau = (r.get("niveau_d_enseignement") or "").strip()
        if niveau in NIVEAUX_COLLEGE or niveau in NIVEAUX_LYCEE_GENERAL:
            retenues.append(r)
    return retenues


NIVEAU_VERS_NIVEAU: dict[str, str] = {
    "Seconde générale et technologique": "seconde",
    "Première générale": "premiere",
    "Terminale générale": "terminale",
}

NIVEAUX_EXCLUS: dict[str, str] = {
    # Le collège n'est décrit dans l'API que par des documents de cycle sans
    # discipline. Ils sont déclarés explicitement dans schema/programmes.py,
    # avec la liste des matières qu'ils portent.
    "Collège": "documents de cycle, déclarés dans schema/programmes.py",
    "Cycle 3": "document multi-matières, déclaré dans schema/programmes.py",
    "Cycle 4": "document multi-matières, déclaré dans schema/programmes.py",
}

DISCIPLINE_VERS_SLUG: dict[str, str] = {}
DISCIPLINES_EXCLUES: dict[str, str] = {}
URLS_EXCLUES: dict[str, str] = {}
```

- [ ] **Étape 4 : remplir les tables jusqu'au vert**

**Le test EST la liste de travail.** Il affiche les libellés non traités :

```bash
uv run pytest tests/test_mapping.py::test_chaque_discipline_du_perimetre_est_mappee_ou_exclue -q
```

Règle de décision pour chaque libellé affiché :

| Le libellé désigne… | Action |
|---|---|
| une matière du produit (`Matiere`) | `DISCIPLINE_VERS_SLUG[libellé] = "slug"` |
| un enseignement optionnel dont la matière existe (« Enseignement optionnel d'arts ») | mapper vers le slug de la matière |
| une spécialité sans équivalent produit (« Pratiques sociales et culturelles », « Biotechnologies ») | `DISCIPLINES_EXCLUES[libellé] = "spécialité sans équivalent dans l'enum Matiere"` |
| une langue que le produit ne porte pas (breton, russe, chinois…) | `DISCIPLINES_EXCLUES[libellé] = "langue hors périmètre produit"` |

Même boucle pour les niveaux et pour les lignes sans PDF
(`test_chaque_ligne_sans_pdf_est_exclue_avec_un_motif` affiche leur descriptif ;
les motifs typiques : « contenu publié en page HTML, inaccessible (403) », « lien
mort »).

**Ne pas étendre l'enum `Matiere` ici.** Si une matière du produit manque
vraiment, le noter et traiter en fin de plan, en une fois, avec
`test_les_slugs_cibles_existent_dans_le_schema` comme garde-fou.

- [ ] **Étape 5 : vérifier** — `uv run pytest tests/test_mapping.py -q && uv run ruff check .` → 7 passed

- [ ] **Étape 6 : commit**

```bash
git add schema/mapping.py tests/test_mapping.py
git commit -m "map official programme labels to our slugs, with no silent drops"
```

---

### Tâche 4 : Le manifeste daté

Le cœur du lot. **Une entrée = un couple (matière, niveau) applicable à partir
d'une rentrée.** Les réformes entrent en vigueur échelonnées : à la rentrée 2026,
la 5e suit le nouveau programme de français et la 4e l'ancien. Un manifeste qui
raisonnerait par cycle servirait à un élève de 4e un texte qui ne s'applique pas
à lui.

**Fichiers :** créer `schema/programmes.py`, `tests/test_programmes.py`.

**Interfaces produites :** `Programme` (dataclass gelée), `manifeste()`,
`en_vigueur(rentree) -> dict[tuple[str, str], Programme]`,
`matrice_attendue(rentree) -> set[tuple[str, str]]`, `NOR_TRAITES`,
`RENTREE_COURANTE`

- [ ] **Étape 1 : écrire le test qui échoue**

```python
# tests/test_programmes.py
"""Le manifeste dit ce qui DOIT exister, et à partir de quand.

Le datage n'est pas un raffinement : les réformes 2025 et 2026 s'appliquent
niveau par niveau sur quatre rentrées. Servir le nouveau programme de français à
un élève de 4e en 2026 serait lui enseigner un texte qui ne le concerne pas.
"""

from schema.programmes import (
    RENTREE_COURANTE,
    en_vigueur,
    manifeste,
    matrice_attendue,
)


def test_le_manifeste_couvre_le_college_et_le_lycee_general():
    niveaux = {p.niveau for p in manifeste()}
    assert {"sixieme", "cinquieme", "quatrieme", "troisieme"} <= niveaux
    assert {"seconde", "premiere", "terminale"} <= niveaux


def test_un_programme_futur_n_est_pas_servi_avant_sa_rentree():
    """Français cycle 4 : 5e en 2026, 4e en 2027, 3e en 2028."""
    assert en_vigueur(2026)[("quatrieme", "francais")].vigueur == 2020
    assert en_vigueur(2027)[("quatrieme", "francais")].vigueur == 2026


def test_la_reforme_deja_applicable_remplace_l_ancienne():
    assert en_vigueur(2026)[("cinquieme", "francais")].vigueur == 2026
    assert en_vigueur(2025)[("cinquieme", "francais")].vigueur == 2020


def test_les_langues_du_lycee_ne_sont_plus_celles_de_l_api():
    """Le programme de langues 2025 couvre AUSSI le lycée : l'API, gelée en 2021,
    sert un texte abrogé."""
    entree = en_vigueur(2026)[("seconde", "anglais")]
    assert entree.vigueur == 2025
    assert entree.nor == "MENE2504621A"


def test_chaque_entree_porte_une_url_et_une_reference():
    for p in manifeste():
        assert p.url.startswith("https://"), f"URL invalide : {p}"
        assert p.reference.strip(), f"référence vide : {p}"
        assert p.origine in {"api", "bo"}


def test_aucune_url_de_miroir_tiers():
    """Un programme officiel ne se lit que sur un domaine officiel."""
    autorises = ("education.gouv.fr", "cache.media.education.gouv.fr")
    for p in manifeste():
        assert any(d in p.url for d in autorises), f"domaine non officiel : {p.url}"


def test_la_matrice_attendue_est_un_produit_niveau_matiere():
    matrice = matrice_attendue(RENTREE_COURANTE)
    assert ("terminale", "philosophie") in matrice
    assert ("cinquieme", "mathematiques") in matrice
    assert ("sixieme", "histoire_geo") in matrice, (
        "les matières des documents de cycle doivent être attendues, sinon "
        "elles ne sont vérifiées nulle part"
    )


def test_un_seul_programme_par_couple_a_une_rentree_donnee():
    for couple, p in en_vigueur(RENTREE_COURANTE).items():
        assert p.vigueur <= RENTREE_COURANTE, f"{couple} : programme futur servi"
```

- [ ] **Étape 2 : vérifier l'échec** — `ModuleNotFoundError: schema.programmes`

- [ ] **Étape 3 : implémenter**

```python
# schema/programmes.py
"""Le manifeste : ce qui DOIT exister dans l'index, et à partir de quelle rentrée.

Deux moitiés, et c'est nécessaire :

- l'API du ministère couvre le lycée général, mais elle est GELÉE à la rentrée
  2021 (vérifié : 11 entrées en 2021, aucune après) ;
- la table BO ci-dessous porte tout ce qui a été publié depuis, avec son NOR et
  son calendrier d'application.

Le calendrier est le point délicat. Les programmes récents entrent en vigueur
NIVEAU PAR NIVEAU, sur quatre rentrées. `en_vigueur(rentree)` retient, pour
chaque couple (niveau, matière), l'entrée la plus récente déjà applicable — le
remplacement d'un programme par un autre n'est donc pas un cas particulier.

SOURCE DU CALENDRIER : les arrêtés eux-mêmes ne sont pas lisibles par machine
(403 Cloudflare sur education.gouv.fr et legifrance.gouv.fr). Les dates viennent
de sources secondaires concordantes et sont À CONFIRMER par le rattrapage PISTE
(plan 2). Toute correction se fait ici, en un seul endroit.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from .mapping import DISCIPLINE_VERS_SLUG, NIVEAU_VERS_NIVEAU, lignes_du_perimetre

# Rentrée de référence. À avancer chaque été — c'est ce qui fait basculer un
# niveau vers un programme réformé.
RENTREE_COURANTE = 2026

COLLEGE = ("sixieme", "cinquieme", "quatrieme", "troisieme")
CYCLE_3 = ("sixieme",)
CYCLE_4 = ("cinquieme", "quatrieme", "troisieme")
LYCEE = ("seconde", "premiere", "terminale")


@dataclass(frozen=True, slots=True)
class Programme:
    matiere: str
    niveau: str
    url: str
    reference: str
    vigueur: int
    origine: str  # "api" | "bo"
    nor: str | None = None


def _bo(
    url: str,
    reference: str,
    nor: str,
    matieres: tuple[str, ...],
    calendrier: dict[str, int],
) -> list[Programme]:
    """Développe un document du BO en une entrée par (matière, niveau).

    `calendrier` porte la rentrée d'application POUR CHAQUE NIVEAU : c'est ce qui
    distingue « la 5e applique le nouveau programme en 2026 » de « le cycle 4
    l'applique ».
    """
    return [
        Programme(matiere, niveau, url, reference, rentree, "bo", nor)
        for matiere in matieres
        for niveau, rentree in calendrier.items()
    ]


# ── Programmes publiés depuis le gel de l'API (rentrée 2022 et après) ─────────
# URL vérifiées le 2026-08-22 : HTTP 200 et signature %PDF.

_LV_COLLEGE = {"sixieme": 2025, "cinquieme": 2026, "quatrieme": 2027, "troisieme": 2028}
_LV_LYCEE = {"seconde": 2025, "premiere": 2026, "terminale": 2026}
_CYCLE4_2026 = {"cinquieme": 2026, "quatrieme": 2027, "troisieme": 2028}

_BASE_BO = "https://www.education.gouv.fr/sites/default/files"
_REF_LV = "BO n°22 du 29-5-2025 · NOR MENE2504621A"
_NOR_LV = "MENE2504621A"

BO_POST_2021: tuple[Programme, ...] = tuple(
    # Langues vivantes 2025 — 25 annexes, 13 langues × collège et lycée. Le
    # produit n'en porte que quatre ; les autres sont exclues par mapping.
    _bo(f"{_BASE_BO}/ensel621_annexe3.pdf", _REF_LV, _NOR_LV, ("anglais",), _LV_COLLEGE)
    + _bo(f"{_BASE_BO}/ensel621_annexe4.pdf", _REF_LV, _NOR_LV, ("anglais",), _LV_LYCEE)
    + _bo(f"{_BASE_BO}/ensel621_annexe1.pdf", _REF_LV, _NOR_LV, ("allemand",), _LV_COLLEGE)
    + _bo(f"{_BASE_BO}/ensel621_annexe2.pdf", _REF_LV, _NOR_LV, ("allemand",), _LV_LYCEE)
    + _bo(f"{_BASE_BO}/ensel621_annexe9.pdf", _REF_LV, _NOR_LV, ("espagnol",), _LV_COLLEGE)
    + _bo(f"{_BASE_BO}/ensel621_annexe10.pdf", _REF_LV, _NOR_LV, ("espagnol",), _LV_LYCEE)
    + _bo(f"{_BASE_BO}/ensel621_annexe13.pdf", _REF_LV, _NOR_LV, ("italien",), _LV_COLLEGE)
    + _bo(f"{_BASE_BO}/ensel621_annexe14.pdf", _REF_LV, _NOR_LV, ("italien",), _LV_LYCEE)
    # Français et mathématiques du cycle 3 — applicables en 6e dès 2025.
    + _bo(f"{_BASE_BO}/ensel620_annexe1.pdf", "BO 2025 · NOR MENE2504620A",
          "MENE2504620A", ("francais",), {"sixieme": 2025})
    + _bo(f"{_BASE_BO}/ensel620_annexe2-v2.pdf", "BO 2025 · NOR MENE2504620A",
          "MENE2504620A", ("mathematiques",), {"sixieme": 2025})
    # Français et mathématiques du cycle 4 — 5e en 2026, 4e en 2027, 3e en 2028.
    + _bo(f"{_BASE_BO}/document/Annexe 1 – Programme de français pour le cycle 4-480713.pdf",
          "BO 2026 · NOR MENE2602912A", "MENE2602912A", ("francais",), _CYCLE4_2026)
    + _bo(f"{_BASE_BO}/document/Annexe 2 – Programme de mathématiques pour le cycle 4-480716.pdf",
          "BO 2026 · NOR MENE2602912A", "MENE2602912A", ("mathematiques",), _CYCLE4_2026)
    # Technologie du cycle 4 — calendrier À CONFIRMER (PISTE, plan 2).
    + _bo(f"{_BASE_BO}/document/Annexe — Programme de technologie du cycle 4-368016.pdf",
          "BO 2024", "MENE2400000A", ("technologie",),
          {"cinquieme": 2024, "quatrieme": 2024, "troisieme": 2024})
)

# ── Documents multi-matières du collège (BO 2020) ─────────────────────────────
# Ils portent les matières NON réformées. Les déclarer ici est ce qui permet au
# test de couverture de les attendre : une matière noyée dans un document de
# 98 pages ne serait sinon vérifiée nulle part.

_MATIERES_CYCLE_3 = (
    "francais", "mathematiques", "histoire_geo", "sciences_technologie",
    "langues_vivantes", "arts_plastiques", "education_musicale",
    "histoire_des_arts", "eps", "emc",
)
_MATIERES_CYCLE_4 = (
    "francais", "mathematiques", "histoire_geo", "physique_chimie", "svt",
    "technologie", "anglais", "espagnol", "allemand", "italien",
    "arts_plastiques", "education_musicale", "histoire_des_arts", "eps", "emc",
)

CYCLES_BO2020: tuple[Programme, ...] = tuple(
    _bo(
        "https://cache.media.education.gouv.fr/file/31/88/7/ensel714_annexe2_1312887.pdf",
        "BO n°31 du 30-7-2020 (cycle 3)", "MENE2018714A", _MATIERES_CYCLE_3,
        dict.fromkeys(CYCLE_3, 2020),
    )
    + _bo(
        "https://cache.media.education.gouv.fr/file/31/89/1/ensel714_annexe3_1312891.pdf",
        "BO n°31 du 30-7-2020 (cycle 4)", "MENE2018714A", _MATIERES_CYCLE_4,
        dict.fromkeys(CYCLE_4, 2020),
    )
)

NOR_TRAITES: frozenset[str] = frozenset(
    p.nor for p in BO_POST_2021 + CYCLES_BO2020 if p.nor
)


def _depuis_api() -> list[Programme]:
    """Lycée général, depuis le catalogue officiel."""
    from scripts.refresh_catalogue import charger_catalogue

    programmes: list[Programme] = []
    for r in lignes_du_perimetre(charger_catalogue()):
        slug = DISCIPLINE_VERS_SLUG.get((r["discipline"] or "").strip())
        niveau = NIVEAU_VERS_NIVEAU.get((r["niveau_d_enseignement"] or "").strip())
        url = (r["contenu_sur_le_site"] or "").strip()
        if not slug or not niveau or not url.lower().endswith(".pdf"):
            continue  # exclusions validées par tests/test_mapping.py
        vigueur = int(str(r["entre_en_vigueur_a_la_rentree"] or "0").split(".")[0])
        programmes.append(
            Programme(slug, niveau, url, (r["texte_officiel"] or "").strip(), vigueur, "api")
        )
    return programmes


def manifeste() -> list[Programme]:
    """Tout ce qui a été publié, toutes époques confondues."""
    return list(BO_POST_2021) + list(CYCLES_BO2020) + _depuis_api()


def en_vigueur(rentree: int = RENTREE_COURANTE) -> dict[tuple[str, str], Programme]:
    """Le programme applicable à chaque couple (niveau, matière) à cette rentrée.

    Le plus récent déjà entré en vigueur gagne. C'est ce tri qui remplace
    l'ancien programme par le nouveau, niveau par niveau, sans cas particulier.
    """
    retenus: dict[tuple[str, str], Programme] = {}
    for p in manifeste():
        if p.vigueur > rentree:
            continue
        cle = (p.niveau, p.matiere)
        if cle not in retenus or p.vigueur > retenus[cle].vigueur:
            retenus[cle] = p
    return retenus


def matrice_attendue(rentree: int = RENTREE_COURANTE) -> set[tuple[str, str]]:
    """Couples (niveau, matière) qui doivent avoir du contenu indexé."""
    return set(en_vigueur(rentree))
```

- [ ] **Étape 4 : vérifier** — `uv run pytest tests/test_programmes.py -q && uv run ruff check .` → 8 passed

- [ ] **Étape 5 : commit**

```bash
git add schema/programmes.py tests/test_programmes.py
git commit -m "feat: derive a dated corpus manifest from the official sources"
```

---

### Tâche 5 : Le test de couverture

L'instrument. Il doit **échouer immédiatement** — c'est ce qui définit « fini »
pour les tâches suivantes.

**Fichiers :** créer `scripts/coverage_report.py`, `tests/test_coverage.py` ;
supprimer `scripts/audit_coverage.py`.

- [ ] **Étape 1 : écrire le test qui échoue**

```python
# tests/test_coverage.py
"""Le corpus est-il complet ?

Ce test compare deux choses INDÉPENDANTES : ce que le manifeste dit qui doit
exister, et ce que l'index contient. L'ancienne métrique comparait l'index à
lui-même et bornait le résultat à 100 % — elle ne pouvait pas échouer.
"""

import pytest

from schema.programmes import matrice_attendue
from scripts.coverage_report import cases_manquantes, matrice_reelle

pytestmark = pytest.mark.qdrant


def test_toute_case_attendue_a_du_contenu():
    manquantes = cases_manquantes()
    assert not manquantes, (
        f"{len(manquantes)} couples (niveau, matière) sans contenu indexé : "
        f"{sorted(manquantes)[:20]}"
    )


def test_l_index_ne_contient_rien_hors_manifeste():
    """Un couple indexé mais absent du manifeste signale un slug inventé, un
    programme abrogé ou un reliquat d'ingestion."""
    hors = sorted(set(matrice_reelle()) - matrice_attendue())
    assert not hors, f"couples indexés hors manifeste : {hors}"


def test_aucune_case_n_est_squelettique():
    """Une case à un ou deux chunks trahit une extraction ratée, pas une
    couverture."""
    maigres = {c: n for c, n in matrice_reelle().items() if 0 < n < 3}
    assert not maigres, f"couples à moins de 3 chunks : {maigres}"
```

- [ ] **Étape 2 : vérifier l'échec** — module absent

- [ ] **Étape 3 : implémenter**

```python
#!/usr/bin/env python3
"""Couverture réelle de l'index, par couple (niveau, matière).

Remplace `audit_coverage.py`, dont la métrique était bornée par
`min(indexed / source * 100, 100.0)`. Avec l'expansion multi-niveaux ce ratio
vaut structurellement ×3 : l'indicateur affichait « 100 % » tant qu'on ne perdait
pas plus des deux tiers du corpus.

Ici il n'y a pas de ratio à borner : une case a du contenu, ou elle n'en a pas.
"""

from __future__ import annotations

import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv  # noqa: E402

from schema.programmes import matrice_attendue  # noqa: E402
from schema.retrieval import get_collection_name, get_qdrant_client  # noqa: E402

load_dotenv()


def matrice_reelle(collection: str | None = None) -> dict[tuple[str, str], int]:
    """Nombre de points indexés par couple (niveau, matière)."""
    client = get_qdrant_client()
    nom = collection or get_collection_name()
    compte: Counter[tuple[str, str]] = Counter()
    offset = None
    while True:
        points, offset = client.scroll(
            nom, limit=1000, offset=offset,
            with_payload=["niveau", "matiere"], with_vectors=False,
        )
        for p in points:
            compte[(p.payload.get("niveau"), p.payload.get("matiere"))] += 1
        if offset is None:
            return dict(compte)


def cases_manquantes(collection: str | None = None) -> list[tuple[str, str]]:
    reelle = matrice_reelle(collection)
    return sorted(c for c in matrice_attendue() if reelle.get(c, 0) == 0)


def main() -> None:
    reelle = matrice_reelle()
    attendue = matrice_attendue()
    manquantes = sorted(c for c in attendue if reelle.get(c, 0) == 0)
    hors = sorted(set(reelle) - attendue)

    print(f"attendu : {len(attendue)} couples (niveau × matière)")
    print(f"couvert : {len(attendue) - len(manquantes)}")
    print(f"manquant: {len(manquantes)}\n")
    for niveau, matiere in manquantes:
        print(f"  ✗ {niveau:<12} {matiere}")
    if hors:
        print(f"\n{len(hors)} couple(s) indexés hors manifeste :")
        for niveau, matiere in hors:
            print(f"  ? {niveau:<12} {matiere}")
    if manquantes or hors:
        sys.exit(1)


if __name__ == "__main__":
    main()
```

- [ ] **Étape 4 : constater l'échec ATTENDU**

`uv run pytest tests/test_coverage.py -q -m qdrant` → échec listant les couples
manquants, dont les trois niveaux du lycée pour toutes les matières. **C'est le
résultat correct** : l'instrument fonctionne et mesure un corpus incomplet.

- [ ] **Étape 5 : supprimer la métrique remplacée**

```bash
git rm scripts/audit_coverage.py
git rm docs/audits/coverage_2026-05-18.md   # rapport « ✅ 100 % » sur 228 447/76 344
```

- [ ] **Étape 6 : commit**

```bash
git add scripts/coverage_report.py tests/test_coverage.py
git commit -m "feat: make corpus coverage a test that can actually fail"
```

---

### Tâche 6 : Téléchargement piloté par le manifeste

**Fichiers :** créer `scripts/fetch_sources.py`, `tests/test_fetch_sources.py`,
`data/raw/.gitignore`.

- [ ] **Étape 1 : écrire le test qui échoue**

```python
# tests/test_fetch_sources.py
"""Le téléchargement doit échouer bruyamment.

`education.gouv.fr` renvoie une page Cloudflare en 403 sur ses pages HTML ; un
téléchargeur permissif écrirait cette page dans un fichier `.pdf` que
l'extraction traiterait comme un programme vide.
"""

import pytest

from scripts.fetch_sources import nom_fichier, telecharger_un


def test_le_nom_de_fichier_est_stable_et_sans_espace():
    url = "https://ex.fr/document/Annexe 1 – Programme de français-480713.pdf"
    a, b = nom_fichier(url), nom_fichier(url)
    assert a == b
    assert " " not in a and a.endswith(".pdf")


def test_un_echec_http_leve(monkeypatch, tmp_path):
    class Reponse:
        status_code = 404
        content = b"nope"

    monkeypatch.setattr("scripts.fetch_sources.httpx.get", lambda *a, **k: Reponse())
    with pytest.raises(RuntimeError, match="404"):
        telecharger_un("https://ex.fr/x.pdf", tmp_path)


def test_un_contenu_non_pdf_leve(monkeypatch, tmp_path):
    class Reponse:
        status_code = 200
        content = b"<!DOCTYPE html><html>Cloudflare</html>"

    monkeypatch.setattr("scripts.fetch_sources.httpx.get", lambda *a, **k: Reponse())
    with pytest.raises(RuntimeError, match="PDF"):
        telecharger_un("https://ex.fr/x.pdf", tmp_path)
```

- [ ] **Étape 2 : vérifier l'échec** — module absent

- [ ] **Étape 3 : implémenter**

```python
#!/usr/bin/env python3
"""Télécharge les PDF que le manifeste déclare en vigueur.

Échoue bruyamment : un fichier manquant ou tronqué doit se voir ici, pas trois
étapes plus loin sous la forme d'une case de couverture vide.

Usage : uv run python scripts/fetch_sources.py [--rentree 2026]
"""

from __future__ import annotations

import argparse
import hashlib
import sys
import urllib.parse
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from schema.programmes import RENTREE_COURANTE, en_vigueur  # noqa: E402

DESTINATION = Path(__file__).resolve().parent.parent / "data" / "raw" / "pdf"
TIMEOUT_S = 120.0


def nom_fichier(url: str) -> str:
    """Nom stable dérivé de l'URL. Les URL officielles contiennent des espaces et
    des tirets cadratins ; un hash évite d'en dépendre."""
    return hashlib.sha256(url.encode("utf-8")).hexdigest()[:16] + ".pdf"


def telecharger_un(url: str, destination: Path) -> Path:
    reponse = httpx.get(
        urllib.parse.quote(url, safe=":/?&=%"), timeout=TIMEOUT_S, follow_redirects=True
    )
    if reponse.status_code != 200:
        raise RuntimeError(f"{url} → HTTP {reponse.status_code}")
    if reponse.content[:4] != b"%PDF":
        raise RuntimeError(f"{url} → contenu non PDF ({reponse.content[:40]!r})")
    chemin = destination / nom_fichier(url)
    chemin.write_bytes(reponse.content)
    return chemin


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--rentree", type=int, default=RENTREE_COURANTE)
    args = parser.parse_args()

    DESTINATION.mkdir(parents=True, exist_ok=True)
    programmes = en_vigueur(args.rentree)
    urls = sorted({p.url for p in programmes.values()})
    print(f"rentrée {args.rentree} : {len(programmes)} couples → {len(urls)} PDF uniques\n")

    echecs = []
    for i, url in enumerate(urls, start=1):
        if (DESTINATION / nom_fichier(url)).exists():
            print(f"  [{i}/{len(urls)}] déjà présent")
            continue
        try:
            telecharger_un(url, DESTINATION)
            print(f"  [{i}/{len(urls)}] ✓ {url[:90]}")
        except Exception as e:  # noqa: BLE001 - on veut la liste complète des échecs
            echecs.append((url, str(e)))
            print(f"  [{i}/{len(urls)}] ✗ {e}")

    if echecs:
        print(f"\n{len(echecs)} échec(s) :")
        for url, message in echecs:
            print(f"  {url}\n    {message}")
        sys.exit(1)
    print(f"\n{len(urls)} PDF disponibles dans {DESTINATION}")


if __name__ == "__main__":
    main()
```

- [ ] **Étape 4 : ignorer les PDF, puis supprimer le corpus collecté à la main**

```bash
printf 'pdf/\n' > data/raw/.gitignore
git rm data/raw/programme_*.md data/raw/programme_*.txt
```

Les 18 fichiers ont été rassemblés un par un et ne sont traçables à aucune
source. Le manifeste les régénère ; les garder inviterait à en réutiliser un
silencieusement.

`data/raw/` ne doit plus contenir que `catalogue_second_degre.json`,
`sources_officielles.md`, les fichiers d'état de la veille, et `pdf/` (ignoré).

- [ ] **Étape 5 : lancer les tests puis le téléchargement réel**

```bash
uv run pytest tests/test_fetch_sources.py -q
uv run python scripts/fetch_sources.py
```

Attendu : 3 passed, puis ~80 PDF téléchargés sans échec.

- [ ] **Étape 6 : commit**

```bash
git add scripts/fetch_sources.py tests/test_fetch_sources.py data/raw/.gitignore
git commit -m "feat: fetch every programme the manifest declares in force"
```

---

### Tâche 7 : Extraction et découpage par matière

Le point dur. Les deux documents de cycle BO2020 (98 pages pour le cycle 3)
contiennent **toutes les matières non réformées** dans un seul PDF. C'est leur
non-découpage qui produit le déséquilibre actuel : 984 chunks d'allemand contre
282 de mathématiques.

**Fichiers :** modifier `scripts/extract_pdfs.py` ; créer
`tests/test_extraction.py`, `tests/fixtures/cycle3_extrait.txt`.

- [ ] **Étape 1 : constituer la fixture**

```bash
uv run python -c "
import pymupdf, pathlib
from scripts.fetch_sources import nom_fichier
url='https://cache.media.education.gouv.fr/file/31/88/7/ensel714_annexe2_1312887.pdf'
src = pathlib.Path('data/raw/pdf') / nom_fichier(url)
texte = '\n'.join(p.get_text() for p in pymupdf.open(src)[:12])
pathlib.Path('tests/fixtures/cycle3_extrait.txt').write_text(texte, encoding='utf-8')
print(len(texte), 'caractères')
"
```

- [ ] **Étape 2 : écrire le test qui échoue**

```python
# tests/test_extraction.py
"""Le découpage par matière des documents de cycle.

Sans lui, une matière n'est qu'une section noyée dans un document de 98 pages :
elle reçoit une poignée de chunks pendant qu'un programme de langue, publié
séparément, en reçoit des centaines. C'est la cause mesurée du déséquilibre
984 (allemand) contre 282 (mathématiques).
"""

from pathlib import Path

from scripts.extract_pdfs import decouper_par_matiere

FIXTURE = Path(__file__).parent / "fixtures" / "cycle3_extrait.txt"


def _parties():
    return decouper_par_matiere(FIXTURE.read_text(encoding="utf-8"))


def test_le_decoupage_trouve_plusieurs_matieres():
    parties = _parties()
    assert len(parties) >= 2, f"une seule matière détectée : {list(parties)}"


def test_chaque_partie_est_substantielle():
    for slug, texte in _parties().items():
        assert len(texte) > 500, f"{slug} : {len(texte)} caractères seulement"


def test_les_slugs_produits_existent_dans_le_schema():
    from schema import Matiere

    produits = set(_parties())
    assert produits <= {m.value for m in Matiere}, (
        f"slugs inconnus : {sorted(produits - {m.value for m in Matiere})}"
    )
```

- [ ] **Étape 3 : vérifier l'échec** — `decouper_par_matiere` n'existe pas

- [ ] **Étape 4 : implémenter**

Inspecter d'abord la structure réelle :

```bash
grep -nE "^(Volet|Partie|[A-ZÉÈÀ][A-Za-zÉèêîï' -]{4,60})$" tests/fixtures/cycle3_extrait.txt | head -40
```

Écrire `decouper_par_matiere(texte)` dans `scripts/extract_pdfs.py` : repérer les
titres de section correspondant à des matières via `MATIERE_LABELS`
(`schema/document.py`), découper aux frontières, renvoyer `{slug: texte}`. Les
sections hors matière (« Volet 1 : les spécificités du cycle ») sont ignorées.

**Vérifier que les matières trouvées couvrent celles déclarées par le manifeste**
pour ce document (`_MATIERES_CYCLE_3`). Un écart signale soit un titre non
reconnu, soit une matière déclarée à tort.

- [ ] **Étape 5 : vérifier** — `uv run pytest tests/test_extraction.py -q && uv run ruff check .` → 3 passed

- [ ] **Étape 6 : commit**

```bash
git add scripts/extract_pdfs.py tests/test_extraction.py tests/fixtures/cycle3_extrait.txt
git commit -m "feat: split cycle programmes by subject instead of indexing them whole"
```

---

### Tâche 8 : Ingestion sur le manifeste, sans orphelins

**Fichiers :** modifier `scripts/ingest.py`, `scripts/migrate_collection.py` ;
créer `tests/test_ingest_orphelins.py`.

- [ ] **Étape 1 : écrire le test qui échoue**

```python
# tests/test_ingest_orphelins.py
"""Réingérer une source ne doit pas laisser ses anciens chunks derrière.

Les identifiants dérivent du contenu : un texte modifié crée un point NEUF et
l'ancien reste servable. Des chunks périmés continueraient d'être présentés à des
élèves comme le programme officiel.
"""

from qdrant_client import QdrantClient, models

from schema import chunk_point_id
from scripts.ingest import supprimer_source


def test_supprimer_source_retire_uniquement_ses_points():
    client = QdrantClient(":memory:")
    client.create_collection(
        "t",
        vectors_config={"dense": models.VectorParams(size=2, distance=models.Distance.COSINE)},
    )
    client.upsert("t", points=[
        models.PointStruct(
            id=chunk_point_id("mathematiques", "sixieme", "a"), vector={"dense": [0.1, 0.2]},
            payload={"source_file": "vieux", "matiere": "mathematiques", "niveau": "sixieme"}),
        models.PointStruct(
            id=chunk_point_id("mathematiques", "sixieme", "b"), vector={"dense": [0.3, 0.4]},
            payload={"source_file": "autre", "matiere": "mathematiques", "niveau": "sixieme"}),
    ], wait=True)

    supprimer_source("vieux", client=client, collection="t")

    restants = client.scroll("t", limit=10, with_payload=True)[0]
    assert len(restants) == 1
    assert restants[0].payload["source_file"] == "autre"
```

- [ ] **Étape 2 : vérifier l'échec** — `cannot import name 'supprimer_source'`

- [ ] **Étape 3 : implémenter la suppression**

```python
def supprimer_source(source_file: str, *, client=None, collection: str | None = None) -> None:
    """Retire tous les points issus d'un fichier source.

    Appelé AVANT de réingérer ce fichier : les identifiants dérivant du contenu,
    un texte modifié produirait un point neuf en laissant l'ancien servable
    indéfiniment.
    """
    from qdrant_client import models

    (client or get_qdrant_client()).delete(
        collection_name=collection or get_collection_name(),
        points_selector=models.FilterSelector(
            filter=models.Filter(must=[
                models.FieldCondition(
                    key="source_file", match=models.MatchValue(value=source_file)
                )
            ])
        ),
        wait=True,
    )
```

- [ ] **Étape 4 : remplacer `SOURCES` par le manifeste**

Dans `scripts/ingest.py` : supprimer la constante `SOURCES: list[dict]`
(ligne 151) et parcourir `en_vigueur()`. Pour chaque programme, appeler
`supprimer_source(...)` avant l'upsert. Les documents multi-matières passent par
`decouper_par_matiere()` et produisent un lot par matière.

`source_file` reste le **nom du PDF** (`nom_fichier(url)`) : c'est la clé de
`supprimer_source`, et elle doit désigner un fichier, pas un slug.

- [ ] **Étape 5 : rendre la réindexation atomique**

Dans `scripts/migrate_collection.py` : utiliser `get_qdrant_client()` au lieu de
fabriquer son propre client (ligne 53 — il omet `cloud_inference=True`), et
créer une collection **neuve** horodatée, puis basculer l'alias
`tomai_educational` dessus une fois l'ingestion terminée
(`client.update_collection_aliases`). Réindexer en place laisserait le serveur
servir un index à moitié vide pendant l'opération, et un index mixte si elle
échoue.

- [ ] **Étape 6 : lancer toute la suite**

`uv run pytest -q && uv run ruff check . && uv run ruff format --check .`

- [ ] **Étape 7 : réindexer et vérifier la couverture**

```bash
uv run python scripts/migrate_collection.py     # collection neuve
uv run python scripts/ingest.py                 # ~0,25 € d'embeddings OVH
uv run python scripts/coverage_report.py        # doit sortir en 0
uv run python scripts/migrate_collection.py --promote   # bascule d'alias
```

Attendu : aucun couple manquant, aucun couple hors manifeste. **C'est le critère
de fin du plan.**

- [ ] **Étape 8 : commit**

```bash
git add scripts/ingest.py scripts/migrate_collection.py tests/test_ingest_orphelins.py
git commit -m "feat: drive ingestion from the manifest, with no orphans and an atomic swap"
```

---

### Tâche 9 : Retirer l'évaluation périmée et publier la couverture par niveau

**Fichiers :** supprimer `data/golden/questions.json`,
`scripts/generate_golden.py`, `scripts/evaluate.py`, `scripts/evaluate_judged.py`,
`schema/golden.py`, `schema/evaluation.py`, `tests/test_golden.py`,
`tests/test_evaluation.py` ; modifier `schema/__init__.py`,
`scripts/export_contract.py`, `tests/test_contract.py`, `contract.json`,
`CLAUDE.md`, `README.md`.

- [ ] **Étape 1 : supprimer**

```bash
git rm data/golden/questions.json scripts/generate_golden.py scripts/evaluate.py \
       scripts/evaluate_judged.py schema/golden.py schema/evaluation.py \
       tests/test_golden.py tests/test_evaluation.py
```

- [ ] **Étape 2 : nettoyer les exports**

Dans `schema/__init__.py`, retirer `GoldenQuestion`, `GoldenSet` et
`EMBEDDING_DIM` de l'import et de `__all__`. **Garder `l2_normalize`** :
`tests/test_ingest.py:323` le teste.

- [ ] **Étape 3 : exposer la couverture par niveau dans le contrat**

`contract.json` porte `matieres_indexees` mais rien par niveau. Ajouter
`niveaux_indexes` dans `scripts/export_contract.py`, dérivé de
`matrice_reelle()`, et l'assertion correspondante dans `tests/test_contract.py`.
C'est ce dont le lot serveur aura besoin pour fermer la dimension niveau comme
`RAG_SUBJECTS` a fermé la dimension matière.

- [ ] **Étape 4 : lancer toute la suite** — `uv run pytest -q && uv run ruff check .`

- [ ] **Étape 5 : mettre la documentation en accord**

Dans `apps/curriculum/CLAUDE.md` et `README.md` : retirer les commandes du golden
set, décrire le manifeste daté, `refresh_catalogue.py`, `fetch_sources.py` et
`coverage_report.py`, et renvoyer l'évaluation qualité au plan 3.

- [ ] **Étape 6 : commit**

```bash
git add -A schema/__init__.py scripts/export_contract.py tests/test_contract.py \
          contract.json CLAUDE.md README.md
git commit -m "refactor: drop the golden set and publish per-level coverage in the contract"
```

---

## Critères de fin du plan

1. `uv run python scripts/coverage_report.py` sort en **0** : chaque couple
   (niveau × matière) du manifeste en vigueur a du contenu indexé, et rien n'est
   indexé hors manifeste.
2. `uv run pytest -q` passe hors ligne ; `-m network` et `-m qdrant` passent
   quand les accès sont disponibles.
3. `en_vigueur(2026)` sert BO2020 à la 4e et BO2026 à la 5e pour le français.
4. Aucune ligne du périmètre n'est ni mappée ni explicitement exclue, et le
   périmètre ne peut pas se vider sans faire rougir un test.
5. `chunk_point_id` a **un** point de définition.
6. Réingérer une source ne laisse aucun orphelin ; la réindexation complète passe
   par une collection neuve et une bascule d'alias.
7. `contract.json` expose la couverture par niveau.

## Ce que ce plan ne fait pas

- **Tests de recherche sur Qdrant en mode local** → plan 2
- **Veille des réformes via l'API PISTE** → plan 2. L'impératif de fraîcheur
  n'est pas tenu tant qu'elle n'est pas livrée, et le calendrier d'entrée en
  vigueur inscrit dans `schema/programmes.py` reste non vérifié jusque-là.
- **Évaluation qualité (RAGAS + ranx)** → plan 3, après le corpus.
- **Adaptation d'`apps/server`** : fermer la dimension niveau côté agent et
  aligner les niveaux d'inscription → lot serveur distinct.
