# Le foyer, l'élève et l'âge, du CP à la terminale (2026-10-07)

Victor a demandé le 2026-10-07 de revoir le fonctionnement du produit côté foyer et élève, selon
l'âge, la loi et les cas réels, en prévoyant le primaire et le lycée. Huit recherches documentaires
menées le même jour ; sources lues le jour même, « résumé seul » marquant une source dont seul le
résumé était accessible. Instantané : les décisions qui en sortent vont dans `vision.md`,
`tuteur.md` et la roadmap.

## 1. Un bloquant avant tout le reste : les conditions de Mistral

Conditions commerciales de Mistral, en vigueur le 2026-09-25, usages interdits, (c), lues mot pour
mot ([texte](https://legal.mistral.ai/terms/commercial-terms-of-service)) : le client ne doit pas
« include any personal information of children under 13 or the applicable age of digital consent
as Customer Data or allow minors to use the Mistral AI Products without legally adequate consent
from their parent or guardian ».

L'âge du consentement numérique est de 15 ans en France. Lue à la lettre, la première moitié
interdit d'envoyer à Mistral toute donnée personnelle d'un enfant de moins de 15 ans, consentement
parental ou non : presque tout le collège, tout le primaire. La portée de « without legally
adequate consent » est ambiguë. La politique d'usage (2026-06-11) ne dit rien des mineurs.
**À faire clarifier par écrit par Mistral avant tout utilisateur réel**, avec la demande de ZDR.

## 2. Le droit, de 6 à 18 ans

**Deux seuils : 15 ans pour ce qui repose sur le consentement, 18 ans pour la fin de l'autorité
parentale.**

| Texte | Ce qu'il impose |
|---|---|
| Loi Informatique et Libertés, [art. 45](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000037823135) | Avant 15 ans, un traitement fondé sur le consentement exige l'accord conjoint de l'enfant et d'un parent ; à partir de 15 ans, le mineur consent seul |
| [CNIL, recommandation 4](https://www.cnil.fr/fr/recommandation-4-rechercher-le-consentement-dun-parent-pour-les-mineurs-de-moins-de-15-ans) | L'art. 45 ne vise pas le contrat : le parent « peut seul le conclure » ; un parent suffit, l'autre doit pouvoir s'opposer |
| [CNIL, recommandation 1](https://www.cnil.fr/fr/recommandation-1-encadrer-la-capacite-dagir-des-mineurs-en-ligne) ; Code civil [art. 1148](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000032041055) | Un mineur ne contracte seul que des actes courants ; la CNIL recommande qu'à partir de 15 ans il puisse conclure seul, le parent gardant un recours pour faire supprimer le compte. Un abonnement payant reste conclu par le parent |
| [CNIL, recommandation 2](https://www.cnil.fr/fr/recommandation-2-encourager-les-mineurs-exercer-leurs-droits) | Le mineur exerce lui-même ses droits (accès, effacement, opposition) ; le parent peut aussi agir pour lui |
| RGPD art. 6.1.f et 21 | Un résumé envoyé au parent sur la base de l'intérêt légitime est limité « notamment lorsque la personne concernée est un enfant », et l'élève peut s'y opposer |
| Code civil, [art. 371-1](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000038749626) | Autorité parentale jusqu'à la majorité ; les parents associent l'enfant aux décisions selon son âge et protègent sa vie privée |
| Loi Informatique et Libertés, art. 51 II ; RGPD art. 17.1.f | Effacement des données collectées pendant la minorité « dans les meilleurs délais » |
| AI Act art. 50.1 ([texte](https://eur-lex.europa.eu/legal-content/FR/TXT/HTML/?uri=CELEX:32024R1689)) | « Vous parlez à une IA » dès la première interaction, en vigueur depuis le 2026-08-02 |
| AI Act art. 5.1.b | Aucune exploitation d'une vulnérabilité liée à l'âge |
| Code de la consommation, [L215-1-1](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000046190107) | Résiliation en ligne gratuite ; rétractation en ligne depuis le 2026-06-19 |
| Code pénal, [art. 434-3](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000037289453) | Qui a connaissance de mauvais traitements ou d'agressions sur un mineur doit en informer les autorités |

Ne s'appliquent pas : le DSA art. 28 et ses lignes directrices (plateformes qui diffusent au
public ; petites entreprises exclues) ; la loi Studer ; la loi du 2023-07-07 ; l'art. 1er de la
loi 2026-813, censuré ([décision 2026-911 DC](https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000054743009)).
**À surveiller** : le KIDS Act proposé par la Commission en septembre 2026, qui vise aussi les
chatbots accessibles aux mineurs ([FAQ](https://digital-strategy.ec.europa.eu/en/faqs/kids-act-explained)).

Recommandé : un contrôle parental proportionné à l'âge, transparent pour l'enfant, l'historique des
conversations étant cité comme fonction intrusive
([CNIL, recommandation 5](https://www.cnil.fr/fr/recommandation-5-promouvoir-des-outils-de-controle-parental-respectueux-de-la-vie-privee-et-de)) ;
une surveillance proportionnée aux capacités évolutives de l'enfant (ONU,
[Observation générale n° 25](https://documents.un.org/api/symbol/access?s=CRC/C/GC/25&l=en&t=pdf), §75-76) ;
une vérification d'âge proportionnée, une déclaration suffisant pour un faible risque
([CNIL, recommandation 7](https://www.cnil.fr/fr/recommandation-7-verifier-lage-de-lenfant-et-laccord-des-parents-dans-le-respect-de-sa-vie-privee)) ;
une AIPD « en principe » pour des mineurs ([CNIL, IA et éducation](https://www.cnil.fr/fr/education-mise-en-place-systeme-ia)).
La détresse est une donnée de santé, même déduite ([CNIL](https://www.cnil.fr/fr/quest-ce-ce-quune-donnee-de-sante)).

## 3. L'école et l'IA

- **Le ministère n'autorise l'usage autonome de l'IA par les élèves qu'à partir de la 4e** ; une
  formation Pix à l'IA est obligatoire en 4e et en seconde ; utiliser l'IA pour un devoir sans
  autorisation ni travail personnel est une fraude
  ([cadre d'usage, 2025-06-14](https://www.education.gouv.fr/publication-du-cadre-d-usage-de-l-intelligence-artificielle-en-education-462936) ;
  le PDF du cadre, lien mort, n'a pas été lu). Le cadre vise l'usage à l'école ; il pèse sur un
  tuteur recommandé par un collège. L'Unesco proposait 13 ans
  ([2023](https://www.unesco.org/en/articles/unesco-governments-must-quickly-regulate-generative-ai-schools)).
- **Primaire** : le travail du soir y est d'abord oral (leçons, lecture) ; l'interdiction des
  devoirs écrits (circulaires de 1956 et 1994) a été abrogée en 2009 sans texte qui la remplace,
  une situation « pour le moins ambiguë » selon l'IGEN, qui proposait 20 à 40 minutes de travail
  du soir ([rapport 2008-086](https://www.education.gouv.fr/sites/default/files/document/2008-086-IGEN_216466.pdf-254925.pdf)).
  En fin de CP, un élève lit 30 mots par minute, 70 en fin de CE1
  ([programme du cycle 2, annexe 3](https://www.education.gouv.fr/sites/default/files/document/Annexe%203%20%E2%80%93%20Programme%20de%20fran%C3%A7ais%20du%20cycle%202-403818.pdf)) :
  une réponse écrite ne lui est pas lisible.
- **Écrans avant 11 ans** : pas de téléphone avant 11 ans, une exposition « modérée et contrôlée »
  ([commission écrans, 2024](https://www.elysee.fr/admin/upload/default/0001/16/fbec6abe9d9cc1bff3043d87b9f7951e62779b09.pdf)) ;
  dès 6 ans « toujours avec un suivi parental », à partir de 9 ans sur des appareils collectifs
  ([ministère de la Santé](https://solidarites.gouv.fr/enfants-et-ecrans-des-risques-sanitaires-reels-un-accompagnement-necessaire)).
- **Lycée** : plus de 90 % des élèves de seconde d'une académie avaient déjà utilisé l'IA pour
  leurs devoirs ([Sénat, 2024](https://www.senat.fr/rap/r24-101/r24-101-syn.pdf), sondage d'origine
  non lu) ; le ministère expérimente une remédiation par IA en seconde (MIA Seconde,
  [DEPP 2026](https://www.education.gouv.fr/sites/default/files/document/num-rique-ducatif-que-nous-apprennent-les-donn-es-de-la-depp--516644.pdf)).

## 4. Les cas réels

| Cas | Leçon |
|---|---|
| Raine c. OpenAI (plainte, 2025, allégations) : 377 messages signalés pour automutilation, sans coupure ni personne prévenue ([plainte](https://www.courthousenews.com/wp-content/uploads/2025/08/raine-vs-openai-et-al-complaint.pdf)) | Une détection doit déboucher sur une action |
| OpenAI (sept. 2025), Meta AI (juillet 2026) : alerte au parent relue par un humain, sans transcript, avec des ressources ([Meta](https://about.fb.com/news/2026/07/keeping-parents-informed-teens-distress-conversations-meta-ai/)) ; à 18 ans, fin du lien parental avec un préavis d'une semaine ([OpenAI](https://help.openai.com/en/articles/20001262-what-changes-when-a-chatgpt-user-turns-18)) | Revue humaine, motif sans contenu ; rien ne bascule en silence |
| Character.AI : fin des conversations ouvertes pour les moins de 18 ans, 2025-11-25 ([blog](https://blog.character.ai/u18-chat-announcement/)) | Rester un tuteur, pas un compagnon |
| Replika, 5 M€ (Garante, 2025) ; TikTok, 345 M€ (DPC, 2023) ; Epic, Xbox, Edmodo (FTC) | Protection par défaut ; consentement avant collecte |
| Khanmigo : le parent voit tout l'historique ([Khanmigo](https://www.khanmigo.ai/parents)) | Un modèle qui existe, contraire à la recommandation 5 de la CNIL |

## 5. La recherche

- **La confidence de l'enfant protège plus que la surveillance** : Kerr et Stattin 2000 ; Keijsers
  2016 (longitudinal, intra-famille) ; Liu et al. 2020 (méta-analyse, résumé seul).
- **L'aide parentale aux devoirs** : faiblement positive au primaire, négative au collège
  (Patall et al. 2008, méta-analyse) ; négative en moyenne et peu modulée par l'âge selon Barger et
  al. 2019 (méta-analyse, 448 études) ; la « socialisation académique » est la forme la plus
  favorable au collège (Hill et Tyson 2009, r = .39) ; une aide soutenante plutôt qu'intrusive
  (Moroni 2015, résumé seul).
- **La légitimité parentale recule d'abord sur le personnel**, beaucoup moins sur la sécurité
  (Cumsille et al. 2009, [PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC3880678/) ; Levy et al. 2026) ;
  un ado qui reconnaît à son parent le droit de savoir dissimule moins
  ([Rote et Smetana 2016](https://www.sas.rochester.edu/psy/people/faculty/smetana_judith/assets/pdf/RoteSmetana_2016_Beliefs.pdf)).
- **Les tranches d'âge des cadres de conception sont un consensus d'experts**, pas des seuils
  mesurés ([ICO, annexe B](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/childrens-code-guidance-and-resources/age-appropriate-design-a-code-of-practice-for-online-services/annex-b-age-and-developmental-stages/)) :
  à 6-9 ans, appareil partagé, lecture variable, famille première influence ; à 10-12 ans, premier
  smartphone ; à 13-15 ans, influence des pairs.
- **Jeunes enfants et IA** : tendance à prêter des traits humains au système, à éviter
  ([UNICEF 2025](https://www.unicef.org/innocenti/media/11991/file/UNICEF-Innocenti-Guidance-on-AI-and-Children-3-2025.pdf)) ;
  à 7-8 ans, plus de confiance dans l'assistant vocal que dans l'humain pour les faits
  (Girouard-Hallam et Danovitch 2022) ; un agent de lecture dialoguée aussi efficace qu'un humain
  chez les 3-6 ans (Xu et al. 2022, essai randomisé) ; la reconnaissance vocale des enfants reste
  difficile, sans donnée sur les francophones (Fan et al. 2024).
- **La détresse et le parent** : plus de la moitié des 12-17 ans hospitalisés pour idées
  suicidaires ne les avaient pas dites à leurs parents
  ([Bettis 2023](https://pmc.ncbi.nlm.nih.gov/articles/PMC10524440/)) ; plus la famille dysfonctionne,
  moins l'ado s'y confie ([Hammond 2025](https://pmc.ncbi.nlm.nih.gov/articles/PMC11795579/)) ; au
  119, 78 % des faits rapportés sont commis par les parents
  ([activité 2024](https://www.allo119.gouv.fr/sites/default/files/upload/content/activite/etude_annuelle_snated-119_annee2024_1.pdf)) ;
  Childline ne lève la confidentialité que pour une vie en danger ou un abus par une figure
  d'autorité ([NSPCC](https://learning.nspcc.org.uk/services/childline?modularPage=confidentiality-and-referrals)).

## 6. Ce que font les autres

- Les acteurs de l'IA conversationnelle n'ont qu'un palier mineur (OpenAI : 13-17 ans ;
  Character.AI : moins de 18 ans). Les paliers multiples (Google : 15 ans en France ; Apple : 13 ;
  Instagram : 16) règlent qui crée le compte et qui coupe la supervision, jamais la lecture des
  échanges par le parent.
- Jeunes enfants : le parent crée un profil sans e-mail (Khan, IXL, Google, Apple), la session
  s'ouvre sur l'appareil familial ; collégiens : entrée par code ou QR à usage unique (Nomad,
  Seneca, ClassDojo), bascule de profil sur l'appareil du parent ; lycéens : compte propre, parent
  payeur (Kartable, Studocu à partir de 13 ans avec accord parental jusqu'à 16).
- Partout le parent voit des métadonnées ; aucun lien ne se coupe en silence ; l'âge vient d'une
  déclaration ou d'une date saisie par le parent.

## 7. Le modèle proposé

Un seul foyer, un seul système de comptes, et **trois façons d'accompagner l'élève**. Le mode suit
le niveau scolaire, et lui seul ; l'âge ouvre des droits (15 ans) et met fin au lien parental
(18 ans), dans n'importe quel mode. Le parent ouvre le
foyer et conclut le contrat, gratuit compris ; il déclare le niveau et le mois de naissance, sans
autre vérification. Un second parent peut rejoindre le foyer et s'opposer.

| | Accompagné (CP à CM2) | Guidé (6e à 3e) | Autonome (seconde à terminale) |
|---|---|---|---|
| Qui ouvre la séance | Le parent, sur un appareil familial ; il est présent | L'élève, sur un appareil relié par un code à usage unique ; ou un profil protégé par le code de l'enfant sur l'appareil du parent | L'élève, avec son propre identifiant (e-mail et clé d'accès) ; invité par le parent ou rattaché par lui |
| Ce que le parent connaît de la connexion | Il ouvre lui-même la séance | Aucun identifiant durable : il demande un code à usage unique et peut déconnecter un appareil. Il pourrait échanger ce code lui-même : tout appareil relié est visible de l'élève et lui est signalé | Rien |
| Interaction | La voix d'abord, séances courtes (20 à 40 minutes au plus) | Texte, photo, voix | Texte, photo, voix |
| Ce que voit le parent | Le résumé ; il est présent pendant la séance | Le résumé, que l'élève voit au même moment | Le résumé, que l'élève voit au même moment |
| Détresse | Réponse immédiate à l'enfant, revue humaine, parent prévenu après revue | Réponse immédiate, revue humaine, l'élève prévenu avant le parent, aucun contenu transmis | Même règle, annoncée à l'inscription |

Fixe à tous les âges : jamais les conversations au parent ; l'élève sait ce que voit son parent,
expliqué à l'oral pour les plus jeunes ; « vous parlez à une IA » dès la première interaction, et
Tom ne se présente pas comme un ami ; rien de la vie de l'enfant ni de ses conversations gardé
d'une séance à l'autre, seule une mémoire d'apprentissage acceptée par le parent et l'enfant,
par l'élève seul à partir de 15 ans (revu le 2026-10-07, `memoire-entre-seances.md`), pas de mécanique d'engagement ; aucune bascule
silencieuse, chaque changement prévient l'élève et le parent.

Droits de l'élève, à tout âge : il les exerce lui-même (accès, effacement, opposition), le parent
pouvant aussi agir pour lui ([CNIL, recommandation 2](https://www.cnil.fr/fr/recommandation-2-encourager-les-mineurs-exercer-leurs-droits)) ;
il peut demander l'arrêt du résumé (RGPD art. 21). À partir de 15 ans, sa demande s'applique, le
parent prévenu ; avant 15 ans, elle se traite avec le parent, ni l'un ni l'autre ne passant outre,
selon une conduite à faire valider par un conseil (§ 8, point 2).

Transitions : le passage d'un mode au suivant suit le changement de niveau, prévenu des deux côtés ;
un élève de collège qui a 15 ans reste en mode guidé, avec les droits de ses 15 ans ; **à 18 ans,
le lien parental prend fin**, prévenu une semaine avant : plus de résumé, l'abonnement peut passer
au jeune ou s'arrêter, et le jeune peut faire effacer ses données de mineur.

La détresse : la réponse immédiate reste celle de `tuteur.md` §5 (3114, adulte de confiance, fin de
séance), avec le 119 quand le message laisse penser que le danger vient de la maison. **Pas
d'alerte automatique au parent** : un humain relit chaque événement et décide ; le parent ne reçoit
que le motif et des ressources. Écart avec la vision actuelle, à trancher par Victor et par un
conseil.

**Périmètre** : la V1 reste le collège. Le primaire et le lycée sont prévus dans le modèle de
données (niveau du CP à la terminale, mode déduit du niveau et de l'âge) et ne se construisent
qu'après. Le primaire demande en plus une mesure de la reconnaissance vocale sur des enfants
français, et une position claire face au cadre du ministère (usage autonome à partir de la 4e) ;
le mode accompagné y répond par la présence du parent.

**Plus tard, « demande à ton parent »** : l'élève ouvre Tom et invite son parent, aucun tutorat
avant l'accord. Levier de distribution, après l'avis d'un conseil.

**Décision de Victor, le 2026-10-07** : modèle validé, V1 limitée au collège, détresse relue par
un humain (Victor au départ) avant tout message au parent. La question de la clause (c) part à
Mistral à la fin, avec la demande de ZDR.

## 8. Pour l'avis d'un conseil, avant l'ouverture

1. La clause (c) des conditions de Mistral et sa compatibilité avec un service pour moins de 15 ans
   (avec Mistral lui-même).
2. La base légale du traitement des données de l'élève et du résumé envoyé au parent ; l'opposition
   d'un élève de 15 ans ou plus (art. 21).
3. L'exception de l'art. 9 pour la détection de détresse ; l'art. 45 s'étend-il au consentement
   explicite.
4. La portée de l'art. 434-3 pour une société quand l'information vient d'un modèle ; Tom est-il
   un hébergeur au sens du DSA (art. 18).
5. Le sort de l'abonnement et des données à 18 ans ; l'exposition au KIDS Act.

## 9. Non vérifié

- La part d'élèves de 6e sans smartphone à eux ; le partage d'appareils dans les familles
  modestes. Premier smartphone vers 11 ans et 4 mois (Ipsos 2024, source secondaire).
- Le texte du cadre d'usage de l'IA du ministère (PDF introuvable) : la règle de la 4e est lue sur
  la page de présentation.
- Ce que les 6-18 ans accepteraient que leur parent voie d'un tuteur IA : aucune étude.
- L'efficacité des alertes parentales d'OpenAI ou de Meta : aucun chiffre publié.
- La reconnaissance vocale de Voxtral sur des voix d'enfants francophones.
- Plusieurs articles lus en résumé seul (Liu 2020, Moroni 2015, Smetana 2006, Tan 2025).
