# Rentabilité et quotas de Tom (2026-10-07) — BROUILLON

Demandé par Victor le 2026-10-07 : calculer les quotas et la rentabilité, impôts compris. Ce
brouillon garde les faits vérifiés le jour même et les premiers résultats ; la rédaction finale
reste à faire (voir « Reste à faire » en bas). Modèle : `rentabilite-modele/model.py`
(`python3 model.py`), qui reprend `../2026-10-01/couts.md` sur le tour refait, le foyer, la
fiscalité et la rétention.

## Faits vérifiés le 2026-10-07

### Coûts mesurés du nouveau tour (passage de fin, `../2026-10-06/passage-de-fin.md`)

Au taux que Mistral applique au compte (0,85) : fiche d'exercice 0,349 € pour 257 appels (un
tirage, raisonnement high, 0,136 c ; trois tirages par exercice) ; tour de chat 0,093 € pour 359
(0,026 c) ; analyse du tour 0,019 € pour 363 (0,005 c, avant que #415 la passe en raisonnement
high, non mesuré depuis) ; diagnostic 0,003 € pour 35 ; titre 0,004 € pour 112 ; cartes 0,007 €
pour 9. La fiche fait 73 % du coût : **le coût d'une soirée suit le nombre d'exercices, pas de
messages.**

### Prix (pages lues le 2026-10-07)

