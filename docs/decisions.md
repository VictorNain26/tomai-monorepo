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
- **Le foyer et l'âge** (2026-10-07, revu le 2026-10-08). Le parent ouvre le foyer et conclut le
  contrat ; trois façons d'accompagner, du CP à la terminale, le mode suivant le niveau ; la V1 au
  collège, en mode accompagné en 6e et 5e, guidé en 4e et 3e ; l'enfant n'a aucun identifiant ; la
  détresse est relue par un humain avant tout message au parent. Source :
  `etudes/2026-10-07/foyer-eleve-age.md`.
- **Un seul âge, compté au mois** (2026-10-17, Victor). Seul le mois de naissance est gardé ; un
  seul calcul de l'âge sert aux bornes d'inscription, côté serveur et web, et au consentement de
  la mémoire, compté pour ne jamais vieillir un enfant : `apps/server/src/domain/student-age.ts`.
- **La classe redemandée à la rentrée, sans mettre personne en difficulté** (2026-10-17, Victor).
  L'âge et la classe restent indépendants : un redoublement, une avance ou un parcours adapté ne
  bloquent rien. La classe ne passe jamais seule à la suivante ; à la rentrée, le parent seul voit
  « En quelle classe est Léa cette année ? », les classes sans aucune présélectionnée, jamais le
  mot redoublement, et peut répondre plus tard. Rien n'est gardé de la classe d'avant, ni montré à
  l'enfant, ni dit à Tom : il ne connaît que la classe de l'année.
- **Le mode accompagné en 6e et 5e** (2026-10-08). Le découpage des modes devient : accompagné
  du CP à la 5e, guidé en 4e et 3e, autonome au lycée (l'étude du 2026-10-07 plaçait la 6e et la
  5e en guidé). Avant la 4e, pas d'appareil propre à l'enfant : le parent lance la séance sur
  l'appareil de la famille, qui passe au profil de l'enfant (« Les profils sur l'appareil de la
  famille »), où l'enfant choisit « Avec mon parent à côté » ou « Sans mon parent ce soir » ; le
  profil reste ouvert
  pour les soirs suivants, et revenir au parent demande sa clé ou un code. À côté, le parent écoute
  et reste disponible, il ne corrige pas au fil de l'eau ; Tom lui propose quelques pistes de vingt
  mots au plus, visibles de l'enfant, jamais plus d'aide que le cran de l'enfant, ce que le
  serveur garantit (le mécanisme : `tuteur.md`, § 8). Seul, l'enfant a le même Tom, sans pistes ;
  aucun compteur ni reproche des soirs sans parent. Le jumelage d'un appareil à l'enfant ouvre en 4e. Raisons : l'école ne fait utiliser
  l'IA générative aux élèves, en classe et encadrée par l'enseignant, qu'à partir de la 4e ; au
  collège, l'aide aux devoirs qui laisse chercher va avec des progrès, l'aide intrusive avec des
  reculs. Écart assumé : l'UNESCO recommande 13 ans pour converser seul avec une IA générative, et
  un soir seul, un élève de 6e le fait, sur le choix de son parent, avec un Tom tenu par le serveur.
  Sur l'appareil de la famille, les séances restent dans le profil de l'enfant, que le parent peut
  ouvrir : l'enfant le sait dès son accueil. Source : `etudes/2026-10-08/aide-parentale.md`. À revoir
  en bêta si le mode ne sert que les familles déjà disponibles, ou si des familles n'ont pas
  d'appareil commun le soir.
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
- **Les profils sur l'appareil de la famille** (2026-10-08, précisé le 2026-10-12). En 6e et 5e,
  le parent ouvre l'espace de son enfant sur son propre téléphone sans code et revient au sien
  par sa clé ou un code ; l'enfant n'a pas de déconnexion, mais « Changer de profil ». À partir
  de la 4e, l'espace de l'enfant ne s'ouvre sur aucun appareil du parent : un appareil de la
  famille se relie par un code, comme les autres, et paraît dans la liste de l'enfant (choix de
  Victor le 2026-10-12, la vision réservant cette ouverture à la 6e et à la 5e).
- **Fiches de révision hors V1** (2026-10-08). Le Complet, c'est plus d'échanges par jour ; ni le
  site ni la vision ne promettent de fiches.
- **Le parent a un tableau de bord, jamais les conversations** (2026-10-08, élargi le
  2026-10-12). Par enfant : le temps jour par jour et semaine après semaine, les matières, les
  notions du programme travaillées, qui résistent ou ont cédé, une question à poser tournée vers
  sa façon de chercher, la prochaine étape ; le même contenu en point hebdomadaire par e-mail, que
  le parent coupe d'un clic. Jamais les conversations, qui restent à l'enfant, ni un taux de
  réussite, ni une comparaison entre enfants ; la mémoire d'apprentissage reste à l'élève.
  L'élève voit ce que voit son parent. Calculé par le code, sans modèle, depuis les séances et
  les exercices : rien d'inventé, rien de nouveau collecté. Raisons : informer le parent de ce
  qu'il peut faire a un effet mesuré, la surveillance nuit à l'adolescent. Remplace « le résumé
  des sept derniers jours, le parent ne voit rien d'autre ». Source :
  `etudes/2026-10-12/refonte-produit.md`.
