# Pronote et applis scolaires : un différenciateur défendable ?

Analyse du 2026-10-01. Toutes les pages et tous les dépôts cités ont été consultés ce jour-là. Les sources sont numérotées `[n]` et listées en fin de document, avec leur mode de lecture :

- **(T) texte intégral** : PDF ou fichier téléchargé, passage cité mot pour mot ;
- **(R) résumé par WebFetch** : le sens est fidèle, mais pas forcément les mots ;
- **(G) API GitHub ou npm** : métadonnées brutes (dates, licences, téléchargements).

**Limites de la recherche.** Le quota de recherche web s'est épuisé en cours d'analyse. Plusieurs pages ministérielles (education.gouv.fr, eduscol) renvoient une erreur 403 aux outils automatisés. Ces trous sont signalés là où ils comptent. Aucun produit concurrent n'a été testé.

---

## 1. Couverture : qui utilise quoi au collège

### Chiffres disponibles

| Fait | Source | Nature |
|---|---|---|
| **10 700** établissements du second degré publics et privés sous contrat à la rentrée 2024. **6 986 collèges** : 5 325 publics et 1 661 privés sous contrat | DEPP, RERS 2025 [1] (T) | Statistique publique |
| Index Éducation « revendique **8 360** établissements scolaires clients dans le second degré », dont 7 960 en mode hébergé chez lui, soit 18 millions de comptes | Rapport IGÉSR n° 24-25 140C, juin 2025 [2] (T) | **Déclaration de l'éditeur**, rapportée par l'inspection |
| Les 18 millions de comptes se répartissent ainsi : 45 % parents, 28 % élèves, 5 % personnels, 22 % entreprises | IGÉSR [2], « source Index Éducation » (T) | Déclaration de l'éditeur |
| « Deux éditeurs, Index Éducation et Aplim, sont majoritaires, voire **quasi monopolistiques**, sur le marché des logiciels de vie scolaire. » Index Éducation domine dans le public, Aplim (École Directe, Charlemagne) dans le privé | IGÉSR [2] (T) | Constat de l'inspection |
| Aplim revendique « plus de 5 000 établissements clients, 4 millions d'utilisateurs dont 1,3 million d'élèves dans le second degré » | IGÉSR [2] (T) | Déclaration de l'éditeur |
| Axess (la-vie-scolaire.fr, sous-traitant de Kosmos) annonce l'arrêt de cette offre à l'été 2025 | IGÉSR [2] (T) | Déclaration de l'éditeur |
| ENT : 89 % des collèges publics en proposent un. Deux industriels se partagent l'essentiel du marché : Édifice et Kosmos (Skolengo). Les ENT des collèges relèvent des départements | IGÉSR [2] (T) | Constat de l'inspection |
| Pages Index Éducation : « plus de 8 000 établissements » en hébergement | [3] (R) | Déclaration de l'éditeur |

### Ce qu'on peut en tirer

