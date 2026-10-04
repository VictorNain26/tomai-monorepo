# Refonte de l'agent — 2026-10-04

Instantané daté, jamais mis à jour. Demandée par Victor le 2026-10-04 après l'audit du
prompt et des outils de Tom : « fais des recherches et applique les bonnes pratiques d'un
agent IA comme Tom ». C'est le lot 2 de `../../roadmap.md`, revu sur sources.

## Méthode

- **Quatre recherches**, sources ouvertes le 2026-10-04, chacune avec son niveau de preuve :
  - [M] preuve mesurée (essai, benchmark) ;
  - [P] pratique publiée par un produit ;
  - [O] opinion.

  Elles portaient sur :
  - la conception des tuteurs IA, produits et recherche ;
  - l'ingénierie de l'agent avec Mistral Small 4 et l'AI SDK 7 : documentation et types
    installés, `ai` 7.0.107 et `@ai-sdk/mistral` 4.0.48 ;
  - l'exactitude et les garde-fous ;
  - un audit de tous les appels IA du serveur hors tour de chat.
- **Audit du tour de chat**, lu dans le code ; synthèse dans `../../suivi.md`, lot 2,
  « Audit de l'agent ».
- **Défauts mesurés** : `../2026-10-03/analyse-erreurs.md`, 15 conversations ratées sur 38.

## Pourquoi Tom se trompe

Tom est aujourd'hui un prompt système long, une consigne par intention et quatre outils.
Tout ce qu'il affirme vient de la mémoire de Small 4.

- **Rien pour vérifier.**
  - Il n'a ni la solution de l'exercice, ni l'erreur de l'élève, ni le programme, ni de quoi
    calculer.
  - La consigne « Si tu n'es pas certain : dis-le » n'a empêché aucune des 5 affirmations
    fausses.
- **Le prompt le pousse à affirmer et à dérouler.**
  - Il dit : « Réponds comme un professeur qui connaît son sujet », « Ne mentionne jamais :
    tes sources ».
  - En maths : « Chain-of-Thought obligatoire. Étape par étape ».
  - Pour une question de fait : « confirme ou donne l'information juste ».
- **Les consignes de tour se contredisent.**
  - Sur une réponse proposée : demander la démarche, sans pointer l'erreur. C'est le défaut
    des 7 erreurs non exploitées.
  - Sur une demande de solution : « 1-2 questions », et « révéler une étape intermédiaire ».
- **Le raisonnement n'est activé qu'en 4e-3e, en maths ou sciences, pour trois
  intentions.** 4 des 5 règles fausses étaient en français et en anglais, donc sans
  raisonnement.
