# Plan — le client typé et la connexion du gardien (étape 6, PR 6a)

Pré-vol (2026-10-07) : `apps/web` n'est qu'un squelette (une page). La cible
(`docs/architecture.md`, « Client web ») : client typé de `hono/client` sur un contrat que le
serveur émet (`contract.ts`, seul point d'entrée de `build:types`), TanStack Query,
react-hook-form et Zod, primitives `@repo/ui`. Les émissions de déclarations passent du premier
coup (routes typées, aucun `any`). Dépendances vérifiées le 2026-10-07 : `@tanstack/react-query`
5.104.1 (82,8 M de téléchargements par semaine), `better-auth` 1.7.7 (12,6 M), `react-hook-form`
7.89.0 (70,3 M), `@hookform/resolvers` 5.9.1 (58,7 M), `hono` 4.13.13 (85,9 M). Sans direction
visuelle avant le lot 4 : les tokens actuels, les composants de base.

## Problème

Victor ne peut rien essayer : aucun écran n'appelle le serveur. Le premier parcours est celui du
gardien, qui ouvre le compte d'où naît tout le reste.

## Critères d'acceptation

- [ ] `apps/server` émet `dist/types/contract.d.ts` (`build:types`), que turbo construit avant le
      typecheck et le lint du web ; aucun type du serveur réécrit côté client.
- [ ] `GET /api/me` : qui est connecté et son rôle, pour aiguiller l'accueil.
- [ ] Écrans du gardien : inscription (puis « vérifiez votre e-mail »), connexion, mot de passe
      oublié, nouveau mot de passe, page d'erreur de connexion (`onAPIError.errorURL`, la page
      de better-auth ayant un style en ligne que la CSP bloque) ; déconnexion.
- [ ] Messages d'erreur en français, jamais le message interne du serveur.
- [ ] Parcours prouvés à largeur de téléphone, WebKit et Chromium (`tooling/playwright-web`).

## Hors périmètre

Le foyer (élèves, code de jumelage) : PR 6b. Le jumelage de l'appareil et le chat : PR 6c.

## Vérification de bout en bout

`bun run typecheck && bun run lint && bun run test`, la suite Playwright du web.

## Décision humaine

Étape 6 sur les composants de base, sans travail de style : Victor, 2026-10-07.
