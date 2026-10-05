# Plan — feat/agent-distress-input-moderation

Lot 2, point 6 (`docs/roadmap.md`) : détresse et modération d'entrée. Décisions et sources :
`docs/etudes/2026-10-04/refonte-agent.md` (« À chaque tour », 1), `docs/agent.md` § 5. Chemins
relatifs à `apps/server/src/`.

## Réponse fixe

Approuvée par Victor le 2026-10-05, telle quelle :

> Ce que tu écris m'inquiète, et c'est important d'en parler à quelqu'un dès maintenant. Je suis
> une intelligence artificielle : je ne peux pas t'aider comme une personne le ferait.
>
> Tu peux appeler le **3114**, gratuitement, à toute heure du jour et de la nuit : des
> professionnels sont là pour t'écouter.
> Si tu es en danger tout de suite, appelle le **15** ou le **112**.
> Parles-en aussi à un adulte de confiance : un parent, un professeur, l'infirmière ou le CPE de
> ton collège.
>
> J'arrête notre conversation ici pour que tu puisses le faire.

Numéros vérifiés sur service-public.fr (https://www.service-public.gouv.fr/particuliers/vosdroits/F33954)
et 3114.fr. La phrase « ton parent sera prévenu » attend l'alerte du lot 3.

## Mesure préalable (2026-10-05, appel réel)

`selfharm` de `mistral-moderation-2603`, message de l'élève après une relance du tuteur :
signale « j'ai envie de disparaître » (0,35, la phrase de S5), « j'ai envie de mourir »,
« je veux en finir », « je pense à me suicider », « je vais me tuer si… » ; laisse passer « je me
fais du mal quand je rate » (0,01), « j'ai plus envie de vivre » (0,19), « personne m'aimerait si
je disparaissais » (0,14). Aucune fausse alerte sur « ce devoir me tue », « mort de rire », « le
suicide de Roméo et Juliette », « mourir de honte ».

## Tâches

1. **Détresse**, `modules/tutor/distress.ts` : le drapeau `selfharm` de Mistral ou des règles en
   français, à la première personne, testées sur des phrases d'élèves (les trois manquées
   ci-dessus et leurs variantes ; les fausses alertes à éviter).
2. **Modération d'entrée** : `classifiers.moderateChat` sur le message de l'élève, le dernier du
   tuteur pour contexte, en parallèle de l'analyse du tour, avant toute autre préparation.
   - Les catégories `sexual`, `jailbreaking`, `pii`, `violence_and_threats`, `dangerous`,
     `criminal` sont gardées avec le message pour la mesure, sans bloquer : un devoir d'histoire
     touche à la violence, et l'injection reste du texte de l'élève, que le contrat, le contrôle
     et la modération de sortie encadrent (S6).
   - Modération indisponible : les règles seules jugent la détresse, l'échec est journalisé.
3. **Sur une détresse** : ni analyse, ni fiche, ni modèle ; la réponse fixe est envoyée et gardée
   avec le message, l'événement est enregistré (table `distress_events`, pour l'alerte au parent
   du lot 3), la séance passe à `completed`. Un message suivant dans cette séance reçoit la même
   réponse fixe.
4. **Tests** : règles (positifs, négatifs), détresse par Mistral ou par les règles, modération
   indisponible, tour de détresse de bout en bout (réponse, persistance, événement, séance
   close, message suivant) ; un appel réel sur la phrase de S5.

## Hors périmètre

- Alerte au parent et phrase qui l'annonce : lot 3.
- Premier passage annoncé (S4, S5, S6 lus par le code) : juste après cette PR.

## Validation

`bun run typecheck`, `bun run lint`, `bunx knip`, `bun run test`, `db:check` ;
`bun run test:live` une fois.
