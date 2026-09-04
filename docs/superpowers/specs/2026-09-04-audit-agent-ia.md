# Audit du dépôt et de l'agent IA — 2026-09-04

Base auditée : `main@d8f6674`, arbre de travail `chore/claude-config-audit`.
Ce document est la **spec** dont dérivent les plans `docs/superpowers/plans/2026-09-04-*.md`.
Il ne décrit que ce qui a été lu ou exécuté ; la section « Non vérifié » liste le reste.

## 1. Cartographie

| Périmètre | Lignes TS | Faits |
|---|---|---|
| `apps/server/src` hors tests | 25 800 | Bun 1.3, Elysia 1.4, Drizzle 0.45, PostgreSQL 16 + pgvector, 69 handlers, 20 services, 15 repositories |
| `apps/server/src/services/chat` (22 fichiers) | 3 500 | orchestration, outils, résumé, classifieur, budget tokens |
| `apps/server/src/config/prompts` + `shared/pedagogy` | 800 | 8 blocs, ~7 800 caractères ≈ 1 900 tokens assemblés |
| `apps/server/src/services/learning` + `fsrs.service.ts` | 1 900 | ts-fsrs 5, config par niveau, 15 types de cartes |
| `apps/mobile/src` | 21 000 | Expo 56 / RN 0.85, 30 écrans (5 auth, 13 élève, 12 parent), TanStack Query 5, un store Zustand, SQLite offline |
| `apps/landing` | 2 200 | Next 16, 7 routes, tous les CTA vers une waitlist |
| `packages/api` | 363 | Eden Treaty sur `dist/types/app.d.ts`, une seule interface client (`IAppUser`) |

Historique : 1 416 commits depuis le 2025-11-04, un développeur humain, dernier commit le 2026-08-24. Rien n'est déployé.

**Boucle d'un tour de chat** (`routes/chat-message.routes.ts` → `chat-orchestration.service.ts` → `ai-chat.service.ts`) :

