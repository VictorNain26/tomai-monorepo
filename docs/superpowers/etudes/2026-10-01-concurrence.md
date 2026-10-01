# Concurrence : aide aux devoirs pour collégiens, France

Analyse du 2026-10-01. Toutes les pages ont été consultées ce jour-là, sauf mention contraire.

**Correctifs postérieurs (même jour), qui priment sur le texte ci-dessous :**
- le « 95 % des parents refusent une IA qui donne les réponses » (Kantar) ne se cite pas : `2026-10-01-marche.md` le classe comme une reformulation trompeuse (question sur le rôle principal souhaité, 5 % choisissent « donner la réponse ») ;
- « personne ne revendique la lecture des devoirs Pronote » est faux : Otto Lycée lit les devoirs Pronote avec une IA, et Eliott est partenaire officiel de Pronote ; Dinobot s'en tient à une connexion unique (voir `2026-10-01-pronote.md`) ;
- Pronote n'est plus un différenciateur de la V1 (`specs/2026-10-01-vision-produit.md`).

**Cible.** Les parents de collégiens (6e à 3e), y compris ceux qui ne peuvent pas payer un professeur particulier.

## Comment lire ce document

**Mode de lecture des sources.** Chaque source porte un numéro `[n]` : la liste complète est en fin de document. Les pages ont été lues de trois façons, signalées dans cette liste :
- **(L) lecture littérale dans le navigateur** : les citations sont exactes.
- **(R) résumé par WebFetch** : le sens est fidèle, mais pas forcément les mots.
- **(A) relevé d'un agent de recherche** : le relevé a été fait le même jour, mais je ne l'ai pas relu moi-même.

**Aucun produit n'a été testé.** Je n'ai essayé aucun concurrent, faute de compte ou parce qu'il aurait fallu se servir d'un compte personnel. Tout ce qui porte sur « donne la réponse ou non » rapporte donc **ce que l'éditeur affirme**. Les seules exceptions sont les quelques sources indépendantes signalées comme telles.

**Le produit n'existe pas encore.** « Tom V1 » ci-dessous décrit la **cible écrite dans les specs** du 2026-09-22, pas un service en ligne. Ce qui est réellement construit est précisé en § 1.

---

## 1. Ce que Tom fait vraiment en V1

**Ce qui est décidé** (specs [P1], [P2]) :
- **Public** : collège seulement, de la 6e à la 3e.
- **Plateforme** : un service web en Next.js, sans application mobile.
- **IA** : Mistral Small 4, appelé via l'endpoint européen `api.eu.mistral.ai`.
- **Échelle d'indices tenue par le serveur**, dans cet ordre :
  1. une relance ;
  2. un indice conceptuel ;
  3. un indice ciblé ;
  4. une étape intermédiaire ;
  5. un exemple voisin entièrement résolu.

  Tom ne donne jamais la réponse de l'exercice de l'élève lui-même. Le palier monte avec les tentatives réelles de l'élève.
- **Diagnostic de l'erreur** avant toute aide.
- **Modération** des messages entrants et sortants.
- **Détresse** : un classifieur détecte les signes de détresse et déclenche une alerte au parent.
- **Parent** : il reçoit un résumé (matières, temps passé, progrès, difficultés) et des alertes, mais pas le texte des conversations.
- **Pronote** : connexion par QR code et code PIN, côté serveur, avec la bibliothèque `pawnote` (licence GPL).
- **Formules** : une formule gratuite, et une formule premium qui ajoute les fiches de révision.

**Ce qui n'est pas dans la V1** :
- **Aucun alignement sur les programmes officiels.** Le curriculum et le RAG ont été supprimés du dépôt. Le niveau de l'élève sert seulement à adapter le prompt (`config/prompts/adaptation/by-level.ts`).
- Aucune mesure de qualité : le harnais d'évaluation est le lot 1, qui n'est pas commencé.
- Aucun utilisateur.

**État réel au 2026-10-01.** Ce qui suit vient de [P3] et du code :

| Brique de la V1 | État |
|---|---|
| Client web | **Inexistant** : `apps/` ne contient que `landing` et `server` ; c'est le lot 3. |
| Échelle d'indices imposée par le serveur | **Non construite** (lot 2). |
| Résumé pour le parent sans le texte des conversations | **Non construit.** Le code actuel expose encore les conversations complètes au parent (`parent-dashboard.service.ts:173`). |
| Hébergement dans l'UE | **Non choisi** (décision ouverte, lot 3). |
| Zero Data Retention chez Mistral | **Non demandé.** C'est un bloquant noté dans [P3]. |
| Double consentement sous 15 ans | **Non construit** (lot 3). |
| Pronote | Le **service serveur existe** (`services/pronote/`). Le décodage du QR code dans le navigateur reste à faire. La question de la licence GPL de `pawnote` attend un avis d'avocat ([P1]). |
| Prix de la formule payante | **Non fixé.** |

### La formule gratuite, mesurée

**Les plafonds** ([P4]) :
- Formule gratuite : 5 000 tokens par fenêtre de 5 h et 15 000 tokens par jour.
- Formule premium : 25 000 tokens par fenêtre et 75 000 par jour.

**Le serveur compte tous les tokens d'un tour** (`chat-orchestration.service.ts:298`). C'est le `totalTokens`, qui inclut le prompt système et l'historique de la conversation.

**Ce qu'un tour coûte réellement.** Les deux seuls tours réels enregistrés en base locale (table `cost_tracking`, 2026-09-22) ont consommé :
- 3 287 + 180 = **3 467 tokens** pour le premier ;
- 3 354 + 76 = **3 430 tokens** pour le second.

**Ce que cela donne pour la formule gratuite.** La vérification se fait avant chaque tour : un tour passe tant que le plafond n'est pas déjà atteint ([P5]). On peut donc démarrer **2 tours par fenêtre de 5 h**, puis le compte est bloqué. Sur une journée, cela fait au plus 4 à 5 tours. Le calcul est de moi, sur deux tours seulement, sans image ni raisonnement : en conditions réelles, ce sera **moins**, puisque les images, le raisonnement en maths et l'historique qui s'allonge coûtent tous des tokens.

**Conséquence.** Un soir de devoirs, la formule gratuite permet environ **deux messages de l'élève**. L'échange d'exemple de la landing en compte quatre.

