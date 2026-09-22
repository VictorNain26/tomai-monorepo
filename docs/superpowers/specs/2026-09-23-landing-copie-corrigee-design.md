# Landing « La copie corrigée » — itération 2

Date : 2026-09-23. Prolonge `2026-09-22-landing-cahier-annote-design.md` (palette Bic,
thème clair seul), dont les décisions restent valables sauf là où ce document les remplace.
Matière : audit `.superpowers/sdd/2026-09-22-landing-cahier-annote/audit-direction.md`
(findings, références, contrastes calculés, faisabilité).

## Intention

La page est une copie d'élève que Tom corrige sous les yeux du parent. L'élève écrit en
bleu, Tom annote en rouge dans la marge, le vert valide ce que l'élève a trouvé seul.
Chaque animation est un geste de la méthode : écrire, questionner, corriger, valider.
Le visiteur doit repartir en ayant *vu* la maïeutique, pas en l'ayant lue.

Critères de réussite :
- le texte courant et les titres sont posés sur les lignes d'une réglure Seyès, la marge
  rouge sur une verticale exacte, dans toutes les sections et à toutes les largeurs ;
- aucun fond crème ni bande sable ; la grille couvre la page sans masque ;
- le header appartient à la feuille ;
- un seul tracé à la fois, à vitesse d'écriture constante ; état final complet sans JS et
  sous `prefers-reduced-motion` ;
- l'exercice du hero se joue au clavier et au lecteur d'écran, et se lit résolu sans
  interaction ;
- aucune promesse au-delà de la V1.

## Décisions

| Sujet | Décision | Remplace |
|---|---|---|
| Direction | D1 « La copie corrigée » + exercice interactif du hero (D3) | — |
| Réglure | Seyès : carreau 32 px, interlignes 8 px, verticales tous les 32 px | carreaux simples 32 px, calque `fixed` masqué |
| Grille | Peinte par chaque section, défile avec elle, calée sur le bord gauche du contenu | calque `fixed` + `mask-image` radial |
| Marge | Trait `annotation` plein 2 px sur une verticale, peint par chaque section, visible aussi en mobile | `fixed`, `md+`, 70 % |
| Papier | Blanc neutre ; objets posés sur la page, pas de bandes de fond | crème + bandes sable |
| Rythme vertical | Hauteurs de ligne et espacements verticaux multiples de 8 px ; ligne de base calée par l'unité `lh` et les métriques Capsize | libre |
| Header | En-tête de copie, replié en intercalaires au scroll | barre en verre dépoli |
| Icônes | Jeu maison de 13 icônes au trait ; `lucide-react` retiré de la landing | 34 usages lucide |
| Annotations | Cursive Playwrite France Traditionnelle | Fraunces italique |
| Démo | Exercice jouable dans le hero ; la démo en bulles disparaît | `chat-demo.tsx` |
| Contact | `contact@tomia.fr` partout | `contact@tomai.fr` |
| Promesse | Décrire l'échelle d'indices (spec agent §4) ; titre du hero conservé | — |

« Il ne donne pas la réponse » reste exact : l'échelle d'indices ne donne jamais la réponse
de l'exercice de l'élève lui-même (`2026-09-22-agent-ia.md` §4). Aucun texte de la landing
ne dit « jamais la réponse » sans préciser « de ton exercice ».

## 1. Fondations

### Tokens (`packages/tokens/theme.css`)

| Token | Valeur | Contrastes (texte `#1D1D22` / muted / primary / annotation / success) |
|---|---|---|
| `background` | `#FCFCFA` | 16,34 / 6,43 / 9,03 / 5,71 / 5,75 |
| `card`, `popover` | `#FFFFFF` | 16,79 / 6,61 / 9,28 / 5,86 / 5,91 |
| `secondary`, `muted`, `accent` | `#F3F5FB` | 15,40 / 6,06 / 8,51 / 5,38 / 5,42 |
| `note` (nouveau) + `note-foreground` `#1D1D22` | `#FFF3B0` | 14,95 / 5,88 / 8,26 / 5,22 / 5,26 |
| `highlight` | `#F9E08B` inchangé | `annotation` dessus 4,48 : **interdit** |
| `border` | `#D9DFF0` (bleu de carreau, décoratif) | — |
| `input` | `#7F8BB8` | 3,25:1 sur `background` (≥ 3:1, WCAG 1.4.11) |

