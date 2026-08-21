#!/usr/bin/env python3
"""
Évaluation du retrieval — mesure la qualité de l'INDEX, rien d'autre.

Aucun appel LLM, aucun jugement : le `gold_chunk_id` de chaque question est
l'UUID5 du chunk qui l'a produite, donc « a-t-on retrouvé le bon chunk ? » se
vérifie par comparaison d'identifiants. Déterministe, reproductible, gratuit —
ce qui en fait un garde-fou de non-régression utilisable en CI.

Les métriques sont calculées par `ranx` (cf. schema/evaluation.py). Ce script
n'est que le harnais : charger le golden set, exécuter la recherche, traduire,
afficher — et sauvegarder le run pour pouvoir comparer des configurations.

Usage :
  uv run python scripts/evaluate.py                       # évaluation simple
  uv run python scripts/evaluate.py --by-matiere          # détail par matière
  uv run python scripts/evaluate.py --fusion dbsf --save-run runs/dbsf.json
  uv run python scripts/evaluate.py --compare runs/rrf.json runs/dbsf.json

La dernière forme est la raison d'être de `ranx` : elle dit si l'écart entre
deux configurations est **statistiquement significatif**, au lieu de laisser
comparer deux nombres à l'œil.
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import defaultdict
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv  # noqa: E402

from schema.evaluation import METRIC_NAMES, build_qrels, build_run, score  # noqa: E402
from schema.retrieval import hybrid_search  # noqa: E402

load_dotenv()

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

GOLDEN_PATH = Path(__file__).resolve().parent.parent / "data" / "golden" / "questions.json"


def load_questions(path: Path) -> list[dict[str, Any]]:
    """Charge le golden set et attribue un identifiant stable à chaque question.

    Le fichier ne porte pas de champ `id` — l'index de la question dans le
    fichier fait office d'identifiant. Il est stable tant que le fichier n'est
    pas réordonné, ce qui suffit : un run n'est comparable qu'à un run produit
    sur le même golden set.
    """
    questions = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(questions, dict):
        questions = questions.get("questions", [])
    return [{**q, "id": f"q{i:04d}"} for i, q in enumerate(questions)]


def execute_searches(
    questions: list[dict[str, Any]], top_k: int, fusion: str, collection: str | None
) -> dict[str, list[str]]:
    """Exécute la recherche pour chaque question → identifiants classés."""
    results: dict[str, list[str]] = {}
    for position, question in enumerate(questions, start=1):
        chunks = hybrid_search(
            question["query"],
            top_k=top_k,
            matiere=question.get("matiere"),
            niveau=question.get("niveau"),
            collection=collection,
            fusion=fusion,
        )
        results[question["id"]] = [c.id for c in chunks if c.id]
        print(f"\r  {position}/{len(questions)} questions…", end="", flush=True)
    print()
    return results


def print_scores(title: str, scores: dict[str, float], count: int) -> None:
    print(f"\n{title}  ({count} questions)")
    for name in METRIC_NAMES:
        key = next(k for k in scores if k.startswith(f"{name}@"))
        print(f"  {key:<14} {scores[key]:.3f}")


def report_by_matiere(
    questions: list[dict[str, Any]],
    results: dict[str, list[str]],
    top_k: int,
) -> None:
    par_matiere: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for question in questions:
        par_matiere[question.get("matiere", "—")].append(question)

    print(f"\n{'matière':<24}{'questions':>10}{'hit_rate':>10}{'mrr':>8}{'ndcg':>8}")
    print("─" * 60)
    for matiere, group in sorted(par_matiere.items()):
        subset = {q["id"]: results[q["id"]] for q in group}
        scores = score(build_qrels(group), build_run(subset), k=top_k)
        print(
            f"{matiere:<24}{len(group):>10}"
            f"{scores[f'hit_rate@{top_k}']:>10.3f}"
            f"{scores[f'mrr@{top_k}']:>8.3f}"
            f"{scores[f'ndcg@{top_k}']:>8.3f}"
        )


def compare_runs(paths: list[Path], top_k: int) -> None:
    """Compare des runs sauvegardés, avec test de significativité."""
    from ranx import Qrels, Run, compare

    questions = load_questions(GOLDEN_PATH)
    qrels = Qrels(build_qrels(questions))

    runs = []
    for path in paths:
        payload = json.loads(path.read_text(encoding="utf-8"))
        runs.append(Run(build_run(payload["results"]), name=payload.get("name", path.stem)))

    report = compare(
        qrels=qrels,
        runs=runs,
        metrics=[f"{name}@{top_k}" for name in METRIC_NAMES],
        max_p=0.05,
        stat_test="fisher",
    )
    print(report)
    print(
        "\nUn exposant signale une différence statistiquement significative "
        "(p < 0,05, test de randomisation de Fisher).\n"
        "Sans exposant, l'écart observé ne se distingue pas du bruit."
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--top-k", type=int, default=5, help="Rang de coupure (défaut 5)")
    parser.add_argument("--by-matiere", action="store_true", help="Détail par matière")
    parser.add_argument("--fusion", default="rrf", choices=["rrf", "dbsf"])
    parser.add_argument("--collection", help="Override la collection cible")
    parser.add_argument("--save-run", type=Path, help="Sauvegarde le run pour --compare")
    parser.add_argument("--name", help="Nom du run dans le rapport de comparaison")
    parser.add_argument(
        "--compare", nargs="+", type=Path, metavar="RUN", help="Compare des runs sauvegardés"
    )
    args = parser.parse_args()

    if args.compare:
        compare_runs(args.compare, args.top_k)
        return

    questions = load_questions(GOLDEN_PATH)
    qrels = build_qrels(questions)
    print(f"Golden set : {len(questions)} questions, {len(qrels)} notables")
    print(f"Config     : fusion={args.fusion}, top_k={args.top_k}")

    results = execute_searches(questions, args.top_k, args.fusion, args.collection)
    scores = score(qrels, build_run(results), k=args.top_k)

    print_scores("RÉSULTAT GLOBAL", scores, len(qrels))
    if args.by_matiere:
        report_by_matiere(questions, results, args.top_k)

    if args.save_run:
        args.save_run.parent.mkdir(parents=True, exist_ok=True)
        args.save_run.write_text(
            json.dumps(
                {
                    "name": args.name or args.save_run.stem,
                    "fusion": args.fusion,
                    "top_k": args.top_k,
                    "scores": scores,
                    "results": results,
                },
                ensure_ascii=False,
                indent=2,
            ),
            encoding="utf-8",
        )
        print(f"\nRun sauvegardé : {args.save_run}")


if __name__ == "__main__":
    main()
