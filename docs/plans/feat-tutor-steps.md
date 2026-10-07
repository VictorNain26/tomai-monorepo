# Plan — les étapes du tour du tuteur (étape 5, PR 2b)

Pré-vol (2026-10-07) : source du portage, le code de #415 (`050d2a63`), relu ; écarts à la
cible de `etudes/2026-10-06/refonte-architecture.md` comblés ici : le contrôle échoue fermé
(fiche incertaine tenue aux formes de tous les tirages, fiche absente à un palier bas avec son
contrat), et la décision 4 de Victor (deux « je sais pas » de suite font monter d'un cran), que
#415 ne tenait pas. Arbitrages : les fichiers d'un module qui ne sont ni routes, ni service, ni
repository, ni schéma vont dans `core/`, déclaré dans les frontières ESLint, seul à lire le
référentiel ; le champ des cartes de révision sort de l'analyse jusqu'au retour des cartes.

## Problème

Le tour du tuteur (PR 3) a besoin de ses étapes : analyser le message, préparer la fiche d'un
nouvel exercice, juger une proposition, décider du cran et écrire le contrat, contrôler la
réponse avant l'élève. Elles se testent ici, contre le faux Mistral, sans séance ni route.

## Critères d'acceptation

- [ ] `modules/tutor/core/` : clôtures du prompt, analyse du tour, fiche à trois tirages votés,
      diagnostic arbitré par mathjs, crans et contrat, contrôle de sortie, routage du raisonnement,
      tour d'exercice.
- [ ] Le contrôle échoue fermé : fiche incertaine tenue aux formes de tous les tirages, modération
      indisponible qui retient le texte, fiche absente qui garde l'aide au cran 1 au plus.
- [ ] Deux « je sais pas » de suite, sans tentative, font monter d'un cran ; une demande seule
      jamais.
- [ ] Chaque appel des étapes facturé à l'élève ; tests sur une vraie base contre le faux
      Mistral, sans `mock.module`.

## Hors périmètre

Séances, messages, prompt du rédacteur, tour en flux et enregistrement de tour : PR 3. Quota :
PR 4.

## Vérification de bout en bout

`bun run typecheck && bun run lint && bun run test`, knip vert.

## Décision humaine

Étape 5 validée par Victor le 2026-10-06, décision 4 comprise ; découpage délégué le 2026-10-07.
