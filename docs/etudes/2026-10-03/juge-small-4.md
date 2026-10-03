# Juge Small 4 en questions oui/non — 2026-10-03

Première mesure du juge refondu (`etudes/2026-10-03/refonte-harnais.md`, décisions 1 à 3) :
Mistral Small 4 (`mistral-small-2603`), prompt `2026-10-03.5`, chaque critère en questions
oui/non (`apps/server/src/eval/checks.ts`), cinq tirages par question à température 0,7,
verdict à la majorité. Instantané daté, jamais mis à jour.

## Protocole

- Mêmes 38 transcriptions et mêmes notes de l'annotateur que la première mesure
  (`accord-juge.md`) : annotation par Claude, pas par un humain.
- Les notes du juge se recalculent sur les échelles de la grille à partir des réponses aux
  questions ; l'annotateur, lui, avait noté avec les ancres du juge précédent. Les deux ne
  mesurent donc pas tout à fait la même définition.
- 3 jugements sur 38 échouent : citations introuvables sur `hints-one-step` (deux fois) et
  `s4-helps`. La mesure porte sur 35.
- Données : `apps/server/src/eval/agreement/2026-10-03/results.agreement-small-4.json`.

## Résultats

Accord avec l'annotation, comparé au juge Medium 3.5 de la première mesure :

| Critère | Accord brut, Medium | Accord brut, Small 4 | α, Small 4 |
|---|---|---|---|
| help_diagnosis | 0,556 | 0,296 | 0,039 |
| help_one_question | 0,370 | 0,889 | −0,039 |
| help_graded_hints | 0,852 | 0,556 | 0,564 |
| help_accuracy | 0,778 | 0,926 | −0,019 |
| help_level | 0,815 | 1,000 | non défini |
| help_tone | 0,889 | 0,926 | −0,019 |
| language_level | 0,852 | 0,667 | −0,176 |
| safety, S4 | 1,000 | 0,200 | 0,375 |
| safety, S5 | 0,667 | 0,333 | −0,250 |

Alignement et fuite rédigée restent sans variation (accord brut 1,000, α non défini).
Aucun critère n'atteint α ≥ 0,800.

Questions qui signalent un défaut, part des conversations où la majorité des tirages
répond oui : méthode déroulée (`hints-unrolls`) 2 sur 27, quand l'annotateur en voit 9 et
que le juge Medium en voyait 9 ; erreur de fond (`accuracy`) 0 sur 27, contre 2 pour
l'annotateur ; plusieurs questions à la fois (`one-question`) 0 sur 27, contre 3 ;
notation d'une classe suivante (`level`) 0 sur 27.

## Lecture

- **Le juge Small 4 ne voit presque pas les défauts de son propre modèle.** Les questions
  qui doivent signaler un défaut ne se déclenchent presque jamais, là où l'annotateur et
  le juge Medium en trouvaient. C'est le biais annoncé par l'étude : un juge marque plus
  souvent « satisfait » les sorties de son propre modèle (Pombal, Rei, Martins, 2026,
  [arXiv 2604.06996](https://arxiv.org/abs/2604.06996)). L'accord brut monte là où ce
  biais rejoint l'annotateur (presque tout est « bien » des deux côtés) et baisse là où
  l'annotateur voit des défauts.
- **Des questions mal posées** : `hints-one-step` demande si « chaque message » n'apporte
  qu'une étape ; un « oui » ne se prouve pas par une citation, d'où les citations
  introuvables. `s5-leaves-exercise` demande de prouver une absence. Les tirages se
  partagent (deux ou trois « oui » sur cinq) dans 14 à 22 conversations sur 27 pour le
  diagnostic, `hints-one-step` et le niveau de langue : ces questions restent ambiguës
  pour Small 4.
- **Ce que la refonte a réglé** : le cache sert 96 % de l'entrée (72 720 tokens sur 75 555
  sur une conversation de S3), contre 14 % avec un schéma par critère ; les appels restent
  sous les limites du compte (100 requêtes et 100 000 tokens par minute, lues dans les
  en-têtes `x-ratelimit-*`). Le coût d'une conversation est d'environ 0,25 centime de
  dollar ; la limite de débit, pas le prix, borne la taille d'une passe.
- **Ce que la mesure ne permet pas de dire** : l'annotateur est un modèle et notait avec
  d'autres définitions ; 35 conversations sans contre-exemples ne mesurent ni la
  sensibilité du juge ni sa spécificité.

## Suite

1. Mesurer la sensibilité du juge sur des cas construits : une réplique modifiée par
   contrôle (méthode déroulée, erreur de fond, deux questions, notion d'une classe
   suivante, texte prêt à recopier), où la bonne réponse est connue par construction. Un
   contrôle qui ne détecte pas ses cas construits ne sert pas de métrique.
2. Reformuler les questions universelles et celles qui prouvent une absence en questions
   de présence (« un message apporte-t-il plusieurs étapes d'un coup ? »).
3. Annoter avec les questions du juge, pour mesurer l'accord question par question ; une
   part annotée par un humain.
4. Pour les défauts que Small 4 ne voit pas sur lui-même, préférer un contrôle
   déterministe quand il existe (la fuite l'est déjà).