- **Le second parent avec le consentement** (2026-10-08, au lot 1 depuis le 2026-10-12). Il rejoint le foyer et peut
  s'opposer, parce que le double consentement sous 15 ans engage les titulaires de l'autorité
  parentale.
- **L'identité et l'app d'abord, Tom ensuite** (2026-10-11). Le nom, la direction artistique et
  sa charte, puis le site et l'app ensemble, dans l'ordre de `roadmap.md`, avant le travail sur le tuteur (harnais,
  fuites, voix, mémoire mesurée). Raisons : le tuteur attend le paiement à l'usage de Mistral
  pour être mesuré ; les écrans et le site avancent sans lui ; refaire l'identité après les
  écrans les ferait refaire deux fois. Aucun élève réel avant que Tom soit mesuré : l'ordre ne
  change pas la porte. Remplace « les fondations de la direction artistique au lot 3, le nom et
  la landing au lot 4 » (2026-10-08). Source : `roadmap.md`.
- **Le produit s'appelle « Catiche »** (2026-10-11, choix de Victor, sur le domaine .fr). Le gîte
  de la loutre : le produit est le lieu, Tom le tuteur qui s'y trouve, jamais un compagnon qui y
  attend l'enfant. Aucune marque en classes 9, 41 et 42, catiche.fr et catiche.app libres ce
  jour-là ; réserves : le suffixe « -iche » en 3e, @catiche pris sur Instagram et TikTok. Avant
  toute communication : la recherche de similarité INPI, le dépôt, les domaines. Aucun nom ne se
  bâtit sur Tom (marque TOM, FR 4873204). Remplace TomIA, puis « De sa main », que Victor n'a pas
  gardé. Source : `etudes/2026-10-11/nom-seconde-etude.md`.
- **La refonte du produit** (2026-10-12, à la demande de Victor : « pas un vrai design », ni
  harmonisé avec le site, ni de vraies pages d'entrée et de vrais tableaux de bord). Le soin
  devient un principe (`vision.md`, principe 7) ; le site et l'app ont une seule identité et se
  refont ensemble, le site menant à l'app par « Se connecter » ; l'entrée, le tableau de bord du
  parent et l'espace de l'élève (ses séances, « Mon programme ») se construisent comme décrits
  dans `experience.md`, composés au téléphone et à l'ordinateur, avec des onglets ; Tom en 2D au
  trait dans l'app, la 3D sur le site. Les anciens lots 1 à 3 deviennent un lot, « Le produit »
  (`roadmap.md`) ; ce qui est construit depuis le 2026-10-11 garde ses flux, ses tests et sa sécurité, et
  seul son habillage se refait. Remplace « une refonte complète de l'interface » et « la landing
  réécrite avec l'identité » (2026-10-11), et l'ancien plan de l'interface (« peu de
  destinations », « une action principale par écran », « Tom ailleurs, rien »), supprimé (git le
  garde). Source : `etudes/2026-10-12/refonte-produit.md`.
