# Plan — Le résumé de la semaine, pour le parent et l'élève

## Problème

Le parent ne voit rien de ce que fait son enfant : le foyer ne montre que de l'administration
(`etudes/2026-10-08/interfaces.md`, constat 2). La promesse (`vision.md`, principe 3) : un
résumé de la semaine, matières, temps passé, ce qui résiste, jamais les conversations, et
l'élève voit le même.

## Choix

- **Calculé par le code, sans modèle** : aucune ligne d'élève ni de Tom, rien à payer, rien
  d'inventé. Sources : `study_session` (matière), `message` (horodatages), `exercise` et
  `turn_record` (notions, aide, erreurs).
- **Fenêtre** : les sept derniers jours glissants, lus un lundi matin comme un dimanche soir.
- **Temps passé** : par séance, la somme des écarts entre deux messages qui se suivent, un écart
  de plus de 10 minutes compté comme une pause ; arrondi aux 5 minutes et dit « environ ».
- **Matières** : celle de chaque séance, avec son temps ; une séance sans matière compte en
  « autre ».
- **Ce qui résiste** : une notion dont le dernier exercice de la semaine n'est pas résolu, ou
  résolu avec une aide allée jusqu'à « Étape intermédiaire » ou plus ; avec l'erreur fréquente
  quand il y en a une (`core/memory.ts`). Une notion que l'élève a marquée comprise n'y figure
  plus que par ses exercices suivants.
- **Indépendant de la mémoire d'apprentissage** : le résumé dit la semaine, la mémoire est ce
  que Tom relit d'une séance à l'autre. Tranche la décision ouverte « ce que le parent voit de la
  mémoire » : rien de plus que le résumé.
- **Jamais la détresse** : elle suit la revue humaine (lot 3, plus tard).
- **Routes** : `GET /api/summary` pour l'élève connecté ; `GET /api/summary/:studentId` pour un
  parent de son foyer ; même contenu. Côté web : hors de cette PR (les écrans attendent la
  direction artistique).

## Critères d'acceptation

- [ ] Une fonction pure de `core/` calcule le résumé ; ses tests couvrent pauses, séance d'un
      seul message, arrondi, notion résolue sans aide, avec aide haute, non résolue, remise à zéro.
- [ ] Les routes en test d'intégration : l'élève voit le sien ; le parent voit celui de son
      enfant ; un autre parent, un élève sur un autre élève et un anonyme sont refusés.
- [ ] Une séance ou un exercice de plus de sept jours n'entre pas.
- [ ] `decisions.md` : la décision ouverte sur la mémoire tranchée ; `suivi.md` à jour.

## Hors périmètre

L'écran du résumé (après la direction artistique), un envoi par e-mail, les semaines passées,
les mots de l'élève pour les notions (étape « accueil élève »).

## Vérification de bout en bout

`bun run test` vert, puis sur la stack locale : une séance de Léo, puis `GET /api/summary` en
élève et `GET /api/summary/<id>` en parent, réponses identiques.

## Décision humaine

Validé par Victor le 2026-10-08, avec « rien de plus que le résumé » pour la mémoire.
