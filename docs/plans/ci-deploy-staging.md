# Plan — Déployer le staging chez Clever Cloud

## Problème

Le staging existe chez Clever Cloud (application `tomai-staging`, base `tomai-staging-db`, domaine
`staging.tomia.fr`) mais rien n'y est déployé. Sa base présente un certificat auto-signé, que
`verify-full` contre les autorités du système refuse : le serveur ne s'y connecterait pas.

## Critères d'acceptation

- [ ] `DATABASE_CA` (PEM) épingle le certificat de la base, nom d'hôte vérifié ; sans lui, rien ne
      change. Un serveur sans TLS est refusé dès qu'un certificat est épinglé.
- [ ] Le job `image` publie le digest de l'image ; `deploy-staging`, après `ci-ok` et seulement sur
      `main`, déploie cette image par son digest avec `clever-tools`, dans l'environnement GitHub
      `staging`.
- [ ] `docs/suivi.md` décrit ce qui existe, ce qui reste et le jeton qui expire.

## Hors périmètre

La production, la landing chez Clever Cloud, le réseau privé (Network Groups), le PITR.

## Vérification de bout en bout

Avant le merge : typecheck, lint, tests, actionlint ; la connexion TLS à la base de staging testée
avec le certificat épinglé (refusée sans lui, refusée sur un autre nom d'hôte). Après le merge : le
job déploie, `https://staging.tomia.fr/health/ready` répond 200, puis le parcours d'inscription sur
invitation dans Chrome.

## Décision humaine

Victor, 2026-10-08 : staging chez Clever Cloud, `main` seule, déployé à chaque merge.
