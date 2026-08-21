"""
Évaluation du retrieval — conversion golden set → format IR standard.

Le calcul des métriques est délégué à `ranx` (bibliothèque d'évaluation de
ranking, tests statistiques inclus). Ce qui est testé ici, c'est **notre**
part : la traduction du golden set et des résultats de recherche vers les
structures Qrels/Run, et le fait que les métriques rendues correspondent bien
à ce qu'on croit mesurer.

Autrement dit : on ne teste pas ranx, on teste qu'on s'en sert correctement.
"""

from __future__ import annotations

import pytest

from schema.evaluation import build_qrels, build_run, score


class TestBuildQrels:
    def test_associe_chaque_question_a_son_chunk_de_reference(self) -> None:
        questions = [
            {"id": "q1", "gold_chunk_id": "chunk-a"},
            {"id": "q2", "gold_chunk_id": "chunk-b"},
        ]

        assert build_qrels(questions) == {
            "q1": {"chunk-a": 1},
            "q2": {"chunk-b": 1},
        }

    def test_ignore_les_questions_sans_chunk_de_reference(self) -> None:
        """Les questions du golden set « seed » n'ont pas de gold_chunk_id :
        elles ne sont pas notables et doivent être écartées, pas comptées à 0
        — sinon le score est mécaniquement tiré vers le bas."""
        questions = [
            {"id": "q1", "gold_chunk_id": "chunk-a"},
            {"id": "q2"},
            {"id": "q3", "gold_chunk_id": None},
            {"id": "q4", "gold_chunk_id": ""},
        ]

        assert build_qrels(questions) == {"q1": {"chunk-a": 1}}

    def test_refuse_un_golden_set_sans_aucune_reference(self) -> None:
        with pytest.raises(ValueError, match="aucune question notable"):
            build_qrels([{"id": "q1"}])


class TestBuildRun:
    def test_ordonne_les_resultats_par_rang_decroissant(self) -> None:
        """Les scores servent uniquement à ordonner. On les dérive du rang
        plutôt que d'utiliser les scores RRF de Qdrant : ceux-ci sont des
        artefacts de rang dont la magnitude dépend de la version du serveur,
        et deux ex aequo rendraient le classement non déterministe."""
        run = build_run({"q1": ["a", "b", "c"]})

        assert list(run["q1"]) == ["a", "b", "c"]
        assert run["q1"]["a"] > run["q1"]["b"] > run["q1"]["c"]

    def test_accepte_une_question_sans_resultat(self) -> None:
        assert build_run({"q1": []}) == {"q1": {}}


class TestScore:
    def test_reference_en_tete_donne_un_score_parfait(self) -> None:
        result = score(
            qrels={"q1": {"gold": 1}},
            run=build_run({"q1": ["gold", "autre"]}),
            k=5,
        )

        assert result["hit_rate@5"] == 1.0
        assert result["mrr@5"] == 1.0

    def test_le_mrr_reflete_le_rang_de_la_reference(self) -> None:
        result = score(
            qrels={"q1": {"gold": 1}},
            run=build_run({"q1": ["x", "y", "gold"]}),
            k=5,
        )

        assert result["hit_rate@5"] == 1.0
        assert result["mrr@5"] == pytest.approx(1 / 3)

    def test_reference_absente_donne_zero(self) -> None:
        result = score(
            qrels={"q1": {"gold": 1}},
            run=build_run({"q1": ["x", "y"]}),
            k=5,
        )

        assert result["hit_rate@5"] == 0.0
        assert result["mrr@5"] == 0.0

    def test_reference_hors_du_top_k_ne_compte_pas(self) -> None:
        """Une référence trouvée au rang 6 n'est pas un succès à k=5."""
        result = score(
            qrels={"q1": {"gold": 1}},
            run=build_run({"q1": ["a", "b", "c", "d", "e", "gold"]}),
            k=5,
        )

        assert result["hit_rate@5"] == 0.0

    def test_moyenne_sur_plusieurs_questions(self) -> None:
        result = score(
            qrels={"q1": {"g1": 1}, "q2": {"g2": 1}},
            run=build_run({"q1": ["g1"], "q2": ["x", "y", "g2"]}),
            k=5,
        )

        assert result["hit_rate@5"] == 1.0
        assert result["mrr@5"] == pytest.approx((1 + 1 / 3) / 2)

    def test_expose_les_metriques_attendues(self) -> None:
        result = score(qrels={"q1": {"gold": 1}}, run=build_run({"q1": ["gold"]}), k=5)

        assert set(result) == {"hit_rate@5", "mrr@5", "ndcg@5", "recall@5"}
