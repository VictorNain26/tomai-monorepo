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

## Accessibilité des sources — vérifié le 2026-08-22

| Hôte | Usage | État |
|---|---|---|
| `cache.media.education.gouv.fr` | PDF des liens data.gouv (lycée) | ✅ HTTP 200 |
| `www.education.gouv.fr/sites/default/files/…` | PDF des réformes récentes | ✅ HTTP 200 |
| `eduscol.education.fr` — pages HTML | surveillance | ❌ 403 Cloudflare |
| `www.education.gouv.fr` — pages HTML, **flux RSS du BO** | surveillance | ❌ **403 Cloudflare** |
| `www.legifrance.gouv.fr` — site web | surveillance | ❌ 403 Cloudflare |
| **API PISTE / Légifrance** | **signal de fraîcheur** | ✅ officielle et hors Cloudflare — mais **identifiants inexistants** |
| API `data.education.gouv.fr` | catalogue des programmes | ✅ 200, mais **gelée à la rentrée 2021** |

**On peut tout télécharger, on ne peut pas surveiller par le web.** Le seul
signal de fraîcheur exploitable est Légifrance via PISTE : les arrêtés créent et
abrogent les programmes. Filtrer sur NOR préfixe `MENE` + type arrêté.

⚠ **`PISTE_CLIENT_ID` et `PISTE_CLIENT_SECRET` n'existent nulle part** — ni en
local, ni en secrets GitHub (vérifié le 2026-08-22 : le dépôt n'en porte que
trois, aucun PISTE). La moitié Légifrance de la veille n'a donc jamais tourné,
et le workflow hebdomadaire sort vert en imprimant « aucun changement ». C'est
l'explication complète des réformes 2024, 2025 et 2026 manquées.

**Aucun miroir tiers.** Les programmes de langues du BO 2025 étaient lus sur
`reforme.education`, un site privé ; ils sont désormais pris sur
`education.gouv.fr` (`ensel621_annexe1..25.pdf`, 13 langues × collège et lycée).

## Manques identifiés au 2026-08-22

| Document | Référence | État |
|---|---|---|
| Français cycle 3 | BO 2025 · NOR MENE2504620A (17-04-2025) | ❌ absent |
| Mathématiques cycle 3 | BO 2025 · même arrêté | ❌ absent |
| Français cycle 4 | BO 2026 · NOR MENE2602912A (05-03-2026) | ❌ absent |

Les autres matières du collège (physique-chimie, SVT, histoire-géo, arts
plastiques, éducation musicale, EPS) sont **inchangées depuis BO2020** et
couvertes par les deux documents de cycle. Le **lycée est entièrement absent** de
l'index : voir le CSV data.gouv ci-dessous, qui le couvre par discipline.

## Catalogue officiel (API)

| Cache | API | Mis à jour |
|-------|-----|------------|
| `catalogue_second_degre.json` | `https://data.education.gouv.fr/api/explore/v2.1/catalog/datasets/fr-en-programmes-enseignement-2nd-degre/records` | 02/02/2026 |

> Régénéré par `scripts/refresh_catalogue.py`. 688 enregistrements, 334
> programmes en vigueur, tous avec un lien de contenu direct.
>
> `tests/test_catalogue.py` compare le cache à l'API (marqueur `network`) :
> une copie figée sans ce test est exactement ce qui nous a fait rater trois
> réformes.
>
> **Excellent pour le lycée** : 279 lignes en périmètre général+technologique →
> 118 PDF uniques, par discipline, contenu vérifié.
>
> **Périmé pour le collège** : aucune entrée pour la rentrée 2022 ou après. La
> « mise à jour du 02/02/2026 » est un rafraîchissement de métadonnées — le jeu
> vivant est identique à cette copie, vérifié. Les réformes 2024/2025/2026 du
> collège n'y sont pas, et le collège y est décrit par cycle entier, pas par
> discipline.

## Veille automatique (Légifrance PISTE)

Générés par `scripts/veille_programmes.py` (GitHub Action hebdomadaire) :
- `.veille_state.json` : IDs JOs déjà vus, date dernier check
- `.veille_changes.json` : arrêtés programme détectés au dernier run

Credentials → GitHub Secrets `PISTE_CLIENT_ID` / `PISTE_CLIENT_SECRET`.


## Régénérer le corpus

```bash
uv run python scripts/refresh_catalogue.py   # catalogue officiel → cache
uv run python scripts/fetch_sources.py       # PDF du manifeste → data/raw/pdf/
```

Le manifeste (`schema/programmes.py`) décide de ce qui est téléchargé, et
`scripts/coverage_report.py` dit si le résultat est complet. Il n'y a plus de
liste d'URL à tenir à jour à la main ici.

