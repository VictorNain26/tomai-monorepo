# Identité Kompri

Date : 2026-09-24. Remplace, pour tout ce qui touche à l'identité, les directions
`2026-09-22-landing-cahier-annote-design.md` et `2026-09-23-landing-copie-corrigee-design.md`
(cahier Seyès littéral). La refonte de la landing fera l'objet de sa propre spec, écrite sur
cette base.

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
| Nom du produit | **Kompri** (« Compris ! ») |
| Personnage | **Tom**, une loutre anthropomorphe, est le tuteur IA ; il n'est pas le nom du produit |
| Ton | Chaleureux et humain ; la page vouvoie les parents, Tom tutoie l'élève |
| Couleurs | Stylo Bic quatre couleurs, sur papier crème |
| Typographies | Nunito pour tout le texte ; Caveat pour les seules notes manuscrites |
| Signes d'école | Surligneur, numéros entourés, une note manuscrite ; rien d'autre |
| Illustration | Aplats vectoriels arrondis, sans contour |
| Logo | Logotype « Kompri » en Nunito, avec la tête de Tom |
| Abandonné | Réglure Seyès, marge rouge, couvertures animées, navigation dans la marge |

## 1. Nom : Kompri

« Compris ! » : le moment où ça fait tilt, et la question du prof, « C'est compris ? ». C'est
la promesse du produit : l'enfant ne recopie pas, il comprend. L'orthographe en K suit la
recette de noms comme Kartable ou Ornikar : un mot du quotidien, lisible sans l'avoir
jamais vu, avec un air de marque. Usage : « Kompri, avec Tom ».

Vérifications du 2026-09-24 :
- domaines libres : `kompri.fr` (RDAP AFNIC), `kompri.app` (RDAP Google Registry),
  `kompri.ai` (RDAP Identity Digital) ; `kompri.com` est pris ;
- aucune entreprise « Kompri » au registre (API Recherche d'entreprises,
  `https://recherche-entreprises.api.gouv.fr/search?q=kompri`) ;
- aucune app ni marque de ce nom trouvée par recherche web.

Restent à faire par Victor, avant toute publication du nom : la recherche d'antériorité à
l'INPI (`https://data.inpi.fr`, classes 9, 41 et 42) et la réservation des trois domaines.

Pistes écartées : Brouillon, Trousse, Jugeote, Ciboulot (« pas assez subtil ni tech ») ;
Maïeo (tréma illisible) et Mayeo (conservé comme repli) ; Heuri (agence homonyme) ; CQFD
(450 entreprises homonymes).

Le code et la landing parlent encore de « TomIA » : le renommage se fait dans la refonte de
la landing, adresse de contact comprise, une fois le domaine réservé.

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
(`#F3F5FB` → `#F0EADD`) et `card`/`popover` (`#FFFFFF` → `#FFFDF8`). La table de la spec du 2026-09-22 donne déjà les contrastes de ces
couleurs sur papier `#FAF7F0` et sable `#F0EADD` (tous ≥ 4,5:1 pour le texte) ; la PR qui
change les tokens les prouve par `packages/tokens/contrast.test.mjs`.

Un brun loutre s'ajoute pour l'illustration seule. Il ne devient pas un token d'interface.

## 3. Typographies

- **Nunito** pour les titres et le texte courant, en remplacement de Fraunces et Figtree.
  Sans empattements, aux terminaisons arrondies : c'est ce qui porte le côté doux et
  familial. Police variable (axe `wght`), licence OFL (`google/fonts`, `ofl/nunito/METADATA.pb`) ;
  chargée par `next/font/google` comme les polices actuelles.
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

Les traits (cercles, soulignés) sont des chemins SVG simples ; leur éventuelle animation
passe par Motion, déjà en dépendance.

## 5. Tom

Une **loutre anthropomorphe**, qui vit comme un humain : debout, des mains expressives, des
sourcils qui bougent, un pull doux, et **un stylo quatre couleurs dans la poche** (seul
accessoire « prof » : ni lunettes ni toque). La loutre est l'animal qui se sert d'outils
pour ouvrir ce qu'elle trouve : elle trouve la solution elle-même, comme l'élève.

Écartés : un hybride mi-humain mi-loutre (vallée de l'étrange, et zone où les générateurs
déforment mains et visages) ; le hibou (mascotte de Duolingo) ; le chat (Tom et Jerry).

