# Fournisseur d'IA et données d'élèves de moins de 15 ans

Recherche documentaire du 2026-10-17. Toutes les sources ont été consultées ce jour-là, sauf
mention contraire. Rien ici n'est un avis juridique : les points marqués **[avocat]** demandent un
avis d'avocat ou une confirmation écrite du fournisseur.

## 1. Mistral : ce que disent les textes aujourd'hui

### Conditions commerciales (Commercial Terms of Service, en vigueur depuis le 25 septembre 2026)

Source : <https://legal.mistral.ai/terms/commercial-terms-of-service>

Clause 2.2, texte exact :

> Customer will not, and will not permit any other person (including any End User) to: […]
> (c) include any personal information of children under 13 or the applicable age of digital
> consent as Customer Data or allow minors to use the Mistral AI Products without legally adequate
> consent from their parent or guardian;

La clause a deux branches :

- **La première branche est absolue.** Elle interdit d'envoyer comme Customer Data des données
  personnelles d'enfants de moins de 13 ans « ou de l'âge applicable de consentement numérique ».
  En France, cet âge est de 15 ans (art. 45 de la loi Informatique et Libertés, voir §4). On la
  lit donc comme une interdiction des données des moins de 15 ans, *même avec le consentement des
  parents*. **[avocat]** pour confirmer cette lecture, et pour savoir si les messages et la voix
  d'un élève identifié comptent comme « personal information ». Pour la voix, la réponse est
  presque certainement oui.
- **La seconde branche** admet les mineurs avec un consentement parental « legally adequate ».
  En pratique, elle couvre les 15-17 ans.

Autres clauses utiles du même texte :

- **1.4 Customer Responsibilities** : le client est « solely responsible » des actes de ses End
  Users et doit obtenir leurs consentements.
- **14.8 Entire Agreement**, texte exact : « Unless otherwise agreed in writing between Customer
  and Mistral AI, these Terms […] and any Order Forms constitute the entire agreement ». La clause
  ajoute que les déclarations des employés de Mistral sont « expressly excluded […] absent a
  separate written agreement ».
- **14.11 Conflicts**, texte exact : « (1) Order Form (if any); (2) Additional Terms; (3) these
  Terms; and (4) our policies ».
- **Conséquence** : la seule voie contractuelle visible est une dérogation écrite, par Order Form
  ou par accord distinct signé. Une réponse du support par e-mail risque de ne pas suffire, car
  14.8 exclut les « statements or comments » des employés. Il faut demander que la dérogation
  figure dans un document contractuel. **[avocat]**