Les ratios sont ceux de l'audit ; le test `packages/tokens/contrast.test.mjs` les prouve
(paires ajoutées pour `note`, et `input` au seuil 3:1 des contrôles). Les autres tokens Bic sont inchangés.

### Réglure et marge (`apps/landing/app/globals.css`)

- `--cell: 2rem`, `--rule: 0.5rem`.
- `@utility bg-seyes` : verticales fortes tous les `--cell`, horizontales fortes tous les
  `--cell`, interlignes fines tous les `--rule` ; fortes ≈ `#C9D3EE`, fines ≈ `#E3E8F6`,
  obtenues par `color-mix` de `primary`. Les verticales sont peintes par un pseudo-élément
  dont `left` vaut `calage − 40 cellules`, avec `calage = max(0px, (100% − 78rem) / 2)` :
  les pourcentages de `left` se rapportent à la largeur de la section, ceux de
  `background-position` non. La section est en `overflow-x: clip` et `isolation: isolate`.
- La marge est un pseudo-élément de `bg-seyes` : 2 px `annotation` plein, posé sur la
  verticale d'index 1 (mobile), 2 (md), 3 (lg) à partir du calage.
- `@utility container` : `max-width: 78rem` (39 cellules), centré ; padding gauche =
  marge + ½ cellule en mobile (48 px), marge + 1 cellule en md (96 px) et lg (128 px) ;
  padding droit 16 px (mobile), 64 px (md+).
- Le calque `bg-notebook` `fixed` et la marge `fixed` de `layout.tsx` sont supprimés.
- Cartes : `ring` ou ombre, jamais `border` (1 px décalerait les lignes).

### Typographie

- Hauteurs de ligne (px) : `text-xs` 16, `sm`/`base` 24, `lg`/`xl`/`2xl` 32, `3xl` 40,
  `4xl` 48, `5xl` 56, `6xl` 64, `7xl` 80, `8xl` 96. Les utilitaires `leading-*` sont
  retirés de la landing.
- Les tailles de texte existantes sont conservées ; leurs hauteurs de ligne (`--text-*--line-height`)
  passent à des multiples de 8 dans le `@theme` de la landing.
