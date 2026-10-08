# Aider sans faire à sa place : les parents, les devoirs et un mode « accompagné » (2026-10-08)

Étude documentaire du 2026-10-08 pour Tom. Question de Victor : l'app doit aussi accompagner les
parents dans les devoirs. Proposition à éprouver : en 6e et 5e, un mode « accompagné » sans interface
enfant séparée (le parent ouvre la séance depuis son espace, à côté de l'enfant ; Tom guide l'enfant
et glisse au parent de courtes pistes) ; à partir de la 4e, le mode « guidé » actuel (l'élève seul,
le parent reçoit un résumé).

**Ce que cette étude ne refait pas.** Le cadre légal, l'IA à l'école, la médiation parentale du
numérique et ce que font les produits IA : `accompagnement-ia.md` (même jour). Les sondages sur les
parents et les devoirs, Kakpo, Rayou et Devoirs faits côté chiffres : `etudes/2026-10-01/parents.md`.
Le modèle des trois modes, les seuils de 15 et 18 ans : `etudes/2026-10-07/foyer-eleve-age.md`.

**Méthode.** Sources cherchées et lues le 2026-10-08. Codes de lecture : **[intégral]** texte complet
lu ; **[résumé]** résumé de l'éditeur ou de la base (PubMed, OpenAlex) ; **[secondaire]** connu par un
compte rendu ou un moteur de recherche, aucune citation n'en est tirée sauf mention. Les citations
entre guillemets sont recopiées de ce qui a été lu, en anglais quand la source l'est. Sites bloqués
pour les robots ce jour : education.gouv.fr, eduscol, le site de l'EEF (Cloudflare), Taylor & Francis,
APA PsycNet, Slate.

## En bref

1. **Au collège, aider davantage aux devoirs ne va pas avec de meilleurs résultats ; aider autrement,
   si.** Trois méta-analyses trouvent une corrélation nulle ou négative entre l'aide aux devoirs et les
   résultats entre 11 et 14 ans (r = −.15 à 0). Les études longitudinales qui mesurent la *façon*
   d'aider trouvent l'inverse selon la forme : l'aide qui soutient l'autonomie va avec des progrès,
   l'aide intrusive avec des reculs, à niveau antérieur égal. L'item type de l'aide intrusive, dans le
   questionnaire le plus cité, est : « My parents sit next to me when I'm doing homework and
   immediately correct any mistakes I make. »
2. **Ce qui aide le plus à cet âge ne demande aucune compétence scolaire** : s'intéresser, parler de
   l'école et de l'avenir, encourager, poser un cadre (heure, lieu). L'EEF conseille de ne pas pousser
   les parents vers un rôle d'enseignant au collège et de renvoyer l'élève qui bloque vers son
   professeur.
3. **Les programmes évalués qui marchent outillent le parent par de courts messages** (essais
   randomisés) : ils l'informent ou lui proposent une action simple, sans lui faire enseigner un
   contenu. Il y a un optimum : trois messages par semaine font mieux qu'un et mieux que cinq.
4. **Un LLM qui coache le parent pendant la séance n'a que deux études**, petites et récentes :
   ParaTutor (23 binômes, enfants de 10 à 12 ans, préprint) et une étude de CMU (10 parents de
   collégiens). Elles montrent des interactions plus riches et moins tendues, pas d'effet sur
   l'apprentissage, et un coût : le parent doit traduire les pistes, ce qui pèse plus sur ceux qui ont
   peu de temps ou peu confiance.
5. **Recommandation** : le mode accompagné tient, à quatre conditions. La frontière reste la 4e. Le
   parent y est un auditeur disponible, pas un correcteur assis à côté. Tom lui donne trois à quatre
   pistes courtes par séance, déclenchées par un événement, jamais plus d'aide que le cran courant de
   l'enfant. Et un soir sans parent ne doit rien coûter à l'enfant : la séance reste possible, sans
   reproche ni compteur.

## 1. L'implication des parents entre 10 et 14 ans

### 1.1 Les méta-analyses

