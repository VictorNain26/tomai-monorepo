# Plan — feat/agent-turn-history

Lot 2, point 2, première PR (`docs/roadmap.md`) : le socle du tour. Décisions et sources :
`docs/etudes/2026-10-04/refonte-agent.md` (« Contexte et mémoire »). Chemins relatifs à
`apps/server/src/`. La seconde PR du point 2 porte les outils stricts, les renommages de
l'AI SDK 7 et l'usage d'un tour coupé.

## Tâches

1. **Historique rejoué tel que le modèle l'a produit.**
   - Les messages de réponse du tour (`responseMessages` de `streamText`, `ai` 7.0.107),
     raisonnement et appels d'outils compris, sont gardés avec le message de l'assistant,
     dans une colonne `model_messages` (migration).
   - Ils sont rejoués tels quels au tour suivant, au lieu du texte seul. Un message ancien,
     sans cette colonne, se rejoue en texte.
   - Source : https://docs.mistral.ai/studio/conversations/reasoning, « always replay the
     full assistant message (including `ThinkChunk`) ».
   - Le message de l'élève se rejoue sans les blocs du serveur de son tour.
2. **Routes de lecture** (`/chat/session/:id/history`, `/chat/message/:id`) : elles ne rendent
   que le texte vu par l'élève ; un test vérifie qu'aucun raisonnement ni appel d'outil n'en
   sort.
3. **Un seul message `user` par tour** (`chat-message-assembler.ts`).
   - Le contexte de l'élève, les fichiers joints, la consigne du tour, le marqueur `[VOCAL]`
     et le bloc de la matière deviennent des blocs balisés de ce message, avant le texte de
     l'élève entre `<student_message>`.
   - Le résumé rejoint le premier message de l'élève dans la fenêtre, ou le message courant
     si la fenêtre est vide.
   - Source : https://docs.mistral.ai/studio/conversations/chat-completion/prompting ; les
     rôles y alternent toujours.
4. **Préfixe stable.**
   - Le bloc de la matière quitte le prompt système pour le message courant : la matière
     peut changer d'un tour à l'autre sans casser le cache de l'historique.
   - Le prompt système ne dépend plus que de l'élève et de sa classe.
5. **Tests** : assembleur, rejeu, routes de lecture, enregistrement des messages de réponse.

## Validation

`bun run typecheck`, `bun run lint`, `bunx knip`, `bun run test`, `bun run db:check`. Pas de
passage au harnais.
