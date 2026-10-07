# Plan — le résumé de séance et le titre (étape 5, PR 5)

Pré-vol (2026-10-07) : l'ancien code (`050d2a63`, `summarization.service.ts`,
`auto-title.service.ts`) lançait les deux en tâche perdue à l'arrêt (défaut noté par l'audit de
la refonte), et le titre collait le message de l'élève dans son prompt. Ici, les deux passent par
le registre des tâches de fond (`platform/lifecycle/background.ts`), que l'arrêt attend ; le
message de l'élève reste délimité ; le titre est contrôlé comme une réponse du tuteur.

## Problème

Le tour ne lit que les vingt derniers messages : une séance longue perd son début, et une séance
n'a pas de titre pour se retrouver dans la liste.

## Critères d'acceptation

- [ ] Résumé incrémental : l'ancien résumé et les seuls messages qu'il ne couvre pas, dès que
      vingt attendent, les dix derniers gardés tels quels ; deux résumés lancés ensemble n'en
      écrivent qu'un.
- [ ] Le tour lit le résumé et les messages qui le suivent.
- [ ] Titre après le premier tour, contrôlé (réponse, balises, égalités, modération) avant d'être
      gardé ; un titre retenu n'est pas écrit.
- [ ] Les deux comptés dans le quota de l'élève, attendus par l'arrêt du serveur.

## Hors périmètre

Le titre modifiable par l'élève, l'affichage dans le web (étape 6).

## Vérification de bout en bout

`bun run typecheck && bun run lint && bun run test`, knip et `db:check` verts.

## Décision humaine

Étape 5 validée par Victor le 2026-10-06 ; découpage délégué le 2026-10-07.
