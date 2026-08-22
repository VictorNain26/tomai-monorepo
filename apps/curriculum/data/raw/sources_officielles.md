# Sources officielles des programmes scolaires

> **Le corpus doit être complet ET à jour des réformes.** Toute l'application
> repose dessus : un tuteur qui cite un programme abrogé enseigne du faux à un
> enfant. Ce fichier est la carte des sources — le tenir juste fait partie du
> produit, pas de la documentation.

**La liste des documents n'est plus ici** : elle est dans
`schema/programmes.py`, le manifeste, qui la date niveau par niveau et
l'expose au test de couverture. Ce fichier ne garde que ce que le manifeste ne
peut pas porter — les contraintes d'accès et l'historique des relevés.

Les PDF sont téléchargés par `scripts/fetch_sources.py` dans `data/raw/pdf/`,
ignoré par git : ils se régénèrent depuis le manifeste.

## D'où vient la vérité — vérifié le 2026-08-22

**Le fonds JORF de Légifrance, en open data, décide de ce que le corpus
contient.** Décision et preuves : `docs/adr/0003-legifrance-source-de-verite-du-corpus.md`.

| Hôte | Rôle | État |
|---|---|---|
| `echanges.dila.gouv.fr/OPENDATA/JORF/` | **la règle** : quels programmes, quelles classes, quelle rentrée, quelles abrogations | ✅ 200, **sans authentification**, incréments quotidiens |
| `cache.media.education.gouv.fr` · `www.education.gouv.fr/sites/…` | **le contenu** : les PDF des annexes | ✅ 200 |
| `data.education.gouv.fr` (API) | annuaire d'URL pour les programmes anciens | ⚠ **gelée à la rentrée 2021**, aveugle aux abrogations |
| `www.education.gouv.fr/bo/…`, `eduscol`, `legifrance.gouv.fr` — pages HTML | — | ❌ 403 Cloudflare, en-têtes de navigateur complets compris |
| API PISTE | même fonds que l'open data | ❌ écartée : compte, CGU, souscription, quota, deux secrets |

**On peut tout télécharger, on ne peut rien surveiller par le web** — sauf
Légifrance, qui se surveille par ses incréments quotidiens.

**Légifrance porte la règle, pas le contenu.** Le nota des arrêtés le dit :
« le présent arrêté et ses annexes seront consultables au Bulletin officiel de
l'éducation nationale ». Les PDF s'y téléchargent, mais leur nom
(`ensel621_annexe3.pdf`) ne se déduit ni de l'arrêté ni de la date du BO. Une
table associe donc un NOR à ses URL d'annexes : seul travail manuel du
dispositif, borné et déclenché par la détection.

**Aucun miroir tiers.** Les programmes de langues du BO 2025 étaient lus sur
`reforme.education`, un site privé ; ils sont désormais pris sur
`education.gouv.fr` (`ensel621_annexe1..25.pdf`, 13 langues × collège et lycée).

## Régénérer le corpus

```bash
uv run python scripts/refresh_catalogue.py   # catalogue officiel → cache
uv run python scripts/fetch_sources.py       # PDF du manifeste → data/raw/pdf/
```

Le manifeste (`schema/programmes.py`) décide de ce qui est téléchargé, et
`scripts/coverage_report.py` dit si le résultat est complet. Il n'y a plus de
liste d'URL à tenir à jour à la main ici.

