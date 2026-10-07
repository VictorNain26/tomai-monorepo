# Plan — le foyer et le jumelage de l'appareil (étape 6, PR 6b)

Pré-vol (2026-10-07) : l'API du foyer est faite (`/api/household`, #424-#425) et le web a son
client typé et la connexion du gardien (#438). Le jumelage s'échange par
`POST /api/auth/device-pairing/redeem`, un plugin better-auth du serveur : le client l'infère par
`$InferServerPlugin` (better-auth.com/docs/concepts/plugins), son type passant par le contrat.
Dépendance vérifiée le 2026-10-07 : `bowser` 2.14.1, MIT, dernier commit le 2026-09-27, 5,7 k
étoiles, 77 M de téléchargements par semaine, des issues fermées en septembre, pour nommer un appareil
d'après son user-agent (`ua-parser-js` 2 est sous AGPL).

## Problème

Victor ne peut pas encore créer le compte de son enfant ni relier son appareil : le parcours qui
mène au chat (PR 6c) commence ici.

## Critères d'acceptation

- [ ] `/foyer` : les enfants du foyer, et l'ajout d'un enfant (prénom, classe, mois de naissance).
- [ ] `/foyer/$studentId` : changer le prénom ou la classe, supprimer l'enfant après confirmation dans
      la page ; demander un code de jumelage, montré avec son heure de fin et où le saisir ; les
      appareils reliés, chacun déconnectable.
- [ ] `/jumeler` : l'appareil de l'enfant échange le code et ouvre sa session ; un lien depuis
      `/connexion`.
- [ ] L'accueil de l'élève montre ses appareils reliés : ce qui rend visible tout jumelage.
- [ ] Les classes du formulaire suivent le type du serveur ; aucun type du serveur réécrit.
- [ ] Parcours prouvés à largeur de téléphone, WebKit et Chromium : gardien qui crée l'enfant et
      demande un code, appareil qui l'échange, gardien qui le voit puis le déconnecte.

## Hors périmètre

Le chat et les séances : PR 6c. Signaler à l'élève un nouvel appareil relié : reste dans
`docs/suivi.md`.

## Vérification de bout en bout

`bun run typecheck && bun run lint && bun run test`, la suite Playwright du web.