- Ligne de base posée sur le bas de chaque ligne par une règle unique :
  `top: calc(0.5lh − var(--ink-ad) × 0.5em)` sur les blocs de texte, avec
  `--ink-ad = (ascent − |descent|) / unitsPerEm` lu dans `@capsizecss/metrics` 4.3.0
  (Figtree 0,700 ; Fraunces 0,723). L'unité `lh` est Baseline « Widely Available »
  (Chrome 109, Firefox 120, Safari 16.4 —
  https://web-platform-dx.github.io/web-features-explorer/features/lh/). Aucune dépendance.
- Espacements verticaux pairs uniquement (`mt-2`, `py-6`, `space-y-4`…).
- Images, champs et boutons arrondissent leur hauteur au multiple de 8 (boutons 48 px).

### Pages légales et footer

- Pages légales mises en forme directement (échelle ci-dessus), sans dépendre de `prose`.
- Footer : 4e de couverture en `primary` plein, texte `primary-foreground`, liens légaux et
  deux coches manuscrites « Hébergé dans l'UE », « Sans publicité ».

## 2. Header et icônes

### Header (`components/layout/header.tsx`)

- **En haut de page** : aucun fond propre, écrit sur la feuille. Logo dans la colonne de
  marge ; date du jour en cursive bleue juste après la marge (calculée au rendu, fuseau
  `Europe/Paris`, page revalidée toutes les heures pour que la date ne retarde jamais de plus d'une heure après minuit) ; nav sur la première ligne ; CTA bleu.
- **Au scroll** : barre réduite collée dont le fond est la même feuille, recalée par
  `useScroll` + `useTransform` (`background-position-y = -(scrollY mod 32px)`). Les liens
  deviennent des onglets d'intercalaire ; l'onglet de la section visible est « tiré »
  (`layoutId`, repérage par `IntersectionObserver`). CTA en onglet bleu plus large.
- **Mobile** : logo dans la marge, bouton menu (trois traits de règle) ; menu en fiche
  posée, fermeture par croix rouge ; menu fermé `inert` ; cibles 44 px.
- Plus de `backdrop-blur`, plus de bordure sable.

### Icônes (`components/annotations/icons.tsx`)

- 13 icônes : flèche, coche, coche entourée, croix, plus, moins, menu, appareil photo,
  micro, clavier, enveloppe, boucle de chargement, ciseaux.
- Trait unique, `stroke-linecap/linejoin: round`, `vector-effect: non-scaling-stroke`,
  épaisseur égale aux annotations, tracé légèrement irrégulier. Tracés générés une fois
  hors ligne (roughjs sur les géométries Lucide, licence ISC) puis retouchés ; aucun
  outil de génération dans les dépendances runtime.
- Couleur par sens : bleu action, vert validé, rouge remarque, `foreground` neutre.
- Dessinées au stylo à l'entrée (primitives §3) ; dessinées d'emblée sous reduced-motion.
- Supprimées : badges du footer, pastilles de la FAQ, icônes Parents, `MessageCircle` de
  l'aide, carte « Localisation » du contact. Le bouclier « gratuit » devient une coche.
- `lucide-react` retiré de `apps/landing/package.json`.

## 3. Écriture et hero

### Primitives (`components/annotations/`, `lib/motion.ts`)

- **Une main** : file d'attente globale (contexte React) ; un tracé visible s'y inscrit et
  attend la fin du précédent ; jamais deux tracés simultanés.
- **Vitesse constante** : durée = `getTotalLength() / PEN_PX_PER_S` ; courbe stylo
  (attaque rapide, levée lente) définie une fois dans `lib/motion.ts`.
- **Déclenché, jamais scrubbé** ; seule la progression de lecture dans la marge est liée au
  scroll.
- **Trait à épaisseur variable** : barré, cercles, soulignés calculés hors ligne avec
  perfect-freehand et figés en SVG. Les cercles entourent leur contenu (SVG dimensionné
  sur la boîte, pas sur le `viewBox`).
- **Cursive** : Playwrite France Traditionnelle via `next/font/google`, une graisse,
  `latin`, `display: swap`. Écriture par masque de traits réservée à 2-3 mots signature ;
  les autres annotations apparaissent sans tracé.
- **Accessibilité** : tout texte écrit existe dans le DOM ; tracés `aria-hidden` ; sous
  reduced-motion ou sans JS, état final rendu dès le serveur, sans fondu (`useReducedMotion`
  + `initial={false}`, `MotionConfig` ne suffisant pas pour `pathLength`).

### Hero

- Titre sur les lignes : « Il ne donne pas la réponse. Il aide à la ~~trouver~~ » ; le
  barré se trace, puis « comprendre » s'écrit en rouge dans l'interligne au-dessus, avec un
  « v » d'insertion.
- **Exercice interactif** (droite en desktop, sous le titre en mobile), étiqueté
  « exemple interactif » à la main :
  1. Énoncé « 3x + 5 = 20 » ; question « Tu commences par quoi ? » ; trois choix en groupe
     de radios (cibles 44 px) : « Diviser par 3 », « Enlever 5 des deux côtés »,
     « Ajouter 5 ».
  2. Mauvais choix : Tom monte d'un palier de l'échelle d'indices, en rouge dans la
     marge — relance (« Qu'est-ce qui gêne pour isoler x ? »), puis indice conceptuel
     (« On peut faire la même opération des deux côtés. »), puis indice ciblé
     (« Le + 5 est en trop à gauche. »). Jamais la solution.
  3. Bon choix : l'élève écrit en bleu « 3x = 15 », nouvelle question, puis « x = 5 ».
  4. Fin : « x = 5 » s'entoure en vert, « Trouvé seul ! » en marge ; bouton « Rejouer ».
- Répliques annoncées par une région `aria-live="polite"` ; le focus passe au groupe de
  choix suivant. Sans interaction, sans JS ou sous reduced-motion, la copie est rendue
  résolue.
- La démo en bulles (`chat-demo.tsx`) est supprimée.

## 4. Sections

- **Problème** : « Copier une réponse prend dix secondes. » apparaît d'un coup en
  tapuscrit ; « L'oublier aussi. » : la réponse copiée pâlit sous un balayage d'effaceur
  (`clip-path`).
- **Méthode** : « I. Il questionne », « II. Il s'adapte », « III. Il fait réviser »,
  soulignés à la règle (trait rouge droit) ; surligneur passé de gauche à droite sur le mot
  clé ; le texte de « Il questionne » décrit l'échelle d'indices (relance, indice, étape
  intermédiaire, exemple analogue résolu).
- **Modes de saisie** : trois croquis au trait dans une rangée de cases.
- **Parents** : page de carnet de liaison — « Mot de Tom » (matières, temps passé, notions
  qui résistent), ligne « Vu, signature des parents » ; conversations en feuille pliée et
  agrafée, lignes floutées, tampon « privé ».
- **Confiance** : « règlement » avec note en marge et coches vertes tracées une à une.
- **Tarifs** : liste de fournitures à cocher ; prix du Complet en pointillés « à compléter
  au lancement ».
- **FAQ** : questions numérotées à la main, sans icônes ; réponse dépliée en fiche bristol ;
  plus/moins tracés à la main ; anneau de focus visible.
- **CTA** : coupon-réponse bordé de pointillés ; succès → ciseaux le long du pointillé,
  coupon soulevé, « Coupon reçu ✓ » ; erreur → coupon en place, message en `destructive`.
- **Contact et aide** : `contact@tomia.fr` ; retrait de « équipe support » et « réponse
  sous 24h » (ni équipe ni utilisateurs à ce jour) ; formulation : « Écris-nous, on lit
  tout ».

## 5. Contraintes

Inchangées : tokens uniquement (hors constantes de l'OG image), thème clair, site
statique, frontière landing (seule intégration serveur : `joinWaitlist`), primitives
interactives via `@repo/ui`, cibles 44 px, contraste AA, fichiers < 400 lignes,
collège 6e → 3e, `BRAND_NAME`, pas de dépendance runtime nouvelle. Les outils hors ligne
(perfect-freehand, roughjs) servent à produire du SVG ou du CSS commité ; leurs
scripts de génération vivent dans `apps/landing/scripts/` et sont relançables.

## 6. Livraison

Cinq PR courtes, empilées sur `feat/landing-cahier-annote-pages` :

1. Fondations : tokens, Seyès et marge, `@utility container`, rythme vertical, pages
   légales, footer, contact et promesses.
2. Header et icônes.
3. Primitives d'écriture, cercles réparés, Playwrite.
4. Hero et exercice interactif.
5. Sections Problème, Méthode, Parents, Confiance, Tarifs, FAQ, CTA.

Chaque PR : typecheck, lint, build, test de contraste ; passe visuelle Chrome (375 px par
iframe, 768, 1440 ; reduced-motion ; clavier) ; captures dans la PR.

## 7. Tests

- `@repo/tokens` : paires de contraste des nouveaux fonds.
- Landing sans runner de test aujourd'hui : la logique de l'exercice (transitions d'état,
  paliers) et la file « une main » sont écrites en fonctions pures testées avec
  `node:test`, comme le test de contraste ; les composants restent minces.
- Vérification de la grille : script navigateur qui mesure que la ligne de base des titres
  et paragraphes tombe sur un multiple de 8 depuis le haut de la section (tolérance 1 px),
  et que la marge coïncide avec une verticale.

## Hors périmètre

Icônes PNG et favicon (chantier branding), nom définitif du produit, View Transitions
entre pages, timeout du fetch de `joinWaitlist` (PR séparée).
