# Curriculum — référentiel pour l'agent pédagogique

**Date** : 2026-08-22
**Statut** : design validé, prêt pour plan d'implémentation
**Remplace** : `2026-08-22-corpus-scolaire-complet-design.md` (approche PDF → chunks → index vectoriel)

## Objectif

Un référentiel complet et à jour du scolaire français, au service d'un seul
consommateur : l'agent pédagogique. Il doit garantir deux choses, et rien
d'autre :

1. l'agent ne sert jamais une notion hors du programme de **cet** élève ;
2. l'agent n'oublie jamais une notion qui y est.

Le second point est celui qu'on rate d'habitude, et il décide de
l'architecture : une garantie d'exhaustivité ne se construit pas avec une
recherche approximative.

## Le principe qui tranche

> Au référentiel ce qui doit être **exhaustif, reproductible et auditable**.
> À l'agent ce qui demande un **jugement sur cet élève, maintenant**.

Corollaire technique, contre-intuitif et central :

> **Quand le corpus est assez petit pour être énuméré, l'énumération bat la
> récupération.**

Un `top-k` rend « voici 5 nœuds proches » : le modèle ignore si c'est complet,
donc il comble. Un sous-arbre filtré rendu en entier dit « voici les 336 points
de maths accessibles à un 4e, il n'y en a pas d'autres » : une liste close ne se
complète pas. La garantie devient structurelle au lieu d'être statistique.

Les tailles mesurées le permettent :

| périmètre | nœuds | tokens |
|---|---|---|
| maths, cumul CP→3e | 336 | ~10 900 |
| toutes matières, cycle 4 | 784 | ~27 600 |
| toutes matières, cycles 2→4 | 1 850 | ~58 800 |
| référentiel entier | 9 211 | ~256 000 |

Un sous-arbre par (classe × matière) tient largement dans un bloc de contexte
mis en cache.

## Sources — mesurées, pas supposées

### ScoLOMFR v11.0/2025 — le squelette

Archive de Réseau Canopé, publiée le 25/09/2025, téléchargée et parsée.
Vocabulaire `0151 — Points de programme`.

| fait | valeur |
|---|---|
| concepts, tous `isothes:status = Actuel` | **9 211** |
| arbre | 1 641 racines, 7 570 nœuds avec parent, profondeur 1→5 |
| niveaux (voc `022`) | 114, de « petite section » à « 1re STMG », « 2de professionnelle », « voie CAP » |
| disciplines (voc `015`) | 1 436 |
| génération portée par nœud (`skos:historyNote`) | Programmes 2015- (1 214) … 2024- (627), 2025- (359) |
| liens explicites niveau / discipline | 13 % / 17 % |
| **portée résolue par héritage dans l'arbre** | **99,6 %** — 17,1 lien · 34,0 libellé · 48,4 hérité · **0,4 sans** |
| prose | `scopeNote` 588/9211 · `note` **0** · `example` **0** |

Couverture : maternelle → élémentaire → collège → lycée général, technologique
et professionnel. C'est le périmètre visé, entier.

Le contenu est du verbatim de programme sur trois étages :

```
nombres et calculs
└─ utiliser le calcul littéral
   ├─ résoudre des équations ou des inéquations du premier degré
   └─ annulation d'un produit
```

Licence : CC BY-SA 3.0 France, déclarée dans l'archive pour les schémas XSD et
leurs outils. **Aucun texte de licence distinct trouvé pour les vocabulaires** —
à confirmer par écrit auprès de Réseau Canopé avant mise en production. BY-SA
impose le partage à l'identique sur les adaptations : le référentiel dérivé est
publié sous BY-SA, ce qui n'engage pas le code de l'application.

### Repères annuels éduscol — le découpage par année

ScoLOMFR étiquette la plupart des nœuds de collège par **cycle**, pas par année.
Un élève de 5e et un de 3e recevraient le même corpus — exactement la faute que
le référentiel doit empêcher.

Les repères annuels de progression comblent ce trou, et ils sont **structurés** :
un tableau notion × année, en trois colonnes.

```
Cycle 4 · Mathématiques — REPÈRES ANNUELS
                      5e                 |        4e         |       3e
Fractions,      | conception d'une      | quotient d'un      | fraction
nombres         | fraction comme nombre,| entier relatif…,   | irréductible,
rationnels      | fractions égales…     | notion d'inverse   | multiple/diviseur
```

Couverture : français, mathématiques, EMC et langues vivantes, du CP à la 3e.

