# ADR 0003 — Légifrance en open data décide ce que le corpus contient

- **Date** : 2026-08-22
- **Statut** : accepté
- **Portée** : `apps/curriculum` — d'où vient la liste des programmes à indexer

## Le problème

Le corpus doit être complet **et à jour des réformes** : un tuteur qui cite un
programme abrogé, ou un programme qui n'entrera en vigueur que dans deux ans,
enseigne du faux à un enfant, et rien dans la chaîne ne le signale.

Trois sources se disputaient ce rôle, et aucune ne le tenait :

| Source | Ce qu'elle donne | Pourquoi elle ne suffit pas |
|---|---|---|
| API `data.education.gouv.fr` | liste des programmes + URL des PDF | **gelée à la rentrée 2021** — 11 entrées cette année-là, aucune après |
| table écrite à la main | les réformes récentes | périmée par construction : elle ignorait déjà trois arrêtés d'avril 2026 |
| sondage d'URL du BO | des PDF | deviner un nom de fichier n'est pas une méthode |

La deuxième est la plus dangereuse : elle a l'air à jour parce que quelqu'un
vient de l'écrire.

## La décision

**Le fonds JORF de Légifrance, publié en open data par la DILA, décide de ce que
le corpus doit contenir.** Le manifeste en est dérivé ; il n'est plus écrit à la
main.

`https://echanges.dila.gouv.fr/OPENDATA/JORF/` — dump global et incréments
quotidiens, **sans authentification**.

## Ce qui a été vérifié, le 2026-08-22

- **Accessible sans compte** : HTTP 200, aucune clé, aucune CGU à accepter.
- **À jour du jour même** : 744 archives, du dump global du 13 juillet 2025 à
  l'incrément `JORF_20260822-002531`.
- **Contient nos arrêtés** : `MENE2018714A` (programmes de cycle BO2020),
  `MENE2504620A` et `MENE2504621A` (réformes 2025), retrouvés dans le dump
  global ; `MENE2608631A`, `MENE2602909A`, `MENE2608627A` (avril 2026) dans les
  incréments.
- **Donne le calendrier par niveau**, en clair :
  > « Les dispositions du présent arrêté entrent en application à la rentrée de
  > l'année scolaire 2026-2027 en tant qu'elles s'appliquent aux classes de
  > cours préparatoire […] et à la rentrée de l'année scolaire 2027-2028 en tant
  > qu'elles s'appliquent […] et de sixième. » (`MENE2608631A`, article 3)
- **Donne les abrogations**, y compris partielles :
  > « Les parties relatives à l'enseignement d'éducation physique et sportive
  > […] de l'annexe 2 […] de l'arrêté du 9 novembre 2015 susvisé sont
  > supprimées. » (article 2)
- **Donne les liens entre textes** :
  `<LIEN nortexte="MENE1526483A" typelien="CITATION">` — la chaîne des
  modifications est machine-lisible.

## Alternatives écartées

**L'API PISTE.** C'est le portail d'API officiel de l'État, et l'API Légifrance
y est exposée par la DILA : la source est la même. Elle exige en revanche un
compte, l'acceptation de CGU par API, une souscription sur le canal production,
un quota de 20 requêtes/seconde et deux secrets à gérer. Ce sont précisément ces
prérequis qui n'ont jamais été remplis : `PISTE_CLIENT_ID` et
`PISTE_CLIENT_SECRET` n'existaient ni en local ni en secrets GitHub, la moitié
Légifrance de la veille n'a donc **jamais tourné**, et le workflow hebdomadaire
sortait vert en imprimant « aucun changement ». Trois réformes sont passées
ainsi. L'open data supprime la dépendance humaine ; à contenu égal, il est
strictement supérieur pour cet usage.

**`data.education.gouv.fr` comme autorité.** Gelée en 2021, elle ignore aussi
les **abrogations** postérieures : elle continue d'annoncer « en vigueur » les
programmes de langues du lycée que le BO de mai 2025 a remplacés. Elle garde un
rôle d'annuaire — pour les programmes de 2019-2020 encore applicables, elle
fournit l'URL du PDF — mais elle ne décide plus rien.

**Scraper le BO.** `education.gouv.fr`, `eduscol.education.fr` et
`legifrance.gouv.fr` renvoient **403** sur tout HTML, y compris avec des
en-têtes de navigateur complets et via un agent. Ce n'est pas contournable, et
ce n'est pas souhaitable.

## Ce que cette décision ne résout pas

**Légifrance porte la règle, pas le contenu.** Le texte d'un arrêté de programme
fait quelques kilo-octets et renvoie explicitement ailleurs :

> « Le présent arrêté et ses annexes seront consultables au Bulletin officiel de
> l'éducation nationale […] en date du 28 mai 2026, sur le site
> https://www.education.gouv.fr »

Les programmes eux-mêmes sont donc au BO, dont les pages sont fermées aux
machines. Les PDF individuels se téléchargent (HTTP 200), mais leur nom
(`ensel621_annexe3.pdf`) ne se déduit ni de l'arrêté ni de la date du BO.

**Il n'existe aucune source unique qui donne à la fois la règle et le contenu.**
C'est un fait sur les sources, pas un choix d'architecture.

## Conséquences

1. `schema/programmes.py` devient **dérivé** du fonds JORF : quels programmes,
   pour quelles classes, à partir de quelle rentrée, et ce qu'ils abrogent.
2. Une table d'annexes associe un NOR aux URL de ses PDF au BO. C'est le seul
   travail manuel, il est borné à quelques arrêtés par an, et il est **déclenché**
   par la détection plutôt que subi.
3. La veille scanne les incréments JORF quotidiens et signale tout arrêté de
   programme dont le NOR n'est pas dans cette table. Sans authentification, donc
   elle fonctionnera vraiment.
4. `PISTE_CLIENT_ID` et `PISTE_CLIENT_SECRET` disparaissent du projet.

## Ce que ça a déjà rattrapé

Le scan du fonds a révélé trois arrêtés d'avril 2026 qu'aucune de nos sources
précédentes ne connaissait, dont `MENE2608631A` : EPS et histoire-géographie du
cycle 3, applicables **en sixième à la rentrée 2027**. La table écrite à la main
était fausse le jour même où elle a été écrite.
