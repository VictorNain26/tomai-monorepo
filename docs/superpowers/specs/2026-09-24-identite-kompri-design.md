# Identité Kompri

Date : 2026-09-24. Remplace, pour tout ce qui touche à l'identité, les directions
« cahier annoté » et « copie corrigée » (cahier Seyès littéral). La refonte de la landing
fera l'objet de sa propre spec, écrite sur cette base.

## Intention

La landing s'adresse aux parents : ils arrivent, décident et paient ; l'élève est
l'utilisateur de l'app, pas le lecteur de la page. Un parent doit repartir en quelques
secondes avec trois idées : Tom fait comprendre au lieu de donner la réponse, c'est sérieux
(données protégées, pas de triche), et on peut s'inscrire à la liste d'attente.

L'impression recherchée est **chaleureuse et humaine**. L'école reste présente en
**clin d'œil** — le stylo quatre couleurs, un mot surligné, un numéro entouré — jamais en
décor reproduit : plus de réglure, de marge ni de couvertures.

Pourquoi le cahier littéral est abandonné : il visait l'élève plutôt que le parent, faisait
« devoirs », et imposait des contraintes qu'une page web ne tient pas (des notes de marge
fixes ne peuvent pas rester alignées sur une réglure qui défile).

## Décisions

| Sujet | Décision |
|---|---|
| Nom du produit | Provisoire (candidat : Kompri), voir `2026-09-24-landing-kompri-design.md` § 5 |
| Personnage | **Tom**, une loutre anthropomorphe, est le tuteur IA ; il n'est pas le nom du produit ; il grandit avec l'élève (§ 5) |
| Ton | Chaleureux et humain ; la page vouvoie les parents, Tom tutoie l'élève |
| Couleurs | Stylo Bic quatre couleurs, sur papier crème |
| Typographies | Nunito pour tout le texte ; Caveat pour les seules notes manuscrites |
| Signes d'école | Surligneur, numéros entourés, une note manuscrite ; rien d'autre |
| Illustration | Rendu 3D toon fait dans Blender par une équipe d'agents, validé par Victor : aplats de 2 à 3 tons, contour à l'encre, fond transparent |
| Logo | Logotype du nom retenu |
| Abandonné | Réglure Seyès, marge rouge, couvertures animées, navigation dans la marge |

## 1. Nom (candidat : Kompri)

Le nom est rouvert depuis le 2026-09-24 ; état et valeurs provisoires : voir
`2026-09-24-landing-kompri-design.md` § 5.

« Compris ! » : le moment où ça fait tilt, et la question du prof, « C'est compris ? ». C'est
la promesse du produit : l'enfant ne recopie pas, il comprend. L'orthographe en K suit la
recette de noms comme Kartable ou Ornikar : un mot du quotidien, lisible sans l'avoir
jamais vu, avec un air de marque. Usage : « Kompri, avec Tom ».

Vérifications du 2026-09-24 :
- domaines libres : `kompri.fr` (RDAP AFNIC), `kompri.app` (RDAP Google Registry),
  `kompri.ai` (RDAP Identity Digital) ; `kompri.com` est pris ;
- aucune entreprise « Kompri » au registre (API Recherche d'entreprises,
  `https://recherche-entreprises.api.gouv.fr/search?q=kompri`) ;
- aucune app ni marque de ce nom trouvée par recherche web ;
- base marques de l'INPI (`https://data.inpi.fr`, recherche « kompri », 3 résultats ;
  « kompris », aucun) : aucune marque ne couvre la France dans les classes 9, 41 ou 42.
  « Kes Tapa Kompr! » (FR 5060957) est en classe 25, vêtements. « KOMPRI » (UE 018402188)
  est en classes 6 et 19, métal et bâtiment. « My Kompri » (WO 1814718) a une classe 41
  limitée à la formation médicale en lymphologie, et ne désigne que l'Autriche et la
  Suisse.

