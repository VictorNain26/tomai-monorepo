# Parents de collégiens : ce qu'ils vivent et ce qu'ils veulent (France)

Recherche du 1er octobre 2026. Ce document complète `marche-chiffres.md` et `concurrence.md` sans les refaire : un chiffre
déjà présent dans ces deux fichiers est seulement rappelé. Consultation de toutes les URL : 2026-10-01.

## Comment lire ce document

**Fiabilité de la source**
- **A** : statistique publique ou article à comité de lecture, méthode publiée.
- **B** : institut de sondage, méthode publiée.
- **C** : commanditaire intéressé (edtech, soutien scolaire, crédit, logiciel), échantillon non représentatif, ou étude interne d'un éditeur.
- **NV** : non vérifié à la source primaire.

**Nature de l'information**
- **Fait** : comportement ou équipement mesuré.
- **Déclaration** : ce que des parents disent d'eux-mêmes dans un sondage.
- **Anecdote** : une parole individuelle (avis, forum).

**Qui a lu quoi.** Cinq agents de recherche ont lu les sources en parallèle, avec WebFetch, curl et pdftotext.
J'ai ensuite revérifié moi-même à la source :
- les chiffres Ifop pour Les Sherpas (renoncement, efficacité perçue de l'IA) ;
- le tableau OpinionWay pour Educlever ;
- l'abstract de Barger et al. 2019 ;
- la rétraction de Wang & Fan ;
- le texte exact de 26 avis App Store, recopiés depuis le flux RSS public ;
- le texte exact de 40 passages de forums, recopiés depuis les fichiers bruts.

Ce qui n'a été lu que par un agent est signalé « (agent) ».

**Conditions dégradées.** Le quota de recherche web de la session était épuisé (200 sur 200) pour la plupart des agents. Ils ont
donc parcouru les sites des producteurs directement (moteurs de recherche internes, wp-json, archives). Des sources ont pu
échapper à la recherche : elles sont listées à la fin du document.

---

## 1. Études et sondages sur les parents

### 1a. Comment les parents vivent les devoirs

| Chiffre (déclaration) | Formulation et champ | Source, méthode, date | Fiab. |
|---|---|---|---|
| **41 %** se sentent « dépassés par les programmes scolaires » quand il faut aider (42 % des parents d'au moins un collégien ; CSP+ 41 %, CSP− 42 %) | « Êtes-vous d'accord… ? » 500 parents d'enfants de 6 à 18 ans | OpinionWay pour **Educlever**, en ligne, quotas, 7-11 juillet 2023. [PDF](https://www.opinion-way.com/wp-content/uploads/2025/01/OpinionWay-pour-Educlever-Les-parents-et-les-devoirs-Juillet-2023.pdf). **Commanditaire intéressé** (entreprise de l'éducation) | C, revérifié |
| **30 %** ont déjà « abandonné [leur enfant] à ses devoirs parce que vous ne saviez pas comment l'aider » (collège 30 % ; familles recomposées 43 %) | idem | idem | C, revérifié |
| **41 %** « aimeriez bénéficier d'une aide extérieure » pour les devoirs (collège 44 % ; inactifs 51 % ; recomposées 58 %) | idem | idem | C, revérifié |
| 88 % se sentent « capables d'aider » (collège 85 % ; monoparentales 80 %) ; 77 % préféreraient passer ce temps en loisirs | idem | idem | C, revérifié |
| Aider est « source de dispute » pour **23 %**, « de stress » pour 21 %, « une corvée » pour 19 % (23 % au collège) ; dispute chez 33 % des familles monoparentales | « Aider vos enfants à faire leurs devoirs est… », 2 réponses possibles | idem | C (agent) |
| « Suivre la scolarité et l'orientation » est compliqué pour **35 %** des parents en 2024, puis pour **28 %** en 2026. Gérer les écrans : 54 %, puis 49 % (53 % des parents d'un enfant de 11 à 14 ans) | Q. B4 : « dans quelle mesure les sujets suivants vous semblent-ils compliqués ? » | UNAF (OpinionWay) : *Observatoire des familles 2024*, 2 709 parents, juin 2024 ([PDF](https://www.unaf.fr/app/uploads/sites/3/2025/03/unaf-observatoire-des-familles-2024-etre-parent-aujourdhui-sens-forces-inspirations-et-besoins.pdf)) ; *Baromètre des familles 2026*, 2 583 parents, janvier-février 2026 ([PDF](https://www.unaf.fr/app/uploads/sites/3/2026/05/barometre-des-familles-2026.pdf)) | B (agent) |
| 81 % ont rencontré une difficulté pour accompagner la scolarité : stress de l'enfant 29 %, motivation 28 %, **manque de temps 27 %**, « mauvaise compréhension des méthodes ou des attentes de l'école » 23 % | **Parents d'enfants de 3 à 10 ans**, donc hors collège | OpinionWay pour l'association Coup de Pouce, 1 003 parents, juillet 2026. [PDF](https://www.opinion-way.com/wp-content/uploads/2026/09/OpinionWay-pour-lAssociation-Coup-de-Pouce-Les-perceptions-des-parents-sur-les-inegalites-scolaires-Aout-2026.pdf) | B (agent) |
| 49 % des élèves de 15 ans disent que leurs parents « s'intéressent à ce qu'ils apprennent en classe ». C'était 63 % en 2022 (OCDE : 58 %, contre 66 %) | Déclaration **des élèves**, pas des parents | DEPP, NI 26.40, PISA 2025, septembre 2026. [PDF](https://www.education.gouv.fr/sites/default/files/document/depp-ni-2026-40pisa-mathspdf-520231.pdf) | A |

Rappel de `marche-chiffres.md` :
- DEPP NI 23.32 (données 2019) : près de 3 collégiens sur 10 disent que les devoirs causent des disputes, et l'aide des parents dépend de leur diplôme.
- Ifop 2026 : 75 % des parents disent aider régulièrement, mais 25 % seulement répondent « très bien » au collège.

**Ce que ces sources ne mesurent pas :**
- le sentiment de compétence par matière (maths, langues) ;
- le temps réel que les parents consacrent aux devoirs.

**Point notable.** Le sentiment d'être dépassé est le même chez les CSP+ et les CSP− (41 % contre 42 %). L'écart social
porte sur ce que les familles font de ce sentiment, par exemple payer des cours (§ 1e), pas sur le sentiment lui-même.

### 1b. Ce qu'ils attendent d'une aide

| Chiffre (déclaration) | Source | Fiab. |
|---|---|---|
| Moment où les difficultés deviennent difficiles à rattraper : **collège 45 %**, primaire 27 %, lycée 10 % | Ifop pour **Les Sherpas** (plateforme payante de cours particuliers), *Baromètre de l'égalité des chances*, vague 4, 1 008 parents de collégiens à post-bac, en ligne, 3-10 février 2026. [PDF](https://www.ifopgroup.com/wp-content/uploads/2026/03/122188-publication.pdf) | C |
| Efficacité perçue sur 10 : cours particuliers 6,9 ; soutien en groupe 6,6 ; applications d'aide aux devoirs 6,1 ; **outils pédagogiques à base d'IA 5,1** (16 % les jugent très efficaces, 34 % peu efficaces) | idem | C, revérifié |
| 85 % pensent que certains parents sont « mieux armés ». Raisons : études longues 33 %, maîtrise du système 26 %, moyens financiers 26 %, temps 15 % | idem | C |
| **Piège** : le communiqué écrit « 20 % ne les aident pas ». La question réelle était « avez-vous déjà aidé vos enfants à la maison pour leur donner une meilleure éducation que celle proposée par le système scolaire ? » | idem | Formulation trompeuse |
| 64 % jugent bénéfique un accompagnement aux devoirs à l'école. Réponse « tout à fait » : **39 % chez les inactifs, 18 % chez les cadres** | Ifop, *Le regard des parents sur l'expérience scolaire*, 1 001 parents, mars-avril 2026, commanditaire non identifié. [Page](https://www.ifopgroup.com/article/le-regard-des-parents-sur-lexperience-scolaire-de-leur-enfant-a-lecole-elementaire-et-au-college) | B |

### 1c. Leur rapport à l'IA

| Chiffre | Nature | Source | Fiab. |
|---|---|---|---|
| Selon les parents, **48 %** des enfants de 8 à 15 ans utilisent l'IA « pour faire ses devoirs, faire des recherches, etc. » (11 % souvent, 37 % de temps en temps). Les enfants eux-mêmes déclarent 49 % | Déclaration | Ifop pour la Fondation pour l'Enfance, *Enfance & Numérique*, 4e édition : 1 001 parents et 953 enfants, en ligne, 1-10 décembre 2025. Partenaires : **Orange**, fondations. [PDF](https://www.ifopgroup.com/wp-content/uploads/2026/02/121733-presentation-avec-synthese_vf.pdf) | B (agent) |
| Impact de l'IA à terme sur « l'esprit critique et l'apprentissage des fondamentaux » : **négatif pour 56 %** des parents d'élèves, positif pour 31 % (Français dans leur ensemble : 66 % contre 18 %) | Opinion | Ifop pour la **Fondation pour l'école** (qui milite pour le libre choix de l'école), 1 003 adultes dont **256 parents** seulement, avril 2026. [PDF](https://www.ifopgroup.com/wp-content/uploads/2026/05/122128-presentation.pdf) | B/C, petit n |
| « 74 % des parents acceptent l'IA dans le cadre des devoirs… tant qu'elle aide l'enfant à progresser sans faire le travail à sa place » | Reprise de presse ; **formulation de la question non publiée** | Kantar, relayé par [TF1 Info](https://www.tf1info.fr/high-tech/74-des-parents-acceptent-l-ia-dans-le-cadre-des-devoirs-l-intelligence-artificielle-s-invite-encore-un-peu-plus-dans-le-quotidien-scolaire-des-familles-2460990.html). Probablement la série Kantar de juillet 2026 déjà citée dans `marche-chiffres.md` (235 parents ; « donner la réponse », rôle principal pour 5 %) | NV |

Les « 95 % des parents rejettent l'IA qui donne les réponses » sont une reformulation de Kantar. Ce chiffre est
**interdit** (voir `marche-chiffres.md`). Il figure pourtant en § 5 de `concurrence.md` : **ce document doit être corrigé**.

### 1d. Surveillance ou autonomie

| Chiffre (déclaration) | Source | Fiab. |
|---|---|---|
| 68 % des parents ont déjà installé un contrôle parental (72 % pour les 11-15 ans). 46 % géolocalisent leur enfant (52 % pour les 11-15 ans) | Ifop pour la Fondation pour l'Enfance, décembre 2025 (ci-dessus) | B (agent) |
| Raisons de ne pas installer de contrôle parental (base : les 32 % qui n'en ont pas) : « **il vaut mieux dialoguer que contrôler** » 46 %, inefficace 14 %, trop compliqué 13 % | idem | B (agent) |
| 52 % ont équipé leur enfant « pour qu'il puisse travailler correctement (ENT, devoirs en ligne…) ». Le portail de l'établissement est utilisé « souvent » par 65 % des 11-15 ans, selon les parents | idem | B (agent) |
| 46 % des parents d'enfants de 8 à 17 ans suivent l'activité en ligne de leur enfant. Parmi eux, chez les 10-14 ans : contrôle parental 73 % selon les parents, **60 % selon les enfants** | Ifop pour la **CNIL**, 1 000 parents et 502 jeunes, décembre 2019. [PDF](https://www.cnil.fr/sites/default/files/atoms/files/sondage_ifop_-_comportements_digitaux_des_enfants_-_fevrier_2020.pdf) | B, ancien |
| 94 % des parents d'enfants de l'élémentaire disent contrôler l'activité en ligne de leur enfant, contre **74 % au collège** | Ifop pour **Kaspersky** (éditeur de contrôle parental), 960 parents, septembre 2021. [Page](https://www.ifopgroup.com/article/les-parents-face-aux-dangers-dinternet) | C |
| Pronote et ENT : **aucun sondage chiffré trouvé**. On ne dispose que de témoignages, par exemple [franceinfo](https://www.franceinfo.fr/societe/education/je-regarde-plusieurs-fois-par-jour-pronote-educ-horus-quand-les-logiciels-de-vie-scolaire-rendent-esclaves-de-la-note_6906686.html) | — | Trou |

**Trou important :** aucune enquête ne demande aux parents s'ils veulent lire les conversations de leur enfant avec une IA.

### 1e. Choix et prix d'une aide payante

| Chiffre (déclaration) | Source | Fiab. |
|---|---|---|
| **46 %** ont déjà « renoncé à des cours particuliers pour des raisons financières » ; **59 %** dans les « catégories pauvres », **62 %** chez les parents d'élèves en REP. 56 % ont déjà envisagé des cours | Ifop pour **Les Sherpas**, février 2026. Seuils de revenu et effectifs des sous-groupes non publiés | C, revérifié |
| 46 % des parents sont en difficulté face aux dépenses de rentrée ; budget médian 261 € ; 56 % craignent de manquer d'argent | Sondage pour **Cofidis** (organisme de crédit), 357 parents, mai-juin 2026, institut non nommé, relayé par [BFM](https://www.bfmtv.com/economie/consommation/le-budget-median-pour-la-rentree-scolaire-atteint-261-euros-en-hausse-de-pres-de-10-par-rapport-a-2025-plus-d-un-parent-sur-deux-craint-de-manquer-d-argent-pour-couvrir-les-depenses_AV-202608030046.html) | C |
| **Consentement à payer pour une aide numérique ou IA : aucune donnée française indépendante** | — | Trou |

---

## 2. Ce que dit la recherche

### 2a. Implication des parents, devoirs et inégalités

**Travaux français (qualitatifs)**

**Kakpo, *Les devoirs à la maison. Mobilisation et désorientation des familles populaires*, PUF, 2012.**
- Sources lues :
  - [éditeur](https://www.puf.com/les-devoirs-la-maison) ;
  - comptes rendus de Floquet dans [*Lectures*](https://journals.openedition.org/lectures/10227) et de Benamar dans [*Insaniyat*](https://journals.openedition.org/insaniyat/14238).
  - Le livre lui-même n'a pas été lu (Cairn renvoie une erreur 403).
- Méthode : ethnographie de familles populaires « stables » (emploi, logement, couple). Le nombre de familles n'est pas donné dans les pages lues.
- Constats :
  - Les familles sont **fortement mobilisées**. Elles prescrivent même du travail en plus.
  - Elles vivent une « profonde désorientation » face au curriculum actuel.
  - Certaines pratiques familiales « contredisent directement les normes scolaires », par exemple la lecture orale ininterrompue avec usage excessif du dictionnaire.
- Ce que le livre n'établit pas : aucun effet mesuré.
- **Leçon** : le problème de ces familles n'est pas le désintérêt, c'est l'écart entre leur aide et ce que l'école attend.

**Kakpo et Netter, *Revue française de pédagogie*, 2013** ([HAL](https://hal.science/hal-01468595)).
- Dans un dispositif d'aide aux devoirs en quartier populaire, les intervenants développent des « stratégies de survie dont le bénéfice pour les élèves n'est pas toujours évident ».
- Étude qualitative.

**Kakpo et Rayou, *Revue française de pédagogie*, 2018** ([HAL](https://shs.hal.science/halshs-03996392)).
- Méthode : 5 familles comptant au moins un parent enseignant.
- Constats : ces parents savent diagnostiquer les difficultés et faire acquérir les dispositions attendues.
- Limite : les auteurs écrivent eux-mêmes que le corpus « n'autorise pas une comparaison ».

**Rayou (dir.), *Faire ses devoirs*, PUR, 2010** (compte rendu dans [*Lectures*](https://journals.openedition.org/lectures/988)).
- Méthode : enquêtes 2005-2008 en éducation prioritaire et en milieux favorisés.
- Constats :
  - « plus de la moitié des mères sans diplôme ou titulaires du seul certificat primaire déclarent avoir souvent ou très souvent le sentiment de manquer de connaissances » ;
  - « les dispositifs d'accompagnement à la scolarité sont souvent décevants » ;
  - des « malentendus » existent entre les familles et l'école.
- Limite : l'étude porte surtout sur le primaire.

**Glasman et Besson, *Le travail des élèves pour l'école en dehors de l'école*, 2005** ([HAL](https://hal.science/hal-01453392)).
- Seul le résumé a été lu : les conclusions ne sont pas connues.

**Collas, *Revue française de sociologie*, 2013** (abstract lu via OpenAlex).
- Données : Insee 2003.
- Constat : les cours particuliers s'inscrivent dans la construction familiale d'un avantage scolaire et dépendent des « possibilités matérielles ».
- Limite : étude corrélationnelle sur des données anciennes.

**Méta-analyses internationales (corrélationnelles, surtout américaines)**

| Travail | Ce qui est mesuré | Limite |
|---|---|---|
| Hill et Tyson, *Developmental Psychology* 2009, **collège**, 50 études ([PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC2782391/)) | Implication parentale globalement positive, **sauf l'aide aux devoirs : r = −0,11**. Socialisation académique (parler des attentes, des projets) : r = 0,39 | Causalité inverse plausible : on aide parce que l'enfant a de mauvais résultats |
| Barger et al., *Psychological Bulletin* 2019, 448 études et 480 830 familles (doi:10.1037/bul0000201) | Petites associations positives (r = 0,13 à 0,23). **Seule exception : l'aide aux devoirs, r = −0,15 avec la réussite**, et rien sur l'engagement ni la motivation. Peu de variation selon l'âge ou le statut socio-économique | Corrélationnel. Revérifié |
| Patall, Cooper et Robinson, *Review of Educational Research* 2008 (doi:10.3102/0034654308325185) | Former les parents améliore la réalisation des devoirs (14 études expérimentales, en primaire). Association **négative au collège** ; négative en maths | Corrélationnel sauf pour la formation |
| Moroni et al., *Journal of Educational Research* 2015, 1 685 élèves suisses de 6e année (doi:10.1080/00220671.2014.901283) | La **fréquence** de l'aide est associée négativement au progrès. Une aide perçue comme **soutenante** est associée positivement, une aide **intrusive** négativement | Longitudinal, une seule cohorte |
| Fernández-Alonso et al., *Journal of Educational Psychology* 2015, 7 725 élèves espagnols d'environ 14 ans (doi:10.1037/edu0000032) | Après le niveau antérieur, c'est **l'autonomie pendant les devoirs** qui prédit le mieux les résultats, plus que le temps passé. Optimum vers 1 h par jour | Transversal |
| Nickow, Oreopoulos et Quan, *American Educational Research Journal* 2024 (doi:10.3102/00028312231208687) | Le **tutorat humain** : effet moyen de **0,29 écart-type**. Plus fort avec des enseignants qu'avec des bénévoles ou des parents, et pendant le temps scolaire | Citer 0,29 (version publiée), pas 0,37 (working paper de 2020) |

### 2b. Tuteurs IA

| Étude | Population et design | Résultat | Limites | Statut |
|---|---|---|---|---|
| Bastani et al., « Generative AI without guardrails can harm learning », *PNAS* 2025 ([PMC12232635](https://pmc.ncbi.nlm.nih.gov/articles/PMC12232635/)) | Environ 1 000 lycéens turcs, maths, essai randomisé par classe, 4 séances de 90 min. Trois bras : ChatGPT standard, tuteur avec garde-fous, manuels | Pendant les exercices : +48 % (standard), +127 % (tuteur). **À l'examen sans IA : −17 % avec ChatGPT standard** ; le tuteur à garde-fous **annule ce dommage sans produire de gain** (−0,004, non significatif). Les élèves demandaient surtout la réponse | Une matière, un établissement, effets à court terme | Revue à comité de lecture |
| Kestin et al. (Harvard), *Scientific Reports* 2025 ([PMC12179260](https://pmc.ncbi.nlm.nih.gov/articles/PMC12179260/)) | 194 étudiants de licence en physique, essai randomisé croisé, 2 leçons | Gains plus que doublés par rapport à un cours actif en classe (0,63 écart-type) | Étudiants très sélectionnés ; mesure immédiate ; prompts contenant les solutions ; les auteurs évaluent leur propre tuteur | Revue à comité de lecture |
| De Simone et al., Banque mondiale, Nigeria, WP 11125, mai puis décembre 2025 ([PDF](https://documents.worldbank.org/curated/en/099548105192529324/pdf/IDU-c09f40d8-9ff8-42dc-b315-591157499be7.pdf)) | Élèves d'environ 15 ans, essai randomisé individuel, 6 semaines **après l'école, en salle informatique encadrée par des enseignants** | +0,31 écart-type sur l'évaluation finale. **Effets plus forts chez les meilleurs élèves et les plus favorisés** | Le groupe témoin ne reçoit rien (l'IA n'est pas séparée du temps encadré en plus) ; forte attrition ; les « 1,5 à 2 ans de scolarité » sont une extrapolation | Working paper, non revu |
| Wang et al., *Tutor CoPilot*, arXiv 2024-2025 | 874 tuteurs et 1 787 élèves défavorisés de 8 à 14 ans (grades 3-8), essai randomisé. L'IA aide **le tuteur humain** | +4 points de maîtrise immédiate, +9 points pour les tuteurs les plus faibles ; moins de réponses données directement | **Aucun effet significatif au test de fin d'année** | Préprint |
| Khanmigo (Khan Academy) | Tests A/B **internes** entre versions de Khanmigo ([blog, 01/05/2026](https://blog.khanacademy.org/how-khan-academy-is-building-a-better-ai-tutor-our-most-recent-learnings/)) | +6,1 % de bonnes réponses à l'exercice suivant, d'une version à l'autre | **Aucun essai randomisé ni évaluation indépendante trouvés** ; données produites par l'éditeur | C |
| Wang et Fan, méta-analyse ChatGPT, 2025 (g = 0,867) | — | **Rétractée le 22/04/2026** (doi:10.1057/s41599-026-07310-z) | Ne pas citer | Rétractée, revérifié |
| Kosmyna et al. (MIT), « Your Brain on ChatGPT », arXiv 2025 | 54 adultes, EEG, rédaction d'essais | Connectivité cérébrale plus faible avec un LLM | Petit n ; critiques méthodologiques publiées | Préprint |
| OCDE, *Digital Education Outlook 2026* (doi:10.1787/062a7394-en) | Synthèse | « misalignment between task performance and genuine learning » ; les systèmes adossés à un modèle pédagogique « show more promise than general-purpose chatbots » ; pour les tuteurs socratiques, « the evidence is still emerging » | Synthèse, pas une étude | A |
| France : M.I.A. Seconde (IA adaptative, non générative) ; *The Power of Feedback* (OCDE et IDEE) | Évaluations randomisées en cours | **Aucun résultat publié** à ce jour ([IDEE](https://www.idee-education.fr/projet/m-i-a-seconde/)) | — | — |

### 2c. Ce qui est établi, et ce qui ne l'est pas

**Établi**
- **L'aide aux devoirs, en quantité, n'est pas associée à de meilleurs résultats.** C'est la seule forme d'implication parentale associée négativement à la réussite dans trois méta-analyses, notamment au collège. Ces études sont corrélationnelles.
- **La forme de l'aide compte plus que sa quantité** : une aide soutenante est associée positivement, une aide intrusive négativement. L'autonomie de l'élève est le meilleur prédicteur après le niveau antérieur.
- **Les familles populaires ne sont pas démobilisées.** Elles sont désorientées par les codes scolaires (enquêtes qualitatives).
- **Un chatbot généraliste peut améliorer l'exercice tout en dégradant l'apprentissage.** Des garde-fous pédagogiques suppriment ce dommage, mais n'ont pas produit de gain dans la seule étude randomisée sur des lycéens.

**Suggéré, non établi pour notre cible**
- Des gains importants à court terme avec un tuteur IA conçu pour enseigner : étudiants de Harvard, cadre encadré au Nigeria.

**Non établi**
- L'effet d'un tuteur IA sur des **collégiens français, à la maison, sans adulte**.
- Les effets à long terme.
- L'effet sur les élèves les plus faibles : au Nigeria, les gains sont plus forts chez les plus favorisés.
- L'effet de Khanmigo, faute d'essai randomisé.

---

## 3. La parole des parents, en direct

### Corpus et méthode

**Avis publics**
- **App Store France** : flux RSS public `https://itunes.apple.com/fr/rss/customerreviews/page=N/id=<ID>/sortBy=mostRecent/json`, avec les 10 pages de chacune des 9 apps (Kartable, SchoolMouv, Superprof, Photomath, Gauth, Eliott, Brainly, OuiActive/Dinobot, Acadomia). Cela fait **2 742 avis**, dont environ 450 lus en entier après un filtre par mots-clés.
- **Trustpilot** : 10 fiches, 36 pages, **environ 700 avis**. Lus par un agent dans le JSON brut de la page via Chrome, avant l'ordre d'arrêter Chrome. Trustpilot refuse curl (erreur 403), donc je n'ai **pas pu revérifier** ces citations.
- **Google Play** : 6 fiches, 18 avis seulement. La liste complète est chargée en JavaScript.
- **Aucun avis public trouvé** pour Galac6, NeoSko et Le Prof IA (ni fiche Trustpilot, ni app iOS) ; Dinobot n'en a que 3 sur Play et 5 sans texte sur l'App Store.

**Forums**
- **95 fils** : Reddit 63 (dont 12 seulement passés au filtre de mots-clés), Doctissimo 16, aufeminin 16.
- Reddit a été lu par l'archive publique arctic-shift, qui donne le texte exact, car Reddit refuse curl et WebFetch.
- Magicmaman est quasi mort depuis 2023 : aucun fil lu.
- Forums FCPE et PEEP, commentaires de presse : non consultés.

**Règles appliquées**
- Pas plus de 2 citations par page d'avis ou par fil.
- Orthographe d'origine conservée ; seuls les pseudos sont donnés.
- [AS] : texte revérifié par moi dans le flux RSS. [F] : texte revérifié par moi dans le fichier brut du fil. [TP] : Trustpilot lu par l'agent, non revérifié.

**Pourquoi ce corpus n'est pas représentatif**
- **Biais de détresse et de litige** : on poste quand ça va mal ou quand on a été prélevé.
- **Avis sollicités** sur Trustpilot (Anacours 57 sur 60, Complétude 49 sur 60, SchoolMouv 76 sur 100). Vague de lancement d'Eliott en septembre 2024, au ton marketing.
- **Les auteurs d'avis App Store sont surtout des élèves.** Le rôle de parent est déduit d'indices (« mon fils »).
- **Reddit penche vers des parents jeunes, urbains et diplômés.** Quelques pseudos reviennent partout, et une partie des fils concerne le primaire.
- **Les forums Doctissimo et aufeminin sont en sommeil depuis 2020** : plusieurs fils ont de 6 à 11 ans, avant l'IA générative.
- **Les familles qui ne peuvent pas payer sont presque absentes** de ces sources.
- Ce sont des **anecdotes** : elles illustrent des thèmes, elles ne les quantifient pas.

### Douleurs

> « J'ai un enfant qui doit constamment être poussé au train pour bosser et pour lequel chaque devoir à faire ressemble à une souffrance. […] Un devoir = une bataille. »
> — Dearest_Helpless, parent de 3e, 2024-11-24, [r/ParentingFR](https://www.reddit.com/r/ParentingFR/comments/1gylflj/) [F]

> « on parvient a ce résultat avec énormément de travail, seulement ce travail, c'est 90 pourcent moi et 10 pourcent mon fils qui est complètement à l'ouest. »
> — WingFast1503, parent d'un enfant de 13 ans, 2026-01-23, [r/ParentingFR](https://www.reddit.com/r/ParentingFR/comments/1qkon2q/) [F]

> « je ne suis pas très patient et surtout je n'ai pas l'impression d'être très pédagogique et de ne pas bien les aider à la trouver par eux-mêmes.. »
> — Puzzleheaded_Set8239, parent d'enfants en CE1 et en 6e, 2024-11-05, [r/ParentingFR](https://www.reddit.com/r/ParentingFR/comments/1gk2dkr/) [F]

> « Non, les devoirs c'est vraiment la plaie en tant que parents. »
> — Kornikus, même fil, 2024-11-05 [F]

> « Rentrer à la maison, goûter, devoirs, douche, manger, dodo, recommencer. »
> — Signal_Entrance3265, père d'une élève de 4e, 2025-09-17, [r/ParentingFR](https://www.reddit.com/r/ParentingFR/comments/1nj77f8/) [F]

> « Ça finit toujours en crise, il décroche au bout de deux minutes et le soutien scolaire classique ça sert à rien avec lui »
> — CalmBed2600, parent d'un enfant TDAH, 2026-09-08, [r/ParentingFR](https://www.reddit.com/r/ParentingFR/comments/1waqp3q/) [F]

> « J'essaie de l'épauler sur certaines matières à la maison mais il perd vite patience et préfère évidement jouer à la console »
> — Profil supprimé, parent d'un élève de 5e, 16/01/2020, [Doctissimo](https://forum.doctissimo.fr/famille/parents-d-ados/reviser-enfant-college-sujet_1649_1.htm) [F]

> « Honnêtement si mon patron me donnait à faire du travail pour chez moi ce serait 🙅 »
> — fanadechocolatnutellamiel2, mère d'un élève de 6e, 05/11/2020, [Doctissimo](https://forum.doctissimo.fr/viepratique/scolarite-education/marre-devoirs-scolaires-sujet_30621_1.htm) [F]

> « Je suis très mal à l'aise avec ce fonctionnement qui implique que je doive expliquer à mon fils les notions à la place de l'enseignante. Je ne suis pas sûre d'expliquer correctement. »
> — NCdoesit, mère d'un élève de CM1 (primaire), 2026-09-12, [r/ParentingFR](https://www.reddit.com/r/ParentingFR/comments/1wecu15/) [F]

> « De mon côté c'est chaque année la même angoisse en septembre […] Je cherchais en vain une solution alternative au tutorat classique »
> — Aarrmmaanndd, parent, avis 5★ sur Eliott, 2024-09-21 (vague de lancement), App Store RSS, page 5 [AS]

> « avec le travail je n'ai plus trop le temps de faire les devoirs avec lui du coup quand il galère je l'autorise à utiliser l'application »
> — Anonyme192840, parent, avis 5★ sur Brainly, 2024-10-02, App Store RSS, page 2 [AS]

> « souvent les exercices de math de mes enfants de sont pas simple du tous j'ai du mal […] 2 jours après quand les corrections de l'exercice les réponses sont toutes fausses »
> — Neumouk17, parent, avis 1★ sur Gauth, 2024-12-05, App Store RSS, page 6 [AS]

> « je n'avais plus à demander à mon père, mon père me fesait l'exercice mais au final je ne comprenais pas… »
> — Sie sou, **élève**, avis 5★ sur Gauth, 2026-04-29, App Store RSS, page 1 [AS]

> « je me demande l'intérêt de dépenser autant d'argent pour qu'il n'y ait pas d'amélioration même une petite »
> — Nadine, parent, avis 1★ sur Acadomia, 2026-04-26, [Trustpilot](https://fr.trustpilot.com/review/acadomia.fr), avis sollicité [TP]

### Attentes

> « En tant que parent, cette fonctionnalité était pourtant mon seul levier pour distinguer un manque d'investissement d'un éventuel "plafond de verre" scolaire. »
> — Gregory, parent, avis 2★ sur Kartable après la suppression des statistiques, 2026-04-15, [Trustpilot](https://fr.trustpilot.com/review/www.kartable.fr) [TP]

> « Je peux suivre en asynchrone les progrès de mon fils […] Je n'aurais qu'un souhait : avoir un accès par un navigateur web et la possibilité d'interagir avec mon enfant pour lui suggérer des pistes d'exploration »
> — TaoDiem, parent, avis 5★ sur Eliott, 2025-09-21, App Store RSS, page 3 [AS]

> « Je pense notamment à ceux qui ont du mal à accrocher avec un prof particulier ou à l'étude le soir (comme les miens qui sont au collège) »
> — MarcP.78, parent, avis 5★ sur Eliott, 2024-11-05 (vague de lancement), App Store RSS, page 4 [AS]

> « la technique d'un visionnage de leçon ça aide énormément surtout quand l'enfant n'a pas envie de lire après une longue journée de cours ; […] les quiz nous aident à voir si l'enfant a bien compris sa leçon »
> — annemarie2A, parent d'un élève de 5e, avis 5★ sur SchoolMouv, 2025-03-25, App Store RSS, page 5 [AS]

> « le nom de vos chapitres ne correspondent pas forcément aux chapitres de mes enfants en classe […] Après on l'utilise surtout sur les portables. Et sur la version mobile, il n'y a pas la progression des enfants. »
> — 3sous, parent abonné, avis 4★ sur SchoolMouv, 2026-04-29, App Store RSS, page 2 [AS]

> « Le but est autant de l'accompagner que de nous soulager, nous, en tant que parents, pour éviter certains conflits pendant les devoirs et aborder les notions avec d'autres approches. »
> — kiyoshix, parent d'un élève de CE2 (primaire), 2026-06-26, [r/ParentingFR](https://www.reddit.com/r/ParentingFR/comments/1ug3u8v/) [F]

> « Les profs donnent tout en vrac au dernier moment ou l'on peut quand même anticiper un peu pour ne pas y passer les soirées ? »
> — Lictor72, père d'un futur élève de 6e, 2025-05-21, [r/ParentingFR](https://www.reddit.com/r/ParentingFR/comments/1krogu9/) [F]

> « Personnellement, j'aide mes enfants, et ça marche bien. Mais ils sont encore au collège donc pour le lycée et le post-bac, je prendrai surement un prof. »
> — Ok_Form1693, parent de collégiens, 2025-07-24, [r/ParentingFR](https://www.reddit.com/r/ParentingFR/comments/1m7equy/) [F]

> « je regarde les cours sur pronote pour réviser et ne pas être larguée s'ils me posent des questions random, surtout en plein dîner ou pendant que je conduis. »
> — Minerva-7395, mère de deux collégiens, même fil, 2025-07-24 [F]

> « J'ai aucune pédagogie (et je respecte énormément les enseignants pour ça). Je crois que je vais essayer de trouver des étudiants/profs pour le faire bosser »
> — MC_Salo, père d'un élève de 3e, 2026-01-22, [r/ParentingFR](https://www.reddit.com/r/ParentingFR/comments/1qjovti/) [F]

> « pour que nos enfants ( de 14 et 11 ans) puissent réviser à la maison quand ils ont des profs absents (ce qui est assez récurrents)et pendant les vacances. »
> — Profil supprimé, père, 27/04/2023, [Doctissimo](https://forum.doctissimo.fr/famille/parents-d-ados/plateforme-cours-ligne-sujet_1808_1.htm) [F]

> « Je trouve que le soutien scolaire en groupe n'est pas adapté à ma fille […] Elle ne trouve pas assez de temps pour poser ses questions. »
> — Siewlan G., parent, avis 2★ sur Acadomia, 2026-05-20, [Trustpilot](https://fr.trustpilot.com/review/acadomia.fr), avis sollicité [TP]

> « ils ne donnent jamais les raisons des fautes effectués donc aucun intérêt »
> — Vanessa D., parent, avis 1★ sur myMaxicours, 2024-02-18, [Trustpilot](https://fr.trustpilot.com/review/maxicours.com), page 2 [TP]

### Objections

**Facturation.** C'est le premier grief exprimé dans les avis spontanés.

> « J'ai payé 39 € en pensant pouvoir organiser un cours avec un professeur pour mon fils. […] les 39 € ne correspondaient pas au cours, mais à un « Student Pass », c'est-à-dire un abonnement mensuel »
> — Kadir B., parent, avis 1★ sur Superprof, 2026-09-24, [Trustpilot](https://fr.trustpilot.com/review/superprof.fr), page 2 [TP]

> « Résultat : 39€ jeté par la fenêtre et pas de prof d'anglais. »
> — Oxybulle123, parent, avis 1★ sur Superprof, 2024-11-19, App Store RSS, page 2 [AS]

> « Il faut résilier sinon 39 euros seront prélevés tous les mois même après la mise en relation. Ce n'est vraiment pas clair »
> — Céline R., rôle inconnu, avis 2★ sur Superprof, 2024-02-28, [Google Play](https://play.google.com/store/apps/details?id=com.superprof&hl=fr&gl=FR) (agent)

> « Kartable a prélevé 119,88 € sur ma carte bancaire pour un renouvellement automatique […] elle n'est plus du tout utilisée par nos enfants »
> — MBH, parent, avis 1★ sur Kartable, 2026-08-18, [Trustpilot](https://fr.trustpilot.com/review/www.kartable.fr) [TP]

> « une reconduction où je n'ai même pas vu le mail qui me prévenait du renouvellement. Donc hop 119 € et quelques pour rien »
> — Kahina B., parent, avis 1★ sur SchoolMouv, 2026-08-20, [Trustpilot](https://fr.trustpilot.com/review/schoolmouv.fr) [TP]

> « Je suis désolé mais je ne peux m'abonner sans une période d'essai gratuite, même de 24h aurais été bien, afin de voir si cela peux correspond aux besoins de mon fils. »
> — Thierry3491, parent, avis 1★ sur Kartable, 2021-01-27, App Store RSS, page 4 [AS]

**Efficacité et fiabilité**

> « J'ai déjà regardé les cours particuliers mais je trouve les prix trop chers pour un résultat qui n'est pas forcément au rdv. »
> — Profil supprimé, parent d'un élève de 5e, 2020, Doctissimo (même fil que plus haut, sujet 1649) [F]

> « Je trouve des cours en distanciel (généralement 2h/jour) dont j'ai pas trop le doute qu'ils seront complètement inutiles. »
> — MC_Salo, père d'un élève de 3e, même fil que plus haut, 2026-01-22 [F]

> « Contenu absolument pas fiable. Impossible de laisser un enfant travailler en autonomie avec ça »
> — Ragnar le Mauve, parent probable, avis 2★ sur Kartable, 2020-03-12, App Store RSS, page 6 [AS]

> « Les questions proposées n'étaient pas au programme et trop compliquées du coup elle s'est démotivée. »
> — Jaryba, parent d'une enfant multidys, avis 2★ sur SchoolMouv, 2025-08-28, App Store RSS, page 4 [AS]

**Suivi parental qui ne marche pas, appli difficile à installer**

> « je voudrais savoir pourquoi le compte parent n'affiche pas l'activité de mon enfant »
> — FougèreViolette, parent, avis 3★ sur Eliott, 2025-05-02, App Store RSS, page 3 [AS]

> « Application peu intuitive et que nous n'arrivons pas à installer sur le téléphone de notre fils. »
> — Mamuroise, parent, avis 2★ sur Eliott, 2026-02-15, App Store RSS, page 2 [AS]

### Prix évoqués

> « J'ai trouvé quelqu'un mais je ne sais combien lui proposer. Je me suis dit 15 ou 20€ mais pas plus. »
> — Crazynisa00, parent d'enfants de 8 et 13 ans (étudiant à domicile), 2025-11-07, [r/ParentingFR](https://www.reddit.com/r/ParentingFR/comments/1oqszmc/) [F]

> « 360€ pour 5 matinée (2h math 2 h français) en groupe de 5-7 ou 38€ l heure en cours particuliers »
> — Parent d'un élève de 3e, Acadomia, 10/03/2016, [Doctissimo](https://forum.doctissimo.fr/viepratique/scolarite-education/acadomia-soutien-scolaire-sujet_26999_1.htm) [F]. Prix anciens.

> « J ai déjà testé le cours particulier en anglais... Et mon fils se laisse porter tranquillement »
> — même parent, même fil, 2016 [F]

> « J'ai été prélevée du montant total alors que je pensais que je pourrais payer 6,95 euros par mois, ce qui passait largement dans mon budget. Ainsi je me suis retrouvée à découvert »
> — Corinne F., parent, avis 1★ sur myMaxicours, 2024-02-24, [Trustpilot](https://fr.trustpilot.com/review/maxicours.com), page 2 [TP]

> « Après avoir payé 80€ l'année […] j'en aurai pour autant en prenant un abonnement annuel à schoolmouv […] et un prof à domicile sur Leboncoin »
> — Laetitia B., parent, avis 3★ sur Complétude, 2026-07-02, [Trustpilot](https://fr.trustpilot.com/review/completude.com) [TP]

> « Ma fille va à l'aide aux devoirs (dont les tarifs sont progressifs, et la ville propose une aide au devoirs jusqu'à la fin de la 3eme). »
> — victordeltalima, mère aux horaires de nuit, 2023-09-21, [r/ParentingFR](https://www.reddit.com/r/ParentingFR/comments/16o9jav/) [F]

> « souvent les élèves ne peuvent pas payer 10€ par mois pour une application, ou leur parent refuse »
> — alf348, **élève**, avis 1★ sur Eliott, 2025-04-15, App Store RSS, page 4 [AS]

> « si vous voulez pas payer 100€ par an juste que pour apprendre il faut mieux faire avec ses parent !! »
> — Lucie.@lulu, **élève**, avis 1★ sur SchoolMouv, 2025-11-19, App Store RSS, page 3 [AS]

**Crédit d'impôt.** Aucun parent n'en parle dans les fils lus. Le sujet n'apparaît que chez des répétiteurs ou dans des
messages publicitaires (agent).

### Surveillance ou autonomie

> « comme j'ai accès 24h/24, je regarde plusieurs fois par jour. »
> — Dearest_Helpless, parent d'un élève de 3e, à propos de Pronote, 2024-11-24, même fil que plus haut [F]

> « Mais je trouve que c'est une régression dans l'autonomie, à la base il n'avait plus besoin de sa mère pour gérer ce genre de chose . »
> — Minerva-7395, mère d'un élève de 6e, à propos des devoirs déposés sur Pronote après la classe, 2024-10-23, [r/ParentingFR](https://www.reddit.com/r/ParentingFR/comments/1gahidr/) [F]

> « Pronote déresponsabilise les élèves, et les parents. […] C'est aussi un outil qui rend de facto obligatoire l'achat d'un téléphone moderne. »
> — Commercial_Pain_6006, parent d'un élève de 6e, 2025-12-17, [r/enseignants](https://www.reddit.com/r/enseignants/comments/1pooymr/) [F]

> « Je ne lis pas les messages qu'ils envoient à leurs amis. Si j'avais une raison de m'inquiéter je le ferais mais en les prévenant. »
> — Docyfome, mère d'adolescents, 2024-04-20, [r/ParentingFR](https://www.reddit.com/r/ParentingFR/comments/1c8wb8v/) [F]

> « il est puni et sera privé de son téléphone pendant au moins 1 semaine. Problème : tous ses devoirs sont sur l'ENT. »
> — Dangerous_Silver_387, parent d'un élève de 3e, 2026-09-09, [r/ParentingFR](https://www.reddit.com/r/ParentingFR/comments/1wbe1x5/) [F]

> « quand l'enfant a compris qu'il peut refaire dans notre dos plusieurs fois les quizz pour retenir les réponses corrigées […] il faut rester avec l'enfant pour le surveiller »
> — Hphphp, parent d'élèves de 6e et de 3e, avis 4★ sur Kartable, 2022-04-14, App Store RSS, page 3 [AS]

### IA et copie

> « Ma fille doit créer un compte Claude pour voir ce lien, et donc partager ses données personnelles à une société privée aux USA »
> — LaurenceDarabica, mère d'une élève de 4e, 2026-09-19, [r/enseignants](https://www.reddit.com/r/enseignants/comments/1wkh1zh/) [F]

> « Je me vois mal expliquer à ma fille qu'elle ne doit pas utiliser l'IA pour ses devoirs quand le prof fait un cours avec l'IA lui-même »
> — même autrice, même fil [F]

> « Pour les enfants c'est pire, ils risquent de ne jamais apprendre. »
> — Mogura-De-Gifdu, parent d'un enfant de CP, 2026-03-14, [r/ParentingFR](https://www.reddit.com/r/ParentingFR/comments/1rt2ef2/) [F]

> « je me demande comment mes enfants apprendront à réfléchir s'ils ne l'auront jamais appris à faire. »
> — Ok-Appearance8856, parent, âges non précisés, 2026-08-18, [r/ParentingFR](https://www.reddit.com/r/ParentingFR/comments/1vrii1u/) [F]

> « on ne peut être qu alarmé face à l usage de l IA pour prendre des raccourcis intellectuels alors que justement, c est l effort qui permet d apprendre. »
> — Suspicious-Yak-5398, parent de jeunes enfants, 2025-05-14, [r/ParentingFR](https://www.reddit.com/r/ParentingFR/comments/1km93q7/) [F]

> « cette application est a éviter absolument pour tout parent qui souhaite que son enfant S'AMÉLIORE en mathématiques »
> — JVCom, parent ou enseignant, avis 1★ sur Brainly, 2023-08-14, App Store RSS, page 6 [AS]

> « Cette appli est surtout utilisée pour avoir les réponses plus rapidement sans avoir à réfléchir. Si nos parents remarque nous n'utilisons plus cette appli. »
> — stan cortis…, **élève**, avis 3★ sur Brainly, 2023-09-17, App Store RSS, page 6 [AS]

> « Franchement c'est vraiment pratique pour les dm mais profs sont épater par les copies sur je leur rend »
> — Mathias du 82, **élève**, avis 4★ sur Gauth, 2025-09-27, App Store RSS, page 4 [AS]

> « Idéal pour les aider dans les DM. Évidemment, il faut quand même prendre le temps de chercher à comprendre le raisonnement »
> — F. Ren, parent, avis 5★ sur Photomath, 2023-10-30, App Store RSS, page 3 [AS]

> « on devrait augmenter le nombre de fiches par semaine et de messages par jour qui sont gratuits. Sinon c'est super car il nous donne pas les réponses »
> — Djibs91270, **élève**, avis 4★ sur Eliott, 2026-02-14, App Store RSS, page 2 [AS]

### Ce qui revient (constats qualitatifs, non quantifiables)

1. **Le soir des devoirs use les parents.** Ils manquent de temps, se jugent incapables d'expliquer « comme l'école », et le conflit s'installe. Les situations les plus dures concernent des enfants TDAH ou dys.
2. **Dans les avis spontanés, le premier grief est la facturation**, avant la pédagogie : reconduction tacite, « pass » mal compris, pas d'essai, découvert bancaire.
3. **Les parents veulent savoir « s'il ne travaille pas ou s'il bloque ».** Ils ne demandent pas à lire les échanges. Le suivi parental des concurrents déçoit souvent (vide, supprimé, absent sur mobile).
4. **Pronote alimente à la fois le contrôle et l'angoisse.** Plusieurs parents y voient un recul de l'autonomie de l'enfant.
5. **Sur l'IA, les parents s'inquiètent de l'effort perdu.** Les élèves, eux, disent sans gêne qu'ils copient. « Ne donne pas la réponse » plaît aux parents ; chez les élèves, c'est la limite de messages gratuits qui pèse.
6. **Les familles qui ne peuvent pas payer sont presque absentes du corpus.** Ces paroles ne valident donc pas le positionnement sur cette cible.

---

## 4. Familles modestes

### 4a. Équipement et connexion

| Chiffre | Champ, méthode | Source | Fiab. |
|---|---|---|---|
| Élèves **sans ordinateur ni tablette pour le travail scolaire** : **14,9 %** dans le quart le plus modeste, 1,6 % dans le quart le plus favorisé (6,2 % en moyenne). Sans accès internet hors smartphone : 7,0 % contre 0,9 %. Sans chambre à soi : 26,5 % contre 3,5 % | PISA 2022 France, 6 770 élèves de 15 ans (surtout en 2nde, 11 % en 3e). **Calcul de l'agent** sur les microdonnées OCDE, avec pondérations et réplicats | [STU_QQQ_SPSS.zip](https://webfs.oecd.org/pisa2022/STU_QQQ_SPSS.zip) | B (calcul non publié) |
| Familles défavorisées : au moins un ordinateur 91 % (très favorisées 99 %) ; **ordinateur personnel de l'élève 43 %** (56 %) ; téléphone personnel 89 % (88 %). En collège d'éducation prioritaire, au moins un ordinateur : 84 % | DEPP, enquête continuité pédagogique, 50 000 familles du second degré, **mai-juin 2020** | [Document de travail 2020-E06](https://archives-statistiques-depp.education.gouv.fr/Default/doc/SYRACUSE/47803) | A, données 2020 |
| Adultes de 25 à 59 ans en foyer de 4 personnes ou plus, à bas revenus : **64 % n'utilisent qu'un ordinateur au plus** (hauts revenus : 32 %). En foyer de 3 personnes ou plus, aucun ordinateur au foyer : 8,5 % contre 2,0 % | Calcul de l'agent sur les microdonnées Crédoc 2025, foyers de 3 personnes ou plus pris comme approximation des parents ; n = 199 à 340 | [CSV data.gouv](https://static.data.gouv.fr/resources/barometre-du-numerique/20260209-094626/barometre-du-numerique-2025.csv) | B (calcul, petit n) |
| Bas revenus : connexion fixe 87 % (+7 points en un an, au niveau des plus aisés) ; **11 % n'accèdent à internet que par le mobile** ; 31 % ont un forfait mobile à moins de 10 € | Crédoc, *Baromètre du numérique 2026*, terrain juin 2025 | [Rapport Arcep](https://www.arcep.fr/uploads/tx_gspublication/barometre-du-numerique-edition-2026_RAPPORT.pdf) | A |
| Adultes de 44 ans ou moins, diplômés d'un CAP-BEP au plus : 3 % en illectronisme et **37 % avec des compétences numériques faibles** (bac+3 : moins de 1 % et 8 %) | Insee, enquête TIC-ménages 2025 | [Insee Focus, 19/02/2026](https://www.insee.fr/fr/statistiques/8739245) | A |

### 4b. Rapport à l'école et confiance

| Chiffre | Source | Fiab. |
|---|---|---|
| Parents d'élèves en quartier prioritaire (QPV, REP) : **88 % ont confiance dans l'enseignant** (86 % au collège). 50 % des parents de collégiens aident aux devoirs. Parmi ceux qui n'aident pas : **peur de se tromper 51 %**, ne savent pas lire ou écrire le français 23 %, manque de temps 21 % | Afev, Trajectoires Reflex et Unaf, *La parentalité à l'épreuve des inégalités* : 737 parents interrogés à la sortie des écoles en QPV, REP et REP+ par des volontaires, mai-juillet 2024. **Acteur intéressé, échantillon non probabiliste** ; incohérence interne sur la part « au plus le Smic » (38 % ou 32 %). [PDF](https://drive.google.com/file/d/1zCAHPuN0AfiIETmYAuWObI32_Kt75PgB/view) | C |
| **25 % de ces parents n'arrivent pas à utiliser Pronote ou l'ENT** : ils ne connaissent pas l'outil (11 %), ne lisent pas le français (9 %), ont un problème d'identifiant ou de connexion (7 %), ne savent pas s'en servir (6 %), n'ont pas d'appareil (3 %) | idem | C |
| 69 % des parents en emploi ont des **horaires atypiques**. 36 % des familles sont monoparentales, 56 % ont 3 enfants ou plus | idem | C |
| « Mon enfant se sent parfois dévalorisé » : réponse « très bien » pour 20 % des catégories pauvres, 5 % des catégories aisées. Communication facile avec la direction : 29 % des modestes, 45 % des aisés | Ifop, mars-avril 2026, commanditaire non identifié | B |
| À caractéristiques comparables, un enfant de cadre a **1,5 fois plus de chances** de prendre des cours particuliers qu'un enfant d'employé. Les familles non imposables connaissent mal le crédit d'impôt | Cnesco 2016, panel DEPP 2007-2011. [PDF](https://www.cnesco.fr/wp-content/uploads/2016/10/1610927_Rapport_Cnesco_Inegalites-4.pdf) | A, ancien |
| Méfiance envers les offres payantes, rapport aux écrans des familles modestes | **Aucune mesure trouvée** | Trou |

### 4c. Langue parlée à la maison

| Chiffre | Source | Fiab. |
|---|---|---|
| **12,4 %** des élèves de 15 ans parlent le plus souvent une autre langue que le français à la maison (9,8 % une langue étrangère). **23,7 %** dans le quart le plus modeste, 5,8 % dans le plus favorisé | PISA 2022 France, calcul de l'agent | B |
| Descendants de deux parents immigrés (18 à 59 ans, souvenirs d'enfance) : 68 % parlaient français et une autre langue avec leurs parents, 14 % uniquement une autre langue | Insee, TeO2 2019-2020. [Insee Références, 30/03/2023](https://www.insee.fr/fr/statistiques/6793260). **Pas les collégiens actuels** | A |

### 4d. Contraintes de temps et de revenu

| Chiffre | Source | Fiab. |
|---|---|---|
| 23 % des enfants mineurs vivent en famille monoparentale (30 % avec un seul de leurs parents, familles recomposées comprises). Selon l'agent, cette part monte de **25 % à 11 ans à 27 % à 14 ans** | Insee Première n° 2032, recensement 2023. [Page](https://www.insee.fr/fr/statistiques/8310621) | A (le chiffre global est revérifié ; les chiffres par âge ont été lus par l'agent) |
| 22,4 % des moins de 18 ans vivent sous le seuil de pauvreté, et 34,0 % des familles monoparentales. En QPV, 55,3 % des mineurs sont pauvres (données 2020) | Insee Première n° 2117, juillet 2026 ([page](https://www.insee.fr/fr/statistiques/9019316)) ; ONPV 2023 | A |
| Dans les Cités éducatives, à l'entrée au collège, 45,3 % des élèves sont dans les groupes faibles en français (27,1 % pour l'ensemble) et 54,2 % en maths (32,5 %) | Rapport ONPV 2023. [PDF](https://www.onpv.fr/uploads/media_items/anct-onpv-rapport-2023.original.pdf) | A |

### 4e. Dispositifs que ces familles utilisent

| Dispositif | Volume | Effet connu | Source |
|---|---|---|---|
| Devoirs faits | Voir `marche-chiffres.md` : enfants d'ouvriers non qualifiés 33 %, contre 13 % chez les cadres (2019) | Aucune évaluation d'effet lue | DEPP |
| CLAS (Caf) | Voir `marche-chiffres.md` : nombre d'enfants non publié | Évaluation Cnaf **non lue** (caf.fr bloque les robots) | — |
| **Afev** : mentorat par des étudiants, 2 h par semaine, plus de 80 % des séances à domicile | 20 376 jeunes en 2024-2025, dont 38,6 % de collégiens (environ 7 900) ; plus de 80 % vivent en QPV. Besoin estimé par l'Afev : 100 000 enfants | Déclaratif, **sans groupe témoin** : 75 % des mentorés disent avoir de meilleurs résultats (C) | [Bilan 2024-2025](https://drive.google.com/file/d/1ydrAsevje7pCHGy0kT6tvaF624atwR3g) ; [mentorat](https://afev.org/actions/mentorat) |
| **Zup de Co** : tutorat gratuit | 13 097 élèves, dont **3 034 à distance** (1 h par semaine en visio, depuis un ordinateur personnel, un club ou la salle informatique du collège) | Évaluation randomisée du tutorat en ligne **en cours** avec l'INJEP, plus de 30 collèges : pas de résultat publié | [Rapport 2024-2025](https://zupdeco.org/wp-content/uploads/2025/11/RA_ZUPdeCO_2024-2025.pdf) |
| Programme de réussite éducative (PRE) | 534 programmes, 85 000 à 100 000 jeunes, 66,1 M€ de l'État en 2025 | Aucune évaluation trouvée | [ANCT](https://anct.gouv.fr/programmes-dispositifs/politique-de-la-ville/dispositifs/programme-de-reussite-educative) |
| Cités éducatives | 247 M€ sur 2019-2024, plus de 600 QPV | Aucune évaluation lue | [ANCT](https://anct.gouv.fr/programmes-dispositifs/politique-de-la-ville/dispositifs/cites-educatives) |

**Non lus :** Coup de Pouce (collège), Article 1, Apprentis d'Auteuil, Secours populaire, abonnements en ligne financés par des collectivités.

---

## 5. Les 5 enseignements les plus solides

**1. Le besoin n'est pas « mon enfant est seul ». Il est « je ne sais plus comment l'aider, et ça finit en dispute ».**
- **Preuves :**
  - 41 % des parents se sentent dépassés par les programmes (42 % au collège), et 30 % ont déjà laissé l'enfant seul faute de savoir l'aider (OpinionWay pour Educlever, C).
  - Le sentiment d'être dépassé ne dépend pas de la CSP (41 % contre 42 %).
  - Pour 23 % des parents, aider aux devoirs est source de dispute ; près de 3 collégiens sur 10 le disent aussi (DEPP, A).
  - Les familles populaires sont mobilisées mais « désorientées » (Kakpo, Rayou, qualitatif).
  - Les forums répètent « un devoir = une bataille » et « je ne suis pas très pédagogique ».
- **Pour la landing :** parler d'un relais qui explique autrement et qui désamorce le conflit. Ne pas décrire les parents comme absents ou démunis.

**2. Le prix et la facturation sont un frein réel. Le gratuit doit l'être vraiment, et le payant doit être limpide.**
- **Preuves :**
  - 46 % des parents ont déjà renoncé à des cours pour raisons financières : 59 % des catégories pauvres, 62 % en REP (Ifop pour Les Sherpas, commanditaire intéressé, C, revérifié).
  - Les enfants de cadres prennent des cours payants 1,5 à 2 fois plus souvent (DEPP, Cnesco, A).
  - Dans les avis spontanés, le premier grief est la facturation : reconduction tacite, « pass » mal compris, découvert bancaire.
  - Des élèves jugent 10 € par mois hors de portée.
- **Pour la landing :** « gratuit, sans carte, sans reconduction » est un argument, à condition d'être tenu. `concurrence.md` montre que le quota actuel (environ 2 messages par soir) ne le tient pas.

**3. Une IA qui donne la réponse nuit à l'apprentissage. Ne pas la donner évite le dommage, mais n'a pas prouvé de gain.**
- **Preuves :**
  - Bastani (PNAS 2025, randomisé) : −17 % à l'examen avec ChatGPT standard ; le tuteur à garde-fous annule ce dommage, sans gain mesurable.
  - L'OCDE (2026) juge les preuves sur les tuteurs socratiques « still emerging ».
  - La méta-analyse positive de Wang et Fan a été rétractée.
  - Les parents sont sceptiques : efficacité perçue de l'IA à 5,1 sur 10 (C), impact jugé négatif par 56 % des parents d'élèves (B/C, petit n).
  - Les élèves avouent copier avec Brainly, Gauth et Photomath.
- **Pour la landing :** promettre « il ne fait pas le travail à sa place, et vous pouvez le vérifier ». Ne jamais écrire « fait progresser » : aucune étude ne l'établit pour des collégiens à la maison.

**4. Ce qui aide, c'est la forme de l'accompagnement, pas sa quantité. Les parents veulent un signal, pas une surveillance.**
- **Preuves :**
  - L'aide aux devoirs est la seule forme d'implication parentale associée négativement à la réussite (Hill et Tyson, Barger, Patall).
  - Une aide soutenante est associée positivement, une aide intrusive négativement (Moroni).
  - L'autonomie pendant les devoirs prédit mieux les résultats que le temps passé (Fernández-Alonso).
  - 46 % des parents sans contrôle parental préfèrent « dialoguer que contrôler » (B).
  - Pronote nourrit le contrôle et la culpabilité des parents (forums).
  - Ce que les parents demandent : savoir « s'il ne travaille pas ou s'il bloque » (Trustpilot, Kartable).
- **Pour le produit :** un résumé « ce qui a été travaillé, ce qui résiste ». Pas l'accès aux messages, ni des notifications en continu.

**5. Pour les familles modestes : smartphone presque toujours, ordinateur partagé ou absent, parent peu disponible et parfois non francophone, confiance dans l'école.**
- **Preuves :**
  - Dans le quart le plus modeste, 14,9 % des élèves n'ont pas d'ordinateur pour l'école (PISA, calcul B).
  - Dans les familles nombreuses à bas revenus, 64 % des adultes n'utilisent qu'un ordinateur au plus (Crédoc, calcul B).
  - 11 % des bas revenus n'accèdent à internet que par le mobile (Crédoc, A).
  - Langue étrangère à la maison : 23,7 % des élèves dans le quart modeste (PISA, B).
  - Familles monoparentales : 25 à 27 % des enfants d'âge collège (Insee, A).
  - Horaires atypiques et peur de se tromper (Afev, C).
  - 25 % des parents en QPV n'arrivent pas à utiliser Pronote ou l'ENT (Afev, C).
  - 88 % ont confiance dans l'enseignant (Afev, C).
  - Les enfants d'ouvriers vont plus à Devoirs faits que les enfants de cadres (DEPP, A).
- **Pour le produit :** un web pensé pour le téléphone et léger en données ; un élève autonome sans parent connecté ; un espace parent minimal et traduisible ; des relais de confiance (collège, associations).

---

## 6. Hypothèses que seuls des entretiens peuvent trancher

| # | Hypothèse | Ce qui la rend plausible | Ce qui manque |
|---|---|---|---|
| H1 | Le moment critique est un **blocage sur une notion**, le soir, quand le parent ne sait pas expliquer, surtout en maths à partir de la 4e | 41 % se disent dépassés ; forums | Aucune mesure par matière ni par niveau |
| H2 | Ce que les parents veulent d'abord, c'est **la paix du soir** (moins de conflit, moins de temps), plus que les résultats | Disputes, « soulager », 77 % préfèrent les loisirs | On ne sait pas laquelle des deux promesses fait agir |
| H3 | « Il ne donne pas la réponse » est un **critère d'achat pour le parent** mais un **motif d'abandon pour l'enfant**, qui retourne vers Gauth ou ChatGPT | Avis d'élèves sur la copie ; Bastani | Jamais testé auprès de collégiens français |
| H4 | Les parents préfèrent **un résumé** à la lecture des échanges, y compris les plus inquiets | « Dialoguer plutôt que contrôler », demande d'un signal « travaille ou bloque » | Aucun sondage ; l'usage de Pronote suggère l'inverse chez certains |
| H5 | Les familles modestes laisseraient leur enfant utiliser seul un tuteur IA **si l'école ou une association le recommande** | Confiance dans l'enseignant ; sources de confiance (UNAF 2022 : famille 49 %, enseignants 41 %) | Aucune mesure de la confiance envers une IA chez ces familles |
| H6 | Pour ces familles, l'appareil de travail est le **smartphone de l'élève** ou un ordinateur partagé, et la data mobile limite l'usage | PISA, Crédoc | Rien sur les collégiens actuels ni sur l'usage réel le soir |
| H7 | Le **prix acceptable** se situe entre 0 € et le prix des applis (5 à 10 € par mois), et le refus tient autant à la peur d'un abonnement piège qu'au montant | Avis ; renoncement de 46 % | Aucune donnée de consentement à payer |
| H8 | L'argument « données en Europe, pas d'entraînement » compte pour une minorité de parents, plutôt diplômés | Un seul témoignage explicite (LaurenceDarabica) | Aucune mesure |
| H9 | Les parents d'enfants **TDAH ou dys** forment un segment à la douleur maximale, et leurs attentes diffèrent (fractionnement, patience) | Très présents dans les forums et les avis | Taille du segment et attentes non mesurées |
| H10 | **Qui décide ?** C'est l'enfant qui adopte l'outil, le parent n'autorise ou ne paie qu'ensuite | Les élèves écrivent la majorité des avis App Store ; 52 % des parents équipent leur enfant pour l'ENT | Inconnu |

---

## 7. Guide d'entretien parent (30 minutes)

### Principes
- **Partir du vécu récent, pas d'opinions sur un produit.** Demander « racontez-moi la dernière fois », jamais « est-ce que vous utiliseriez ».
- **Ne pas nommer Tom, ni l'IA, ni le prix avant le module E.**
- **Ne pas suggérer de réponse.** Pas de « est-ce que c'est stressant ? ». Après chaque réponse, relancer par « qu'est-ce qui s'est passé ensuite ? » ou « pouvez-vous me donner un exemple ? ».
- **Recrutement** : environ 12 à 16 parents de collégiens, de la 6e à la 3e.
  - Au moins la moitié de familles modestes : revenus sous le plafond de l'ARS, collège REP ou QPV, ou parent inactif.
  - Quelques familles monoparentales et quelques parents peu francophones, avec un interprète si besoin.
  - Des parents d'enfants qui utilisent déjà une IA et d'autres non.
  - Recrutement par des canaux qui ne sont pas les nôtres (associations, collèges, réseau de connaissances éloignées) pour éviter le biais d'adhésion.
- **Éthique** : consentement oral enregistré, pas de nom d'enfant, pas d'enregistrement de l'enfant, données supprimées après analyse. Dire clairement qu'on ne vend rien pendant l'entretien.
- **Après chaque entretien** : coder les réponses par hypothèse (H1 à H10) et relever les verbatims.

### A. Ouverture (2 min)
- Présentation : « Nous cherchons à comprendre comment se passent les devoirs dans les familles. Il n'y a pas de bonne réponse. »
- Consentement.
- « Combien d'enfants avez-vous, et en quelle classe sont-ils ? Avec qui vivent-ils ? »

### B. Situation (3 min)
- « Comment décririez-vous votre enfant au collège en ce moment ? »
- « Qu'est-ce qui occupe vos soirées en semaine, à vous et à lui ? » (horaires de travail, garde, fratrie)

### C. Routine des devoirs (7 min) — H1, H2, H6, H10
- « Racontez-moi le dernier soir où il y avait des devoirs. À quelle heure, où, avec quoi, qui était là ? »
- « Que s'est-il passé la dernière fois que votre enfant a bloqué sur un exercice ? Qu'a-t-il fait ? Qu'avez-vous fait ? »
- « Sur quelles matières vous demande-t-il de l'aide ? Et sur lesquelles vous sentez-vous à l'aise ou moins à l'aise ? »
- « Comment savez-vous ce qu'il a à faire et comment ça se passe ? » (laisser venir Pronote ou l'ENT, sans le nommer)
- « Quel appareil utilise-t-il pour ses devoirs ? Est-il à lui ou partagé ? Comment se connecte-t-il ? »
- « Qu'est-ce qui, dans ces moments-là, vous coûte le plus ? » (question ouverte, ne pas proposer « temps », « dispute » ou « compétence »)

### D. Solutions essayées (6 min) — H5, H7, H9
- « Qu'avez-vous déjà essayé pour l'aider ? » Pour chaque solution : « Comment l'avez-vous trouvée ? Combien de temps ? Qu'est-ce qui a marché ou pas ? Pourquoi avez-vous arrêté ? »
- Si la réponse ne le mentionne pas, demander : « Y a-t-il une aide au collège, à la mairie, dans une association ? Comment ça se passe ? »
- « Avez-vous déjà payé pour du soutien ou une application ? Combien, et qu'en avez-vous pensé ? » Si non : « Est-ce que vous y avez déjà pensé ? Qu'est-ce qui s'est passé ? »
- Si l'enfant a des besoins particuliers (dys, TDAH) et que le parent en parle : « Qu'est-ce que cela change pour les devoirs ? »

### E. Le rapport à l'IA (6 min) — H3, H4, H8
- « Avez-vous entendu parler d'outils comme ChatGPT pour les devoirs ? Qu'en savez-vous ? » (neutre : ne pas dire « IA éducative »)
- « Votre enfant s'en sert-il, à votre connaissance ? Comment l'avez-vous appris ? Quelles règles avez-vous posées, s'il y en a ? »
- « Qu'est-ce qui vous rassurerait ou vous inquiéterait si un outil de ce type l'aidait le soir ? » Relancer : « Pouvez-vous me donner un exemple ? »
- « Si un outil l'aidait, qu'aimeriez-vous savoir de ce qu'il fait ? Et que préféreriez-vous ne pas savoir ? » Ne pas proposer d'options. Noter si le parent parle de lire les échanges, de résultats, de temps passé ou d'alertes.
- « Qui, autour de vous, vous ferait confiance sur ce sujet, ou à qui feriez-vous confiance ? »

### F. Présentation du concept et prix (5 min) — H3, H7
Lire une description neutre de deux phrases, la même pour tous les parents, sans adjectif ni promesse : « Un site où l'élève écrit ou prend en photo son exercice. L'outil lui pose des questions et lui donne des indices au lieu de la réponse, et le parent reçoit un résumé de ce qui a été travaillé. »
- « Qu'est-ce que vous en comprenez ? » (reformulation)
- « Dans quelle situation récente cela aurait-il servi, ou pas servi ? »
- « Qu'est-ce qui vous ferait ne pas l'essayer ? »
- Prix, en posant d'abord les questions sur le passé :
  - « Combien dépensez-vous aujourd'hui pour la scolarité, en dehors des fournitures ? »
  - Puis : « À partir de quel prix par mois vous ne regarderiez même pas ? À quel prix vous diriez que c'est cher, mais que vous y réfléchiriez ? À quel prix vous douteriez de la qualité ? »
- « Comment préféreriez-vous payer, ou ne pas payer ? » Laisser venir abonnement, sans engagement, prise en charge par le collège.

Limite à garder en tête : un prix déclaré surestime le prix réellement payé. On retient les ordres de grandeur et les objections, pas un chiffre.

### G. Clôture (1 min)
- « Y a-t-il quelque chose qu'on n'a pas abordé et qui compte pour vous sur les devoirs ? »
- Remerciements. Proposer d'être recontacté pour un test, sans obligation.

### Module à part : familles modestes (10 min, remplace en partie C et D si besoin) — H5, H6, H7
Le mener sans présumer la difficulté. Les questions sont les mêmes pour tous ; ce module creuse seulement plus loin.
- **Équipement et connexion** :
  - « Combien d'appareils avec internet à la maison, et qui s'en sert le soir ? »
  - « Comment se passe la connexion : box, forfait du téléphone ? Arrive-t-il qu'il n'y ait plus de données ? »
- **Langue** :
  - « Quelle(s) langue(s) parle-t-on à la maison ? »
  - « Pour les messages du collège et Pronote, comment faites-vous ? Qui vous aide ? »
- **Démarches en ligne** :
  - « Pour créer un compte ou remplir un formulaire en ligne, comment ça se passe d'habitude ? »
  - « La dernière fois que vous avez dû en créer un pour l'école, que s'est-il passé ? »
- **Temps** :
  - « À quelle heure êtes-vous à la maison les jours de semaine ? »
  - « Qui est avec votre enfant quand il fait ses devoirs ? » (aîné, voisin, personne)
- **Aides existantes** :
  - « Connaissez-vous Devoirs faits au collège, une aide de la mairie, une association ? »
  - « Votre enfant y va-t-il ? Pourquoi, ou pourquoi pas ? »
  - Noter les obstacles cités : horaires, transport, inscription, image.
- **Confiance** :
  - « Quand on vous propose quelque chose de gratuit sur internet pour votre enfant, qu'est-ce que vous vous dites ? »
  - « Qui pourrait vous le recommander pour que vous y croyiez ? »
- **Argent** :
  - « Avez-vous déjà renoncé à une aide pour votre enfant à cause du prix ? Racontez-moi. »
  - Ne pas demander le revenu pendant l'entretien. Le relever au recrutement par tranche, ou par l'éligibilité à l'ARS.

---

## 8. Ce qui n'a pas pu être lu

**Recherche web**
- Le quota de la session était épuisé pour quatre agents sur cinq. FCPE, PEEP, CNAF (l'e-ssentiel), Elabe, Harris, CSA, Odoxa (hors population générale), Unicef France et l'OCDE PISA hors microdonnées n'ont pas pu être cherchés.

**Sites bloqués**
- education.gouv.fr et eduscol : erreur 403. On est passé par l'archive de la DEPP.
- caf.fr : protection anti-robots, d'où l'évaluation des CLAS non lue.
- Cairn : erreur 403, d'où le livre de Kakpo non lu en entier.
- oecd.org : page HTML en 403, d'où les tableaux PISA publiés non lus.
- Les PDF de HAL (note de Périer pour la FCPE, 2023) et archive.org : hors d'accès.

**Avis et forums**
- Trustpilot refuse curl : les citations [TP] ont été lues par un agent dans Chrome, avant l'arrêt de Chrome, et je n'ai pas pu les revérifier.
- Google Play : seuls les 3 avis « pertinents » par app sont accessibles sans JavaScript.
- Reddit en direct : refusé. Lu par l'archive arctic-shift.
- Forums FCPE et PEEP, commentaires de presse, blogs : non consultés.
- Magicmaman : aucun fil exploitable.

**Concurrents sans avis public trouvé**
- Galac6, NeoSko, Le Prof IA. Dinobot : presque rien.

**Données absentes**
- Consentement à payer pour une aide IA.
- Sondage sur Pronote ou la lecture des échanges.
- Compétence des parents par matière.
- Équipement des ménages avec enfants selon le revenu, en données publiées.
- Profil des élèves de Devoirs faits.
- Effet des CLAS, du PRE et des Cités éducatives.
- Résultats de M.I.A. Seconde et de l'évaluation randomisée de Zup de Co.
- Méfiance des familles modestes envers les offres en ligne.

**Correction à faire ailleurs**
- `concurrence.md` cite deux fois les « 95 % des parents » de Kantar (§ 3 et § 5). `marche-chiffres.md` les classe à juste titre comme une formulation trompeuse. Il faut harmoniser.
