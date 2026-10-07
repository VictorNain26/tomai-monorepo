# Rentabilité et quotas de Tom (2026-10-07)

Demandé par Victor le 2026-10-07 : fixer les quotas et calculer la rentabilité, impôts compris.
Tous les prix et règles ont été lus le jour même (sources en § 10). Le modèle,
`rentabilite-modele/model.py`, se lance sans dépendance (`python3 model.py`) et imprime chaque
tableau ci-dessous ; chaque entrée y porte son statut : M mesuré, S sourcé, H hypothèse, C calcul.
Il reprend `../2026-10-01/couts.md`, avec en plus les coûts du tour refait, le foyer, la fiscalité
et la rétention.

## Synthèse

- **Le coût IA d'un élève payant est faible** : 0,23 € HT par mois à l'usage normal, 0,67 € à
  l'usage intensif. Un foyer payant à 7,99 € laisse 5,42 € par mois avant les coûts fixes (franchise
  de TVA, micro BIC avec versement libératoire, Stripe).
- **Le gratuit décide de la rentabilité.** Un foyer gratuit à l'usage normal coûte 0,32 € TTC par
  mois. Si 3 % des foyers actifs paient, chaque payant porte 32 gratuits et la marge devient
  négative ; à 6 %, elle tient de justesse. Le gratuit ne tient que si son usage moyen reste léger,
  ou si la part payante dépasse 6 %.
- **Les élèves gratuits font aussi les coûts fixes.** Hébergement, traces et e-mails suivent les
  élèves actifs, pas les payants : à 6 % de payants, 100 foyers payants font 1 900 élèves actifs
  et 270 € HT de frais par mois.
- **Le seuil de rentabilité est bas, un revenu ne l'est pas.** Les frais sont couverts à 40 foyers
  payants (6 % de payants). 1 500 € par mois demandent 620 foyers payants, soit 6 000 inscriptions
  par mois en régime établi ; 1 530 foyers et 15 000 inscriptions si seulement 3 % paient. **Le
  vrai risque est la distribution.**
- **La publicité payante est exclue** : un inscrit rapporte de 0,36 à 0,81 € net sur sa vie, contre
  26 $ par lead sur Meta dans l'éducation. Restent l'école, les associations, les CSE et le
  bouche-à-oreille.
- **L'année scolaire payée d'avance est le premier levier** : un mensuel paie 3,3 mois en
  moyenne, été compris, soit 18 € net ; une année à 69 € en laisse 48.
- **Micro-entreprise d'abord** : la micro BIC avec versement libératoire laisse le plus quand la
  marge est large (6 % de payants, 300 foyers et plus) ; la SASU passe devant quand elle est mince,
  car la micro cotise sur le chiffre d'affaires et la SASU sur le bénéfice.

## 1. Recommandations