Restent à faire par Victor, avant toute publication du nom : le dépôt de la marque (classes
9, 41 et 42) et la réservation des trois domaines. Une recherche de similarité
professionnelle, que l'INPI conseille, n'est pas couverte par la recherche ci-dessus.

Pistes écartées : Brouillon, Trousse, Jugeote, Ciboulot (« pas assez subtil ni tech ») ;
Maïeo (tréma illisible) et Mayeo (conservé comme repli) ; Heuri (agence homonyme) ; CQFD
(450 entreprises homonymes).

## 2. Couleurs : le stylo quatre couleurs

Chaque couleur a un rôle unique :

| Rôle | Token | Valeur |
|---|---|---|
| Texte | `foreground` | `#1D1D22` (noir) |
| Actions, liens, focus, l'élève | `primary` | `#1F3F9E` (bleu) |
| Correction de Tom, numéros entourés, note manuscrite | `annotation` | `#C0282D` (rouge) |
| Validé, « trouvé », confiance | `success` | `#1B7337` (vert) |
| Surligneur sous un mot | `highlight` | `#F9E08B` |
| Fond de page | `background` | `#FAF7F0` (papier crème) |
| Blocs, badges | `secondary`, `muted`, `accent` | `#F0EADD` (sable) |
| Cartes | `card`, `popover` | `#FFFDF8` |

Les autres tokens de `packages/tokens/theme.css` restent tels quels. Écart avec `main` : trois
valeurs changent, `background` (`#FCFCFA` → `#FAF7F0`), `secondary`/`muted`/`accent`
(`#F3F5FB` → `#F0EADD`) et `card`/`popover` (`#FFFFFF` → `#FFFDF8`) ;
`packages/tokens/contrast.test.mjs` les vérifie.

Un brun loutre s'ajoute pour l'illustration seule. Il ne devient pas un token d'interface.

## 3. Typographies

- **Nunito** pour les titres et le texte courant, en remplacement de Fraunces et Figtree.
  Sans empattements, aux terminaisons arrondies : c'est ce qui porte le côté doux et
  familial. Police variable (axe `wght`), licence OFL (`google/fonts`,
  `ofl/nunito/METADATA.pb`) ; chargée par `next/font/google` comme les polices actuelles.
- **Caveat** (OFL, `wght` 400 à 700) pour les seules notes manuscrites, en rouge.

Titres en graisse 800, texte courant en 400, libellés et boutons en 700.

## 4. Les signes d'école

Ils sont rares, sinon ils redeviennent un décor :
- **surligneur** : au plus un mot ou un groupe de mots par titre, en `highlight` sous la
  moitié basse du texte ;
- **numéros entourés** : les étapes numérotées sont cerclées d'un trait rouge irrégulier ;
  l'étape de réussite (« il trouve ») est cerclée de vert ;
- **note manuscrite** : au plus une par section, en Caveat rouge, légèrement inclinée, à la
  voix de Tom (« c'est toi qui l'écris ! »).

Les cercles sont des chemins SVG simples ; leur éventuelle animation passe par Motion, déjà
en dépendance.

## 5. Tom

Une **loutre anthropomorphe**, qui vit comme un humain : debout, des mains expressives, des
sourcils qui bougent, un pull doux, et **un stylo quatre couleurs dans la poche** (seul
accessoire « prof » : ni lunettes ni toque). La loutre est l'animal qui se sert d'outils
pour ouvrir ce qu'elle trouve : elle trouve la solution elle-même, comme l'élève.

Écartés : un hybride mi-humain mi-loutre (vallée de l'étrange, et zone où les générateurs
déforment mains et visages) ; le hibou (mascotte de Duolingo) ; le chat (Tom et Jerry).

