# Plan — Le mode accompagné en 6e et 5e

## Problème

Avant la 4e, la séance se fait avec le parent à côté ou seul sur l'appareil de la famille, et Tom
aide le parent à accompagner sans faire à la place (`decisions.md`, « Le mode accompagné en 6e et
5e » ; `etudes/2026-10-08/aide-parentale.md`, § 6 (c)). Rien de cela n'existe : toute séance est
la même, et le parent d'un élève de 6e se voit proposer de relier un appareil.

## Choix

- **Le choix à l'ouverture**, en 6e et 5e seulement : « Avec mon parent à côté » ou « Seul ce
  soir » ; il est gardé sur la séance (`study_session.accompanied`). En 4e et 3e, refusé.
- **Les pistes au parent sont des phrases fixes, choisies par le code** : jamais un mot du modèle,
  donc jamais le contenu de l'exercice ni sa réponse, ce que le serveur garantit par construction.
  Cinq moments, une piste au plus par tour, quatre au plus par séance : le lancement (son rôle),
  un nouvel exercice, un blocage (le cran monte), une frustration (demande de la réponse ou « je
  sais pas »), la fin (exercice résolu). Vouvoiement, vingt mots au plus, avec le prénom pour
  rester épicène.
- **Transmises comme une partie `data-cue` transitoire**, montrées sous la réponse jusqu'au
  message suivant, visibles de l'enfant.
- **Côté parent** : « Faire les devoirs avec … » remplace « Ouvrir l'espace » en 6e et 5e, et le
  jumelage d'un appareil propre à l'enfant n'y est plus proposé. Le serveur garde le code de
  jumelage, dont se sert l'ouverture sur l'appareil de la famille.
- **Côté enfant** : ce que son parent peut voir sur l'appareil de la famille.

## Critères d'acceptation

- [ ] `POST /api/sessions` prend `{ accompanied }` ; accompagné refusé en 4e et 3e (test).
- [ ] Une séance accompagnée reçoit la piste du lancement au premier tour, celle d'un blocage,
      d'une fin ; jamais deux par tour, jamais plus de quatre ; aucune seule (tests).
- [ ] Le web : les deux choix en 6e et 5e, un seul bouton en 4e ; la piste affichée ; « Faire
      les devoirs avec … » et pas de « Relier un appareil » en 6e et 5e (e2e vus rouges).

## Hors périmètre

Le résumé à l'écran (étape 3), l'accueil élève refait (étape 2), le second parent.

## Vérification de bout en bout

`bun run test`, Playwright, et le parcours vu dans Chrome : parent, « Faire les devoirs avec … »,
séance accompagnée.

## Décision humaine

`decisions.md`, 2026-10-08 ; choix d'exécution délégués par Victor, cascade demandée le 2026-10-09.