- **Tout tient au prompt, sur plusieurs tours.** Aucun garde-fou de `../../agent.md` § 5
  n'est codé. Or les consignes d'un prompt système dérivent avec les tours :
  - « within eight rounds » [M, Li et al., COLM 2024, LLaMA2-70B,
    https://arxiv.org/abs/2402.10962] ;
  - les défaillances pédagogiques passent « from 17.7% to 77.8% » en plusieurs tours [M,
    SafeTutors, https://arxiv.org/abs/2603.17373].

## Ce que font les tuteurs qui marchent

| Principe | Preuve | Source |
|---|---|---|
| Le tuteur reçoit la solution correcte et les erreurs fréquentes avant d'aider | [M] seul, GPT-4 ne donnait la bonne réponse que « 51% of the time » ; avec solutions et erreurs fréquentes dans le prompt, la perte d'apprentissage disparaît | Bastani et al., PNAS 2025, https://pmc.ncbi.nlm.nih.gov/articles/PMC12232635/ |
| La structure des problèmes à plusieurs parties est tenue hors du prompt | [M] « a system prompt could not reliably provide enough structure to scaffold problems with multiple parts » | Kestin et al., Sci. Rep. 2025, https://pmc.ncbi.nlm.nih.gov/articles/PMC12179260/ |
| L'erreur de l'élève est diagnostiquée avant la réponse | [M] décisions d'expert (erreur, stratégie, intention) : « +76% more preferred » ; vérifier la solution de l'élève donne des réponses « more often correct with less hallucinations » | Bridge, https://arxiv.org/abs/2310.10648 ; Daheim et al., https://aclanthology.org/2024.emnlp-main.478/ |
| Les calculs sont faits par un outil, pas par le modèle | [P] « We built a calculator for Khanmigo » ; un « math agent » vérifie les calculs « in real time » | https://blog.khanacademy.org/khanmigo-math-computation-and-tutoring-updates/ ; https://blog.khanacademy.org/how-khan-academy-is-building-a-better-ai-tutor-our-most-recent-learnings/ (2026-05-06) |
| Le modèle qui rédige ne voit que ce que l'étape exige | [P] limiter l'agent aux calculs déjà faits par l'élève « reduced giving away the answer by 50% » (test A/B) | Khan Academy, billet du 2026-05-06 |
| Le palier d'aide est décidé par le code, pas par le texte de l'élève | [M] laisser le modèle choisir sa stratégie « does not yield satisfactory results », un graphe écrit à la main fait mieux ; [P] « No single prompt edit produced a withholding tutor » | StratL, préprint, https://arxiv.org/abs/2410.03781 ; Pisan, préprint à un auteur, https://arxiv.org/abs/2608.12292 |
| La consigne du tour est réécrite à chaque tour, en fin de contexte | [M] répéter les consignes aide sur les longues conversations | Li et al. ; Eedi, préprint, https://arxiv.org/abs/2512.23633 (prompt rempli « before each individual API call ») |
| Messages courts, une question à la fois | [P] « Only ask the student one question at a time », « keep messages short and to one line where possible » (élèves de 13 à 15 ans) | Eedi ; mode étude d'OpenAI (prompt extrait, non officiel) |
| Le raisonnement des tours précédents est rejoué | [P] « always replay the full assistant message (including `ThinkChunk`) » | https://docs.mistral.ai/studio/conversations/reasoning |
| Un workflow d'abord, un agent autonome seulement si nécessaire | [O] « find the simplest solution possible » | Anthropic, https://www.anthropic.com/engineering/building-effective-agents |
| Pas d'autocorrection sans signal externe | [M] « LLMs struggle to self-correct their responses without external feedback » ; elle marche « with reliable external feedback » | Huang et al., ICLR 2024, https://arxiv.org/abs/2310.01798 ; Kamoi et al., TACL 2024, https://arxiv.org/abs/2406.01297 |

Aucune source mesurée ne porte sur des collégiens français, ni sur l'effet isolé d'une
question par message ou de la longueur des messages.

## Architecture retenue

Un workflow déterministe autour du modèle, pas un agent autonome. Le serveur décide de ce
que le modèle sait et de ce qu'il a le droit de donner ; le modèle rédige.

### À l'ouverture d'un exercice : la fiche

Quand l'élève apporte un exercice (texte ou photo), le serveur prépare une fiche, hors de
la vue de l'élève :
- l'énoncé ;
- la réponse attendue ;
- les étapes ;
- les erreurs fréquentes ;
- la règle qui s'applique, en grammaire ;
- la nature de chaque fait (réponse du devoir, ou fait d'appui).

Comment elle est produite :
- Small 4 avec `reasoning_effort: "high"`, en trois tirages ; la réponse finale est votée
  (self-consistency [M], +17,9 % sur GSM8K, https://arxiv.org/abs/2203.11171).
- mathjs vérifie les calculs.
  - Pas de `solve` général ; `symbolicEqual` peut répondre `false` sur deux expressions
    égales (« a `false` value does not absolutely rule this out »,
    https://mathjs.org/docs/reference/functions/symbolicEqual.html).
  - L'équivalence se teste donc par `rationalize` de la différence.
- Coût estimé : environ 0,27 centime par exercice.
- Latence estimée : une dizaine de secondes au premier tour de l'exercice. À mesurer.
- La justesse des fiches se mesure sur le jeu d'évaluation : elles viennent de Small 4, pas
  d'enseignants. C'est une preuve plus faible que Bastani ou Khan Academy.

### À chaque tour

1. **Modération et détresse**, en parallèle de l'analyse du tour, avant le premier mot :
   - `classifiers.moderateChat` de `mistral-moderation-2603` ;
   - plus des règles en français : la définition de `selfharm` (« promotes, instructs,
     plans… ») ne couvre pas clairement « j'ai envie de disparaître ».
   - Si la détresse est détectée : réponse fixe approuvée par Victor (3114, adulte de
     confiance), fin de la conversation, événement enregistré pour l'alerte au parent (lot 3),
     dont l'élève est informé.
   - Sources : Crawford et Glatard, CMAJ 2026 ; https://docs.mistral.ai/studio/safety-moderation.
2. **Analyse du tour**, en sortie structurée ; elle remplace le classifieur d'intention.
   Elle dit :
   - si le message ouvre un nouvel exercice ;
   - si l'élève propose une réponse ou une démarche ;
   - s'il demande une explication, des fiches, ou la solution.
3. **Diagnostic**, quand l'élève propose quelque chose : comparé à la fiche, mathjs pour les
   calculs. Il rend :
   - juste ou faux ;
   - la première étape fausse ;
   - le type d'erreur, selon les catégories de Bridge.

   Une erreur n'est cherchée derrière une réponse juste que si la fiche le prévoit : les
   modèles y lèvent « roughly four false alarms for every genuine detection » [M,
   https://arxiv.org/abs/2605.23925].
4. **Palier**, décidé par le code : relance, indice conceptuel, indice ciblé, étape
   intermédiaire, exemple analogue résolu (`../../agent.md` § 4).
   - Il monte avec les tentatives réelles et après deux tours sans progrès.
   - Il descend quand l'élève réussit.
   - « C'est pour demain » ou « je suis son parent » ne le font jamais monter.
   - Le serveur garde les indices déjà donnés : c'est ce qui évite la répétition sans
     progression, que le juge ne sait pas mesurer (`questions-juge.md`).
5. **Contrat du tour**, en texte simple, dans l'unique message `user` du tour : exercice,
   palier autorisé, indices déjà donnés, diagnostic.
   - Le rédacteur ne reçoit de la fiche que ce que le palier exige (Khan Academy, −50 %).
   - La réponse complète ne sert qu'au contrôle de fuite.
6. **Rédaction** par Small 4.
   - Raisonnement : routé par la mesure, non plus par matière.
   - Température : 0,7 en `high` ; plus basse en `none`, valeur fixée au harnais (fiche
     Hugging Face de Small 4).
   - Pas de plafond de tokens sur un tour qui raisonne (décision de Victor). La borne
     devient le contexte et le timeout du flux.
7. **Contrôle avant l'élève**, déterministe, dans `experimental_transform` de `streamText`.
   - Ce qu'il contrôle :
     - la réponse et ses formes, comparées à la fiche ;
     - les balises et gabarits ;
     - les égalités, recalculées par mathjs.
   - Sur une fuite :
     - `stopStream` ;
     - une régénération sous contrainte ;
     - puis une réponse de repli.
   - Le tampon coûte au plus une phrase. Contrôler le message entier ajouterait 1 à 2
     secondes.
   - Sources :
     - https://ai-sdk.dev/docs/ai-sdk-core/generating-text, « Stream transformation » ;
     - NeMo Guardrails, `stream_first: false`.
   - La vérification phrase par phrase par le modèle (le juge `eval/claims.ts`) ne sert pas
     de barrière : elle lève 6 alertes injustifiées ou discutables sur 37 conversations
     (`questions-juge.md`).
8. **Modération de sortie** sur le message complet, avant persistance. Elle est gratuite.

### Prompt

Réécrit court, pour le collège seulement (6e-3e), avec la mention « je suis une IA ». On
retire :
- « Chain-of-Thought obligatoire » ;
- « professeur qui connaît son sujet » et « ne mentionne jamais tes sources » ;
- les paliers en prose : le prompt décrit les paliers, le contrat dit lequel s'applique ;
- les consignes chiffrées sans source.

On y met :
- une question à la fois, des messages courts, peu de mise en forme ;
- une bonne réponse confirmée, puis la main rendue à l'élève ;
- la règle des faits : la réponse du devoir ne se donne jamais, un fait d'appui se donne
  après une vraie tentative (`../../agent.md` § 4).

### Contexte et mémoire

- **Historique.**
  - Il se persiste en messages de l'AI SDK (`responseMessages` de `onEnd`), avec le
    raisonnement et les appels d'outils, et se rejoue tel quel.
  - Aujourd'hui seul le texte est gardé, et `sendReasoning: false` vide le message UI de son
    raisonnement.
- **Préfixe stable**, pour le cache :
  - système ;
  - définitions d'outils ;
  - programme du niveau et de la matière (point 4 du lot 2) ;
  - fiche de l'exercice.

  La matière est figée pour la séance. Ce qui change à chaque tour va dans le message
  courant : le placer avant l'historique casserait le cache. Cela corrige `../../agent.md`
  § 7.
- **Un seul message `user` par tour.** Aujourd'hui, un tour en empile jusqu'à six.
- **Résumé incrémental**, qui sert aussi d'épisode. Les épisodes se récupèrent une fois par
  séance, pas à chaque message.
- **Aucune consigne du serveur dans un bloc déclaré non fiable.**
  - « propose des flashcards » est aujourd'hui écrit dans `<student_context>`.
  - Le prompt déclare pourtant que ce bloc ne contient jamais d'ordre.

### Outils

- `get_student_profile` supprimé : il renvoie le profil, déjà injecté à chaque tour.
- `update_student_profile` :
  - n'écrit plus de styles d'apprentissage (neuromythe, `../../agent.md` § 6) ;
  - le profil reçoit une durée de conservation ;
  - une écriture échouée n'est plus déclarée réussie.
- `generate_flashcards` confirmé par le code.
  - Par `toolApproval` de `streamText`, qui accepte pour chaque outil une fonction rendant
    `'approved'` ou `'user-approval'` (`ToolApprovalConfiguration`, `ai` 7.0.107).
  - Une demande explicite de l'élève, relevée par l'analyse du tour, vaut confirmation.
  - `needsApproval`, prescrit par `../../agent.md` § 5, est `@deprecated` dans la version
    installée : « Tool approval is handled on a `generateText` / `streamText` level now ».
- Les outils passent en `strict: true`.
- `get_app_help` : ses affirmations fausses sont retirées. Il dit :
  - « du CP a la Terminale » ;
  - « serveurs en France (RGPD) », non prouvé ;
  - « messages par jour », alors que le quota compte des tokens ;
  - « Premium » au lieu de Complet.

  Sa réécriture complète reste au lot 3.

### Autres usages de l'IA

- **Épisodes d'autres élèves dans le prompt.**
  - Le filtre de `episodic-memory.repository.ts` rend `user_id = $1 and ttl_until IS NULL
    OR ttl_until > NOW()`, sans parenthèses : tout épisode non expiré de n'importe quel élève
    passe.
  - Vérifié en rendant le SQL de Drizzle, puis sur postgres.
  - Aucun utilisateur réel n'en a souffert. Corrigé (#378), avec un test à deux élèves ;
    l'index vectoriel, que la requête n'utilisait pas, est retiré.
- **L'analyse d'une photo ou d'un document est un second tuteur sans garde-fou.**
  - Elle demande une « Analyse pédagogique complète » et répond à la question de l'élève.
  - Sa sortie est réinjectée à chaque tour.
  - Elle devient une extraction seule, qui nourrit la fiche.
  - Chaque image est aussi traitée deux fois avant le premier mot : par l'analyse, puis par
    le chat.
- **Le résumé renvoie toute la conversation à chaque relance**, et ses gabarits
  `{previousSummary}` et `{newMessages}` ne sont jamais remplis.
- **Du contenu d'élève part dans les logs.** Le message d'un `TypeValidationError` contient
  toute la sortie du modèle, et s'y ajoutent titres, sujets et noms de fichiers.
- **STT** : la langue est forcée à `fr`, donc un oral d'anglais est transcrit en français.
- `safePrompt`, déprécié par Mistral, est encore activé sur les appels annexes.

## Écarté

- **Recherche web** : elle mettrait du texte de tiers, non vérifié, dans le prompt d'un
  enfant, ce que la règle de réutilisation interdit (`../../suivi.md`, lot 1).
- **LanguageTool** :
  - il vérifie des phrases, pas des règles énoncées ;
  - aucune des 4 règles fausses mesurées n'est une phrase fautive : sur des phrases
    construites, il n'a rien signalé sur l'accord « avec le sujet » ni sur « que » appelé
    sujet ;
  - son serveur auto-hébergé n'a pas les règles à base d'IA (https://dev.languagetool.org/http-server).
- **Grammalecte** : dernier commit le 2025-12-15, il échoue au critère des six mois.
- **Autocorrection sans référence** (Huang et al.), et baisse de température sans mesure :
  « changes in temperature from 0.0 to 1.0 do not have a statistically significant
  impact » sur la résolution de problèmes [M, deux auteurs, https://arxiv.org/abs/2402.05201].
- **Fine-tuning** (LearnLM) : hors roadmap.
- **API Agents et Custom Guardrails de Mistral** :
  - l'API Agents n'est servie ni sur l'endpoint UE ni sous le Zero Data Retention
    (`../../agent.md` § 2) ;
  - les guardrails ne modèrent que l'entrée et sont absents de `@ai-sdk/mistral` 4.0.48.

## Mesure

Pas de passage par PR. L'avant, ce sont les 38 conversations de l'échantillon, jouées par
le Tom actuel (`../2026-10-03/donnees/results.json`), déjà lues. L'après, les mêmes paires
scénario × exercice rejouées par le Tom refait. Deux passages en tout, annoncés :

1. **Détresse, injection et fuite par le code**, après le contrôle avant l'élève et la
   détresse : scénarios S4, S5 et S6, lus par le code seul (fuite, 3114, adulte de
   confiance, question après la détresse). Peu coûteux.
2. **Échantillon complet** à la fin de la refonte. Les transcriptions d'avant et d'après
   sont rejugées dans le même passage, par la même version du juge, et relues par Claude
   selon les catégories de l'analyse d'erreurs.

La baseline de Tom tel qu'il est (point 5 du lot 1) se réduit à ces 38 conversations :
jouer le jeu complet sur un agent qu'on remplace ne servirait à rien. Le jeu complet se joue
sur l'agent refait.

## Ordre des PR

1. `fix(tutor)` : épisodes limités à l'élève, avec un test à deux élèves. Mergée (#378).
2. **Prompt et outils** :
   - prompt réécrit ;
   - consignes de tour retirées ;
   - outils revus ;
   - affirmations fausses du guide retirées.
3. **Socle du tour** :
   - historique en messages de l'AI SDK, raisonnement et outils rejoués ;
   - un seul message `user` ;
   - préfixe stable ;
   - échantillonnage par mode, sans plafond en raisonnement ;
   - renommages de l'AI SDK 7.
4. **Fiche d'exercice** : analyse du tour, fiche en trois tirages, mathjs ; l'analyse de
   document devient une extraction.
5. **Diagnostic, palier et contrat du tour.**
6. **Contrôle avant l'élève et modération de sortie.**
7. **Détresse et modération d'entrée.** La réponse fixe est à faire approuver par Victor. →
   Premier passage.
8. **Mémoire et autres appels** :
   - résumé incrémental ;
   - épisodes une fois par séance ;
   - logs sans contenu d'élève ;
   - STT sans langue forcée ;
   - `safePrompt` retiré.
9. Quotas et coûts (point 3 du lot 2), programme dans le contexte (point 4). → Passage de
   fin.

## Non vérifié

- Comment l'API Mistral traite plusieurs messages `user` consécutifs ; si les définitions
  d'outils entrent dans le préfixe mis en cache.
- Si l'usage arrive dans le flux sans `stream_options.include_usage`, que le provider
  n'envoie pas : le code saute aujourd'hui quota et coût quand il lit 0.
- La latence et le rappel de `mistral-moderation-2603` sur des phrases d'élèves en français.
- La justesse des fiches de Small 4, et le gain du raisonnement en grammaire : aucune source
  n'en parle, la mesure le dira.