- **Il grandit avec l'élève** : trois stades calqués sur les cycles officiels : 6e (cycle 3,
  proportions rondes, grosse tête), 5e à 3e (cycle 4, silhouette plus fine, attitude
  assurée), lycée (proportions d'adolescent, dessin plus sobre). Un seul modèle, une seule
  armature, les stades sont des variantes de proportions (*shape keys*). La V1 couvre le
  collège : le stade lycée n'apparaît nulle part tant que le lycée n'est pas proposé.
- **Style** : rendu toon dans Blender (EEVEE). Ombrage en 2 à 3 aplats par couleur (nœud
  *Shader to RGB* suivi d'une *Color Ramp*), contour par le modificateur *Line Art* en
  `foreground` `#1D1D22`, sans flou ni textures réalistes. Palette : brun loutre, crème du
  ventre et du museau, bleu `#1F3F9E` du pull, rouge `#C0282D` du stylo. Fond transparent
  (option *Transparent* du panneau Film d'EEVEE), export PNG.
- **Jeu de départ** : les cinq poses et la tête gardent leur liste actuelle ; la landing
  n'utilise que « bonjour » au stade cycle 4, produit en premier.
  1. **bonjour** — il salue d'une main, sourire ;
  2. **réfléchit** — la main sous le menton, regard en l'air ;
  3. **indice** — il montre du doigt, sourcils levés ;
  4. **bravo** — il fête la réussite, les bras en l'air ;
  5. **écoute** — penché en avant, attentif ;
  6. **tête seule**, de face, pour l'icône d'app, le favicon et le logo.
- **Production** : une équipe d'agents pilote Blender par le serveur MCP officiel de Blender
  Lab — direction artistique (bible du personnage et planche de turnaround), modélisation,
  rig et animation pré-rendue, avec un critique visuel indépendant à chaque étape (matériaux,
  contour, éclairage, rendus en série, vérification du rendu en 32 px par capture
  Playwright). Victor valide chaque étape. Rendus pré-calculés en PNG, aucune 3D temps réel
  sur le site.
- Sources, citées dans le texte :
  `https://docs.blender.org/manual/en/latest/render/shader_nodes/color/shader_to_rgb.html`,
  `https://docs.blender.org/manual/en/latest/grease_pencil/modifiers/generate/line_art.html`,
  `https://docs.blender.org/manual/en/latest/render/eevee/render_settings/film.html`,
  `https://www.blender.org/lab/mcp-server/`.

## 6. Logo

Logotype du nom retenu en Nunito graisse 800, en `primary`, précédé de la tête de Tom. Le
logotype seul sert là où la tête serait trop petite. Pas de dessin de lettres sur mesure :
le texte est converti en tracés SVG par un outil existant (fontTools ou opentype.js), pour
ne pas dépendre de la police chargée, avec un réglage de l'approche des lettres. Variantes :
couleur sur papier, blanc sur bleu, logotype seul. La tête de Tom s'y ajoute une fois la
mascotte livrée.

## 7. Suite

Découpage, dans l'ordre :
1. **Cette spec**, puis Tom : modélisation et rendu dans Blender par une équipe d'agents,
   validés par Victor à chaque étape ; le logotype en parallèle.
2. **Refonte de la landing** sur cette identité : spec et plan propres, écrits contre `main`
   à jour. Elle change les tokens (§ 2), les polices (§ 3), retire la feuille Seyès déjà
   livrée dans `main`, intègre Tom, et fait le renommage à sa PR 3b de la spec landing.
3. **L'app**, plus tard, reprend les mêmes tokens.

La PR 2 de la landing (branche `feat/landing-couvertures`, couvertures et navigation dans la
marge) n'est pas mergée ; elle sera fermée au démarrage de la refonte. Ce qui y reste utile
indépendamment du design sera repris dans la refonte : le formulaire d'inscription non
contrôlé (saisie préservée à l'hydratation) et ses tests.

## Critères de réussite

- un parent qui voit la page reconnaît en quelques secondes le produit, Tom et la promesse ;
- les quatre couleurs du stylo gardent chacune un seul rôle, partout ;
- les images d'un même stade montrent le même personnage, et les trois stades le même Tom à
  trois âges ;
- Tom reste lisible en 32 px ;
- aucune police, couleur ou illustration hors de cette spec sans la modifier d'abord.
