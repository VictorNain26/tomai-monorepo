# Mémoire d'une séance à l'autre (2026-10-07)

Victor a demandé le 2026-10-07 que Tom se souvienne d'une séance à l'autre, en suivant les
applications qui le font déjà. Jusqu'ici la règle était inverse : `tuteur.md` § 7 et § 10, et
`foyer-eleve-age.md`, parmi les règles « fixes à tous les âges ». Aujourd'hui, Tom reçoit à chaque
tour le prénom, la classe, la matière, le résumé de la séance, ses 40 derniers messages et la fiche
de l'exercice en cours. Il ne sait rien des séances passées. Sources lues le jour même ; (e) marque
une page bloquée, lue par l'extrait d'un moteur de recherche.

## Ce que font les autres

| Application | Ce qui est retenu | Écriture | Relecture | Contrôles | Mineurs |
|---|---|---|---|---|---|
| ChatGPT | Faits et préférences, plus l'historique des chats ([FAQ](https://help.openai.com/en/articles/8590148-memory-faq) e) | Pendant le chat ; tri automatique par récence et fréquence depuis le 2025-10-15 | Mémoires toujours injectées | Voir, supprimer, désactiver ; chat temporaire | Le parent peut couper la mémoire ([contrôle parental](https://help.openai.com/en/articles/12315553--parental-controls-on-chatgpt-faq) e) |
| Claude | Contexte de travail, une mémoire par projet ([aide](https://support.claude.com/en/articles/11817273-use-claude-s-chat-search-and-memory-to-build-on-previous-context)) | Synthèse au fil des chats | Synthèse injectée, recherche dans les chats par outil | Voir, éditer, pause, remise à zéro ; incognito | 18 ans et plus |
| Gemini | Ce qu'il apprend des chats ([aide](https://support.google.com/gemini/answer/16598469)) | Non documenté | Non documenté | Désactiver, supprimer | 18 ans et plus |
| Le Chat (Mistral) | Préférences et intérêts ([aide](https://help.mistral.ai/en/articles/396497-how-do-you-handle-my-data-when-using-the-memories-feature)) | Sur demande, ou pour une préférence récurrente | Non documenté | Voir, éditer, supprimer, désactiver | Non documenté |
| Khanmigo | Historique d'exercices, prérequis non maîtrisés, intérêts ([blog, 2026-05-06](https://blog.khanacademy.org/how-khan-academy-is-building-a-better-ai-tutor-our-most-recent-learnings/)) | Tiré du dossier d'apprentissage | Signaux injectés dans le prompt, en texte | Le parent et l'enseignant lisent tout | COPPA, FERPA |
| Duolingo (Lily) | Une liste de faits sur l'utilisateur ([blog](https://blog.duolingo.com/ai-and-video-call/)) | Après l'appel, le modèle relit la transcription | Liste injectée à l'appel suivant | Non documenté | Non documenté |
| Character.ai, Replika | Mémoire de compagnon : famille, dates, journal ([Replika](https://help.replika.com/hc/en-us/articles/37208679176077-How-does-Replika-s-memory-work) e) | Automatique | Couche visible, couche « profonde » | Édition | Chat libre fermé aux moins de 18 ans chez Character.ai ([2025-11-25](https://blog.character.ai/u18-chat-announcement/)) ; Replika condamnée à 5 M€ par le Garante ([décision](https://www.garanteprivacy.it/home/docweb/-/docweb-display/docweb/10132048)) |

Ce qui revient :
- **Un profil court, toujours injecté**, et parfois une recherche dans l'historique en plus.
- **Une écriture en fin d'échange**, en arrière-plan, chez Duolingo et Claude.
- **Les contrôles convergent** : voir, corriger, supprimer, désactiver, un mode sans mémoire.
- **Les généralistes ferment la mémoire aux mineurs** ou la confient au parent.
- **L'éducation retient l'état d'apprentissage**, tiré des exercices plutôt que des confidences.
  C'est le seul gain mesuré, chez Khan (blog cité), en A/B tests sur des millions de fils de
  tutorat, d'octobre 2025 à avril 2026. La mesure est la réussite de l'élève, seul, à l'exercice
  suivant :
  - +3,4 % quand le tuteur reçoit un résumé des exercices récents, justes et faux (608 000 fils) ;
  - +2,7 % quand il reçoit les prérequis non maîtrisés (1,36 million de fils).
  Ce sont deux expériences distinctes. Khan en fait « in total » 6,1 %, une somme, sans dire
  si le gain est absolu ou relatif : on cite les deux mesures, pas le total.

## Ce que disent les mesures et la pédagogie

- **Les benchmarks de mémoire** mesurent le rappel de faits dans du bavardage, pas
  l'apprentissage :
  - LoCoMo ([arXiv 2402.17753](https://arxiv.org/html/2402.17753)) et LongMemEval ([arXiv 2410.10813](https://arxiv.org/html/2410.10813)) : des faits extraits coûtent peu de tokens pour un peu de précision perdue.
  - La recherche vectorielle ne bat pas une structure simple.
  - Aucun essai contrôlé trouvé sur une mémoire de tuteur.
- **Le knowledge tracing** estime la maîtrise notion par notion, d'après les réussites et les
  erreurs ([Corbett & Anderson 1994](https://link.springer.com/article/10.1007/BF01099821)) : la
  clé de la mémoire est la notion, pas le texte de la conversation.
- **L'open learner model** montre à l'élève ce que le tuteur croit de lui, au service de sa
  métacognition ([Bull & Kay 2016](https://doi.org/10.1007/s40593-015-0090-8)).
- **Les erreurs procédurales reviennent et se diagnostiquent**
  ([Brown & Burton 1978](https://doi.org/10.1207/s15516709cog0202_4)).
- **Le rappel espacé fait mieux retenir** ([Cepeda 2006](https://doi.org/10.1037/0033-2909.132.3.354)).
- **Ne pas retenir de « style d'apprentissage »** : aucune base de preuves pour adapter
  l'enseignement à ces styles ([Pashler 2008](https://doi.org/10.1111/j.1539-6053.2009.01038.x)).

## Ce que dit le droit

- **Profilage.** Une mémoire d'apprentissage est un profilage (RGPD, art. 4.4). L'art. 22 ne la
  vise pas tant qu'elle n'emporte aucune décision à effet juridique ou similaire : adapter une aide
  n'en est pas une, sans texte qui le dise expressément ([WP251](https://ec.europa.eu/newsroom/article29/redirection/document/49826)).
- **Haut risque (AI Act).** L'annexe III, 3, vise l'évaluation dans les établissements. Les
  exemples de la Commission, encore en projet, mettent hors champ une application choisie par
  l'élève, et dans le champ un rapport qui sert à un enseignant pour noter ([service desk](https://ai-act-service-desk.ec.europa.eu/en/education-and-vocational-training)).
  Vendre à un collège, ou transmettre la mémoire à un enseignant, rouvrirait la question. Les
  obligations de l'annexe III sont repoussées au 2027-12-02 ([AI Omnibus](https://digital-strategy.ec.europa.eu/en/news/ai-omnibus-enters-force)).
- **Compagnon.** L'attachement d'un enfant à une IA est un risque nommé par la Commission
  (lignes directrices sur l'art. 5, § 105 et 116). Le projet de KIDS Act veut que, par défaut, un
  chatbot ne reporte pas les conversations d'un enfant dans les suivantes ([FAQ](https://digital-strategy.ec.europa.eu/en/faqs/kids-act-explained)).
  Une mémoire qui ne garde aucune conversation y échappe-t-elle ? Non tranché.
- **Par défaut.** La CNIL recommande de désactiver par défaut le profilage des mineurs, sauf
  intérêt de l'enfant ([recommandation 8](https://www.cnil.fr/fr/recommandation-8-prevoir-des-garanties-specifiques-pour-proteger-linteret-de-lenfant)),
  comme le standard 12 de l'ICO ([profiling](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/childrens-code-guidance-and-resources/age-appropriate-design-a-code-of-practice-for-online-services/12-profiling/)).
- **Base légale.** Une mémoire qu'on peut désactiver n'est pas nécessaire au contrat ([EDPB 2/2019](https://www.edpb.europa.eu/sites/default/files/files/file1/edpb_guidelines-art_6-1-b-adopted_after_public_consultation_en.pdf), § 57). Reste :
  - le consentement : avant 15 ans, conjoint de l'enfant et d'un parent ([art. 45](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000037823135)) ;
  - ou l'intérêt légitime, avec le droit d'opposition.
  À faire valider par un conseil.
- **Données sensibles.** « Je suis dyslexique », un trouble ou une détresse sont des données de
  santé (art. 9 ; [CJUE C-184/20](https://juricaf.org/arret/CJUE-COURDEJUSTICEDELUNIONEUROPEENNE-20220801-C18420)) : on les exclut.
- **AIPD.** Elle est obligatoire de fait avant la mise en service : enfants, profilage et usage
  innovant réunissent trois critères du [WP248](https://ec.europa.eu/newsroom/just/document.cfm?doc_id=47711).
  `suivi.md` la portait déjà parmi les points de conformité ; elle entre dans la porte avant
  ouverture (`roadmap.md`) et dans `tuteur.md` § 11.

## Les techniques

| Option | Pourquoi pas ici |
|---|---|
| Mem0 ([arXiv 2504.19413](https://arxiv.org/html/2504.19413v1)) | Deux appels de modèle par écriture, des faits en texte libre ; en Node, pas d'embedder Mistral |
| Letta | Serveur v1 retiré au profit d'un harnais de code |
| LangMem, Zep et Graphiti | Python ; Graphiti exige une base de graphe |
| Memory tool d'Anthropic | Claude seulement, et le modèle écrit lui-même sa mémoire |
| Sessions de l'OpenAI Agents SDK, Conversations de Mistral | Historique d'une conversation, pas de mémoire entre conversations |

Le risque majeur : l'empoisonnement de la mémoire, un texte injecté qui persiste puis revient
dans chaque prompt (OWASP, Top 10 agentique 2026, ASI06). Il y a aussi la fuite entre élèves d'une
base vectorielle mal filtrée ([LLM08:2025](https://genai.owasp.org/llmrisk/llm082025-vector-and-embedding-weaknesses/)),
qu'a connue l'ancien serveur (#378). Les parades : le serveur écrit, pas le modèle ; une mémoire
cloisonnée par élève ; une provenance et une expiration.

## Recommandation

**Une mémoire pédagogique, tirée de ce que le serveur sait déjà, sans bibliothèque ni
embeddings.** C'est le motif de Khanmigo : l'historique d'exercices injecté en texte. C'est aussi
la clé du knowledge tracing : la notion du programme. Chaque fiche porte déjà les identifiants de
ses notions (`sheet.entries`). Chaque exercice garde le palier d'aide atteint, les tours bloqués
et sa résolution. Le diagnostic donne un type d'erreur dans une liste fermée (`guess`,
`misinterpret`, `careless`, `right-idea`, `imprecise`).

1. **Ce qu'on garde en plus** :
   - le type d'erreur de chaque tour, dans `turn_record` ;
   - l'accord du parent et celui de l'enfant ;
   - les corrections de l'élève (une notion, sa date), et la date de sa dernière remise à zéro ;
   Aucun texte de l'élève, aucune conversation, aucun fait sur sa vie.
2. **Ce que Tom lit** : à chaque tour d'un exercice, le serveur agrège, pour les notions de sa
   fiche, les exercices antérieurs de l'élève sur l'année scolaire. Par
   exemple : « Priorités opératoires : travaillée 3 fois, a résisté jusqu'au palier 4 la dernière
   fois, erreur fréquente : consigne mal comprise ». Le texte ne contient que des libellés du
   référentiel, des nombres et des types d'erreur. Il reste stable pendant l'exercice, donc en
   cache. La requête passe toujours par l'élève de la séance.
3. **Ce que l'élève voit** : une page « Ce que Tom retient », notion par notion, où il peut
   corriger (« j'ai compris ») ou tout effacer. C'est l'open learner model, et ce qu'exigent
   l'accès et la rectification exercés par l'enfant lui-même.
   - Une correction ou une remise à zéro change ce que le serveur agrège ensuite : seuls comptent
     les exercices postérieurs, pour la notion corrigée ou pour toutes.
   - Le bloc se recalcule à chaque tour, à partir des exercices antérieurs à celui en cours :
     désactiver, corriger ou effacer joue au tour suivant, pas à la fin de l'exercice.
   - Effacer la mémoire n'efface pas l'historique des séances, que l'élève relit et dont vit le
     résumé du parent. Cet historique a sa propre durée de conservation, à fixer dans l'AIPD ; la
     mémoire n'en est qu'une lecture.
4. **Ce que voit le parent** : rien de plus que le résumé de la semaine, qui puise dans ces mêmes
   données (lot 3).
5. **Ce qu'on exclut** :
   - la détresse, qui reste dans `distress_event` et sa relecture humaine ;
   - la santé et les émotions ;
   - toute relance, série ou notification « reviens » ;
   - toute phrase de Tom du genre « je me souviens de toi ».
6. **Coût** : environ 100 tokens par exercice, mis en cache. Environ 0,003 centime par séance,
   sans appel de plus.
7. **Plus tard, sur mesure seulement** : nommer l'idée fausse récurrente par un appel structuré en
   fin d'exercice. Le schéma est fermé, la notion prise dans la fiche, le libellé court, avec
   provenance et expiration. Environ 0,1 centime par séance.

**Tests** :
- deux élèves sur la même notion : rien de l'un dans le prompt de l'autre ;
- sans l'accord du parent et de l'enfant (ou de l'élève seul à partir de 15 ans), aucun bloc ;
- une désactivation, une correction ou une remise à zéro changent le bloc dès le tour suivant ;
- rien d'avant la rentrée ni d'avant la dernière remise à zéro dans l'agrégat ;
- le bloc identique d'un tour à l'autre d'un même exercice ;
- un « retiens que… » de l'élève ne laisse aucun texte en base ;
- la suppression du compte efface tout ;
- le harnais compare l'aide avec et sans mémoire, en une seule mesure annoncée, avant de la
  promettre. Il ne mesure que ce qu'il peut voir : sur des scénarios à plusieurs séances, l'aide
  s'appuie-t-elle sur ce qui a résisté, sans rien affirmer de faux ni donner la réponse ? Il ne
  dit pas que l'élève apprend mieux : seule une mesure sur de vrais élèves, comme celle de Khan,
  le dirait.

## Décisions de Victor (2026-10-07)

1. **Activation** : avant 15 ans, proposée par le parent à l'ajout de l'enfant et acceptée par
   l'enfant à sa première séance ; l'un ou l'autre la coupe à tout moment. À partir de 15 ans,
   l'élève décide seul (loi Informatique et Libertés, art. 45, et la règle de `foyer-eleve-age.md`
   pour ses demandes) ; à 18 ans, le lien parental prend fin.
2. **Portée** : notions, paliers et types d'erreur, tirés des exercices, sans appel de modèle.
   L'idée fausse nommée par un appel structuré ne viendra que si le harnais montre un gain.
3. **Durée** : l'année scolaire. Remise à zéro à la rentrée ; effacement à la suppression du compte
   et à la désactivation.
4. **Promesse** : « Tom reprend là où ça a résisté » entre dans la vision comme promesse à prouver,
   annoncée seulement après la mesure, et jamais comme un gain d'apprentissage.

`vision.md`, `tuteur.md` (§ 7 et § 10) et la règle de `foyer-eleve-age.md` changent avec cette
étude.

**Mistral.** La clause (c) de ses conditions interdit les données personnelles d'enfants de moins
de 15 ans ; une clarification écrite est demandée. `tuteur.md` § 11 promettait que rien
d'identifiant ne partirait chez Mistral d'ici là, alors que le tuteur envoie le prénom à chaque
tour (`studentBlock`) et que la mémoire ajoute un profil d'apprentissage, une catégorie nouvelle.
Victor a tranché le 2026-10-07 : aucun vrai élève avant la réponse de Mistral ; le prénom et la
mémoire partent dans le prompt, et en sortent si Mistral refuse.
