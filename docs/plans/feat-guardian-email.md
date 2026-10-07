# Plan — étape 4, seconde PR : l'e-mail des gardiens

Étude : `docs/etudes/2026-10-07/email-transactionnel.md` (Scaleway TEM, choisi le 2026-10-07) et
`foyer-eleve-age.md`. Branche `feat/guardian-email`, depuis `main` à `a06f7ffc`.

## Pré-vol

- better-auth 1.7.5 (types installés) : `emailVerification.sendVerificationEmail`, `sendOnSignUp`,
  `autoSignInAfterVerification` ; `emailAndPassword.requireEmailVerification`,
  `sendResetPassword`, `revokeSessionsOnPasswordReset` ; `user.deleteUser.enabled`,
  `sendDeleteAccountVerification`, `beforeDelete`.
- Scaleway TEM : `POST /transactional-email/v1alpha1/regions/fr-par/emails`, en-tête
  `X-Auth-Token`, corps `from`, `to`, `subject`, `text`, `project_id` (spec OpenAPI lue le
  2026-10-07). SDK officiel `@scaleway/sdk-tem` 2.15.0 : dépôt `scaleway/scaleway-sdk-js` non
  archivé, dernier push le 2026-10-06, 22 600 téléchargements par semaine.
- Arbitrage : la table d'envois à clé unique de l'étude sert les alertes au parent (lot 3) ; les
  liens de vérification et de réinitialisation portent déjà leur jeton à usage unique de
  better-auth.

## Problème

Un gardien s'inscrit sans prouver son adresse, ne peut pas retrouver l'accès à son compte, ni le
supprimer ; supprimer le seul gardien laisserait des élèves sans personne (revue de #425).

## Critères d'acceptation

- [ ] Un expéditeur passé en paramètre (`platform/email`) : Scaleway TEM en production, configuré
      par l'environnement (requis en production) ; en développement, le lien est journalisé ; les
      tests passent le leur. Aucune adresse `.invalid` d'élève n'est jamais envoyée.
- [ ] Inscription : e-mail de vérification envoyé, connexion refusée tant qu'il n'est pas
      vérifié, session ouverte au clic.
- [ ] Mot de passe oublié : lien de réinitialisation ; la réinitialisation ferme toutes les
      sessions du gardien.
- [ ] Suppression du compte du gardien, confirmée par son mot de passe (revue : un lien par
      e-mail ne marche que dans le navigateur qui tient la session) et suivie d'un e-mail ; elle
      emporte le foyer et ses élèves (sessions comprises) quand il en est le seul gardien, en une
      transaction.
- [ ] Tests sur une vraie base : chaque parcours, le refus avant vérification, un lien réutilisé,
      la suppression qui emporte les élèves, l'expéditeur Scaleway contre un faux serveur HTTP.

## Hors périmètre

Changement d'adresse du gardien et second gardien (lot 3) ; table d'envois et alertes au parent
(lot 3) ; pages du web pour ces liens (étape 6) ; compte Scaleway et DNS (Victor, étape 7).

## Vérification de bout en bout

`bun run test` ; contre le serveur lancé sur une base jetable : inscription, lien journalisé,
vérification, connexion ; réinitialisation ; suppression qui emporte un élève relié.

## Décision humaine

Fournisseur choisi le 2026-10-07 (choix délégué par Victor) ; « go » sur la suite de l'étape 4 le
même jour.
