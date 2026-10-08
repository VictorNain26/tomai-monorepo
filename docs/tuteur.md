# Tuteur IA (Tom)

Comment Tom aide, ce que le code garantit, et ce qui reste à construire, marqué comme tel. Cadre
produit : `vision.md` ; le pourquoi des choix : `decisions.md`.

## 1. Principes

- **Ce qui ne doit jamais échouer est garanti par le code**, pas par le prompt : palier d'aide,
  contrôle avant l'élève, modération, détresse (§4).
- **Contenu stable en tête du prompt, variable ensuite**, pour un préfixe en cache (§5).
- **Modèles datés, prompts versionnés** (§2).
- **Sorties structurées validées**, champs nullables plutôt qu'inventés (§6).
- **Le texte de l'élève et les documents importés sont des données**, jamais des instructions
  (§4, §5).
- **Mesurer avant de changer le tuteur** (§7) ; un juge séparé du tuteur, vérifié contre Victor.

Références : [docs.mistral.ai](https://docs.mistral.ai) (prompting, reasoning, moderation,
prompt caching, known limitations), [AI SDK](https://ai-sdk.dev/docs),
[Building effective agents](https://www.anthropic.com/engineering/building-effective-agents),
[OWASP Top 10 LLM](https://genai.owasp.org/llm-top-10/).

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
| Chat élève, texte et image | **Mistral Small 4** `mistral-small-2603` | sans raisonnement sous un contrat de tour, l'exactitude passant par la fiche d'exercice ; sans fiche, `routeReasoningEffort` (`modules/tutor/core/reasoning.ts`) passe en `high` sur une réponse proposée, ou en 4e-3e en maths et sciences sur une demande de solution ou d'explication ; température 0,7, dans la plage de la fiche Hugging Face de Small 4 pour `none` ; `promptCacheKey` par session |
| Lecture d'une image jointe, transcription seule (à construire, avec la photo) | Mistral Small 4 `mistral-small-2603` | `reasoningEffort: 'none'` ; sortie structurée stricte |
| Analyse du tour (`modules/tutor/core/analysis.ts`) | Mistral Small 4 `mistral-small-2603` | `reasoningEffort: 'high'`, température 0,7 : sans raisonnement, une question de fait était lue comme une demande d'explication (`etudes/2026-10-06/passage-de-fin.md`) ; sortie structurée stricte |
| Résumé de séance, titre | Mistral Small 4 `mistral-small-2603` | `reasoningEffort: 'none'` ; texte |
| Fiche d'exercice (`modules/tutor/core/sheet.ts`) | Mistral Small 4 `mistral-small-2603` | `reasoningEffort: 'high'` sans plafond de tokens, borné par un timeout de 20 s ; température 0,7 (« 0.7 for `reasoning_effort="high"` », fiche Hugging Face) ; trois tirages votés ; sortie structurée stricte |
| Diagnostic d'une proposition (`modules/tutor/core/diagnosis.ts`) | Mistral Small 4 `mistral-small-2603` | `reasoningEffort: 'none'`, température 0, contre la fiche ; mathjs tranche quand il sait lire ; sortie structurée stricte |
| Modération entrée/sortie | `mistral-moderation-2603` | Catégories par sens (§4) |
| STT / TTS (à construire, avec la voix) | Voxtral via `@mistralai/mistralai` (`audio.*`) | Timeout explicite ; français imposé à la transcription ; voix `fr_marie_*` |
| Juge d'évaluation (à construire, lot 1) | Mistral Small 4 `mistral-small-2603` | Questions oui/non en JSON strict, référence fournie |

Small 4 : 256k de contexte, function calling, sorties structurées, raisonnement
([fiche](https://docs.mistral.ai/models/mistral-small-4-0-26-03), prix dans
`platform/ai/cost.ts`), multimodal texte + image ([annonce](https://mistral.ai/news/mistral-small-4) :
« Native multimodal: Accepts both text and image inputs » — la page vision de la
doc, arrêtée à Medium 3.1, ne le mentionne pas encore).

Un seul LLM pour tous les rôles texte, juge compris (`decisions.md`) : moins de variables à
évaluer, un seul cache ; le juge note donc son propre modèle, biais que sa conception et la
mesure d'accord doivent contenir.

**Identifiants datés uniquement**, jamais d'alias `-latest` : un alias change de
modèle sans prévenir et invalide l'évaluation. Chaque prompt porte une version
(`PROMPT_VERSION`), journalisée avec l'ID du modèle à chaque tour.

**Pièges vérifiés** :
- `@ai-sdk/mistral` n'envoie `reasoning_effort` que pour les IDs de sa liste interne : un
  nouveau modèle s'y vérifie, faute de quoi il ne raisonne jamais.
- `safePrompt` est déprécié par Mistral au profit des Custom Guardrails
  ([source](https://docs.mistral.ai/resources/deprecated/guardrailing/safe_prompt)) : on ne
  l'utilise pas ; ce qui atteint l'élève passe par la modération d'entrée et de sortie.
- Chaque appel au modèle est entier, sans flux (`generateText`) : son usage, `cacheRead` compris,
  arrive avec sa réponse et se compte au coût (`platform/ai/client.ts`) ; un appel coupé par son
  délai ne rapporte pas d'usage.
- `reasoning_effort` n'a pas de budget de tokens : un appel qui raisonne n'a pas de
  `maxOutputTokens`, sa borne est le timeout.
- Le cache de préfixe se règle par `promptCacheKey` ; les tokens servis par le cache coûtent 10 %.
- Agents, Batch et Files ne sont pas servis sur l'endpoint UE : la boucle du tour est la nôtre.
- **Débit** : en mode gratuit, 100 000 tokens par minute pour l'organisation ; une fiche
  d'exercice en prend environ 78 000 (trois tirages de 26 000 tokens d'entrée), et la première
  réponse d'un exercice arrive après 12 à 15 s (mesuré le 2026-10-08). Le paiement à l'usage lève
  le plafond ; l'attente se conçoit dans l'écran de séance.

## 3. Pédagogie

- **Échelle d'indices graduée**, palier courant tenu **côté serveur** par exercice
  (`modules/tutor/core/ladder.ts`) : relance → indice conceptuel → indice ciblé → étape intermédiaire →
  exemple analogue entièrement résolu. Jamais la réponse de l'exercice de l'élève lui-même.
  Le palier monte avec les tentatives réelles, ou après deux « je sais pas » de suite sans
  tentative (décision de Victor du 2026-10-06), et descend quand l'élève réussit ; une demande
  de solution seule ne le fait jamais monter.
  Appui : Bastani 2025 (les indices conçus par des enseignants annulent la perte
  d'apprentissage), RCT LearnLM collège (44,3 % des éditions humaines servent à
  éviter la frustration), Sweller 2019 (exemples résolus pour le novice).
- **Diagnostic de l'erreur avant toute aide** (Wang et al., NAACL 2024).
- **La réponse de l'exercice n'est jamais donnée, qu'il s'agisse d'un fait ou d'un
  raisonnement** : dans un devoir, le fait demandé est ce que l'élève doit rendre. Un fait
  d'appui (définition, règle) se donne après une vraie tentative, et une bonne réponse de
  l'élève se confirme.
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
  (`SCHOOL_LEVELS`, `domain/levels.ts`, d'où dérive l'enum `school_level`) ; le
  prompt ne parle que du collège.
- **Une seule taxonomie** `domain/subjects.ts` : familles pour l'analyse du tour et les
  consignes du tuteur, slugs du collège pour le référentiel et le jeu. Le slug se valide aux routes, la séance garde une famille. Un bloc
  matière existe pour chaque famille, `langues` et `general` compris.
- Ce que Tom promet en public, la landing ne le dit qu'une fois mesuré par le harnais.

## 4. Garde-fous par le code

| Garde-fou | Mécanisme | Où |
|---|---|---|
| Modération d'entrée | `mistral-moderation-2603` par `studentTurn` (`platform/ai/moderation.ts`), qui classe le message de l'élève avec le dernier message du tuteur en contexte ; catégories `sexual`, `selfharm`, `jailbreaking`, `pii`, `violence_and_threats`, `dangerous`, `criminal` gardées avec le message ; `selfharm` décide la détresse, les autres se mesurent sans bloquer (un devoir d'histoire touche à la violence) ; modération indisponible : les règles seules jugent la détresse, l'échec journalisé (`modules/tutor/service.ts`) | En parallèle de l'analyse du tour, avant le premier mot |
| Contrôle avant l'élève | Le message entier est généré, contrôlé, puis envoyé ; celui qui est envoyé est celui qui est persisté (`modules/tutor/core/controlled-turn.ts`, `modules/tutor/core/output-check.ts`). Déterministe : réponse et ses formes comparées à la fiche d'exercice, une forme déjà écrite par l'élève et jugée juste restant permise pour la confirmer ; une fiche incertaine tenue aux formes de tous ses tirages, et une fiche absente à un palier bas (le contrôle échoue fermé) ; balises et gabarits ; égalités recalculées par mathjs. Sur un échec, une régénération sous contrainte, puis une réponse de repli fixe, l'événement tracé | Entre l'appel du rédacteur et l'élève ; aussi sur le titre de séance |
| Modération de sortie | Même modèle sur le message entier, en parallèle du contrôle ; catégories bloquantes `OUTPUT_BLOCKING` ; même action sur un blocage | Avant l'élève |
| Détresse | Classifieur indépendant du prompt (catégorie Self-Harm + règles en français, testés sur des phrases d'élèves) ; réponse fixe rédigée et approuvée par un humain, avec le 3114 et un adulte de confiance, et, à construire au lot 3, le 119 quand le message laisse penser que le danger vient de la maison, puis fin de la conversation (Crawford et Glatard, CMAJ 2026) ; numéros d'aide vérifiés sur service-public.gouv.fr F33954. Ni fiche ni tuteur (l'analyse du tour, lancée en parallèle, est écartée) : la réponse est gardée avec le message, la séance close (tout message suivant reçoit la même réponse), l'événement enregistré, un par séance, rattaché à l'élève et sans score (`distress_event`, `modules/tutor/schema.ts`), pour la revue humaine du lot 3 : un humain relit chaque événement et décide d'un message au parent, qui n'en reçoit que le motif et des ressources, l'élève prévenu d'abord (`etudes/2026-10-07/foyer-eleve-age.md`). Ni quota, ni limite de flux, ni écriture en échec ne retiennent la réponse (`modules/tutor/service.ts`, règles dans `domain/distress.ts`) | Même point d'entrée |
| Fuite de réponse | Palier d'aide imposé par le serveur (§3) ; la recherche de la réponse dans le texte (`findLeakForm`, `domain/leak.ts`), partagée avec le harnais, tourne dans le contrôle avant l'élève | Assembleur de tour, contrôle avant l'élève |
| Aucune solution montrée par accident | Le raisonnement du modèle ne quitte jamais le serveur : seul le texte contrôlé part dans le flux (`modules/tutor/routes.ts`) ; aucune balise interne, étape de calcul cachée, résultat d'outil brut ni bloc de contexte n'arrive dans ce que voit ou entend l'élève. Le contrôle de fuite porte sur tout ce qui l'atteint : texte, titre de séance, messages d'erreur, et la lecture vocale à venir | Sortie du tour |
| Injection | Texte élève et contenu de documents délimités comme données ; aucun outil sensible déclenchable par du contenu importé | Assembleur, outils |

La recherche justifie ce passage au code : sur plusieurs tours, les modèles
tiennent mal les règles du prompt système (SysBench, IHEval, SafeTutors : 17,7 %
d'échecs en un tour, 77,8 % en plusieurs), et les garde-fous de détresse cèdent
en zone intermédiaire (McBain 2025).

## 5. Prompt et contexte

Ordre du prompt, du plus stable au plus variable (`assembleChatPrompt`,
`modules/tutor/core/assembler.ts`) :

1. Système statique versionné : identité, pédagogie, sécurité, format. Aucune donnée d'élève.
   Aujourd'hui, Tom ne dit qu'il est une IA que si l'élève le demande (`prompt.ts`) ;
   l'art. 50(1) de l'AI Act demande qu'il le dise dès la première interaction (lot 3).
2. Exercice en cours (`exerciseBlock`, `modules/tutor/core/sheet.ts`) : son énoncé, délimité comme
   donnée, les notions du programme de la classe que la fiche lui rattache et celles des
   classes suivantes à ne pas utiliser ; jamais la réponse ni les étapes. Les notions
   viennent du référentiel (`apps/server/src/referential/`, en mathématiques et en français) :
   la fiche reçoit le programme de la classe et des classes suivantes
   (`programmeFor(niveau, matière, rentrée)`, `notionsFor`) et n'en retient que les entrées
   de l'exercice (`keepKnownNotions`), au libellé exact. Extraction et contrôles du
   référentiel : en tête de `referential/extract.ts`.
3. Textes des fichiers de la séance, dans l'ordre où ils ont été joints (à construire, avec la
   photo).
4. Résumé des tours anciens + tours récents bruts, rejoués avec leur raisonnement. Le tour
   n'appelle aucun outil.
5. Message de l'élève, **un seul message `user` par tour**, qui porte aussi ce qui change
   d'un tour à l'autre : bloc de la matière ; contrat du tour (palier autorisé, indices
   déjà donnés, diagnostic) entre balises `<contrat>`, que seul le serveur écrit ; texte de l'élève
   entre `<student_message>`, ces balises neutralisées dans son texte. Placé avant
   l'historique, un bloc qui change à chaque tour casserait le cache. Le prompt système dit
   quels blocs viennent du serveur (`<subject_specifics>`, `<critical_instruction>`,
   `<contrat>`) ; deux messages `user` de suite sont fusionnés.

Aucune consigne du serveur dans un bloc déclaré non fiable.

`promptCacheKey` = identifiant de session (recommandation Mistral). Les tokens servis par le
cache sont gardés par appel dans `ai_cost` (`cached_input_tokens`, `platform/ai/schema.ts`).

Mémoire de la séance : le raisonnement des tours précédents est rejoué tel quel, comme le
demande Mistral. Le résumé de conversation est incrémental : l'ancien résumé et les seuls
messages qu'il ne couvre pas, hors des dix derniers.

Mémoire d'une séance à l'autre (`etudes/2026-10-07/memoire-entre-seances.md`) : une mémoire
d'apprentissage, jamais de compagnon.
- À chaque tour d'un exercice, le serveur agrège pour les notions de sa fiche les exercices
  antérieurs de l'élève sur l'année scolaire (fois travaillée, palier atteint, résolution, type
  d'erreur fréquent) : le même bloc d'un tour à l'autre, donc en cache.
- Le serveur l'écrit, jamais le modèle : aucun texte de l'élève, aucune conversation, que des
  libellés du référentiel, des nombres et des types d'erreur d'une liste fermée.
- Rien de la détresse, de la santé, des émotions ou de la vie de l'enfant ; aucune relance.
- Active seulement avec l'accord du parent et de l'enfant (de l'élève seul à partir de 15 ans) ;
  remise à zéro à la rentrée. Une désactivation, une correction ou un effacement jouent dès le
  tour suivant.
- Ni embeddings ni bibliothèque de mémoire ; l'idée fausse nommée par un appel structuré ne
  viendra que sur mesure.

## 6. Sorties structurées

Toutes les sorties machine passent par `generateStructured` (`platform/ai/client.ts`) :
`generateText` + `Output.object` avec un schéma Zod, `strictJsonSchema: true` sur chaque appel,
et une validation au runtime. Aucun parsing par regex ni `generateObject` (déprécié en
`ai@7`). Champs nullables et valeurs `unclear` là où la source peut manquer ;
une seule relance avec l'erreur de validation, jamais quand l'information est
absente de la source. Le coût vient de `result.usage`, pas d'une estimation.

## 7. Évaluation

Repères : `etudes/2026-10-06/refonte-evaluation.md`, sauf ses décisions 2 et 4, remplacées
(`decisions.md`, « Tuteur et évaluation »). Le code vit dans `apps/server/src/eval/` ;
`bun run eval` rejoue le jeu sur le vrai tuteur et écrit ses transcriptions dans
`eval-results/`. Le harnais sert aussi la preuve publique : protocole, jeu et résultats
rejouables par un tiers.

- **Ce que le code peut vérifier, il le vérifie** : fuite de la réponse avec `domain/leak.ts`, la
  même recherche qu'en production, artefacts, détresse ; ces mesures font foi en priorité.
- **Victor juge** sur une page simple (à construire) : quatre questions oui/non par conversation.
  Le juge, Small 4, ne compte qu'une fois vérifié contre lui.
- **Une mesure par version du tuteur**, avec sa marge d'erreur ; deux versions se comparent cas
  par cas sur les mêmes conversations (McNemar), sur au moins 150 conversations de pression ; un
  passage ne prouve pas « moins de 1 % », il en faudrait au moins 300.
- **Le hasard reste** : chez Mistral, une température de 0 et une graine fixe ne rendent pas une
  réponse déterministe (4 notes changées sur 27 conversations en trois passages, mesuré le
  2026-10-03) ; une mesure se répète plutôt que de compter sur la graine.
- **Jeu et scénarios** : exercices de collège à réponse vérifiée, rattachés au programme ;
  scénarios d'aide, de pression, de détresse et d'injection. Rien n'est copié hors citations des
  programmes.
- **Concurrents** : même jeu, mêmes scénarios, même grille, limites écrites.
- **Non-régression** : un garde-fou en CI sur les changements du tuteur, centré sur la fuite
  (à construire, lot 1).
- **Données de test seulement** : les conversations sont synthétiques ; en production, ni
  entrées ni sorties dans les traces, et les messages d'erreur nettoyés avant tout export.

## 8. Élève et parents

- **La mémoire d'apprentissage (§5)** : avant 15 ans, proposée par le parent à l'ajout de
  l'enfant, acceptée par l'enfant à sa première séance, coupée par l'un ou l'autre à tout moment ;
  à partir de 15 ans, l'élève décide seul. L'élève voit ce
  que Tom retient, notion par notion, le corrige ou l'efface ; le parent n'en voit que ce que
  dit le résumé.
- **Le parent voit un résumé de la semaine ; les conversations ne lui sont jamais envoyées** (en
  6e et 5e, il peut ouvrir le profil de l'enfant sur l'appareil de la famille, ce que l'enfant
  sait) : les sept derniers
  jours, calculés par le code sans modèle (`modules/tutor/core/week-summary.ts`) ; les matières,
  le temps passé (de l'ouverture de la séance, d'un message à l'autre, une pause au-delà de
  10 minutes, rien après une détresse), les notions qui résistent (dernier exercice travaillé dans
  la semaine non résolu après une aide, ou résolu avec une aide allée jusqu'à « Étape
  intermédiaire »). L'élève voit le même résumé (`GET /api/summary`), son parent par
  `GET /api/summary/:studentId`. À construire au lot 3 : l'écran, écrit comme des pistes de
  conversation, et l'arrêt à la demande de l'élève ; à partir de 15 ans, sa demande s'applique,
  le parent prévenu.
- **En 6e et 5e, le mode accompagné** (à construire, lot 3 ; `decisions.md`) : le parent lance la
  séance, l'appareil passe au profil de l'enfant, « Je reste à côté » ou « Il travaille seul ce
  soir ». À côté, Tom propose au parent au plus trois ou quatre pistes par séance (rôle au
  lancement, puis stratégie, réparation, étape, adaptés des types de ParaTutor), au lancement, à
  un blocage, à une frustration et à la fin, de vingt mots au plus, visibles de l'enfant ; une
  piste ne donne jamais plus que le cran courant de l'enfant, et le contrôle de sortie s'y applique
  comme à une réponse. Formulations et sources : `etudes/2026-10-08/aide-parentale.md`, § 6 (c).
- **La détresse n'alerte pas le parent d'office** : un humain relit l'événement et décide (§4).
- **Un second parent** peut rejoindre le foyer et s'opposer (à construire, lot 3, avec le
  consentement).
- La façon d'accompagner suit le niveau : accompagné du CP à la 5e, guidé en 4e et 3e, autonome
  au lycée (`decisions.md`, revu le 2026-10-08 ; le modèle d'origine :
  `etudes/2026-10-07/foyer-eleve-age.md`).

## 9. Conformité

Cartographie de risque, à valider par un conseil avant l'ouverture.

| Exigence | Réponse |
|---|---|
| AI Act art. 5(1)(b) (exploitation d'une vulnérabilité liée à l'âge, jugée à l'effet) | Aucune mécanique d'engagement : pas de séries, pas de notifications de rétention |
| AI Act art. 50(1), applicable depuis le 2026-08-02 | Divulgation IA dans le prompt et dans l'interface dès la première interaction : pas encore faite (lot 3), condition du premier élève réel |
| AI Act art. 50(2), marquage machine des sorties texte | Question ouverte (dialogue privé couvert ou non) à faire trancher par un conseil ; le délai au 2026-12-02 ne vaut que pour un système sur le marché avant le 2026-08-02 (source secondaire, à confirmer par le conseil) |
| Loi 78-17 art. 45 | Double consentement sous 15 ans pour ce qui repose sur le consentement ; le parent conclut le contrat (lot 3) |
| Conditions commerciales de Mistral, 2.2(c), version du 2026-09-25 : pas de données personnelles d'enfants sous l'âge du consentement numérique (15 ans en France) | Clarification écrite demandée à Mistral avec le ZDR ; aucun vrai élève avant sa réponse. Le prénom et la mémoire d'apprentissage partent dans le prompt ; si Mistral refuse, ils en sortent (Victor, 2026-10-07) |
| RGPD art. 9 (la détresse est une donnée de santé) ; Code pénal art. 434-3 | Base légale et conduite à tenir à faire trancher par un conseil (`etudes/2026-10-07/foyer-eleve-age.md`, § 8) |
| Cadre d'usage de l'IA du ministère (2025) : usage autonome à partir de la 4e | Pèse sur une recommandation par un collège en 6e et 5e ; texte complet à lire |
| CNIL, données d'élèves non réutilisées | Endpoint UE ; ZDR avant tout utilisateur réel |
| RGPD art. 4(4) et 22, CNIL recommandation 8 (profilage d'un mineur) ; FAQ de la CNIL sur l'IA dans l'éducation (juin 2025 : AIPD « en principe » requise sur des données d'élèves mineurs) | La mémoire d'apprentissage : désactivée tant que le parent et l'enfant ne l'acceptent pas, aucune décision automatisée, AIPD avant le premier élève réel (`etudes/2026-10-07/memoire-entre-seances.md`) |
| Annexe III (haut risque éducation) | Hors champ tant que le produit est vendu aux familles et n'évalue pas les acquis pour orienter ; bascule si vente à des établissements |

## 10. Non vérifié

- Numéros d'aide : 3114, 15 et 112, ceux de la réponse de détresse, sont vérifiés
  (service-public.gouv.fr F33954, 3114.fr) ; 3020, 3018 et 119 sont à vérifier avant de
  servir.
- Canal vocal : le harnais déclare un tour vocal (`inputMode: 'voice'`) sans envoyer d'audio ;
  transcription et lecture vocale ne sont pas jouées.
- Qualité de Small 4 en tutorat français multi-tours : aucune mesure publique ; celle du
  harnais n'est pas encore publiée.
- À ne pas citer : Wang & Fan 2025 (*HSSC*), rétracté le 2026-04-22.

## 11. Quotas et coûts

Le gratuit doit couvrir une soirée de devoirs normale, et le coût d'un élève payant rester
sous son revenu net dans le pire cas mesuré (vision, « Offre et prix » et critères de
succès). Coûts mesurés : `etudes/2026-10-06/passage-de-fin.md` ;
quotas et rentabilité : `etudes/2026-10-07/rentabilite.md`.

- Chaque appel IA facturé est tracé dans `ai_cost` par construction, en micro-euros
  (`platform/ai/cost.ts`) : chat, analyse du tour, fiche, diagnostic, titre, résumé ; la lecture
  d'image et la voix le seront à leur arrivée. La modération, gratuite, ne l'est pas.
- Le quota est un budget du jour par élève, lu dans `ai_cost` : le coût réel, tokens en cache à
  leur prix (10 %), lecture vocale comprise, jamais des tokens bruts ; 2 c pour tous tant que le
  paiement n'existe pas, puis 2 c en Gratuit et 10 c en Complet, le jour commençant à 4 h à Paris (`domain/quota.ts`). Vérifié à
  l'ouverture d'un tour (`modules/tutor/service.ts`) : au-delà, le tour est refusé avant tout
  modèle, sauf une détresse ; un quota illisible refuse le tour.
- Le résumé de conversation est incrémental : il ne se relance qu'après un nombre fixe de
  nouveaux messages, comptés hors de la fenêtre gardée en clair.
- Le budget du Gratuit se fixe sur le coût mesuré.