### Style

Aplats vectoriels arrondis, sans contour, formes simples, ombres en aplats d'un ton plus
sombre. Palette : brun loutre, crème du ventre et du museau, plus deux couleurs du stylo au
plus (le bleu du pull, le rouge du stylo). Lisible en 32 px (favicon) comme en 400 px (hero).

### Jeu de départ

Cinq poses et une tête :
1. **bonjour** — il salue d'une main, sourire ;
2. **réfléchit** — la main sous le menton, regard en l'air ;
3. **indice** — il montre du doigt, sourcils levés ;
4. **bravo** — il fête la réussite, les bras en l'air ;
5. **écoute** — penché en avant, attentif ;
6. **tête seule**, de face, pour l'icône d'app, le favicon et le logo.

### Production

Victor génère, avec **Recraft sur une offre payante** : les images y appartiennent à
l'utilisateur et l'usage commercial est permis, ce qui n'est pas le cas de l'offre gratuite
(`https://www.recraft.ai/terms`). Méthode recommandée par Recraft pour garder un personnage
cohérent (`https://www.recraft.ai/docs/best-practices/character-consistency`) : description
détaillée des traits, même style appliqué à toutes les images, et image déjà validée posée
en référence visuelle pour les suivantes.

1. Générer la pose 1 avec le prompt de base ; itérer jusqu'à un Tom qui convient.
2. Poser cette image en référence et appliquer le même style pour les poses 2 à 6.
3. Critère d'acceptation : les six images montrent visiblement le même personnage
   (proportions, couleurs, pull, stylo) ; sinon on reprend l'étape 1 avec une description
   plus précise.
4. Export SVG ; les fichiers rejoignent le dépôt avec la refonte de la landing.

Prompt de base (en anglais, langue de travail des générateurs) :

> Friendly anthropomorphic otter character named Tom, a warm and patient tutor. Standing
> upright on two legs, expressive human-like hands, soft brown fur with a cream muzzle and
> belly, small round ears, gentle eyes with expressive eyebrows. Wears a cozy ink-blue
> knitted sweater with a four-colour ballpoint pen clipped in the chest pocket. Flat vector
> illustration, rounded geometric shapes, no outlines, flat shading, limited palette: brown,
> cream, ink blue #1F3F9E, touch of red #C0282D. Plain off-white background. Full body.
> Pose: waving hello with one hand, warm smile.

Poses suivantes, avec la pose 1 en référence : remplacer la dernière phrase par
« Same character, consistent face and proportions. Pose: » suivi de la pose — *hand under
chin, looking up, thinking* ; *pointing to the side with one finger, eyebrows raised, giving
a hint* ; *both arms raised, celebrating, big smile* ; *leaning forward, listening
attentively* ; *head only, front view, smiling, centered, for an app icon*.

## 6. Logo

Logotype « Kompri » en Nunito graisse 800, en `primary`, précédé de la tête de Tom. Le
logotype seul sert là où la tête serait trop petite. Pas de dessin de lettres sur mesure.

## 7. Suite

Découpage, dans l'ordre :
1. **Cette spec**, puis la génération de Tom par Victor.
2. **Refonte de la landing** sur cette identité : spec et plan propres, écrits contre `main`
   à jour. Elle change les tokens (§ 2), les polices (§ 3), renomme TomIA en Kompri, retire
   la feuille Seyès déjà livrée dans `main` et intègre Tom.
3. **L'app**, plus tard, reprend les mêmes tokens.

La PR 2 de la landing (branche `feat/landing-couvertures`, couvertures et navigation dans la
marge) n'est pas mergée ; elle sera fermée au démarrage de la refonte. Ce qui y reste utile
indépendamment du design sera repris dans la refonte : le formulaire d'inscription non
contrôlé (saisie préservée à l'hydratation) et ses tests.

## Critères de réussite

- un parent qui voit la page reconnaît en quelques secondes le produit, Tom et la promesse ;
- les quatre couleurs du stylo gardent chacune un seul rôle, partout ;
- les six images de Tom montrent le même personnage ;
- Tom reste lisible en 32 px ;
- aucune police, couleur ou illustration hors de cette spec sans la modifier d'abord.
