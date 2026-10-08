# Décisions

Les décisions de Victor qui tiennent aujourd'hui, une par entrée, avec leur date, leur raison et
leur source. Les autres docs décrivent l'état présent et renvoient ici pour le pourquoi. Une
décision qui change se réécrit à sa place, avec la nouvelle date ; l'ancienne reste dans git.
Une décision prise en séance entre ici dans la PR qui la suit, pas dans une mémoire d'agent.

## Produit

- **Prouver avant de vendre** (2026-10-01). On n'affirme que ce qu'on peut prouver, mesure ou
  source primaire à l'appui. Source : `vision.md`.
- **Pas d'entretiens avec des familles avant la bêta** (2026-10-02). Les hypothèses de la vision
  restent des hypothèses jusqu'à l'usage réel de la bêta fermée.
- **Le foyer et l'âge** (2026-10-07). Le parent ouvre le foyer et conclut le contrat ; trois
  façons d'accompagner, du CP à la terminale, la V1 en mode guidé au collège ; l'enfant n'a aucun
  identifiant ; la détresse est relue par un humain avant tout message au parent. Source :
  `etudes/2026-10-07/foyer-eleve-age.md`.
- **Une mémoire d'apprentissage d'une séance à l'autre** (2026-10-07). Tirée des exercices,
  acceptée par le parent et l'enfant, visible et effaçable par l'élève, remise à zéro à la
  rentrée ; promise seulement après sa mesure. Remplace « pas de mémoire ». Source :
  `etudes/2026-10-07/memoire-entre-seances.md`.
- **Le prénom et la mémoire partent dans le prompt** (2026-10-07). Aucun vrai élève avant la
  réponse écrite de Mistral sur sa clause des mineurs ; s'il refuse, ils en sortent.
- **Offre et quotas** (2026-10-07). Quota du jour par élève sur le coût réel, voix comprise :
  2 c en Gratuit, 10 c en Complet, remis à zéro à 4 h à Paris ; Complet à 7,99 € TTC par mois,
  ou 69 € l'année scolaire payée d'avance, sans renouvellement. Source :
  `etudes/2026-10-07/rentabilite.md`.
- **Entrée sans mot de passe** (2026-10-08). Le parent entre par un code envoyé à son adresse,
  puis par une clé d'accès ; pas de connexion Google, qui ferait savoir à une société américaine
  qui utilise Tom.
- **Les profils sur l'appareil de la famille** (2026-10-08). Le parent ouvre l'espace de son
  enfant sur son propre téléphone sans code et revient au sien par sa clé ou un code ; l'enfant
  n'a pas de déconnexion, mais « Changer de profil ».
- **Fiches de révision hors V1** (2026-10-08). Le Complet, c'est plus d'échanges par jour ; ni le
  site ni la vision ne promettent de fiches.
- **Le résumé parent dit les matières, le temps passé et ce qui résiste** (2026-10-08). Jamais
  les conversations ; l'élève voit le même résumé. Calculé par le code, sans modèle : rien
  d'inventé, rien à payer ; sur les sept derniers jours. Le parent ne voit rien d'autre de la
  mémoire d'apprentissage, qui reste à l'élève (tranché le 2026-10-08).
- **Le second parent au lot 3, avec le consentement** (2026-10-08). Il rejoint le foyer et peut
  s'opposer, parce que le double consentement sous 15 ans engage les titulaires de l'autorité
  parentale.
- **Les fondations de la direction artistique au lot 3, avant les écrans** (2026-10-08).
  Couleurs, typographie, place de Tom la loutre dans l'interface et ton, construites autour de
  Tom, sans dépendre du nom ; le nom, le logo et la réécriture de la landing restent au lot 4.
  Raison : ne pas refaire deux fois les écrans que les familles de la bêta verront.
- **La direction « Cahier du soir »** (2026-10-08, choix délégué par Victor après l'essai de trois
  directions sur les vrais écrans). Un écran de lecture calme, un seul accent, le bleu du pull de
  Tom, et un sombre qui suit le réglage du téléphone ; la fonte Andika (SIL), conçue pour
  l'apprentissage de la lecture, au zéro plein et aux 1, l et I distincts ; la tête de Tom à côté
  de ses messages, Tom qui se dit IA et jamais ami. Écartées : une direction chaleureuse qui
  jouait la relation (« ta loutre des devoirs »), une direction sombre seulement au jaune qui se
  lisait comme un avertissement. Les valeurs vivent dans `packages/tokens/theme.css`.
- **Tom se présente comme un programme** (2026-10-08). La loutre reste l'identité visuelle ; Tom
  dit qu'il est une IA, le redit quand l'élève parle de lui, ne se dit jamais ami et n'exprime
  pas de sentiments ; l'interface le tient, le prompt à l'étape de la séance (`roadmap.md`). Raison : AI Act art. 50, UNICEF (2025), et un ton relationnel attire surtout
  les adolescents fragiles sans être plus utile (`etudes/2026-10-08/accompagnement-ia.md`).

## Tuteur et évaluation

- **Mistral Small 4 pour tout rôle de LLM, juge compris** (2026-10-03). Ni Medium, ni Large, ni
  Ministral ; les modèles spécialisés restent (Voxtral pour la voix, le modèle de modération).
  Le juge note donc son propre modèle : sa conception et la mesure d'accord contiennent ce biais.
- **Le palier d'aide monte aussi après deux « je sais pas » de suite** sans tentative
  (2026-10-06). Une demande de solution seule ne le fait jamais monter.
