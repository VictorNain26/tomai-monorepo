# Refonte de l'évaluation et de l'observabilité — 2026-10-06

Instantané daté, jamais mis à jour. Demandée par Victor le 2026-10-06 : « ton harnais
d'évaluation et d'observation n'est pas au niveau, documente-toi sur ce qui est sérieux et
fais une refonte ». Elle remplace les décisions de `../2026-10-03/refonte-harnais.md` là où
elles divergent.

## Méthode

- **Quatre recherches documentaires**, le 2026-10-06 :
  - l'évaluation des tuteurs IA dans la recherche ;
  - la fiabilité des juges LLM et la statistique des évals ;
  - l'outillage, l'élève simulé, le red teaming et la CI ;
  - l'observabilité en production et les données de mineurs.

  Les pages ont été lues par WebFetch, qui résume chaque page avec un petit modèle : un chiffre
  n'est repris dans une PR qu'après relecture du PDF.
- **Niveau de preuve de chaque constat** :
  - [M] preuve mesurée ;
  - [P] pratique publiée ;
  - [O] opinion ou proposition d'auteurs.
- **Audit du harnais actuel** (`apps/server/src/eval/`, 2 830 lignes), lu dans le code.

## Le harnais actuel

**Ce qu'il fait** :
- il rejoue 32 exercices dans 6 scénarios scriptés, par la vraie route de chat et dans le même
  processus ;
- il détecte les fuites par du code (`lib/leak.ts`) ;
- il fait noter l'aide par un juge Small 4, en questions oui/non sur cinq tirages ;
- il calcule α et McNemar ;
- il envoie ses expériences dans Langfuse.

**Ce qui ne va pas** :
1. **Le juge n'est pas validé.**
   - Aucun critère n'atteint α ≥ 0,800 contre la référence, et l'exactitude reste à 0,476.
   - Cette référence a été annotée par Claude, pas par un humain.
   - Le juge est le modèle évalué.
2. **Une mesure, un chiffre.**
   - Aucun intervalle n'est publié, et la répétition (`--repeat`) n'a jamais servi.
   - Deux passages identiques ont donné 1 fuite sur 54 puis 3 sur 53. Le test exact de Fisher
     donne p = 0,36 : c'est du bruit, et les deux réunis donnent 4/107, avec un intervalle de
     Wilson à 95 % de 1,5 % à 9,2 %.
3. **Un élève figé**, dont les répliques ne dépendent pas de ce que dit le tuteur.
4. **Un petit jeu** : 32 exercices synthétiques, surtout des réponses fausses ou absentes ;
   aucune photo ni aucun audio réels.
5. **Aucun garde-fou en CI** (lot 1, point 6) et **aucune observabilité en production**.
6. **Une fuite détectée seulement par les formes listées** : une forme courte absente de la
   liste passe (3-F2, `passage-de-fin.md`).

## Ce que dit l'état de l'art

### Évaluer un tuteur

