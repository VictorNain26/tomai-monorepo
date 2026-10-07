# Plan — étape 4 de la refonte, première PR : le foyer, l'élève créé par le gardien, la matrice d'accès

Étude : `docs/etudes/2026-10-06/refonte-architecture.md`, « Données et autorisation » et
« Authentification », point 4 de l'ordre des PR. Branche `feat/household-accounts`, depuis `main`
à `372b5ab1`. L'étape tient en deux PR en cascade : celle-ci, puis l'e-mail des gardiens
(vérification, réinitialisation, suppression du compte), qui part de cette branche.

## Pré-vol (types de better-auth 1.7.5 installés)

- Un élève n'a pas d'e-mail, mais better-auth exige `user.email` : l'adresse est celle que
  better-auth fabrique lui-même pour un compte sans e-mail, `createPlaceholderEmail`
  (`@better-auth/core/utils/email`, domaine `.invalid` de la RFC 6761, jamais routable).
- Connexion de l'élève par `username` (plugin `username`, `immutableUsername: true`).
- Le hachage est celui que better-auth configure, `auth.$context.password.hash`.
- Arbitrage : l'élève se crée dans **une transaction Drizzle** (utilisateur, compte, foyer, membre,
  profil) plutôt que par `signUpEmail`, qui ouvrirait une session à l'élève dans la requête du
  gardien et écrirait hors de la transaction. Le nom d'utilisateur suit des règles incluses dans
  celles du plugin ; un test le prouve en connectant l'élève par `/sign-in/username`.

## Problème

Le socle n'a qu'un `user` générique : aucun foyer, aucun élève, aucune règle d'accès. Les étapes
5 et 6 (tuteur, chat) ont besoin de savoir qui est l'élève, à quel foyer il appartient et qui peut
le voir. L'audit du 2026-10-06 a trouvé dans l'ancien serveur un élève qui retirait à son parent le
contrôle de son compte, et des comptes enfants créés hors transaction.

## Critères d'acceptation

- [ ] Tables `household`, `household_member` (gardien ou élève, un foyer par membre) et
      `student_profile` (niveau, mois de naissance) ; le prénom ou pseudonyme est `user.name`, sans
      nom de famille ; une migration générée.
- [ ] Module `modules/household` (routes, service, repository), déclaré dans les frontières du
      lint. Un gardien crée, liste, modifie (prénom, niveau), change le mot de passe de ses élèves
      et les supprime ; le foyer naît avec le premier élève, dans la même transaction.
- [ ] Changer le mot de passe d'un élève supprime ses sessions ; supprimer un élève supprime son
      compte, ses sessions, son profil et son appartenance.
- [ ] Refus par défaut : une seule fonction d'accès du gardien à l'élève, clause de la requête SQL ;
      l'élève d'un autre foyer répond 404 ; un élève n'atteint aucune route de gardien.
- [ ] Aucun champ du foyer ni du profil n'est modifiable par les routes de better-auth (ils vivent
      hors de `user`) ; un élève ne peut ni changer d'e-mail ni supprimer son compte.
- [ ] Matrice de tests d'accès croisés sur une vraie base : anonyme, gardien A, gardien B, élève de
      A, élève de B, pour chaque route ; cas limites (nom d'utilisateur pris ou invalide, niveau
      inconnu, mois de naissance futur, élève déjà supprimé).

## Hors périmètre

E-mail des gardiens, réinitialisation, suppression du compte du gardien et suppression des
sessions à la réinitialisation : la PR suivante. Second gardien et consentement : lot 3. Quota par
foyer : étape 5. Écrans du web et `contract.ts` : étape 6. `trustedProxies` et purge planifiée des
données expirées : étape 7, avec l'hébergeur.

## Vérification de bout en bout

`bun run test` (matrice comprise) ; puis, contre le serveur lancé en local : inscription d'un
gardien, création d'un élève, connexion de l'élève par son nom d'utilisateur, refus de ses appels
aux routes du gardien, changement de son mot de passe qui coupe sa session. CI verte, `ci-ok`
compris. Pas d'écran à tester dans Chrome avant l'étape 6.

## Décision humaine

Le foyer et la minimisation de l'élève : décision de Victor du 2026-10-06 (étude, décision 2).
Le découpage des tables, les deux PR et le fournisseur d'e-mail : choix techniques délégués par
Victor le 2026-10-07 (« je te laisse faire le meilleur choix technique »).
