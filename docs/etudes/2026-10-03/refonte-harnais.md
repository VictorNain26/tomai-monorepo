# Refonte du harnais d'évaluation — 2026-10-03

Instantané daté, jamais mis à jour. Il fixe la refonte du harnais
(`apps/server/src/eval/`) à partir de la documentation de Mistral et de Langfuse et des
travaux sur les juges LLM, après deux mesures du juge (`accord-juge.md`,
`reproductibilite-juge.md`).

**Contrainte de départ** : décision de Victor du 2026-10-03, Mistral Small 4
(`mistral-small-2603`) partout pour le texte, juge compris. Le juge note donc les réponses
de son propre modèle.

## Constats

### Le juge

- **Biais d'auto-préférence.** Un juge note mieux ses propres sorties. Sur des rubriques
  binaires, même objectives, il peut être « more than 50% more likely to incorrectly mark
  [rubrics] as satisfied when the output is their own » (Pombal, Rei, Martins, 2026,
  [arXiv 2604.06996](https://arxiv.org/abs/2604.06996)) ; l'ensemble de juges, qui
  l'atténue, nous est fermé.
- **Contre-mesures sans second modèle** :
  - fournir au juge une référence (la solution, l'erreur de l'élève) pour qu'il n'ait pas
    à résoudre l'exercice lui-même ; les critères et la référence pèsent sur la fiabilité
    (Yamauchi et al., [arXiv 2506.13639](https://arxiv.org/abs/2506.13639)) ;
  - décomposer chaque critère en questions oui/non, jugées une à une : CheckEval (EMNLP
    2025, [arXiv 2403.18771](https://arxiv.org/abs/2403.18771)) ; RocketEval (ICLR 2025,
    [arXiv 2503.05142](https://arxiv.org/abs/2503.05142)) atteint avec Gemma-2-2B une
    corrélation de 0,965 avec les préférences humaines.
- **Tirages multiples plutôt qu'un seul tirage déterministe** : « non-deterministic
  sampling improves alignment with human preferences over deterministic evaluation »
  (Yamauchi et al., même article). Notre mesure va dans le même sens : température 0 et
  graine ne donnent ni déterminisme ni validité (`reproductibilite-juge.md`).
- **Échelles à trois crans** : sur les tuteurs, le meilleur système du BEA 2025 atteint
  71,81 de macro-F1 sur l'identification d'erreur en trois classes et 58,34 sur le guidage
  (Kochmar et al., [arXiv 2507.10579](https://arxiv.org/abs/2507.10579)) : le cran
  intermédiaire est difficile à tenir, même pour des systèmes entraînés.
- **Raisonnement** : avec des critères clairs, « CoT reasoning offers minimal gains »
  (Yamauchi et al.) ; à mesurer comme variante, pas à activer d'office.
- **Citation exacte** : aucune étude ne la donne comme levier d'accord ; elle reste un garde
  contre les citations inventées.

### La mesure

- **Trop peu d'unités.** Exemple du manuel ATLAS.ti, d'après Krippendorff : 4 codes
  équiprobables, α minimal 0,800 au seuil de 5 %, 139 codages
  ([doc](https://doc.atlasti.com/ManualMac.v9/ICA/ICASampleSizeAndDecisionRules.html)).
  36 conversations et des critères sans variation ne permettent pas de conclure.
- **Prévalence déséquilibrée** : α s'effondre quand une valeur domine (neuf accords sur
  dix peuvent donner 0, `accord-juge.md`). Pour un contrôle oui/non, il faut des cas
  positifs et négatifs, et rendre compte aussi du taux de vrais positifs et de vrais
  négatifs.
- **Critères sans contre-exemples** : alignement, rédaction livrée, ton et niveau de
  langue ne varient pas dans le comportement réel de Tom. Il faut des cas construits, où
  une seule réplique du tuteur est modifiée pour violer un seul contrôle.

### Mistral (documentation lue le 2026-10-03)

- **Small 4** : 256 k de contexte, 0,15 $ par million de tokens en entrée, 0,60 $ en
  sortie, sorties structurées
  ([fiche](https://docs.mistral.ai/models/mistral-small-4-0-26-03)).
- **Cache** : par blocs de 64 tokens de préfixe commun, au dixième du prix ; la clé
  augmente les chances d'un hit sans le garantir
  ([doc](https://docs.mistral.ai/studio/conversations/advanced/prompt-caching)). Notre juge
  donne un schéma JSON différent à chaque critère ; si Mistral place le schéma en tête du
  prompt, comme le décrit sa page sur les sorties structurées
  ([doc](https://docs.mistral.ai/studio/conversations/structured-output/custom)), le
  préfixe commun est rompu à chaque appel, ce qui expliquerait les 14 % de cache mesurés.
  À vérifier par la mesure.
- **Graine** : « different calls will generate deterministic results »
  ([API](https://docs.mistral.ai/api/endpoint/chat)), contredit par notre mesure ; la page
  sur l'échantillonnage admet de « slight variances » à température 0
  ([doc](https://docs.mistral.ai/inference/sampling)).
- **Plusieurs tirages** : l'AI SDK ne lit que le premier choix d'une réponse
  (`@ai-sdk/mistral` 4.0.48) ; des tirages multiples sont des appels distincts, sur le même
  préfixe en cache.
- **Écartés** : l'API Batch (moitié prix, mais résultats sous 24 h et pas de relance de
  citation dans le même lot) ; les juges et l'Evaluation SDK de Mistral, réservés à
  l'offre Enterprise ([doc](https://docs.mistral.ai/studio/observability/evaluations)).

### Langfuse (documentation lue le 2026-10-03)

- **Dataset hébergé** : versions datées des items, scores du run stockés, vue de
  comparaison des runs ; les items de dataset échappent aux 30 jours d'accès de l'offre
  Hobby, pas les traces ni les scores
  ([datasets](https://langfuse.com/docs/evaluation/experiments/datasets),
  [rétention](https://langfuse.com/docs/administration/data-retention)). Sur des données
  locales, les évaluations du run ne sont pas stockées (SDK 5.11.1, `runEvaluations`
  envoyées seulement avec un `datasetRunId`).
- **Pas de répétitions dans un run** : un item n'apparaît qu'une fois par expérience
  ([modèle de données](https://langfuse.com/docs/evaluation/experiments/data-model)) ; une
  répétition est un run.
- **Juges gérés par Langfuse** : un évaluateur ne lit qu'une observation, sans appel par
  critère ni tirages multiples
  ([doc](https://langfuse.com/docs/evaluation/evaluation-methods/llm-as-a-judge)) ; le
  juge reste dans notre code.
- **Garde-fou en CI** : baseline approuvée et commitée, jamais générée depuis le candidat ;
  un cas qui passait et qui échoue fait échouer ; versions du jeu et du juge dans la
  baseline ([doc](https://langfuse.com/docs/evaluation/experiments/experiments-ci-cd)).
  L'action `langfuse/experiment-action` (16 étoiles, Node et `tsx`) ne passe pas le
  critère d'adoption ; un job GitHub Actions qui lit le code de sortie de `bun run eval`
  suit le schéma documenté « Other CI/CD systems ».
- **Évaluateur raté** : le SDK l'écarte en silence (`Promise.allSettled`) ; le harnais
  garde son propre contrôle des valeurs manquantes.

## Décisions

1. **Juge sur Small 4, en contrôles oui/non.** Chaque critère devient deux à cinq questions
   oui/non, objectives, jugées une à une, avec un schéma de sortie unique
   (citation, réponse) pour garder le préfixe et le schéma communs au cache. Les notes de la
   grille du protocole se recalculent à partir des contrôles.
2. **Référence fournie au juge** : réponse attendue, erreur de l'élève quand l'énoncé en
   contient une, notions du programme permises et à venir. Rien n'indique au juge que le
   tuteur est son propre modèle.
3. **Cinq tirages par contrôle**, température 0,7, graines distinctes et versionnées ; la
   note est la part de « oui ». Un contrôle partagé (deux ou trois « oui » sur cinq) est
   signalé pour relecture.
4. **Validation** : jeu de calibration élargi, conversations réelles et cas construits
   pour que chaque contrôle ait des positifs et des négatifs ; taux de vrais positifs et de
   vrais négatifs, macro-F1 et α avec intervalles ; une part annotée par un humain avant
   toute publication. Le prompt ne se règle jamais sur les notes qui le valident.
5. **Harnais sur un dataset Langfuse hébergé**, versionné, un run par répétition ; dans les
   métadonnées, version de l'application, du jeu et du juge. Le juge, le contrôle de fuite,
   α et McNemar restent dans notre code ; notes, labels et baseline vivent dans git.
6. **CI** : job GitHub Actions sur le code de sortie de `bun run eval`, contre la baseline
   approuvée.

## Ordre des PR

1. Juge v2 : contrôles oui/non sur Small 4, référence, tirages multiples, cache vérifié ;
   cas construits ; mesure sur l'échantillon du 2026-10-03.
2. Dataset Langfuse hébergé, runs par répétition, métadonnées de version.
3. Baseline approuvée, McNemar, garde-fou en CI (points 5 et 6 du lot 1).