- Mistral Small 4 : 0,15 $ entrée, 0,015 $ cache, 0,60 $ sortie par M de tokens
  (https://docs.mistral.ai/inference/pricing) ; image au prix de l'entrée
  (https://docs.mistral.ai/studio/conversations/vision) ; endpoint UE ×1,1 sur entrée, sortie,
  cache (https://docs.mistral.ai/inference/regional-inference) ; modération 2603 **gratuite**
  (https://docs.mistral.ai/models/mistral-moderation-26-03) ; Voxtral STT 0,003 $/min, TTS 16 $
  par M de caractères ; raisonnement facturé comme sortie : non documenté (hypothèse) ; devise de
  facturation : « Organization billing currency », taux 0,85 lu sur la page Coûts du compte ;
  **ZDR réservé aux « paid plans »** (https://docs.mistral.ai/admin/monitor-comply/zero-data-retention),
  Pro à 14,99 $ HT : coût fixe nouveau ; Gratuit : 10 $ de crédits par mois.
- Hébergement HT avec sauvegardes (paliers 0-100 / 1 000 / 10 000 élèves) : Scaleway 22,45 / 37,86
  / 80,31 € (IPv4 2,92 € par instance, oubliée le 2026-10-01 ; PG 17 au plus) ; Clever Cloud
  11,25 / 57 / 152 € (PG 18.4 par défaut ; base corrigée à 2 Go puis 4 Go) ; Koyeb 53 / 93 / 169 €
  (offre Pro à 29 $ oubliée, pas de PG 18). Sources : pages tarifs Scaleway, API Clever Cloud,
  koyeb.com/pricing.
- Outils : Vercel Pro 20 $ (usage commercial), Sentry Developer gratuit puis Team 26 $ (UE),
  Langfuse Hobby gratuit puis Core 29 $, domaine .fr 7,79 € HT par an, UptimeRobot Solo 9 €,
  Scaleway TEM 300 gratuits puis 0,25 € les 1 000. Change BCE du 2026-10-06 : 1 € = 1,1269 $.

### Fiscalité et paiement (service-public, BOFiP, pages tarifaires, lus le 2026-10-07)

- Micro-entreprise 2026 : plafond 83 600 € ; cotisations 21,2 % (BIC services) ou 25,6 % (BNC),
  22,9 % ou 27,8 % avec versement libératoire (1,7 % ou 2,2 %, si RFR N-2 ≤ 29 579 € seul)
  (F36232, F23267) ; BIC ou BNC non tranché, indices pour BIC : rescrit ou expert-comptable ;
  ACRE réduite à 25 % d'exonération depuis le 2026-07-01 (F11677) ; CFE exonérée l'année de
  création, base minimum 250 à 597 € ensuite selon la commune (F23547) ; CFP incluse ou en sus :
  non tranché (0,2 %).
- TVA : franchise jusqu'à 37 500 € (seuil majoré 41 250 €) ; seuil de 25 000 € abandonné (loi
  2025-1044) ; en franchise, TVA des fournisseurs non récupérable (coûts à compter TTC) ; au-delà
  de 10 000 € de ventes UE hors France, TVA du pays via l'OSS ; franchise européenne (art. 293 B
  ter) possible sous 100 000 €. **À vérifier : Kartable applique une TVA de 5,5 %** (JSON de sa
  page de prix) ; qualification à faire par un expert-comptable.
- Victor est déjà micro-entrepreneur : le CA de Tom s'ajoute au CA existant pour tous les seuils
  (`EXISTING_CA` du modèle, à renseigner).
- SASU : IS 15 % jusqu'à 42 500 €, puis 25 % ; dividendes au PFU de 31,4 % (F36215) ; création
  environ 195 € ; expert-comptable en ligne 470 à 1 250 € HT par an (Dougs, L-Expert-comptable,
  LegalPlace).
- Paiement : Stripe carte EEE 1,5 % + 0,25 €, premium 2,8 % + 0,25 €, SEPA 0,35 €, Billing 0,7 %,
  litige 20 € ; Mollie 1,80 % + 0,25 € (CB 1,20 % + 0,25 €) ; GoCardless 1 % + 0,20 € HT ; Paddle
  et Lemon Squeezy (marchands officiels) 5 % + 0,50 $, TVA toujours prélevée.
- Autres : AIPD requise (enfants et IA, deux critères CNIL), faisable avec l'outil PIA gratuit ;
  DPO non obligatoire au départ ; RC pro, avocat, INPI : prix non vérifiés.

### Marché (lu le 2026-10-07)

- Rétention mensuelle (RevenueCat 2026) : 53 à 61 % au 1er renouvellement (Europe de l'Ouest
  55 %), 8 % encore actifs à 12 mois, IA 6,1 % ; calage : 55 / 39 / 30 % puis 14 % de départs par
  mois, **4,1 mois payés en moyenne** ; Recurly éducation 4,99 % (période ambiguë).
- Conversion (RevenueCat) : inscrits → payants à 35 jours 2,0 % (Europe de l'Ouest), freemium
  2,1 % médiane, 4,5 % quartile haut ; essai de 5 à 9 jours → payant 37,4 % ; Duolingo 9 % de
  payants parmi ses actifs.
- Foyers (recensement 2021, calcul) : 2,89 M de ménages avec un enfant de 11-14 ans ; 84,5 % en
  ont un, 14,7 % deux ; **1,16 collégien par foyer** ; 3 393 652 collégiens à la rentrée 2025.
- Saisonnalité : vacances d'été du 3 juillet au 31 août 2027 ; aucune donnée chiffrée sur les
  départs d'été ; Kartable vend une année scolaire de 10 mois (99,90 €).
- Acquisition : Meta, éducation, 26 $ par lead ; Google 77 $ (LocaliQ, États-Unis) ; aucun chiffre
  français ; Dinobot et Kartable passent par les CSE.
- Prix concurrents : Kartable 14,99 € ou 99,90 € l'année, famille 24,99 € ; SchoolMouv 12,49 à
  14,99 € (promo 4,99 €), jusqu'à 3 enfants ; Nomad+ dès 9,99 € ; Dinobot 5,99 ou 9,99 €.
- Risque : Chegg a perdu 30 à 43 % de ses abonnés en 2025 face à l'IA générative (10-Q SEC).

## Premiers résultats du modèle

- Le coût IA d'un foyer payant est faible : environ 0,26 € HT par mois à l'usage normal, pour un
  net d'environ 5,73 € avant IA (7,99 €, franchise, micro BIC avec versement libératoire, Stripe).
- **Le gratuit décide de tout** : un foyer gratuit à l'usage normal coûte 0,32 € par mois ; avec
  3 % de payants parmi les actifs, chaque payant porte 32 gratuits et la marge devient négative.
  Le gratuit ne tient que si son usage moyen reste léger (0,09 €) ou si la part payante monte.
- Quota proposé : Gratuit 2 c par élève et par jour (une soirée normale, photo et voix comprises),
  Complet 10 c (au plafond chaque jour, la marge reste positive).
- Rétention et été : un mensuel paie 3,3 mois en moyenne avec un été à départs doublés, soit
  environ 18 € net ; **une année scolaire payée d'avance à 69 € rapporte 48 €** : le premier levier.
- Seuils : frais fixes couverts dès 25 à 45 foyers payants ; un revenu de 1 500 € par mois demande
  370 à 670 foyers payants, soit 110 à 200 nouveaux payants par mois et 3 500 à 6 500 inscriptions
  par mois : la distribution est le vrai risque. La franchise de TVA tombe vers 390 payants.
- Micro BIC avec versement libératoire laisse plus que la SASU à tous les volumes calculés.

## Reste à faire

Relire les sorties du modèle, rédiger l'étude (synthèse, hypothèses M/S/H, recommandations :
quota, formule annuelle, prix, statut, prestataire de paiement, mesures à faire), PR, puis
reprendre l'étape 5 (le quota au plan de la PR 4).