- **La direction « Rive », pour le site et l'app** (2026-10-12, choix de Victor parmi trois
  directions essayées dans le vrai code sur le haut du site, la connexion et le tableau de bord du
  parent, au téléphone et à l'ordinateur, en clair et en sombre :
  [comparatif](https://claude.ai/artifact/JrKtG7Zd48J7BE9irjoVrY)). La catiche au bord de l'eau :
  brume, eau profonde, jonc, pelage ; Bricolage Grotesque pour les titres, Atkinson Hyperlegible
  Next pour le texte ; l'arche, l'entrée du gîte, en signature, seulement derrière Tom sur le haut
  du site et à l'entrée de l'app (Victor n'en voulait pas partout). Raisons : aucune direction de
  la catégorie n'est bleu-vert, le nom y prend son sens, rien d'enfantin pour un élève de 4e, et le
  pull bleu de Tom ressort. Écartées : « Copie » (le site actuel rendu adulte : son stylo rouge
  évoque la correction et la note) et « Veilleuse » (nuit indigo et ambre, empattement). La
  composition des écrans essayés n'est pas retenue : elle se refait sur la charte complète. Remplace
  « Grands carreaux » (2026-10-11). Sources : `charte.md`, `etudes/2026-10-12/bonnes-pratiques.md`,
  `etudes/2026-10-11/direction-artistique.md` pour la catégorie.
- **Les tokens Rive sur le site dès l'étape 2.1** (2026-10-12, choix de Victor). Le site prend les
  couleurs et les fontes de Rive en même temps que l'app, en ligne sur sa composition actuelle
  jusqu'à sa refonte (étape 3) ; `landing.css`, Nunito et Caveat partent, la note manuscrite
  devient une note en pelage, et le site gagne le mode sombre de la charte, qu'il n'avait pas. Les échelles de douze pas viennent de Leonardo
  (`@adobe/leonardo-contrast-colors`), à des contrastes cibles sur le fond, plutôt que des échelles
  toutes faites de Radix, qui ne tombent pas sur les couleurs de la charte.
- **Des formules, pas de schémas, dans la séance** (2026-10-08, choix délégué par Victor). Le
  texte de Tom est rendu en Markdown et ses formules en MathML (KaTeX) ; ni HTML, ni lien, ni
  image venus du modèle. Pas de schémas Mermaid : lourds sur téléphone, et refusés par la CSP ;
  le prompt ne les annonce plus. À reprendre si la bêta montre qu'ils manquent.
- **Tom se présente comme un programme** (2026-10-08). La loutre reste l'identité visuelle ; Tom
  dit qu'il est une IA, le redit quand l'élève parle de lui, ne se dit jamais ami et n'exprime
  pas de sentiments ; l'interface le tient, le prompt au lot 4 (`roadmap.md`). Raison : AI Act art. 50, UNICEF (2025), et un ton relationnel attire surtout
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
- **Mistral en paiement à l'usage, au lot 4** (2026-10-08, reporté par Victor le 2026-10-11).
  Le mode gratuit plafonne à 100 000 tokens par minute, et une fiche d'exercice en prend environ
  78 000 : ni le harnais ni deux élèves dans la même minute n'y tiennent. Le même geste ouvre la
  demande de Zero Data Retention. Le lot 1 n'en a pas besoin.
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
- **`@repo/ui` sur Base UI** (2026-10-12, choix de Victor). Une seule famille de primitives
  interactives, toasts compris : Base UI (`@base-ui/react`), à la place de Radix et de `sonner`,
  pour garder la CSP stricte, sans exception pour les styles. Son dialogue verrouille le défilement
  par `element.style`, que la CSP ne bloque pas
  ([MDN, style-src](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/style-src)) ;
  il n'écrit une balise `<style>` que pour ScrollArea et Select (`utils/styles.js`), dont l'app ne
  se sert pas. Le dialogue de Radix en écrit toujours une (`react-remove-scroll-bar`), et `sonner`
  insère sa feuille au chargement et refuse une CSP stricte
  ([sonner#449](https://github.com/emilkowalski/sonner/issues/449)). Un nonce n'y répond pas : le
  service worker sert un `index.html` mis en cache, dont le nonce ne changerait jamais. Santé
  vérifiée le 2026-10-12 : `mui/base-ui` non archivé, versions 1.9.0 (2026-10-09), 1.8.0
  (2026-09-04) et 1.7.0 (2026-08-04), issues fermées avec réponse le 2026-10-12, 11,1k étoiles,
  17,2 millions de téléchargements par semaine.
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
- **Pas de suite de bout en bout** (2026-10-16, Victor). Les suites Playwright du web et de la
  landing sont supprimées : trop lentes, de 8 à 30 minutes en local, et des heures à chasser leurs
  tests instables. Restent les tests Bun du serveur et du web, et la vérification de chaque PR dans
  Chrome avant son merge, puis au staging pour l'app (la landing n'en a pas).
- **La direction se retranche avant de construire** (2026-10-17, Victor). Le lot 1 et le plan de
  nettoyage de l'audit du 2026-10-16 sont en pause jusqu'à la vision réécrite : composer ou
  nettoyer ce qui va peut-être changer serait perdu. Puis une refonte en place, pas un nouveau
  dépôt : la base est saine, c'est le dispositif autour du code qui pèse. Source :
  `etudes/2026-10-17/direction.md`.
- **Supprimer plutôt qu'archiver** (2026-08-23, rappelé le 2026-10-06). Ce qui ne sert plus se
  supprime ; git le garde.
- **Merge commit, pas de squash** ; une branche courte par PR, jamais de push sur `main`.

## Ouvertes

Tranchées au moment du lot qui en dépend, doc d'abord :

| Décision | Lot | Ce qui la tranche |
|---|---|---|
| Fournisseur de paiement | 1 | Conformité UE, abonnement familial, facturation sans piège |
| Statut juridique (micro-entreprise ou société), TVA | 1 | Une consultation d'un expert-comptable, avant le paiement |
| Le domaine de l'app (par exemple `app.catiche.fr`) | 1 | Les domaines achetés par Victor ; le staging en attendant |
| Canal du message au parent après une détresse | 4 | Un canal garanti (l'e-mail), avec la revue humaine |
| Hébergement de données de santé | Avant la première famille | La réponse de la CNIL |
