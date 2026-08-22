# Évaluation de la qualité du retrieval — Plan 3/3

> **Pour les agents d'exécution :** SOUS-COMPÉTENCE REQUISE — utiliser
> `superpowers:subagent-driven-development` (recommandé) ou
> `superpowers:executing-plans`. Les étapes utilisent des cases à cocher.

**But :** pouvoir **départager deux configurations** de recherche sur notre
propre corpus, avec une méthode dont les limites sont écrites.

**Architecture :** méthode TREC — réunir les résultats de plusieurs
configurations (*pooling*), faire noter chaque couple (question, chunk) par un
juge qui ignore d'où vient le chunk, calculer les métriques sur ces jugements.
Le juge est `ragas.metrics.collections.ContextRelevance` (double juge), servi
par Mistral. Les métriques et le test de significativité viennent de `ranx`.

**Stack :** `ragas` 0.4.3, `ranx` 0.3.21, `langchain-mistralai` — **tous déjà
installés**. Aucune dépendance nouvelle.

**Spec :** `docs/superpowers/specs/2026-08-22-refonte-corpus-et-tests-rag-design.md`
**Prérequis :** plans 1 et 2 livrés, **et le corpus neuf réindexé**. Mesurer un
corpus qu'on s'apprête à remplacer n'apprend rien : ce plan vient en dernier, et
pas avant que `scripts/coverage_report.py` sorte en 0.

## Contraintes globales

