# Corpus piloté par manifeste et test de couverture — Plan 1/3

> **Pour les agents d'exécution :** SOUS-COMPÉTENCE REQUISE — utiliser
> `superpowers:subagent-driven-development` (recommandé) ou
> `superpowers:executing-plans` pour dérouler ce plan tâche par tâche. Les étapes
> utilisent des cases à cocher (`- [ ]`).

**But :** produire un corpus **complet et à jour** des programmes officiels
(collège + lycée général et technologique), avec un test qui échoue tant qu'il
ne l'est pas.

**Architecture :** un *manifeste* dérivé de deux sources officielles décrit ce
qui **doit** exister ; l'index Qdrant décrit ce qui **existe** ; un test compare
les deux. Aucune des deux moitiés n'est écrite à la main — c'est ce qui
distingue ce dispositif de la métrique actuelle, qui compare l'index à lui-même
et ne peut donc pas échouer.

**Stack :** Python 3.12, `uv`, `httpx`, `pymupdf`, `chonkie`, `qdrant-client`,
`pydantic`. Aucune dépendance nouvelle.

**Spec :** `docs/superpowers/specs/2026-08-22-refonte-corpus-et-tests-rag-design.md`

## Contraintes globales

- **Périmètre** : collège (cycle 3, cycle 4) + lycée **général et technologique**.
  La voie professionnelle est hors périmètre.
- **Impératif** : le corpus doit être complet **et à jour des réformes**. Toute
  l'app repose dessus.
- **Aucune ligne du périmètre ne peut être ignorée en silence** : soit mappée
  vers un slug, soit exclue **avec un motif écrit**. Un test échoue sinon.
- **`education.gouv.fr` et `legifrance.gouv.fr` renvoient 403 (Cloudflare)** sur
  les pages HTML. Les PDF, eux, se téléchargent (HTTP 200 vérifié). Ne jamais
  scraper ces sites ; utiliser les URL de PDF directes.
- **Modèle d'embedding** : `Qwen3-Embedding-8B` @1024D via OVH — ne pas y
  toucher (`docs/adr/0002-embeddings-manages.md`).
- **Qualité** : `uv run ruff check . && uv run ruff format --check .` et
  `uv run pytest -q` doivent passer avant chaque commit.
- Toutes les commandes s'exécutent depuis `apps/curriculum/`.

---

### Tâche 1 : Un seul point de définition pour l'identifiant de chunk

L'identifiant `uuid5(matière:niveau:texte)` relie l'index, le manifeste et
l'évaluation. Il existe aujourd'hui en **quatre copies** (`scripts/ingest.py:450`,
`scripts/generate_golden.py:156`, `tests/test_ingest.py:292`,
`tests/test_golden.py:86`) et le test censé le verrouiller **réécrit la formule**
au lieu d'importer la source. Si quelqu'un ajoute un champ au seed, les tests
restent verts et la réindexation crée des identifiants neufs.

**Fichiers :**
- Modifier : `schema/document.py`, `schema/__init__.py`, `scripts/ingest.py`
- Test : `tests/test_document_id.py` (créer)

**Interfaces :**
- Produit : `chunk_point_id(matiere: str, niveau: str, text: str) -> str`

- [ ] **Étape 1 : écrire le test qui échoue**

```python
# tests/test_document_id.py
"""L'identifiant de point est le lien entre l'index et tout le reste.

Ces tests importent la SEULE définition. Une copie qui diverge doit casser
ici, pas six mois plus tard sur un index à moitié orphelin.
"""

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
    import uuid
    valeur = chunk_point_id("svt", "sixieme", "La respiration cellulaire")
    assert uuid.UUID(valeur)


def test_ingest_utilise_la_fonction_partagee():
    """Garde-fou contre la réapparition d'une copie : `ingest` ne doit plus
    contenir de calcul d'uuid5 en propre."""
    from pathlib import Path
    source = Path(__file__).resolve().parent.parent / "scripts" / "ingest.py"
    contenu = source.read_text(encoding="utf-8")
    assert "uuid5" not in contenu, "ingest.py recalcule un identifiant au lieu d'importer chunk_point_id"
```

- [ ] **Étape 2 : lancer le test et vérifier qu'il échoue**

Commande : `uv run pytest tests/test_document_id.py -q`
Attendu : ÉCHEC — `ImportError: cannot import name 'chunk_point_id'`

- [ ] **Étape 3 : écrire l'implémentation minimale**

Ajouter à la fin de `schema/document.py` :

```python
def chunk_point_id(matiere: str, niveau: str, text: str) -> str:
    """Identifiant stable et idempotent d'un point Qdrant.

    Dérivé du CONTENU seul : réingérer ne crée pas de doublon, et modifier un
    texte crée un point neuf. La matière et le niveau font partie du seed
    parce que le même texte existe légitimement plusieurs fois — les préambules
    pédagogiques sont identiques entre langues vivantes, et un chunk de cycle
    est dupliqué sur les niveaux du cycle.

    SEULE définition de cette formule. La réécrire ailleurs romprait le lien
    entre l'index et le manifeste sans qu'aucun test ne le voie.
    """
    seed = f"{matiere}:{niveau}:{text}"
    digest = hashlib.sha256(seed.encode("utf-8")).hexdigest()
    return str(uuid.uuid5(uuid.NAMESPACE_URL, digest))
```

En tête de `schema/document.py`, ajouter si absent : `import hashlib` et
`import uuid`.

Dans `schema/__init__.py`, ajouter `chunk_point_id` à l'import depuis
`.document` **et** à `__all__` (ordre alphabétique).

- [ ] **Étape 4 : brancher `ingest.py` sur la fonction partagée**

Dans `scripts/ingest.py`, remplacer le bloc de calcul (autour de la ligne 445) :

