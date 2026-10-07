# Plan — étape 4, première PR, reprise : l'élève en mode guidé et le jumelage d'appareil

Étude : `docs/etudes/2026-10-07/foyer-eleve-age.md`, § 7, modèle validé par Victor le 2026-10-07
(#426). Branche `feat/household-accounts` (#425), `main` fusionné à `0ce68dc6`.

## Pré-vol (better-auth 1.7.5 installé)

- `one-time-token` partage une session existante vers un autre appareil, et `device-authorization`
  (RFC 8628) donne la session à celui qui approuve, le parent : aucun des deux n'ouvre une session
  pour l'élève. Un plugin à nous, fait des briques de better-auth : `createAuthEndpoint`
  (`better-auth/api`), `internalAdapter.createVerificationValue` et `consumeVerificationValue`
  (usage unique), `internalAdapter.createSession`, `setSessionCookie` (`better-auth/cookies`),
  `rateLimit.customRules`.
- La migration `0001_household`, jamais mergée ni appliquée hors des bases de test, se régénère.

## Problème

#425 donne à l'élève un nom d'utilisateur et un mot de passe choisis par le parent : le parent
peut se connecter comme son enfant et lire ses conversations, ce que le modèle validé exclut.

## Critères d'acceptation

- [ ] Plus de nom d'utilisateur ni de mot de passe d'élève, ni de plugin `username` : l'élève est
      un profil (prénom ou pseudonyme, niveau, mois de naissance) sans identifiant.
- [ ] Le gardien obtient pour son élève un code de jumelage : court, à usage unique, valable
      10 minutes, haché par better-auth (`verification.storeIdentifier`). Pas d'annulation du code
      précédent : il faudrait un pointeur qui garde le code en clair, pour un code qui expire seul.
- [ ] L'appareil de l'élève échange le code contre sa propre session (cookie de better-auth) ;
      un code faux, expiré ou déjà servi est refusé ; l'échange est limité en débit.
- [ ] Le gardien liste les appareils de son élève et en déconnecte un ; l'élève liste ses
      appareils. Revue : qui tient le code peut l'échanger, le gardien compris ; la garantie est que
      tout appareil relié est une session que l'élève voit dans sa liste, pas une impossibilité.
- [ ] La matrice d'accès couvre les nouvelles routes ; le garde de l'élève autorise
      `get-session`, `sign-out`, `list-sessions` et l'échange du code.

## Hors périmètre

Le profil protégé par un code de l'enfant sur l'appareil du parent (avec les écrans, étape 6) ;
la notification à l'élève d'un nouvel appareil (écrans, étape 6 : la donnée est la liste des
sessions) ; l'e-mail des gardiens (PR suivante).

## Vérification de bout en bout

`bun run test` ; contre le serveur lancé sur une base jetable : un gardien crée un élève, obtient
un code, l'appareil de l'élève l'échange, le code ne sert pas deux fois, le gardien voit l'appareil
et le déconnecte, la session de l'élève tombe.

## Décision humaine

Modèle validé par Victor le 2026-10-07 (#426) ; « go » sur la reprise le même jour.
