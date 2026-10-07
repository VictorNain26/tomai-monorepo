# Plan — la mémoire d'apprentissage, côté serveur (PR M1)

Pré-vol (2026-10-07) : l'étude et les décisions de Victor sont mergées
(`etudes/2026-10-07/memoire-entre-seances.md`, #440). Chaque fiche porte les identifiants de ses
notions (`sheet.entries`), chaque exercice son palier et sa résolution, chaque diagnostic un type
d'erreur d'une liste fermée. Aucune dépendance ajoutée : Postgres et du code déterministe.

## Problème

Tom ne sait rien des séances passées : il ne reprend pas là où ça a résisté.

## Conception

- **L'accord** vit sur le profil de l'élève (foyer) : la proposition du parent, la réponse de
  l'enfant, la date de la dernière remise à zéro. Avant 15 ans, active si le parent l'a proposée et
  l'enfant acceptée ; à partir de 15 ans, l'enfant seul. Désactiver remet aussi à zéro.
- **Le bloc** se calcule à chaque tour, à partir des seuls exercices de l'élève antérieurs à
  l'exercice en cours, depuis la rentrée et la dernière remise à zéro : le même d'un tour à l'autre
  (cache), et une opposition qui joue au tour suivant, sans rien figer. Il ne contient que des
  libellés du référentiel, des nombres et des types d'erreur.
- **Les corrections** de l'élève (« j'ai compris ») : une notion et sa date ; seuls comptent ensuite
  les exercices postérieurs.

## Critères d'acceptation

- [ ] Le type d'erreur de chaque tour est gardé (`turn_record.error_type`).
- [ ] Le parent propose la mémoire à l'ajout de l'enfant ou ensuite, et la retire ; l'élève
      l'accepte, la refuse, l'efface ou corrige une notion (`/api/memory`), et voit ce que Tom retient.
- [ ] Le bloc `<learner_memory>` entre dans l'exercice seulement quand la mémoire est active.
- [ ] Tests : deux élèves sur la même notion, rien de l'un chez l'autre ; aucun bloc sans accord ;
      une désactivation, un effacement ou une correction changent le bloc dès le tour suivant ; rien
      d'avant la rentrée ; l'âge de 15 ans ; un « retiens que… » ne laisse aucun texte.

## Hors périmètre

Les écrans (PR M2) ; la mesure au harnais (lot 1).

## Vérification de bout en bout

`bun run typecheck && bun run lint && bun run test`.

## Décision humaine

Les quatre décisions de l'étude : Victor, 2026-10-07.