- **Aucune source primaire ne donne la part de Pronote parmi les collèges seuls.** Le rapport 8 360 / 10 700 donne environ 78 %, mais ce ratio est un **plafond grossier** : les 8 360 clients peuvent inclure des établissements à l'étranger ou hors contrat, et ils mêlent collèges et lycées.
- Les chiffres « 90 % » et « 75 % » qui circulent ne sont apparus que dans des extraits de résultats de recherche. Je ne les ai pas retrouvés dans une source lue. **Je ne les retiens pas.**
- **Aucune part chiffrée n'a été trouvée** pour Skolengo comme logiciel de vie scolaire, pour Mon Bureau Numérique, les ENT régionaux ou Educ'Horus.
- **Conclusion prudente** : Pronote couvre la grande majorité des collèges publics (« quasi monopolistique » selon l'IGÉSR). Les collèges privés sous contrat, environ un collège sur quatre (1 661 sur 6 986), sont surtout sur École Directe. Un produit limité à Pronote laisse donc de côté une partie du privé.

---

## 2. Le droit d'accès

### 2.1 Index Éducation (Pronote)

**Pas d'API publique.** Réponse officielle du support (2019) : « Il n'existe pas d'API pour PRONOTE » [4] (R). Je n'ai trouvé aucune API publique ni aucun programme développeurs depuis.

**La voie officielle passe par l'établissement, pas par le parent.**

- La page « Connecteurs partenaires » [5] (R) présente des connecteurs « activables depuis les logiciels PRONOTE ou EDT (après souscription auprès des partenaires) », réservés aux établissements en mode hébergé.
- **Une rubrique « Outils d'aide pédagogique IA » y cite deux partenaires : Logbook et Eliott.**
- Les CGVU d'Index Éducation (version du 18/08/2025) [6] (T) précisent le cadre :
  - § 19.3 : « INDEX ÉDUCATION conclut avec ces partenaires […] une convention de services permettant d'encadrer la mise en place de connecteurs ». Le Client, c'est-à-dire l'établissement, « reste responsable de traitement ».
  - Conditions particulières du connecteur « Données de vie scolaire » : l'export est chiffré, « porté exclusivement par une délégation d'authentification CAS depuis un service tiers ». L'établissement l'active ou le désactive. L'export des données de vie scolaire et l'appel aux URL de l'emploi du temps « ne doi[ven]t s'effectuer qu'au moment de la connexion de l'utilisateur ».
- **En clair** : le canal légitime, c'est une convention avec Index Éducation, puis une activation école par école. La synchronisation en arrière-plan est exclue.

**Ce que les CGVU interdisent** ([6], § 17, (T)) : l'ingénierie inversée sur le Logiciel, l'adaptation du Logiciel « en vue de la création de fonctionnalités dérivées », et tout accès frauduleux aux données de tiers.

**Limite de lecture** : ces CGVU lient l'établissement client, pas le parent. Je n'ai trouvé **aucune CGU destinée aux parents ou aux élèves** qui encadre l'usage d'un client tiers. Leur existence n'est pas exclue.

**Précédent de blocage (vérifié).** Le dépôt `Litarvan/pronote-api` [7] (G) affiche son post-mortem :

> « À compter du 30 Avril 2021, le projet "pronote-api" est malheureusement arrêté à la demande d'Index Éducation. Le dépôt GitHub a été vidé de son historique, et le paquet NPM supprimé. »

Le mainteneur ajoute que la publication de l'API relevait selon lui de « la mise à disposition d'un programme informatique conçu pour permettre un accès frauduleux à un [STAD] ». Cela correspond à l'article 323-3-1 du Code pénal [8] (R) : mêmes peines que l'infraction principale, soit pour l'accès frauduleux de l'article 323-1 trois ans d'emprisonnement et 100 000 € d'amende.

- C'est **l'analyse du mainteneur**, pas une décision de justice.
- Je n'ai trouvé aucune décision ni aucune autre mise en demeure publique, mais ma recherche s'est arrêtée avec le quota.
- Wikipédia [9] (R) note que des forks ont continué, « par effet Streisand ».

**Ce qui n'est pas documenté** : je n'ai trouvé aucune action d'Index Éducation contre Papillon, pawnote ou pronotepy. Le dépôt Papillon ne contient **aucune issue** mentionnant « Index Education » [10] (G).

**Position politique d'Index Éducation.**

- L'IGÉSR [2] (T) rapporte des « remontées du terrain » : Docaposte imposerait une « tarification d'interopérabilité pour l'échange des données issues de son logiciel » quand l'ENT n'est pas le sien. L'éditeur fait donc payer l'accès aux données.
- En 2020, son dirigeant déclarait fournir des exports chiffrés en temps réel à des concurrents privés [11] (R).
- **Inférence (non vérifiée)** : un tiers qui lit Pronote gratuitement, sans convention, contourne un actif que l'éditeur monétise.

### 2.2 Aplim (École Directe)

- Aplim a publié des alertes contre les sites, extensions et applications non officiels. La première date du 6 février 2024 (« Alerte concernant des sites non officiels imitant EcoleDirecte »), la seconde du 26 novembre 2024. Selon ces alertes, « seule l'application officielle "Mon EcoleDirecte" » garantit la protection. Source : un site tiers qui rapporte ces alertes [12] (R). **Je n'ai pas lu les communiqués originaux.**
- Le même site affirme que la page de connexion « est protégée par un dispositif qui refuse les clients automatisés ».
- Eliott et Dinobot affichent École Directe comme **partenaire** [13][15] (R). Le canal officiel existe donc pour des partenaires, aux conditions non publiques.
- Bibliothèque non officielle : `@blockshub/blocksdirecte`, licence ISC, version **0.0.9-alpha** publiée le 2026-09-09, 690 téléchargements sur 30 jours [14] (G). Maturité : alpha.

### 2.3 Kosmos (Skolengo)

- Je n'ai trouvé **ni API publique ni position publique** de Kosmos sur les clients tiers. La recherche s'est arrêtée avec le quota : **non vérifié**.
- Deux bibliothèques non officielles existent, toutes deux sous GPL-3.0 [14] (G) :
  - `skolengojs` : 6 étoiles, release du 2026-09-08 ;
  - `scolengo-api` : 28 étoiles, aucun push depuis le 2024-08-26, donc **non maintenue**.
- Avertissement de `skolengojs` : « not affiliated with Skolengo or Kosmos ».

### 2.4 L'écosystème Pronote non officiel : état au 2026-10-01

| Brique | Licence | Dernière release | Santé | Verdict selon les critères du dépôt (maintenu < 6 mois, adoption) |
|---|---|---|---|---|
| `pawnote` (LiterateInk), **celle du dépôt** (`^1.6.2`) | GPL-3.0-or-later | **1.6.2 du 2025-09-21** | Dépôt GitHub `LiterateInk/Pawnote*` en **404**. Le fork LTS le dit « archived » [16]. Le profil de l'auteur indique « GitHub is not a safe place anymore. » [17] (G). 3 280 téléchargements sur 30 jours | **Échoue** : archivé, plus de 12 mois sans release |
| `@blockshub/pawnote-lts` | GPL-3.0-or-later | **1.6.4 du 2026-09-03** | Maintenu par l'équipe Papillon, mais « only … for bugfixes and security updates. No new features ». Dépôt source `BlocksHub/Pawnote-LTS` **introuvable (404)**. 1 221 téléchargements sur 30 jours [16] (G) | **Partiel** : releases récentes, mais source publique introuvable et périmètre limité aux correctifs |
| `@blockshub/blocksnote` | MIT | Dernier push le 2026-06-22 | Réécriture annoncée, 14 étoiles [18] (G) | Trop jeune pour en juger |
| `pronotepy` (Python) | MIT | v2.15.7 du 2026-09-03 | « maintenance mode » : correctifs seulement. 241 étoiles, 24 issues ouvertes [19] (G) | **Passe**, mais en Python, hors stack |
| Papillon (application) | GPL-3.0 | v8.5.2 du 2026-09-07 | 323 étoiles, 153 issues ouvertes. Association à but non lucratif. Tout est traité **sur le téléphone** : « Aucune information n'est transmise à Papillon » [10][20] (G/R) | Actif |

**Fait majeur : Pronote 2026 a cassé l'écosystème à la rentrée.**

- L'issue Papillon #798, « Compatibilité 2026 non résolue », a été ouverte le 2026-09-02. La correction est arrivée dans la v8.5.1, puis le Play Store l'a diffusée progressivement à partir du 2026-09-14 [21] (G).
- Le correctif côté bibliothèque est `pawnote-lts` 1.6.3, publié le 2026-09-01, suivi de la 1.6.4.
- **Il y a donc eu environ deux semaines de panne** pour les utilisateurs, alors même qu'une équipe bénévole réagissait.

---

## 3. Ce que le dépôt fait déjà, et son état réel

**Ce qui est lu** (`apps/server/src/services/pronote/provider.types.ts`, `pawnote-server.adapter.ts`) :

- **notes** de la période courante, avec coefficient, moyenne, minimum et maximum de la classe ;
- **devoirs** de J-7 à J+14, avec l'indicateur « fait » ;
- **emploi du temps** d'un jour, avec les cours annulés ;
- liste des établissements proches, par géolocalisation.

**Ce qui n'est pas lu** : les compétences, les appréciations, les bulletins, le contenu des cours (cahier de textes, hors consigne du devoir), les absences et la messagerie.

**Architecture.**

- La connexion se fait par QR code et PIN (`loginQrCode`), avec un `deviceUUID` imposé par le serveur.
- Le jeton est rotatif et chiffré en AES-256-GCM en base (`pronote.schema.ts`, `pronote-sync.service.ts`).
- Un compte parent peut couvrir plusieurs enfants (`pronote_child_resources`), via les routes `GET /api/pronote/children/:childId/{grades,homework,timetable}`, ouvertes au parent ou à l'élève lui-même (`pronote-data.routes.ts`).
- Une liste blanche d'URL limite les appels sortants.
- **Le serveur se présente comme l'application officielle** : User-Agent `… PRONOTE Mobile APP Version/2.0.11` (`pawnote-server.adapter.ts:51-54`).
- L'échéance du jeton est fixée **arbitrairement à 365 jours** (`pronote-connect.service.ts:82`). La durée de vie réelle d'un jeton Pronote n'est pas documentée ici.

**L'agent IA ne lit pas Pronote côté serveur.** Le chat n'accepte qu'un `pronoteContext` **envoyé par le client** (« Ephemeral Pronote context from device », `chat-message.routes.ts:250-269`), encadré par une balise `<pronote_data>` anti-injection (`config/prompts/core/safety.ts`). Ce contexte était envoyé par l'app mobile, qui a été supprimée. Aucun code serveur n'appelle `pronoteDataService` depuis le chat. **En pratique, l'agent ne voit aujourd'hui aucune donnée Pronote.**

**Le client web n'existe pas**, et le décodage du QR code dans le navigateur reste à faire. C'est une décision ouverte du lot 3 ([P1], `docs/architecture.md`).

**Tests.**

- `bun test src/tests/pronote src/tests/pawnote --isolate`, lancé aujourd'hui : **209 tests réussis, 0 échec, code de sortie 0**. Ces tests unitaires simulent pawnote : ils ne prouvent rien face à un vrai Pronote.
- Les tests d'intégration n'ont pas été lancés : ils demandent une base de données.
- Le test live (`src/live/pronote.test.ts`) n'a pas été lancé : il demande les identifiants du compte de test.

**Cause probable de la `PageUnavailableError` notée dans `suivi.md` : identifiée.**

- Dans pawnote 1.6.2, la lecture de la page d'instance cherche le marqueur `")}catch"`. Tout échec de parsing tombe dans un `catch` qui lève `PageUnavailableError`. Je l'ai vérifié dans le `dist/index.js` du paquet npm.
- J'ai téléchargé aujourd'hui la page `mobile.eleve.html` de **l'instance de démonstration publique** d'Index Éducation. Elle contient `Start({...});}catch` : avec le point-virgule, le marqueur attendu est **introuvable** (`indexOf` = -1). J'ai rejoué hors ligne le parseur de la 1.6.2 sur cette page : **il échoue**.
- Le diff entre `pawnote` 1.6.2 et `@blockshub/pawnote-lts` 1.6.4 montre que **seul ce parseur a été réécrit** : il cherche désormais `Start({` et équilibre les accolades.
- **Conclusion** : avec la dépendance actuelle, la connexion à Pronote 2026 échoue presque certainement, démo comprise. Je ne l'ai pas confirmé par une connexion réelle, que je n'ai pas tentée.

---

## 4. Les concurrents et Pronote

Ce tableau part de `concurrence.md` et le corrige sur trois points.

| Acteur | Ce qui est vérifié | Lecture des devoirs et des notes ? |
|---|---|---|
| **Eliott** | **Partenaire officiel**, cité dans la rubrique « Outils d'aide pédagogique IA » des connecteurs Pronote [5]. « Accès direct via Pronote et École Directe, nos partenaires : déploiement simple, sans création d'identifiants » [13]. « +25 établissements partenaires ». Familles : 69,99 €/an, ou 119,99 €/an pour 4 enfants [13]. Lauréat Édu-Up (rapporté par un résultat de recherche, page non lue) | **Rien d'affirmé.** Ses pages et sa politique de confidentialité ne mentionnent aucune donnée reçue de Pronote [13] (R). La rubrique des connecteurs annonce bien « Import et export des données », « Synchronisation des informations », mais sans dire ce que fait Eliott |
| **Dinobot** (OuiActive) | « Certifié GAR, diffusé par l'ENT », « référencé au Gestionnaire d'Accès aux Ressources ». Accès « par l'ENT via le GAR, par Pronote ou par École Directe, avec les comptes que votre établissement utilise déjà ». Plus de 20 établissements. Commande via le simulateur, la librairie eMLS ou un mandat administratif, avec une grille dégressive [15] (R). Côté élève : « Avec EduConnect depuis ton ENT, Pronote ou École Directe » [15]. En octobre 2025, le GAR était encore « en phase d'intégration ». Prix établissement cité : 1 000 à 1 500 €/an [22] (R) | **Non.** Rien ne parle de lire des données : c'est une **connexion unique (SSO)** |
| **Logbook** | Cité comme « Outil d'aide pédagogique IA » partenaire de Pronote [5] | Inconnu, page non lue |
| **Otto Lycée** (`Helmus101/todo`, hiotto.vercel.app) | Projet open source (MIT), site en ligne avec inscription. « Otto lit Pronote, Gmail, Calendar et Drive », « Il ne fait jamais tes devoirs ». Pronote y est décrit comme « Devoirs, contrôles (flag "test" de l'emploi du temps) », avec une connexion « non-officielle » et un jeton chiffré en AES-256-GCM. Cible : le lycée [23] (G/R) | **Oui, affirmé** : c'est **exactement la même mécanique** que Tom |
| **Konnecteur Cozy Pronote** (`konnectors/pronote`) | Licence AGPL. Récupère côté serveur l'emploi du temps, les devoirs, les notes, les absences et les bulletins, avec pawnote 1.4.1 [24] (G) | Oui, sans IA |
| **Papillon** | Affiche les notes, les devoirs et l'emploi du temps sur le téléphone, sans serveur [20] | Oui, sans IA |

**Corrections à `concurrence.md`.**

1. La phrase « Personne ne revendique la lecture des devoirs » est **fausse** depuis Otto Lycée. Otto reste un petit projet, en lycée, sans chiffres d'usage.
2. Eliott n'a pas seulement « un accès via Pronote » : il est **partenaire officiel** d'Index Éducation, dans une rubrique IA.
3. Dinobot passe aussi par le GAR, ce que `concurrence.md` disait déjà.

**Ce qui reste vrai.** Aucun acteur financé et visible ne **revendique** de lire les devoirs et les notes Pronote d'un collégien pour l'aider à la maison. **Absence de preuve n'est pas preuve d'absence**, surtout pour Eliott, dont le connecteur officiel annonce une synchronisation.

---

## 5. Le cadre

### 5.1 Données de l'élève mineur traitées à la demande du parent

- **Responsabilité.** Côté école, l'établissement est responsable du traitement Pronote ([6], § 19.3). Côté Tom, l'éditeur deviendrait responsable de son propre traitement : il recueille et conserve les données à la demande du parent. Ce n'est pas une source, c'est une **analyse de ma part à faire valider par un juriste**.
- **Article 45 de la loi Informatique et Libertés**, selon la CNIL [25] (R) : si le traitement repose sur le **consentement**, pour un service en ligne proposé à un mineur de moins de 15 ans, il faut l'accord conjoint du titulaire de l'autorité parentale et de l'enfant. Le consentement d'un seul parent suffit, mais l'autre doit pouvoir s'y opposer. Si la base est le **contrat**, d'autres règles s'appliquent.
  - Le texte de l'article sur Légifrance n'a pas été lu : l'URL tentée renvoyait vers un autre article.
- **Portabilité.** L'article 20 du RGPD [26] (R) ne joue que pour les traitements fondés sur le consentement ou le contrat. Il est **exclu pour les traitements nécessaires à une mission d'intérêt public**. Si le traitement Pronote de l'établissement repose sur une mission d'intérêt public, ce qui est **probable mais non vérifié**, le parent n'a **aucun droit à la portabilité** à opposer à l'éditeur. Le RGPD ne fournit donc pas de base pour exiger l'accès aux données.
- **Sensibilité familiale des notes.** L'IGÉSR [2] (T) décrit une consultation « presque compulsive » des notes : environ 400 000 jeunes encore connectés à 21 h. Elle relaie des élèves qui veulent « désacraliser la note ». Depuis septembre 2024, Pronote prévoit par défaut **24 h de délai entre l'élève et les parents**, un réglage gardé par 89 % des établissements. Un service qui pousserait les notes au parent plus vite ou plus crûment irait contre cette orientation.
- **Sécurité.** L'IGÉSR [2] (T) relève que 15 % des 2 776 signalements de menaces sont passés par l'ENT ou Pronote « via des comptes usurpés », surtout à cause de vols d'identifiants. Un serveur qui garde des jetons Pronote de longue durée pour des milliers d'enfants devient **une cible**.

### 5.2 Le cadre d'usage de l'IA en éducation (ministère, juin 2025)

Texte intégral lu [27] (T), sur la copie de l'académie d'Amiens ; la page ministérielle renvoie une erreur 403.

- « L'utilisation pédagogique des IA génératives par les élèves, encadrée, expliquée et accompagnée par l'enseignant, est **autorisée en classe à partir de la 4e**. »
- « L'utilisation d'une intelligence artificielle générative pour réaliser tout ou partie d'un devoir scolaire, **sans autorisation explicite de l'enseignant et sans qu'elle soit suivie d'un travail personnel d'appropriation** à partir des contenus produits, constitue une **fraude**. »
- « Le recours aux services d'IA accessibles au grand public est autorisé sous réserve qu'aucune donnée confidentielle ou à caractère personnel ne soit utilisée » et « Aucun membre du personnel ne doit demander aux élèves d'utiliser des services d'IA grand public impliquant la création d'un compte personnel. »
- **Le texte vise l'usage scolaire et les personnels. Il ne réglemente pas l'usage familial à la maison.** Deux conséquences pour Tom :
  - Un produit qui part des **devoirs Pronote** doit tenir le « jamais la réponse » et le prouver. Sinon, un enseignant le lira comme un outil de fraude.
  - Côté école, un enseignant ne peut pas prescrire Tom en compte grand public : il faut passer par un canal institutionnel, c'est-à-dire le GAR.

---

## 6. Le volet enseignants à long terme

**Le GAR**, d'après les documents officiels de juin 2026 [28] (T) :

- **Qui peut adhérer** : « Toute personne morale ». L'adhésion « se fait sur la base du numéro SIREN » et le contrat est signé par une personne habilitée. Les ressources doivent être « spécifiquement conçues pour l'École, en respect des programmes et référentiels, ou exploitables en contexte scolaire ».
- **Démarche en trois étapes** [28] (R) :
  1. signature du contrat d'adhésion et déclaration des opérateurs commercial (DCR) et technique (DTR) ;
  2. trois interfaces techniques : description des ressources, abonnements, accès en SSO ;
  3. tests sur la plateforme partenaires, puis **qualification de conformité** menée « sous la responsabilité du ministère ».
  - Contact : dne-gar@education.gouv.fr.
- **Coût** : « La solution GAR est fournie à titre gratuit » aux partenaires. En revanche, « L'accrochage technique est financé par chacun des acteurs ».
- **Données** :
  - minimisation et proportionnalité ;
  - données d'usage conservées sur l'année scolaire plus 3 mois de récupération ;
  - pas de transfert hors UE sans accord écrit du responsable de traitement ;
  - interdiction de « l'entraînement d'IA à des fins commerciales avec les données des élèves » par des contenus tiers intégrés.
- **Délais** : **aucune durée publiée** dans les documents lus.
- **Comment les établissements achètent** : « L'abonnement communiqué découle d'un processus d'acquisition initié par l'établissement, qui se déroule hors du cadre de confiance GAR », par un accord contractuel entre l'établissement et le fournisseur [28] (T). Le GAR ne vend donc rien : il faut vendre à chaque chef d'établissement.
  - Dinobot montre des canaux réels : simulateur de devis, librairie eMLS, mandat administratif [15].
  - Les ENT, eux, sont financés par les collectivités [2].
  - Je n'ai pas pu lire les pages ministérielles sur le financement des ressources (Édu-Up, crédits numériques) : erreur 403.
- **Qui y est déjà** : Dinobot (« Certifié GAR ») et Eliott, partenaire Pronote et École Directe. Leur statut GAR n'est pas affirmé sur la page lue.

**Ce que cela implique pour un développeur seul.**

1. **Créer une structure juridique** : pas de SIREN, pas de GAR.
2. Porter **trois chantiers techniques** et une qualification ministérielle, sur une durée inconnue.
3. **Vendre établissement par établissement**, à des prix observés autour de 1 000 à 1 500 €/an chez Dinobot, contre deux acteurs installés.
4. **Contradiction de fond** : la voie enseignants passe par Index Éducation (convention de connecteur) et par le ministère (cadre de confiance GAR). Arriver chez eux avec un produit qui lit Pronote sans convention, en se faisant passer pour l'application officielle, c'est arriver avec un passif. Le volet parents non officiel et le volet enseignants officiel **se nuisent**.

---

## 7. Verdict

**Pronote est un différenciateur fragile, pas un fossé.** Il n'est pas banalisé chez les tuteurs IA financés, mais il est déjà fait chez les amateurs, et sa durabilité dépend du bon vouloir d'un éditeur hostile par le passé.

- **Fragile techniquement.** La brique utilisée est archivée et cassée par Pronote 2026. Le seul fork vivant est maintenu par des bénévoles, pour les correctifs seulement, et son dépôt source est introuvable.
- **Fragile juridiquement.** Il n'existe ni API ni autorisation. Index Éducation a déjà fait fermer une bibliothèque en 2021 en invoquant, selon son mainteneur, l'article 323-3-1 du Code pénal. Le dépôt usurpe le User-Agent de l'application officielle.
- **Peu différenciant.** Otto Lycée fait la même chose. Papillon et Cozy lisent les mêmes données. Eliott a l'accès **officiel**. La lecture de Pronote se copie en une semaine avec des bibliothèques libres.

**Conditions pour en faire quand même un atout :**

1. Un **avis d'avocat** sur l'article 323-1 et le contrat Index Éducation, et pas seulement sur la GPL, **avant** toute communication publique.
2. **Demander la convention de connecteur** à Index Éducation dès maintenant : la rubrique « Outils d'aide pédagogique IA » prouve qu'elle existe. Un refus serait une information décisive.
3. Passer à `@blockshub/pawnote-lts` ou équivalent, et brancher une **sonde quotidienne sur la démo publique** pour voir la casse avant les familles.
4. Concevoir le produit pour qu'il **marche sans Pronote**. Pronote doit être un enrichissement, jamais un prérequis.
5. **Minimiser** : lire à la demande plutôt que stocker en continu, écourter la durée du jeton, n'exposer au parent que des synthèses.

**Risques, du plus grave au moins grave.**

1. **Opposition d'Index Éducation.** Mise en demeure, blocage technique (anti-robot, changement de protocole) ou plainte. L'éditeur est une filiale de La Poste. Il monétise l'interopérabilité et a déjà agi en 2021. Le risque est existentiel si Pronote est **l'argument de vente**.
2. **Casse technique récurrente.** Elle est déjà arrivée en septembre 2026. Deux semaines de panne chez Papillon, pour une dépendance que le dépôt n'a pas encore suivie.
3. **Sécurité et responsabilité.** Le serveur stockerait des jetons d'accès aux comptes scolaires de mineurs, valables jusqu'à un an, sous une identité d'application usurpée. Une fuite toucherait des enfants et l'image de l'école.
4. **Conformité RGPD.** Choix de la base légale, article 45, minimisation, information des deux parents, transparence. Et pas de droit d'accès opposable à l'éditeur (article 20.3, sous réserve).
5. **Réception par l'école.** Cadre ministériel (« fraude » si l'IA fait le devoir), critique de l'IGÉSR sur l'obsession des notes, réglage Pronote 2026 qui coupe l'Espace élèves le soir. Un outil « qui part des devoirs Pronote » peut être lu comme un contournement.
6. **Couverture incomplète.** Le privé est sur École Directe, plus fermée et sans bibliothèque mûre. Les données manquent parfois : devoirs ajoutés tard ou jamais (IGÉSR), compétences non lues par l'adaptateur.

---

## 8. Ce qui serait vraiment unique

La donnée Pronote elle-même n'est plus rare. Ce qui ne se retrouve nulle part dans ce que j'ai lu, c'est **l'usage pédagogique** de cette donnée :

1. **Une vue parent qui respecte la médiation de l'école** : Tom traduit les résultats en « ce qui se travaille cette semaine » au lieu de redoubler les notes brutes. Cela suit l'IGÉSR (« désacraliser la note », délai de 24 h).
   - **Preuve d'absence (partielle)** : les vues parent d'Eliott, Le Prof IA et NeoSko portent sur l'activité **dans leur application**, pas sur les résultats scolaires ([13], `concurrence.md` § 2b). Pronote, lui, affiche les notes brutes.
2. **Le devoir réel comme point de départ d'une séance socratique**, au collège, avec un palier d'indices tenu par le serveur. C'est l'« appropriation personnelle » qui sépare l'aide de la fraude dans le cadre ministériel.
   - **Limite** : Otto le revendique déjà pour le lycée (« jamais tes devoirs »). L'unicité tient au **collège**, au **socratique mesuré** et au **parent**, pas à la lecture de Pronote.
3. **Boucler la révision sur le calendrier scolaire** : un contrôle détecté dans l'emploi du temps ou les devoirs déclenche des révisions FSRS (déjà dans le dépôt) dans les jours qui précèdent.
   - **Limite** : Otto détecte les contrôles. Je n'ai trouvé personne qui relie cette détection à de la répétition espacée. Absence non prouvée.
4. **Une mesure honnête de l'effet, enfant par enfant** : Tom confronte l'usage de chaque matière à l'évolution des résultats Pronote dans cette matière, en disant clairement que ce n'est pas une preuve de cause à effet.
   - **Preuve d'absence (partielle)** : Dinobot affiche « +2 points de moyenne » sans méthode publiée [15]. Je n'ai trouvé aucun acteur qui montre cette mesure à la famille.

---

## 9. Ce qu'on peut affirmer, et ce qu'on ne peut pas

| On peut dire (une fois les conditions remplies) | On ne peut pas dire |
|---|---|
| « Avec votre accord, Tom peut lire les devoirs, les notes et l'emploi du temps de votre enfant sur Pronote. » Seulement **après** le passage à une bibliothèque qui fonctionne, le client web et l'avis juridique. **Aujourd'hui, c'est faux** : la connexion échoue et l'agent n'utilise pas les données | « Partenaire de Pronote », « officiel », « compatible Pronote » au sens d'un agrément : il n'y a pas de convention |
| « Tom part du devoir réel et ne le fait jamais à la place de l'élève. » Seulement une fois le palier d'indices construit et mesuré | « Le seul à lire Pronote » : Otto, Papillon et Cozy le font, et Eliott a l'accès officiel |
| « Les données scolaires sont lues à la demande et ne servent pas à entraîner de modèle. » Seulement si c'est implémenté, avec hébergement UE et Zero Data Retention | « Fonctionne dans tous les collèges » : le privé est sur École Directe, que Tom ne lit pas |
| « Tom fonctionne aussi sans Pronote. » C'est vrai par conception | « Conforme au GAR » ou « recommandé par l'Éducation nationale » : pas d'adhésion, et le cadre réserve l'IA en classe à partir de la 4e |
| — | Une continuité de service garantie : la dépendance est non officielle et a déjà cassé |

---

## Ce que je n'ai pas pu vérifier

- La part de Pronote, d'École Directe et de Skolengo parmi les **collèges seuls** : aucune source primaire.
- Les CGU d'Index Éducation destinées aux parents et aux élèves, s'il en existe. La position de Kosmos sur les clients tiers.
- Les communiqués originaux d'Aplim, lus seulement par un site tiers.
- Les données réellement échangées par le connecteur Eliott, et ce que fait Logbook.
- L'emplacement réel du code source de `pawnote-lts` (dépôt en 404), et la raison de l'archivage de pawnote, que la page de l'auteur, protégée par un anti-robot, ne permettait pas de lire.
- Le texte Légifrance de l'article 45 (lu via la CNIL), la base légale du traitement Pronote des établissements, et le texte de la FAQ GPL (gnu.org en 403/429).
- Les délais du GAR, le financement Édu-Up et les pages ministérielles (403).
- **Aucune connexion réelle à Pronote** n'a été tentée. La cause de la `PageUnavailableError` est établie par lecture de code et rejeu hors ligne sur la page de démo, pas par une connexion.

---

## Sources

- [1] (T) DEPP, RERS 2025, chap. 2 : https://www.education.gouv.fr/sites/default/files/2025-07/rers2025-chapitre-2-441717.pdf
- [2] (T) IGÉSR, « Usages du numérique dans la relation École-familles », n° 24-25 140C, juin 2025 : https://www.vie-publique.fr/files/rapport/pdf/299814.pdf
- [3] (R) https://www.index-education.com/fr/pronote-hebergement-presentation.php
- [4] (R) https://forum.index-education.com/questions/2836/api-pronote (2019-10-07)
- [5] (R) https://www.index-education.com/fr/pronote-info326-connecteurs-partenaires.php
- [6] (T) CGVU Index Éducation, version du 18/08/2025 : https://www.index-education.com/contenu/telechargement/doc/CGVU-INDEX-EDUCATION-2025.pdf
- [7] (G) https://github.com/Litarvan/pronote-api (README post-mortem, dernier push 2021-04-30)
- [8] (R) Code pénal, art. 323-1 et 323-3-1 : https://www.legifrance.gouv.fr/codes/section_lc/LEGITEXT000006070719/LEGISCTA000006149839/
- [9] (R) https://fr.wikipedia.org/wiki/Pronote
- [10] (G) https://github.com/PapillonApp/Papillon (API GitHub, `package.json` de la branche `dev`, recherche d'issues)
- [11] (R) https://www.index-education.com/fr/article-1434-index-Education-repond-aux-questions-de-mediapart.php
- [12] (R) https://www.decodeurs1793.org/argent-aides-droits-numeriques/ecole-directe/ (mis à jour le 2026-08-30)
- [13] (R) https://www.eliott.app/ ; https://www.eliott.app/etablissements-scolaires ; https://www.eliott.app/politique-de-confidentialite
- [14] (G) npm : `@blockshub/blocksdirecte`, `skolengojs`, `scolengo-api` ; GitHub : `raphckrman/skolengo.js`, `maelgangloff/scolengo-api`
- [15] (R) https://ouiactive.com/etablissement ; https://ouiactive.com/eleve
- [16] (G) npm `pawnote` et `@blockshub/pawnote-lts` (métadonnées, téléchargements, README du tarball 1.6.4)
- [17] (G) https://github.com/vexcited (bio du profil)
- [18] (G) https://github.com/BlocksHub/Blocksnote
- [19] (G) https://github.com/bain3/pronotepy
- [20] (R) https://papillon.bzh/
- [21] (G) https://github.com/PapillonApp/Papillon/issues/798
- [22] (R) https://www.vousnousils.fr/2025/10/15/avec-dinobot-nous-voulons-encadrer-lusage-de-lia-a-lecole-697160
- [23] (G/R) https://github.com/Helmus101/todo (README) ; https://hiotto.vercel.app
- [24] (G) https://github.com/konnectors/pronote
- [25] (R) https://www.cnil.fr/fr/recommandation-4-rechercher-le-consentement-dun-parent-pour-les-mineurs-de-moins-de-15-ans
- [26] (R) https://www.cnil.fr/fr/reglement-europeen-protection-donnees/chapitre3#Article20
- [27] (T) « L'IA en éducation, cadre d'usage », juin 2025, copie de l'académie d'Amiens : https://pedagogie.ac-amiens.fr/lettres-histoire-geographie/wp-content/uploads/sites/10/2025/06/l-ia-en-ducation-cadre-d-usage-227697.pdf
- [28] (T/R) GAR : https://gar.education.fr/fournisseurs-de-ressources/adherer/ ; https://gar.education.fr/fournisseurs-de-ressources/faq-fournisseurs-de-ressources/ ; Contrat GAR v2026 : https://gar.education.fr/wp-content/uploads/2026/06/Contrat-GAR_v2026.pdf ; Référentiel administratif et juridique (2026-06-12) : https://gar.education.fr/wp-content/uploads/2026/06/GAR-ReferentielAdminJuridique_FR_20260612.pdf
- [P1] Dépôt : `docs/architecture.md`, `docs/suivi.md`, `apps/server/src/services/pronote/*`, `apps/server/src/routes/pronote-*.ts`, `apps/server/src/routes/chat-message.routes.ts`, `apps/server/src/live/pronote.test.ts`