1. Quota tokens, contenu non vide, 2 streams max par utilisateur.
2. `prepareTurn` : six lectures en parallèle — OCR des fichiers, images base64, résumé du profil cognitif, contexte FSRS (cartes dues + matières à lapses), classification d'intention (`ministral-8b`, JSON strict, 96 tokens), mémoire épisodique (embed `mistral-embed` + pgvector top-3, seuil cosinus 0,6).
3. Résolution de matière : détectée si ≠ `general`, sinon celle de la session, sinon le hint client.
4. Assemblage (`chat-message-assembler.ts`) : `system` → résumé (rôle `user`) → 20 derniers messages (10 si résumé) → `<student_context>` → `<pronote_data>` → `<attached_file>` → `[Consigne pour ce tour]` → `[VOCAL]` → `<student_message>`. Jusqu'à six messages `user` consécutifs avant le message réel.
5. `streamText` sur `mistral-medium-latest`, température 0,7, 16 384 tokens de sortie max, 4 outils (`generate_flashcards`, `get_student_profile`, `update_student_profile`, `get_app_help`), 5 étapes max, `parallelToolCalls: false`, `reasoning_effort: high` si collège+ ET STEM ET intention dure, `prompt_cache_key` injecté par un `fetch` custom.
6. `onFinish` : persistance du texte seul (les appels d'outils ne sont pas conservés), quota, coût, résumé en arrière-plan (`mistral-small`, à partir de 20 messages puis tous les 10), titre (`ministral-3b`).
7. Extraction d'épisode (`mistral-medium` + embedding) **uniquement** sur `resetSession` explicite ; agrégation dans `student_subject_profile`.

**Client** : `useChat` + `DefaultChatTransport`, seul le dernier `UIMessage` est envoyé. Le mobile aplatit les parts en texte ; Markdown, KaTeX et Mermaid sont rendus par WebView + CDN ; les parts `tool-*` ne servent qu'à un libellé de statut ; aucune part `reasoning` rendue.

**Documentation** : plus de dossier `docs/` ; « ADR 0001 » cité dans `CLAUDE.md:47`, `.claude/rules/design-system.md:22`, `apps/mobile/CLAUDE.md:26` (frontière DOM/RN) **et** « ADR-0001 D2/§D7 » dans sept services serveur (choix de modèles) : deux ADR différents, aucun fichier. `apps/mobile/README.md` et `app.config.ts` annoncent SDK 55 / RN 0.83.

**Tests** : 76 fichiers serveur verts via `scripts/run-tests.ts` (un process par fichier ; `chat-session.test.ts` est dans `SKIPPED_FILES`). Un `bun test` brut donne 208 échecs par fuite de `mock.module`. Mobile : 32 fichiers, plancher de couverture 8 %. **Aucune évaluation pédagogique** : zéro dialogue de référence, zéro juge, zéro test multi-tours. Le commentaire de `intent-classifier.service.ts` (« measurably reducing answer-leaks in internal tests ») n'a aucun artefact.

## 2. Constats vérifiés

| # | Constat | Preuve |
|---|---|---|
| F1 | **Sept vocabulaires de matières** coexistent : `STUDENT_SUBJECTS` (6 familles, classifieur + route `/student/memory` + profil matière), `SUBJECT_SLUGS` (13 slugs, outils), `STEM_SUBJECTS` (5 slugs, reasoning), `normalizeSubject` (bloc prompt, texte libre), `SUBJECT_MAPPING` (cartes, texte libre), `SUBJECTS_BY_LEVEL` (ids `physique_chimie`, exposés au client), `SUBJECT_METADATA` mobile (10 ids underscore) | `grep` des symboles, 2026-09-04 |
| F2 | `generateSubjectBlock('langues')` et `('general')` renvoient `null` : aucun bloc matière pour les langues vivantes ni le fallback multi | script `probe-prompt.ts` exécuté : `NULL (aucun bloc)` |
| F3 | `routeReasoningEffort({ subject: 'sciences' })` renvoie `none` : le reasoning n'est jamais activé pour la famille `sciences` émise par le classifieur | même script : `reasoning(terminale, sciences, solve-this-for-me) -> none` |
| F4 | Le prompt se contredit : « Ne donne JAMAIS le résultat final — même réclamé, même si l'élève bloque » (`csen-principles.ts:91`), « après 2-3 échanges tu peux révéler une étape intermédiaire » (`intent-classifier.service.ts:168`), « Chain-of-Thought obligatoire. Étape par étape » (`by-subject.ts:22`) | lecture |
| F5 | Restes du RAG supprimé (PR #294) : « Ne mentionne jamais : tes sources, Éduscol » (`identity.ts:35`), `ragMaxTokens` 20 % du budget (`token-budget.service.ts:52`), `usedRAG` dans `TomMetadata`, en-tête « recherche vectorielle RAG » de `mistral-embeddings.service.ts`, tarifs `magistral-*` dépréciés dans `cost-tracking.service.ts` | lecture ; `docs.mistral.ai/capabilities/reasoning/` marque Magistral déprécié |
| F6 | Profil cognitif : `preferredStyle` ∈ {visuel, auditif, kinesthesique, lecture-ecriture, mixte} (`chat-tools.ts:63`, `student_cognitive_profiles.preferred_style`) | lecture |
| F7 | Colonnes `frustrationLevel`, `questionLevel`, `frustrationAvg` jamais écrites, exposées au parent (`parent-dashboard.service.ts:179`) ; `student_subject_profile.difficulties` toujours `[]` (`subject-profile.service.ts:26`) | `grep` des écritures : aucune |
| F8 | Mémoire épisodique alimentée uniquement sur reset explicite (`chat-session.service.ts:326`) ; le seuil 0,6 n'a jamais été validé | lecture |
| F9 | Le parent lit l'intégralité des transcripts de l'enfant (`getSessionMessages`) | lecture |
| F10 | Landing : « entraîné sur 415 programmes officiels Éduscol » (`app/page.tsx:35`), « 30+ matières couvertes » (`stats.tsx:9-12`), « limites de temps d'utilisation quotidiennes » (`faq.tsx:27`, `page.tsx:27`), « Hébergé en France » (`hero.tsx:43`, `faq.tsx:37`) vs « en Europe » (`page.tsx:43`) : rien de tout cela dans le code | lecture |
| F11 | Mobile : libellé pour l'outil `search_educational_content` qui n'existe plus côté serveur (`ui-message.ts:90` + 3 tests) | lecture |
| F12 | `@ai-sdk/mistral@4.0.5` transmet bien `reasoningEffort`, `parallelToolCalls`, `safePrompt`, `strictJsonSchema` ; `mistral-medium-3-5` supporte `reasoning_effort` `high`/`none` | `node_modules/@ai-sdk/mistral/dist/index.js:265-498` ; doc Mistral reasoning |

## 3. Ce que dit la recherche (sources lues le 2026-09-04)

**Sur « ne jamais donner la réponse ».** Bastani et al., *PNAS* 2025 (≈1 000 lycéens) : ChatGPT brut −17 % à l'examen sans IA ; « GPT Tutor » avec indices conçus par les enseignants annule la perte sans créer de gain durable. Kestin et al., *Scientific Reports* 2025 (RCT N=194) : effet 0,63 à 1,3 SD avec un prompt contenant les solutions pas-à-pas et un scaffolding séquentiel. LearnLM/Eedi, arXiv 2512.23633 (RCT, 165 élèves de 13-15 ans) : 44,3 % des éditions des tuteurs humains servaient à relâcher le rythme pour éviter la frustration. Kirschner, Sweller & Clark 2006 ; Sweller, van Merriënboer & Paas 2019 : exemples résolus > résolution pour le novice, effet qui s'inverse avec l'expertise (expertise reversal, Kalyuga et al. 2003). Brender et al., AIED 2026 (best paper) : le tuteur socratique gagne en autonomie différée mais est perçu « moins efficace ». Pisan, arXiv 2608.12292 : échelle d'indices H0→H7 avec plafond d'aide par tour lié à la maîtrise (sans mesure d'apprentissage).

**Sur le suivi des règles par le modèle.** SysBench (arXiv 2408.10943) : Mixtral-8x22B 63,6 %, Mixtral-8x7B 56,5 % de contraintes système satisfaites, stabilité sur 5 tours ≤ 54 %. IHEval (NAACL 2025) : Mistral-Large 2407 29,4 % de bonnes réponses quand l'utilisateur pousse contre le system prompt. ComplexBench (NeurIPS 2024) : les contraintes conditionnelles sont les plus fragiles. MRBench (NAACL 2025) : GPT-4 révèle la réponse ≈47 % du temps, expert humain 9 %. PEARL (arXiv 2605.29582) : modèle ouvert non aligné, fuite de réponse 41 %. SafeTutors (arXiv 2603.17373) : échecs 17,7 % en mono-tour → 77,8 % en multi-tours. Wang et al., NAACL 2024 : diagnostiquer l'erreur avant de répondre, +76 % de préférence.

**Sur le modèle de l'élève.** Pashler, McDaniel, Rohrer & Bjork, *PSPI* 2008 et Newton & Salvi, *Frontiers in Education* 2020 : aucune preuve que l'appariement aux styles d'apprentissage améliore l'apprentissage. Hooshyar et al., arXiv 2512.23036 : mises à jour de maîtrise incohérentes quand le LLM seul tient le modèle (DKT AUC 0,83). srs-benchmark : FSRS-6 bat FSRS-4.5 sur 92,4 % des collections ; « 20-30 % de révisions en moins que SM-2 » est une simulation, pas une mesure.

**Sur la mémoire.** LongMemEval (ICLR 2025) : remplacer les tours bruts par des résumés dégrade ; ajouter des faits extraits aux tours bruts +9,4 pts de rappel. MemDelta (arXiv 2606.29914) : changer l'embedding renverse les conclusions.

**Sur l'exactitude.** GSM-Symbolic (ICLR 2025) : Mistral-7B 56 % → 16 % avec une donnée superflue dans l'énoncé. Steinbach et al., L@S 2025 (RCT N=252) : les élèves faibles ne détectent pas les erreurs du tuteur. Adenuga, *Frontiers in Education* 2026 : le RAG améliore la pédagogie, pas l'exactitude, et ajoute du contenu non étayé (13/192 vs 1/192).

**Sur les mineurs.** McBain et al., *Psychiatric Services* 2025 : garde-fous corrects aux extrêmes du risque suicidaire, défaillants en zone intermédiaire. Judd et al., arXiv 2510.27521 : le « refus + numéro » peut désengager. CNIL/Ipsos, mai 2026 (FR n=1 000) : 33 % voient l'IA comme un thérapeute, 48 % lui confient des sujets intimes. Hinduja & Patchin, *J. Adolescence* 2026 : 47 % des ados utilisateurs rapportent un préjudice. Cheng et al., *Science* 2025 : les modèles sycophantes sont préférés et réutilisés.

**Sur le droit.** AI Act art. 50 (information qu'on parle à une IA) applicable depuis le 2 août 2026. Annexe III point 3(b) (évaluer les acquis pour orienter l'apprentissage) : échéance reportée au 2 décembre 2027 par le règlement 2026/1744 selon Gibson Dunn et lawandtechnology.eu, EUR-Lex non récupéré. Loi 78-17 art. 45 : consentement seul à 15 ans, double consentement en dessous. CNIL recommandation 4 (2021) et FAQ IA à l'école (2025).

**Sur Mistral.** Aucune évaluation pédagogique publiée de Medium 3.5. Magistral (arXiv 2506.10910) : 68,5 % en français vs 73,6 % en anglais sur AIME. BFCL v4 (2026-04-12) : Mistral-small-2506 37,15 % global, appel simple 74-90 %, multi-tours 11,5 %.

**À ne pas citer** : Wang & Fan 2025 (*HSSC*, g = 0,867), rétracté le 2026-04-22.

## 4. Décisions

D1 à D8 sont la position du tech lead. D2, D9, D10 et D11 ont été **confirmées par Victor le 2026-09-04**.

| # | Décision | Statut | Justification |
|---|---|---|---|
| D1 | **Une seule source de taxonomie** `apps/server/src/config/subjects.ts` : 6 familles (contrat client inchangé) + 13 slugs fins ; `histoire`/`geographie` fusionnés en `histoire-geo`, `italien` ajouté (déjà dans le mobile) | proposée | F1-F3 ; contrat Eden `/student/memory` intact |
| D2 | **Le « jamais la réponse » absolu évolue vers une échelle d'indices graduée** avec paliers et sortie explicite (phase 2). La copy landing qui promet le refus absolu change en phase 2, pas en phase 0 | **confirmée** | §3 : Bastani 2025 (indices enseignants, pas refus), RCT LearnLM collège (44,3 % des éditions = anti-frustration), Sweller 2019 (exemples résolus, fading) |
| D3 | **Aucune modification pédagogique avant le harnais d'évaluation.** Nuance apportée par D10 : la phase 0 corrige des bugs de cohérence, et son effet est mesuré contre la baseline au lieu d'être supposé nul | proposée | zéro mesure aujourd'hui ; bruit ±1 pt connu sur l'ancien eval |
| D4 | Les styles d'apprentissage sortent du profil (phase 3) | proposée | neuromythe (Pashler 2008, Newton & Salvi 2020) |
| D5 | Hébergement affiché « dans l'Union européenne » tant que la région de déploiement n'est pas fixée (Scaleway `fr-par` pour les fichiers, Koyeb et Mistral non tranchés) | proposée, **ouverte** | F10 |
| D6 | Le classifieur reste au niveau famille ; les outils gardent les slugs fins | proposée | contrat existant, coût |
| D7 | Le juge d'évaluation est `mistral-large-latest` (contrainte EU assumée, biais de famille noté dans le rapport) | proposée, **ouverte** | souveraineté |
| D8 | Deux ADR écrits : 0001 frontière DOM/RN, 0002 casting des modèles Mistral | proposée | double référence « ADR 0001 » sans fichier |
| D9 | **`docs/` est recréé** : plans dans `docs/superpowers/plans/`, spec dans `docs/superpowers/specs/`, décisions dans `docs/adr/` | **confirmée** | l'arbitrage « supprimer plutôt qu'archiver » (PR #290) visait la doc périmée, pas les plans vivants |
| D10 | **Ordre d'exécution : phase 1 avant phase 0.** La baseline mesure l'état actuel bugs compris, et la phase 0 devient le premier changement mesuré | **confirmée** | prouve que le harnais détecte quelque chose ; coût : le harnais prend ses slugs dans `tool-declarations.ts` en attendant la phase 0 |
| D11 | **Toute la copy landing fausse est corrigée, aucune fonctionnalité n'est construite pour rattraper une promesse.** Les limites de temps quotidiennes disparaissent du site | **confirmée** | F10 ; le site doit être vrai avant tout trafic |
| D12 | **Conformité au droit européen et souveraineté = contrainte dure, pas un objectif.** Aucun traitement de données d'élève par un service hors UE. Tout ajout de dépendance qui touche une donnée personnelle passe par un contrôle explicite avant d'être écrit | **confirmée** | exigence posée par Victor le 2026-09-04 ; public = mineurs français |
| D13 | **GLM 5.2 est écarté du chat.** Il reste une option de contre-vérification pour le juge d'évaluation, jamais un défaut | proposée | §4bis : pas de vision, statut `PublicPreview` |

## 4bis. Catalogue de modèles — faits vérifiés le 2026-09-04

Source : définitions officielles dans `mistralai/platform-docs-public`, `src/schema/models/models/*.ts`, lues via l'API GitHub. Prix par million de tokens.

| Modèle | API | Entrée | Sortie | `input` | `output` | Contexte | Statut |
|---|---|---|---|---|---|---|---|
| Mistral Medium 3.5 | `mistral-medium-latest` | 1,25 € | 6,40 € | text, image | reasoning, text | 256k | GA |
| Mistral Large 3 | `mistral-large-latest` | 0,44 € | 1,30 € | text, image | text | 256k | GA |
| Mistral Small 4 | `mistral-small-latest` | 0,12 € | 0,50 € | text, image | text | 256k | GA |
| Ministral 3 8B | `ministral-8b-latest` | 0,13 € | 0,13 € | text, image | text | 256k | GA |
| Ministral 3 3B | `ministral-3b-latest` | 0,088 € | 0,088 € | text, image | text | 256k | GA |
| Z.ai GLM 5.2 | `zai-glm-5-2` | 1,19 € | 3,74 € | **text seul** | reasoning, text | 1M | **PublicPreview** |

Poids et licences, même source : Medium 3.5 = 128B dense, licence « Modified MIT ». Large 3 = 675B total / 41B actifs, Apache 2.0. Small 4 = 119B total / **6,5B actifs**, **Apache 2.0**.

Seul signal tiers à harnais unique, **Artificial Analysis Intelligence Index v4.1.1** (agrégat de 9 évaluations : GDPval-AA v2, τ³-Banking, Terminal-Bench, SciCode, HLE, GPQA Diamond, CritPt, AA-Omniscience, AA-LCR) : GLM-5.3 = 60, GLM-5.2 = 53, **Mistral Medium 3.5 = 30, Mistral Large 3 = 16**. Aucun chiffre trouvé pour Small 4. Cet index ne mesure **ni** le suivi d'instructions, **ni** le français, **ni** la vision, **ni** la pédagogie : il pèse lourdement le code et le raisonnement scientifique. À traiter comme un signal de prudence, pas comme un arbitre.

**IFEval et BFCL sont indisponibles pour les deux familles à cette génération.** Les deux métriques qui comptent le plus ici, suivi d'instructions et appel d'outils, n'ont aucune mesure publique comparable. Le harnais maison est donc la seule source de vérité possible.

Quatre constats qui en découlent :

- **GLM 5.2 ne lit pas les images.** Le chat de Tom accepte des photos d'exercices (`fileContextService.prepareMultimodalFiles` → parts `image_url`). Le modèle est structurellement inutilisable comme modèle de chat, indépendamment de toute considération juridique. La gamme Z.ai a des modèles de vision (GLM-4.6V, GLM-5.3-Flash), mais **aucun n'est servi en UE**.
- **La souveraineté n'est pas l'objection contre GLM, le contrat l'est.** Sa fiche dit « hosted by Mistral […] served without Mistral modifications ». Rien ne part en Chine. Mais les *Additional Product Terms* de Mistral (effectifs le 5 août 2026) classent ces modèles en « Third-Party Products » fournis « as is » et « without any warranties », sans obligation d'indemnisation, et Mistral s'y déclare explicitement **non-fournisseur au sens de l'AI Act** pour eux. De fait, `zai-glm-5-2` est **absent du registre AI Act de Mistral**, qui liste 41 modèles. La documentation « downstream provider » de l'article 53(1)(b) n'existe donc pas pour lui.
- **Correction sur Mistral Large 3.** Il est bien trois à cinq fois moins cher que Medium 3.5, mais l'index tiers le place à 16 contre 30. Le « Large » du nom ne dit rien de la qualité perçue : c'est un MoE à 41B actifs. L'hypothèse « Large 3 comme substitut économique » est donc **affaiblie**, pas confirmée. À mesurer, sans a priori favorable.
- **Mistral Small 4 est le candidat économique le plus sérieux**, et le seul à cumuler vision, jeu complet d'outils, statut GA et licence Apache 2.0. Son risque est ailleurs : 6,5B de paramètres actifs pour tenir un prompt système de ~1 900 tokens de règles conditionnelles sur plusieurs tours, contre un élève qui insiste. C'est exactement le point de fragilité documenté par SysBench, IHEval et SafeTutors (§3). **Piste d'architecture à mesurer, pas à présumer** : Small 4 par défaut, escalade vers Medium 3.5 quand le classifieur signale un tour à risque ou qu'une image est jointe.

## 4ter. Conformité européenne — état vérifié le 2026-09-04

Recherche sur sources primaires (EUR-Lex, artificialintelligenceact.eu, Q&R de la Commission, CNIL, ANSSI, Légifrance, legal.mistral.ai). Ce qui suit n'est pas un avis juridique : c'est une cartographie du risque, à faire valider par un conseil avant lancement.

**Ce qui ne nous concerne pas, et c'est une bonne nouvelle.** Le chapitre V de l'AI Act (obligations des fournisseurs de modèles à usage général, art. 53-55) ne s'applique dans aucune configuration réaliste. Le Q&R de la Commission sur les lignes directrices GPAI pose qu'on ne devient fournisseur d'un modèle en le modifiant que « **when the modification or fine-tuning uses more than one-third of the original model's training compute** » : un SFT ou un LoRA est plusieurs ordres de grandeur en dessous. Appeler une API tierce, héberger des poids ouverts non modifiés ou fine-tuner nous laisse *downstream provider* d'un **système** d'IA (art. 3(68)), pas fournisseur d'un modèle.

**L'Annexe III point 3 ne nous attrape pas non plus, tant que le produit reste ce qu'il est.** Le texte vise l'évaluation des acquis « **in** educational and vocational training institutions ». Un tuteur vendu aux familles, qui ne note pas, n'oriente pas et n'est pas déployé dans un établissement, est hors champ. Deux bascules à surveiller : vendre aux établissements un module qui évalue les acquis ou pilote le parcours, et ajouter une fonction de bilan de niveau. Attention aussi à l'article 6(3) : le profilage de personnes physiques exclut la dérogation au haut risque, et le « profil cognitif » de Tom est un profilage.

**Trois obligations mordent déjà.**

| Article | Applicable depuis | Ce que ça impose | Où on en est |
|---|---|---|---|
| 5(1)(b) | 2 février 2025 | Interdit d'exploiter une vulnérabilité liée à **l'âge** « with the objective, **or the effect**, of materially distorting the behaviour » et de causer un préjudice significatif. Le déclencheur est l'effet, pas l'intention. Niveau de sanction le plus élevé | **Risque immédiat** : `apps/mobile/src/lib/notifications.ts` crée un canal `streaks`, et Tom est une mascotte attachante. Toute mécanique d'engagement visant des collégiens est exposée. À auditer en phase 5 |
| 50(1) | 2 août 2026 | Informer la personne qu'elle parle à une IA, « from the start of the first interaction ». L'exception « évident pour une personne raisonnablement informée » est indéfendable face à des collégiens | Partiellement traité par la phase 0 (ligne de transparence dans l'identité). Reste à le faire dans l'interface, pas seulement dans le prompt |
| 50(2) | 2 août 2026 | Marquer les sorties **texte** générées dans un format lisible par machine. Le Q&R de la Commission confirme que le texte est couvert | **Non traité, non planifié.** Le point le plus lourd techniquement. Savoir si un dialogue privé y échappe n'est établi par aucune source : à faire trancher par un conseil ou via le AI Act Service Desk |

Calendrier consolidé après le règlement (UE) 2026/1744, *digital omnibus*, adopté le 8 juillet 2026, publié au JO le 24 juillet, en vigueur le 27 : art. 5 et 4 depuis février 2025 ; chapitre V depuis août 2025, inchangé ; le reste dont l'art. 50 depuis le 2 août 2026 ; fin du délai art. 50(2) pour les systèmes déjà commercialisés au 2 décembre 2026 ; **haut risque Annexe III reporté au 2 décembre 2027** (c'était le 2 août 2026) ; Annexe I au 2 août 2028.

**Souveraineté : deux actions concrètes, non faites.**

- **Les endpoints régionaux Mistral existent et sont en disponibilité générale** (annonce du 11 août 2026) : `api.eu.mistral.ai` garantit que l'inférence tourne en Europe, moyennant **+10 % sur le tarif**. Le code appelle aujourd'hui l'endpoint par défaut via `createMistral({ apiKey })` sans `baseURL`. C'est l'écart le plus direct entre l'exigence D12 et le code. Réserves à vérifier avant bascule : les endpoints régionaux ne servent que les modèles hébergés dans la région, l'API Files, le Batch et les Agents n'y sont pas disponibles, et les métadonnées de plan de contrôle (clés, facturation, analytics) peuvent rester traitées hors région.
- **Zero Data Retention** est disponible sur les offres payantes pour les appels sans état, dont `/v1/chat/completions`. La CNIL exige que « l'outil choisi **ne doit pas réutiliser les données personnelles des élèves à des fins d'amélioration de ses services** ». À activer et à documenter.

**Ce qui ne s'impose pas à nous mais cadre le canal scolaire.** SecNumCloud n'est obligatoire que pour l'État et ses opérateurs (circulaire 6404/SG, décret 2026-272) : ni Mistral ni Scaleway ne sont qualifiés, Scaleway est en cours. L'EUCS n'est toujours pas adopté, aucun certificat n'existe. Le *Cadre d'usage de l'IA en éducation* (juin 2025) pose en revanche deux règles qui ferment le canal scolaire au produit tel qu'il est : « **Aucun membre du personnel ne doit demander aux élèves d'utiliser des services d'IA grand public impliquant la création d'un compte personnel** », et l'usage par les élèves n'est autorisé « **à partir de la classe de 4e** », en autonomie seulement au lycée. Le décret n° 2025-1165 du 5 décembre 2025 rend ces principes opposables aux collèges et lycées publics via l'Exigence 10 du *Référentiel du numérique responsable*, avec dix mois de délai après publication des arrêtés d'application. **Ces arrêtés n'ont pas été trouvés publiés** : c'est le signal à surveiller si le canal scolaire devient une piste.

## 5. Non vérifié

- Contrainte d'alternance des rôles chez Mistral (six `user` consécutifs) : la doc API ne dit rien ; spike live prévu en phase 0.
- Texte EUR-Lex du règlement 2026/1744 (corps vide au fetch) ; dates prises sur sources secondaires.
- Abstract intégral de Pashler et al. 2008 (venue et 1 473 citations vérifiées via Semantic Scholar ; conclusion citée via Newton & Salvi 2020).
- Numéros d'aide français à insérer dans les scénarios de détresse (3020, 3018, 119, 3114) : à confirmer sur service-public.fr avant usage.
- Comportement réel de l'app sur device ; aucun appel Mistral n'a été fait pendant l'audit.