| Sujet | Position | Raison |
|---|---|---|
| Quota du Gratuit | **2 c par élève et par jour**, coût réel compté, voix comprise (transcription et lecture) | Couvre une soirée normale (1,74 c) avec photo et voix, comme le promet la vision ; 1 c n'en couvre que 0,6 |
| Quota du Complet | **10 c par élève et par jour** | Un foyer moyen (1,16 élève) au plafond tous les jours du mois laisse encore 1,56 € à 7,99 € (1,23 € avec la TVA) ; c'est 5,7 soirées normales par jour |
| Fonctionnement du quota | Remise à zéro à 4 h, heure de Paris ; si le quota ne peut pas être lu, le tour est refusé, sauf la réponse de détresse, qui passe toujours | Une soirée qui finit après minuit ne se coupe pas en deux ; un compteur illisible ne doit pas ouvrir la facture |
| Unité du quota | Par élève, sans plafond par foyer | La marge vient de l'usage moyen ; le plafond ne sert qu'à arrêter l'abus. Trois enfants au plafond tous les jours coûteraient 10,80 € TTC par mois : un cas à guetter dans les mesures, pas à coder d'avance |
| Prix | **7,99 € TTC par mois**, et **une année scolaire à 69 € payée d'avance, sans renouvellement automatique** | 7,99 € tient au pire cas ; 5,99 € ne tient plus au plafond de 10 c (marge nulle). L'année sans renouvellement répond aussi à la peur d'un abonnement piège (`../../vision.md`, questions ouvertes). Kartable vend 99,90 € pour 10 mois |
| Statut | **Rester micro-entrepreneur, en BIC, avec le versement libératoire** si le revenu fiscal le permet ; revoir le choix au passage du seuil de TVA (vers 390 foyers payants) ou si le GAR devient un canal | Aucun coût de création, et le statut existe déjà ; le GAR n'accepte que des personnes morales (`../2026-10-01/statut-juridique.md`) |
| Paiement | **Stripe avec `@better-auth/stripe`** : abonnement par carte, l'année en paiement unique (Checkout) | Le plugin officiel de notre auth gère clients, abonnements, essais et webhooks ; 311 313 téléchargements la semaine du 2026-09-28, version 1.7.7 du 2026-09-30. Mollie coûte un peu moins, mais demanderait de tout coder ; Paddle, marchand officiel, coûte 0,84 € par paiement à 7,99 € |
| Traces Langfuse | Tout tracer tant que l'offre Hobby suffit (50 000 points, environ 400 élèves actifs), puis échantillonner la production (`TraceIdRatioBasedSampler`, 10 %) | À 1 000 foyers payants, les traces coûtent 171 € par mois sans échantillonnage, 35 € avec |
| ZDR de Mistral | Activer le paiement à l'usage, avec un plafond de dépense | Il suffit pour demander le ZDR (« only with pay-as-you-go ») ; il n'a pas de frais fixes, et l'usage inclus reste acquis |

**À trancher par un expert-comptable**, en une consultation : BIC ou BNC ; le taux de TVA de
Tom, normal ou réduit à 5,5 % comme Kartable (−0,27 € par foyer au lieu de −0,97 € une fois la TVA
due) ; la CFP. **À donner par Victor** : le chiffre d'affaires annuel de son activité de
micro-entrepreneur actuelle (`EXISTING_CA`), qui s'ajoute à celui de Tom pour les seuils de TVA
et de la micro, et son revenu fiscal de référence de 2024, qui ouvre ou non le versement
libératoire.

## 2. Coût d'un tour, d'une soirée, d'un élève

La fiche d'exercice fait 73 % du coût mesuré au passage de fin : **le coût d'une soirée suit le
nombre d'exercices, pas de messages.** La lecture à voix haute est le poste le plus cher par
tour : une réponse lue coûte 7,6 fois le reste du tour.

| Événement | Centimes HT |
|---|---|
| Exercice : trois tirages de fiche | 0,407 |
| Photo d'un exercice (lecture) | 0,078 |
| Tour : rédaction, régénération comprise | 0,028 |
| Tour : analyse en raisonnement (1 000 tokens) | 0,061 |
| Tour : diagnostic (une fois sur 2,5) | 0,003 |
| Tour dicté : transcription de 15 s | 0,070 |
| Réponse lue à voix haute | 0,763 |
| Tour : résumé incrémental, amorti | 0,006 |
| Résumé hebdomadaire au parent | 0,093 |
| Tour type (10 % dictés, 10 % lus) | 0,183 |
| Tour type sans voix | 0,100 |

| Profil (séances par semaine) | Séance | Texte seul | Type (photo 25 %, voix 10 %) | Chaque réponse lue |
|---|---|---|---|---|
| léger (2) | 3 tours, 1 exercice | 0,71 c | 0,98 c | 3,04 c |
| normal (4) | 6 tours, 1,5 exercice | 1,21 c | 1,74 c | 5,86 c |
| intensif (6) | 12 tours, 3 exercices | 2,42 c | 3,48 c | 11,72 c |

Par élève et par mois, sur 36 semaines de cours et 8 de petites vacances à 30 % de l'usage :
léger 0,07 €, normal 0,23 €, intensif 0,67 € HT (0,20, 0,75 et 2,25 € si chaque réponse est lue).

## 3. Les quotas

| Budget (c par jour) | Soirées normales | Soirées intensives | Tours de texte sans exercice | Foyer au plafond 30 jours (€ TTC) |
|---|---|---|---|---|
| 1 | 0,6 | 0,3 | 10 | 0,42 |
| 2 | 1,1 | 0,6 | 20 | 0,84 |
| 5 | 2,9 | 1,4 | 50 | 2,09 |
| 10 | 5,7 | 2,9 | 100 | 4,18 |

