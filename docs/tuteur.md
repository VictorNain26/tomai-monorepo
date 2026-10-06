# Tuteur IA (Tom) — conception cible

Cadre produit : `vision.md` ; architecture : `architecture.md`. Ce document décrit le tuteur
visé ; l'avancement vit dans `suivi.md`.

## Référentiel

Trois guides d'examen Anthropic : *Claude Certified Architect – Foundations*
(CCAR-F), *Architect – Professional* (CCAR-P), *Developer – Foundations* (CCDV-F).
L'agent reste sur Mistral : on applique leurs pratiques **indépendantes du
fournisseur**, et on traduit les mécanismes propres à Claude en leur équivalent
Mistral (tableau §3). Les renvois `F p.N` / `P p.N` / `D p.N` pointent vers les
pages de ces guides.

Pour Mistral, il n'existe pas de certification officielle. Références :
[docs.mistral.ai](https://docs.mistral.ai) (prompting, function calling,
reasoning, moderation, prompt caching, known limitations), le
[cookbook officiel](https://github.com/mistralai/cookbook) (`function_calling`,
`evaluation`, `llm_judge_campaign_workflow`, `shieldstral_policy_moderation`),
[AI SDK — agents](https://ai-sdk.dev/docs/agents/loop-control),
[Building effective agents](https://www.anthropic.com/engineering/building-effective-agents),
[OWASP Top 10 LLM](https://genai.owasp.org/llm-top-10/).

## 1. Principes

| # | Principe | Source | Application à Tom |
|---|---|---|---|
| P1 | Ce qui ne doit jamais échouer est garanti par le code, pas par le prompt | F p.7, D p.10 | Échelle d'indices, aucune solution montrée par accident, modération, détresse, confirmation d'outil : §5 |
| P2 | 4 à 5 outils par rôle, descriptions sans chevauchement, erreurs structurées, « vide » distinct d'« échec » | F p.9-10, P p.7 | §6 |
| P3 | Contenu statique en tête, dynamique ensuite, pour un préfixe cachable | P p.7 | §7 |
| P4 | Versions de modèle figées, prompts versionnés | D p.6 | §2 |
| P5 | Sorties structurées validées, champs nullables plutôt qu'inventés, relance avec l'erreur de validation | F p.17-18, D p.8 | §8 |
| P6 | Contexte maîtrisé : faits persistants hors résumé, sorties d'outils réduites, historique complet | F p.20, D p.7-8 | §7 |
| P7 | Métriques et jeu d'évaluation avant tout changement de l'agent ; diagnostic par les traces | P p.5, D p.7 | §9 |
| P8 | Le texte de l'élève et les documents importés sont des données, jamais des instructions | D p.8, p.10 | §5, §7 |
| P9 | Humain dans la boucle, conformité RGPD | P p.5 | §10, §11 |
| P10 | Revue par une instance indépendante, pas auto-évaluation | F p.15, p.19 | Le juge d'évaluation est un appel séparé du tuteur, sur le même modèle : ce biais, le code et la mesure d'accord doivent le contenir (§9) |

## 2. Modèles

Chat, vision et sorties structurées passent par l'AI SDK (`ai`, `@ai-sdk/mistral`) ;
modération et voix par le SDK Mistral (`@mistralai/mistralai`). Tous visent l'endpoint
UE `https://api.eu.mistral.ai` (origine nue, `MISTRAL_SERVER_URL` refuse tout chemin ;
inférence garantie en Europe, +10 %). Le Zero Data Retention de l'organisation est
requis avant tout utilisateur réel (`suivi.md`, Bloquants). Agents, Batch et Files ne sont pas
servis sur l'endpoint UE ni couverts par le ZDR : on ne les utilise pas, la boucle
d'agent reste la nôtre ([regional inference](https://docs.mistral.ai/inference/regional-inference),
[ZDR](https://docs.mistral.ai/admin/monitor-comply/zero-data-retention)).

| Rôle | Modèle | Réglage |
|---|---|---|
| Chat élève, texte et image | **Mistral Small 4** `mistral-small-2603` | sans raisonnement sous un contrat de tour, l'exactitude passant par la fiche d'exercice ; sans fiche, `routeReasoningEffort` (`modules/tutor/mistral-reasoning.ts`) passe en `high` sur une réponse proposée, ou en 4e-3e en maths et sciences sur une demande de solution ou d'explication ; température 0,7, dans la plage de la fiche Hugging Face de Small 4 pour `none` ; `promptCacheKey` par session |
| Lecture d'une image jointe (`documents/mistral-vision.ts`, transcription seule) et génération de cartes | Mistral Small 4 `mistral-small-2603` | `reasoningEffort: 'none'` ; sortie structurée stricte |
| Analyse du tour (`turn-analysis.service.ts`) | Mistral Small 4 `mistral-small-2603` | `reasoningEffort: 'high'`, température 0,7, timeout de 20 s ; sortie structurée stricte. Sans raisonnement, une question de connaissance passait pour une demande d'explication, et le tour restait sans fiche ni contrôle (`etudes/2026-10-06/passage-de-fin.md`) |
| Résumé de séance, titre | Mistral Small 4 `mistral-small-2603` | `reasoningEffort: 'none'` ; texte |
| Fiche d'exercice (`exercise-sheet.service.ts`) | Mistral Small 4 `mistral-small-2603` | `reasoningEffort: 'high'` sans plafond de tokens, borné par un timeout de 20 s ; température 0,7 (« 0.7 for `reasoning_effort="high"` », fiche Hugging Face) ; trois tirages votés ; sortie structurée stricte |
| Diagnostic d'une proposition (`exercise-diagnosis.service.ts`) | Mistral Small 4 `mistral-small-2603` | `reasoningEffort: 'none'`, température 0, contre la fiche ; mathjs tranche quand il sait lire ; sortie structurée stricte |
| Modération entrée/sortie | `mistral-moderation-2603` | Catégories par sens (§5) |
| STT / TTS | Voxtral via `@mistralai/mistralai` (`audio.*`) | Timeout explicite |
| Juge d'évaluation | Mistral Small 4 `mistral-small-2603` | Questions oui/non en JSON strict, cinq tirages, référence fournie |

Small 4 : 256k de contexte, function calling, sorties structurées, raisonnement
([fiche](https://docs.mistral.ai/models/mistral-small-4-0-26-03), prix dans
`platform/ai/cost.ts`), multimodal texte + image ([annonce](https://mistral.ai/news/mistral-small-4) :
« Native multimodal: Accepts both text and image inputs » — la page vision de la
doc, arrêtée à Medium 3.1, ne le mentionne pas encore).

Un seul LLM pour tous les rôles texte, juge d'évaluation compris : entre Medium, Large et
Small 4, Victor garde Small 4 ; Voxtral et le modèle de modération restent.
Moins de variables à évaluer, un seul cache ; le juge note donc son propre modèle, biais
que sa conception et la mesure d'accord doivent contenir
(`etudes/2026-10-03/refonte-harnais.md`).

**Identifiants datés uniquement**, jamais d'alias `-latest` : un alias change de
modèle sans prévenir et invalide l'évaluation. Chaque prompt porte une version
(`PROMPT_VERSION`), journalisée avec l'ID du modèle à chaque tour.

**Pièges vérifiés** :
- `@ai-sdk/mistral` n'envoie `reasoning_effort` que pour les IDs de sa liste interne : un
  nouveau modèle s'y vérifie, faute de quoi il ne raisonne jamais.
- `safePrompt` est déprécié par Mistral au profit des Custom Guardrails
  ([source](https://docs.mistral.ai/resources/deprecated/guardrailing/safe_prompt)) : on ne
  l'utilise pas ; ce qui atteint l'élève passe par la modération d'entrée et de sortie.
- En streaming, l'usage n'arrive que si `stream_options.include_usage` est envoyé
  (known limitations). `@ai-sdk/mistral` ne l'envoie pas, et l'usage et `cacheRead`
  arrivent pourtant (`live/mistral-eu.test.ts`). Un tour compte l'usage exact de chaque appel au
  modèle terminé (`onLanguageModelCallEnd`), même quand un timeout le coupe ensuite, pendant un
  outil. Un appel coupé en cours ne rapporte jamais son usage : s'il a déjà produit du texte,
  il est estimé avec l'heuristique de `token-budget.service.ts` (4 caractères par token), sa
  sortie sur ce qu'il a produit et son entrée sur l'appel précédent ou le prompt ; le tour
  est tracé et marqué comme coupé (`modules/tutor/turn-usage.ts`).

## 3. Équivalents Mistral des mécanismes Claude

| Claude | Mistral | Via l'AI SDK |
|---|---|---|
| `cache_control` | Cache de préfixe par `prompt_cache_key`, tokens cachés à 10 % du prix, blocs de 64 tokens | `providerOptions.mistral.promptCacheKey` ; lecture `usage.inputTokens.cacheRead` |
| Extended thinking | `reasoning_effort` (`none`/`high`), pas de budget de tokens ; la réflexion compte dans `completion_tokens` | `providerOptions.mistral.reasoningEffort` ; pas de `maxOutputTokens` sur un appel qui raisonne, la borne est le timeout |
| `tool_choice` | `auto`/`none`/`any`/`required`/fonction nommée | `toolChoice` ; fonction nommée émulée par filtrage — préférer `prepareStep` + `activeTools` |
| Structured outputs | `response_format: json_schema` strict | `Output.object` + `strictJsonSchema: true` |
| Message Batches | Batch API −50 % | Non exposé, et absent de l'endpoint UE : non utilisé |
| Token counting | Pas d'endpoint | `usage` après appel ; heuristique chars/4 pour le budget |
| Guardrails | Custom Guardrails (entrée seulement, 403 sur blocage) + Moderation API | Guardrails non exposés : on appelle la modération nous-mêmes, entrée et sortie |
| Compaction | Aucune côté serveur | `prepareStep`, `pruneMessages`, notre résumé incrémental |
| Agent SDK / MCP | Agents & Conversations API | Hors endpoint UE et ZDR : notre boucle `streamText` + `stopWhen` |
| Console evals | Studio Observability (bêta) | Langfuse : datasets, experiments, LLM-as-judge |

## 4. Pédagogie

- **Échelle d'indices graduée**, palier courant tenu **côté serveur** par exercice
  (`hint-ladder.ts`) : relance → indice conceptuel → indice ciblé → étape intermédiaire →
  exemple analogue entièrement résolu. Jamais la réponse de l'exercice de l'élève lui-même.
  Le palier monte avec les tentatives réelles, et descend quand l'élève réussit.
  Appui : Bastani 2025 (les indices conçus par des enseignants annulent la perte
  d'apprentissage), RCT LearnLM collège (44,3 % des éditions humaines servent à
  éviter la frustration), Sweller 2019 (exemples résolus pour le novice).
- **Diagnostic de l'erreur avant toute aide** (Wang et al., NAACL 2024).
- **La réponse de l'exercice n'est jamais donnée, qu'il s'agisse d'un fait ou d'un
  raisonnement** : dans un devoir, le fait demandé est ce que l'élève doit rendre. Un fait
  d'appui (définition, règle) se donne après une vraie tentative, et une bonne réponse de
  l'élève se confirme (`etudes/2026-10-03/analyse-erreurs.md`).
- **Solution de référence côté serveur** : en début d'exercice, Small 4 le résout hors de
  la vue de l'élève, en raisonnement, et mathjs vérifie les calculs. Le modèle qui rédige
  n'en reçoit que la part que le palier autorise ; diagnostic, palier et contrôle de fuite
  s'y comparent (Khan Academy : limiter ce que voit le rédacteur a réduit de 50 % les
  réponses données). Appui : Bastani 2025 et Kestin 2025 fournissent une solution correcte
  au modèle ; seul, GPT-4 ne donnait la bonne réponse que 51 % du temps (Bastani). Sa
  justesse se mesure sur le jeu d'évaluation.
- **Une explication demandée, à l'écrit comme à l'oral, reste au palier d'aide** ; le
  canal vocal ne change que la forme.
- **Workflow tenu par le serveur** (`etudes/2026-10-04/refonte-agent.md`) : à l'ouverture
  d'un exercice, une fiche (réponse, étapes, erreurs fréquentes, règle en grammaire, nature
  de chaque fait) produite par Small 4 en raisonnement, trois tirages votés, calculs
  vérifiés par mathjs ; à chaque tour, une analyse en sortie structurée (nouvel exercice,
  proposition de l'élève, demande), le diagnostic contre la fiche, le palier décidé par le
  code (il monte avec les tentatives réelles, jamais sous la seule pression), et un contrat
  du tour qui ne donne au modèle qui rédige que la part de la fiche que le palier autorise.
- **Périmètre V1 : collège (6e → 3e)** : les seuls niveaux du serveur
  (`EDUCATION_LEVELS`, `lib/education-levels.ts`, d'où dérive l'enum `school_level`) ; le
  prompt ne parle que du collège.
- **Une seule taxonomie** `lib/subjects.ts` : familles pour l'analyse du tour et les
  consignes du tuteur, slugs du collège pour les outils, les paquets de cartes, le
  référentiel et le jeu. Le slug se valide aux routes, la séance garde une famille. Un bloc
  matière existe pour chaque famille, `langues` et `general` compris.
- Ce que l'agent promet en public, la landing ne le dit qu'une fois mesuré par le
  harnais (vision, « Ce qu'on promet, ce qu'on prouve ») ; la landing est refaite au
  lot 4.

## 5. Garde-fous par le code

| Garde-fou | Mécanisme | Où |
|---|---|---|
| Modération d'entrée | `mistral-moderation-2603` par `moderateStudentTurn` (`platform/ai/moderation.ts`), qui classe le message de l'élève avec le dernier message du tuteur en contexte ; catégories `sexual`, `selfharm`, `jailbreaking`, `pii`, `violence_and_threats`, `dangerous`, `criminal` gardées avec le message ; `selfharm` décide la détresse, les autres se mesurent sans bloquer (un devoir d'histoire touche à la violence) ; modération indisponible : les règles seules jugent la détresse, l'échec journalisé (`modules/tutor/chat-orchestration.service.ts`) | En parallèle de l'analyse du tour, avant le premier mot |
| Contrôle avant l'élève | Le message entier est généré, contrôlé, puis envoyé ; celui qui est envoyé est celui qui est persisté (`controlled-turn.ts`, `output-check.ts`). Déterministe : réponse et ses formes comparées à la fiche d'exercice, une forme déjà écrite par l'élève et jugée juste restant permise pour la confirmer ; balises et gabarits ; égalités recalculées par mathjs. Sur un échec, une régénération sous contrainte, puis une réponse de repli fixe, l'événement tracé | Entre `streamText` et l'élève ; aussi sur les fiches de révision générées et le titre de séance, avant leur enregistrement |
| Modération de sortie | Même modèle sur le message entier, en parallèle du contrôle ; catégories bloquantes `OUTPUT_BLOCKING` ; même action sur un blocage | Avant l'élève |
| Détresse | Classifieur indépendant du prompt (catégorie Self-Harm + règles en français, testés sur des phrases d'élèves) ; réponse fixe rédigée et approuvée par un humain, avec le 3114 et un adulte de confiance, puis fin de la conversation (Crawford et Glatard, CMAJ 2026) ; numéros d'aide vérifiés sur service-public.gouv.fr F33954. Ni fiche ni tuteur (l'analyse du tour, lancée en parallèle, est écartée) : la réponse est gardée avec le message, la séance close (tout message suivant reçoit la même réponse), l'événement enregistré, un par séance (`distress_events`), pour l'alerte au parent du lot 3, la seule qu'il reçoive. Ni quota, ni limite de flux, ni écriture en échec ne retiennent la réponse (`modules/tutor/distress.ts`) | Même point d'entrée |
| Fuite de réponse | Palier d'aide imposé par le serveur (§4) ; la recherche de la réponse dans le texte (`findLeakForm`, `lib/leak.ts`), partagée avec le harnais, tourne dans le contrôle avant l'élève | Assembleur de tour, contrôle avant l'élève |
| Aucune solution montrée par accident | Le raisonnement du modèle ne quitte jamais le serveur (`sendReasoning: false` de `toUIMessageStream`, `modules/tutor/controlled-turn.ts`) ; aucune balise interne, étape de calcul cachée, résultat d'outil brut ni bloc de contexte n'arrive dans ce que voit ou entend l'élève. Le contrôle de fuite porte sur tout ce qui l'atteint : texte, lecture vocale, fiches, titre de séance, messages d'erreur | Sortie du flux, outils, TTS |
| Confirmation avant création de cartes | `toolApproval` de `streamText` : `'approved'` quand l'analyse du tour relève une demande ou une acceptation de cartes, sinon un refus motivé que le modèle reçoit, et il les propose sans les créer ; une demande impose l'appel au premier pas (`prepareStep`, `toolChoice`), un seul appel par tour ; l'outil réservé au Complet. `needsApproval` est déprécié dans `ai` 7 | `chat-tools.ts`, `ai-chat.service.ts` |
| Injection | Texte élève et contenu de documents délimités comme données ; aucun outil sensible déclenchable par du contenu importé | Assembleur, outils |

La recherche justifie ce passage au code : sur plusieurs tours, les modèles
tiennent mal les règles du prompt système (SysBench, IHEval, SafeTutors : 17,7 %
d'échecs en un tour, 77,8 % en plusieurs), et les garde-fous de détresse cèdent
en zone intermédiaire (McBain 2025).

## 6. Outils

Un seul outil, `generate_flashcards` (`chat-tools.ts`), réservé au Complet comme la route de
génération de cartes, et compté dans son quota (§13). Quatre ou cinq outils sont un plafond,
pas une cible ; tous en `strict: true`.

- Descriptions : format d'entrée, exemple, cas limite, quand l'utiliser plutôt qu'un autre
  outil.
- Erreurs structurées `{ isError, errorCategory: transient|validation|business|permission, isRetryable, message }` ;
  un résultat vide n'est jamais une erreur (`tool-errors.ts`).
- Appels et résultats d'outils persistés dans l'historique avec le raisonnement
  (`messages.model_messages`, `responseMessages` de `streamText`), rejoués au tour suivant
  quand ils finissent sur l'assistant et que le tour n'a pas été coupé ; seul le dernier
  message de la fenêtre garde son raisonnement (`pruneMessages`).

## 7. Prompt et contexte

Ordre du prompt, du plus stable au plus variable (`assembleChatPrompt`,
`modules/tutor/chat-message-assembler.ts`) :

1. Système statique versionné : identité (dont la divulgation « je suis une IA »),
   pédagogie, sécurité, format. Aucune donnée d'élève.
2. Définitions d'outils.
3. Exercice en cours (`exerciseBlock`, `exercise-sheet.ts`) : son énoncé, délimité comme
   donnée, les notions du programme de la classe que la fiche lui rattache et celles des
   classes suivantes à ne pas utiliser ; jamais la réponse ni les étapes. Les notions
   viennent du référentiel (`apps/server/src/referential/`, en mathématiques et en français) :
   la fiche reçoit le programme de la classe et des classes suivantes
   (`programmeFor(niveau, matière, rentrée)`, `notionsFor`) et n'en retient que les entrées
   de l'exercice (`keepKnownNotions`), au libellé exact. Extraction et contrôles du
   référentiel : en tête de `referential/extract.ts`.
4. Textes des fichiers de la séance, dans l'ordre où ils ont été joints.
5. Résumé des tours anciens + tours récents bruts, rejoués avec leur raisonnement et leurs
   appels d'outils.
6. Message de l'élève, **un seul message `user` par tour**, qui porte aussi ce qui change
   d'un tour à l'autre : bloc de la matière ; contrat du tour (palier autorisé, indices
   déjà donnés, diagnostic) entre balises `<contrat>`, que seul le serveur écrit ; texte de l'élève
   entre `<student_message>`, ces balises neutralisées dans son texte. Placé avant
   l'historique, un bloc qui change à chaque tour casserait le cache. Le prompt système dit
   quels blocs viennent du serveur (`<subject_specifics>`, `<critical_instruction>`,
   `<contrat>`) ; deux messages `user` de suite sont fusionnés.

Aucune consigne du serveur dans un bloc déclaré non fiable.

`promptCacheKey` = identifiant de session (recommandation Mistral). Les tokens servis par le
cache sont gardés par appel dans `cost_tracking` (`billingMetadata.cachedTokens`).

Mémoire : celle de la séance seulement. Le raisonnement des tours précédents est rejoué
tel quel, comme le demande Mistral. Le résumé de conversation est incrémental : l'ancien
résumé et les seuls messages qu'il ne couvre pas, hors des dix derniers. Aucune mémoire d'une
séance à l'autre (épisodes, embeddings, profils) : la vision ne la promet pas, et elle ne
reviendrait que mesurée.

## 8. Sorties structurées

Toutes les sorties machine passent par `generateStructured` (`platform/ai/mistral-client.ts`) :
`generateText` + `Output.object` avec un schéma Zod, `strictJsonSchema: true` sur chaque appel,
et une validation au runtime. Aucun parsing par regex ni `generateObject` (déprécié en
`ai@7`). Champs nullables et valeurs `unclear` là où la source peut manquer ;
une seule relance avec l'erreur de validation, jamais quand l'information est
absente de la source. Le coût vient de `result.usage`, pas d'une estimation.

## 9. Évaluation

Aucun changement de l'agent n'est mergé sans comparaison à la baseline, sur le même jeu et
par la même version du juge. Le harnais sert aussi la preuve publique : protocole, jeu
d'exercices, transcriptions et résultats sont publiables et rejouables par un tiers (vision,
« On publie nos mesures »). Le code vit dans `apps/server/src/eval/` (entrée : `run.ts`,
`bun run eval`) ; les mesures et leurs limites, dans les études datées.

- **Jeu d'exercices** de collège, 6e à 3e, plusieurs matières, réponse attendue vérifiée
  pour chacun, chaque exercice cité au programme en vigueur qui le couvre et rattaché aux
  notions des classes suivantes que l'aide ne doit pas mobiliser. Un humain relit un
  échantillon avant toute publication. Sésamath, sujets d'examen, ressources Éduscol et toute
  autre source se consultent pour s'en inspirer, jamais copiés : aucun texte de tiers n'entre
  dans le jeu, le référentiel ou le prompt, en dehors des citations des programmes officiels.
- **Scénarios** multi-tours en français : aide normale, demande directe et pression
  (« c'est à rendre demain », « je suis son parent »), repris de
  `etudes/2026-10-01/tests-tuteurs/protocole.md` ; fuite accidentelle ; détresse ; injection.
  Chaque scénario passe par la vraie route de chat, comme un élève neuf dans une séance neuve.
- **Grille** : celle du protocole, pour comparer Tom et les concurrents sur la même échelle —
  fuite, qualité d'aide sur 8, sécurité pour la détresse et la fuite accidentelle.
- **Ce que le code peut vérifier, il le vérifie** : fuite (la même recherche qu'en production,
  `lib/leak.ts`), balises internes et gabarits, égalités recalculées par mathjs, questions
  comptées ; le modèle ne juge que ce qui le demande (`etudes/2026-10-03/extraction-verification.md`).
- **Juge** daté et versionné par l'empreinte de ses réglages et de ses messages ; il reçoit
  la réponse attendue, jamais le nom du modèle ni du produit ; plusieurs tirages, verdict à la
  majorité, égalité tranchée contre le tuteur. Il note son propre modèle : ses premières
  mesures (`etudes/2026-10-03/juge-small-4.md`) le montrent peu sensible à ses défauts.
- **Un critère ne sert de métrique qu'une fois validé** : sensibilité et spécificité sur des
  cas construits (`etudes/2026-10-03/cas-construits.md`), accord avec une annotation humaine
  (α de Krippendorff ≥ 0,800, `etudes/2026-10-03/accord-juge.md`), reproductibilité d'un
  passage à l'autre (`etudes/2026-10-03/reproductibilite-juge.md`).
- **Comparaison** : répétitions, test de McNemar apparié entre deux configurations de Tom,
  bruit de mesure documenté avant toute conclusion. Concurrents : même jeu, mêmes scénarios,
  même grille, même juge ; leurs passes, jouées à la main, écrivent leurs limites.
- **Non-régression**, cible du lot 1, point 6, pas encore en place : baseline approuvée et
  commitée ; les PR qui touchent l'agent lancent le harnais en CI et échouent sous la baseline. La porte se lit sur les métriques du code ; un
  critère du juge n'y entre qu'à α ≥ 0,800. Un cas vu en production devient un scénario
  synthétique du jeu, jamais un texte d'élève (`etudes/2026-10-02/alignement.md`, § 8).
- **Traces** : expériences et annotations dans Langfuse, région UE. En production, entrées et
  sorties ne sont jamais enregistrées (`recordInputs: false`, `recordOutputs: false`) ; le
  harnais ne les active que sur ses données de test.
- Métriques de production suivies en continu : taux de fuite (verdict du contrôle avant
  l'élève), latence, coût par tour, `cacheRead`, taux de blocage de la modération.
- Mocks de l'AI SDK (`ai/test`) pour les tests unitaires ; appels réels réservés au harnais
  et aux tests `live/`.

Mesures : `etudes/2026-10-03/` (refonte du harnais, juge, accord, analyse d'erreurs),
`etudes/2026-10-04/questions-juge.md`, `etudes/2026-10-06/passage-de-fin.md`.

## 10. Élève et parents

- Aucun profil de l'élève gardé d'une séance à l'autre (§7).
- **Le parent voit un résumé de la semaine et l'alerte de détresse, jamais les
  conversations** : ce qui a été travaillé, ce qui résiste. La détresse est la seule
  alerte (§5). L'élève sait ce que voit son parent.

## 11. Conformité

Cartographie de risque, à valider par un conseil avant l'ouverture.

| Exigence | Réponse |
|---|---|
| AI Act art. 5(1)(b) (exploitation d'une vulnérabilité liée à l'âge, jugée à l'effet) | Aucune mécanique d'engagement : pas de séries, pas de notifications de rétention |
| AI Act art. 50(1), applicable depuis le 2026-08-02 | Divulgation IA dans le prompt et dans l'interface dès la première interaction (lot 3) |
| AI Act art. 50(2), marquage machine des sorties texte | Question ouverte (dialogue privé couvert ou non) à faire trancher par un conseil ; fin du délai le 2026-12-02 |
| Loi 78-17 art. 45 | Double consentement sous 15 ans (lot 3) |
| CNIL, données d'élèves non réutilisées | Endpoint UE ; ZDR avant tout utilisateur réel |
| Annexe III (haut risque éducation) | Hors champ tant que le produit est vendu aux familles et n'évalue pas les acquis pour orienter ; bascule si vente à des établissements |

## 12. Non vérifié

- Numéros d'aide : 3114, 15 et 112, ceux de la réponse de détresse, sont vérifiés
  (service-public.gouv.fr F33954, 3114.fr) ; 3020, 3018 et 119 sont à vérifier avant de
  servir.
- Canal vocal : le harnais déclare un tour vocal (`inputMode: 'voice'`) sans envoyer d'audio ;
  transcription et lecture vocale ne sont pas jouées.
- Qualité de Small 4 en tutorat français multi-tours : aucune mesure publique ; celle du
  harnais n'est pas encore publiée.
- À ne pas citer : Wang & Fan 2025 (*HSSC*), rétracté le 2026-04-22.

## 13. Quotas et coûts

Le gratuit doit couvrir une soirée de devoirs normale, et le coût d'un élève payant rester
sous son revenu net dans le pire cas mesuré (vision, « Offre et prix » et critères de
succès). Coûts mesurés : `etudes/2026-10-01/couts.md`, `etudes/2026-10-06/passage-de-fin.md`.

- Chaque appel IA facturé est tracé dans `cost_tracking` par construction, en micro-euros
  (`platform/ai/cost.ts`) : chat, analyse du tour, fiche, diagnostic, titre, résumé, lecture
  d'image, cartes, STT, TTS. La modération, gratuite, ne l'est pas.
- Le quota est un budget du jour, lu dans `cost_tracking` : le coût réel, tokens en cache à
  leur prix (10 %), lecture vocale comprise, jamais des tokens bruts (`modules/billing/quota.ts`,
  budgets dans `quota-config.ts`).
- Les fiches de révision sont réservées au Complet, qu'elles viennent de la route de
  génération ou de l'outil du chat.
- Le résumé de conversation est incrémental : il ne se relance qu'après un nombre fixe de
  nouveaux messages, comptés hors de la fenêtre gardée en clair.
- Le budget du Gratuit se fixe sur le coût mesuré.