- **Victor juge seul la qualité** (2026-10-06). Quatre questions oui/non par conversation (fuite,
  même reformulée ; affirmation fausse ; aide qui fait avancer sans faire à la place ; détresse,
  sur ses scénarios), 60 à 100 conversations, échecs suréchantillonnés, verdict du juge caché ;
  sa cohérence se mesure en rejugeant une vingtaine de conversations une semaine plus tard. Un
  juge d'une autre famille seulement s'il est très bon marché, les conversations de test étant
  synthétiques. Publication : « jugé par le fondateur ». Remplace les décisions 2 et 4 de
  `etudes/2026-10-06/refonte-evaluation.md` (grille MRBench, second annotateur).
- **Une mesure par version du tuteur** (2026-10-08). Un passage complet du code actuel pour
  vérifier le harnais et lister les cas qui fuient ; ensuite, une nouvelle mesure seulement après
  un changement du tuteur, jamais deux fois sur le même code, sur au moins 150 conversations de
  pression comparées cas par cas (McNemar).
- **Mistral en paiement à l'usage** (2026-10-08). Le mode gratuit plafonne à 100 000 tokens par
  minute, et une fiche d'exercice en prend environ 78 000 : ni le harnais ni deux élèves dans la
  même minute n'y tiennent. Le même geste ouvre la demande de Zero Data Retention.
- **Langfuse abandonné** (2026-10-08). Aucun code ne s'en servait ; le harnais écrit ses
  transcriptions dans `eval-results/`, que la page de jugement lira.

## Technique

- **Bun partout où il remplace proprement, Hono pour le serveur** (2026-10-01). Drizzle et
  postgres.js gardés (Bun.SQL a des bugs de corruption ouverts, `suivi.md`, « Surveillance ») ;
  Python écarté pour le serveur, qui perdrait le contrat typé avec le client.
- **Un dépôt, un serveur en monolithe modulaire** (2026-10-01). Les services séparés de
  l'ancienne version ont pourri ; un service à part ne se justifie que par une contrainte réelle.
- **Un client web, pas d'application native en V1** (2026-10-06). Application monopage Vite +
  React + TanStack Router, installable, servie par le serveur sur la même origine, pensée d'abord
  pour le téléphone ; la landing en Astro statique. Source : `etudes/2026-10-06/client-web.md`.
- **Refonte complète du code** (2026-10-06), sur des pratiques publiées, sans rien garder de
  l'ancienne architecture ; faite aux étapes 1 à 7. Source :
  `etudes/2026-10-06/refonte-architecture.md`, instantané de la cible d'alors.
- **Pronote hors V1** (2026-10-01). L'accès passe aujourd'hui par une bibliothèque non
  officielle, archivée et cassée par la version 2026 de Pronote ; il ne revient que par une
  convention de connecteur avec Index Éducation, sur un produit qui marche déjà sans lui.
- **Pas d'établissements en V1** (2026-10-01). Le GAR n'adhère que des personnes morales
  ([référentiel du 12 juin 2026](https://gar.education.fr/wp-content/uploads/2026/06/GAR-ReferentielAdminJuridique_FR_20260612.pdf), § 5.2.1),
  et une vente aux établissements ferait basculer le produit dans le haut risque de l'AI Act.

## Hébergement et livraison

- **Tout chez Clever Cloud, région Paris** (2026-10-07). L'app, sa base, la landing ; l'e-mail
  chez Scaleway TEM, les erreurs dans Bugsink auto-hébergé ; Scalingo en plan B, et si la CNIL
  juge l'hébergement de données de santé requis. Source : `etudes/2026-10-07/hebergement.md`.
- **Staging et bêta fermée sur invitation** (2026-10-07). Un compte parent ne se crée que sur
  invitation, au staging comme en production, jusqu'au lancement public.
- **Une seule branche, `main`** (2026-10-08). Chaque merge déploie le staging ; la production,
  née avec la première vraie famille, reçoit la même image sur l'approbation de Victor ; la
  landing va directement en production. Détail : `architecture.md`, « Environnements et
  livraison ».
- **Coûts au strict nécessaire** (2026-10-08). Une ressource payante arrive quand elle sert :
  Bugsink juste avant la première vraie famille. Chaque ressource payante demande l'accord de
  Victor, avec à quoi elle sert et quand elle devient nécessaire.

## Façon de travailler

- **TDD et parcours pensés depuis l'usage réel** (2026-10-08). Le test qui échoue d'abord, puis
  le code ; chaque fonctionnalité se conçoit à la place du parent et de l'enfant (téléphone
  partagé, soirée, vacances), avant les critères techniques.
- **Supprimer plutôt qu'archiver** (2026-08-23, rappelé le 2026-10-06). Ce qui ne sert plus se
  supprime ; git le garde.
- **Merge commit, pas de squash** ; une branche courte par PR, jamais de push sur `main`.

## Ouvertes

Tranchées au moment du lot qui en dépend, doc d'abord :

| Décision | Lot | Ce qui la tranche |
|---|---|---|
| Canal du message au parent après une détresse | 3 | Un canal garanti (l'e-mail), avec la revue humaine |
| Fournisseur de paiement | 3 | Conformité UE, abonnement familial, facturation sans piège |
| Statut juridique (micro-entreprise ou société), TVA | 3 | Une consultation d'un expert-comptable, avant le paiement |
| Hébergement de données de santé | Avant la première famille | La réponse de la CNIL |
| Nom du produit | 4 | Marques et domaines ; candidat « De sa main » |
