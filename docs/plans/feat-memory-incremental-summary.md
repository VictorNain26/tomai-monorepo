# Plan — feat/memory-incremental-summary

Lot 2, point 7 (`docs/roadmap.md`), troisième et dernière PR : la mémoire. Décisions :
`docs/etudes/2026-10-04/refonte-agent.md` (« Résumé incrémental, qui sert aussi d'épisode. Les
épisodes se récupèrent une fois par séance, pas à chaque message » ; « Le résumé renvoie toute
la conversation à chaque relance »), `docs/agent.md` § 13. Chemins relatifs à `apps/server/src/`.

## Constat (code du 2026-10-05)

- `summarization.service.ts` : à chaque relance, tous les messages sauf les dix derniers
  partent au modèle, avec l'ancien résumé ; le prompt incrémental garde des gabarits
  `{previousSummary}` et `{newMessages}` jamais remplis. Lancé après chaque tour, il charge
  aussi tous les messages de la séance dès qu'elle en compte vingt, pour compter les nouveaux.
- `episodic-memory.service.ts` : l'épisode d'une séance close relit toute la conversation
  (20 000 caractères) dans un appel à part, sans le résumé déjà fait.
- `chat-orchestration.service.ts` : les épisodes passés sont cherchés à chaque message, un
  embedding et une recherche vectorielle par tour, avec le message courant pour requête :
  le bloc change d'un tour à l'autre.

## Tâches

1. **Résumé incrémental** : l'ancien résumé et les seuls messages venus après lui, hors des
   dix derniers ; le nombre de nouveaux messages compté en base, sans charger la séance ;
   prompt sans gabarits, contenu dans le message ; version datée.
2. **Épisode tiré du résumé** : à la clôture, l'extraction lit le résumé et les messages
   qu'il ne couvre pas encore, plus la conversation entière ; version datée.
3. **Épisodes une fois par séance** : au premier tour, la recherche part du premier message ;
   le bloc trouvé, ou son absence, est gardé sur la séance (colonne
   `study_sessions.recalled_episodes`, migration) et relu aux tours suivants.
4. **Tests** : relance qui n'envoie que les nouveaux messages ; seuil compté sans charger la
   séance ; épisode tiré du résumé et de la fin ; épisodes cherchés au premier tour seulement,
   relus ensuite, absence gardée.
5. `docs/suivi.md`, `docs/agent.md` si la mémoire y est décrite autrement.

## Hors périmètre

- Quotas et coût de ces appels : point 8.

## Validation

`bun run typecheck`, `bun run lint`, `bunx knip`, `bun run test`, `db:check`,
`bun run test:integration`.