**Et cette borne à la 3e n'est pas un trou** : le problème du cycle n'existe pas
au lycée. Mesuré sur ScoLOMFR — nœuds de lycée, CAP et voie professionnelle
portés par une **année ou une série** : **4 882**. Nœuds de lycée étiquetés par
**cycle** : **0**. Au-delà de la 3e, la source est déjà annuelle et sensible à la
série (373 points en 2de professionnelle, 173 en terminale générale, 24 en
terminale STMG, 19 en 1re STI2D, jusqu'à S2TMD). Les deux sources sont donc
exactement complémentaires : les repères couvrent la zone où ScoLOMFR raisonne
par cycle, et s'arrêtent là où il raisonne par année.

Le périmètre du référentiel va donc de la maternelle à la terminale, CAP et
baccalauréat professionnel compris, avec les séries technologiques distinguées —
`voie` et `serie` sont des champs de premier ordre, sans quoi « première » ne
sépare pas la générale, la STMG et la professionnelle.

**Contrainte d'accès vérifiée** : les pages HTML éduscol répondent **403** aux
machines (curl et WebFetch, en-têtes de navigateur complets). L'endpoint
`https://eduscol.education.fr/document/<id>/download` **répond 200** et sert le
PDF. Les identifiants ne se déduisent d'aucune page listable → **table
d'identifiants tenue à la main**, une quinzaine de lignes, versionnée dans le
repo. C'est le seul travail manuel du pipeline.

Ces repères se périment d'eux-mêmes : les nouveaux programmes sont écrits par
niveau. Mesuré sur les générations dans ScoLOMFR — part des nœuds étiquetés par
année plutôt que par cycle :

| génération | 2015- | 2024- | **2025-** |
|---|---|---|---|
| part annuelle | 16 % | 22 % | **73 %** |

Le pipeline de repères est donc un pont, pas une dette : il couvre les nœuds
encore rédigés par cycle, et son périmètre décroît à chaque livraison ScoLOMFR.

### Notes du CSEN — la doctrine pédagogique

Le Conseil scientifique de l'éducation nationale publie ~15 notes de synthèse
et recommandations fondées sur la recherche (enseignement explicite,
apprentissage de la lecture, de la multiplication aux fractions, esprit
critique…).

Licence **Etalab 2.0** — réutilisation libre avec attribution.

C'est la seule source du second besoin exprimé : que l'agent suive les pratiques
d'apprentissage recommandées par l'institution. Un LLM laissé à lui-même produit
du tutorat générique, pas de la pratique validée en France.

### Sources écartées, et pourquoi

- **`data.gouv.fr` « Programmes d'enseignement cycles 2, 3, 4 »** : PDF, EPUB,
  ODT, RTF. Dernière mise à jour **26/01/2021**. Aucune structure.
- **La prose des arrêtés de programme** : n'apporte rien que la chaîne de parents
  ne donne mieux, et ne prouve rien de plus — ScoLOMFR *est* la source
  institutionnelle. Le texte officiel garde deux usages, aucun n'étant « être
  indexé » : une URL stockée par programme, et ce qu'on va lire à la main quand
  la détection signale un retard.
- **Manuels scolaires** : œuvres commerciales sous droit d'auteur.
- **Ressources d'accompagnement éduscol** : 403 aux machines.
- **ScoLOMFR `0152 — Compétences travaillées`** : 3 359 concepts, mais **retiré de
  la livraison v11 et non mis à jour** — « trop complexe » (lisezmoi de
  l'archive). Ne pas s'appuyer dessus.
- **Vocabulaires « pédagogiques » ScoLOMFR** (`153`, `18`, `19`, `25`) :
  documentaires et inutilisables ici — `153` vaut « dispositif ECLAIR », `25`
  vaut « facile / moyen / difficile ».
- **GitHub et l'open data français** : aucun référentiel structuré des programmes.
  Cherché, rien trouvé.

## Les trois artefacts produits

`apps/curriculum` cesse d'être un pipeline d'indexation et devient un
**producteur de données**. Il émet trois fichiers versionnés, datés, testés.

### 1. `programme.json` — ce qui existe

Un nœud par point de programme :

| champ | source | note |
|---|---|---|
| `id` | URI ScoLOMFR | stable entre versions |
| `label` | `skos:prefLabel`, parenthèse de portée retirée | |
| `chemin` | chaîne des parents | c'est le contexte sémantique du nœud |
| `parent` | `skos:broader` | |
| `discipline` | lien voc `015`, sinon libellé, sinon hérité | |
| `portee` | `{type: "annee"\|"cycle", valeur}` | tel que la source le dit |
| `annee_plancher` | première année de `portee` | jamais de plafond |
| `plancher_source` | `annee_explicite` \| `debut_de_cycle` | dit son propre degré de certitude |
| `voie`, `serie` | voc `022` | distingue 1re générale / STMG / professionnelle |
| `generation` | `skos:historyNote` | « Programmes 2025- » |

**Pourquoi un plancher et jamais une fenêtre.** Les textes officiels s'expriment
en plancher : un *attendu de fin d'année* est une échéance, une *progression* est
un ordre. Aucun texte ne dit qu'une notion cesse d'être au programme. Une fenêtre
serait une invention — et elle casserait la remédiation, qui est le cas d'usage
le plus fréquent d'un élève en difficulté : un 3e doit pouvoir revenir sur du 5e.

Le filtre est donc `annee_plancher ≤ année de l'élève`, jamais une égalité. La
même colonne répond à l'autre question sans second modèle :
`annee_plancher == année` donne « ce qui est nouveau cette année ».

**Le plancher issu d'un cycle est délibérément permissif**, et c'est le point le
plus important de ce document. Pour un nœud de cycle 4, `annee_plancher` vaut 5e
— donc un élève de 5e voit passer la trigonométrie, qui est en pratique enseignée
en 4e ou en 3e. Le référentiel ne corrige pas ça en devinant une année : il le
**signale** (`plancher_source = debut_de_cycle`) et fournit le correctif
institutionnel dans `progression.json`. Les deux se lisent ensemble : l'arbre dit
ce qui existe, les repères disent quelle année l'introduit. Aucune des deux
sources n'est complétée par une inférence.

### 2. `progression.json` — quand ça entre

Les repères annuels, extraits en lignes `(discipline, cycle, notion, année,
texte)`. **Artefact séparé, pas une mutation de l'arbre** : aucun alignement
flou entre les libellés éduscol et les nœuds ScoLOMFR, donc aucune erreur
d'appariement silencieuse. L'agent reçoit les deux et les lit ensemble.

### 3. `pedagogie.json` — comment on enseigne bien

Les principes tirés des notes CSEN, chacun portant sa **citation** (note, page).
Petit, relu par un humain, auditable. Ce n'est pas un cache de sortie de LLM :
chaque affirmation est traçable à une publication institutionnelle.

## Le partage référentiel / agent

| | référentiel | agent |
|---|---|---|
| ce qui existe au programme | ✅ | ❌ jamais depuis ses poids |
| à partir de quelle année | ✅ `annee_plancher` + `plancher_source` | ❌ |
| strict ou permissif quand le plancher est grossier | ❌ | ✅ politique |
| position dans la progression, prérequis | ✅ chaîne de parents | ❌ |
| ce que l'élève a réellement vu | ❌ pas un fait institutionnel | ✅ |
| mapper une phrase floue vers un nœud | ❌ | ✅ avec le sous-arbre en contexte |
| écrire l'explication, l'exemple, l'exercice | ❌ | ✅ |
| choisir le geste pédagogique | ❌ il fournit la doctrine | ✅ |
| savoir que le corpus est en retard | ✅ et ça sort en rouge | ❌ |

**La ligne à ne pas franchir** : le référentiel dit ce qui est prescrit, jamais
quoi faire. Le jour où il encode « comment enseigner X », il fige un jugement que
personne ne peut plus auditer.

**Ce que le référentiel ne portera jamais** : d'explications, d'exemples ou
d'exercices générés. Stocker de la sortie de LLM pour la re-servir à un LLM est
un cache, pas un ancrage : ça ne réduit pas l'hallucination, ça la fige. Une
explication fausse générée à la volée varie et se corrige au tour suivant ; la
même rangée dans le référentiel est resservie à l'identique, avec l'autorité du
« c'est dans la base ». Cette porte ne se rouvre que si un humain relit et
valide — ce n'est alors plus de l'architecture mais de l'éditorial.

## Contrat de consommation

Une seule question, une seule réponse :

```
programme(classe, voie, serie, discipline)  -> sous-arbre complet
progression(discipline, cycle)              -> tableau notion x annee
pedagogie(discipline?, niveau?)             -> principes cites
```

Trois lectures, aucune recherche. Filtre déterministe, exhaustif, reproductible.
Pas de `top-k`, pas de score, pas d'embedding. `progression` et `pedagogie`
n'existent qu'à partir de leurs lots respectifs ; `programme` seul suffit à
livrer la garantie d'exhaustivité.

## Fraîcheur — ce qui remplace la veille

`veille_programmes.py` interroge aujourd'hui l'API PISTE sans identifiants : il
ne détecte rien et **sort vert**. Une panne silencieuse.

Le remplaçant ne dépend d'aucune clé : comparer la `generation` portée par
chaque nœud à la rentrée courante, et la version ScoLOMFR locale à celle publiée.
Un retard devient un **test rouge**. Réformes en cours à surveiller : nouveaux
programmes de français et de maths du cycle 4, appliqués en 5e à la rentrée 2026
puis étendus par niveau.

## Gates

1. **Portée** — au plus 41 nœuds sans discipline ni niveau (le mesuré actuel).
   Au-delà, échec.
2. **Fraîcheur** — deux contrôles, tous deux sans clé d'API : (a) la version
   ScoLOMFR publiée est celle qu'on tient, sinon rouge ; (b) pour chaque couple
   (niveau × discipline), la génération la plus récente présente est reportée
   dans un instantané versionné — toute régression ou tout couple dont la
   génération recule sous `RENTREE_COURANTE - 10` sort en avertissement à
   arbitrer, jamais en silence.
3. **Plancher** — tout nœud a un `annee_plancher` et un `plancher_source`. Aucune
   valeur dérivée d'une inférence de LLM.
4. **Couverture** — chaque couple (niveau × discipline) du périmètre a au moins
   un nœud. Un couple vide sort en 1.
5. **Contrat** — le schéma des trois artefacts est vérifié des deux côtés :
   producteur ici, consommateur dans `apps/server`.

## Ce qui disparaît

Rien n'est gardé « au cas où ».

**Dans `apps/curriculum`** — tout le pipeline PDF → chunk → embed → index :
`fetch_sources.py`, `extract_pdfs.py`, `ingest.py`, `migrate_collection.py`,
`query.py`, `verify_corpus.py`, `refresh_catalogue.py`, `veille_programmes.py`,
le manifeste écrit à la main (`schema/programmes.py`), `schema/document.py`,
`schema/mapping.py`, `schema/contextual.py`, `schema/retrieval.py`,
`contract.json` v1, `data/raw` (32 Mo), `data/catalogue_second_degre.json`,
`data/test_queries.json`, et le harnais d'évaluation retrieval (MTEB, ranx).

**Dans `apps/server`** — le curriculum sort de l'index vectoriel :
`rag.service.ts`, `ovh-embeddings.client.ts`, et la partie curriculum de
`qdrant.service.ts` / `qdrant-hierarchy.service.ts`, remplacées par un service
qui lit les trois artefacts.

## Ce qui reste, et pourquoi

**Qdrant reste.** Il n'est pas au service du seul curriculum :
`episodic-memory.service.ts` (mémoire de l'élève, via
`mistral-embeddings.service.ts`) et `document-analysis.service.ts` (documents
déposés par l'élève) s'en servent. Ce sont les corpus qui justifient réellement
le vectoriel : volumineux, non structurés, propres à chaque utilisateur, où un
rappel approximatif est acceptable.

La règle qui range chaque corpus :

| corpus | outil |
|---|---|
| petit, structuré, attributs propres, exhaustivité obligatoire | **filtre** |
| volumineux, non structuré, par utilisateur, rappel approximatif acceptable | **RAG vectoriel** |

Le programme officiel est dans la première ligne ; le cours de l'élève dans la
seconde. L'application avait bâti l'artillerie de la seconde pour servir la
première.

## Risques et points non vérifiés

| point | état | mitigation |
|---|---|---|
| Licence des vocabulaires ScoLOMFR | CC BY-SA lue pour les XSD ; rien de distinct pour les vocabulaires | demande écrite à Réseau Canopé avant production |
| Inventaire des documents de repères éduscol | pages HTML en 403 ; deux PDF téléchargés avec succès | table d'identifiants manuelle, versionnée |
| Extraction des tableaux de repères | `pdftotext -layout` rend la structure en 3 colonnes | test de non-régression par document ; échec bruyant |
| Date du BO du 05/03/2026 (réforme cycle 4) | **source secondaire uniquement** | la tendance est mesurée dans ScoLOMFR (73 % annuel en 2025-), qui est primaire |
| Volume et format exacts des notes CSEN | liste vue, notes non lues | lot séparé, ne bloque pas le référentiel |
| « L'énumération bat la récupération » | raisonnement, non mesuré | mesuré en lot 1 sur des requêtes réelles avant toute suppression côté serveur |

## Lots

1. **Mesure** — sur des requêtes réelles, comparer « filtre + sous-arbre en
   contexte » contre « dense top-k » : lequel désigne le bon nœud. Rien n'est
   supprimé avant ce chiffre.
2. **`programme.json`** — ScoLOMFR → arbre normalisé, héritage de portée,
   plancher, gates 1 à 4.
3. **Contrat + service serveur** — le filtre déterministe, testé des deux côtés.
4. **`progression.json`** — table d'identifiants éduscol, extraction des repères.
5. **Détection de retard** — remplace `veille_programmes.py`.
6. **Suppression** — retrait de tout ce qui est listé ci-dessus.
7. **`pedagogie.json`** — CSEN, lot indépendant.