- **Cet outil départage des configurations. Il n'annonce jamais une qualité
  absolue.** Les juges LLM sont plus indulgents que les humains, ce qui gonfle
  les scores et masque les écarts fins
  ([arXiv 2412.17156](https://arxiv.org/pdf/2412.17156)). La limite doit être
  écrite dans le script et dans sa sortie.
- **Jamais en CI, et le coût est connu.** 60 questions × 3 configurations ×
  top-5 donnent de l'ordre de **900 couples uniques à juger** ; `ContextRelevance`
  est un double juge, donc **~1 800 appels Mistral**, émis en séquentiel. Compter
  une bonne heure et surveiller le rate-limit. Toujours commencer par
  `--limit 10` pour vérifier la chaîne avant de payer le passage complet.
- **Ne pas réécrire de juge maison.** `ContextRelevance` existe, sa signature est
  vérifiée : `ascore(user_input: str, retrieved_contexts: list[str])` — ni
  `response` ni `reference`, ce qui convient à un dépôt *retrieval-only*.
- **Le juge ignore l'origine du chunk.** C'est ce qui rend la mesure indépendante
  de la façon dont les questions ont été écrites.
- Commandes depuis `apps/curriculum/`.

---

### Tâche 1 : Jeu de questions d'évaluation

Le golden set a été supprimé au plan 1 : ses questions étaient générées **à
partir des chunks à retrouver**, or les retrievers neuronaux sont biaisés en
faveur des textes générés par LLM
([arXiv 2310.20501](https://arxiv.org/pdf/2310.20501)).

Le nouveau jeu ne porte **que des questions**, sans réponse attendue — la
pertinence est jugée, pas présupposée. C'est ce qui permet de le remplacer par
de vraies questions d'élèves le jour où il y en aura, sans rien changer d'autre.

**Fichiers :**
- Créer : `data/eval/questions.json`, `schema/eval_questions.py`,
  `tests/test_eval_questions.py`

**Interfaces :**
- Produit : `QuestionEval` (pydantic : `question: str`, `matiere: str | None`,
  `niveau: str | None`), `charger_questions() -> list[QuestionEval]`

- [ ] **Étape 1 : écrire le test qui échoue**

```python
# tests/test_eval_questions.py
"""Le jeu de questions ne porte AUCUNE réponse attendue.

C'est la différence avec le golden set supprimé : ici la pertinence est jugée
a posteriori, jamais décidée à l'avance. Un champ « bon chunk » ferait revenir
le biais qu'on vient d'éliminer.
"""

from schema.eval_questions import charger_questions


def test_le_jeu_couvre_plusieurs_niveaux_et_matieres():
    questions = charger_questions()
    assert len({q.niveau for q in questions if q.niveau}) >= 4
    assert len({q.matiere for q in questions if q.matiere}) >= 6


def test_aucune_question_ne_porte_de_reponse_attendue():
    import json
    from pathlib import Path
    brut = json.loads((Path(__file__).resolve().parent.parent / "data" / "eval" / "questions.json").read_text(encoding="utf-8"))
    interdits = {"gold_chunk_id", "reponse", "answer", "reference", "expected"}
    for entree in brut:
        presents = interdits & set(entree)
        assert not presents, f"champ de vérité présupposée : {presents}"


def test_les_questions_sont_substantielles():
    for q in charger_questions():
        assert len(q.question) >= 15, f"question trop courte : {q.question!r}"


def test_le_jeu_est_assez_grand_pour_departager():
    assert len(charger_questions()) >= 60, "moins de 60 questions : aucun écart ne sera significatif"
```

- [ ] **Étape 2 : lancer et vérifier l'échec**

Commande : `uv run pytest tests/test_eval_questions.py -q`
Attendu : ÉCHEC — module absent

- [ ] **Étape 3 : écrire le schéma**

```python
# schema/eval_questions.py
"""Questions d'évaluation — SANS réponse attendue.

Elles servent d'ENTRÉE au pooling. La pertinence de ce qui remonte est jugée
ensuite, par un juge qui ignore d'où vient chaque chunk. Aucun champ ne dit
« voici le bon résultat » : c'est précisément ce qui biaisait le golden set
précédent.

Destinées à être remplacées par de vraies questions d'élèves. La structure ne
changera pas ce jour-là.
"""

from __future__ import annotations

import json
from pathlib import Path

from pydantic import BaseModel, Field

CHEMIN = Path(__file__).resolve().parent.parent / "data" / "eval" / "questions.json"


class QuestionEval(BaseModel):
    question: str = Field(min_length=15)
    matiere: str | None = None
    niveau: str | None = None


def charger_questions(chemin: Path | None = None) -> list[QuestionEval]:
    brut = json.loads((chemin or CHEMIN).read_text(encoding="utf-8"))
    return [QuestionEval(**e) for e in brut]
```

- [ ] **Étape 4 : constituer le jeu**

Écrire au moins 60 questions dans `data/eval/questions.json`, réparties sur les
niveaux et matières du manifeste. Forme :

```json
[
  {"question": "Comment calculer la longueur de l'hypoténuse d'un triangle rectangle ?",
   "matiere": "mathematiques", "niveau": "quatrieme"},
  {"question": "Qu'est-ce que la respiration cellulaire et où se produit-elle ?",
   "matiere": "svt", "niveau": "cinquieme"}
]
```

**Les écrire à la main, sans regarder les chunks.** Partir des titres de
notions des programmes, formulés comme un élève les poserait. C'est le seul
moyen d'éviter que la question reprenne le vocabulaire de son chunk cible.

- [ ] **Étape 5 : lancer et vérifier**

Commande : `uv run pytest tests/test_eval_questions.py -q && uv run ruff check .`
Attendu : 4 passed

- [ ] **Étape 6 : commit**

```bash
git add data/eval/questions.json schema/eval_questions.py tests/test_eval_questions.py
git commit -m "feat: add an evaluation question set that presupposes no answer"
```

---

### Tâche 2 : Pooling et jugement

**Fichiers :**
- Créer : `scripts/evaluate_quality.py`, `tests/test_evaluate_quality.py`

**Interfaces :**
- Consomme : `charger_questions()`, `hybrid_search()`
- Produit : `construire_pool(questions, configurations, top_k) -> (runs, textes)`,
  `juger(questions, pool) -> qrels`

- [ ] **Étape 1 : écrire le test qui échoue**

```python
# tests/test_evaluate_quality.py
"""Le pooling et le jugement, testés sans appeler de LLM."""

from scripts.evaluate_quality import construire_pool, pool_par_question


def test_le_pool_reunit_les_resultats_de_toutes_les_configurations(monkeypatch):
    import scripts.evaluate_quality as m

    class FauxChunk:
        def __init__(self, cid, texte): self.id, self.text = cid, texte

    def fausse_recherche(q, **kwargs):
        mode = kwargs.get("retrieval_mode", "hybrid")
        return {"hybrid": [FauxChunk("a", "A"), FauxChunk("b", "B")],
                "dense": [FauxChunk("a", "A"), FauxChunk("c", "C")],
                "sparse": [FauxChunk("d", "D")]}[mode]

    monkeypatch.setattr(m, "hybrid_search", fausse_recherche)
    from schema.eval_questions import QuestionEval
    questions = [QuestionEval(question="Une question de test suffisamment longue")]

    runs, textes = construire_pool(questions, m.CONFIGURATIONS, top_k=5)
    assert set(runs) == set(m.CONFIGURATIONS)
    assert set(pool_par_question(runs)["q0000"]) == {"a", "b", "c", "d"}
    assert textes["c"] == "C"


def test_chaque_couple_n_est_juge_qu_une_fois(monkeypatch):
    """Un chunk remonté par trois configurations ne doit pas coûter trois
    appels au juge."""
    import scripts.evaluate_quality as m
    runs = {"a": {"q0000": ["x", "y"]}, "b": {"q0000": ["x", "z"]}}
    assert sorted(pool_par_question(runs)["q0000"]) == ["x", "y", "z"]
```

- [ ] **Étape 2 : lancer et vérifier l'échec**

Commande : `uv run pytest tests/test_evaluate_quality.py -q`
Attendu : ÉCHEC — module absent

- [ ] **Étape 3 : écrire l'implémentation**

```python
#!/usr/bin/env python3
"""Départage des configurations de recherche, par jugement de pertinence.

Méthode TREC : plusieurs configurations alimentent un pool commun, un juge note
chaque couple (question, chunk) SANS savoir quelle configuration l'a remonté,
puis les métriques se calculent sur ces jugements. Aucune configuration n'est
privilégiée, et la mesure ne dépend pas de la façon dont les questions ont été
écrites.

Le juge est `ragas.ContextRelevance` — double juge (deux prompts distincts,
moyennés), ce qui atténue le biais d'un juge unique.

CE QUE CET OUTIL NE FAIT PAS : annoncer une qualité absolue. Les juges LLM sont
plus indulgents que les humains, ce qui gonfle les scores et masque les écarts
fins (arXiv 2412.17156). Il sert à comparer NOS configurations entre elles.

Usage :
  uv run python scripts/evaluate_quality.py --limit 20   # essai peu coûteux
  uv run python scripts/evaluate_quality.py              # jeu complet
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv  # noqa: E402

from schema.eval_questions import QuestionEval, charger_questions  # noqa: E402
from schema.retrieval import hybrid_search  # noqa: E402

load_dotenv()

CONFIGURATIONS: dict[str, dict[str, Any]] = {
    "hybride": {"retrieval_mode": "hybrid"},
    "dense-seul": {"retrieval_mode": "dense"},
    "lexical-seul": {"retrieval_mode": "sparse"},
}

SEUIL_PERTINENT = 0.5  # au-dessus, le chunk compte comme pertinent pour ranx


def construire_pool(questions: list[QuestionEval], configurations: dict, top_k: int):
    """Exécute chaque configuration ; renvoie (classements, textes des chunks)."""
    runs: dict[str, dict[str, list[str]]] = {nom: {} for nom in configurations}
    textes: dict[str, str] = {}
    for i, q in enumerate(questions):
        qid = f"q{i:04d}"
        for nom, options in configurations.items():
            chunks = hybrid_search(q.question, top_k=top_k, matiere=q.matiere,
                                   niveau=q.niveau, **options)
            runs[nom][qid] = [c.id for c in chunks if c.id]
            for c in chunks:
                if c.id:
                    textes[c.id] = c.text
        print(f"\r  pooling {i + 1}/{len(questions)}…", end="", flush=True)
    print()
    return runs, textes


def pool_par_question(runs: dict[str, dict[str, list[str]]]) -> dict[str, set[str]]:
    """Union des chunks remontés, par question. Chaque couple n'est jugé qu'une fois."""
    pool: dict[str, set[str]] = {}
    for run in runs.values():
        for qid, ids in run.items():
            pool.setdefault(qid, set()).update(ids)
    return pool


async def juger(questions: list[QuestionEval], runs, textes) -> dict[str, dict[str, int]]:
    """Note chaque couple (question, chunk) du pool avec ContextRelevance."""
    from langchain_mistralai import ChatMistralAI
    from ragas.llms import LangchainLLMWrapper
    from ragas.metrics.collections import ContextRelevance

    juge = ContextRelevance(llm=LangchainLLMWrapper(ChatMistralAI(model="mistral-medium-latest", temperature=0)))
    par_qid = {f"q{i:04d}": q for i, q in enumerate(questions)}
    pool = pool_par_question(runs)
    total = sum(len(v) for v in pool.values())
    print(f"  {total} couples à juger ({len(pool)} questions)")

    qrels: dict[str, dict[str, int]] = {}
    fait = 0
    for qid, chunk_ids in pool.items():
        notes: dict[str, int] = {}
        for cid in sorted(chunk_ids):
            resultat = await juge.ascore(user_input=par_qid[qid].question,
                                         retrieved_contexts=[textes[cid]])
            if float(resultat.value) >= SEUIL_PERTINENT:
                notes[cid] = 1
            fait += 1
            print(f"\r  jugement {fait}/{total}…", end="", flush=True)
        qrels[qid] = notes
    print()
    return qrels


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--top-k", type=int, default=5)
    parser.add_argument("--limit", type=int, help="N premières questions (essai peu coûteux)")
    parser.add_argument("--save", type=Path, help="Sauvegarde les jugements produits")
    args = parser.parse_args()

    questions = charger_questions()[: args.limit] if args.limit else charger_questions()
    print(f"{len(questions)} questions · {len(CONFIGURATIONS)} configurations\n")

    runs, textes = construire_pool(questions, CONFIGURATIONS, args.top_k)
    qrels = asyncio.run(juger(questions, runs, textes))

    from ranx import Qrels, Run, compare

    # Les questions dont AUCUN chunk n'a été jugé pertinent sont retirées : ranx
    # ne sait pas noter une requête sans jugement positif. Elles disparaissent
    # donc des métriques — ce sont pourtant les échecs les plus intéressants,
    # d'où leur comptage explicite ci-dessous.
    sans_pertinent = [q for q, n in qrels.items() if not n]
    if sans_pertinent:
        print(f"\n⚠ {len(sans_pertinent)}/{len(qrels)} questions sans aucun chunk jugé "
              f"pertinent — exclues des métriques, à lire comme des échecs complets")

    rapport = compare(
        qrels=Qrels({q: n for q, n in qrels.items() if n}),
        runs=[Run(r, name=nom) for nom, r in runs.items()],
        metrics=[f"hit_rate@{args.top_k}", f"mrr@{args.top_k}", f"ndcg@{args.top_k}"],
        max_p=0.05,
        stat_test="fisher",
    )
    print(f"\n{rapport}")
    print(
        "\nÀ lire comme un classement RELATIF entre configurations. Les jugements\n"
        "produits par LLM sont plus indulgents que des jugements humains : les\n"
        "niveaux absolus sont surévalués (arXiv 2412.17156)."
    )

    if args.save:
        args.save.parent.mkdir(parents=True, exist_ok=True)
        args.save.write_text(json.dumps({"qrels": qrels, "runs": runs}, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"\nJugements sauvegardés : {args.save}")


if __name__ == "__main__":
    main()
```

- [ ] **Étape 4 : lancer les tests puis un essai réel restreint**

```bash
uv run pytest tests/test_evaluate_quality.py -q
uv run python scripts/evaluate_quality.py --limit 10
```

Attendu : 2 passed, puis un tableau `ranx` comparant les trois configurations.

- [ ] **Étape 5 : commit**

```bash
git add scripts/evaluate_quality.py tests/test_evaluate_quality.py
git commit -m "feat: compare search configurations with pooled, judged relevance"
```

---

### Tâche 3 : Répondre aux deux questions en attente

Deux arbitrages attendent cet instrument. Les trancher est le but du plan.

**Fichiers :**
- Modifier : `docs/constats-ouverts.md`

- [ ] **Étape 1 : BM25 aide-t-il ou nuit-il sur ce corpus ?**

```bash
uv run python scripts/evaluate_quality.py --save data/eval/runs/2026-XX-XX-branches.json
```

Observation qui a motivé la question : sur « calculer la longueur de
l'hypoténuse », le dense place le bon chunk en premier et **la fusion RRF le
fait chuter en troisième**, parce que le chunk pertinent ne contient pas le mot
« hypoténuse ». Une anecdote ne justifie pas de toucher à l'architecture — le
tableau `ranx`, si l'écart est significatif, oui.

- [ ] **Étape 2 : consigner la réponse**

Dans `docs/constats-ouverts.md`, remplacer la section « BM25 aide-t-il
vraiment » par la mesure et sa conclusion. Si `lexical-seul` dégrade
significativement `hybride`, ouvrir un lot pour retirer la branche ou pondérer
la fusion.

- [ ] **Étape 3 : mesurer le plafond d'un reranker sur le nouveau corpus**

```bash
uv run python scripts/evaluate_quality.py --top-k 20 --save data/eval/runs/2026-XX-XX-top20.json
```

Le gain maximal d'un reranker vaut `hit_rate@20 − hit_rate@5`. Sur l'ancien
corpus il valait ~9 points. Le recalculer sur le nouveau, et mettre à jour
`docs/constats-ouverts.md`.

- [ ] **Étape 4 : commit**

```bash
git add docs/constats-ouverts.md data/eval/runs/
git commit -m "docs: settle the sparse-branch and reranker questions with measurements"
```

---

## Critères de fin

1. `scripts/evaluate_quality.py` produit un tableau `ranx` comparant au moins
   trois configurations, avec test de significativité.
2. Aucun chunk n'est jugé deux fois pour une même question.
3. La sortie du script **écrit sa propre limite** : classement relatif, pas note
   absolue, et nombre de questions sans aucun chunk pertinent.
4. `docs/constats-ouverts.md` porte une réponse mesurée sur BM25 et sur le
   plafond d'un reranker.
5. Aucune dépendance ajoutée ; l'évaluation ne tourne pas en CI.

## Ce que ce plan ne fait pas

- **Pas de reranking implémenté.** Le plan mesure son plafond ; l'ajouter
  suppose un fournisseur EU, qui n'existe pas chez OVH à ce jour.
- **Pas de vraies questions d'élèves.** Le jeu est écrit à la main, et sa
  structure est déjà celle qui les accueillera.
