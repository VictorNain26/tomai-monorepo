# Plan — Entrer avec une clé d'accès

Écarts du pré-vol : le plugin exige `better-auth` ^1.7.7 (monté depuis 1.7.5, correctifs sans
migration) ; `@simplewebauthn/server` déclaré pour que `build:types` nomme ses types ; l'élève est
déjà refusé par `studentAuthGuard`, sans hook de plus ; une clé porte le nom de l'appareil où elle
est créée, son user agent posé par le serveur (`afterVerification`) et lu par `deviceName`, l'AAGUID
étant nul chez Apple ; un nom envoyé par le client remplacerait l'adresse dans la liste du navigateur.

## Problème

Le parent entre par un code à 6 chiffres reçu par e-mail (#452) : à chaque connexion, il quitte
l'app pour sa boîte, attend le message, recopie le code. Une clé d'accès (passkey, WebAuthn)
l'ouvre d'un geste, par le déverrouillage de son téléphone, sans rien qui transite par l'e-mail ni
par une société tierce. Décision de Victor du 2026-10-08 (`suivi.md`, « Entrée sans mot de passe »).

`@better-auth/passkey` vérifié le 2026-10-08 : 1.7.7 publiée le 2026-09-30, alignée sur
`better-auth` 1.7.x, dépôt non archivé et actif, ~2,1 M téléchargements par semaine
([doc](https://better-auth.com/docs/plugins/passkey)).

## Critères d'acceptation

- [ ] Le serveur a le plugin `passkey()`, `rpID` et `origin` tirés de `publicUrl`, la table
      `passkey` dans `platform/auth/schema.ts` et sa migration.
- [ ] Seul un gardien enregistre une clé : le garde du foyer (`studentAuthGuard`) refuse déjà à un élève
      toute route de better-auth hors de sa liste ; un test le prouve pour les clés,
      sans quoi une clé contournerait le jumelage de son appareil par le parent.
- [ ] Sur `/connexion`, le champ d'adresse propose les clés du navigateur (`autocomplete="username
      webauthn"`, saisie conditionnelle), et un bouton « Entrer avec une clé d'accès » ; le code
      par e-mail reste, pour un appareil perdu ou neuf.
- [ ] Sur `/foyer`, une section « Vos clés d'accès » : en créer une, voir celles qui existent (nom
      de l'appareil par son AAGUID, date), en supprimer une.
- [ ] Erreurs du plugin traduites dans `authMessage` ; une annulation du navigateur n'affiche rien.
- [ ] Tests serveur : refus pour l'élève, enregistrement puis liste pour le gardien, suppression du
      compte qui emporte ses clés. e2e : l'authentificateur virtuel de Chromium (CDP
      `WebAuthn.addVirtualAuthenticator`) crée une clé puis entre avec.

## Hors périmètre

- Une clé pour l'élève : son appareil reste relié par le code du parent.
- Proposer la clé ailleurs que sur `/foyer` (après `/bienvenue`, par exemple) : à revoir avec le
  parcours parent du lot 3.

## Vérification de bout en bout

`bun run test` et la suite `tooling/playwright-web`, puis sur le staging, dans Chrome : entrer par
le code, créer une clé, se déconnecter, entrer par la clé.

## Décision humaine

Validé par Victor le 2026-10-08 (« go »), en parallèle de son test d'inscription sur le staging.
