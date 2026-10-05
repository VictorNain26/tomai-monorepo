# Plan — feat/agent-output-moderation

Lot 2, point 5, seconde PR (`docs/roadmap.md`) : la modération de sortie, et les contrôles avant
l'élève portés sur les fiches de révision et le titre de séance. Décisions et sources :
`docs/etudes/2026-10-04/refonte-agent.md` (« À chaque tour », 7), `docs/agent.md` § 5. Chemins
relatifs à `apps/server/src/`.

## Modération

- `mistral-moderation-2603`, « Free » (https://docs.mistral.ai/models/model-cards/mistral-moderation-26-03),
  servi sur l'endpoint UE (appel réel du 2026-10-05). `classifiers.moderateChat` classe la
  réponse avec le message de l'élève pour contexte ; `classifiers.moderate`, des textes seuls.
- 11 catégories rendues, chacune avec un score et un drapeau au seuil de Mistral, « determined
  based on the optimal performance of our internal test set »
  (https://docs.mistral.ai/studio/safety-moderation). Sans mesure propre, le drapeau de Mistral
  fait foi ; les scores sont journalisés pour régler des seuils plus tard.
- Bloquent une sortie : `sexual`, `hate_and_discrimination`, `violence_and_threats`, `dangerous`,
  `criminal`, `selfharm`. Ne bloquent pas : `health`, `financial`, `law` (un cours de SVT ou
  d'EMC y touche), `pii` (le tuteur appelle l'élève par son prénom), `jailbreaking` (il porte
  sur l'entrée, point 6).
- Modération indisponible : rien n'atteint l'élève sans contrôle, la réponse de repli part.

## Tâches

1. **Message** : la modération tourne avec les contrôles déterministes, sur le premier texte
   et sur la régénération ; un blocage déclenche la même suite (régénération sous contrainte,
   puis repli), gardée avec le message.
2. **Fiches de révision** : avant leur enregistrement, chaque carte passe les contrôles
   (réponse de l'exercice en cours et ses formes, balises, égalités, modération) ; une carte
   qui échoue est écartée, et sans carte restante l'outil le dit au modèle. Même contrôle sur la
   génération hors conversation (`POST /api/learning/generate`), sans exercice.
   - `collectStrings` (texte d'une carte, sans ses index) passe d'`eval/turn-parts.ts` à `lib/`.
   - Le filtre vit dans `learning/card-check.ts` : `tutor` importe déjà `learning`, l'inverse
     ferait un cycle ; l'appelant lui donne sa vérification déterministe. Hors conversation,
     balises et égalités ; sans carte restante, la route répond 422.
3. **Titre de séance** : contrôlé de même avant d'être enregistré ; refusé, la séance garde son
   titre par défaut.
4. **Tests** : catégories bloquantes ou non, indisponibilité, message bloqué puis régénéré,
   cartes écartées, titre refusé ; un appel réel vérifie la forme de la réponse de modération.

5. **Ce que la revue a ajouté** :
   - les cartes ne passent plus par les égalités (un énoncé vrai-faux, une erreur fréquente, une
     option fausse le sont exprès) ; une forme de moins de trois caractères ne compte pas sur une
     carte ;
   - une réponse de modération incomplète vaut indisponibilité ; un tour sans texte (une photo)
     modère la réponse seule ;
   - le titre du paquet est contrôlé comme celui de la séance ;
   - une modération indisponible sur les cartes se distingue d'un refus (erreur transitoire, 503).

## Validation

`bun run typecheck`, `bun run lint`, `bunx knip`, `bun run test` ; `bun run test:live` une fois.
