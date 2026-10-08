# Plan — Une entrée sans mot de passe pour le parent

## Problème

S'inscrire demande aujourd'hui un mot de passe à inventer, un lien de confirmation à ouvrir, puis
une connexion ; se reconnecter, un mot de passe à retenir. Chaque étape perd des familles. Une
connexion Google l'éviterait mais ferait savoir à une société américaine qui utilise Tom
(`etudes/2026-10-07/hebergement.md`) : Victor l'écarte le 2026-10-08.

## Critères d'acceptation

- [ ] Un seul parcours, « Continuer avec mon e-mail » : un code à 6 chiffres par e-mail (plugin
      `email-otp` de better-auth), valable 5 minutes, 3 essais, stocké haché ; le compte se crée à
      la première connexion, l'adresse vérifiée par le code.
- [ ] Une adresse sans compte ni invitation reçoit, au lieu d'un code, un e-mail qui explique la
      bêta fermée ; l'écran répond pareil dans tous les cas. Aucun compte ne se crée sans invitation
      valable, quel que soit le chemin (contrôle à la création de l'utilisateur).
- [ ] Un nouveau parent donne son prénom après sa première connexion.
- [ ] Supprimer son compte demande une session ouverte depuis moins de 10 minutes (`freshAge`).
- [ ] Plus de mot de passe : les routes e-mail et mot de passe de better-auth, les écrans
      `/inscription`, `/mot-de-passe-oublie`, `/nouveau-mot-de-passe` et le lien de confirmation
      disparaissent.
- [ ] Tests du serveur et e2e réécrits sur le code ; `docs/suivi.md` à jour.

## Hors périmètre

Les passkeys (PR suivante, après vérification de `@better-auth/passkey`) ; l'écran de suppression du
compte parent, qui n'existe pas encore côté web ; l'appareil de l'élève, inchangé.

## Vérification de bout en bout

typecheck, lint, tests du serveur, e2e du web ; dans Chrome en local, un parent invité entre par son
code, donne son prénom, arrive sur son foyer ; une adresse non invitée reçoit l'e-mail de bêta
fermée. Puis le même parcours sur le staging, par Victor.

## Décision humaine

Victor, 2026-10-08 : pas de Google, une inscription sans friction, code par e-mail puis passkeys.
