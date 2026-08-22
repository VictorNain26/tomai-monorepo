# Corpus scolaire complet et durable

**Date** : 2026-08-22
**Statut** : spec validée, plan à écrire
**Remplace** : le périmètre de `2026-08-22-refonte-corpus-et-tests-rag-design.md` (collège + lycée général)

## Objectif

Un agent IA pédagogue pour l'école française. Le RAG lui fournit le référentiel
officiel : ce qu'un élève donné doit apprendre, dans quel ordre, et selon quelle
démarche l'institution le prescrit. Rien d'autre — le cours, les exemples et les
exercices sont produits par le modèle.

**Périmètre** : école élémentaire, collège, lycée général, technologique et
professionnel. Toutes les matières de ces niveaux, treize langues vivantes. La
maternelle est exclue — l'app ne cible pas des élèves de 3 à 6 ans.

## Ce que le corpus apporte réellement

Vérifié dans le texte des PDF, pas déduit. Un programme officiel porte trois
choses, et les trois servent l'agent :

| | Exemple relevé dans le programme de cycle 4 |
|---|---|
| **Périmètre** | « Connaissances : nombres décimaux (positifs et négatifs), notion d'opposé » |
| **Progression** | « Repères de progressivité — Niveau A1 : repérer des indices sonores simples » |
| **Démarche prescrite** | « On privilégie des observations de terrain pour recueillir des données […] ainsi que la mise en œuvre de démarches expérimentales » |

L'agent peut donc s'appuyer sur le RAG pour la **méthode officielle**, celle que
le professeur de l'élève applique. Ce qui n'y figure pas : explications
détaillées, exemples travaillés, exercices, corrigés.

## État constaté le 2026-08-22

Six trous, tous vérifiés dans les données.

1. **Le lycée est absent de l'index** — 62 couples (niveau × matière) couverts
   sur 114 ; les 52 manquants sont exactement seconde, première et terminale.
   La collection Qdrant a par ailleurs disparu du cluster en cours d'audit
   (5 238 points à 15h35, zéro collection à 15h47, aucune écriture émise).
2. **Du contenu abrogé est servi comme officiel** — le français réformé
   (cycle 3 BO 2025, cycle 4 BO 2026) est déclaré en vigueur dans le manifeste
   mais absent de l'index ; ce sont les sections français de 2020, abrogées, qui
   répondent.
3. **68 % du catalogue vivant est hors périmètre** — sur 334 lignes non
   abrogées : 103 en voie générale, **176 en technologique**, **51 en
   professionnelle**. Un élève de 1re STMG, de bac pro ou de CAP n'obtient rien.
   Cause : le payload ne porte pas la série.
4. **Le primaire est absent** — le cycle 3 couvre CM1, CM2 et 6e ; seule la 6e
   est indexée.
5. **Quatre langues sur treize** publiées au BO 2025 sont retenues.
6. **Le signal de fraîcheur ne tourne pas** — `veille_programmes.py` interroge
   l'API PISTE, dont les credentials n'ont jamais été créés : il ne détecte rien,
   silencieusement, et le workflow sort vert.

Les gates existants ne voient aucun de ces trous. `coverage_report.py` compte des
points par couple (niveau, matière) : du contenu périmé remplit la case aussi
bien que du contenu à jour.

## Ce que valent les sources — vérifié en direct le 2026-08-22

| Source | Réponse | Ce qu'elle vaut |
|---|---|---|
| `data.education.gouv.fr` — catalogue second degré, 688 lignes | 200 | **Piège.** Fichier « modifié le 2026-01-29 », contenu mort : dernière entrée en vigueur **2021**, dernière abrogation **2021**. La date de modification donne l'illusion de fraîcheur. |
| `echanges.dila.gouv.fr/OPENDATA/JORF/` | 200, **sans authentification** | Fiable et à jour. Dump global `Freemium_jorf_global_20250713` (1,67 Go) + **743 incréments quotidiens** jusqu'à aujourd'hui. Porte **la règle**, jamais le contenu. |
| `www.legifrance.gouv.fr` | **403** | Inaccessible aux machines, même avec en-têtes de navigateur complets. |
| `www.education.gouv.fr` — `/jsonapi` et pages du BO | **403** | Pas d'index machine du contenu. |
| `www.education.gouv.fr/sites/default/files/*.pdf` | 200 | Les PDF se téléchargent. Leur nom ne se déduit de rien. |
| `data.education.gouv.fr` — compléments aux programmes (30 documents) | 200, `application/pdf` | **Attendus année par année** et **repères annuels de progression**. Le chaînon manquant. |