```python
        id_seed = f"{matiere}:{niveau}:{text}"
        text_hash = hashlib.sha256(id_seed.encode("utf-8")).hexdigest()
        point_id = str(_uuid.uuid5(_uuid.NAMESPACE_URL, text_hash))
```

par :

```python
        point_id = chunk_point_id(matiere, niveau, text)
```

Ajouter `chunk_point_id` à l'import `from schema import ...` en tête de fichier.
Retirer les imports `hashlib` et `uuid` s'ils ne servent plus (ruff le signalera).

- [ ] **Étape 5 : lancer les tests et vérifier qu'ils passent**

Commande : `uv run pytest tests/test_document_id.py -q && uv run ruff check .`
Attendu : 6 passed, ruff sans erreur

- [ ] **Étape 6 : commit**

```bash
git add schema/document.py schema/__init__.py scripts/ingest.py tests/test_document_id.py
git commit -m "refactor: give the chunk point id a single definition"
```

---

### Tâche 2 : Table de correspondance, et la règle du zéro silence

Le CSV officiel porte **103 disciplines** et **32 niveaux** ; notre schéma en a
24 et 7. La table qui les relie est exactement l'endroit d'où venait le bug P0-1
(l'agent demandait `histoire`, l'index portait `histoire_geo`).

**Fichiers :**
- Créer : `schema/mapping.py`, `tests/test_mapping.py`

**Interfaces :**
- Produit : `DISCIPLINE_VERS_SLUG: dict[str, str]`,
  `NIVEAU_VERS_NIVEAUX: dict[str, tuple[str, ...]]`,
  `DISCIPLINES_EXCLUES: dict[str, str]` (libellé → motif),
  `NIVEAUX_EXCLUS: dict[str, str]`

- [ ] **Étape 1 : écrire le test qui échoue**

```python
# tests/test_mapping.py
"""Aucune ligne du périmètre ne peut disparaître en silence.

Une discipline officielle ni mappée ni exclue est un trou dans le corpus que
rien d'autre ne signalerait : Qdrant ne renvoie pas d'erreur pour un filtre
qui ne matche rien, il renvoie zéro résultat.
"""

import csv
from pathlib import Path

from schema.mapping import (
    DISCIPLINE_VERS_SLUG,
    DISCIPLINES_EXCLUES,
    NIVEAU_VERS_NIVEAUX,
    NIVEAUX_EXCLUS,
    lignes_du_perimetre,
)

CSV = Path(__file__).resolve().parent.parent / "data" / "raw" / "programmes_second_degre_datagouv.json"


def _lignes():
    with CSV.open(encoding="utf-8-sig") as f:
        return list(csv.DictReader(f, delimiter=";"))


def test_chaque_discipline_du_perimetre_est_mappee_ou_exclue():
    manquantes = sorted(
        {
            r["Discipline"].strip()
            for r in lignes_du_perimetre(_lignes())
            if r["Discipline"].strip() not in DISCIPLINE_VERS_SLUG
            and r["Discipline"].strip() not in DISCIPLINES_EXCLUES
        }
    )
    assert not manquantes, f"disciplines ni mappées ni exclues : {manquantes}"


def test_chaque_niveau_du_perimetre_est_mappe_ou_exclu():
    manquants = sorted(
        {
            r["Niveau d'enseignement"].strip()
            for r in lignes_du_perimetre(_lignes())
            if r["Niveau d'enseignement"].strip() not in NIVEAU_VERS_NIVEAUX
            and r["Niveau d'enseignement"].strip() not in NIVEAUX_EXCLUS
        }
    )
    assert not manquants, f"niveaux ni mappés ni exclus : {manquants}"


def test_toute_exclusion_porte_un_motif_non_vide():
    for table in (DISCIPLINES_EXCLUES, NIVEAUX_EXCLUS):
        vides = [k for k, motif in table.items() if not motif.strip()]
        assert not vides, f"exclusions sans motif : {vides}"


def test_les_slugs_cibles_existent_dans_le_schema():
    from schema import Matiere
    connus = {m.value for m in Matiere}
    inconnus = sorted(set(DISCIPLINE_VERS_SLUG.values()) - connus)
    assert not inconnus, f"slugs absents de l'enum Matiere : {inconnus}"


def test_les_niveaux_cibles_existent_dans_le_schema():
    from schema import NiveauCollege, NiveauLycee
    connus = {n.value for n in NiveauCollege} | {n.value for n in NiveauLycee}
    cibles = {n for tup in NIVEAU_VERS_NIVEAUX.values() for n in tup}
    inconnus = sorted(cibles - connus)
    assert not inconnus, f"niveaux absents des enums : {inconnus}"
```

- [ ] **Étape 2 : lancer le test et vérifier qu'il échoue**

Commande : `uv run pytest tests/test_mapping.py -q`
Attendu : ÉCHEC — `ModuleNotFoundError: No module named 'schema.mapping'`

- [ ] **Étape 3 : créer le squelette du module**

