# Plan — Bêta fermée : un compte parent sur invitation

## Problème

Le staging Clever Cloud (étape 7) sera joignable de tous sur `*.cleverapps.io`. Avec l'inscription
libre, n'importe qui y crée un compte, dépense le budget Mistral et peut y saisir les données d'un
vrai enfant, sur un serveur qui n'est pas en règle pour ça. La production naîtra elle aussi en bêta
fermée.

## Critères d'acceptation

- [ ] Une adresse invitée crée son compte une fois ; l'invitation est consommée.
- [ ] Une adresse sans invitation, ou dont l'invitation a expiré (30 jours), reçoit un 403
      `INVITATION_REQUIRED`, qu'un compte existe déjà ou non : la réponse ne révèle aucun compte.
- [ ] L'adresse se compare en minuscules, comme better-auth la stocke.
- [ ] `bun run invite <adresse>` (`bun dist/invite.js` dans l'image) crée l'invitation ; même
      règle d'environnement que `migrate.ts`.
- [ ] Le web le dit sur `/inscription` et traduit l'erreur.
- [ ] Les tests du serveur et la suite e2e invitent avant d'inscrire.
- [ ] `docs/suivi.md` : staging, bêta fermée.

## Hors périmètre

Le déploiement du staging (étape 7) ; un écran d'administration des invitations ; l'envoi de
l'invitation par e-mail (Victor prévient la famille lui-même).

## Vérification de bout en bout

`bun run typecheck && bun run lint && bun run test`, la suite e2e du web, puis dans Chrome : une
adresse non invitée refusée, une adresse invitée par la commande inscrite.

## Décision humaine

Victor, 2026-10-07 : staging en bêta fermée, inscription sur invitation (« go »).
