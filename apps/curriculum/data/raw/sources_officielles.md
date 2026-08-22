# Sources officielles des programmes scolaires

> **Le corpus doit être complet ET à jour des réformes.** Toute l'application
> repose dessus : un tuteur qui cite un programme abrogé enseigne du faux à un
> enfant. Ce fichier est la carte des sources — le tenir juste fait partie du
> produit, pas de la documentation.

Fichiers `.txt` extraits avec `pdftotext -enc UTF-8 -layout`.  
PDFs exclus du repo git (`.gitignore`), `.txt` seuls versionnés.  
PDFs régénérables via les URLs ci-dessous.

## Accessibilité des sources — vérifié le 2026-08-22

| Hôte | Usage | État |
|---|---|---|
| `cache.media.education.gouv.fr` | PDF des liens data.gouv (lycée) | ✅ HTTP 200 |
| `www.education.gouv.fr/sites/default/files/…` | PDF des réformes récentes | ✅ HTTP 200 |
| `reforme.education` | miroir tiers (langues BO2025) | ✅ HTTP 200 |
| `www.education.gouv.fr` — pages HTML, **flux RSS du BO** | surveillance | ❌ **403 Cloudflare** |
| `www.legifrance.gouv.fr` — site web | surveillance | ❌ 403 Cloudflare |
| **API PISTE / Légifrance** | **signal de fraîcheur** | ✅ officielle, authentifiée, hors Cloudflare |

**On peut tout télécharger, on ne peut pas surveiller par le web.** Le seul
signal de fraîcheur exploitable est Légifrance via PISTE : les arrêtés créent et
abrogent les programmes. Filtrer sur NOR préfixe `MENE` + type arrêté.

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

## Cycle 3 (CM1-CM2-6ème)

| Fichier | Date BO | URL |
|---------|---------|-----|
| `programme_cycle3_BO2020.txt` | 30/07/2020 | `https://cache.media.education.gouv.fr/file/31/88/7/ensel714_annexe2_1312887.pdf` |

## Cycle 4 (5ème-4ème-3ème)

| Fichier | Date BO | URL |
|---------|---------|-----|
| `programme_cycle4_BO2020.txt` | 30/07/2020 | `https://cache.media.education.gouv.fr/file/31/89/1/ensel714_annexe3_1312891.pdf` |
| `programme_maths_cycle4_BO2026.txt` | 05/03/2026 | `https://www.education.gouv.fr/sites/default/files/document/Annexe%202%20%E2%80%93%20Programme%20de%20math%C3%A9matiques%20pour%20le%20cycle%204-480716.pdf` |
| `programme_technologie_cycle4_BO2024.txt` | 29/02/2024 | `https://www.education.gouv.fr/sites/default/files/document/Annexe%20%E2%80%94%20Programme%20de%20technologie%20du%20cycle%204-368016.pdf` |

## Langues vivantes — Collège (BO n°22 du 29 mai 2025)

Arrêté du 5 mai 2025, NOR MENE2504621A. Applicable 5e à rentrée 2026-2027.  
Source : mirror reforme.education (education.gouv.fr bloque curl via Cloudflare).

| Fichier | Langue | URL |
|---------|--------|-----|
| `programme_anglais_college_BO2025.txt` | Anglais | `https://reforme.education/app/uploads/2025/05/prog-college-anglais.pdf` |
| `programme_espagnol_college_BO2025.txt` | Espagnol | `https://reforme.education/app/uploads/2025/05/prog-college-espagnol.pdf` |
| `programme_allemand_college_BO2025.txt` | Allemand | `https://reforme.education/app/uploads/2025/05/prog-college-allemand.pdf` |
| `programme_italien_college_BO2025.txt` | Italien | `https://reforme.education/app/uploads/2025/05/prog-college-italien.pdf` |

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

## Régénération des PDFs

```bash
# Cycle 3/4 (cache.media, pas de Cloudflare)
curl -L -o data/raw/programme_cycle3_BO2020.pdf \
  "https://cache.media.education.gouv.fr/file/31/88/7/ensel714_annexe2_1312887.pdf"
curl -L -o data/raw/programme_cycle4_BO2020.pdf \
  "https://cache.media.education.gouv.fr/file/31/89/1/ensel714_annexe3_1312891.pdf"

# Maths/Techno (education.gouv.fr/sites)
curl -L -o data/raw/programme_maths_cycle4_BO2026.pdf \
  "https://www.education.gouv.fr/sites/default/files/document/Annexe%202%20%E2%80%93%20Programme%20de%20math%C3%A9matiques%20pour%20le%20cycle%204-480716.pdf"
curl -L -o data/raw/programme_technologie_cycle4_BO2024.pdf \
  "https://www.education.gouv.fr/sites/default/files/document/Annexe%20%E2%80%94%20Programme%20de%20technologie%20du%20cycle%204-368016.pdf"

# LVE (mirror)
for lang in anglais espagnol allemand italien; do
  curl -L -o "data/raw/programme_${lang}_college_BO2025.pdf" \
    "https://reforme.education/app/uploads/2025/05/prog-college-${lang}.pdf"
done

# Extraction texte
for pdf in data/raw/*.pdf; do
  pdftotext -enc UTF-8 -layout "$pdf" "${pdf%.pdf}.txt"
done
```