- Le DPA (Data Processing Addendum, en vigueur depuis le 27 juillet 2026,
  <https://legal.mistral.ai/terms/data-processing-addendum>) décrit les personnes concernées comme
  « any other natural person whose personal data is processed by Customer when using the Mistral AI
  Products **in accordance with the Agreement** ». Il ne lève donc pas la clause 2.2(c), il y
  renvoie.

### Usage Policy (en vigueur depuis le 11 juin 2026)

Source : <https://legal.mistral.ai/terms/usage-policy>. Le texte ne contient aucune règle d'âge.
Il ne parle des enfants qu'à travers l'interdiction des contenus pédocriminels (« zero tolerance
policy regarding CSAM »).

### Passer par un partenaire (Azure, AWS Bedrock, Google Vertex) n'enlève pas la clause

- **Commercial Terms 1.2** : l'usage sur l'infrastructure d'un partenaire est soumis, « unless
  otherwise specified therein », à ces Terms et aux *Partner Served – Deployment Terms*.
- **Partner Served – Deployment Terms** (en vigueur depuis le 28 mai 2026,
  <https://legal.mistral.ai/terms/partner-served-deployment-terms>), clause (c), texte exact :
  « send any personal information of children under 13 or the applicable age of digital consent or
  allow minors to use the Mistral AI Products without consent from their parent or guardian ».
- **Conclusion** : la même interdiction suit les modèles Mistral servis par Azure, Bedrock ou
  Vertex, et s'ajoute aux conditions de chaque cloud. Chez Google, ces conditions excluent de toute
  façon les moins de 18 ans (§3).
- **Infrastructure du client** : la clause 1.1 des Commercial Terms exige une autorisation par
  Order Form pour utiliser les « Mistral AI Products » sur sa propre infrastructure. Le texte ne
  dit pas si cela vise aussi les poids publiés sous Apache 2.0. **[avocat]**

### Conditions grand public (Le Chat), pour comparaison

Source : <https://legal.mistral.ai/terms/eu-consumers-terms-of-service>, en vigueur depuis le
8 octobre 2026. Âge minimum 13 ans, permission parentale « where required ». La même clause (c)
y figure.

## 2. Modèles open-weight et hébergeurs français

### Licences

- **Mistral Small 4** (`mistralai/Mistral-Small-4-119B-2603`) est sous **Apache 2.0** (fiche
  Hugging Face et <https://docs.mistral.ai/models/mistral-small-4-0-26-03>). C'est un MoE de
  119 Md de paramètres, dont 6,5 Md actifs. La commande vLLM de la fiche le sert sur 2 GPU
  (`--tensor-parallel-size 2`). L'API de Mistral affiche 0,15 $ et 0,60 $ par million de tokens.
- **Voxtral** (<https://docs.mistral.ai/getting-started/models/>) :
  - Voxtral Small et Voxtral Mini Transcribe Realtime sont sous Apache 2.0.
  - **Voxtral TTS est sous CC BY-NC 4.0** : non commercial, donc inutilisable hors de l'API de
    Mistral.
  - Voxtral Mini Transcribe 2 est un modèle « Premier », sans poids publics indiqués.
- La licence Apache 2.0 ne pose aucune restriction d'usage, d'âge compris. Héberger soi-même ces
  poids, ou les faire servir par un hébergeur, ne fait plus passer par les Terms de Mistral, sous
  la réserve 1.1 ci-dessus. **[avocat]**

### Scaleway Generative APIs (Paris)

- **Conditions particulières Services IA**, version du 07/04/2026
  (<https://www-uploads.scaleway.com/Conditions_Particulieres_Services_IA_61a1a5f301.pdf>) :
  - **Aucune clause sur les mineurs.**
  - §2.2, texte exact : « Le Client s'engage à prendre connaissance des termes de la licence
    encadrant l'utilisation du Modèle sélectionné. Le Client reconnaît que les conditions
    d'utilisation de ces Modèles peuvent contenir des restrictions d'utilisation. »
  - §4.4, texte exact : « Scaleway ne conserve aucune requête ni aucun Contenu généré après le
    traitement ». Les données ne servent pas à l'entraînement et ne sont « pas accessibles par les
    fournisseurs de Modèles LLM ». Exception : une conservation temporaire en cas d'activité
    malveillante, et 24 h en mode Batch.
- **Licences** (<https://www.scaleway.com/en/docs/generative-apis/reference-content/supported-models/>) :
  mistral-small-3.2-24b-instruct-2506, voxtral-small-24b-2507, pixtral-12b et mistral-large-3 sont
  sous Apache 2.0, et mistral-medium-3.5 sous « Modified MIT ». La page ajoute que les licences
  non open-weight « do not apply to usage through Scaleway Products due to existing partnerships ».
  Il faut donc demander par écrit à Scaleway si un accord avec Mistral fait remonter la clause
  2.2(c) sur les modèles Mistral qu'il sert. **[à confirmer par Scaleway]**
- **Prix** (<https://www.scaleway.com/en/pricing/model-as-a-service/>, hors taxes) :
  - mistral-small-3.2-24b : 0,15 € en entrée, 0,35 € en sortie par million de tokens.
  - mistral-medium-3.5 : 1,50 € / 7,50 €.
  - gpt-oss-120b : 0,15 € / 0,60 €.
  - whisper-large-v3 : 0,003 € la minute.
  - Le premier million de tokens est gratuit.
  - **Mistral Small 4 n'est pas au catalogue serverless**, et Voxtral n'a pas de prix affiché.
- **GPU** (<https://www.scaleway.com/en/pricing/gpu/>, PAR-1) : L4-1-24G à 0,79 €/h, soit environ
  575 €/mois. Les H100 et L40S sont listés sans prix dans cette zone : prix non vérifié.

### OVHcloud AI Endpoints (Gravelines)

- **Conditions particulières Public Cloud**, version du 26 août 2026, annexe 10
  (<https://contract.eu.ovhapis.com/1.0/pdf/Conditions_particulieres_OVH_Stack-fr.pdf>) :
  - **Aucune clause sur les mineurs.**
  - Texte exact : « Les Modèles sont des Produits Tiers soumis aux Conditions Produits Tiers […]
    Ces Conditions Produits Tiers peuvent contenir des restrictions d'usage ».
  - §5, texte exact : « OVHcloud n'a aucune connaissance des Inputs et des Outputs et OVHcloud ne
    les réutilise pas, de quelque manière que ce soit. OVHcloud n'effectue aucune sauvegarde des
    Inputs ou des Outputs. »
- **Code de conduite IA** (version du 28 avril 2025) : aucune règle d'âge.
- **Catalogue** (API publique du catalogue, consultée le 2026-10-17) :
  - **Les modèles Mistral (Small 3.2, Nemo) y sont marqués « non disponibles ».** Small 3.2 était
    affiché à 0,09 € / 0,28 € par million de tokens.
  - Modèles disponibles : gpt-oss-120b (0,08 € / 0,40 €), Qwen3.5-397B (0,60 € / 3,60 €),
    Llama 3.3 70B, whisper-large-v3 (environ 0,0025 € la minute) et Qwen3Guard pour la
    modération.
  - Les voix TTS proposées ne couvrent pas le français : de, es, it, en-us.

### Clever Cloud

Clever Cloud ne propose **pas d'inférence hébergée** :

- « Clever AI » est un agrégateur multi-fournisseurs, en alpha privée, sans prix ni localisation
  publiés (<https://www.clever.cloud/clever-ai/>).
- « Otoroshi with LLM » est une passerelle vers des fournisseurs tiers.
- Clever Cloud ne change donc rien à la question : la clause du fournisseur appelé derrière
  continue de s'appliquer.

## 3. OpenAI, Anthropic, Google

| | Mineurs via l'API | Hébergement UE |
|---|---|---|
| **OpenAI** | Services Agreement (en vigueur depuis le 1er janvier 2026), 3.3(c), texte exact : « allow minors to use OpenAI Services without consent from their parent or guardian ». **Aucune interdiction d'âge trouvée**, seulement le consentement parental. Les Usage Policies (en vigueur depuis le 29 octobre 2025) ajoutent des protections (« Keep minors safe »). | Résidence UE réservée aux clients « éligibles », pour un nouveau projet créé en région Europe, avec zéro rétention ([annonce](https://openai.com/index/introducing-data-residency-in-europe/)). Les critères d'éligibilité ne sont pas publiés. |
| **Anthropic** | Usage Policy (la page affiche une version en vigueur le 12 novembre 2026), texte exact : « Products serving minors, including organizations providing minors with the ability to directly interact with products that incorporate our API(s), must comply with the additional guidelines ». Le [guide du 2026-03-16](https://support.claude.com/en/articles/9307344) exige vérification de l'âge, modération, surveillance, éducation, conformité affichée et mention de l'IA. Aucun âge minimum. Les Commercial Terms (en vigueur depuis le 17 juin 2025) ne contiennent aucune clause sur les mineurs (recherche par mots-clés). | **Pas d'UE en direct** : `inference_geo` n'accepte que `"us"` et `"global"`, et la seule « workspace geo » est `"us"` ([doc](https://platform.claude.com/docs/en/manage-claude/data-residency)). Via Bedrock ou Vertex, la région dépend de l'endpoint. Les régions UE par modèle n'ont pas été vérifiées. |
| **Google** | **Exclu.** Les Gemini API Terms (mis à jour le 2026-04-28) disent : « You must be 18 years of age or older » et interdisent un service « directed towards or is likely to be accessed by individuals under the age of 18 ». Les Service Specific Terms de Google Cloud (Generative AI Services, donc Vertex) contiennent la même règle, texte exact : « Age Restrictions. Customer will not, and will not allow End Users to, use a Generative AI Service as part of a website […] directed towards or is likely to be accessed by individuals under the age of 18 ». | Sans objet. |

**AWS Bedrock** :

- Aucune règle d'âge générale trouvée dans les AWS Service Terms (section 50, AI Services) ni dans
  la Responsible AI Policy. Seul Amazon Lex a une règle COPPA pour les moins de 13 ans.
- Pour un modèle Mistral, les Partner Served Terms (§1) s'appliquent quand même.
- Pour Claude, ce sont les règles d'Anthropic ci-dessus.

**Prix indicatifs** (USD par million de tokens, entrée / sortie) :

- Claude Haiku 5.5 : 0,10 / 0,50 pour des prompts de moins de 100 000 tokens
  ([pricing](https://platform.claude.com/docs/en/about-claude/pricing)).
- GPT-5.4 mini : 0,75 / 4,50 ([fiche](https://developers.openai.com/api/docs/models/gpt-5.4-mini)).
- Le surcoût éventuel de la résidence UE chez OpenAI n'a pas été vérifié.

## 4. Cadre légal (France et UE)

### RGPD art. 8 et loi Informatique et Libertés art. 45

Le RGPD, art. 8.1 (texte FR, EUR-Lex CELEX:32016R0679), ne vise que le cas où la base légale est
le consentement. Texte exact : « Lorsque l'article 6, paragraphe 1, point a), s'applique, en ce qui
concerne l'offre directe de services de la société de l'information aux enfants […] ». L'art. 8.2
ajoute que le responsable « s'efforce raisonnablement de vérifier » l'accord parental.

La loi Informatique et Libertés, art. 45, est en vigueur depuis le 1er juin 2019. Texte relevé sur
la copie de la loi publiée par la CNIL ; Légifrance bloquait l'accès automatique :

> En application du 1 de l'article 8 du règlement (UE) 2016/679 du 27 avril 2016, un mineur peut
> consentir seul à un traitement de données à caractère personnel en ce qui concerne l'offre
> directe de services de la société de l'information à compter de l'âge de quinze ans. Lorsque le
> mineur est âgé de moins de quinze ans, le traitement n'est licite que si le consentement est
> donné conjointement par le mineur concerné et le ou les titulaires de l'autorité parentale à
> l'égard de ce mineur. […]

### Recommandations de la CNIL

- **Recommandation 4** (9 juin 2021,
  <https://www.cnil.fr/fr/recommandation-4-rechercher-le-consentement-dun-parent-pour-les-mineurs-de-moins-de-15-ans>) :
  - Le consentement d'un seul parent suffit en pratique, car c'est un « acte usuel ». L'autre
    parent doit pouvoir s'y opposer.
  - Pour un service fondé sur un contrat conclu en ligne, la logique diffère : si le mineur ne
    peut pas contracter seul, ce sont les parents qui contractent.
  - **[avocat]** : choisir la base légale. Un contrat signé par le parent ou un consentement
    conjoint ne déclenchent pas les mêmes formalités.
- **Fiche « IA dans l'éducation »** (20 juin 2025,
  <https://www.cnil.fr/fr/education-mise-en-place-systeme-ia>) :
  - Une AIPD est requise en principe pour des données d'élèves.
  - Le fournisseur doit fournir une « AIPD cadre ».
  - Aucune réutilisation des données pour améliorer le service, aucun traceur publicitaire.
  - Une information « simple et pédagogique » adaptée à l'âge.
  - Une préférence pour les solutions locales (« on device » ou « on premise »).
  - La fiche vise les établissements scolaires, mais ses critères donnent un repère utile.
- **Âge** : le CEPD a adopté la déclaration 1/2025 sur la vérification de l'âge en ligne, qui pose
  10 principes (article CNIL du 20 février 2025).

### AI Act (règlement (UE) 2024/1689)

**Annexe III, point 3 (éducation), systèmes à haut risque** :

- 3(b) : « AI systems intended to be used to evaluate learning outcomes, including when those
  outcomes are used to steer the learning process of natural persons in educational and vocational
  training institutions at all levels ».
- 3(c) : évaluer le niveau d'enseignement approprié.
- Un tuteur à la maison, hors établissement, qui « évalue » et « oriente » l'apprentissage, est à
  la frontière. La mention « in educational … institutions » pourrait l'exclure.
  **[avocat, point décisif]**

**Calendrier, d'après des sources secondaires concordantes** (Orrick, artificialintelligenceact.eu ;
la page EUR-Lex n'a pas pu être chargée) :

- Le « Digital Omnibus » (règlement (UE) 2026/1744) est en vigueur depuis le 27 juillet 2026.
- Les obligations des systèmes à haut risque de l'Annexe III sont **repoussées au 2 décembre
  2027**.
- **Art. 50**, transparence, non repoussé : informer la personne qu'elle parle à une IA, applicable
  depuis le 2 août 2026.
- **Art. 5(1)(f)** : la reconnaissance des émotions dans l'éducation est interdite depuis le
  2 février 2025.
- **Art. 4**, maîtrise de l'IA : réduit à une obligation de « take measures to support ».

### Ce qui change avec un hébergeur français plutôt que l'API de Mistral

- **Ce qui ne change pas** :
  - Catiche reste responsable de traitement.
  - Base légale, art. 45, information des enfants, AIPD et art. 50 de l'AI Act : tout reste à sa
    charge.
  - L'hébergeur est un sous-traitant (art. 28 RGPD) dans les deux cas, et les données restent en
    France.
- **Ce qui change** :
  - **La clause contractuelle 2.2(c) disparaît** si l'hébergeur n'est pas lié à Mistral pour ce
    modèle (Scaleway : à confirmer ; OVH : modèles Mistral indisponibles).
  - La rétention diminue : Scaleway et OVH ne journalisent pas les prompts, alors que Mistral ne
    le fait pas seulement sous ZDR, réservé au paiement à l'usage.
  - Le sous-traitant change : DPA, registre et politique de confidentialité sont à mettre à jour.

## Tableau des options

| Fournisseur et modèle | Mineurs autorisés ? | Données en UE ? | Coût indicatif (par M tokens, entrée / sortie) |
|---|---|---|---|
| Mistral API (Small 4, Voxtral) | **Non sous 15 ans en France** (2.2(c)), sauf dérogation écrite (Order Form) | Oui, endpoint UE | 0,15 $ / 0,60 $ |
| Mistral via Azure, Bedrock, Vertex | **Non** : même clause dans les Partner Served Terms (et Vertex : 18+) | Selon la région | Non vérifié |
| Scaleway (Mistral Small 3.2, Voxtral Small, Apache 2.0) | Aucune clause sur les mineurs chez Scaleway ; lien éventuel avec Mistral à confirmer | Oui, Paris, aucune conservation | 0,15 € / 0,35 € ; Whisper 0,003 €/min |
| Scaleway (gpt-oss-120b, Qwen, sans lien Mistral) | Aucune clause trouvée | Oui, Paris | gpt-oss 0,15 € / 0,60 € |
| OVHcloud AI Endpoints (gpt-oss, Qwen, Whisper) | Aucune clause trouvée | Oui, Gravelines, aucune sauvegarde | gpt-oss 0,08 € / 0,40 € ; Mistral indisponible le 2026-10-17 |
| Auto-hébergement de Mistral Small 4 (Apache 2.0) | Aucune restriction de licence (réserve 1.1) | Oui, chez nous | 2 GPU H100/H200 en continu : plusieurs milliers d'euros par mois (non vérifié) |
| OpenAI API | Oui, avec consentement parental (3.3(c)) | Résidence UE pour clients éligibles | GPT-5.4 mini : 0,75 $ / 4,50 $ |
| Anthropic API | Oui, avec les garde-fous du guide « serving minors » | Pas d'UE en direct (us/global) ; possible via Bedrock UE | Haiku 5.5 : 0,10 $ / 0,50 $ |
| Google Gemini / Vertex | **Non** (18+) | Sans objet | Sans objet |
| Clever Cloud | Pas d'inférence propre | Sans objet | Sans objet |

## Une vision robuste à la réponse de Mistral

- Écrire la vision en termes de critères, pas de fournisseur : « des modèles ouverts, servis en
  France, sans conservation des échanges, par un fournisseur qui n'interdit pas les moins de 15
  ans ». Mistral par API n'en devient qu'une des options possibles.
- Garder Small 4 et Voxtral pour le développement. La voie pour les élèves réels : les mêmes
  familles de poids Apache 2.0 chez un hébergeur français (Scaleway d'abord), une fois sa réponse
  écrite reçue.
- Si Mistral accorde une dérogation, elle doit figurer dans une Order Form, pas dans un e-mail du
  support.
- La voix synthétique reste le maillon faible : Voxtral TTS n'est pas commercial hors de l'API, et
  OVH ne propose pas de voix française.

## Limites

- Aucun avis d'avocat. Quatre points en dépendent :
  - la lecture de 2.2(c) ;
  - la portée de la clause 1.1 sur les poids Apache ;
  - la qualification d'un tuteur à domicile au regard de l'Annexe III 3(b) ;
  - le choix de la base légale.
- Non vérifiés :
  - les conditions de Microsoft (Azure Foundry) ;
  - les régions UE par modèle sur Bedrock ;
  - les CGS générales de Scaleway et d'OVH (seules les conditions IA ont été lues) ;
  - le prix des GPU H100 en PAR-2 ;
  - le prix de Voxtral chez Scaleway ;
  - le surcoût de la résidence UE chez OpenAI.
- Le texte du Digital Omnibus n'a pas été lu sur EUR-Lex (site inaccessible à l'outil) : les dates
  viennent de sources secondaires concordantes.
- La loi française de juillet 2026 sur les réseaux sociaux avant 15 ans aurait été censurée en
  partie le 14 août 2026. Source non primaire ; elle vise les réseaux sociaux, a priori pas un
  tuteur.
- La page de l'Usage Policy d'Anthropic affiche une version en vigueur le 12 novembre 2026, donc
  postérieure à la consultation ; la version applicable aujourd'hui n'a pas été comparée.
- La résidence UE d'OpenAI ne publie pas ses critères d'éligibilité.
