# Plan — les séances du tuteur (étape 5, PR 3a)

Pré-vol (2026-10-07) : l'ancien schéma (`050d2a63`, `session.schema.ts`, `exercise-sheet.schema.ts`,
`distress.schema.ts`) se réécrit sur le foyer : la séance appartient à l'élève, la détresse est
rattachée à l'élève, la séance en `SET NULL`, sans score stocké (décision 7 de Victor). Le web
n'a pas encore d'écran de chat : l'API part du parcours de l'élève (ouvrir une séance, retrouver
les siennes, relire une conversation). Arbitrages : le tuteur lit le profil de l'élève par
l'`index.ts` du foyer ; le schéma du tuteur peut lire les types de son `core/` ; l'aide de test
HTTP du foyer passe dans `testing/`, partagée.

## Problème

Le tour du tuteur (PR 3b) écrit dans une séance, garde ses messages, l'exercice en cours et la
détresse qui ferme une séance. Ces données et leurs accès viennent d'abord, testés sur une vraie
base, sans modèle.

## Critères d'acceptation

- [ ] Tables `study_session`, `message`, `exercise`, `distress_event`, une migration générée.
- [ ] `POST /api/sessions`, `GET /api/sessions`, `GET /api/sessions/:id/messages`, réservées à
      l'élève connecté ; un gardien, un anonyme et un autre élève refusés, la propriété dans la
      requête SQL.
- [ ] L'exercice en cours se lit et s'écrit dans la forme de `core/exercise-turn.ts`.
- [ ] Une matrice d'accès croisés sur une vraie base.

## Hors périmètre

Le tour en flux, le prompt, l'enregistrement de tour : PR 3b. Les durées de conservation et leur
purge : préproduction.

## Vérification de bout en bout

`bun run typecheck && bun run lint && bun run test`, knip et `db:check` verts.

## Décision humaine

Étape 5 validée par Victor le 2026-10-06, décision 7 comprise ; découpage délégué le 2026-10-07.