**Il n'existe pas d'API unique, fiable et à jour** donnant à la fois la règle et
le contenu. C'est un fait de structure, pas un retard : l'arrêté publié au JO
dit « le programme figure en annexe, publiée au Bulletin officiel » — l'annexe
n'est pas dans le fonds juridique.

### La trouvaille : les compléments aux programmes

Le programme de cycle 4 n'énonce que les *attendus de fin de cycle*, donc de fin
de 3e. Un élève de 5e reçoit ainsi des objectifs qui ne seront les siens que dans
deux ans. Les 30 documents « Compléments aux programmes » (14 second degré,
16 premier degré) donnent la déclinaison **année par année** — « attendus de fin
de 5e », « repères annuels de progression pour le cycle 3 ».

Limite connue : ils datent de 2019-2020 (série `ensel283`) et ne couvrent que
français, mathématiques et EMC. Les programmes réformés depuis auront leurs
propres attendus annuels ; l'étage 1 les détectera.

## Architecture — trois étages

### Étage 1 — la règle, automatique

`scripts/refresh_jorf.py` télécharge le dump global une fois, puis rattrape les
incréments. Il en extrait les arrêtés du ministère de l'Éducation portant
« programme », avec leurs liens d'abrogation. Aucune clé, aucun compte — c'est
ce qui manquait à la version PISTE.

Structure XML confirmée sur un incrément réel du 2026-08-22 :

```xml
<NATURE>ARRETE</NATURE>  <NOR>…</NOR>  <DATE_PUBLI>2026-08-22</DATE_PUBLI>
<MINISTERE>…</MINISTERE>  <TITREFULL>Arrêté du … fixant le programme …</TITREFULL>
<LIEN nortexte="…" typelien="ABROGATION" sens="cible">…</LIEN>
```

Sortie : `data/raw/arretes_education.json`.
**Cadence : mensuelle.** Les programmes changent quelques fois par an, toujours
entre février et juin pour la rentrée suivante. Les incréments étant datés, un
contrôle mensuel rattrape tout ce qu'il a manqué — une douzaine de Mo.

### Étage 2 — le manifeste, dérivé plus geste humain borné

`data/manifeste.toml` : une entrée par arrêté en vigueur, portant matières,
niveaux, voie, série, calendrier d'application et URL des annexes PDF.

L'étage 1 le pré-remplit. L'humain ne renseigne que ce que la machine ne sait pas
lire de façon sûre — **le calendrier niveau par niveau et les URL d'annexes** —
soit quelques arrêtés par an. Un arrêté détecté et non résolu part dans une file
d'attente qui **met le gate au rouge** : il ne peut pas être oublié.

`schema/programmes.py` lit ce fichier au lieu de porter des tables codées en dur.
Le catalogue `data.education.gouv.fr` est rétrogradé au rang d'**annuaire d'URL**
pour les textes anciens : plus jamais d'autorité sur ce qui est en vigueur.

L'automatisation de la résolution NOR → URL d'annexes est un chantier ultérieur,
explicitement hors de cette spec.

### Étage 3 — l'index, vérifié par document

Ingestion dans une collection neuve horodatée, bascule d'alias, ancienne
supprimée. Outillage déjà en place (`migrate_collection.py`).

## Le schéma — payload v2

Le payload actuel (7 champs) situe l'élève par `niveau` seul. Insuffisant :
« première » ne distingue pas générale, STMG et professionnelle.

