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