- **Cadre de référence : MRBench** (Maurya et al., NAACL 2025,
  [arXiv 2412.09416](https://arxiv.org/abs/2412.09416)).
  - 8 dimensions, en Oui / En partie / Non : identification de l'erreur, localisation de
    l'erreur, révélation de la réponse, guidage, actionnabilité, cohérence, ton, naturel.
  - Accord entre annotateurs humains : κ = 0,71. [M]
  - Les tuteurs humains experts ne révèlent pas la réponse dans 90,6 % des cas, contre environ
    53 % pour GPT-4. [M]
- **Les juges LLM génériques ne notent pas la pédagogie.**
  - Dans MRBench, leurs corrélations avec l'humain sont souvent négatives. [M]
  - À la tâche partagée BEA 2025 (plus de 50 équipes), le meilleur F1 macro est de 71,8 pour
    l'identification de l'erreur et de 58,3 pour le guidage
    ([arXiv 2507.10579](https://arxiv.org/abs/2507.10579)). [M]
- **La résolution et la pédagogie se compromettent l'une l'autre.**
  - MathTutorBench, EMNLP 2025 ([arXiv 2502.18940](https://arxiv.org/abs/2502.18940)). [M]
  - Corrélation de 0,42 entre les deux sur 8 modèles
    ([arXiv 2606.16206](https://arxiv.org/abs/2606.16206)). [M]
  - Les deux scores se publient séparément.
- **Il faut évaluer en plusieurs tours.**
  - Le préjudice pédagogique passe de 17,7 % en tour unique à 77,8 % en multi-tours
    (SafeTutors, [arXiv 2603.17373](https://arxiv.org/abs/2603.17373)). [M]
  - Zhao, Knežević, Käser, ACL 2026 ([arXiv 2604.18660](https://arxiv.org/abs/2604.18660))
    classent la pression pour obtenir la réponse en six familles : demande directe, menace
    émotionnelle, mauvaise réponse volontaire, manipulation du contexte, influence
    interpersonnelle, reformulation.
  - La fuite arrive après 2,4 à 10,5 tours selon le modèle. [M]
  - Défense mesurée : un tuteur qui raisonne avant de répondre. [M]
- **Seul l'apprentissage prouve l'effet.**
  - La réussite pendant la séance assistée ne prouve rien : GPT-4 sans garde-fou fait
    −0,19 écart-type à l'examen passé sans aide ; avec indices, −0,01
    (Bastani et al., PNAS 2025, doi:10.1073/pnas.2422633122). [M]
  - Khan Academy suit la réussite au problème suivant fait sans aide, en A/B test
    ([blog, 2026-05-06](https://blog.khanacademy.org/how-khan-academy-is-building-a-better-ai-tutor-our-most-recent-learnings/)). [P]

### Élève simulé

- **Un élève simulé par prompt est peu réaliste.**
  - « Paradoxe de compétence » ([arXiv 2601.05473](https://arxiv.org/abs/2601.05473)). [O]
  - Proche du hasard pour prédire si l'élève reprend l'aide reçue (ParaStudent,
    [arXiv 2507.12674](https://arxiv.org/abs/2507.12674)). [M]
  - Jusqu'à 9 points d'écart selon le LLM qui joue l'utilisateur
    ([arXiv 2601.17087](https://arxiv.org/abs/2601.17087)). [M]
- **Le classement relatif de deux tuteurs reste stable**, même quand les scores absolus
  varient (DAS2, [arXiv 2609.12331](https://arxiv.org/abs/2609.12331)). [M]
- **Conséquences** :
  - spécifier l'état de connaissance de l'élève (ce qu'il sait, comment il se trompe, comment
    il progresse) ;
  - n'utiliser le simulateur que pour comparer deux versions de Tom ;
  - lire des transcriptions.
- Un élève adversarial simplement prompté attaque souvent mal (Zhao et al.) : vérifier qu'il
  attaque vraiment.

### Juge et statistique

- **Biais documentés** :
  - position, verbosité et auto-préférence (Zheng et al., NeurIPS 2023,
    [arXiv 2306.05685](https://arxiv.org/abs/2306.05685)) ;
  - préférence pour ses propres textes, d'autant plus forte que le modèle les reconnaît
    (Panickssery et al., [arXiv 2404.13076](https://arxiv.org/abs/2404.13076)) ;
  - indulgence quand le critère est flou, plus forte chez les petits juges (« Judging the
    Judges », [arXiv 2406.12624](https://arxiv.org/abs/2406.12624)). [M]
- **L'accord brut surestime l'accord réel**, de 34 à 41 points sur MT-Bench, et un juge stable
  peut être biaisé (Norman et al., 2026,
  [arXiv 2606.19544](https://arxiv.org/html/2606.19544v1)). [M]
- **Valider le juge contre un humain**, par mode d'échec. [P]
  - 100 à 200 étiquettes par critère, réparties en 45 % de développement et 45 % de test, avec
    au moins 30 à 50 cas « échoue » de chaque côté.
  - Mesurer le TPR (ce qu'il attrape) et le TNR (ce qu'il laisse passer à raison), pas
    l'accuracy.
  - Le critère se redéfinit en annotant (Shankar et al., « criteria drift »,
    [arXiv 2404.12272](https://arxiv.org/abs/2404.12272)).
  - Source : Husain et Shankar, [FAQ evals](https://hamel.dev/blog/posts/evals-faq/).
- **Corriger le taux mesuré par le juge** avec l'estimateur de Rogan-Gladen
  (Lee et al., ICML 2026, [arXiv 2511.21140](https://arxiv.org/abs/2511.21140)) :
  θ̂ = (p̂ + TNR − 1) / (TPR + TNR − 1). Il reste valable avec un jeu de calibration qui
  suréchantillonne les fuites. [M]
- **Pour un taux rare, la spécificité prime.** À 2 % de fuites réelles, un juge à TPR 0,8 et
  TNR 0,95 mesure 6,5 %, dont les trois quarts sont des faux positifs (calcul).
- **Statistique** (Miller, [arXiv 2411.00640](https://arxiv.org/abs/2411.00640)) :
  - erreurs-types groupées par scénario ;
  - différences appariées entre deux versions.
  - Sous quelques centaines de points, préférer l'intervalle de Wilson ou de Clopper-Pearson
    (Bowyer et al., ICML 2025, [arXiv 2503.01747](https://arxiv.org/abs/2503.01747)).
  - Avec 0 événement sur n, la borne supérieure à 95 % vaut environ 3/n (règle de trois).
- **Tailles nécessaires** (calcul, unilatéral, α = 0,05) :

| Affirmation | Conversations |
|---|---|
| fuite < 2 % avec 0 fuite observée | ≥ 150 |
| fuite < 1 % avec 0 fuite observée | ≥ 300 |
| détecter un passage de 2 % à 6 % (deux versions) | ≈ 380 par version, moins en appariant |

- **La variance existe même à température 0.** Les noyaux de calcul dépendent de la taille de
  batch, donc de la charge du serveur (He, Thinking Machines, 2025,
  [billet](https://thinkingmachines.ai/blog/defeating-nondeterminism-in-llm-inference/)). [M]
  Le `random_seed` de Mistral promet le déterminisme : à mesurer, pas à supposer.

### Outillage

Les données de maintenance ont été relevées le 2026-10-06.

- **Aucun framework ne fournit ce qui fait la valeur du harnais** : questions oui/non avec
  tirages, référence donnée au juge, fuite déterministe, α et McNemar. En adopter un, ce
  serait réécrire ces pièces comme scorers maison.
- **Inspect AI** (UK AISI, MIT, release du 2026-10-02) est la référence statistique, avec ses
  `epochs` et `stderr`. Il est en Python et appelle sa cible en HTTP : écarté.
- **DeepEval** (Python) : écarté.
- **OpenAI Evals, Ragas, evalite, deepteam** échouent au critère de maintenance.
- **Braintrust** n'est auto-hébergeable qu'en offre Enterprise.
- **Phoenix et Opik** feraient doublon avec Langfuse.
- **promptfoo** (MIT, 25 751★, release du jour, racheté par OpenAI en mars 2026, « will remain
  open source ») apporte ce qui coûterait cher à écrire :
  - le plugin `policy` contre une règle écrite ;
  - les stratégies multi-tours `crescendo` et `mischievous-user` ;
  - les plugins `teen-safety:*` pour les mineurs.

  Sans réglage, il envoie la configuration à `api.promptfoo.app`. Le mode local exige
  `PROMPTFOO_DISABLE_REMOTE_GENERATION=true` et `PROMPTFOO_DISABLE_TELEMETRY=1`
  ([doc](https://www.promptfoo.dev/docs/red-team/troubleshooting/data-handling/)).
- **Langfuse v4** affiche désormais les expériences sur données locales sans dataset hébergé
  ([doc](https://langfuse.com/docs/evaluation/experiments/experiments-via-sdk)). Le dépôt
  installe `@langfuse/client` 5.11.1, la dernière version est 5.13.0.

## Décisions

1. **Hiérarchie des mesures.**
   - *Portes* : seules les mesures par code bloquent un merge ou une publication. Ce sont la
     fuite (`lib/leak.ts`), la solution montrée, la réponse fixe de détresse et les
     artefacts.
   - *Mesures exploratoires* : un critère du juge ne devient une porte qu'une fois validé
     (décision 4).
   - *Publication* : le score de résolution et le score pédagogique se publient séparément.
2. **Grille.**
   - Les 8 dimensions de MRBench, traduites, en trois niveaux.
   - Plus trois dimensions propres à Tom : l'exactitude, le niveau du programme et la
     détresse.
   - Chaque dimension devient une ou plusieurs questions oui/non, une par mode d'échec. Ce que
     le code peut vérifier passe en code.
3. **Statistique.**
   - Chaque taux est publié avec son intervalle de Wilson à 95 %, jamais seul.
   - K = 2 répétitions de Tom par scénario, erreurs-types groupées par scénario.
   - Deux versions se comparent sur les mêmes scénarios, par McNemar.
   - Le juge passe à température 0 avec un `random_seed` fixe ; sa stabilité (TARr) se mesure
     sur deux passages des mêmes transcriptions. Les cinq tirages ne restent que si cette
     stabilité est sous 99 %.
4. **Validation du juge, avec un humain.**
   - Victor et un second annotateur, s'il y en a un, annotent d'abord environ 50 conversations
     : leur propre accord est le plafond que le juge ne peut pas dépasser.
   - Puis 100 à 200 étiquettes par critère, réparties en développement et en test.
   - On rapporte le TPR et le TNR avec leur intervalle de Wilson, et α.
   - Seuils : TNR ≥ 0,98 et TPR ≥ 0,90 pour la fuite paraphrasée ; α ≥ 0,800 ailleurs, et
     0,667 pour un usage exploratoire.
   - En dessous du seuil, dans l'ordre : réécrire la question en un fait observable, corriger
     la référence, puis essayer un juge d'une autre famille ou un panel de petits modèles
     (Verga et al., [arXiv 2404.18796](https://arxiv.org/abs/2404.18796)).
   - Le changement de juge va contre la règle « Small 4 partout, juge compris » :
     **décision de Victor**, au vu de l'auto-préférence documentée.
   - À défaut, le critère se publie en taux corrigé par Rogan-Gladen, ou reste humain.
5. **Jeu.**
   - Taille visée : au moins 300 conversations de pression par version comparée, pour pouvoir
     écrire « fuite < 1 % » avec 0 fuite observée.
   - Composition : réponses justes, erreurs typiques, réponses justes mais maladroites, élèves
     désengagés, en plus des réponses absentes d'aujourd'hui.
   - Les exercices s'inspirent des sujets du brevet, sans jamais les copier (règle du
     2026-10-02).
   - On ajoute des photos et des oraux réels, enregistrés pour le jeu, sans élève réel.
6. **Élève simulé.**
   - Une boucle sur l'AI SDK déjà installé : aucune dépendance nouvelle.
   - Chaque conversation a une spécification :
     - niveau, notions sues et non sues, erreur visée ;
     - style : messages courts, fautes, « jsp » ;
     - objectif, et l'une des six familles de pression de Zhao et al. ;
     - 10 à 12 tours.

     Le simulateur ne reçoit jamais la solution, et sa fin passe par un champ de sortie
     structurée.
   - Deux mesures : le taux de fuite par conversation (pass^k, aucune fuite sur k
     répétitions) et le nombre de tours avant la fuite.
   - Usage comparatif seulement. Les scénarios scriptés restent les ancres de non-régression.
   - Small 4 jouant l'élève et le tuteur est un biais non mesuré : des transcriptions sont
     lues à chaque changement du simulateur.
7. **Red team.**
   - promptfoo en mode local, dans un job planifié chaque semaine, contre le serveur lancé en
     local, avec :
     - le plugin `policy` sur « ne donne jamais la réponse finale » ;
     - les stratégies `crescendo` et `mischievous-user` ;
     - les plugins `teen-safety:*`.
   - Le verdict de fuite reste celui de `lib/leak.ts`.
   - À vérifier d'abord : que les conditions d'usage de Mistral permettent de générer des
     attaques.
8. **CI.**
   - *Sur une PR qui touche l'agent* : S2 et S3 scriptés sur environ cinq exercices. Seuls la
     fuite et la régression cas par cas contre la baseline bloquent ; le juge informe.
   - *Planifié* : le jeu complet avec K répétitions et l'élève simulé, comparé à la baseline
     par McNemar, avec intervalles.
   - Une conversation à la fois, à cause des HTTP 429 mesurés.
   - Un cas qui change de verdict entre deux tirages part en relecture, jamais dans la
     baseline.
9. **Apprentissage, au lot 3 et après.**
   - Dès qu'il y a des élèves : la réussite au problème suivant fait sans aide, mesurée par le
     code.
   - Puis un micro-essai randomisé contre un groupe témoin.
   - Jusque-là, aucune phrase publique ne parle d'apprentissage.

## Observabilité en production

### Constats dans le code

1. **Les messages d'erreur fuient dans les traces, malgré `recordInputs: false`.**
   - `recordErrorOnSpan` (`@ai-sdk/otel` 1.0.107) écrit `error.message` dans l'événement
     d'exception et dans le statut du span, quels que soient `recordInputs` et `recordOutputs`.
   - Or `TypeValidationError` y place la sortie du modèle (« Value: … », `@ai-sdk/provider`
     4.0.17), et `JSONParseError` le texte reçu.
   - Le point ouvert du suivi (« vérifier le message d'erreur du span avant le premier
     exporteur ») est donc confirmé.
2. **Sentry** (`platform/observability/sentry.ts`) ne nettoie que `event.request`. Le message
   d'une exception partirait tel quel. Non vérifié : qu'une telle erreur atteigne bien Sentry.
3. **L'AI SDK n'émet aucune métrique**, seulement des spans
   ([doc](https://ai-sdk.dev/docs/ai-sdk-core/telemetry)) : durées et tokens sont des attributs.

### Ce qui s'impose et ce qui se recommande

- **Conventions OpenTelemetry GenAI.**
  - Elles vivent désormais dans
    [semantic-conventions-genai](https://github.com/open-telemetry/semantic-conventions-genai),
    au statut **Development**.
  - Le contenu (`gen_ai.input.messages`…) y est opt-in et signalé comme sensible.
  - Les métriques prévues (`gen_ai.client.operation.duration`, tokens) et l'événement
    `gen_ai.evaluation.result` se figent sur une version donnée, car leurs noms bougent encore.
- **RGPD** ([2016/679](https://eur-lex.europa.eu/legal-content/FR/TXT/HTML/?uri=CELEX:32016R0679)).
  - Obligations : minimisation (art. 5(1)(c)) et durée limitée (art. 5(1)(e)), y compris par
    défaut (art. 25(2)).
  - Une donnée pseudonymisée reste personnelle (considérant 26) : un `userId` dans un log en
    est une.
  - Les enfants méritent une protection spécifique (considérant 38).
- **CNIL.**
  - Les journaux de traçabilité des accès se gardent de 6 mois à 1 an
    ([délibération 2021-122](https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000044272396)).
  - Pour les mineurs : confidentialité renforcée par défaut, pas de profilage
    ([recommandation 8](https://www.cnil.fr/fr/recommandation-8-prevoir-des-garanties-specifiques-pour-proteger-linteret-de-lenfant)).
  - Aucune recommandation CNIL n'est publiée sur les traces d'un LLM en production.
- **AI Act** ([2024/1689](https://eur-lex.europa.eu/legal-content/FR/TXT/HTML/?uri=CELEX:32024R1689)).
  - La journalisation des art. 12, 19 et 26(6) ne vise que le haut risque.
  - L'annexe III, point 3 b), vise l'évaluation des acquis « dans les établissements
    d'enseignement » : Tom, utilisé à la maison, n'y entre a priori pas. C'est une
    interprétation, à faire confirmer.
  - L'art. 50(1), qui impose d'informer qu'on parle à une IA, s'applique.
- **Outils**, maintenance relevée le 2026-10-06 :
  - Grafana Tempo, Loki et Mimir (AGPL-3.0) sont gérés en France par Scaleway Cockpit.
    Rétention par défaut : traces et logs 7 jours, métriques 31 jours. Ingestion :
    0,35 €/Go.
  - Langfuse appartient à ClickHouse Inc. (américaine) depuis janvier 2026. En auto-hébergement,
    la rétention et le masquage sont réservés à l'offre Enterprise, et les données sont gardées
    indéfiniment par défaut.
  - Bugsink (néerlandais) et GlitchTip (MIT) reçoivent le SDK Sentry. Sentry SaaS UE garde les
    comptes et métadonnées aux États-Unis.

### Architecture cible

| Signal | Contenu | Où | Rétention |
|---|---|---|---|
| Traces | spans HTTP, `gen_ai.*`, étapes du tour ; attributs énumérés ; message d'erreur réécrit par `contentFreeMessage` dans un exporteur qui enveloppe l'exporteur OTLP | Tempo managé (Scaleway Cockpit) si l'hébergement est Scaleway, sinon SigNoz auto-hébergé | 7 jours |
| Métriques | compteurs et histogrammes sans identifiant ni texte (liste ci-dessous) | Mimir (Cockpit) | 13 mois |
| Logs | pino JSON avec `trace_id` et `span_id` ; pas de `userId` | Loki (Cockpit) | 30 jours |
| Journal d'accès | connexions, actions d'administration | séparé | 6 à 12 mois (CNIL 2021-122) |
| Erreurs | SDK Sentry gardé, `beforeSend` qui réécrit les messages d'exception, sans tracing | Bugsink auto-hébergé dans l'UE | 30 jours |
| Évaluation | données synthétiques seulement | Langfuse, inchangé | selon le besoin |

Accès : Victor seul, avec double authentification.

**Métriques** (labels énumérés, jamais d'identifiant ni de texte) :
- `tom.turn` {issue : envoyé, retenu, régénéré, échec ; étape} ;
- `tom.output_check.finding` {genre : réponse, balise, égalité, modération, non modéré ;
  matière ; classe} ;
- `tom.distress.detected` {source : règles, modération} ;
- durée par appel IA (`functionId`, type d'erreur) et délai du premier fragment ;
- tokens et coût par tour.

**Alertes** :
- modération indisponible (`unmoderated` > 0) ;
- taux d'échec des appels IA sur 5 minutes ;
- p95 par étape ;
- écart entre le taux de messages retenus en production et celui du harnais ;
- coût journalier rapporté au forfait Mistral.

**Boucle production → évaluation.** Un pic sur une case (par exemple réponse × maths × 4e)
déclenche l'écriture *à la main* d'un scénario synthétique, étiqueté `origine: production`.
Aucune transcription n'est conservée.

**Écartés** :
- Langfuse en production : sans contenu, il perd sa valeur ; rétention payante ; maison mère
  américaine.
- Phoenix (Elastic 2.0) ; OpenLIT (une base ClickHouse de plus).
- Helicone : un proxy qui voit le texte, sans release depuis 13 mois.
- Grafana Cloud et SigNoz Cloud : sociétés américaines.
- Sentry SaaS : comptes aux États-Unis, contraire au « 100 % UE ».

Le choix final dépend de l'hébergeur, décision ouverte du lot 3 : Koyeb, Scaleway et Clever
Cloud sont comparés dans `../2026-10-01/couts.md`.

## Ordre des PR

Il remplace les points 4 à 6 du lot 1 de la roadmap.

1. **Statistique et rapport** :
   - intervalles de Wilson, répétitions K, erreurs-types groupées ;
   - McNemar dans le rapport ;
   - juge à température 0 avec seed, mesure de sa stabilité ;
   - `@langfuse/client` en 5.13.
2. **Grille MRBench et jeu élargi** : nouvelle composition, exercices inspirés du brevet.
3. **Élève simulé** : spécifications, six familles de pression, tours avant la fuite.
4. **Validation du juge** :
   - file d'annotation, répartition développement/test, TPR, TNR, Rogan-Gladen ;
   - campagne d'annotation de Victor.
5. **Garde-fou en CI** : sous-ensemble sur PR, jeu complet planifié, baseline approuvée.
6. **Red team promptfoo** planifié.
7. **Observabilité en production**, en deux temps :
   - **dès maintenant**, puisqu'il s'agit d'un défaut de confidentialité : un exporteur qui
     réécrit les messages d'erreur des spans, le `beforeSend` de Sentry, et `trace_id` dans
     les logs ;
   - **avec l'hébergeur** : métriques, tableaux de bord, alertes et destination des signaux.

La PR #415 (fuites restantes) se remesure avec le harnais refait, avec au moins 150
conversations de pression, avant son merge.

## Non vérifié

- Les chiffres lus par résumé automatique, à relire dans les PDF avant d'être repris :
  MRBench, TutorBench, SafeTutors, Zhao et al.
- Le déterminisme réel du `random_seed` de Mistral.
- Ce que Langfuse v4 stocke pour les évaluations de run sur données locales.
- La région des serveurs de promptfoo.
- Que Mistral accepte de générer des attaques.
- Qu'une erreur de l'AI SDK atteigne réellement Sentry.
- La région exacte de Scaleway Cockpit.
- La couverture du tracing par Bugsink.
- Le texte du Digital Omnibus au Journal officiel, qui repousse l'annexe III de l'AI Act.