```python
# schema/mapping.py
"""Correspondance entre les libellés officiels et nos slugs.

Le CSV data.gouv porte 103 disciplines et 32 niveaux ; notre schéma en a 24 et
7. Cette table fait le pont — et c'est précisément l'endroit où un décalage
devient invisible : Qdrant ne renvoie pas d'erreur pour un filtre qui ne matche
rien, il renvoie zéro résultat, et l'agent conclut que le programme ne dit rien.

RÈGLE : toute entrée du périmètre est soit mappée, soit exclue AVEC UN MOTIF.
`tests/test_mapping.py` échoue sinon. Si le ministère publie une discipline
l'an prochain, le test rougit au lieu de la laisser disparaître.
"""

from __future__ import annotations

# Périmètre produit : collège + lycée général et technologique.
VOIES_RETENUES = frozenset({"Générale", "Technologique", "Générale et technologique"})
NIVEAUX_COLLEGE = frozenset({"Collège", "Cycle 3", "Cycle 4"})


def lignes_du_perimetre(lignes: list[dict]) -> list[dict]:
    """Filtre les entrées en vigueur du périmètre produit.

    « Abrogé à la rentrée » vaut `-` quand le texte est toujours en vigueur :
    tester la vacuité seule exclurait tout le jeu de données.
    """
    retenues = []
    for r in lignes:
        if (r.get("Abrogé à la rentrée") or "").strip() not in ("", "-"):
            continue
        niveau = (r.get("Niveau d'enseignement") or "").strip()
        voie = (r.get("Voie") or "").strip()
        if niveau in NIVEAUX_COLLEGE or voie in VOIES_RETENUES:
            retenues.append(r)
    return retenues


DISCIPLINE_VERS_SLUG: dict[str, str] = {}
DISCIPLINES_EXCLUES: dict[str, str] = {}
NIVEAU_VERS_NIVEAUX: dict[str, tuple[str, ...]] = {}
NIVEAUX_EXCLUS: dict[str, str] = {}
```

- [ ] **Étape 4 : remplir les tables jusqu'à ce que le test passe**

**Le test EST la liste de travail.** Il n'y a rien à deviner : il affiche les
libellés non traités. Boucle à répéter jusqu'au vert :

```bash
uv run pytest tests/test_mapping.py::test_chaque_discipline_du_perimetre_est_mappee_ou_exclue -q
# → AssertionError: disciplines ni mappées ni exclues : ['Arts', 'Biochimie…', …]
```

Pour chaque libellé affiché, appliquer cette règle de décision :

