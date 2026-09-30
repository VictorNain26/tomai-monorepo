# Identité et charte graphique

Date : 2026-09-24, révisée le 2026-09-30 pour couvrir l'app en plus de la landing. Source
de vérité de l'identité ; les valeurs vivent dans le code (`packages/tokens/theme.css`,
`@repo/ui`) et ce document en fixe les rôles et les règles. Aucune police, couleur ou
illustration hors de cette charte sans la modifier d'abord.

## Intention

Deux publics, un même produit. Le parent arrive par la landing, décide et paie ; l'élève
utilise l'app. L'impression recherchée est **chaleureuse et humaine**, et sérieuse pour le
parent (données protégées, pas de triche). L'école reste présente en **clin d'œil** — le
stylo quatre couleurs, un mot surligné, un numéro entouré — jamais en décor reproduit : ni
réglure, ni marge, ni couvertures (direction « cahier » abandonnée le 2026-09-24 : elle
visait l'élève sur la landing, faisait « devoirs », et une page web ne tient pas des notes
de marge alignées sur une réglure qui défile).

| Sujet | Décision |
|---|---|
| Nom du produit | Provisoire, constante `BRAND_NAME` (valeur « TomIA ») ; candidat Kompri (§ 1) |
| Personnage | **Tom**, loutre anthropomorphe, le tuteur ; il n'est pas le nom du produit |
| Ton | La landing et l'espace parent vouvoient ; Tom tutoie l'élève |
| Registres | Parent : sobre. Élève : vivant, jamais infantilisant (§ 7) |
| Couleurs | Stylo quatre couleurs sur papier crème (§ 2) |
| Typographies | Nunito pour tout le texte ; Caveat pour les seules notes manuscrites (§ 3) |
| Thème | Clair seul ; pas de mode sombre en V1 |
| Signes d'école | Surligneur, numéros entourés, une note manuscrite ; rien d'autre (§ 4) |
| Illustration | Tom en rendu 3D toon pré-calculé dans Blender, jamais en 3D temps réel (§ 5) |
| Marque | Tête de Tom devant le nom (§ 6) |

## 1. Nom

Rouvert depuis le 2026-09-24 ; tout nom affiché passe par `BRAND_NAME`
(`apps/landing/lib/brand.ts`). Le candidat **Kompri** (« Compris ! », le moment où ça fait
tilt) a été vérifié le 2026-09-24 : domaines `kompri.fr`, `.app`, `.ai` libres, aucune
entreprise ni marque en conflit en France dans les classes 9, 41 et 42 (INPI). Restent à
Victor, avant toute publication d'un nom : le choix, le dépôt de la marque et la
réservation des domaines. Le nom de Tom s'écrit en toutes lettres dans le texte : les
phrases s'accordent avec lui.

## 2. Couleurs

Le stylo quatre couleurs : chaque encre a **un seul rôle**, partout, landing comme app.

| Rôle | Token | Valeur |
|---|---|---|
| Texte | `foreground` | `#1D1D22` (noir) |
| Actions, liens, focus, messages de l'élève | `primary`, `ring` | `#1F3F9E` (bleu) |
| La voix de Tom : note manuscrite, numéros entourés | `annotation` | `#C0282D` (rouge) |
| Réussite, « trouvé », confiance | `success` | `#1B7337` (vert) |
| Surligneur sous un mot | `highlight` | `#F9E08B` |
| Fond de page | `background` | `#FAF7F0` (papier crème) |
| Blocs, badges, pied de page | `secondary`, `muted`, `accent` | `#F0EADD` (sable) |
| Cartes, fenêtres | `card`, `popover` | `#FFFDF8` |
| Texte secondaire | `muted-foreground` | `#5C5C66` |
| Séparateurs, contours de cartes | `border` | `#E3DACB` |
| Contour des champs | `input` | `#8A7F6C` |
| Erreur du système | `destructive` | `#B42318` |
| Avertissement (quota, connexion) | `warning` | `#E0A43A` |

