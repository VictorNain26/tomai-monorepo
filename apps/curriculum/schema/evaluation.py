"""
Évaluation du retrieval — traduction du golden set vers le format IR standard.

Le calcul des métriques est délégué à `ranx`, bibliothèque d'évaluation de
ranking (métriques TREC + tests de significativité statistique). On ne
réimplémente donc plus recall@k ni MRR à la main : c'est du code standard, et
`pytrec_eval` a été écrit précisément « pour arrêter la prolifération
d'implémentations maison des mesures d'évaluation IR en Python ».

Ce qui reste ici est la part **domaine**, qu'aucune bibliothèque ne fournit :
comment un golden set d'un corpus Éduscol se traduit en `Qrels`, et comment
une réponse de recherche hybride Qdrant se traduit en `Run`.

Ce que l'adoption de `ranx` apporte, au-delà du fait de ne plus maintenir la
formule :

- **nDCG@k**, absent de l'implémentation précédente ;
- **`ranx.compare()`**, qui dit si l'écart entre deux configurations est
  statistiquement significatif (test de Fisher, t-test apparié, Tukey HSD).
  C'est ce qui manquait pour trancher les A/B en attente — RRF contre DBSF,
  IDF activé ou non, taille de chunk — sans conclure sur du bruit.
"""

from __future__ import annotations

from typing import Any

#: Métriques calculées à chaque évaluation.
#: `hit_rate` et `recall` coïncident tant qu'il y a exactement un chunk de
#: référence par question — les deux sont exposées parce que cette égalité
#: cesserait si le golden set évoluait vers plusieurs références.
METRIC_NAMES: tuple[str, ...] = ("hit_rate", "mrr", "ndcg", "recall")


def build_qrels(questions: list[dict[str, Any]]) -> dict[str, dict[str, int]]:
    """Golden set → `Qrels` : pour chaque question, le chunk attendu.

    Les questions sans `gold_chunk_id` (golden set « seed », rédigé à la main)
    ne sont pas notables : elles sont **écartées**, jamais comptées comme des
    échecs — sinon le score baisse mécaniquement avec leur nombre.
    """
    qrels = {
        question["id"]: {question["gold_chunk_id"]: 1}
        for question in questions
        if question.get("gold_chunk_id")
    }
    if not qrels:
        raise ValueError(
            "Le golden set ne contient aucune question notable : aucune n'a de "
            "`gold_chunk_id`. Régénérer via scripts/generate_golden.py."
        )
    return qrels


def build_run(results: dict[str, list[str]]) -> dict[str, dict[str, float]]:
    """Résultats de recherche → `Run` : pour chaque question, les chunks classés.

    Le score est **dérivé du rang**, pas repris de Qdrant. Les scores de fusion
    RRF sont des artefacts de rang (~1/(k+rang)) dont la magnitude dépend de la
    version du serveur, et deux ex aequo rendraient le classement non
    déterministe — inacceptable pour un garde-fou de non-régression.
    """
    return {
        question_id: {chunk_id: 1.0 / (rank + 1) for rank, chunk_id in enumerate(chunk_ids)}
        for question_id, chunk_ids in results.items()
    }


def score(
    qrels: dict[str, dict[str, int]],
    run: dict[str, dict[str, float]],
    k: int = 5,
) -> dict[str, float]:
    """Calcule les métriques de ranking au rang de coupure `k`."""
    from ranx import Qrels, Run, evaluate

    metrics = [f"{name}@{k}" for name in METRIC_NAMES]
    return evaluate(Qrels(qrels), Run(run), metrics)