| Le libellé désigne… | Action |
|---|---|
| une matière du produit (`Matiere`) | `DISCIPLINE_VERS_SLUG[libellé] = "slug"` |
| une spécialité de série technologique sans équivalent (« Biotechnologies », « Analyse et méthode en design », « Agronomie-Economie-Territoires »…) | `DISCIPLINES_EXCLUES[libellé] = "spécialité de série technologique sans équivalent produit"` |
| un enseignement optionnel ou facultatif dont la matière existe déjà (« Enseignement optionnel d'arts ») | mapper vers le slug de la matière |
| `-` (ligne sans discipline : programme de cycle entier) | `DISCIPLINES_EXCLUES["-"] = "document multi-matières, ventilé à l'extraction"` |

Relancer après chaque poignée d'entrées. Même boucle pour les niveaux avec
`test_chaque_niveau_du_perimetre_est_mappe_ou_exclu`.

**Ne pas étendre l'enum `Matiere` ici.** Si une matière du produit manque
vraiment (ex. « philosophie » absente de l'enum), l'ajouter est une décision de
schéma : la noter et la traiter en fin de tâche, en une seule fois, avec le test
`test_les_slugs_cibles_existent_dans_le_schema` comme garde-fou.

Décisions déjà tranchées, à reporter telles quelles :

```python
NIVEAU_VERS_NIVEAUX = {
    # Le collège est décrit par cycle dans le CSV : un document couvre
    # plusieurs niveaux, d'où le tuple.
    "Cycle 3": ("sixieme",),          # CM1/CM2 sont hors produit (primaire)
    "Cycle 4": ("cinquieme", "quatrieme", "troisieme"),
    "Collège": ("sixieme", "cinquieme", "quatrieme", "troisieme"),
    "Seconde générale et technologique": ("seconde",),
    "Première générale": ("premiere",),
    "Terminale générale": ("terminale",),
    # Séries technologiques : le niveau produit est le même, la série est une
    # spécialisation que notre schéma ne porte pas.
    "Première STMG": ("premiere",),
    "Terminale STMG": ("terminale",),
    # Les autres séries technologiques (STI2D, STL, STD2A, STHR, ST2S, S2TMD)
    # suivent le même principe : le niveau produit est premiere/terminale, la
    # série est une spécialisation que notre schéma ne porte pas.
}

NIVEAUX_EXCLUS = {
    "Seconde professionnelle": "voie professionnelle hors périmètre produit",
    "Première professionnelle": "voie professionnelle hors périmètre produit",
    "Terminale professionnelle": "voie professionnelle hors périmètre produit",
    "Première année de CAP": "voie professionnelle hors périmètre produit",
    "Terminale L": "série supprimée par la réforme du lycée de 2019",
    "Terminale S": "série supprimée par la réforme du lycée de 2019",
    "Terminale ES": "série supprimée par la réforme du lycée de 2019",
    "Première L": "série supprimée par la réforme du lycée de 2019",
    "Première S": "série supprimée par la réforme du lycée de 2019",
    "Sections internationales italiennes au collège": "public spécifique hors produit",
}
```

Pour les disciplines, la règle de décision : mapper vers le slug existant
lorsque l'enseignement correspond à une matière du produit ; exclure avec motif
lorsqu'il s'agit d'une spécialité de série technologique sans équivalent
(« Biotechnologies », « Analyse et méthode en design »…). **Ne pas étendre l'enum
`Matiere` dans cette tâche** : si une matière manque vraiment, le noter et
traiter en fin de plan.

- [ ] **Étape 5 : lancer les tests et vérifier qu'ils passent**

Commande : `uv run pytest tests/test_mapping.py -q && uv run ruff check .`
Attendu : 5 passed

- [ ] **Étape 6 : commit**

```bash
git add schema/mapping.py tests/test_mapping.py
git commit -m "feat: map official programme labels to our slugs, with no silent drops"
```

---

### Tâche 3 : Le manifeste

**Fichiers :**
- Créer : `schema/sources.py`, `tests/test_sources.py`

**Interfaces :**
- Produit : `SourceProgramme` (dataclass gelée : `slug_matiere: str`,
  `niveaux: tuple[str, ...]`, `url: str`, `reference: str`, `origine: str`),
  `charger_manifeste() -> list[SourceProgramme]`,
  `matrice_attendue() -> set[tuple[str, str]]` (couples niveau × matière)

- [ ] **Étape 1 : écrire le test qui échoue**

```python
# tests/test_sources.py
"""Le manifeste dit ce qui DOIT exister. C'est la moitié du test de couverture
que l'index ne peut pas fournir."""

from schema.sources import SourceProgramme, charger_manifeste, matrice_attendue


def test_le_manifeste_couvre_le_college_et_le_lycee():
    niveaux = {n for s in charger_manifeste() for n in s.niveaux}
    assert {"sixieme", "cinquieme", "quatrieme", "troisieme"} <= niveaux
    assert {"seconde", "premiere", "terminale"} <= niveaux


def test_les_reformes_recentes_du_college_sont_presentes():
    """Elles ne sont PAS dans le CSV data.gouv, qui s'arrête à la rentrée 2021.
    Leur absence ici ferait régresser le collège de six ans."""
    refs = {s.reference for s in charger_manifeste()}
    assert any("MENE2504620A" in r for r in refs), "français/maths cycle 3 BO2025 absent"
    assert any("MENE2602912A" in r for r in refs), "français/maths cycle 4 BO2026 absent"


def test_chaque_entree_porte_une_url_et_une_reference():
    for s in charger_manifeste():
        assert s.url.startswith("http"), f"URL invalide : {s}"
        assert s.reference.strip(), f"référence vide : {s}"


def test_la_matrice_attendue_est_un_produit_niveau_matiere():
    matrice = matrice_attendue()
    assert ("terminale", "philosophie") in matrice
    assert ("cinquieme", "mathematiques") in matrice
    assert all(isinstance(c, tuple) and len(c) == 2 for c in matrice)


def test_aucun_doublon_niveau_matiere_url():
    vus = set()
    for s in charger_manifeste():
        for n in s.niveaux:
            cle = (n, s.slug_matiere, s.url)
            assert cle not in vus, f"doublon : {cle}"
            vus.add(cle)
```

- [ ] **Étape 2 : lancer le test et vérifier qu'il échoue**

Commande : `uv run pytest tests/test_sources.py -q`
Attendu : ÉCHEC — `ModuleNotFoundError: No module named 'schema.sources'`

- [ ] **Étape 3 : écrire l'implémentation**

```python
# schema/sources.py
"""Le manifeste : ce qui DOIT exister dans l'index.

Deux sources, et c'est nécessaire :

- le CSV data.gouv couvre le **lycée** par discipline, complet et vérifié ;
- il est **périmé pour le collège** (aucune entrée après la rentrée 2021, la
  « maj 2026-02-02 » n'est qu'un rafraîchissement de métadonnées), et il y
  décrit le collège par cycle entier plutôt que par matière.

D'où la table `COLLEGE` ci-dessous, tenue à jour par la veille des arrêtés.
"""

from __future__ import annotations

import csv
from dataclasses import dataclass
from pathlib import Path

from .mapping import (
    DISCIPLINE_VERS_SLUG,
    NIVEAU_VERS_NIVEAUX,
    lignes_du_perimetre,
)

CSV_DATAGOUV = Path(__file__).resolve().parent.parent / "data" / "raw" / "programmes_second_degre_datagouv.json"


@dataclass(frozen=True, slots=True)
class SourceProgramme:
    slug_matiere: str
    niveaux: tuple[str, ...]
    url: str
    reference: str
    origine: str  # "datagouv" | "college"


# Programmes du collège. Le CSV ne les porte pas à jour : les réformes de 2024,
# 2025 et 2026 lui sont postérieures. Chaque entrée cite son arrêté pour que la
# veille puisse détecter son abrogation.
COLLEGE: tuple[SourceProgramme, ...] = (
    SourceProgramme("francais", ("sixieme",),
        "https://www.education.gouv.fr/sites/default/files/ensel620_annexe1.pdf",
        "BO 2025 · NOR MENE2504620A", "college"),
    SourceProgramme("mathematiques", ("sixieme",),
        "https://www.education.gouv.fr/sites/default/files/ensel620_annexe2-v2.pdf",
        "BO 2025 · NOR MENE2504620A", "college"),
    SourceProgramme("francais", ("cinquieme", "quatrieme", "troisieme"),
        "https://www.education.gouv.fr/sites/default/files/document/Annexe 1 – Programme de français pour le cycle 4-480713.pdf",
        "BO 2026 · NOR MENE2602912A", "college"),
    SourceProgramme("mathematiques", ("cinquieme", "quatrieme", "troisieme"),
        "https://www.education.gouv.fr/sites/default/files/document/Annexe 2 – Programme de mathématiques pour le cycle 4-480716.pdf",
        "BO 2026 · NOR MENE2602912A", "college"),
    SourceProgramme("technologie", ("cinquieme", "quatrieme", "troisieme"),
        "https://www.education.gouv.fr/sites/default/files/document/Annexe — Programme de technologie du cycle 4-368016.pdf",
        "BO 2024", "college"),
    # Langues vivantes, arrêté du 5-5-2025 (NOR MENE2504621A). education.gouv.fr
    # bloque les requêtes automatisées sur ses pages ; miroir utilisé.
    SourceProgramme("anglais", ("cinquieme", "quatrieme", "troisieme"),
        "https://reforme.education/app/uploads/2025/05/prog-college-anglais.pdf",
        "BO 2025 · NOR MENE2504621A", "college"),
    SourceProgramme("espagnol", ("cinquieme", "quatrieme", "troisieme"),
        "https://reforme.education/app/uploads/2025/05/prog-college-espagnol.pdf",
        "BO 2025 · NOR MENE2504621A", "college"),
    SourceProgramme("allemand", ("cinquieme", "quatrieme", "troisieme"),
        "https://reforme.education/app/uploads/2025/05/prog-college-allemand.pdf",
        "BO 2025 · NOR MENE2504621A", "college"),
    SourceProgramme("italien", ("cinquieme", "quatrieme", "troisieme"),
        "https://reforme.education/app/uploads/2025/05/prog-college-italien.pdf",
        "BO 2025 · NOR MENE2504621A", "college"),
    # Documents de cycle BO2020 : ils portent les matières NON réformées
    # (physique-chimie, SVT, histoire-géo, arts, musique, EPS, EMC). Le
    # découpage par matière se fait à l'extraction (tâche 6).
    SourceProgramme("_cycle3", ("sixieme",),
        "https://cache.media.education.gouv.fr/file/31/88/7/ensel714_annexe2_1312887.pdf",
        "BO 2020", "college"),
    SourceProgramme("_cycle4", ("cinquieme", "quatrieme", "troisieme"),
        "https://cache.media.education.gouv.fr/file/31/89/1/ensel714_annexe3_1312891.pdf",
        "BO 2020", "college"),
)


def _depuis_datagouv() -> list[SourceProgramme]:
    with CSV_DATAGOUV.open(encoding="utf-8-sig") as f:
        lignes = list(csv.DictReader(f, delimiter=";"))

    sources: list[SourceProgramme] = []
    vus: set[tuple] = set()
    for r in lignes_du_perimetre(lignes):
        discipline = r["Discipline"].strip()
        niveau_officiel = r["Niveau d'enseignement"].strip()
        slug = DISCIPLINE_VERS_SLUG.get(discipline)
        niveaux = NIVEAU_VERS_NIVEAUX.get(niveau_officiel)
        url = (r["Contenu"] or "").strip()
        if not slug or not niveaux or not url.lower().endswith(".pdf"):
            continue  # exclusions déjà validées par tests/test_mapping.py
        cle = (slug, niveaux, url)
        if cle in vus:
            continue  # le même PDF sert plusieurs séries technologiques
        vus.add(cle)
        sources.append(SourceProgramme(slug, niveaux, url, r["Texte officiel"].strip() or "data.gouv", "datagouv"))
    return sources


def charger_manifeste() -> list[SourceProgramme]:
    """Tout ce qui doit être ingéré, collège et lycée."""
    return list(COLLEGE) + _depuis_datagouv()


def matrice_attendue() -> set[tuple[str, str]]:
    """Couples (niveau, matière) qui doivent avoir du contenu indexé.

    Les entrées `_cycle3` / `_cycle4` sont exclues : ce sont des documents
    multi-matières dont la ventilation se décide à l'extraction, pas ici.
    """
    return {
        (niveau, s.slug_matiere)
        for s in charger_manifeste()
        if not s.slug_matiere.startswith("_")
        for niveau in s.niveaux
    }
```

- [ ] **Étape 4 : lancer les tests et vérifier qu'ils passent**

Commande : `uv run pytest tests/test_sources.py -q && uv run ruff check .`
Attendu : 5 passed

- [ ] **Étape 5 : commit**

```bash
git add schema/sources.py tests/test_sources.py
git commit -m "feat: derive the corpus manifest from official sources"
```

---

### Tâche 4 : Le test de couverture

L'instrument. Il doit **échouer immédiatement** — c'est ce qui définit « fini »
pour les tâches suivantes.

**Fichiers :**
- Créer : `scripts/coverage_report.py`, `tests/test_coverage.py`
- Supprimer : `scripts/audit_coverage.py`

**Interfaces :**
- Consomme : `matrice_attendue()` (tâche 3), `get_qdrant_client()`,
  `get_collection_name()`
- Produit : `matrice_reelle() -> dict[tuple[str, str], int]`,
  `cases_manquantes() -> list[tuple[str, str]]`

- [ ] **Étape 1 : écrire le test qui échoue**

```python
# tests/test_coverage.py
"""Le corpus est-il complet ?

Ce test compare deux choses INDÉPENDANTES : ce que le manifeste dit qui doit
exister, et ce que l'index contient. L'ancienne métrique comparait l'index à
lui-même et bornait le résultat à 100 % — elle ne pouvait pas échouer.

Marqué `integration` : il interroge Qdrant Cloud.
"""

import pytest

from scripts.coverage_report import cases_manquantes, matrice_reelle
from schema.sources import matrice_attendue


@pytest.mark.integration
def test_toute_case_attendue_a_du_contenu():
    manquantes = cases_manquantes()
    assert not manquantes, (
        f"{len(manquantes)} couples (niveau, matière) sans contenu indexé : "
        f"{sorted(manquantes)[:20]}"
    )


@pytest.mark.integration
def test_l_index_ne_contient_rien_hors_manifeste():
    """Un couple indexé mais absent du manifeste signale un slug inventé ou un
    reliquat d'une ingestion antérieure."""
    hors = sorted(set(matrice_reelle()) - matrice_attendue())
    assert not hors, f"couples indexés hors manifeste : {hors}"


@pytest.mark.integration
def test_aucune_case_n_est_squelettique():
    """Une case à 1 ou 2 chunks trahit une extraction ratée, pas une couverture."""
    maigres = {c: n for c, n in matrice_reelle().items() if 0 < n < 3}
    assert not maigres, f"couples à moins de 3 chunks : {maigres}"
```

- [ ] **Étape 2 : lancer le test et vérifier qu'il échoue**

Commande : `uv run pytest tests/test_coverage.py -q -m integration`
Attendu : ÉCHEC — `ModuleNotFoundError: No module named 'scripts.coverage_report'`

- [ ] **Étape 3 : écrire l'implémentation**

```python
# scripts/coverage_report.py
"""Couverture réelle de l'index, par couple (niveau, matière).

Remplace `audit_coverage.py`, dont la métrique était bornée par
`min(indexed / source * 100, 100.0)`. Avec l'expansion multi-niveaux ce ratio
vaut structurellement ×3 : l'indicateur affichait « 100 % » tant qu'on ne
perdait pas plus des deux tiers du corpus.

Ici il n'y a pas de ratio à borner : une case a du contenu, ou elle n'en a pas.
"""

from __future__ import annotations

import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv  # noqa: E402

from schema.retrieval import get_collection_name, get_qdrant_client  # noqa: E402
from schema.sources import matrice_attendue  # noqa: E402

load_dotenv()


def matrice_reelle(collection: str | None = None) -> dict[tuple[str, str], int]:
    """Nombre de points indexés par couple (niveau, matière)."""
    client = get_qdrant_client()
    nom = collection or get_collection_name()
    compte: Counter[tuple[str, str]] = Counter()
    offset = None
    while True:
        points, offset = client.scroll(
            nom, limit=1000, offset=offset, with_payload=["niveau", "matiere"], with_vectors=False
        )
        for p in points:
            compte[(p.payload.get("niveau"), p.payload.get("matiere"))] += 1
        if offset is None:
            return dict(compte)


def cases_manquantes(collection: str | None = None) -> list[tuple[str, str]]:
    """Couples attendus par le manifeste et absents de l'index."""
    reelle = matrice_reelle(collection)
    return sorted(c for c in matrice_attendue() if reelle.get(c, 0) == 0)


def main() -> None:
    reelle = matrice_reelle()
    attendue = matrice_attendue()
    manquantes = [c for c in attendue if reelle.get(c, 0) == 0]

    print(f"attendu : {len(attendue)} couples (niveau × matière)")
    print(f"couvert : {len(attendue) - len(manquantes)}")
    print(f"manquant: {len(manquantes)}\n")
    for niveau, matiere in sorted(manquantes):
        print(f"  ✗ {niveau:<12} {matiere}")
    if manquantes:
        sys.exit(1)


if __name__ == "__main__":
    main()
```

Déclarer le marqueur dans `pyproject.toml` :

```toml
[tool.pytest.ini_options]
markers = ["integration: interroge Qdrant Cloud (réseau + clé requis)"]
```

- [ ] **Étape 4 : lancer le test et constater l'échec ATTENDU**

Commande : `uv run pytest tests/test_coverage.py -q -m integration`
Attendu : ÉCHEC listant les couples manquants — dont les 3 niveaux du lycée pour
toutes les matières. **C'est le résultat correct** : l'instrument fonctionne et
mesure un corpus incomplet.

- [ ] **Étape 5 : supprimer la métrique remplacée**

```bash
git rm scripts/audit_coverage.py
```

Retirer aussi le rapport commité `docs/audits/coverage_2026-05-18.md` s'il
existe : il affiche `228 447/76 344` annoncé « ✅ 100 % ».

- [ ] **Étape 6 : commit**

```bash
git add scripts/coverage_report.py tests/test_coverage.py pyproject.toml
git commit -m "feat: make corpus coverage a test that can actually fail"
```

---

### Tâche 5 : Téléchargement piloté par le manifeste

**Fichiers :**
- Créer : `scripts/fetch_sources.py`
- Modifier : `data/raw/.gitignore` (ajouter `*.pdf` s'il n'y est pas)

**Interfaces :**
- Consomme : `charger_manifeste()` (tâche 3)
- Produit : des PDF dans `data/raw/pdf/`, nommés depuis un hash stable de l'URL

- [ ] **Étape 1 : écrire le test qui échoue**

```python
# tests/test_fetch_sources.py
"""Le téléchargement doit échouer bruyamment.

Un téléchargeur qui avale ses erreurs produit un corpus partiel que le test de
couverture signalera — mais plusieurs étapes trop tard, et sans dire pourquoi.
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

- [ ] **Étape 2 : lancer le test et vérifier qu'il échoue**

Commande : `uv run pytest tests/test_fetch_sources.py -q`
Attendu : ÉCHEC — module absent

- [ ] **Étape 3 : écrire l'implémentation**

```python
# scripts/fetch_sources.py
"""Télécharge les PDF listés par le manifeste.

Échoue bruyamment, et c'est le point : `education.gouv.fr` renvoie du HTML
Cloudflare (403) sur ses pages, et un téléchargeur permissif écrirait cette
page d'erreur dans un fichier `.pdf` que l'extraction traiterait comme un
programme vide.
"""

from __future__ import annotations

import hashlib
import sys
import urllib.parse
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from schema.sources import charger_manifeste  # noqa: E402

DESTINATION = Path(__file__).resolve().parent.parent / "data" / "raw" / "pdf"
TIMEOUT_S = 120.0


def nom_fichier(url: str) -> str:
    """Nom stable dérivé de l'URL. Les URL officielles contiennent des espaces
    et des tirets cadratins ; un hash évite d'en dépendre."""
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
    DESTINATION.mkdir(parents=True, exist_ok=True)
    sources = charger_manifeste()
    urls = sorted({s.url for s in sources})
    print(f"{len(sources)} entrées de manifeste → {len(urls)} PDF uniques\n")

    echecs = []
    for i, url in enumerate(urls, start=1):
        chemin = DESTINATION / nom_fichier(url)
        if chemin.exists():
            print(f"  [{i}/{len(urls)}] déjà présent")
            continue
        try:
            telecharger_un(url, DESTINATION)
            print(f"  [{i}/{len(urls)}] ✓ {url[:90]}")
        except Exception as e:
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

- [ ] **Étape 4 : supprimer le corpus collecté à la main**

Les 18 fichiers `.md`/`.txt` de `data/raw/` ont été rassemblés un par un. Le
manifeste les régénère tous. **Les garder inviterait à en réutiliser un
silencieusement**, et on ne saurait plus lequel vient d'où.

```bash
git rm data/raw/programme_*.md data/raw/programme_*.txt
```

`data/raw/` ne doit plus contenir que : `programmes_second_degre_datagouv.json`
(le CSV source), `sources_officielles.md` (la carte des sources), les fichiers
d'état de la veille, et le dossier `pdf/` produit par ce script.

- [ ] **Étape 5 : lancer les tests puis le téléchargement réel**

```bash
uv run pytest tests/test_fetch_sources.py -q
uv run python scripts/fetch_sources.py
```

Attendu : 3 passed, puis ~129 PDF téléchargés sans échec.

- [ ] **Étape 6 : commit**

```bash
git add -A scripts/fetch_sources.py tests/test_fetch_sources.py data/raw/
git commit -m "feat: fetch every programme the manifest lists, and drop the hand-picked ones"
```

---

### Tâche 6 : Extraction et découpage par matière

Le point dur du plan. Les deux documents de cycle BO2020 (98 pages pour le
cycle 3) contiennent **toutes les matières non réformées** dans un seul PDF.
C'est leur non-découpage qui produit le déséquilibre actuel : 984 chunks
d'allemand contre 282 de mathématiques.

**Fichiers :**
- Modifier : `scripts/extract_pdfs.py`
- Créer : `tests/test_extraction.py`, `tests/fixtures/cycle3_extrait.txt`

**Interfaces :**
- Consomme : `charger_manifeste()`, `nom_fichier()` (tâche 5)
- Produit : `extraire(chemin_pdf: Path) -> str`,
  `decouper_par_matiere(texte: str) -> dict[str, str]`

- [ ] **Étape 1 : constituer la fixture**

```bash
uv run python -c "
import pymupdf, pathlib
from scripts.fetch_sources import nom_fichier
src = pathlib.Path('data/raw/pdf') / nom_fichier('https://cache.media.education.gouv.fr/file/31/88/7/ensel714_annexe2_1312887.pdf')
doc = pymupdf.open(src)
texte = '\n'.join(p.get_text() for p in doc[:12])
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


def test_le_decoupage_trouve_plusieurs_matieres():
    parties = decouper_par_matiere(FIXTURE.read_text(encoding="utf-8"))
    assert len(parties) >= 2, f"une seule matière détectée : {list(parties)}"


def test_chaque_partie_est_substantielle():
    for slug, texte in decouper_par_matiere(FIXTURE.read_text(encoding="utf-8")).items():
        assert len(texte) > 500, f"{slug} : {len(texte)} caractères seulement"


def test_les_slugs_produits_existent_dans_le_schema():
    from schema import Matiere
    connus = {m.value for m in Matiere}
    produits = set(decouper_par_matiere(FIXTURE.read_text(encoding="utf-8")))
    assert produits <= connus, f"slugs inconnus : {sorted(produits - connus)}"
```

- [ ] **Étape 3 : lancer le test et vérifier qu'il échoue**

Commande : `uv run pytest tests/test_extraction.py -q`
Attendu : ÉCHEC — `decouper_par_matiere` n'existe pas

- [ ] **Étape 4 : implémenter le découpage**

Inspecter d'abord la structure réelle du document :

```bash
grep -nE "^(Volet|Partie|[A-ZÉÈÀ][A-Za-zÉèêîï' -]{4,60})$" tests/fixtures/cycle3_extrait.txt | head -40
```

Écrire `decouper_par_matiere(texte)` dans `scripts/extract_pdfs.py` : repérer les
titres de section correspondant à des matières via `MATIERE_LABELS`
(`schema/document.py`), découper aux frontières, renvoyer `{slug: texte}`.
Les sections hors matière (« Volet 1 : les spécificités du cycle ») sont ignorées.

- [ ] **Étape 5 : lancer les tests et vérifier qu'ils passent**

Commande : `uv run pytest tests/test_extraction.py -q && uv run ruff check .`
Attendu : 3 passed

- [ ] **Étape 6 : commit**

```bash
git add scripts/extract_pdfs.py tests/test_extraction.py tests/fixtures/cycle3_extrait.txt
git commit -m "feat: split cycle programmes by subject instead of indexing them whole"
```

---

### Tâche 7 : Ingestion sur le manifeste, sans orphelins

**Fichiers :**
- Modifier : `scripts/ingest.py`
- Créer : `tests/test_ingest_orphelins.py`

**Interfaces :**
- Consomme : `charger_manifeste()`, `chunk_point_id()`, `decouper_par_matiere()`
- Produit : `supprimer_source(source_file: str) -> int`

- [ ] **Étape 1 : écrire le test qui échoue**

```python
# tests/test_ingest_orphelins.py
"""Réingérer une source ne doit pas laisser ses anciens chunks derrière.

Les identifiants dérivent du contenu : un texte modifié crée un point NEUF et
l'ancien reste servable. Des chunks périmés continueraient d'être présentés à
des élèves comme le programme officiel.
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
        models.PointStruct(id=chunk_point_id("maths", "sixieme", "a"), vector={"dense": [0.1, 0.2]},
                           payload={"source_file": "vieux", "matiere": "maths", "niveau": "sixieme"}),
        models.PointStruct(id=chunk_point_id("maths", "sixieme", "b"), vector={"dense": [0.3, 0.4]},
                           payload={"source_file": "autre", "matiere": "maths", "niveau": "sixieme"}),
    ], wait=True)

    supprimer_source("vieux", client=client, collection="t")

    restants = client.scroll("t", limit=10, with_payload=True)[0]
    assert len(restants) == 1
    assert restants[0].payload["source_file"] == "autre"
```

- [ ] **Étape 2 : lancer le test et vérifier qu'il échoue**

Commande : `uv run pytest tests/test_ingest_orphelins.py -q`
Attendu : ÉCHEC — `cannot import name 'supprimer_source'`

- [ ] **Étape 3 : implémenter la suppression**

```python
def supprimer_source(source_file: str, *, client=None, collection: str | None = None) -> None:
    """Retire tous les points issus d'un fichier source.

    Appelé AVANT de réingérer ce fichier : les identifiants dérivant du
    contenu, un texte modifié produirait un point neuf en laissant l'ancien
    servable indéfiniment.
    """
    from qdrant_client import models

    cli = client or get_qdrant_client()
    nom = collection or COLLECTION
    cli.delete(
        collection_name=nom,
        points_selector=models.FilterSelector(
            filter=models.Filter(must=[
                models.FieldCondition(key="source_file", match=models.MatchValue(value=source_file))
            ])
        ),
        wait=True,
    )
```

- [ ] **Étape 4 : remplacer `SOURCES` par le manifeste**

Dans `scripts/ingest.py`, supprimer la constante `SOURCES: list[dict]` et
parcourir `charger_manifeste()`. Pour chaque source : appeler
`supprimer_source(...)` avant l'upsert, puis ingérer. Pour les entrées
`_cycle3` / `_cycle4`, passer par `decouper_par_matiere()` et produire un lot
par matière.

- [ ] **Étape 5 : lancer toute la suite**

Commande : `uv run pytest -q && uv run ruff check . && uv run ruff format --check .`
Attendu : tout passe (hors tests `integration`, qui exigent Qdrant)

- [ ] **Étape 6 : réindexer et vérifier la couverture**

```bash
uv run python scripts/migrate_collection.py
uv run python scripts/ingest.py
uv run python scripts/coverage_report.py
```

Attendu : `coverage_report.py` sort en 0 — **aucun couple manquant**. C'est le
critère de fin du plan.

- [ ] **Étape 7 : commit**

```bash
git add scripts/ingest.py tests/test_ingest_orphelins.py
git commit -m "feat: drive ingestion from the manifest and delete orphans on update"
```

---

### Tâche 8 : Retirer le sous-système d'évaluation périmé

Le golden set est irréparable par conception : ses questions sont générées **à
partir des chunks qu'il faut retrouver**, il n'a qu'un document pertinent par
question, sa pertinence est binaire, et deux exécutions identiques varient de
±1 point. Il est remplacé au plan 3.

**Fichiers :**
- Supprimer : `data/golden/questions.json`, `scripts/generate_golden.py`,
  `scripts/evaluate.py`, `scripts/evaluate_judged.py`, `schema/golden.py`,
  `schema/evaluation.py`, `tests/test_golden.py`, `tests/test_evaluation.py`
- Modifier : `schema/__init__.py`, `apps/curriculum/CLAUDE.md`,
  `apps/curriculum/README.md`

- [ ] **Étape 1 : supprimer**

```bash
git rm data/golden/questions.json scripts/generate_golden.py scripts/evaluate.py \
       scripts/evaluate_judged.py schema/golden.py schema/evaluation.py \
       tests/test_golden.py tests/test_evaluation.py
```

- [ ] **Étape 2 : nettoyer les exports**

Dans `schema/__init__.py`, retirer `GoldenQuestion`, `GoldenSet` de l'import et
de `__all__`. Retirer aussi `EMBEDDING_DIM` et `l2_normalize`, exportés et
utilisés nulle part — `contract.json` porte déjà la dimension.

- [ ] **Étape 3 : lancer toute la suite**

Commande : `uv run pytest -q && uv run ruff check .`
Attendu : tout passe, aucun import cassé

- [ ] **Étape 4 : mettre la documentation en accord**

Dans `CLAUDE.md` et `README.md` de `apps/curriculum`, retirer les commandes et
sections qui décrivent le golden set, et remplacer par le nouveau dispositif :
`scripts/coverage_report.py` pour la complétude, l'évaluation qualité renvoyée
au plan 3.

- [ ] **Étape 5 : commit**

```bash
git add -A schema/__init__.py CLAUDE.md README.md
git commit -m "refactor: drop the golden set and the metrics built on it"
```

---

## Critères de fin du plan

1. `uv run python scripts/coverage_report.py` sort en **0** : chaque couple
   (niveau × matière) du manifeste a du contenu indexé, collège et lycée.
2. `uv run pytest -q` passe, marqueur `integration` compris quand Qdrant est
   joignable.
3. `chunk_point_id` a **un** point de définition, et `tests/test_document_id.py`
   échoue si une copie réapparaît dans `ingest.py`.
4. Aucune ligne du CSV dans le périmètre n'est ni mappée ni explicitement exclue.
5. Réingérer une source ne laisse aucun orphelin.
6. Le déséquilibre est corrigé : plus aucune matière du collège ne compte moins
   de chunks que ce que son volume de programme justifie — vérifiable par
   `scripts/coverage_report.py`.

## Ce que ce plan ne fait pas

- **Tests de recherche sur Qdrant en mode local** → plan 2
- **Veille des réformes via l'API PISTE** → plan 2 (l'impératif de fraîcheur
  n'est pas tenu tant qu'il n'est pas livré)
- **Évaluation qualité (RAGAS + ranx)** → plan 3
- **Adaptation d'`apps/server`** : fermer la dimension niveau côté agent et
  aligner les niveaux d'inscription → lot serveur distinct
