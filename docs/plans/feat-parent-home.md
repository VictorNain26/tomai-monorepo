# Plan — L'accueil parent et le résumé de la semaine

## Problème

Le parent ne voit rien de ce que fait son enfant, et son accueil est un long formulaire
(`etudes/2026-10-08/interfaces.md`, constats 2 et 3) : l'ajout d'un enfant toujours ouvert, les
clés d'accès et la déconnexion au niveau des enfants, rien après l'ajout. Le serveur calcule déjà
le résumé de la semaine (`/api/summary`) ; aucun écran ne le montre.

## Choix

- **Une carte par enfant** : prénom, classe, et la semaine en une ligne (temps, ou « pas de
  séance »). L'ajout d'un enfant se replie derrière un bouton dès qu'un enfant existe.
- **Après l'ajout, la fiche de l'enfant** avec l'étape suivante : faire les devoirs ensemble en
  6e et 5e, relier son appareil en 4e et 3e.
- **« Mon compte »** : les clés d'accès et la déconnexion, hors de l'accueil.
- **Le résumé de la semaine** sur la fiche de l'enfant et sur l'accueil de l'élève, le même
  contenu (décision du 2026-10-08), dit au parent (« Lou a travaillé… ») ou à l'élève (« tu as
  travaillé… ») : les matières et le temps, ce qui résiste avec l'aide reçue, et une question à
  poser à l'enfant tirée de ce qui résiste (décision du 2026-10-08) ; jamais de note ni de progrès.

## Critères d'acceptation

- [ ] Unitaires (web) : le temps dit en minutes, la matière en mots, la question tirée de ce qui
      résiste ; vus rouges.
- [ ] E2E : la carte et sa ligne, l'ajout replié, l'étape suivante après l'ajout, « Mon compte »,
      le résumé côté parent et côté élève, vide et plein ; vus rouges.

## Hors périmètre

Un envoi du résumé par e-mail ; l'arrêt du résumé à la demande de l'élève (consentement, étape 3).

## Vérification de bout en bout

`bun run test`, Playwright, les écrans vus dans Chrome.

## Décision humaine

`decisions.md`, 2026-10-08 ; cascade demandée par Victor le 2026-10-09.