Règles :
- **Le rouge de Tom n'est jamais une faute.** Tom ne corrige pas en rouge le travail de
  l'élève : son rouge porte ses encouragements et ses repères. Une erreur du système
  (réseau, formulaire) prend `destructive`, toujours avec une icône et un texte qui dit
  quoi faire ; jamais la couleur seule, jamais Caveat.
- Pas de token `info` : le bleu est pris par les actions ; une information neutre se pose
  sur `muted`.
- Bordures et champs sont chauds, dérivés du sable : les bleus gris de l'ancienne identité
  sont retirés le 2026-09-30. `input` tient 3:1 sur `background`, `card` et `secondary`
  (WCAG 1.4.11).
- Contrastes vérifiés par `packages/tokens/contrast.test.mjs` : 4,5:1 pour le texte, 3:1
  pour les contours de champs. Jamais `annotation` sur `highlight` (4,48:1).
- Le brun loutre appartient à l'illustration seule ; il ne devient pas un token.

## 3. Typographies

- **Nunito** (OFL, variable `wght`) pour les titres et le texte courant : sans
  empattements, terminaisons arrondies. Titres en 800, texte en 400, libellés et boutons
  en 700. Chargée par `next/font/google`.
- **Caveat** (OFL) pour les seules notes manuscrites de Tom, en `annotation`.
- Pas de police à chasse fixe en V1 : le collège n'affiche pas de code. Les formules
  passent par KaTeX et ses propres polices.

Échelle, en classes Tailwind (une taille par rôle, texte en `rem`) :

| Rôle | Landing | App |
|---|---|---|
| Titre de page (`h1`) | `text-4xl` → `xl:text-7xl` (hero) | `text-2xl` → `md:text-3xl` |
| Titre de section (`h2`) | `text-3xl` → `md:text-5xl` | `text-xl` |
| Titre de carte (`h3`) | `text-xl` | `text-lg` |
| Texte courant | `text-lg` → `md:text-xl` (accroche), `text-base` | `text-base`, messages du chat compris |
| Libellés, métadonnées | `text-sm` | `text-sm` |

Lignes de texte courant de 45 à 75 caractères ; `text-balance` sur les titres.

## 4. Les signes d'école

Rares, sinon ils redeviennent un décor :
- **surligneur** : au plus un groupe de mots par titre, en `highlight` sous la moitié basse
  du texte ;
- **numéros entourés** : étapes numérotées cerclées d'un trait rouge irrégulier ; l'étape
  de réussite, de vert ;
- **note manuscrite** : au plus une par section de la landing, et dans l'app au plus une
  par écran, en Caveat `annotation`, légèrement inclinée, à la voix de Tom.

Les cercles sont des chemins SVG ; leur animation passe par Motion.

## 5. Tom