À 2 c, un élève gratuit fait sa soirée normale, photo comprise ; s'il fait lire chaque réponse à
voix haute, il s'arrête après un ou deux tours : la voix se paie sur son budget, c'est voulu.

## 4. Le revenu d'un foyer payant

Net par foyer et par mois, avant coûts fixes (micro, versement libératoire, Stripe 1,5 % +
0,25 € et Billing 0,7 %) :

| Prix TTC | TVA | Avant IA | Usage normal | Au plafond de 10 c chaque jour | Usage normal, en BNC |
|---|---|---|---|---|---|
| 5,99 | franchise | 4,24 | 3,92 | 0,06 | 3,63 |
| 7,99 | franchise | 5,73 | 5,42 | 1,56 | 5,03 |
| 7,99 | due | 4,71 | 4,45 | 1,23 | 4,12 |
| 9,99 | franchise | 7,23 | 6,92 | 3,06 | 6,43 |

En franchise, la TVA des fournisseurs ne se récupère pas : l'IA et l'hébergement comptent TTC.

Sensibilité, en € par foyer et par mois sur la base de 5,42 € : raisonnement de l'analyse à
2 000 tokens −0,06 ; une réponse sur deux lue −0,33 ; chaque réponse lue −0,73 ; profil intensif
−0,62 ; carte premium −0,10 ; BNC −0,39 ; TVA due −0,97 (−0,27 au taux réduit). Le coût IA du payant
n'est jamais le problème.

## 5. Le gratuit

Marge par payant, une fois payés les gratuits du mois (€, 7,99 €, franchise) :

| Usage moyen d'un foyer gratuit | Coût par foyer gratuit (€ TTC) | 3 % de payants | 6 % | 9 % |
|---|---|---|---|---|
| léger, quota 2 c | 0,09 | 2,47 | 3,99 | 4,50 |
| normal, quota 1 c | 0,18 | −0,47 | 2,56 | 3,58 |
| normal, quota 2 c | 0,32 | −4,75 | 0,49 | 2,24 |
| intensif, quota 2 c | 0,54 | −12,00 | −3,02 | −0,03 |

La part payante parmi les foyers actifs n'a pas de repère direct : 2,1 % des inscrits paient à
35 jours en médiane, 4,5 % au quartile haut, et Duolingo compte 9 % de payants parmi ses actifs.
Si l'usage gratuit se révèle normal et la part payante basse, le levier est le quota du Gratuit,
pas le prix : c'est une valeur de configuration.

## 6. Rétention, année scolaire, seuils

Un foyer mensuel paie 4,1 mois en moyenne (calage sur les taux de RevenueCat, § 10), 3,3 si l'été
double les départs :

| Rétention | Mois payés, été compris | Valeur nette (€) | Par inscrit, à 2,0 % de conversion | 3,1 % | 4,5 % |
|---|---|---|---|---|---|
| basse | 2,8 | 14,98 | 0,30 | 0,46 | 0,67 |
| médiane | 3,3 | 17,96 | 0,36 | 0,56 | 0,81 |
| haute | 4,6 | 25,13 | 0,50 | 0,78 | 1,13 |

Une année scolaire payée d'avance rapporte 40,17 € à 59 €, 47,66 € à 69 € et 55,15 € à 79 €, l'usage de
toute l'année compté. La
comparaison vaut par acheteur : combien de familles prennent l'année plutôt que le mois reste à
mesurer.

Pour couvrir les frais, puis un revenu (gratuits légers, quota de 2 c, rétention médiane) :

| Revenu visé (€ par mois) | Part payante | Foyers payants | Élèves actifs | Nouveaux payants par mois | Inscriptions par mois (3,1 %) |
|---|---|---|---|---|---|
| 0 | 3 % | 145 | 5 607 | 44 | 1 411 |
| 0 | 6 % | 40 | 773 | 12 | 389 |
| 0 | 9 % | 29 | 374 | 9 | 282 |
| 1 500 | 3 % | 1 528 | 59 083 | 461 | 14 873 |
| 1 500 | 6 % | 622 | 12 025 | 188 | 6 054 |
| 1 500 | 9 % | 495 | 6 380 | 149 | 4 818 |
| 2 500 | 6 % | 946 | 18 289 | 285 | 9 208 |

