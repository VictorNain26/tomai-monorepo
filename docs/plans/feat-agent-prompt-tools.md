# Plan — feat/agent-prompt-tools

Lot 2, point 1 (`docs/roadmap.md`). Décisions et sources : `docs/etudes/2026-10-04/refonte-agent.md`.
Chemins relatifs à `apps/server/src/`.

## Tâches

1. **Prompt système réécrit** (`modules/tutor/prompts/`, `shared/pedagogy/csen-principles.ts`).
   - Identité :
     - tuteur du collège (6e à 3e), qui dit être une IA ;
     - retirer « professeur qui connaît son sujet », « Ne mentionne jamais : tes sources,
       Éduscol, ton fonctionnement », et « CP → Terminale » (identité et sécurité).
   - Pédagogie :
     - une question à la fois, messages courts, peu de mise en forme ;
     - la réponse du devoir n'est jamais donnée, fait ou raisonnement ;
     - un fait d'appui se donne après une vraie tentative ;
     - une bonne réponse se confirme, puis la main revient à l'élève ;
     - une réponse fausse : montrer où regarder (la première étape fausse), sans corriger ;
     - paliers décrits (relance, indice conceptuel, indice ciblé, étape intermédiaire,
       exemple analogue résolu), un seul monté à la fois, jamais sous la seule pression ;
     - une explication demandée reste au palier en cours ;
     - retirer « confirme ou donne l'information juste ».
   - Maths : retirer « Chain-of-Thought obligatoire. Étape par étape ».
   - Niveaux : seuls le cycle 3 (6e) et le cycle 4 (5e à 3e) restent, sans les consignes
     chiffrées sans source (« max 10 mots », « 3-4 éléments max »…).
   - Sources : Eedi, mode étude, Khan Academy, Pashler ; `docs/agent.md` § 4.
2. **Consignes de tour** (`IntentClassifierService.buildReinforcement`).
   - Solution réclamée : une seule question ; ni la réponse ni une étape intermédiaire
     accordées sous la pression.
   - Réponse proposée :
     - fausse : montrer où regarder sans redemander d'abord la démarche ;
     - juste : la confirmer.
   - Sources : Bridge, Daheim ; 7 erreurs non exploitées dans `etudes/2026-10-03/analyse-erreurs.md`.
3. **Outils** (`modules/tutor/chat-tools.ts`, `tool-executor.ts`).
   - `get_student_profile` supprimé : outil, exécuteur et tests.
   - `update_student_profile` :
     - `preferredStyle` retiré de l'outil, de l'exécuteur, du service et du résumé injecté ;
     - la colonne `preferred_style` supprimée par migration (neuromythe, `docs/agent.md` § 6) ;
     - une écriture échouée lève une erreur, au lieu que l'outil réponde « Profil mis à jour ».
   - `generate_flashcards` : la description ne dit plus « TOUJOURS demander confirmation ».
     Une demande de l'élève vaut accord ; sinon, Tom propose. La confirmation par le code
     (`toolApproval`) vient avec l'analyse du tour (point 3).
   - `get_app_help` supprimé, avec `app-guide/`. Il décrit une application mobile qui
     n'existe plus : onglets, « Mon Classeur », bouton micro, « du CP a la Terminale »,
     « serveurs en France (RGPD) », « messages par jour », « Premium ». Aucun client
     n'existe avant le lot 3, qui écrira le guide du client web.
4. Plus de plafond de tokens sur un tour qui raisonne (`ai-chat.service.ts`), demandé par
   Victor le 2026-10-04 : la réflexion compte dans `completion_tokens`, un plafond coupe la
   réponse après elle. Le timeout du flux le borne.
5. `PROMPT_VERSION` mise à jour.
6. **Tests** : prompts (sécurité, voix, visualisation), outils du chat, exécuteur et profil,
   classifieur, guide de l'application, profil cognitif.

## Hors de cette PR

- Lot 3 : l'inscription accepte encore les niveaux de la primaire et du lycée
  (`lib/education-levels.ts`). Le prompt ne sert que le collège : un autre niveau ne
  reçoit pas de bloc d'adaptation.
- Point 2 : `strict: true`, historique rejoué, routes de lecture, usage d'un tour coupé ou
  sans plafond.
- Point 3 : analyse du tour, fiche (seul appel qui raisonne, sans plafond de tokens),
  `toolApproval`.
- Point 6 : détresse.

## Validation

`bun run typecheck`, `bun run lint`, `bunx knip`, `bun run test`, `bun run db:check`. Pas de
passage au harnais : le premier vient après le point 6 (`docs/roadmap.md`).