**Comparaison des offres gratuites :**

| Offre | Ce que permet l'offre gratuite |
|---|---|
| **Tom V1** | Environ 2 messages par soir |
| Dinobot | 5 requêtes par jour [D2] |
| ChatGPT | Conversations écrites illimitées [C3] |
| Galac6 | Accès illimité [F2] |

**Tom a aujourd'hui la formule gratuite la plus pauvre du marché**, alors que la cible inclut les familles qui ne peuvent pas payer. C'est le premier point à corriger avant toute affirmation sur la gratuité.

---

## 2. Matrice comparative

**Abréviations utilisées dans les deux tableaux :**
- **Réponse ?** : l'outil donne-t-il la solution d'un exercice ? Tout ce qui n'est pas marqué « vérifié » est une **affirmation de l'éditeur**.
- **Prog. FR** : adaptation aux programmes français affirmée.
- **n.v.** : non vérifié.
- **n.p.** : non précisé par l'éditeur.

### 2a. Prix, comportement face à l'exercice, niveau, programmes

| Concurrent | Prix réel (limites du gratuit) | Réponse ? | Niveau | Prog. FR |
|---|---|---|---|---|
| **Tom V1 (nous)** | Gratuit sans date de fin, mais environ 2 messages par soir (§ 1). Payant : prix non fixé [P4] | Par conception, jamais la réponse de son exercice, palier tenu par le serveur. **Non construit, non mesuré** [P2] | 6e-3e [P2] | Non : aucun référentiel, seulement le niveau dans le prompt [P1][P2] |
| **ChatGPT, mode étude** | Free 0 € : écrit illimité, **envois de fichiers ou d'images limités**. Go 8 €, Plus 23 € [C3]. Le mode étude n'ajoute aucun message [C1] | Socratique, mais « il peut parfois donner une réponse directe » [C1]. L'élève peut retirer le mode [C1][C5]. Les « Horaires d'étude » posés par un parent « ne bloquent pas l'accès » [C1][C2]. Des rappels de devoirs ramènent l'ado vers le mode étude [C4][C7] | Tous niveaux, collège cité [C1] | Non affirmé |
| **Gemini, Apprentissage guidé** | Gratuit [A3] | « help you learn, not just provide the answer » (affirmation de l'éditeur) [A3] | n.p. | Non affirmé |
| **Claude, style « Learning »** | Free et payant [G3] | Socratique, désactivable [G3] | Réservé aux adultes [G2] | Non |
| **Vibe (ex-Le Chat, Mistral)** | Gratuit ; Pro 14,99 €, 7,49 € pour les étudiants [G5] | **Aucun mode étude trouvé**. Renommé le 2026-05-28 et repositionné « travail et code » [G5] | — | Non |
| **Microsoft Copilot, agent « Study and Learn »** | Gratuit, mais **seulement via une licence Microsoft 365 Éducation** de l'établissement [G6] | « leads with questions » [G6] | 13 ans et plus, compte scolaire [G6] | Non |
| **Photomath** | Gratuit avec solutions. Plus à 9,99 €-11,99 € sur l'App Store FR [A1] | **Oui, solution complète gratuite**. Les indices sont payants [A1] | Primaire à université, maths seulement [A1] | Non (ACT et SAT cités) [A1] |
| **Brainly / Nosdevoirs.fr** | Gratuit limité à un nombre de réponses. Plus de 2 € à 9,99 €/mois, Tutor 29,99 €/mois (App Store FR) [A2] | **Oui**, c'est le modèle : « réponses des autres élèves en quelques minutes » [A2] | Collège-lycée [A2] | Non, contenu communautaire |
| **Gauth (ByteDance)** | PLUS : 9,99 €/mois, 59,99 €/an (App Store FR). Limites du gratuit n.v. [A4] | **Oui** : « Notre IA renvoie des solutions en quelques secondes » [A4] | Tous niveaux, STEM [A4] | Non |
| **Socratic (Google)** | **Fermé**. socratic.org redirige vers Google Lens (vérifié par l'agent) [A5] | — | — | — |
| **Kartable, IA « Alfa »** | Pas de gratuit. 14,99 €/mois, 9,99 €/mois sur l'année [B1] | « guide pas à pas » sans « donner la réponse directement » [B1] | CE1-terminale [B1] | « strictement conformes » [B1] |
| **SchoolMouv** (racheté par sofatutor en 02/2026) | 4,99-5,99 €/mois en promotion, 12,49-14,99 € sans remise. Pas de gratuit [B2] | Site : l'IA « guide ». App Store : « suis la solution étape par étape » [B2] | CP-terminale [B2] | « 100 % conforme » [B2] |
| **Nomad Education (Nomad'IA)** | Gratuit (quiz) ; Nomad+ à partir de 9,99 €/mois [B3] | « ne fait pas tes devoirs à ta place ». Outil de révision, pas un tuteur [B3] | Primaire à bac+3 [B3] | n.p. |
| **myMaxicours** | 6,95 à 14,95 €/mois, 9,99 à 21,99 € avec profs. Essai 7 jours [B4] | Pas d'IA ; profs en direct [B4] | CP-terminale [B4] | « 100 % conforme » [B4] |
| **Les Bons Profs** | À partir de 5,94 €/mois, 9,99 € avec profs. Essai 7 jours [B5] | Pas d'IA. Le prof peut « aider à la résolution » [B5] | 6e-terminale [B5] | Oui (vidéos) |
| **Lumni** (France Télévisions) | Gratuit (Wikipédia, site inaccessible) [B6] | Pas d'IA connue [B6] | Maternelle-terminale [B6] | Oui (public) |
| **Mathrix** | Site inaccessible (TLS) [B7] | n.v. | n.v. | n.v. |
| **Jules** (CNED, public) | Gratuit, mais **arrêté** : « n'est plus maintenu » depuis la rentrée 2025 [E2] | — | 6e-3e | Oui |
| **Dinobot** (OuiActive) | **Gratuit : 5 requêtes par jour**, toutes matières. 5,99 €/mois (30 par jour), 9,99 €/mois illimité ou 49,99 €/an en promotion [D2] | « ne donne jamais la réponse toute faite », « te guide par le questionnement » [D1][D3] | 6e-terminale [D3] | « Programmes officiels », Éduscol, annales [D1][D3] |
| **Galac6** (RHK Conseil) | **0 €, illimité**, sans carte, plusieurs enfants. Modèle économique non expliqué [F1][F2] | « refuse de faire le devoir », « indices progressifs » [F1] | CP-terminale [F1] | « aligné » [F1] |
| **Le Prof IA** (Merci Arthur) | 3 sessions gratuites (5 par mois selon les CGU). **4,90 €/mois**, plafond de 200 sessions [F4][B8] | « guide sans donner la réponse » [F4] | 6e-terminale, 6e-3e selon les CGU [F4][B8] | FR, BE, CH, CA [F4] |
| **NeoSko** | Essai 7 jours. 7,99 à 24,99 €/mois [B9][B10] | « ne donne jamais la solution » [B9] | 6e-terminale [B9] | Échelle officielle des acquis [B9] |
| **Eliott** (CultureMe) | Essai 7 jours. 12,99 €/mois ou 69,99 €/an ; famille 19,99 €/mois [B11] | « sans donner la réponse » [B11] | 6e-supérieur [B11] | n.p. |
| **Wilgo** (levée de 6 M€) | Gratuit, Plus à 19,99 € (App Store) [B12] | « ne fournit pas directement les réponses » [B12] | CM1-terminale [B12] | n.p. |
| **SchoolUp** | Essai 7 jours. 8,90 €/mois, 14,90 € pour une famille [F5] | Socratique, avec indices [F5] | CP-master [F5] | n.p. |
| **SkillzUp** | 29,99 à 79,90 €/mois [F6] | « sans jamais donner la réponse toute cuite » [F6] | 6e-terminale [F6] | « 100 % conforme » [F6] |
| **Acadomia** | À domicile : 48,80 €/h (24,40 € après crédit d'impôt) + 29,80 €/mois. En ligne : 43 €/h + 39 €/an [H1] | Prof humain, rien de documenté | Tous niveaux | Oui (prof) |
| **Complétude** | Pas de tarif public. Environ 50 €/h selon un tiers [H2] | Prof humain | Tous niveaux | Oui (prof) |
| **Superprof** | Pass Élève à 39 €/mois **plus** le prix du cours, 22 à 45 €/h dans le secondaire [H3] | Prof humain | Tous niveaux | Selon le prof |
| **Devoirs faits** (public) | **Gratuit** [E1] | Encadrement par des adultes : « ni un cours, ni un temps de remédiation » [E1] | Collège ; obligatoire en 6e depuis 2023 [E1] | Oui (établissement) |
| **Khanmigo** | 4 $/mois, **réservé aux États-Unis** [I1] | « doesn't just give answers » [I1] | Primaire-université | Non |
| **Synthesis Tutor** | 29 à 70 $/mois [I2] | Leçons guidées [I2] | 5-11 ans, maths [I2] | Non |

### 2b. Parents, âge et données, disponibilité, langue

| Concurrent | Visibilité parents | Âge, consentement, lieu des données | Disponibilité | Langue |
|---|---|---|---|---|
| **Tom V1** | Résumé (matières, temps passé, progrès, difficultés) et alerte en cas de détresse, sans le texte des conversations. **Non construit** : le code actuel montre les conversations [P2] | Double consentement sous 15 ans **prévu** (lot 3). Mistral via l'endpoint UE. Hébergement UE **non choisi**. ZDR **non demandé** [P1][P2][P3] | Web, quand il existera ; plafond de la formule gratuite (§ 1) | FR |
| **ChatGPT** | Comptes liés : heures calmes, mode étude par défaut, **alertes de sécurité** examinées par des personnes. **Aucun accès aux conversations. Aucun suivi scolaire.** L'ado peut délier son compte à tout moment [C2]. Réglage « Améliorer le modèle pour tout le monde » **activé par défaut** pour l'ado [C2] | 13 ans « ou l'âge minimum requis dans votre pays ». Autorisation parentale sous 18 ans [C8]. **Serveurs aux États-Unis** [C9]. Prédiction de l'âge déployée dans l'UE depuis le 2026-08-25 [C6]. ChatGPT pour les ados déployé « dans le monde entier » depuis le 18 août [C4] | 24 h/24 | FR |
| **Gemini** | Family Link | **Indisponible pour les comptes supervisés dans l'EEE** [G1]. En France, il faut 15 ans pour gérer seul un compte Google [G4]. **Donc pas d'accès légal sous 15 ans** | 24 h/24 | FR |
| **Claude** | Aucune | **18 ans minimum** [G2] | — | — |
| **Vibe (Mistral)** | Aucune | 13 ans, permission parentale [G7] | — | FR |
| **Microsoft Copilot, Study and Learn** | Via l'établissement | 13 ans et plus, licence Éducation obligatoire [G6] | Web, Windows | FR parmi plus de 40 langues [G6] |
| **Photomath** | Aucune [A1] | 13 ans. Consentement sous 16 ans. **Transferts hors UE**, photos utilisées pour « improve our AI » [A1] | 24 h/24 | FR |
| **Brainly / Nosdevoirs** | Liaison parent « dans certaines juridictions », non vérifiée en France [A2] | 13 ans. Transferts « North America, Europe, Asia, Latin America ». **Publicité ciblée** [A2] | 24 h/24, tuteurs « selon disponibilité » | FR |
| **Gauth** | Aucune [A4] | 13 ans. **Serveurs en Malaisie et à Singapour.** App Store 4+ [A4] | 24 h/24, tuteurs humains annoncés | FR |
| **Kartable** | Tableau de bord, courbes, lacunes [B1] | Case à cocher sous 15 ans. AWS Dublin. Transferts vers les États-Unis possibles. Fournisseur de l'IA non nommé [B1] | IA 24/7. Profs du lundi au vendredi, 16h-19h [B1] | FR |
| **SchoolMouv** | Tableau de bord [B2] | « Aucune transmission en dehors de l'UE ». CGV : 18 ans ou accord parental [B2] | Profs 17h-20h en semaine (Premium) [B2] | FR |
| **Nomad Education** | « suivi des parents » [B3] | CGU : Google Cloud en Belgique, 15 ans. La politique de confidentialité autorise des transferts vers le Canada et les États-Unis [B3] | App | FR |
| **myMaxicours** | Compte parent [B4] | Consentement sous 15 ans. Transferts hors UE possibles [B4] | Profs 6 j/7, 17h-20h [B4] | FR |
| **Les Bons Profs** | Espace parent [B5] | Consentement sous 16 ans. Hébergeur n.p. [B5] | Visio 17h-20h, sauf le vendredi [B5] | FR |
| **Dinobot** | **Module famille « Bientôt disponible »** [D2] | Consentement parental sous 15 ans. **Hébergé en France** [D4]. Mistral cité par le fondateur [D5], aucun fournisseur nommé dans la politique [D4] | « 24h/24 » [D3] | FR |
| **Galac6** | « espace dédié » aux progrès [F1] | Supabase en France. **IA : Anthropic et OpenAI (États-Unis, clauses contractuelles types)**, et Mistral. Pas d'entraînement [F3] | n.p. | FR |
| **Le Prof IA** | **Analyse IA hebdomadaire** envoyée aux parents [F4] | 10-15 ans, consentement parental. **Anthropic et OpenAI (États-Unis)** [F7] | n.p. | FR |
| **NeoSko** | **E-mail tous les dimanches** soir [B9] | **Mistral Large**, Francfort. Responsable du traitement : une personne physique sans SIREN [B10] | « chaque soir », plus un « vrai prof » [B9] | FR |
| **Eliott** | Suivi des progrès et retours qualitatifs [B11] | **Azure OpenAI en Suède**, Supabase à Francfort. Attestation parentale sous 15 ans [B11] | n.p. | FR |
| **Wilgo** | n.v. | **OpenAI et Gemini, transferts hors UE**. Cookies publicitaires [B12] | App | FR |
| **SchoolUp** | Espace parent multi-enfants [F5] | Hébergeur LWS ; IA non nommée [F5] | n.p. | FR |
| **SkillzUp** | « Résumé IA Parents » [F6] | « conforme RGPD » [F6] | n.p. | FR |
| **Acadomia / Complétude** | Bilans réguliers [H1][H2] | n.p. | **Sur rendez-vous** [H1][H2] | FR |
| **Superprof** | n.v. | CGU inaccessibles (403) [H3] | Sur rendez-vous | FR |
| **Devoirs faits** | Pas d'outil de suivi pour les familles [E1] | Public | **Dans l'établissement, pas le soir** ; environ 2,5 h par semaine [E1] | FR |
| **Khanmigo** | Historique des conversations et alertes [I1] | Serveurs aux États-Unis ; **réservé aux États-Unis** [I1] | 24/7 | FR « non testé » [I1] |
| **Synthesis Tutor** | Rapports de progrès [I2] | États-Unis [I2] | — | Anglais, espagnol [I2] |

---

## 3. Le vrai trou

### Ce que ChatGPT couvre déjà, gratuitement

**Ce que ChatGPT gratuit offre aujourd'hui à un collégien de 13 ans ou plus, avec l'accord de ses parents :**
- **L'outil** : un tuteur socratique gratuit, en français, disponible 24 h/24, qui accepte la photo de l'exercice et la voix, propose des fiches et des quiz, et garde une mémoire de l'élève [C1][C3].
- **Le contrôle parental** : le parent peut faire démarrer les nouvelles conversations en mode étude, fixer des heures calmes et recevoir une alerte quand des examinateurs formés repèrent un risque grave d'automutilation. Il ne lit jamais les conversations [C2].
- **Le comportement** : depuis le 18 août 2026, ChatGPT détecte les ados et les renvoie vers le mode étude quand ils cherchent un raccourci [C4][C7].
- **L'usage** : ChatGPT est déjà l'outil des collégiens. 8 utilisateurs d'IA sur 10 parmi les 12-17 ans s'en servent [A6], et 50 % des collégiens d'un échantillon volontaire l'utilisent [A7].

**Ce que nous mettons en avant et que ChatGPT a déjà :**

| Atout de Tom | ChatGPT le propose déjà |
|---|---|
| Socratique | Oui |
| Ne montre pas les conversations au parent | Oui |
| Alerte de détresse au parent | Oui, avec relecture humaine |
| Photo et voix | Oui |
| Gratuit | Oui, avec des limites bien plus larges que les nôtres |

### Ce que ChatGPT ne couvre pas

Ce sont les faits qui ouvrent un vrai trou. Chacun est sourcé.

1. **L'enfant peut toujours obtenir la réponse.**
   - Le mode étude se retire d'un geste [C1].
   - Les « Horaires d'étude » « ne bloquent pas l'accès à ChatGPT » et ne s'appliquent ni aux conversations existantes, ni aux GPT, ni aux projets [C1][C2].
   - OpenAI écrit lui-même que le mode « peut parfois donner une réponse directe » [C1], et à son lancement, qu'il produit « certains comportements incohérents » [C5].
   - L'ado peut délier son compte du contrôle parental à tout moment [C2].
   - Or 95 % des parents refusent que l'IA « donne directement les réponses à la place de l'enfant » (Kantar, juillet 2026, 1 010 adultes) [A8].
2. **Le parent ne voit rien du travail scolaire.** Le contrôle parental ne donne ni matières, ni temps passé, ni difficultés : seulement des réglages et des alertes de sécurité [C2].
3. **Les données partent aux États-Unis et servent à l'entraînement.**
   - OpenAI traite les données « sur des serveurs situés […] aux États-Unis » [C9].
   - Pour un ado lié, le réglage « Améliorer le modèle pour tout le monde » est **activé par défaut** [C2].
4. **ChatGPT ignore ce que l'élève a à faire.** Il n'est relié ni à Pronote ni à la classe.

### Ce que les autres couvrent, au-delà de ChatGPT

- **Indices sans la réponse.** C'est le discours de presque tous les acteurs : Dinobot, Galac6, Le Prof IA, NeoSko, Eliott, Kartable Alfa, Wilgo, SkillzUp, SchoolUp.
- **Résumé hebdomadaire au parent.** Le Prof IA, NeoSko et SkillzUp le proposent déjà, et Kartable, SchoolMouv, Galac6 et SchoolUp ont un espace parent.
- **IA et données en France ou dans l'UE.** Dinobot (France, Mistral selon le fondateur), NeoSko (Mistral Large, Francfort) et Eliott (Azure, Suède) le revendiquent déjà.
- **Gratuit permanent.** Galac6 est gratuit et illimité, Dinobot offre 5 requêtes par jour.
- **Pronote.** Eliott et Dinobot affichent un accès « via Pronote ». C'est probablement une connexion par EduConnect ou le compte de l'établissement, pas une lecture des devoirs : leurs pages ne parlent pas des données [B11][D3]. Je n'ai trouvé **aucune offre qui affirme lire les devoirs et les notes Pronote** de l'élève pour l'aider. Il est **impossible de prouver** qu'aucune ne le fait.

### Le trou, formulé honnêtement

**Il n'existe pas aujourd'hui d'offre qui réunisse ces quatre conditions :**
1. **gratuite de façon utilisable** chaque soir pour une famille qui ne paie pas ;
2. **sans échappatoire** : un seul mode, où l'élève ne peut pas basculer vers la réponse ;
3. **qui montre au parent la progression scolaire, pas les messages** ;
4. **avec des données et une IA qui restent dans l'UE, sans entraînement.**

Chaque brique existe ailleurs, mais aucune offre ne les a toutes, comme le montre le tableau.

| Offre | Ce qui lui manque |
|---|---|
| ChatGPT | La 2, la 3 et la 4 |
| Galac6 | La 4 : ses modèles sont américains |
| Dinobot | La 3, puisque son module famille n'est pas sorti. Sa formule gratuite est maigre |
| Le Prof IA, NeoSko | La 1, puisqu'ils sont payants. Le Prof IA manque aussi la 4 |

**Les points faibles de ce trou :**
- **Il est étroit et se referme vite** :
  - Dinobot annonce son module famille ;
  - OpenAI ajoute des fonctions pour les ados tous les mois ;
  - Galac6 n'a qu'à changer de fournisseur d'IA.
- **La différence avec ChatGPT ne joue qu'à une condition** : il faut que le parent tienne à ce qu'il n'y ait pas d'échappatoire et tienne à la confidentialité. Pour un parent qui laisse déjà ChatGPT à son enfant, Tom n'apporte que deux choses : la vue de la progression scolaire, et des données gardées dans l'UE et non utilisées pour l'entraînement.

### Ce qui nous distingue réellement en V1, une fois la V1 livrée

- **Un seul mode** : l'élève ne peut pas sortir de l'échelle d'indices. Ce n'est vrai qu'une fois le lot 2 construit et mesuré.
- **Un palier d'aide tenu par le serveur**, avec un contrôle de fuite ; personne d'autre ne publie un tel mécanisme. C'est **invérifiable de l'extérieur**, mais démontrable par une évaluation publiée.
- **Le parent voit la progression scolaire sans les messages**, ce que ChatGPT n'offre pas. Le Prof IA, NeoSko et SkillzUp le font, mais en payant.
- **Les devoirs Pronote comme point de départ.** Personne ne revendique la lecture des devoirs. C'est un vrai différenciateur, avec deux risques non traités :
  - la licence GPL et l'avis d'avocat attendu ;
  - les conditions d'Index Education, non vérifiées.
- **Données et modèle dans l'UE, sans entraînement**, à condition d'avoir un hébergement UE et le Zero Data Retention.

### Ce qui ne nous distingue pas

- Le socratique, le « jamais la réponse », la photo, la voix, le 24 h/24, le français.
- Mistral et le « français » : Dinobot et NeoSko utilisent aussi Mistral.
- L'alerte de détresse : ChatGPT en a une, avec relecture humaine.
- Le prix : Galac6 est gratuit et illimité, Le Prof IA coûte 4,90 €, Dinobot 5,99 €.
- L'adaptation aux programmes : **nous sommes en dessous** de Dinobot, Kartable et SchoolMouv, qui revendiquent des contenus conformes et des annales.
- La traction : zéro utilisateur. Dinobot revendique 170 000 à 200 000 élèves [D1][D5], Eliott 300 000 utilisateurs [B11]. Ce sont des chiffres de l'éditeur, et Dinobot en donne de différents d'une source à l'autre [D6].

### Pour la cible « ne peut pas payer un prof »

**Le coût de l'humain :**
- Un cours particulier coûte de 22 à 45 €/h dans le secondaire sur Superprof, plus 39 €/mois de Pass [H3].
- Chez Acadomia, il coûte 48,80 €/h, soit 24,40 € après crédit d'impôt, plus une cotisation [H1].
- Le crédit d'impôt ne vaut que pour un cours **à domicile** [H4].

**Les données sur les familles qui paient** sont anciennes (DEPP 2010) :
- 9,5 % des entrants en 6e prenaient des cours payants ;
- parmi les élèves en difficulté, les familles les plus aisées y recouraient deux fois plus que les plus modestes [H5].

**Le gratuit public ne couvre pas le soir :**
- Devoirs faits se déroule dans l'établissement, environ 2,5 h par semaine, et pas le soir [E1].
- Jules, l'assistant du CNED, est arrêté [E2].

**Pour ces familles, l'alternative gratuite du soir s'appelle ChatGPT, Galac6 ou le Dinobot gratuit.** Avec environ deux messages par soir, Tom **ne répond pas** aujourd'hui à cette cible.

---

## 4. Affirmations interdites

Sont listées ici les affirmations fausses, invérifiables ou prématurées. Certaines figurent déjà dans le code de la landing ou dans sa spec.

| Affirmation tentante | Pourquoi c'est interdit |
|---|---|
| « ChatGPT ou les applis rendent la solution » ([P6] `faq-data.ts`, FAQ n° 3 de la spec) | **Faux pour ChatGPT** : il a un mode étude, et des rappels de devoirs pour les ados [C1][C4]. Ce n'est vrai que de Photomath, Brainly et Gauth [A1][A2][A4] |
| « Tom ne donne jamais la réponse », au présent ([P6] FAQ n° 1 : « Non. ») | L'échelle d'indices n'est pas construite et la fuite n'est pas mesurée. Même construite, un LLM peut fuiter : dire « jamais » sans le taux de fuite publié est invérifiable |
| « Le seul / le premier tuteur qui ne donne pas la réponse » | Faux : Dinobot, Galac6, Le Prof IA, NeoSko, Eliott, Kartable, Wilgo |
| « Le seul à vous envoyer un résumé » | Faux : Le Prof IA, NeoSko, SkillzUp |
| « La seule IA française et souveraine pour les devoirs » | Faux : Dinobot (Mistral, France), NeoSko (Mistral) |
| « Données hébergées en Europe » (hero, Confiance, FAQ actuels [P6]) | **Faux aujourd'hui** : l'hébergement n'est pas choisi et le Zero Data Retention n'est pas demandé [P1][P3]. Ce n'est permis qu'au lancement, preuve à l'appui |
| « Gratuit pour les devoirs du soir » | Trompeur avec environ 2 messages par fenêtre de 5 h (§ 1) |
| « Conforme aux programmes », « aligné sur Éduscol » | Il n'y a aucun référentiel en V1 |
| « Adapte ses notations à la classe de votre enfant » | Prompt seulement, rien de mesuré. À formuler comme une intention, ou à retirer |
| « Fait progresser », « +X points » | Aucun utilisateur, aucune mesure |
| « Tom se souvient de ce qui a résisté » | La mémoire n'est pas réalisée ([P2] § 7 : l'extraction est à refaire). À ne pas affirmer avant le lot 2 |
| « Vous ne lisez pas ses conversations » | **Faux dans le code actuel** (`parent-dashboard.service.ts:173`). Ce n'est vrai qu'après le chantier qui retire cet accès |
| « Une alerte si votre enfant va mal » | Non construit. Et ChatGPT le fait déjà avec relecture humaine : ce n'est pas un argument différenciant |
| « Pronote branché » au présent | Pas de client web. Licence GPL en attente d'avocat. Conditions d'Index Education non vérifiées |
| « Moins cher qu'un prof », avec un prix | Prix non fixé |
| « Gemini et Claude sont interdits aux collégiens » | Seulement exact pour Claude (18 ans) et pour Gemini sous 15 ans en France [G1][G2][G4]. Faux pour ChatGPT. À éviter en communication : on ne gagne pas en citant le concurrent |
| « Recommandé par l'Éducation nationale » | Aucun lien. Le cadre ministériel de juin 2025 réserve l'IA générative en classe à partir de la 4e [A9]. Un parent de 6e ou de 5e pourra l'opposer |

---

## 5. Affirmations défendables, prêtes à l'emploi

**Lecture du tableau.** La colonne « Condition » dit quand la phrase devient vraie :
- **Aujourd'hui** : utilisable tout de suite.
- **Au lancement** : utilisable seulement si la brique est livrée et prouvée.

| Phrase | Preuve | Condition |
|---|---|---|
| « Ici, il n'y a pas d'autre mode : votre enfant ne peut pas basculer vers la réponse. » | Ailleurs, le mode étude se retire et les horaires d'étude « ne bloquent pas l'accès » [C1][C2]. Chez nous, il n'existe qu'une seule interface de chat | Au lancement (lot 2 + lot 3) |
| « Le niveau d'aide est fixé par notre serveur, pas laissé à l'IA. Insister ne fait pas monter l'aide ; chercher, si. » | [P2] § 4-5. À accompagner du taux de fuite mesuré par le harnais du lot 1 | Au lancement, avec le chiffre de fuite publié |
| « Vous voyez ce qu'il a travaillé et ce qui résiste, pas ce qu'il a écrit. » | Le contrôle parental de ChatGPT ne montre aucun suivi scolaire [C2]. Chez nous : [P2] § 10 | Au lancement, après le retrait de l'accès aux conversations |
| « Les conversations de votre enfant ne servent à entraîner aucune IA. » | Chez ChatGPT, « Améliorer le modèle » est activé par défaut pour les ados liés [C2]. Chez nous, l'entraînement sur les appels API Mistral est désactivé [P3]. **À doubler** par la lecture des conditions de l'API Mistral, non faite ici | Aujourd'hui côté Mistral. À confirmer avec le Zero Data Retention |
| « Ses données et le modèle d'IA restent dans l'Union européenne. » | Mistral, endpoint UE [P2] § 2. OpenAI : serveurs aux États-Unis [C9]. Le Prof IA et Galac6 : Anthropic et OpenAI aux États-Unis [F3][F7] | Au lancement : hébergement UE choisi **et** Zero Data Retention obtenu |
| « Tom part des devoirs inscrits dans Pronote, pas d'un exercice au hasard. » | Aucune offre ne revendique la lecture des devoirs Pronote ; Eliott et Dinobot parlent seulement d'accès [B11][D3] | Au lancement, après l'avis sur la GPL et le décodage du QR code en web |
| « Conçu pour les 11-15 ans, avec votre accord. » | Claude est réservé aux adultes [G2]. Gemini est inaccessible sous 15 ans en France [G1][G4] | Au lancement : double consentement (lot 3) |
| « Gratuit, sans carte bancaire et sans date de fin. » | Spec tarifs [P4] | Aujourd'hui, mais **à ne pas associer à « devoirs du soir »** tant que le quota reste à environ 2 messages |
| « Un cours particulier coûte de 22 à 45 € de l'heure au collège. » | Superprof, mars 2026 [H3] ; Acadomia, 48,80 €/h [H1] | Aujourd'hui |
| « 95 % des parents ne veulent pas d'une IA qui donne les réponses à la place de leur enfant. » | Kantar, juillet 2026, 1 010 adultes [A8]. **Citer la source** | Aujourd'hui |
| « Tom est une IA, et il le dit à votre enfant. » | [P2] § 7, et AI Act art. 50(1) | Au lancement (lot 2 + lot 3) |
| « Aucune publicité. » | Engagement produit. Brainly fait de la publicité ciblée [A2], Wilgo pose des cookies publicitaires [B12] | Aujourd'hui (engagement), à inscrire dans les CGU |

---

## 6. Ce qui n'a pas pu être vérifié

**Comportement réel des produits**
- Aucun concurrent n'a été testé, y compris l'extraction de la réponse au mode étude de ChatGPT. Le seul aveu documenté vient d'OpenAI : « peut parfois donner une réponse directe » [C1].
- Je n'ai trouvé aucun test indépendant publié.

**Disponibilités et chiffres**
- Disponibilité effective de ChatGPT pour les ados en France : le déploiement est mondial, mais OpenAI précise que « la disponibilité des fonctionnalités peut varier selon la région » [C4].
- Chiffres d'utilisateurs de Dinobot, Eliott et Le Prof IA : déclaratifs, et incohérents chez Dinobot [D6].

**Pronote**
- Nature exacte de l'accès Pronote chez Eliott et Dinobot.
- Conditions d'Index Education sur les clients tiers.
- Effet du réglage Pronote 2026 qui permet de bloquer les mises à jour de l'Espace Élèves le soir. Je ne l'ai vu que dans un résultat de recherche [A10], page non ouverte.

**Pages inaccessibles**
- Fichiers et conditions Mistral : la politique de conservation par défaut sans Zero Data Retention n'a pas été lue ici.
- Lumni (blocage), Mathrix (erreur TLS), CGU de Superprof (403).
- Texte officiel du cadre d'usage de l'IA du ministère : 403 ; seuls des résumés académiques ont été lus [A9].
- Rapport de confidentialité Common Sense sur Gauth (404).

**Données de contexte**
- Aucune donnée récente (2020 ou après) sur le recours au soutien scolaire payant selon le revenu.

---

## Sources

**Méthode** : (L) lecture littérale dans le navigateur ; (R) résumé WebFetch ; (A) relevé d'un agent de recherche, le même jour. Consultation le 2026-10-01 sauf indication contraire.

**Produit (dépôt)**
- [P1] `docs/superpowers/specs/2026-09-22-cible-v1.md`
- [P2] `docs/superpowers/specs/2026-09-22-agent-ia.md`
- [P3] `docs/superpowers/suivi.md` (bloquants, journal C.9) ; table `cost_tracking` de la base locale (2 lignes du 2026-09-22)
- [P4] `apps/server/src/services/quota/quota-config.ts` ; spec landing du 2026-09-24, supprimée depuis (Tarifs)
- [P5] `apps/server/src/services/quota/quota-functions.ts` (`checkQuotaReal`) ; `services/chat/chat-orchestration.service.ts:298`
- [P6] `apps/landing/components/sections/faq-data.ts`, `hero.tsx`, `trust.tsx`

**IA générales**
- [C1] (L) https://help.openai.com/fr-fr/articles/11780217-using-study-mode-in-chatgpt
- [C2] (L) https://help.openai.com/fr-fr/articles/12315553-managing-parental-controls-in-chatgpt
- [C3] (L) https://chatgpt.com/fr-FR/pricing/
- [C4] (L) https://help.openai.com/fr-fr/articles/20001421-chatgpt-for-teens
- [C5] (L) https://openai.com/fr-FR/index/chatgpt-study-mode/ (29/07/2025) ; (R) https://techcrunch.com/2025/07/29/openai-launches-study-mode-in-chatgpt
- [C6] (L) https://openai.com/fr-FR/index/our-approach-to-age-prediction/ (mise à jour du 25/08/2026)
- [C7] (R) https://www.ghacks.net/2026/08/24/openai-launches-chatgpt-for-teens-with-study-focused-features-and-default-safety-protections/ ; (R) https://techcrunch.com/2026/08/18/openai-launches-a-safer-chatgpt-for-teens-years-after-teens-started-using-it/
- [C8] (L) https://openai.com/fr-FR/policies/eu-terms-of-use/
- [C9] (L) https://openai.com/fr-FR/policies/eu-privacy-policy/ (§ 7 et § 10)
- [G1] (L) https://support.google.com/families/answer/16109150?hl=fr
- [G2] (R) https://www.anthropic.com/legal/consumer-terms (en vigueur depuis le 08/10/2025)
- [G3] (R) https://www.engadget.com/ai/anthropic-brings-claudes-learning-mode-to-regular-users-and-devs-170018471.html (14/08/2025)
- [G4] (L) https://support.google.com/accounts/answer/1350409?hl=fr
- [G5] (R) https://the-decoder.com/mistral-rebrands-lechat-as-vibe-betting-its-chatbots-future-is-as-a-full-blown-work-agent/ (28/05/2026)
- [G6] (R) https://support.microsoft.com/en-us/education/copilot/study-learn-agent
- [G7] (R) https://help.mistral.ai/en/articles/347631-can-children-use-mistral-products-and-services (mise à jour du 12/08/2026)
- [A3] (A) https://blog.google/products/gemini/guided-learning-google-gemini/ ; (L) https://support.google.com/gemini/answer/16448384?hl=fr

**Résolveurs et usages**
- [A1] (A) https://photomath.com/terms/ ; https://photomath.com/privacy/ ; https://support.google.com/photomath/answer/14328660?hl=fr ; https://apps.apple.com/fr/app/photomath/id919087726
- [A2] (A) https://nosdevoirs.fr/pages/reglement ; https://brainly.com/pages/terms_of_use ; https://brainly.com/pages/privacy_policy ; https://apps.apple.com/fr/app/brainly-nosdevoirs-fr/id745089947
- [A4] (A) https://www.gauth.com/fr ; https://sf-mis.ttwstatic.com/obj/mis-draft-sg/gauthmath/website-policy-general_row.html ; https://sf-mis.ttwstatic.com/obj/mis-draft-sg/gauthmath/terms_web_row.html ; https://apps.apple.com/fr/app/gauth-ai-study-companion/id1542571008
- [A5] (A) https://socratic.org/ (redirection vers https://lens.google/#homework) ; https://en.wikipedia.org/wiki/Socratic_(Google)
- [A6] (A) https://www.arcep.fr/uploads/tx_gspublication/barometre-du-numerique-edition-2026_RAPPORT.pdf. Chiffres du rapport :
  - 59 % des 12-17 ans utilisent l'IA générative ;
  - 68 % de ces utilisateurs s'en servent pour les devoirs, soit environ 40 % de tous les 12-17 ans ;
  - l'échantillon des 12-17 ans ne compte que 201 répondants.
- [A7] (A) https://www.cahiers-pedagogiques.com/les-eleves-face-a-lia-entre-seduction-et-inquietudes/ (1 448 collégiens, échantillon non représentatif)
- [A8] (R) https://www.cbnews.fr/etudes/rentree-scolaire-les-parents-adoptent-ia (Kantar, juillet 2026, article du 30/08/2026)
- [A9] (A) https://pedagogie.ac-amiens.fr/lettres-histoire-geographie/lia-en-education-cadre-dusage/ ; https://www.banquedesterritoires.fr/ia-en-education-ce-que-prevoit-le-cadre-dusage-pour-la-communaute-educative
- [A10] Résultat de recherche seulement : https://www.index-education.com/fr/pronote-info1444-nouveautes-pronote-2026.php

**Plateformes françaises**
- [B1] (A) https://www.kartable.fr/souscrire/formules ; https://www.kartable.fr/ ; https://www.kartable.fr/aide-aux-devoirs ; https://www.kartable.fr/mentions-legales/cgu ; https://www.kartable.fr/mentions-legales
- [B2] (A) https://offres.schoolmouv.fr/plans/ ; https://www.schoolmouv.fr/parent ; https://www.schoolmouv.fr/charte-donnees-personnelles ; https://www.schoolmouv.fr/legal/cgv ; https://apps.apple.com/fr/app/schoolmouv-ai-tutor-quiz/id1353761629 ; https://edtechactu.com/breves/schoolmouv-est-acquise-par-ledtech-allemande-sofatutor/
- [B3] (A) https://www.nomadeducation.fr/premium/offre-26-27 ; https://www.nomadeducation.fr/blog/articles/2025-11-12/nomadia-ia-educative-revisions-sur-mesure ; https://nomadeducation.fr/conditions-d-utilisation ; https://www.nomadeducation.fr/privacy-policy
- [B4] (A) https://www.maxicours.com/se/abonnements/ ; https://www.maxicours.com/se/politique-de-confidentialite-des-donnees-personnelles/
- [B5] (A) https://www.lesbonsprofs.com/nos-offres/ ; https://www.lesbonsprofs.com/wp-content/uploads/2024/10/cgu-lbp.pdf
- [B6] (A) https://fr.wikipedia.org/wiki/Lumni (lumni.fr inaccessible)
- [B7] (A) https://www.mathrix.fr (erreur TLS)
- [B8] (A) https://leprofia.fr/cgu
- [B9] (R) https://www.neosko.fr/ ; (A) https://neosko.fr/legal/cgv
- [B10] (A) https://neosko.fr/legal/confidentialite
- [B11] (R) https://www.eliott.app/ ; (A) https://www.eliott.app/cgv-cgu ; https://www.eliott.app/politique-de-confidentialite
- [B12] (A) https://apps.apple.com/fr/app/wilgo-revision-ia-brevet-bac/id6746050626 ; https://wilgo.ai/privacy ; https://edtechactu.com/outils-collaboratifs/wilgo-transforme-la-revision-scolaire-en-experience-gamifiee/ ; https://www.maddyness.com/2025/06/23/wilgo-leve-6-millions-deuros-pour-faire-reviser-les-collegiens-et-lyceens/

**Dinobot**
- [D1] (R) https://ouiactive.com/
- [D2] (R) https://ouiactive.com/offres (promotion annuelle « jusqu'au 30/09 »)
- [D3] (R) https://ouiactive.com/eleve
- [D4] (R) https://ouiactive.com/cgu (mise à jour d'août 2026)
- [D5] (R) https://www.vousnousils.fr/2025/10/15/avec-dinobot-nous-voulons-encadrer-lusage-de-lia-a-lecole-697160 ; (R) https://mesinfos.fr/69700-givors/aider-les-eleves-a-apprendre-grace-a-l-ia-la-promesse-de-la-solution-dinobot-basee-a-givors-243979.html (08/04/2026)
- [D6] (R) https://blog-ia.com/rtcl_listing/dinobot/ (mise à jour du 26/09/2026) ; (R) https://edtechactu.com/outils-collaboratifs/dinobot-lia-qui-repond-aux-questions-des-eleves/ (25/11/2025) ; (L) https://play.google.com/store/apps/details?id=com.teachonmars.ouiactive.ouiactive&hl=fr ; (R) https://apps.apple.com/us/app/ouiactive-revisions-college/id1665887524?l=fr-FR

**Proches de Dinobot**
- [F1] (R) https://galac6.io/soutien-scolaire-ia
- [F2] (R) https://galac6.io/tarifs
- [F3] (R) https://galac6.io/mentions-legales
- [F4] (R) https://leprofia.fr/
- [F5] (R) https://www.schoolup.fr/
- [F6] (R) https://www.skillzupschool.com/
- [F7] (R) https://leprofia.fr/confidentialite (20/02/2026)

**Soutien humain et public**
- [E1] (A) https://www.education.gouv.fr/devoirs-faits-un-temps-d-etude-accompagnee-pour-realiser-les-devoirs-7337 (page du 08/01/2025) ; https://eduscol.education.gouv.fr/sites/default/files/document/livret-devoirs-faits-au-coeur-d-une-nouvelle-sixieme-100833.pdf
- [E2] (A) https://drane.region-academique-occitanie.fr/jules
- [H1] (A) https://www.acadomia.fr/tarif-cours-particuliers.html ; https://www.acadomia.fr/qui-sommes-nous/faq/tarifs/quels-sont-les-tarifs-acadomia/
- [H2] (A) https://www.completude.com/cours-particuliers-a-domicile/ ; tiers non indépendant : https://enseigna.fr/avis-completude-cours-particuliers/
- [H3] (A) https://www.superprof.fr/blog/prix-cours-particuliers/ (15/04/2026, données de l'éditeur) ; https://www.superprof.fr/blog/fonctionnement-contact-prof/
- [H4] (A) https://www.service-public.gouv.fr/particuliers/vosdroits/F12
- [H5] (A) https://www.education.gouv.fr/sites/default/files/imported_files/document/DEPP-REF-2010-79-Les_cours_particuliers_en_premiere_annee_de_college_167238.pdf ; https://www.cnesco.fr/wp-content/uploads/2016/09/heim_galine_solo1.pdf

**Tuteurs étrangers**
- [I1] (A) https://www.khanmigo.ai/pricing ; https://www.khanmigo.ai/parents ; https://support.khanacademy.org/hc/en-us/articles/25921448458893 ; https://www.khanacademy.org/about/privacy-policy
- [I2] (A) https://www.synthesis.com/tutor ; https://www.synthesis.com/privacy