Repère : 3,4 millions de collégiens à la rentrée 2025 ; 12 000 élèves actifs en font 0,35 %.

## 7. Coûts fixes

Hébergement à l'option la plus chère de Scaleway et Clever Cloud par palier d'élèves actifs
(100, 1 000, 10 000, puis un palier de plus par tranche de 10 000), outils, e-mail, assurance :

| Foyers payants (6 %) | Élèves actifs | Points Langfuse | Langfuse (€) | Coûts fixes HT (€) | Avec 10 % des traces |
|---|---|---|---|---|---|
| 30 | 580 | 69 192 | 25,73 | 136,25 | 110,52 |
| 100 | 1 933 | 230 639 | 35,01 | 268,51 | 233,50 |
| 300 | 5 800 | 691 917 | 67,76 | 307,06 | 265,04 |
| 1 000 | 19 333 | 2 306 389 | 170,78 | 585,59 | 449,82 |

Les paliers d'hébergement ne reposent sur aucune mesure de charge (H18 de `couts.md`) : le serveur
attend surtout Mistral, et un palier mal dimensionné déplace le seuil de quelques dizaines de
payants. Investissement initial, non sourcé : avocat pour les CGV, la politique de
confidentialité et l'AIPD (2 000 €), marque à l'INPI pour une classe (190 €).

## 8. Micro-entreprise ou SASU

Ce qui reste au fondateur par mois, gratuits et frais compris (7,99 €, usage normal, gratuits
légers) ; micro BIC avec versement libératoire, SASU sans salaire avec les dividendes au PFU
(31,4 %) après l'IS, expert-comptable à 1 000 € HT par an ; une SASU, personne distincte, ne
compte pas le chiffre d'affaires de la micro existante pour la franchise de TVA :

| Part payante | Foyers payants | CA annuel TTC (€) | TVA | Micro (€/mois) | SASU (€/mois) |
|---|---|---|---|---|---|
| 3 % | 100 | 9 588 | franchise | −91 | −8 |
| 3 % | 500 | 47 940 | due | 416 | 639 |
| 3 % | 1 000 | 95 880 | due | 935 | 1 386 |
| 6 % | 100 | 9 588 | franchise | 82 | 96 |
| 6 % | 300 | 28 764 | franchise | 833 | 747 |
| 6 % | 500 | 47 940 | due | 1 282 | 1 144 |
| 6 % | 1 000 | 95 880 | due | 2 667 | 2 357 |

La micro sort de son plafond de 83 600 € HT vers 1 050 foyers payants, avant de compter
l'activité existante de Victor. Une SASU sans salaire n'ouvre aucune protection sociale ni
retraite, et doit sa propre CFE dès sa deuxième année, quand la micro existante la paie déjà ; ni
l'une ni l'autre n'est au tableau.

## 9. Mesures à faire avant de figer les chiffres

| Mesure | Ce qu'elle change | Quand |
|---|---|---|
| Tokens de raisonnement de l'analyse, passée en raisonnement high par #415 (H : 1 000) | Coût du tour ; faible (§ 4) | Étape 5, au premier tour réel en préproduction |
| Points Langfuse réels d'un tour et d'un exercice (H : 4 et 4) | Seuil d'échantillonnage | Étape 7 |
| Charge du serveur par élève actif | Paliers d'hébergement | Étape 7 |
| Profils réels : séances par semaine, tours, exercices, part de photo et de voix lue | Quotas et coût du gratuit | Lot 3, premières familles |
| Part payante parmi les foyers actifs, rétention, choix de l'année | Tout le § 6 | Après l'ouverture |

## 10. Faits vérifiés le 2026-10-07

### Coûts mesurés du tour refait (`../2026-10-06/passage-de-fin.md`)

