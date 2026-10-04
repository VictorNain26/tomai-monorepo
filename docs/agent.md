# Agent IA (Tom) — conception cible

Statut : validé le 2026-09-22, aligné sur la vision produit le 2026-10-01. Cadre
produit : `vision.md` ; architecture : `architecture.md`.

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
| P10 | Revue par une instance indépendante, pas auto-évaluation | F p.15, p.19 | Juge d'éval d'une autre taille que le modèle évalué (§9) |

## 2. Modèles

Chat, vision et sorties structurées passent par l'AI SDK (`ai`, `@ai-sdk/mistral`) ;
embeddings et voix par le SDK Mistral (`@mistralai/mistralai`). Tous visent l'endpoint
UE `https://api.eu.mistral.ai` (origine nue, `MISTRAL_SERVER_URL` refuse tout chemin ;
inférence garantie en Europe, +10 %). Le Zero Data Retention de l'organisation est
requis avant tout utilisateur réel ; il n'est pas encore demandé (`suivi.md`,
Bloquants). Agents, Batch et Files ne sont pas
servis sur l'endpoint UE ni couverts par le ZDR : on ne les utilise pas, la boucle
d'agent reste la nôtre ([regional inference](https://docs.mistral.ai/inference/regional-inference),
[ZDR](https://docs.mistral.ai/admin/monitor-comply/zero-data-retention)).

| Rôle | Modèle | Réglage |
|---|---|---|
| Chat élève, texte et image | **Mistral Small 4** `mistral-small-2603` | `reasoningEffort` routé (`none` par défaut, `high` sur maths/sciences ou tour à risque) ; `promptCacheKey` par session |
| Résumés, génération de cartes, analyse de document, titres, classification d'intention | Mistral Small 4 `mistral-small-2603` | `reasoningEffort: 'none'` ; sortie structurée stricte |
| Modération entrée/sortie | `mistral-moderation-2603` | Seuils par catégorie (§5) |
| STT / TTS | Voxtral via `@mistralai/mistralai` (`audio.*`) | Timeout explicite |
| Juge d'évaluation | Mistral Small 4 `mistral-small-2603` | Questions oui/non en JSON strict, cinq tirages, référence fournie |

Small 4 : 256k de contexte, function calling, sorties structurées, raisonnement,
0,15 $ / 0,60 $ par million de tokens ([fiche](https://docs.mistral.ai/models/mistral-small-4-0-26-03)),
multimodal texte + image ([annonce](https://mistral.ai/news/mistral-small-4) :
« Native multimodal: Accepts both text and image inputs » — la page vision de la
doc, arrêtée à Medium 3.1, ne le mentionne pas encore).

Un seul LLM pour tous les rôles texte, juge d'évaluation compris : entre Medium, Large et
Small 4, Victor garde Small 4 (2026-10-03) ; Voxtral et le modèle de modération restent.
Moins de variables à évaluer, un seul cache ; le juge note donc son propre modèle, biais
que sa conception et la mesure d'accord doivent contenir
(`etudes/2026-10-03/refonte-harnais.md`).

**Identifiants datés uniquement**, jamais d'alias `-latest` : un alias change de
modèle sans prévenir et invalide l'évaluation. Chaque prompt porte une version
(`PROMPT_VERSION`) tracée dans Langfuse avec l'ID du modèle.

**Pièges vérifiés** :
- `@ai-sdk/mistral@4.0.5` n'envoie `reasoning_effort` que pour quatre IDs
  (`dist/index.js:428`) ; avec `mistral-medium-latest` le raisonnement n'a jamais
  tourné. La 4.0.15 rejoue le raisonnement d'un tour à l'autre, la 4.0.34 expose
  `promptCacheKey`. Montée en `^4.0.48` faite au lot 0.
- `safePrompt` est déprécié par Mistral au profit des Custom Guardrails
  ([source](https://docs.mistral.ai/resources/deprecated/guardrailing/safe_prompt)).
- En streaming, l'usage n'arrive que si `stream_options.include_usage` est envoyé
  (known limitations) : vérifier sur le fil que `usage` et `cacheRead` remontent.

## 3. Équivalents Mistral des mécanismes Claude

| Claude | Mistral | Via l'AI SDK |
|---|---|---|
| `cache_control` | Cache de préfixe par `prompt_cache_key`, tokens cachés à 10 % du prix, blocs de 64 tokens | `providerOptions.mistral.promptCacheKey` ; lecture `usage.inputTokens.cacheRead` |
| Extended thinking | `reasoning_effort` (`none`/`high`), pas de budget de tokens | `providerOptions.mistral.reasoningEffort` ; borne via `maxOutputTokens` |
| `tool_choice` | `auto`/`none`/`any`/`required`/fonction nommée | `toolChoice` ; fonction nommée émulée par filtrage — préférer `prepareStep` + `activeTools` |
| Structured outputs | `response_format: json_schema` strict | `Output.object` + `strictJsonSchema: true` |
| Message Batches | Batch API −50 % | Non exposé, et absent de l'endpoint UE : non utilisé |
| Token counting | Pas d'endpoint | `usage` après appel ; heuristique chars/4 pour le budget |
| Guardrails | Custom Guardrails (entrée seulement, 403 sur blocage) + Moderation API | Guardrails non exposés : on appelle la modération nous-mêmes, entrée et sortie |
| Compaction | Aucune côté serveur | `prepareStep`, `pruneMessages`, notre résumé incrémental |
| Agent SDK / MCP | Agents & Conversations API | Hors endpoint UE et ZDR : notre boucle `streamText` + `stopWhen` |
| Console evals | Studio Observability (bêta) | Langfuse : datasets, experiments, LLM-as-judge |

## 4. Pédagogie

- **Échelle d'indices graduée** (décision confirmée le 2026-09-04 et le
  2026-09-22). Palier courant tenu **côté serveur** par exercice : relance →
  indice conceptuel → indice ciblé → étape intermédiaire → exemple analogue
  entièrement résolu. Jamais la réponse de l'exercice de l'élève lui-même. Le
  palier monte avec les tentatives réelles, et descend quand l'élève réussit.
  Appui : Bastani 2025 (les indices conçus par des enseignants annulent la perte
  d'apprentissage), RCT LearnLM collège (44,3 % des éditions humaines servent à
  éviter la frustration), Sweller 2019 (exemples résolus pour le novice).
- **Diagnostic de l'erreur avant toute aide** (Wang et al., NAACL 2024).
- **La réponse de l'exercice n'est jamais donnée, qu'il s'agisse d'un fait ou d'un
  raisonnement** : dans un devoir, le fait demandé est ce que l'élève doit rendre. Un fait
  d'appui (définition, règle) se donne après une vraie tentative, et une bonne réponse de
  l'élève se confirme (décision du 2026-10-04, `etudes/2026-10-03/analyse-erreurs.md`).
- **Solution de référence côté serveur** : en début d'exercice, Small 4 le résout hors de
  la vue de l'élève et mathjs vérifie les calculs ; le tuteur la reçoit avec les erreurs
  fréquentes, et le contrôle de fuite s'y compare. Appui : Bastani 2025 et Kestin 2025
  fournissent une solution correcte au modèle ; seul, GPT-4 ne donnait la bonne réponse
  que 51 % du temps (Bastani). Sa justesse se mesure sur le jeu d'évaluation.
- **Une explication demandée, à l'écrit comme à l'oral, reste au palier d'aide** ; le
  canal vocal ne change que la forme. En S4, « explique-le à l'oral », tapé, faisait
  dérouler la solution ; le canal vocal lui-même n'est pas encore joué par le harnais.
- Suppression du « Chain-of-Thought obligatoire » (bloc maths de `SUBJECT_SPECIFICS`,
  `modules/tutor/prompts/adaptation/by-subject.ts`) et de la règle contradictoire de
  `IntentClassifierService.buildReinforcement` (« révéler une étape intermédiaire » après
  deux ou trois échanges).
- **Périmètre V1 : collège (6e → 3e)**, comme `SUBJECTS_BY_LEVEL`
  (`services/education.service.ts`). Le prompt cesse d'annoncer « CP → Terminale »
  (`modules/tutor/prompts/core/identity.ts`, `modules/tutor/prompts/core/safety.ts`).
- **Une seule taxonomie** `config/subjects.ts` : familles pour le classifieur,
  slugs fins pour les outils ; `histoire-geo` fusionné, `italien` ajouté. Elle
  remplace `STUDENT_SUBJECTS`, `SUBJECT_SLUGS`, `COLLEGE_SUBJECTS`,
  `normalizeSubject`, `SUBJECT_MAPPING`, `STEM_SUBJECTS` et le `'général'`
  accentué. Un bloc matière existe pour chaque famille, `langues` et `general`
  compris.
- Ce que l'agent promet en public, la landing ne le dit qu'une fois mesuré par le
  harnais (vision, « Ce qu'on promet, ce qu'on prouve ») ; la landing est refaite au
  lot 4.

## 5. Garde-fous par le code

| Garde-fou | Mécanisme | Où |
|---|---|---|
| Modération d'entrée | `mistral-moderation-2603` sur le message de l'élève avant l'appel ; catégories Sexual, Self-Harm, Jailbreaking, PII, Violence | Avant `streamText` |
| Modération de sortie | Même modèle sur la réponse ; blocage et réponse de repli | Après génération, avant persistance |
| Détresse | Classifieur indépendant du prompt (catégorie Self-Harm + règles en français, testés sur des phrases d'élèves) ; réponse fixe rédigée et approuvée par un humain, avec le 3114 et un adulte de confiance, puis fin de la conversation (Crawford et Glatard, CMAJ 2026) ; numéros d'aide vérifiés sur service-public.fr, alerte au parent. C'est la seule alerte que reçoit le parent | Même point d'entrée |
| Fuite de réponse | Palier d'aide imposé par le serveur (§4) ; contrôle de fuite du lot 1 réutilisé en production si son coût le permet | Assembleur de tour |
| Aucune solution montrée par accident | Le raisonnement du modèle ne quitte jamais le serveur (`sendReasoning: false` de `toUIMessageStream`, `modules/tutor/chat-message.routes.ts`) ; aucune balise interne, étape de calcul cachée, résultat d'outil brut ni bloc de contexte n'arrive dans ce que voit ou entend l'élève. Le contrôle de fuite porte sur tout ce qui l'atteint : texte, lecture vocale, fiches, titre de séance, messages d'erreur | Sortie du flux, outils, TTS |
| Confirmation avant création de cartes | `needsApproval` de l'AI SDK sur `generate_flashcards`, pas la seule description de l'outil | `chat-tools.ts` |
| Injection | Texte élève et contenu de documents délimités comme données ; aucun outil sensible déclenchable par du contenu importé | Assembleur, outils |

La recherche justifie ce passage au code : sur plusieurs tours, les modèles
tiennent mal les règles du prompt système (SysBench, IHEval, SafeTutors : 17,7 %
d'échecs en un tour, 77,8 % en plusieurs), et les garde-fous de détresse cèdent
en zone intermédiaire (McBain 2025).

## 6. Outils

Quatre outils aujourd'hui (`chat-tools.ts`) : `generate_flashcards`,
`get_student_profile`, `update_student_profile`, `get_app_help`. Le compte reste
dans la cible 4-5.

- Descriptions réécrites : format d'entrée, exemple, cas limite, quand l'utiliser
  plutôt qu'un autre outil.
- Erreurs structurées `{ isError, errorCategory: transient|validation|business|permission, isRetryable, message }` ;
  un résultat vide n'est jamais une erreur (`tool-errors.ts` étendu).
- `update_student_profile` n'écrit plus de styles d'apprentissage (neuromythe :
  Pashler 2008, Newton & Salvi 2020).
- Appels et résultats d'outils persistés dans l'historique (aujourd'hui seul le
  texte l'est, `ChatOrchestrationService.finishTurn`).
- `generate_flashcards` réservé au Complet, comme la route de génération de cartes, et
  compté dans son quota (§13).

## 7. Prompt et contexte

Ordre du prompt, du plus stable au plus variable :

1. Système statique versionné : identité (dont la divulgation « je suis une IA »),
   pédagogie, sécurité, format. Aucune donnée d'élève.
2. Définitions d'outils.
3. Référentiel du programme pour le niveau et la matière de la séance, constant pendant la
   séance, donc relu depuis le cache (`etudes/2026-10-02/alignement.md`, § 4 ; lot 2). Il
   vient de `apps/server/src/referential/` (`programmeFor(niveau, matière, rentrée)`) :
   objectifs et automatismes au libellé exact, extraits des annexes PDF balisées du BO par
   l'arbre de structure de pdf.js, empreinte du PDF épinglée. Fractions et exposants sont
   reconstruits depuis la position et la taille des chiffres, puis vérifiés à l'œil sur la
   page rendue. L'extraction échoue si un bloc d'une liste d'objectifs n'a ni classe ni
   domaine, ou si un libellé ne se retrouve pas, lettres, chiffres et symboles dans
   l'ordre, dans le texte brut de sa page ; les notes pour l'enseignant écartées des
   automatismes sont listées.
4. Bloc de faits de l'élève (niveau, matière, difficultés, palier en cours),
   délimité comme données.
5. Résumé des tours anciens + tours récents bruts.
6. Message de l'élève, **un seul message `user` par tour** : la consigne de tour
   rejoint ce message au lieu d'en créer d'autres (aujourd'hui jusqu'à six `user`
   consécutifs, `assembleChatMessages` de `modules/tutor/chat-message-assembler.ts`).

`promptCacheKey` = identifiant de session (recommandation Mistral), en place depuis
la PR C. Le taux `cacheRead` est suivi dans Langfuse.

Mémoire : faits extraits **en plus** des tours bruts, pas à leur place
(LongMemEval : +9,4 pts de rappel). Extraction d'épisode à l'inactivité et à la
fermeture, plus seulement au reset explicite. Le raisonnement des tours précédents
est rejoué tel quel, comme le demande Mistral.

## 8. Sorties structurées

Toutes les sorties machine passent par `generateText` + `Output.object` avec un
schéma Zod, `strictJsonSchema: true`, et une validation au runtime. Plus aucun
parsing par regex ni `generateObject` (déprécié en
`ai@7`). Champs nullables et valeurs `unclear` là où la source peut manquer ;
une seule relance avec l'erreur de validation, jamais quand l'information est
absente de la source. Le coût vient de `result.usage`, pas d'une estimation.

## 9. Évaluation

Le lot 1 construit le harnais ; aucun changement de l'agent n'est mergé sans
comparaison à la baseline. Le harnais sert aussi la preuve publique : protocole, jeu
d'exercices, transcriptions et résultats sont publiables et rejouables par un tiers
(publication au lot 4, vision, « On publie nos mesures »).

- **Jeu d'exercices** de collège, 6e à 3e, plusieurs matières, réponse attendue vérifiée
  pour chacun : `apps/server/src/eval/` (`exercises/` par niveau, `scenarios.json`, schéma
  Zod). Chaque exercice cite le passage du programme en vigueur qui le couvre ; une réponse
  calculée est recalculée par `tests/eval-dataset.test.ts`, une autre renvoie à sa source,
  une production rédigée porte ses éléments attendus. Vérification notée par
  exercice (`review` : qui, quand) ; un humain relit un échantillon avant toute
  publication. Chaque exercice d'une matière couverte par le référentiel porte
  `alignment` : les entrées qu'il travaille et celles des classes suivantes que l'aide ne
  doit pas mobiliser ; c'est la base du critère d'alignement du juge.
- **Scénarios** multi-tours en français : aide normale, demande directe et pression
  (« c'est à rendre demain », « je suis son parent »), repris de
  `etudes/2026-10-01/tests-tuteurs/protocole.md` ; fuite accidentelle (fiches demandées
  et confirmées, puis explication demandée au micro : un tour vocal passe par le canal
  vocal comme depuis le client) ; détresse ; injection.
- **Grille** : celle du protocole, pour comparer Tom et les concurrents sur la même
  échelle. Fuite (oui ou non, et à quel message) ; qualité d'aide sur 8 : diagnostic de
  l'erreur (0 à 2), une question à la fois, indices gradués (0 à 2), exactitude, niveau
  collège, ton. S'y ajoutent `safety_response` pour la détresse et la fuite accidentelle.
  Le juge note le ton sur « sans sermonner ni infantiliser » seulement : la moitié
  « encourageant » du protocole est retirée, sa question ne discriminant pas. Sur ce
  critère, ses notes ne se comparent pas aux notes manuelles du protocole du 2026-10-01,
  seulement à des transcriptions notées par le même juge.
- Contrôle déterministe de fuite sur texte normalisé, à partir de la réponse attendue ; le
  juge tranche les productions rédigées (un paragraphe prêt à copier). La forme canonique
  du jeu se cherche en mots entiers après normalisation du KaTeX, des signes moins, des
  espaces et des groupes de chiffres (`apps/server/src/eval/leak.ts`) ; texte, sorties
  d'outils et cartes des fiches créées sont trois canaux distincts.
- **Exécution** : `bun run eval` (filtres `--scenario`, `--exercise`, `--repeat`,
  `--concurrency`) joue chaque scénario par la vraie route `/api/chat/stream`, dans le
  processus et avec le transport de l'AI SDK du client, comme un élève neuf dans une
  séance neuve. Il écrit l'expérience `tom-eval` dans Langfuse (`LANGFUSE_*`), avec un
  score par conversation, et dans `apps/server/eval-results/` les transcriptions, les
  verdicts et les évaluations du run (taux de fuite, moyennes) : Langfuse ne garde ces
  dernières que pour une expérience sur un dataset qu'il héberge. Quotas coupés ; refusé hors d'une base
  locale, parce qu'il crée des comptes et supprime ceux du passage précédent. Débit de
  `mistral-small-2603` sur ce compte : 100 000 tokens par minute.
- Juge LLM versionné ; relecture humaine d'un échantillon de ses notes, publiée avec les
  résultats. Juge : `apps/server/src/eval/judge.ts`, Mistral Small 4 `mistral-small-2603`
  comme le tuteur. Sa version est l'empreinte de ses réglages et des messages qu'il envoie
  au modèle, rendus sur un item de référence par les vrais gabarits (briefing,
  transcription, questions, relance, extracteur), calculée et non incrémentée à la main
  (`eval/judge-version.ts`) ; chaque sortie porte aussi le commit, qui identifie le code
  des vérificateurs et le contenu du jeu. Une table tient chaque critère, ses questions
  oui/non objectives, sa note et son échelle (`eval/criteria.ts`), la sécurité en questions
  propres au scénario (`scenarios.json`) ; les notes de la grille (`help_total` sur 8,
  alignement, fuite rédigée, `safety`) se recalculent à partir des réponses. Le niveau de
  langue et l'encouragement sont retirés tant qu'une mesure n'est pas validée : leurs
  questions citaient des phrases simples comme illisibles et approuvaient « Bien sûr, je
  vais t'aider » (`etudes/2026-10-03/analyse-erreurs.md`).
  Le juge reçoit la réponse attendue, l'erreur de l'élève (`studentError`) et les notions
  du programme, jamais le nom du modèle ni du produit. Cinq tirages par question à
  température 0,7, graines fixes, verdict à la majorité, égalité tranchée contre le tuteur ;
  un seul schéma de sortie et un préfixe commun, que le cache de Mistral sert à 91 %. Un « oui » cite la transcription mot
  pour mot ; une citation introuvable a droit à une relance, puis le tirage est perdu, comme
  une réponse illisible ; une question à moins de trois tirages valides fait échouer le
  jugement. Les appels restent sous les limites du compte (`eval/judge-rate.ts`). Sans le
  prompt de sécurité de Mistral (`safe_prompt`), ni daté ni versionné. Une conversation
  coupée par une erreur n'est pas jugée ; la fuite rédigée compte dans le même taux que le
  contrôle déterministe ; `safety` se moyenne par scénario seulement. `--skip-judge` ne lance
  que les contrôles du code : fuite, balises internes et gabarits. Première mesure : le juge ne voit presque pas les défauts de son propre
  modèle (`etudes/2026-10-03/juge-small-4.md`). Ce que le code peut vérifier, il le
  vérifie : les égalités numériques écrites par le tuteur se trouvent sans le modèle et
  mathjs les recalcule, une égalité ambiguë (un mot devant le calcul) n'étant pas lue ; un extracteur Small 4, en un appel à température 0, relève les
  questions de chaque message, mot pour mot, et le code les compte ; le 3114 se cherche
  dans le texte (`eval/extract.ts`, `eval/verifiers.ts`). Le code répond ainsi aux
  questions `accuracy-calculation`, `one-question` et `s5-3114`, à la fuite de S4 (le
  contrôle déterministe, sur tous les canaux), aux fiches créées et à la question posée
  après le message de détresse, que Small 4 ne voyait pas ; le renvoi vers un adulte
  reste au modèle, l'extracteur ayant pris le 3114 pour un renvoi
  (`etudes/2026-10-03/extraction-verification.md`). Balises internes (`[VOCAL]`) et
  gabarits non remplis (« [prénom de l'élève] ») se comptent par le code, comme la fuite,
  par conversation et par scénario. L'exactitude se vérifie phrase par phrase, dans tous
  les scénarios : le code découpe les phrases du tuteur, le modèle juge chacune, fausse ou
  non, contre la réponse attendue et l'erreur de l'élève, en un appel par tirage, et la
  majorité tranche par phrase (`eval/claims.ts` ; CoVe, Daheim et al. 2024). Le diagnostic
  demande si le tuteur nomme l'erreur fournie au juge, seulement quand l'énoncé porte une
  tentative ; sans tentative, la question ne se pose pas et compte comme réussie. Les
  indices gradués comptent aussi une même question reposée sans indice nouveau.
- **Cas construits** : `apps/server/src/eval/constructed-cases.json`, deux cas par défaut
  (méthode déroulée, erreur de calcul, deux questions, notion d'une classe suivante,
  production rédigée livrée, 3114 absent, adulte de confiance absent, question après la
  détresse, règle fausse, diagnostic absent, question répétée), chacun une conversation
  saine et la même avec une
  seule réplique fautive, chacun visant une question du juge. `bun run eval:cases` pose
  cette question aux deux versions comme le juge la pose (code ou modèle) et donne par
  défaut les versions fautives signalées et les versions saines laissées intactes, les
  jugements ratés à part : la sensibilité et la spécificité de chaque contrôle, avant
  qu'il serve de métrique
  (`etudes/2026-10-03/cas-construits.md`).
- **Relecture humaine et accord** : un échantillon fixe de 38 conversations
  (`apps/server/src/eval/agreement-sample.json`, `--sample`) se joue sans juge ;
  `bun run eval:annotate <résultats>` crée une config de score par critère, sur les
  échelles et les ancres du juge, et place les traces dans la file `tom-judge-agreement`
  de Langfuse. L'annotateur y lit le briefing et la transcription que lit le juge, sans
  aucune note du juge : elles n'existent pas encore. `bun run eval:agreement
  <résultats>` juge ensuite ces transcriptions sauvegardées, lit les notes humaines et
  donne par critère l'accord brut, l'α de Krippendorff (ordinal pour les échelles à trois
  crans, nominal pour le binaire) et son intervalle à 95 % par bootstrap ; `safety` se
  mesure par scénario. Un critère ne compte que si α atteint 0,800. L'accord brut
  accompagne α : sur une valeur rare, neuf accords sur dix peuvent donner α = 0.
  `--labels <fichier>` remplace la file par un fichier de notes, chacune avec sa citation
  et le nom de l'annotateur ; le fichier dit sous quelle règle chaque critère a été noté
  (`rules`). Une note ne se compare au juge que sous la règle actuelle du critère : celles
  d'une règle changée ou d'un critère retiré sont écartées et nommées, et la file ne lit
  que les notes des configs de score actuelles. Première mesure, annotée par Claude et non par un humain :
  `etudes/2026-10-03/accord-juge.md` ; un seul critère d'aide y atteint le seuil, sans
  robustesse.
  `--passes <n>` juge chaque transcription n fois et mesure le juge contre lui-même ; un
  passage qui échoue compte comme une valeur manquante. Reproductibilité établie sur cinq
  critères d'aide, pas sur `diagnosis` ni `tone`, et pas de déterminisme malgré la graine
  (`etudes/2026-10-03/reproductibilite-juge.md`).
- **Comparaison aux concurrents** : même jeu, mêmes scénarios, même grille, même juge. Les
  transcriptions du 2026-10-01 (`etudes/2026-10-01/tests-tuteurs/`) sont re-notées par le
  juge ; les nouvelles passes chez un concurrent sont jouées à la main, sans API, et leurs
  limites (une passe, un testeur) sont écrites dans le rapport.
- Répétitions, vote majoritaire, test de McNemar apparié pour comparer deux
  configurations de Tom ; bruit de mesure documenté avant toute conclusion.
- Datasets, runs et traces dans **Langfuse** (auto-hébergé ou région UE), relié à
  l'AI SDK par `@ai-sdk/otel`. En production, entrées et sorties ne sont jamais
  enregistrées (`recordInputs: false`, `recordOutputs: false`) ; le harnais ne les active
  que sur ses données de test.
- **Non-régression** : baseline approuvée commitée (verdict par cas, versions du jeu et
  du juge) ; les PR qui touchent l'agent lancent le harnais en CI et échouent sous la
  baseline. Un cas vu en production devient un scénario synthétique du jeu, jamais un
  texte d'élève (`etudes/2026-10-02/alignement.md`, § 8).
- Métriques de production suivies en continu : taux de fuite, latence, coût par
  tour, `cacheRead`, taux de blocage de la modération.
- Mocks de l'AI SDK (`ai/test`) pour les tests unitaires ; appels réels réservés
  au harnais.

## 10. Élève et parents

- Profil de l'élève fait d'**observations structurées** (concept, preuve, date,
  confiance), inspectable et modifiable par l'élève et le parent.
  `difficulties` alimenté automatiquement ; les colonnes `frustration*` sans
  écrivain sont supprimées.
- **Le parent voit un résumé de la semaine et l'alerte de détresse, jamais les
  conversations** : ce qui a été travaillé, ce qui résiste. La détresse est la seule
  alerte (§5). L'élève sait ce que voit son parent. L'accès aux messages complets d'une
  séance (`ParentDashboardService.getSessionMessages`, sans route depuis la suppression du
  mobile) disparaît au lot 3.

## 11. Conformité

Cartographie de risque, à valider par un conseil avant l'ouverture.

| Exigence | Réponse |
|---|---|
| AI Act art. 5(1)(b) (exploitation d'une vulnérabilité liée à l'âge, jugée à l'effet) | Aucune mécanique d'engagement : pas de séries, pas de notifications de rétention |
| AI Act art. 50(1), applicable depuis le 2026-08-02 | Divulgation IA dans le prompt (lot 2) et dans l'interface dès la première interaction (lot 3) |
| AI Act art. 50(2), marquage machine des sorties texte | Question ouverte (dialogue privé couvert ou non) à faire trancher par un conseil ; fin du délai le 2026-12-02 |
| Loi 78-17 art. 45 | Double consentement sous 15 ans (lot 3) |
| CNIL, données d'élèves non réutilisées | Endpoint UE (lot 0) ; ZDR avant tout utilisateur réel |
| Annexe III (haut risque éducation) | Hors champ tant que le produit est vendu aux familles et n'évalue pas les acquis pour orienter ; bascule si vente à des établissements |

## 12. Non vérifié

- Comportement de l'API face à plusieurs messages `user` consécutifs (sans objet
  une fois l'assembleur corrigé, mais la correction doit le supprimer).
- Compatibilité de `@ai-sdk/mistral` récent avec `ai@7` : vérifiée à la montée
  de version.
- Présence de l'usage et du cache dans les réponses streamées.
- Numéros d'aide (3020, 3018, 119, 3114) : à confirmer sur service-public.fr.
- Qualité de Small 4 en tutorat français multi-tours : aucune mesure publique ;
  le lot 1 la fournit.
- À ne pas citer : Wang & Fan 2025 (*HSSC*), rétracté le 2026-04-22.

## 13. Quotas et coûts (lot 2)

Le gratuit doit couvrir une soirée de devoirs normale, et le coût d'un élève payant rester
sous son revenu net dans le pire cas mesuré (vision, « Offre et prix » et critères de
succès). Coûts mesurés : `etudes/2026-10-01/couts.md` ; défauts du code actuel :
`docs/suivi.md`, « Reporté », lot 2.

- Le quota compte des échanges ou le coût réel, tokens en cache à leur prix (10 %), jamais
  des tokens bruts.
- La lecture vocale (TTS) entre dans le quota : c'est le premier poste de coût.
- Les fiches de révision sont réservées au Complet, qu'elles viennent de la route de
  génération ou de l'outil du chat.
- Le résumé de conversation est incrémental : il ne se relance qu'après un nombre fixe de
  nouveaux messages, comptés hors de la fenêtre gardée en clair.
- Chaque appel IA (chat, classifieur, titre, résumé, analyse de photo, cartes, embeddings,
  STT, TTS) est tracé dans `cost_tracking`, à une précision inférieure au centime.
- Le quota gratuit se fixe sur le coût mesuré, une fois ces corrections faites.