Une **loutre anthropomorphe** qui vit comme un humain : debout, des mains expressives, des
sourcils qui bougent, un pull bleu, et **un stylo quatre couleurs dans la poche** (seul
accessoire « prof »). La loutre se sert d'outils pour ouvrir ce qu'elle trouve : elle
trouve la solution elle-même, comme l'élève. Écartés : l'hybride mi-humain (vallée de
l'étrange), le hibou (Duolingo), le chat (Tom et Jerry).

- **Un seul Tom en V1**, le stade du cycle 4, pour tout le collège (6e comprise). L'idée
  d'un Tom qui grandit avec l'élève (stade 6e plus rond, stade lycée plus sobre, variantes
  de proportions d'un même modèle) reste ouverte ; elle se décidera sur des retours
  d'élèves.
- **Style** : rendu toon dans Blender (EEVEE) — 2 à 3 aplats par couleur, contour Line Art
  en `foreground`, fond transparent. Palette : brun loutre, crème du museau, bleu `primary`
  du pull, rouge `annotation` du stylo.
- **Production** : dépôt `tom-mascotte` (Git LFS), `tom.blend` source de vérité, rendus
  sous `renders/final/`. Une équipe d'agents pilote Blender, un critique indépendant par
  étape, Victor valide.
- **Formats web** : PNG transparents ; animations en vidéo, une source HEVC avec alpha
  (`.mov`, pour Safari qui ignore l'alpha du VP9) puis une source WebM VP9 avec alpha.
  Sans JavaScript et sous `prefers-reduced-motion`, la première image en PNG. Jamais de 3D
  temps réel : l'export glTF ne garde ni l'ombrage toon ni le contour Line Art.

**Poses**, chacune liée à un état de l'app :

| Pose | État | Rendu |
|---|---|---|
| neutre | attente, repos (hero de la landing, animation de respiration) | livré |
| bonjour | accueil, première session, écran vide | livré, avec l'animation du salut |
| réfléchit | Tom prépare sa réponse | livré |
| encourage | Tom donne un indice, l'élève est sur la bonne piste | livré |
| bravo | l'élève a trouvé | à produire |

Et la **tête seule, de face**, en deux cadrages : complet (moustaches entières) pour les
icônes d'app, serré pour le logo, le favicon et l'avatar de Tom dans le chat. Tom reste
lisible en 32 px.

## 6. Marque

La tête de Tom (cadrage serré) devant le nom en Nunito 800, `primary`. Elle sert de logo
(en-tête, pied de page), de favicon, d'icônes d'app (sur papier pour l'icône Apple : iOS
remplit la transparence de noir) et d'image de l'organisation dans le JSON-LD. Le nom
définitif sera converti en tracés SVG par un outil existant (fontTools), pour ne pas
dépendre de la police chargée.

## 7. L'app

Ce qui suit fixe les règles ; les écrans se maquettent au démarrage du lot 3.

**Registres.**
- *Parent* (landing, tableau de bord, facturation) : sobre ; seules des entrées de bloc en
  fondu. Des chiffres et des faits, pas de Tom animé en continu.
- *Élève* (chat) : vivant sans infantiliser. Tom change de pose avec l'état, les numéros se
  cerclent, une note manuscrite peut saluer une réussite. Ni confettis, ni sons, ni points
  ni séries : la récompense, c'est d'avoir trouvé.

**Chat.** Les messages de Tom s'affichent sur `card`, précédés de sa tête (avatar serré) ;
ceux de l'élève sur `primary`, en `primary-foreground`, alignés à droite. Les formules en
KaTeX, en `foreground`. Pendant la génération, la pose « réfléchit » et le texte qui
arrive ; jamais un écran figé.

**États.** Chaque écran a ses états complets :
- *chargement* : squelettes aux dimensions du contenu (`duration-pulse`), pas de spinner
  seul ;
- *vide* : Tom « bonjour » et une seule action ;
- *erreur* : `destructive`, une icône, ce qui s'est passé et quoi faire ;
- *réussite* : `success`, et côté élève Tom « bravo ».

**Composants.** Primitives dans `@repo/ui` (base shadcn, où vit leur accessibilité),
ajoutées quand un lot en a l'usage et pas avant. Existants : `Button`, `Input`, `Sheet`.

**Formes et mouvement.** Rayons : `rounded-full` pour les boutons, les champs d'une ligne
et les badges ; `rounded-2xl` pour les cartes et les zones de saisie de plusieurs lignes. Durées : `duration-fast`
(retour d'un appui), `duration-base` (transitions), `duration-slow` (entrées d'écran).
Toute animation décorative s'arrête sous `prefers-reduced-motion`.

**Accessibilité.** Contraste AA (§ 2), cibles de 44 px, focus visible en `ring`, jamais une
information portée par la seule couleur, navigation complète au clavier.

## Critères de réussite

- un parent reconnaît en quelques secondes le produit, Tom et la promesse ;
- chaque encre du stylo garde un seul rôle, landing comme app ;
- un élève ne voit jamais de rouge sur une erreur de sa part ;
- chaque pose de Tom correspond à un seul état ;
- Tom reste lisible en 32 px.
