# Plan — le tour du tuteur (étape 5, PR 3b)

Pré-vol (2026-10-07) : l'ancien tour (`050d2a63`, `chat-orchestration.service.ts`,
`controlled-turn.ts`, `chat-message.routes.ts`) tenait le flux du modèle en entier avant de le
contrôler, et passait par `streamText` pour ses outils. Sans outils ni cartes (elles reviennent
plus tard), un appel non streamé suffit : le texte contrôlé part dans le flux UI que lit `useChat`,
et `keepAliveMs` d'`ai` 7 garde la connexion ouverte au-delà du délai d'inactivité de Bun. Le
prénom de l'élève sort du prompt système (cible de la refonte : aucun texte du client). Le résumé
de séance et le titre viennent après : la fenêtre garde les vingt derniers messages.

## Problème

Le tuteur ne répond encore à personne : les étapes existent (PR 2b), les séances aussi (PR 3a),
pas le tour qui les enchaîne, l'envoie à l'élève et l'enregistre.

## Critères d'acceptation

- [ ] `POST /api/sessions/:id/messages` : un tour, refusé avant tout modèle à un anonyme, à un
      gardien, à un autre élève, à un message vide ou trop long, et quand un tour court déjà.
- [ ] Le tour : modération et analyse en parallèle, détresse d'abord (réponse fixe, événement
      unique, séance close), exercice, rédaction contrôlée (une régénération, puis le repli),
      messages et enregistrement du tour en une transaction.
- [ ] L'enregistrement du tour ne garde aucun mot de l'élève ni du tuteur : décisions, versions,
      constats, issue.
- [ ] Une panne de Mistral : un message générique à l'élève, la séance libérée.
- [ ] Tests de bout en bout par HTTP sur une vraie base contre le faux Mistral.

## Hors périmètre

Résumé de séance et titre, quota par élève (PR 4), outils et cartes, photo et voix (lot 3).

## Vérification de bout en bout

`bun run typecheck && bun run lint && bun run test`, knip et `db:check` verts.

## Décision humaine

Étape 5 validée par Victor le 2026-10-06 ; découpage délégué le 2026-10-07.