| Champ | Statut | Valeurs |
|---|---|---|
| `text`, `section`, `matiere`, `niveau`, `cycle`, `source_file`, `chunk_index` | existants | — |
| `voie` | **nouveau** | `primaire` \| `college` \| `generale` \| `technologique` \| `professionnelle` |
| `serie` | **nouveau** | `stmg`, `sti2d`, `st2s`, `stl`, `std2a`, `sthr`, `s2tmd`, ou absent |

Enums à étendre :

- `Niveau` — primaire (`cp`, `ce1`, `ce2`, `cm1`, `cm2`), voie professionnelle
  (`seconde_pro`, `premiere_pro`, `terminale_pro`, `cap1`, `cap2`)
- `Cycle` — `cycle2` s'ajoute à `cycle3`, `cycle4`, `lycee`
- `Matiere` — 46 disciplines distinctes en voie technologique, plus
  « Prévention Santé Environnement » et « Économie-gestion » en voie
  professionnelle

Changement de contrat : `contract.json` régénéré, `qdrant.service.ts`,
`rag.service.ts` et `contract.test.ts` alignés côté server. Rien n'est en
production — aucune migration à porter, et c'est le bon moment.

**Décision** : la maternelle (cycle 1) est hors périmètre de cette spec. Le
dataset la déclare, mais l'app ne cible pas des élèves de 3 à 6 ans.

## Les gates

Trois contrôles remplacent le compte par case. Chacun aurait attrapé un trou réel
de cet audit :

1. **Chaque document du manifeste a des chunks indexés** — aurait vu le français
   abrogé servi à la place du réformé.
2. **Aucun chunk ne provient d'un document hors manifeste** — aurait vu les
   orphelins laissés par une mise à jour.
3. **Chaque arrêté détecté par la veille est résolu ou en file d'attente** —
   aurait vu que la veille PISTE ne tournait pas.

Le gate 3 est ce qui rend le geste manuel sûr : il ne s'oublie pas, il bloque.

## Volumes mesurés

| Bloc | Volume |
|---|---|
| Primaire | 3 documents de cycle vivants (multi-matières, à découper par section) |
| Second degré | 150 URL PDF distinctes sur le catalogue vivant |
| Langues vivantes | 25 annexes du BO 2025 (13 langues × collège et lycée) |
| Compléments | 30 documents (attendus annuels, repères de progression) |
| Fonds JORF | 1,67 Go une fois, puis ~12 Mo par contrôle mensuel |

## Découpage

Trop gros pour une seule exécution. Trois lots, chacun avec son plan.

- **Lot A — la règle.** `refresh_jorf.py`, manifeste dérivé, veille mensuelle sur
  l'open data. Supprime `veille_programmes.py` version PISTE et le
  catalogue-autorité.
- **Lot B — le schéma.** `voie` et `serie`, enums étendues, contrat régénéré,
  server aligné.
- **Lot C — le corpus.** Téléchargement, extraction, ingestion de tout le
  périmètre, blue-green, les trois gates.

A et B sont indépendants et peuvent aller en parallèle. C a besoin des deux —
sinon on ingère 150 documents deux fois.

**Tâche zéro du lot A, avant toute écriture** : télécharger le dump de 1,67 Go et
prouver qu'on y retrouve un arrêté de programme avec son abrogation. La structure
XML est vérifiée ; la présence d'arrêtés de programme dans le fonds ne l'est pas
encore — l'incrément du 2026-08-22 n'en contenait aucun. Si cette preuve échoue,
l'étage 1 change de forme et la spec est révisée avant implémentation.

## Hors périmètre

- Automatiser la résolution NOR → URL des annexes PDF (chantier ultérieur).
- La maternelle (cycle 1).
- Les référentiels de spécialité des diplômes professionnels : le catalogue ne
  porte que les enseignements généraux de la voie pro, ce qui est le besoin.
- Les ressources d'accompagnement Éduscol autres que les compléments listés.
- Le reranking, la quantization sans rescore et l'instrumentation du pipeline
  complet : voir `docs/constats-ouverts.md`.