Au taux que Mistral applique au compte (0,85) : fiche d'exercice 0,349 € pour 257 appels (un
tirage, raisonnement high ; trois tirages par exercice) ; tour de chat 0,093 € pour 359 ; analyse
du tour 0,019 € pour 363 (avant que #415 la passe en raisonnement high, non mesurée depuis) ;
diagnostic 0,003 € pour 35 ; titre 0,004 € pour 112 ; cartes 0,007 € pour 9.

### Prix

- Mistral Small 4 : 0,15 $ entrée, 0,015 $ cache, 0,60 $ sortie par million de tokens
  ([pricing](https://docs.mistral.ai/inference/pricing)) ; image au prix de l'entrée
  ([vision](https://docs.mistral.ai/studio/conversations/vision)) ; endpoint UE ×1,1 sur entrée,
  sortie et cache ([regional-inference](https://docs.mistral.ai/inference/regional-inference)) ;
  modération 2603 gratuite ([modèle](https://docs.mistral.ai/models/mistral-moderation-26-03)) ;
  Voxtral STT 0,003 $ la minute, TTS 16 $ le million de caractères. Facturation dans la devise de
  l'organisation, au taux de 0,85 lu sur la page Coûts. Le raisonnement facturé comme de la
  sortie : non documenté, retenu par prudence.
- ZDR : « available only with pay-as-you-go and only for stateless API calls »
  ([centre d'aide](https://help.mistral.ai/en/articles/347612-can-i-activate-zero-data-retention-zdr)) ;
  le paiement à l'usage « is not a separate plan » et prolonge l'usage inclus
  ([tiers](https://docs.mistral.ai/admin/user-management-finops/tier)) : pas de frais fixes. Le
  brouillon de cette étude comptait à tort l'abonnement Le Chat Pro (14,99 $). L'usage inclus
  (8,50 € par mois) n'est pas déduit dans le modèle.
- Hébergement HT, sauvegardes comprises (paliers 100 / 1 000 / 10 000 élèves) : Scaleway 22,45 /
  37,86 / 80,31 € (IPv4 à 2,92 € par instance, oubliée le 2026-10-01 ; PG 17 au plus) ; Clever
  Cloud 11,25 / 57 / 152 € (PG 18.4 ; base corrigée à 2 puis 4 Go) ; Koyeb 53 / 93 / 169 € (offre Pro
  à 29 $ oubliée le 2026-10-01, pas de PG 18). Pages tarifs de Scaleway, API de Clever Cloud,
  koyeb.com/pricing.
- Langfuse Cloud ([pricing](https://langfuse.com/pricing)) : Hobby gratuit, 50 000 points par
  mois ; Core 29 $ avec 100 000, puis 8 $ les 100 000 jusqu'à 1 million et 7 $ jusqu'à 10 millions ;
  un point est « any tracing data point sent », trace, observation ou score. Échantillonnage en
  TypeScript par `TraceIdRatioBasedSampler`
  ([sampling](https://langfuse.com/docs/observability/features/sampling)).
- Outils : Vercel Pro 20 $ (usage commercial), Sentry Developer gratuit puis Team 26 $ (UE),
  domaine .fr 7,79 € HT par an, UptimeRobot Solo 9 €, Scaleway TEM 300 e-mails gratuits puis
  0,25 € les 1 000. Change BCE du 2026-10-06 : 1 € = 1,1269 $.

### Fiscalité et paiement (service-public, BOFiP, pages tarifaires)

- Micro-entreprise 2026 : plafond 83 600 € ; cotisations 21,2 % (BIC, prestations de services) ou
  25,6 % (BNC), 22,9 % ou 27,8 % avec le versement libératoire (1,7 % ou 2,2 %, si le revenu fiscal
  de référence N-2 ne dépasse pas 29 579 € pour une part) (F36232, F23267). BIC ou BNC : non
  tranché, des indices pour BIC ; rescrit ou expert-comptable. ACRE réduite à 25 % d'exonération
  depuis le 2026-07-01 (F11677). CFE exonérée l'année de création, base minimum de 250 à 597 €
  ensuite selon la commune (F23547). CFP incluse ou en sus : non tranché (0,2 %).
- TVA : franchise jusqu'à 37 500 € (seuil majoré 41 250 €) ; le seuil de 25 000 € a été abandonné
  (loi 2025-1044) ; en franchise, la TVA des fournisseurs ne se récupère pas ; au-delà de
  10 000 € de ventes à des particuliers d'autres pays de l'UE, TVA du pays par l'OSS ; franchise
  européenne (art. 293 B ter) possible sous 100 000 €. Kartable applique 5,5 % (JSON de sa page de
  prix) : qualification à faire pour Tom.
- SASU : IS à 15 % jusqu'à 42 500 €, puis 25 % ; dividendes au PFU de 31,4 % (F36215) ; création
  environ 195 € ; expert-comptable en ligne de 470 à 1 250 € HT par an (Dougs, L-Expert-comptable,
  LegalPlace).
- Paiement : Stripe, carte EEE 1,5 % + 0,25 €, carte premium 2,8 % + 0,25 €, SEPA 0,35 €, Billing
  0,7 %, litige 20 € ; Mollie 1,80 % + 0,25 € (CB 1,20 % + 0,25 €) ; GoCardless 1 % + 0,20 € HT ;
  Paddle et Lemon Squeezy, marchands officiels, 5 % + 0,50 $, TVA toujours prélevée.
  `@better-auth/stripe` : clients, abonnements, essais, webhooks signés, un seul abonnement actif
  par référence ([doc](https://www.better-auth.com/docs/plugins/stripe)).
- AIPD requise (enfants et IA, deux critères de la CNIL), faisable avec l'outil PIA gratuit ; DPO
  non obligatoire au départ. RC pro, avocat, INPI : prix non vérifiés.

### Marché

- Rétention mensuelle (RevenueCat 2026) : 53 à 61 % au premier renouvellement (Europe de l'Ouest
  55 %), 8 % encore actifs à 12 mois, applications d'IA 6,1 % ; calage retenu : 55, 39 et 30 %, puis
  14 % de départs par mois. Recurly, éducation : 4,99 % de départs (période ambiguë).
- Conversion (RevenueCat) : inscrits payants à 35 jours 2,0 % en Europe de l'Ouest, freemium
  2,1 % en médiane et 4,5 % au quartile haut ; essai de 5 à 9 jours converti à 37,4 % ; Duolingo,
  9 % de payants parmi ses actifs.
- Foyers (recensement 2021, calcul) : 2,89 millions de ménages avec un enfant de 11 à 14 ans,
  84,5 % en ont un et 14,7 % deux, soit 1,16 collégien par foyer ; 3 393 652 collégiens à la rentrée
  2025.
- Saisonnalité : vacances d'été du 3 juillet au 31 août 2027 ; aucun chiffre sur les départs
  d'été (leur doublement est une hypothèse) ; Kartable vend une année scolaire de 10 mois.
- Acquisition : Meta, éducation, 26 $ par lead ; Google, 77 $ (LocaliQ, États-Unis) ; aucun
  chiffre français. Dinobot et Kartable passent par les CSE.
- Prix des concurrents : Kartable 14,99 € par mois ou 99,90 € l'année, offre famille 24,99 € ;
  SchoolMouv 12,49 à 14,99 € (promotion à 4,99 €), jusqu'à trois enfants ; Nomad+ dès 9,99 € ;
  Dinobot 5,99 ou 9,99 €.
- Risque : Chegg a perdu de 30 à 43 % de ses abonnés en 2025 face à l'IA générative (10-Q à la SEC).

## 11. Hypothèses principales

| Hypothèse | Valeur | Effet si elle est fausse |
|---|---|---|
| Profils d'usage, par semaine | léger 2 séances de 3 tours et 1 exercice, normal 4 de 6 et 1,5, intensif 6 de 12 et 3 | Coût du gratuit (§ 5), le poste qui décide |
| Usage moyen d'un gratuit | léger, dans les seuils du § 6 | À usage normal, seuils et marge s'effondrent sous 6 % de payants |
| Part payante parmi les actifs | 3, 6 ou 9 % | Tout le § 6 |
| Départs l'été | doublés en juillet et en août | Durée de vie de 3,3 mois au lieu de 4,1 |
| Voix | 10 % des tours dictés (15 s), 10 % des réponses lues (150 tokens) | Jusqu'à −0,73 € par payant |
| Photo | un exercice sur quatre, 800 tokens de lecture | Faible |
| Régénération par le contrôle | 10 % des tours | Faible |
| Paliers d'hébergement | sans mesure de charge | Quelques dizaines de payants au seuil |
| Chiffre d'affaires micro existant | 0 € | Seuils de TVA et de la micro atteints plus tôt |
