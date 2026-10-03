# Juge en extraction et vérification — 2026-10-03

Instantané daté, jamais mis à jour. Il refait la méthode de jugement après la mesure du
juge Small 4 en questions oui/non (`juge-small-4.md`) : ce juge ne voit presque pas les
défauts de son propre modèle. Victor demande de séparer celui qui produit de celui qui
contrôle, avec les outils de Mistral et les outils existants, sans rien réinventer.

**Contrainte** : un seul LLM, Mistral Small 4 (`mistral-small-2603`), tuteur et juge.

## Ce que disent les travaux

- **Un modèle ne se vérifie pas seul.** « LLMs struggle to self-correct their responses
  without external feedback, and at times, their performance even degrades » (Huang et
  al., ICLR 2024, [arXiv 2310.01798](https://arxiv.org/abs/2310.01798)) ; même constat
  sur la vérification par le modèle lui-même face à un vérificateur externe (Stechly,
  Valmeekam, Kambhampati, [arXiv 2402.08115](https://arxiv.org/abs/2402.08115)).
- **Le biais sur ses propres sorties touche aussi les critères objectifs**, et davantage
  les rubriques négatives (« le tuteur a-t-il fait l'erreur ? ») ; l'effort de
  raisonnement ne le réduit pas (Pombal, Rei, Martins, 2026,
  [arXiv 2604.06996](https://arxiv.org/abs/2604.06996)). Une étude contraire trouve que
  le raisonnement réduit le biais nuisible (Chen et al.,
  [arXiv 2504.03846](https://arxiv.org/abs/2504.03846)) : à mesurer, pas à supposer.
- **Ce qui marche : vérifier hors du modèle, dans un contexte qui ne contient pas la
  réponse d'origine.** Chain-of-Verification répond aux questions de vérification
  « independently so the answers are not biased by other responses » (Dhuliawala et al.,
  [arXiv 2309.11495](https://arxiv.org/abs/2309.11495)) ; FActScore découpe en faits
  atomiques et les vérifie un par un
  ([arXiv 2305.14251](https://arxiv.org/abs/2305.14251)) ; CRITIC montre qu'un retour
  d'exécution de code est nécessaire pour corriger un calcul
  ([arXiv 2305.11738](https://arxiv.org/abs/2305.11738)).
- **Pratique recommandée** : les vérifications par code sont « Fast, Cheap, Objective,
  Reproducible » ; chaque dimension se note avec un juge isolé ; les grilles des juges
  LLM se calibrent sur un jugement humain expert
  ([Anthropic](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents)).
  Mistral dit la même chose : « use rule-based scoring whenever possible »
  ([doc](https://docs.mistral.ai/studio/observability/evaluations/evaluators)).
- **Sur les tuteurs**, des juges LLM de petite taille corrèlent négativement avec les
  humains sur les dimensions pédagogiques (MRBench,
  [arXiv 2412.09416](https://arxiv.org/abs/2412.09416)).

## Outils (vérifiés le 2026-10-03)

- **Déjà dans la pile, suffisants** : Langfuse (expériences, files d'annotation, garde-fou
  en CI) ; AI SDK 7 avec Zod pour faire extraire à Small 4 dans un schéma strict.
- **À ajouter : un vérificateur mathématique.** `@cortex-js/compute-engine` lit le LaTeX
  du tuteur et évalue les expressions (version 0.147.0 du 2026-10-02, 325 000
  téléchargements par semaine, encore avant la 1.0) ; `mathjs` (15.2.0, 4,6 millions par
  semaine) en repli. Le choix se fait sur un essai avec les calculs réels de Tom.
- **Écartés** :
  - Mastra (`createScorer`), seul paquet TypeScript qui fait exactement extraction puis
    vérification, mais qui fait entrer tout `@mastra/core` pour quelques fonctions.
  - Evalite, Ragas, `openai/evals`, Math-Verify, Algebrite : critère de maintenance.
  - `experimental_evaluate` de l'AI SDK : Mistral n'y est pas pris en charge.
  - promptfoo : racheté par OpenAI, tourné vers le red-teaming.
- **Outils Mistral** : l'exécution de code n'existe que dans l'API Conversations, en bêta,
  à 0,03 $ l'exécution (environ 330 par mois sur le crédit gratuit), et la doc se
  contredit sur Small 4 ([outil](https://docs.mistral.ai/studio/agents/agent-tools/code_interpreter),
  [tarifs](https://mistral.ai/pricing/api)) : écartée tant qu'un vérificateur local fait le
  travail. Les juges et l'Evaluation SDK de Mistral sont réservés à l'offre Enterprise.
  L'API Batch prend les complétions avec schéma strict, à moitié prix, hors limite de débit
  ([doc](https://docs.mistral.ai/studio/batch-processing)) : elle convient à l'extraction,
  qui n'a pas besoin de relance.

## Décisions

1. **Small 4 décrit, il ne juge pas.** Un extracteur relève, message par message et en
   citant la transcription : les questions posées à l'élève, les étapes de la solution
   données, les calculs et affirmations écrits, les notions employées, la réponse finale
   si elle est écrite. Il voit la transcription comme un document à décrire, jamais comme
   sa propre réponse.
2. **Le code vérifie ce qui est objectif** :
   - une question à la fois : nombre de questions par message ;
   - indices gradués : étapes données comparées aux étapes de référence de l'exercice
     (champ à ajouter au jeu), avant que l'élève ait essayé ;
   - exactitude : chaque calcul relevé évalué par le vérificateur mathématique, chaque
     affirmation comparée à la réponse attendue ;
   - niveau et alignement : notions relevées parmi la liste fermée du référentiel
     (identifiants proposés au modèle), classe comparée à celle de l'élève ;
   - fuite : le contrôle déterministe actuel ;
   - détresse : présence du 3114 et d'un renvoi vers un adulte relevés, puis vérifiés.
3. **Small 4 ne garde que ce qui demande un jugement** : ton, diagnostic, niveau de
   langue, en questions de présence, cinq tirages, et le mode raisonnement en variante
   mesurée.
4. **Mesure d'abord sur des cas construits** : une réplique modifiée par défaut (méthode
   déroulée, erreur de calcul, deux questions, notion d'une classe suivante, réponse
   écrite, 3114 absent), où la bonne réponse est connue. On mesure le rappel de
   l'extracteur et la justesse de chaque vérificateur avant de s'en servir comme métrique.
   L'accord avec l'annotation, dont une part humaine, vient ensuite.
5. **Reste de l'architecture inchangé** : Langfuse, notes et baseline dans git, juge dans
   notre code, limite de débit (`judge-rate.ts`).

## Ordre des PR

1. Cas construits et leur mesure sur le juge actuel (ce qu'il détecte, défaut par défaut) :
   la référence contre laquelle tout le reste se compare.
2. Extracteur et vérificateurs : questions, calculs, fuite, détresse ; étapes de référence
   et notions pour les indices et l'alignement.
3. Questions de jugement restantes (ton, diagnostic, niveau de langue), raisonnement
   mesuré ; puis accord avec l'annotation.