**Hill, N. E., & Tyson, D. F. (2009). « Parental involvement in middle school: A meta-analytic
assessment of the strategies that promote achievement ».** *Developmental Psychology*, 45(3),
740-763. DOI [10.1037/a0015362](https://doi.org/10.1037/a0015362) ;
[PMC2782391](https://pmc.ncbi.nlm.nih.gov/articles/PMC2782391/). **[intégral, lu par extraits]** ;
résumé lu en entier ; un résumé pédagogique HarvardX lu aussi. **Niveau : méta-analyse** de 50 études
(6e-8e année américaines, publiées jusqu'en 2006), surtout corrélationnelles (5 études
d'intervention).
- Résumé : « Across 50 studies, parental involvement was positively associated with achievement, with
  the exception of parental help with homework. Involvement that reflected academic socialization had
  the strongest positive association with achievement. » Et : « strategies reflecting academic
  socialization are most consistent with the developmental stage of early adolescence. »
- Corrélations pondérées : implication générale r = .18 ; à l'école r = .19 ; à la maison r = .03
  (non significatif) ; activités enrichissantes r = .12 ; **socialisation académique r = .39** ;
  **aide aux devoirs r = −.11** [IC −.25 ; −.04].
- La socialisation académique, c'est dire ses attentes, parler de la valeur de l'école, relier les
  cours à l'actualité et aux projets, discuter des façons d'apprendre.
- Explications avancées pour le négatif : « The negative relation may be due to parental interference
  with students' autonomy », « to excessive parental pressure, or to differences in how parents and
  schools present the material », et le sens inverse : « parental engagement in homework is elicited
  by poor school performance ».
- Sur l'âge : « adolescents often indicate that they want their parents' help but do not want their
  parents to visit the school ».

**Patall, E. A., Cooper, H., & Robinson, J. C. (2008). « Parent involvement in homework: A research
synthesis ».** *Review of Educational Research*, 78(4), 1039-1101. DOI
[10.3102/0034654308325185](https://doi.org/10.3102/0034654308325185). **[résumé]** (texte intégral
payant). **Niveau : deux méta-analyses**, l'une d'expériences, l'autre corrélationnelle.
- 14 études qui forment les parents : « training parents to be involved in their child's homework
  results in (a) higher rates of homework completion, (b) fewer homework problems, and (c) possibly,
  improved academic performance among elementary school children ».
- 22 échantillons corrélationnels : « positive associations for elementary school and high school
  students but a negative association for middle school students, (b) a stronger association for
  parent rule-setting compared with other involvement strategies, and (c) a negative association for
  mathematics achievement but a positive association for verbal achievement outcomes ».
- Limite signalée par Xu et al. 2024 : 2 à 5 études seulement au collège et au lycée.

**Barger, M. M., Kim, E. M., Kuncel, N. R., & Pomerantz, E. M. (2019). « The relation between
parents' involvement in children's schooling and children's adjustment: A meta-analysis ».**
*Psychological Bulletin*, 145(9), 855-890. DOI
[10.1037/bul0000201](https://doi.org/10.1037/bul0000201) ; PMID 31305088. **[résumé]**. **Niveau :
méta-analyse**, 448 études, 480 830 familles, implication « naturelle » (non provoquée).
- « small positive associations (rs = .13 to .23) » avec les résultats, l'engagement et la motivation,
  « maintained over time ».
- « The only exception was that parents' homework assistance was negatively associated with
  children's achievement (r = −.15), but not engagement (r = .07) or motivation (r = .05). »
- « There was little variation due to age, ethnicity, or socioeconomic status ».

**Xu, J., Guo, S., Feng, Y., Ma, Y., Zhang, Y., Núñez, J. C., & Fan, H. (2024). « Parental homework
involvement and students' achievement: A three-level meta-analysis ».** *Psicothema*, 36(1), 1-14.
DOI [10.7334/psicothema2023.92](https://doi.org/10.7334/psicothema2023.92) ;
[PDF](https://www.psicothema.com/pdf/4826.pdf). **[intégral]**. **Niveau : méta-analyse** à trois
niveaux, 28 études, 252 effets, 378 222 participants, 1988-2022. La plus récente trouvée sur les
devoirs.
- Effet global « weak negative » (r = −.064). Par forme d'aide : **soutien de l'autonomie r = .164**,
  seul effet positif ; aide au contenu, contrôle, fréquence : non distincts de zéro.
- Par niveau : primaire r = −.142 ; **collège r = −.002** ; lycée r = .017. Contraire de Patall
  2008 ; les auteurs l'expliquent par le petit nombre d'études et par le fait qu'au primaire les
  parents réagissent aux difficultés par plus de contrôle.
- Par parent : négatif pour les mères (r = −.129), nul pour les pères ; les auteurs y voient une
  aide des mères plus souvent déclenchée par les difficultés.
- Conclusion : « parental autonomy support was the only dimension that was positively related to
  students' achievement ».

**Wilder, S. (2014). « Effects of parental involvement on academic achievement: a meta-synthesis ».**
*Educational Review*, 66(3), 377-397. DOI
[10.1080/00131911.2013.780009](https://doi.org/10.1080/00131911.2013.780009). **[résumé]**. **Niveau :
synthèse de 9 méta-analyses.** Relation « strongest if parental involvement was defined as parental
expectations », « weakest if parental involvement was defined as homework assistance », « consistent
across different grade levels and ethnic groups ».

**Cooper, H., Robinson, J. C., & Patall, E. A. (2006). « Does homework improve academic achievement?
A synthesis of research, 1987-2003 ».** *Review of Educational Research*, 76(1), 1-62. DOI
[10.3102/00346543076001001](https://doi.org/10.3102/00346543076001001). **[résumé]**. **Niveau :
synthèse** ; porte sur les devoirs eux-mêmes, pas sur les parents. « generally consistent evidence for
a positive influence of homework on achievement » ; corrélation plus forte « in Grades 7–12 than in
K–6 ». Au collège, les devoirs comptent davantage, ce qui augmente l'enjeu pour les familles.

**Autres méta-analyses récentes repérées.** Erdem & Kaya (2020), *Journal of Learning for
Development*, DOI [10.56059/jl4d.v7i3.417](https://doi.org/10.56059/jl4d.v7i3.417) **[résumé]** :
55 études 2010-2019, effet « positive but small », attentes parentales en tête, « parental control
had a negative and small effect ». Kim (2022), « Fifty years of parental involvement and achievement
research: A second-order meta-analysis », *Educational Research Review*, DOI
[10.1016/j.edurev.2022.100463](https://doi.org/10.1016/j.edurev.2022.100463) : **non lu** (pas de
résumé accessible). Fernández-Alonso et al. (2022), citée par Xu : **non lue**.

### 1.2 La qualité de l'aide : les études longitudinales

**Moroni, S., Dumont, H., Trautwein, U., Niggli, A., & Baeriswyl, F. (2015). « The need to
distinguish between quantity and quality in research on parental involvement: The example of
parental help with homework ».** *The Journal of Educational Research*, 108(5), 417-431. DOI
[10.1080/00220671.2014.901283](https://doi.org/10.1080/00220671.2014.901283) ;
[PDF PHBern](https://phrepo.phbern.ch/1018/). **[intégral]**. **Niveau : longitudinal**, 1 685 élèves
suisses de 5e et 6e année primaire (9,8 ans au premier temps, entrée au secondaire à 12 ans), niveau
antérieur et milieu contrôlés. L'âge de la 6e française.
- « How often parents helped with homework was negatively associated with the development of
  achievement, whereas homework help that was perceived as supportive had positive predictive
  effects, and homework help perceived as intrusive had negative effects. »
- Item d'aide soutenante : « If I struggle with my German homework, my parents try to find out what
  exactly it is I didn't understand ». Item d'aide intrusive : « My parents always interfere when I'm
  doing my homework ».
- La fréquence et l'intrusion sont fortement corrélées : « greater amounts of parental help may be
  perceived as more intrusive by children ».
- Effets « small » après contrôle du niveau antérieur et du milieu (β ≈ .12 à .13 pour l'aide
  soutenante, ≈ −.21 pour l'aide intrusive) ; sans ces contrôles, ils montent jusqu'à .25 et −.34.

**Dumont, H., Trautwein, U., Lüdtke, O., Neumann, M., Niggli, A., & Schnyder, I. (2012). « Does
parental homework involvement mediate the relationship between family background and educational
outcomes? »** *Contemporary Educational Psychology*, 37, 55-69. DOI
[10.1016/j.cedpsych.2011.09.004](https://doi.org/10.1016/j.cedpsych.2011.09.004). **[intégral]**, lu
dans la thèse de H. Dumont (Tübingen, 2012,
[PDF](https://tobias-lib.uni-tuebingen.de/xmlui/handle/10900/47942)), qui reproduit l'article. **Niveau
: longitudinal**, deux échantillons d'élèves de 8e année (N = 1 274 et 1 911).
- « Perceived parental homework interference and perceived homework-related conflict were negatively
  related to students' academic development, whereas perceived parental support and perceived
  parental competence to help with homework were positively related to academic outcomes. »
- « parental homework involvement did not mediate the relationship between family background and
  educational outcomes ».
- Questionnaire (annexe de la thèse) : le **soutien**, c'est « My parents help me with my homework if
  I ask them to », « When I'm doing my homework I can ask my parents for help at any time », « my
  parents carefully listen to how I would solve a problem instead of telling me what to do ». Le
  **contrôle**, c'est « My parents help me with my homework even when I don't need any help », « My
  parents sit next to me when I'm doing homework and immediately correct any mistakes I make », « My
  parents often ask me if they should help me with my homework ».

**Dumont, H., Trautwein, U., Nagy, G., & Nagengast, B. (2014). « Quality of parental homework
involvement: Predictors and reciprocal relations with academic functioning in the reading domain ».**
*Journal of Educational Psychology*, 106(1), 144-161. DOI
[10.1037/a0034100](https://doi.org/10.1037/a0034100). **[résumé]**. **Niveau : longitudinal**, 2 830
élèves suivis de la 5e à la 7e année (voies non académiques).
- « Low academic functioning of students in Grade 5 resulted in more parental control in Grade 7, and
  more parental control in Grade 5 was associated with lower academic functioning in Grade 7. »
  Symétriquement, réactivité et structure vont avec de meilleurs progrès.
- « the quality of parents' help with homework did not depend on their socioeconomic background ».

**Šilinskas, G., & Kikas, E. (2019). « Parental involvement in math homework: Links to children's
performance and motivation ».** *Scandinavian Journal of Educational Research*, 63(1), 17-37. DOI
[10.1080/00313831.2017.1324901](https://doi.org/10.1080/00313831.2017.1324901). **[résumé]**.
**Niveau : longitudinal**, 512 élèves estoniens, perception de l'aide en **6e année**. « low
self-concept in math predicted increased parental control, which in turn related to low math
performance, task persistence, and math self-concept » ; « perceived parental support was related to
increased task persistence during homework ».

**Cooper, H., Lindsay, J. J., & Nye, B. (2000). « Homework in the home: How student, family, and
parenting-style differences relate to the homework process ».** *Contemporary Educational
Psychology*, 25(4), 464-487. **[secondaire]** (résumé relayé par la notice Duke via un moteur).
**Corrélationnel**, 709 parents et élèves de la 2e à la 12e année. Un style qui « encouraged
independent problem solving » va avec de meilleurs résultats ; « Parents in poorer families reported
less support for autonomy and more interference ».

**Pomerantz, E. M., Moorman, E. A., & Litwack, S. D. (2007). « The how, whom, and why of parents'
involvement in children's academic lives: More is not always better ».** *Review of Educational
Research*, 77(3), 373-410. DOI [10.3102/003465430305567](https://doi.org/10.3102/003465430305567).
**[résumé]** ; texte intégral non accessible. **Niveau : revue narrative.** « Evidence is reviewed
indicating that how parents become involved determines in large part the success of their
involvement. It is argued as well that parents' involvement may matter more for some children than
for others. » Une présentation de Pomerantz (diapositives non datées,
[PDF UNL](https://cyfs.unl.edu/cyfsprojects/videoPPT/ca016b597bdcc167684ef6107d579191/iapr-2_Pomerantz.pdf),
**[secondaire]**) range la qualité en quatre axes : autonomie contre contrôle, processus contre
personne, affect positif contre négatif, structuré contre non structuré ; et conclut « Quality
matters, particularly for struggling children ». La liste exacte de l'article de 2007 n'a pas été
vérifiée.

**Pomerantz, E. M., Wang, Q., & Ng, F. F.-Y. (2005). « Mothers' affect in the homework context: The
importance of staying positive ».** *Developmental Psychology*, 41(2), 414-427. **[secondaire]**
(communiqué de l'université de l'Illinois, 14 mars 2005, et notices). **Longitudinal avec journal
quotidien**, 109 mères d'enfants de 8 à 12 ans. L'affect négatif des mères monte les jours où elles
aident davantage ; un climat positif protège la motivation de l'enfant. Confirmé sur des enfants plus
jeunes par **Wu, Barger, Oh & Pomerantz (2022)**, *Child Development*, DOI
[10.1111/cdev.13774](https://doi.org/10.1111/cdev.13774) **[résumé]** : l'implication dans les devoirs
est « more affectively negative » que dans les activités, surtout chez les parents peu confiants ; et
« The more affectively negative parents' involvement […] the poorer children's later math motivation
and achievement ».

**Grolnick, W. S., & Pomerantz, E. M. (2022). « Should parents be involved in their children's
schooling? »** *Theory Into Practice*, 61(3), 325-335. DOI
[10.1080/00405841.2022.2096382](https://doi.org/10.1080/00405841.2022.2096382) ;
[PDF](https://selfdeterminationtheory.org/wp-content/uploads/2025/09/2022_GrolnickPomerantz_ShouldParents.pdf).
**[intégral]**. **Niveau : revue narrative** par les deux auteures de référence.
- « parent involvement can have costs for children when it is controlling and affectively negative,
  which may be most common in the homework context because of the pressure associated with it. »
- Définition utile au produit : « autonomy-supportive homework assistance could include asking
  children how they would solve a problem and then providing hints when children need them »,
  contre « issuing directives on how to solve problems and taking over as soon as children have
  difficulty ».
- Équité : « the kinds of activities that appear to be most beneficial are ones in which virtually
  all parents can engage. […] most parents can ask about school and encourage their children. »
- Sur les conseils aux parents : « promoting ways in which parents should help could introduce a new
  layer of pressure » ; les formuler « as strategies that some parents find useful » ; et
  « teachers can convey to parents that they do not expect parents to be involved in children's
  homework, but they can if they so desire ».
- Le cercle vicieux : les enfants en difficulté reçoivent une aide moins constructive, et « they
  appear to be more sensitive to the negative effects of control ».

**Hoover-Dempsey, K. V., Battiato, A. C., Walker, J. M. T., Reed, R. P., DeJong, J. M., & Jones, K.
P. (2001). « Parental involvement in homework ».** *Educational Psychologist*, 36(3), 195-209. DOI
[10.1207/S15326985EP3603_5](https://doi.org/10.1207/S15326985EP3603_5). **[résumé]**. **Niveau :
revue.** Les parents s'impliquent parce qu'ils « believe that they should be involved, believe that
their involvement will make a positive difference, and perceive that their children or children's
teachers want their involvement » ; l'aide agit « insofar as it supports student attributes related
to achievement (e.g., attitudes about homework, perceptions of personal competence, self-regulatory
skills) ». Le modèle complet (Walker et al. 2005, *Elementary School Journal*) ajoute le temps,
l'énergie et les savoirs du parent : **[secondaire]**.

### 1.3 Le guide de l'EEF

**Education Endowment Foundation, *Working with Parents to Support Children's Learning*, guidance
report, décembre 2018** (auteurs : van Poortvliet, Axford, Lloyd).
[PDF (copie DERA)](https://dera.ioe.ac.uk/id/eprint/32623/1/EEF_Parental_Engagement_Guidance_Report.pdf).
**[intégral]**. **Niveau : synthèse de preuves par un organisme public anglais**, recommandations
pour écoles du primaire et du secondaire.
- « The evidence for what schools can do to effectively engage parents in a way that improves
  children's learning outcomes is limited, particularly for older children. »
- « As children get older, parental encouragement for, and interest in, their children's learning
  are more important than direct involvement. »
- « Support parents to create a regular routine and encourage good homework habits, but be cautious
  about promoting direct parental assistance with homework (particularly for older children). »
- Les parents aident surtout l'autorégulation, « rather than direct involvement in the academic
  content ».
- « Interventions designed to engage parents in homework have generally not been linked to increased
  attainment. […] it may be more effective to encourage parents to redirect struggling pupil to
  their teachers rather than to take on an instructional role. »
- Messages au secondaire : « it is important not to send parents difficult curriculum-related content
  that they do not know how to respond to. 'Can you talk to your child about thermal decomposition?'
  is too hard to access ».
- « Talk to parents who are less involved about what support they would find helpful. »

La fiche « Parental engagement » du *Teaching and Learning Toolkit* n'a pas pu être lue (Cloudflare) ;
un extrait de moteur la donne à « +4 months », « Moderate impact for very low cost based on extensive
evidence » **[secondaire]**.

### 1.4 Ce qui change à l'entrée au collège

- **Le contexte.** Plusieurs professeurs, moins de contact entre parents et école, et « academic
  performance often declines, while at the same time the long-term implications of academic
  performance increase » (Hill & Tyson, résumé). Les devoirs eux-mêmes pèsent plus (Cooper et al.
  2006).
- **Le besoin d'autonomie.** Les élèves veulent de l'aide mais pas une présence envahissante (Hill &
  Tyson) ; l'aide pertinente devient indirecte : parler des buts, des stratégies, de l'avenir.
- **La compétence du parent.** L'EEF note que les parents n'ont pas toujours « the knowledge and
  skills to provide the right support, particularly at secondary level » ; en France, plus de la
  moitié des mères sans diplôme disent manquer de connaissances (Rayou, § 2).
- **Le signe de l'aide directe.** Négatif au collège pour Patall 2008 et Hill & Tyson, nul pour Xu
  2024, peu modulé par l'âge pour Barger 2019. Aucune source ne situe une rupture à 13 ans : les
  méta-analyses traitent la 6e-8e année comme un bloc.
- **Les parents instruits** consacrent le plus de temps à l'organisation (« management ») quand
  l'enfant a 6 à 13 ans (Kalil, Ryan & Corey 2012, *Demography*, DOI
  [10.1007/s13524-012-0129-5](https://doi.org/10.1007/s13524-012-0129-5), **[résumé]**, données
  américaines d'emploi du temps).

## 2. France : les devoirs et les familles

Les chiffres de sondage (41 % des parents « dépassés par les programmes », 23 % pour qui aider est
« source de dispute ») et les fiches Kakpo et Rayou sont déjà dans `etudes/2026-10-01/parents.md`.
Ce qui s'ajoute :

**Kakpo, S. (2012). *Les devoirs à la maison. Mobilisation et désorientation des familles
populaires*.** PUF, coll. « Éducation et société ». **Livre non lu** (Cairn refuse) ; comptes rendus
de Benamar (*Insaniyat*, n° 60-61, 2013,
[page](https://insaniyat.crasc.dz/en/article/severine-kakpo-les-devoirs-a-la-maison-mobilisation-et-desorientation-des-familles-populaires-education-et-societe-paris-puf-2012-224-p))
et synthèse de la circonscription de Toul
([PDF](https://sites.ac-nancy-metz.fr/dsden54-circo/ientoul/sites/ientoul/IMG/pdf/devoirs_colombey.pdf))
lus. **Niveau : ethnographie (qualitatif).**
- Les familles populaires sont, selon le compte rendu, « désorientées par l'évolution des codes
  scolaires » plutôt que démobilisées.
- Elles tiennent aux devoirs : utiles, « fenêtre ouverte » sur la classe, moyen de contrôler le
  travail de l'enfant et de structurer son temps (synthèse de Toul).
- Elles prescrivent souvent du travail « en plus », avec des méthodes que l'école n'attend pas.
- Externaliser le travail personnel accentue les inégalités ; le ramener à l'école « n'est pas en soi
  un gage de réduction de l'échec scolaire » (synthèse de Toul).
- Un article de Kakpo porte exactement sur la question : « Familles populaires. L'accompagnement
  familial du travail scolaire à l'épreuve de l'entrée au collège », *Cahiers pédagogiques*, 2009
  ([notice HAL](https://univ-paris8.hal.science/hal-01084373v1)). **Texte introuvable en ligne.**

**Rayou, P. (dir.) (2010). *Faire ses devoirs. Enjeux cognitifs et sociaux d'une pratique
ordinaire*.** PUR. **[secondaire]**, compte rendu de F. Giraud, *Lectures*, 17 mars 2010
([page](https://journals.openedition.org/lectures/988)). **Qualitatif**, éducation prioritaire et
milieux favorisés, surtout primaire. L'école suppose une « continuité culturelle largement démentie
par les faits » (Rayou, p. 91, cité) ; Kakpo y qualifie les devoirs de « source profonde
d'inéquité » (p. 127, cité) ; les interventions familiales renforcent souvent les difficultés au lieu
de les résoudre (paraphrase du compte rendu).

**Kakpo, S., & Netter, J. (2013). « L'aide aux devoirs. Dispositif de lutte contre l'échec scolaire ou
caisse de résonance des difficultés non résolues au sein de la classe ? »** *Revue française de
pédagogie*. [HAL](https://hal.science/hal-01468595). **[résumé]**. **Qualitatif.** Les tensions venues
de la classe (« faible maîtrise des notions, opacité des consignes ») se cumulent ; les intervenants
développent des « stratégies de survie dont le bénéfice pour les élèves n'est pas toujours évident ».

**Avvisati, F., Gurgand, M., Guyon, N., & Maurin, É. (2014). « Getting parents involved: A field
experiment in deprived schools ».** *The Review of Economic Studies*, 81(1), 57-83. DOI
[10.1093/restud/rdt027](https://doi.org/10.1093/restud/rdt027). **[résumé]**. **Niveau : essai
randomisé**, académie de Créteil, parents d'élèves de **6e** (« La mallette des parents »).
- Trois réunions parents-école sur la façon de s'impliquer : « treated families have increased their
  school-and home-based involvement activities ».
- Les élèves des classes traitées ont un meilleur comportement (absentéisme, sanctions ; « effects-size
  around 15% of a standard deviation »).
- « However, test scores did not improve under the intervention. »
- La seule preuve causale française trouvée sur l'implication des parents au collège : elle change
  les pratiques et le comportement, pas les notes.

**Devoirs faits.** Obligatoire pour tous les élèves de 6e depuis la rentrée 2023 (arrêté du 7 avril
2023, note de service du 13 avril 2023, cités par l'académie de Lille,
[PDF](https://devoirs-faits.site.ac-lille.fr/wp-content/uploads/sites/68/2023/09/2Discours_Cadre_Institutionnel.pdf)
**[intégral]**). Rapport des inspections générales n° 2019-055 (juillet 2019, 73 collèges) connu par
l'[OZP](https://www.ozp.fr/spip.php?article24616=) **[secondaire]** : « volontariat spontané […]
faible », familles peu informées, effets impossibles à apprécier faute de participation régulière.
**Aucune évaluation d'effet sur les résultats n'a été trouvée.** Le ministère écrivait en 2017 qu'une
évaluation scientifique n'était pas envisageable pour un dispositif généralisé (question
parlementaire, **[secondaire]**). Pour Tom, c'est le relais naturel quand une notion résiste.

**L'interdiction des devoirs écrits à l'école élémentaire** (circulaires de 1956 et 1994, abrogées en
2009 sans texte de remplacement ; IGEN, rapport 2008-086) est vérifiée dans `foyer-eleve-age.md` § 3.
Elle explique que la 6e soit, pour beaucoup de familles, le premier vrai face-à-face avec des devoirs
écrits réguliers.

**Ce que vivent les parents peu diplômés, en résumé.** Ils sont mobilisés, attachés aux devoirs, et
désorientés par des méthodes qu'ils ne reconnaissent pas (Kakpo). Ils se sentent souvent manquer de
connaissances (Rayou). Le sentiment d'être dépassé est le même chez les CSP+ et les CSP− ; l'écart
porte sur ce qu'on en fait, par exemple payer des cours (`parents.md`). **Ce qui les aide**, selon les
preuves disponibles : un rôle qui ne demande pas de maîtriser le contenu (encourager, cadrer, faire
expliquer ; § 1), une information simple et régulière venue de l'école (§ 4), un relais quand ça
résiste (professeur, Devoirs faits). Aucune étude française ne mesure l'effet d'un outil qui guide le
parent pendant les devoirs.

**Non trouvé ou non vérifié.** Aucune publication du CNESCO consacrée aux devoirs. La note DEPP 23.32
(disputes autour des devoirs, aide selon le diplôme), citée par `parents.md`, n'a pas pu être relue
(site bloqué). Le chiffre « 95 % des mères aident jusqu'à l'entrée en sixième », attribué à l'Insee
par deux amendements parlementaires de 2013, n'a pas été retrouvé à la source.

## 3. Le co-usage parent-enfant d'un outil numérique ou d'une IA

**Takeuchi, L., & Stevens, R. (2011). *The New Coviewing: Designing for Learning through Joint Media
Engagement*.** Joan Ganz Cooney Center at Sesame Workshop et LIFE Center.
[PDF](https://joanganzcooneycenter.org/wp-content/uploads/2011/12/jgc_coviewing_desktop.pdf).
**[intégral]** pour la revue, les conditions et les principes. **Niveau : revue et études de cas
qualitatives, principes de conception d'experts** ; centré sur les jeunes enfants.
- Conditions d'un co-usage productif : « Mutual engagement », « Dialogic inquiry », « Co-creation »,
  « Boundary crossing », « Intention to develop », « Focus on content, not control » (« Language such
  as "Don't touch!" or "Wait, not yet." are kept to a minimum »).
- Obstacles : « Parents are too busy to sit down with their children around media, or simply
  absent » ; « Available parents may be unaware of their child's learning needs […] or […] may not be
  versed in how to guide their children using media ».
- Principes : « Differentiation of roles » ; « Scaffolds to scaffold: […] Provide guidance for the
  more capable partner in ways that don't require a lot of prior prep or extra time […] In certain
  situations, however, explicit scaffolds can turn the situation into something perceived as
  pedagogical […] Subtler cues will suffice » ; « Fit: […] it should easily slot into existing
  routines, parent work schedules ».

**Berkowitz, T., Schaeffer, M. W., Maloney, E. A., et al. (2015). « Math at home adds up to
achievement in school ».** *Science*, 350(6257), 196-198. DOI
[10.1126/science.aac7427](https://doi.org/10.1126/science.aac7427). **[résumé]**. **Niveau : essai
randomisé**, 587 élèves de CP américains. Une app de courts problèmes que parent et enfant font
ensemble « significantly increased children's math achievement across the school year compared to a
reading (control) group, especially for children whose parents are habitually anxious about math ».
Le cas le plus solide d'une app qui structure l'échange parent-enfant ; âge très éloigné du collège.

**Luo, L., Wang, A., Zhou, M., Zhu, J., Cai, J., Yu, A., & Pan, H. (2026). « ParaTutor: Coordinating
Parent-Child Math Tutoring through Role-Separated LLM Scaffolding ».** arXiv
[2606.18030](https://arxiv.org/abs/2606.18030) v2. **[intégral]**. **Niveau : préprint, étude
intra-sujets** (quatre conditions, carré latin), 23 binômes, **enfants de 10 à 12 ans**, Chine, parents
majoritairement diplômés du supérieur et déjà impliqués. La plus proche de la proposition de Victor.
- Étude préalable : le tutorat parental échoue par « cognitive misalignment, emotional escalation, and
  method mismatch ». Un parent : « My child still prefers the method taught by the teacher, which
  sometimes I find difficult to accept. »
- Le LLM généraliste (DeepSeek) « often provided useful explanations but did not consistently support
  parent-led tutoring or children's active reasoning ».
- ParaTutor donne au parent quatre types de pistes : stratégie (33 %), langage (31 %), réparation
  (19 %), étape (17 %), surtout au moment des blocages (312 moments codés). Exemples : « Before
  explaining, ask him: what have you already figured out, and what part is still uncertain? If he can
  name the stuck point, give only one hint rather than the full step. » ; réparation : « Let's check
  this part again », « That is okay, let's try another way ».
- Les parents ont repris la piste telle quelle 27 % du temps, l'ont reformulée 53 %, l'ont ignorée ou
  différée 20 % : « I did not read every sentence to him. I looked at the suggestion […] and then said
  it in my own way. »
- Les enfants ont plus raisonné (15,5 à 16,8 tours contre 8,6 sans IA) et posé plus de questions.
- Une mère : « Now that my child is in adolescence, she often finds me annoying. But with the system,
  things feel less tense. »
- Limites écrites par les auteurs : « parent-facing scaffolding may be less effective for families
  where parents have limited time, low confidence, or limited patience for tutoring » ; « short-term
  interactional changes rather than long-term learning outcomes » ; latence gênante.

**Venugopalan, D., Yan, Z., Borchers, C., Lin, J., & Aleven, V. (2025). « Combining Large Language
Models with Tutoring System Intelligence: A Case Study in Caregiver Homework Support ».** LAK '25
(ACM). DOI [10.1145/3706468.3706516](https://doi.org/10.1145/3706468.3706516) ; arXiv
[2412.11995](https://arxiv.org/abs/2412.11995). **[intégral]** (version arXiv). **Niveau : étude de
conception qualitative**, 10 parents de **collégiens** américains (équations) ; parent et enfant dans
des pièces séparées.
- Les parents préfèrent les suggestions sur le contenu, utiles quand ils ont peur de mal faire : « sometimes
  you get frustrated when you don't know the right things to say […] you might say the wrong thing. »
- Ils apprécient les questions qui font expliquer l'enfant : « Walk me through it and can you explain
  to me what you did here. »
- Les encouragements génériques sont jugés « just filler » ; « Glad you're focused just seems
  artificial to me. »
- « Six out of nine caregivers found the messages to be too long » ; trois suggestions à la fois
  jugées suffisantes par huit sur neuf.

**Li, Y., Xie, J., et al. (2025). « "Learning Together": AI-Mediated Support for Parental Involvement
in Everyday Learning ».** arXiv [2510.20123](https://arxiv.org/abs/2510.20123). **[résumé et
introduction]**. **Préprint, terrain d'une semaine, 11 familles chinoises.** Le LLM répartit les
tâches entre les adultes de la famille ; tensions relevées : « uneven workloads », « parental
gatekeeping ».

**Luo, L., Liang, Y., et al. (2026). « Characterizing LLM-Based Family Education through the Lens of
Activity Theory: A Scoping Review of the HCI Literature ».** arXiv
[2609.28886](https://arxiv.org/abs/2609.28886). **[résumé et extraits]**. **Revue de portée**, 53
études. 14 seulement concernent les 12-14 ans. « Evidence across families and educational purposes
remains limited, especially on sustained personalization, repair labour » ; « Verification and repair
labor remains weakly documented. Parents were expected to review generated content, adapt
recommendations, or retain final decisions ».

**Beneteau, E., et al. (2020). « Parenting with Alexa ».** CHI 2020. DOI
[10.1145/3313831.3376344](https://doi.org/10.1145/3313831.3376344). **[résumé]**. **Qualitatif**, 10
familles, quatre semaines. L'enceinte vocale « fostering communication, disrupting access, and
augmenting parenting », avec des conflits occasionnels.

**Repérés, non lus** : Quan, Du & Lyu, « Parents, Children, and ChatGPT in Home Environments »,
CHI EA 2025, DOI [10.1145/3706599.3719969](https://doi.org/10.1145/3706599.3719969) (pas de résumé
accessible) ; Nguyen, Borchers, Xia & Aleven, ICLS 2024, outils pour parents de collégiens dans un
tuteur de maths.

**Ce qu'on sait du co-usage, en résumé.** Les effets mesurés viennent d'enfants jeunes (Berkowitz,
lecture dialoguée). Pour les 10-14 ans devant un tuteur IA, deux études montrent des interactions
meilleures et moins tendues quand le parent reçoit des pistes séparées de celles de l'enfant ; aucune
ne mesure l'apprentissage ni la durée. Les conditions qui reviennent : rôles distincts, pistes
courtes, déclenchées par les blocages, que le parent peut reformuler ou ignorer, et un outil qui
s'insère dans la soirée réelle.

## 4. Guider le parent qui aide : programmes évalués

**Par messages, les essais randomisés.**
- **York, B. N., Loeb, S., & Doss, C. (2019). « One step at a time: The effects of an early literacy
  text-messaging program for parents of preschoolers ».** *Journal of Human Resources*, 54(3),
  537-566, DOI [10.3368/jhr.54.3.0517-8756r](https://doi.org/10.3368/jhr.54.3.0517-8756r) ; document de travail NBER [w20659](https://doi.org/10.3386/w20659) **[résumé]**. **Essai
  randomisé**, READY4K!, huit mois. Constat de départ : « Many parenting programs place significant
  demands on parents' time and inundate parents with information. » Effet : implication « by 0.15 to
  0.29 standard deviations », littératie de l'enfant « about 0.11 standard deviations ». Préscolaire.
- **Cortes, K. E., Fricke, H., Loeb, S., Song, D., & York, B. N. (2021). « Too little or too much?
  Actionable advice in an early-childhood text messaging experiment ».** *Education Finance and
  Policy*, 16(2), 209-232. DOI [10.1162/edfp_a_00304](https://doi.org/10.1162/edfp_a_00304) **[résumé]**.
  **Essai randomisé.** « A single text per week is not as effective at improving parenting practices
  as a set of three texts that also include information and encouragement, but a set of five texts
  with additional actionable advice is also not as effective as the three-text approach. » Pour les
  enfants du quart le plus faible, un seul conseil fait « 0.19 standard deviations » de moins que
  trois messages.
- **Mayer, S. E., Kalil, A., Oreopoulos, P., & Gallegos, S. (2019). « Using behavioral insights to
  increase parental engagement: The Parents and Children Together intervention ».** *Journal of Human
  Resources*, 54(4), 900-925, DOI [10.3368/jhr.54.4.0617.8835r](https://doi.org/10.3368/jhr.54.4.0617.8835r) ; NBER [w21602](https://doi.org/10.3386/w21602) **[résumé]**. **Essai randomisé**,
  préscolaire défavorisé. Rappels, objectifs, reconnaissance sociale : usage de l'app de lecture
  « by one standard deviation » ; effet « much greater for parents who are more present-oriented ».
- **Bergman, P. (2021). « Parent-child information frictions and human capital investment: Evidence
  from a field experiment ».** *Journal of Political Economy*, 129(1), 286-322. DOI
  [10.1086/711410](https://doi.org/10.1086/711410) **[résumé]**. **Essai randomisé**, collège et
  lycée. Information tous les quinze jours sur les devoirs non rendus : « Parents have upwardly biased
  beliefs about their child's effort. Providing information attenuates this bias and improves student
  achievement. »
- **Bergman, P., & Chan, E. W. (2021). « Leveraging parents through low-cost technology ».** *Journal
  of Human Resources*, 56(1), 125-158, DOI [10.3368/jhr.56.1.1118-9837r1](https://doi.org/10.3368/jhr.56.1.1118-9837r1). **[secondaire]** (résumé relayé). **Essai randomisé**, collège
  et lycée : alertes hebdomadaires automatiques, échecs aux cours en baisse d'environ 27 à 28 %,
  présence en hausse de 12 %, **aucun effet sur les tests d'État**.
- **Kraft, M. A., & Rogers, T. (2015). « The underutilized potential of teacher-to-parent
  communication: Evidence from a field experiment ».** *Economics of Education Review*, 47, 49-63. DOI
  [10.1016/j.econedurev.2015.04.001](https://doi.org/10.1016/j.econedurev.2015.04.001).
  **[secondaire]**. **Essai randomisé**, 435 lycéens en rattrapage : un message hebdomadaire d'une
  phrase du professeur ; échec à valider le cours de 15,8 % à 9,3 % ; les messages sur ce que l'élève
  peut améliorer font mieux que les messages positifs.
- **Texting Parents** (Miller et al., EEF 2016), lu dans le guide EEF, encadré 4 **[intégral pour
  l'encadré]** : 15 000 élèves du secondaire anglais, 30 messages sur l'année (dates de contrôle,
  devoirs rendus, ce qui est étudié), « one month's additional progress in maths », et des parents
  « nearly three times more likely […] to talk to their child about revising for an upcoming test ».
- **Berlinski, Busso, Dinkelman & Martínez (2021)**, NBER
  [w28581](https://doi.org/10.3386/w28581) **[résumé]**. **Essai randomisé**, écoles pauvres du Chili :
  notes, présence et comportement par SMS ; maths « by 0.09 of a standard deviation », effets plus
  forts pour les élèves à risque.

**Les devoirs interactifs (TIPS).**
- **Van Voorhis, F. L. (2003). « Interactive homework in middle school: Effects on family involvement
  and science achievement ».** *The Journal of Educational Research*, 96(6), 323-338. DOI
  [10.1080/00220670309596616](https://doi.org/10.1080/00220670309596616) **[résumé]**.
  **Quasi-expérimental**, 253 élèves de 6e et 8e année, 18 semaines : plus d'implication familiale,
  devoirs plus justes, « significantly higher science report card grades ».
- **Van Voorhis (2011)**, *Education and Urban Society*, 43(3), 313-338, DOI
  [10.1177/0013124510380236](https://doi.org/10.1177/0013124510380236) **[résumé]**.
  **Quasi-expérimental**, 153 élèves du primaire, 70 % éligibles à la cantine gratuite : plus
  d'implication, émotions plus positives, meilleurs scores en maths.
- Principe, d'après les ressources de l'Ohio **[secondaire]** : les parents ne sont pas chargés
  d'« enseigner » la matière ; l'élève parle avec un partenaire familial de ce qu'il apprend.

**Former les parents à l'aide aux devoirs.** Patall et al. 2008 (14 études, surtout primaire) : plus
de devoirs faits, moins de problèmes, effet sur les résultats incertain. L'EEF : « generally not been
linked to increased attainment ».

**Ce que font ces programmes, en résumé.** Ceux qui marchent envoient peu de messages, courts, liés
à l'enfant, actionnables sans savoir scolaire : informer (devoirs non rendus, contrôle à venir) ou
proposer une conversation. Leurs effets sont modestes et portent d'abord sur l'engagement,
l'assiduité et les échecs, rarement sur les tests. Aucun ne coache le parent *pendant* les devoirs ;
c'est le terrain de ParaTutor et de Venugopalan, sans mesure d'effet.

## 5. Risques et comment la recherche les évite

| Risque | Ce que dit la recherche | Ce qui l'évite |
|---|---|---|
| **Le parent fait à la place** | L'aide « non invitée » va avec un recul, d'autant plus chez l'enfant qui croit l'intelligence figée : Park et al. 2023, *Developmental Psychology*, DOI [10.1037/dev0001522](https://doi.org/10.1037/dev0001522), **[résumé]**, longitudinal, 1 613 collégiens et lycéens : « when parents monitor, check, and assist in completing homework without an invitation, their children's motivation and academic achievement often decline ». L'aide intrusive (Moroni ; Dumont) | Une aide à la demande de l'enfant ; écouter comment il résoudrait avant de dire quoi faire (items de soutien de Dumont) ; ne jamais donner au parent la solution |
| **Les conflits** | Le conflit autour des devoirs prédit de moins bons progrès (Dumont 2012) ; contrôle et conflit forment un cercle avec les difficultés (Dumont 2014 ; Šilinskas & Kikas 2019) | Un climat positif (Pomerantz 2005) ; des phrases de réparation (« on regarde cette étape ensemble ») qui ont détendu les échanges dans ParaTutor |
| **La pression rend contrôlant** | Expérience : des mères mises sous pression (« ego-involving ») sont plus contrôlantes, et les enfants réussissent moins bien seuls ensuite (Grolnick et al. 2002, *Developmental Psychology*, DOI [10.1037/0012-1649.38.1.143](https://doi.org/10.1037/0012-1649.38.1.143), **[résumé]**, 60 binômes, CE2) | Ne pas présenter l'aide du parent comme attendue ; formuler les conseils comme « ce que certains parents trouvent utile » (Grolnick & Pomerantz 2022) |
| **L'anxiété du parent se transmet** | Les enfants de parents anxieux en maths apprennent moins, « but only if math-anxious parents report providing frequent help with math homework » (Maloney et al. 2015, *Psychological Science*, DOI [10.1177/0956797615592630](https://doi.org/10.1177/0956797615592630), **[résumé]**, CP-CE1). À l'inverse, une app structurée profite surtout à ces familles (Berkowitz 2015) | Ne pas demander au parent d'expliquer le contenu ; lui donner une activité cadrée |
| **L'enfant n'ose pas se tromper devant son parent** | Aucune étude directe trouvée. Indices : les parents qui voient l'échec comme débilitant se centrent sur la performance, et leurs enfants croient l'intelligence figée (Haimovitz & Dweck 2016, *Psychological Science*, DOI [10.1177/0956797616639727](https://doi.org/10.1177/0956797616639727), **[résumé]**, dont une étude expérimentale) ; l'aide intrusive « fosters failure for low-achieving children » au jour le jour (Pomerantz & Eaton 2001, *Developmental Psychology*, DOI [10.1037/0012-1649.37.2.174](https://doi.org/10.1037/0012-1649.37.2.174), **[résumé]**) | Dire aux deux que l'erreur fait partie du travail ; des pistes sur le processus, pas sur la note ; laisser l'enfant demander à chercher seul |
| **Charge et temps, inégaux** | La relation aide-résultats est négative pour les mères, nulle pour les pères (Xu 2024) ; les mères instruites consacrent plus de temps à l'organisation entre 6 et 13 ans (Kalil 2012) ; les familles pauvres soutiennent moins l'autonomie (Cooper 2000). ParaTutor : moins efficace quand le parent a peu de temps ou de confiance. Côté France, `parents.md` : manque de temps 27 %, disputes plus fréquentes chez les parents seuls | Des formes d'aide accessibles à tous (s'intéresser, encourager) ; peu de messages ; aucune présence exigée |
| **Creuser l'écart** | Les outils comportementaux profitent davantage à certains profils (Mayer 2019) ; un seul conseil hebdomadaire nuit aux enfants les plus faibles (Cortes 2021) ; l'EEF met en garde contre les stratégies qui creusent l'écart **[secondaire]** | Mesurer qui utilise le mode et qui en profite, par profil de famille ; demander aux parents peu impliqués ce qui les aiderait (EEF) |

## 6. Synthèse

### (a) Ce qui est établi

1. **Entre 10 et 14 ans, la quantité d'aide aux devoirs ne prédit pas de meilleurs résultats** :
   corrélation de −.15 à 0 selon les méta-analyses (Hill & Tyson 2009 ; Barger et al. 2019 ; Xu et
   al. 2024 ; Wilder 2014). Corrélationnel, et en partie inversé : l'aide suit les difficultés
   (Pomerantz & Eaton 2001 ; Dumont 2014).
2. **La qualité tranche** : l'aide qui soutient l'autonomie va avec des progrès, l'aide intrusive et
   le conflit avec des reculs, à niveau antérieur égal (Moroni 2015, élèves de l'âge de la 6e ; Dumont
   2012, 2014 ; Šilinskas & Kikas 2019 ; Xu 2024, r = .16 pour l'autonomie). L'affect négatif du
   parent nuit (Pomerantz 2005 ; Wu 2022).
3. **Ce qui aide le plus à cet âge ne demande pas de savoir scolaire** : socialisation académique
   (r = .39, Hill & Tyson), intérêt et encouragement (EEF ; Grolnick & Pomerantz 2022), cadre et
   routine (Patall 2008 ; Dumont 2014 ; EEF).
4. **Mettre un parent sous pression le rend plus contrôlant** (Grolnick et al. 2002, expérimental).
5. **De courts messages aux parents changent leurs pratiques et, modestement, l'assiduité et les
   échecs** (essais de York, Cortes, Bergman, Kraft & Rogers, EEF, Berlinski) ; en France, des
   réunions avec les parents de 6e améliorent l'implication et le comportement, pas les notes
   (Avvisati 2014). Trop de messages ou trop peu font moins bien (Cortes 2021).

### (b) Ce qui est incertain

- **Qu'un parent assis à côté d'un enfant qui travaille avec un tuteur IA aide plutôt qu'il ne
  gêne.** Deux études seulement (ParaTutor, 23 binômes, préprint ; Venugopalan, 10 parents), aucune
  mesure d'apprentissage ni de durée ; échantillons diplômés et volontaires.
- **La bonne fréquence des pistes pendant une séance** : rien de mesuré ; les chiffres de Cortes
  portent sur des SMS hebdomadaires à des parents d'enfants de 4 ans.
- **Si les 11-12 ans acceptent le parent à côté soir après soir**, et s'ils osent se tromper devant
  lui : aucune étude directe.
- **L'effet sur les inégalités** : le mode pourrait profiter surtout aux parents disponibles et
  confiants (ParaTutor, limites ; Mayer 2019).
- **Le seuil.** Aucune étude ne situe à 13 ans ni en 4e une rupture dans l'effet de l'implication
  parentale. Le seuil vient d'ailleurs : cadre du ministère (usage en classe, encadré par l'enseignant, à partir de la 4e), UNESCO
  (13 ans), décision du 2026-10-07 (le mode suit le niveau).
- **La France** : preuves surtout qualitatives (Kakpo, Rayou) ; effets de Devoirs faits inconnus ;
  livre de Kakpo et article de 2009 non lus.

### (c) Recommandation sur le mode accompagné

Ma position : **le mode accompagné en 6e-5e est défendable**, parce que la présence du parent répond
au ministère et, les soirs où il est là, à l'UNESCO, sans envoyer les conversations au parent ; un
soir seul reste un écart à la recommandation de l'UNESCO pour les moins de 13 ans. Mais **la forme
proposée, « le parent à côté », est exactement l'item d'aide intrusive le mieux documenté** si rien ne
la cadre. Le mode tient seulement si Tom fait du parent un auditeur disponible, pas un correcteur, et
si un soir sans parent ne coûte rien à l'enfant.

**1. La frontière : la 4e, par le niveau, sans exception d'âge.**
- La recherche sur l'implication parentale ne donne pas de seuil (Barger : peu de variation avec
  l'âge ; Hill & Tyson : la 6e-8e année forme un bloc). Le seuil doit donc venir du cadre de l'IA : le
  ministère autorise l'usage de l'IA par les élèves en classe, encadré par l'enseignant, à partir
  de la 4e, avec la formation Pix
  (`accompagnement-ia.md` § 1.4), et la 4e coïncide avec les 13 ans de l'UNESCO.
- Garder le niveau plutôt que l'âge, comme le décide déjà `decisions.md` (2026-10-07) : une même
  règle pour toute la classe, et une seule information à déclarer.
- Au passage en 4e, prévenir l'enfant et le parent, comme toute transition.
- **À décider par Victor** : ce mode modifie le périmètre V1 (« mode guidé » de la 6e à la 3e) et la
  décision du 2026-10-07 ; il entre dans `decisions.md` s'il est retenu.

**2. Ce que fait le parent pendant la séance.**
- **Au début, une minute.** Le parent lance la séance ; l'enfant lui dit avec ses mots ce que demande
  l'exercice. C'est le principe des devoirs interactifs TIPS (l'élève explique, le parent écoute ;
  Van Voorhis 2003, 6e-8e année) et de la socialisation académique (Hill & Tyson).
- **Pendant.** L'enfant tient l'appareil et écrit. Le parent reste disponible, à portée de voix ; il
  intervient quand l'enfant le demande ou quand Tom le lui propose. Il ne corrige pas au fil de l'eau.
  Sources : items de soutien et de contrôle de Dumont 2012 ; aide « non invitée » de Park 2023 ;
  « asking children how they would solve a problem and then providing hints when children need them »
  (Grolnick & Pomerantz 2022).
- **Il peut partir et revenir.** La présence se gradue d'elle-même au fil de l'année : c'est la
  progression vers l'autonomie que la recherche recommande (Hill & Tyson ; EU Kids Online, dans
  `accompagnement-ia.md` § 3.1).
- **À la fin.** L'enfant réexplique en une phrase comment il a fait ; le parent salue l'effort et la
  démarche, pas la note. Sources : métacognition préférée par les parents (Venugopalan 2025) ; « faire
  réexpliquer » (Common Sense, `accompagnement-ia.md` § 4.1) ; Haimovitz & Dweck 2016 sur l'échec.

**3. Les pistes que Tom donne au parent.**
- **Quatre types**, adaptés de ParaTutor (stratégie, langage, réparation, étape) : le langage y
  devient le rôle, dit au lancement ; puis la stratégie, la réparation, l'étape.
- **Exemples de formulations**, en vouvoiement, sans jargon (EEF, « thermal decomposition »),
  20 mots au plus (Venugopalan : messages trop longs) :
  - Début : « Ce soir, votre rôle : écouter et poser des questions. Les explications, c'est Tom. »
  - Blocage : « Demandez-lui ce qu'il a déjà trouvé, et où ça coince. Pas besoin de connaître la
    réponse. »
  - Réparation : « Une erreur ici, c'est normal. Dites plutôt : « on regarde cette étape
    ensemble ». »
  - Étape : « Avant de calculer, demandez-lui de redire la question avec ses mots. »
  - Fin : « Demandez-lui de vous réexpliquer en une phrase comment il a fait. »
  - Quand une notion résiste : « Ce point résiste encore. Il peut le noter pour son professeur, ou
    pour Devoirs faits demain. » (EEF : renvoyer vers l'enseignant ; Devoirs faits obligatoire en
    6e.)
- **Déclenchées par un événement, pas par le temps** : le lancement, un blocage (Tom monte d'un cran,
  ou deux « je sais pas » de suite, règle déjà décidée), une frustration repérée, la fin. Rien quand
  tout va bien : un échafaudage trop visible rend la séance scolaire (Takeuchi & Stevens 2011).
- **Fréquence : une à la fois, trois ou quatre par séance au plus.** C'est une proposition, pas une
  mesure : les seuls repères sont Venugopalan (trois suggestions à la fois suffisent) et ParaTutor
  (pistes concentrées aux blocages, ignorées une fois sur cinq).
- **Jamais plus que le cran courant de l'enfant, garanti par le serveur.** Si le parent demande
  « comment je l'aide ? », il reçoit au plus l'indice que Tom donnerait à l'enfant à ce moment, jamais
  la solution. C'est le principe 1 de la vision ; le harnais teste déjà « je suis son parent ».
- **Visibles par l'enfant**, puisqu'il est à côté et que l'élève voit ce que voit son parent
  (principe 3) : les écrire pour qu'un enfant de 11 ans puisse les lire sans se sentir jugé.
- **Formulées comme des propositions** (« certains parents trouvent utile de… »), pas des consignes
  (Grolnick & Pomerantz 2022 : un conseil peut ajouter de la pression).

**4. Quand le parent n'est pas disponible un soir.**
- **La séance reste possible.** Au lancement, deux choix : « Je reste à côté » ou « Il travaille seul
  ce soir ». Seul, Tom tutore exactement de la même façon, puisque tous les garde-fous sont dans le
  serveur ; il n'y a simplement pas de pistes pour le parent.
- **À la fin, Tom donne à l'enfant une phrase à dire à son parent plus tard** (« Ce soir, j'ai
  travaillé sur… »). Cela prolonge la séance dans la famille (« boundary crossing », Takeuchi &
  Stevens) sans rien exiger.
- **Aucun reproche, aucun compteur** des soirs sans parent, ni dans l'app ni dans le résumé. Raisons :
  ne pas attendre l'implication des parents (Grolnick & Pomerantz 2022) ; la pression rend contrôlant
  (Grolnick 2002) ; la surveillance abîme la confiance (`accompagnement-ia.md` § 3.2).
- **L'appareil.** Si le seul appareil du soir est le téléphone de l'enfant ou une tablette partagée,
  « sans interface enfant séparée » prive l'enfant de séance les soirs où le parent travaille. Je
  recommande de garder, dès la 6e, la possibilité de relier l'appareil de l'enfant par un code,
  désactivée par défaut et activée par le parent. Sinon, le mode exclut les familles que la vision veut
  servir (`vision.md`, « Pour qui »). **À décider par Victor.**

**5. Ne pas pénaliser les familles qui ont peu de temps ou se sentent démunies.**
- **Rien ne demande de connaître le contenu.** Les pistes portent sur la démarche ; c'est aussi la
  forme d'aide la mieux soutenue à cet âge (Hill & Tyson ; EEF ; Grolnick & Pomerantz : « virtually
  all parents can engage »).
- **Rien ne demande d'être présent.** Le résumé de la semaine est le même pour toutes les familles ;
  la présence n'ouvre aucun avantage pédagogique dans Tom.
- **Peu de texte, aucun guide à lire avant.** Les pistes s'apprennent en les utilisant : dans
  ParaTutor, elles sont devenues une routine en quelques problèmes. Un texte seul aide peu
  (`accompagnement-ia.md` § 2.4).
- **Un relais vers l'école** quand ça résiste : professeur, Devoirs faits (EEF ; Avvisati 2014 pour
  le lien école-famille).
- **Mesurer en bêta**, sans nouvelle donnée sur l'enfant : la part des séances « à côté » et « seul »
  selon les familles, les pistes suivies ou ignorées, les séances interrompues ; demander aux parents
  peu présents ce qui les aiderait (EEF). Si le mode accompagné ne sert que les familles déjà
  disponibles, le revoir.
- **Questions ouvertes** : les parents qui lisent mal le français (pistes lues à voix haute par Tom ?)
  ; les fratries sur un même appareil ; le second parent, qui peut aussi lancer une séance.

## 7. Introuvable ou non lu

- Pomerantz, Moorman & Litwack 2007, Patall et al. 2008, Cooper et al. 2006 : résumés seulement.
- Eccles et al. 1993, « stage-environment fit », *American Psychologist* : pas de résumé accessible.
- Kim 2022 (méta-analyse de second ordre), Fernández-Alonso et al. 2022 : non lus.
- Fiche « Parental engagement » de l'EEF : bloquée ; chiffres connus par un moteur seulement.
- Kakpo 2012 (livre) et Kakpo 2009 (*Cahiers pédagogiques*) : non lus ; DEPP NI 23.32 et pages
  Devoirs faits du ministère : sites bloqués ; rapport IGEN 2019-055 connu par l'OZP.
- Chiffre Insee « 95 % des mères aident jusqu'à l'entrée en sixième » : source introuvable.
- Aucune publication du CNESCO sur les devoirs ; aucune évaluation d'effet de Devoirs faits.
- Aucune étude sur un enfant qui évite de se tromper devant son parent pendant un tutorat IA.
