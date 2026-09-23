# Landing « La copie corrigée » — itération 2

Date : 2026-09-23, révisée le même jour après la maquette
https://claude.ai/artifact/Pe2RGb5BcC1MeCAn3B5akd (v4). Prolonge
`2026-09-22-landing-cahier-annote-design.md` (palette Bic, thème clair seul), dont les
décisions restent valables sauf là où ce document les remplace. Matière : audit
`.superpowers/sdd/2026-09-22-landing-cahier-annote/audit-direction.md`.

## Intention

La landing est un cahier. La couverture est le hero ; au défilement elle s'ouvre, la
réglure Seyès apparaît, la marge se trace, et la première page s'écrit. En fin de page, le
cahier se referme sur la quatrième de couverture, qui porte le footer. L'élève écrit en
bleu, Tom corrige en rouge. Le trait reste sobre : une seule correction visible par page,
des titres soulignés, rien de plus.

Critères de réussite :
- seule l'écriture manuscrite est posée sur les lignes ; le texte composé vit sur des
  fiches collées, jamais sur la réglure ;
- la marge rouge tombe sur une verticale exacte, à toutes les largeurs ;
- une réglure fidèle à une copie Seyès : bande de tête sans horizontales, marge sans
  verticales, pas de perforations ;
- état final complet sans JS et sous `prefers-reduced-motion` ;
- l'exercice se joue au clavier et au lecteur d'écran, et se lit résolu sans interaction ;
- aucune promesse au-delà de la V1 ;
- aucun moteur d'animation ni outil maison : Motion (déjà dépendance), CSS et SVG natifs.

## Décisions

| Sujet | Décision | Remplace |
|---|---|---|
| Hero | Couverture de cahier : titre, étiquette « Nom / Classe / Matière » portant l'inscription | titre barré + exercice dans le hero |
| Ouverture | Couverture qui tourne au défilement, puis réglure, marge, écriture | — |
| Footer | Quatrième de couverture qui se referme sur la dernière page | footer plein en bas de page |
| Réglure | Seyès 32/8 px, peinte une fois par feuille ; bande de tête sans horizontales ; marge sans verticales ; sans perforations | peinte par section |
| Texte composé | Sur des fiches collées (papier blanc, légère rotation, ruban adhésif) et un post-it | calé sur les lignes par `lh` + Capsize |
| Écriture | Caveat (lisibilité), SVG `<text>` dont `y` est la ligne de base | Playwrite France Traditionnelle |
| Couleurs d'écriture | Bleu = élève, rouge = correction de Tom ; plus de vert en annotation | vert « validé » |
| Traits | Barré et souligné : chemins SVG simples tracés par `pathLength` de Motion | perfect-freehand hors ligne |
| Date | Manuscrite dans la marge, sous la bande de tête | après la marge, dans l'en-tête |
| Header | Bande de tête collante après l'ouverture ; menu mobile en `Sheet` shadcn | intercalaires tirés au scroll |
| Icônes | `lucide-react` conservé, usages réduits | jeu maison de 13 icônes |
| Exercice | Sur la première page, en fiche collée | dans le hero |
| Contact | `contact@tomia.fr` partout | `contact@tomai.fr` |

« Il ne donne pas la réponse » reste exact : l'échelle d'indices ne donne jamais la réponse
de l'exercice de l'élève lui-même (`2026-09-22-agent-ia.md` §4). Aucun texte de la landing
ne dit « jamais la réponse » sans préciser « de ton exercice ».

## 1. Fondations

### Tokens (`packages/tokens/theme.css`)

Livrés (commit `f227e6b`) : `background` `#FCFCFA`, `card` `#FFFFFF`, `note` `#FFF3B0`,
`input` `#7F8BB8` (3,25:1, WCAG 1.4.11), ratios prouvés par
`packages/tokens/contrast.test.mjs`. Le bureau autour du cahier utilise `secondary`.

### Feuille (`apps/landing/app/globals.css`, `components/notebook/sheet.tsx`)

- `--cell: 2rem`, `--rule: 0.5rem`, `--band: 6rem` (4rem en mobile), `--margin-x: 6rem`
  (3.5rem en mobile).
- Une feuille = un composant `Sheet` (fond `background`, `display: flow-root`) portant
  trois calques décoratifs `aria-hidden` :
  - horizontales : fortes tous les `--cell`, fines tous les `--rule`, sur toute la largeur,
    à partir de `--band` pour la première et la dernière feuille ;
  - verticales : tous les `--cell`, sur toute la hauteur, à droite de la marge seulement ;
  - marge : 2 px `annotation` à `left: var(--margin-x)`, sur une verticale.
- Le cahier (couvertures et feuilles) a une largeur maximale de 80rem, centré sur le bureau.
- Trois feuilles par page d'accueil : première page (dans l'ouverture), corps, dernière
  page (dans la fermeture). La hauteur de la scène épinglée vaut
  `round(down, 100svh, 2rem)` (repli `100svh`) pour que la première feuille se raccorde
  au corps sur une ligne forte. `round()` : Baseline newly available depuis 2024-05-17
  (https://web-platform-dx.github.io/web-features-explorer/features/round-mod-rem/).
  La dernière feuille est une nouvelle page, avec sa propre bande de tête.
- Pages secondaires (`/aide`, `/faq`, légales) : une seule feuille, jamais imbriquée.
- Cartes et fiches : ombre, jamais `border`.

### Fiche collée (`components/notebook/fiche.tsx`)

- Papier `card`, rotation `--tilt` (−1° à 1,5°), ombre portée, ruban adhésif en
  pseudo-élément ; variante `note` (post-it, sans ruban, texte en Caveat).
- Entrée « collée » : chute de 12 px, rotation qui se pose, fondu ; `animate` de Motion au
  premier passage dans la vue (`whileInView`, `viewport={{ once: true }}`), décalage de
  0,1 s entre fiches voisines.
- Le texte composé suit l'échelle Tailwind de la landing ; aucune contrainte de ligne de
  base.

### Pages légales et contact

Livrés (commit `a8d3d94`) : pages légales mises en forme sans `prose`, contact
`contact@tomia.fr`, promesses limitées à la V1.

## 2. Couvertures et en-tête

### Ouverture (`components/notebook/opening.tsx`)

- Conteneur haut de 200svh ; scène `position: sticky` qui contient la première feuille
  et, par-dessus, la couverture.
- Couverture : fond `primary` texturé, charnière à gauche (`transform-origin: left`),
  logo, nav, `h1` « Le tuteur qui ne donne pas la réponse. », accroche, étiquette
  « Nom / Classe / Matière » en Caveat portant le formulaire `joinWaitlist`, invite
  « Ouvrir le cahier ».
- `useScroll({ target, offset: ["start start", "end end"] })` et `useTransform` de Motion
  (https://motion.dev/docs/react-scroll-animations) : `rotateY` 0 → −100° sur toute la
  course ; opacité des réglures 0 → 1 entre 15 et 60 % ; `scaleY` de la marge 0 → 1 entre
  35 et 80 % ; ombre de charnière qui s'efface. Au-delà de 50 %, couverture `inert`.
- À 85 %, la première page s'écrit (§3) et sa fiche se colle.

### Fermeture (`components/notebook/closing.tsx`)

- Même mécanique, charnière à droite : on referme le cahier par son dos. Dernière feuille
  (titre manuscrit « À bientôt ! », fiche d'inscription), puis la quatrième de couverture
  (`transform-origin: right`) tourne de 100° à 0 entre 30 et 100 %.
- Quatrième de couverture = `<footer>` : liens Produit, Aide, Légal, « Hébergé dans l'Union
  européenne », © ; `inert` tant qu'elle est à moins de 50 %.

### En-tête (`components/layout/header.tsx`)

- Après l'ouverture, la bande de tête (sans horizontales) porte logo, nav et CTA et reste
  collée (`position: sticky`), fond `background`, liseré bas `border`.
- Mobile : bouton menu → `Sheet` shadcn ; cibles 44 px.
- Sur la couverture, la nav de la couverture remplace l'en-tête.

### Mouvement réduit et sans JS

Sous `useReducedMotion()` (https://motion.dev/docs/react-accessibility) ou sans JS :
aucune épingle, couverture rendue comme un bloc plein écran, réglure et marge visibles,
écriture et fiches dans leur état final, quatrième de couverture en footer ordinaire.

## 3. Écriture

### Primitive (`components/notebook/hand.tsx`, `lib/motion.ts`)

- Une ligne manuscrite = un `<text>` SVG en Caveat (`next/font/google`, variable, `latin`,
  `display: swap`) dont l'attribut `y` est un multiple de `--cell` : la ligne de base tombe
  sur une ligne forte, sans métrique de police.
- Les lignes sont écrites dans le contenu (pas de césure calculée) ; une ligne tient à
  320 px de large.
- Le haut du SVG est recalé sur une ligne forte de sa feuille par un `ResizeObserver`
  (marge haute complétée au multiple de `--cell` suivant).
- Marques :
  - **correction** : barré rouge sur le mot, puis la correction écrite en rouge dans
    l'interligne au-dessus (ligne forte précédente, corps × 0,78) ; une seule par page ;
  - **souligné** : trait bleu sous un titre.
  Les positions viennent de `getStartPositionOfChar` / `getEndPositionOfChar` du `<text>`.
- Écriture : révélation gauche → droite par `clipPath: inset()` animé avec Motion, durée
  proportionnelle à la longueur ; traits par `pathLength`
  (https://motion.dev/docs/react-svg-animation). Un tracé à la fois dans un même bloc.
- Accessibilité : le texte existe dans le DOM (titre `sr-only` ou `aria-label`) ; SVG
  `aria-hidden`.

### Date

Dans la marge, deux lignes « Mercredi / 23 sept. » sur les lignes 2 et 3 sous la bande,
« 23/09 » si la marge fait moins de 80 px. Calculée au rendu, fuseau `Europe/Paris`, page
revalidée toutes les heures.

## 4. Première page et sections

- **Première page** : « Il pose les questions, / votre enfant ~~recopie~~ » avec
  « trouve seul » en correction rouge ; à droite (dessous en mobile), l'exercice en fiche
  collée.
- **Exercice** (fiche « exemple interactif ») :
  1. Énoncé « 3x + 5 = 20 » ; question « Tu commences par quoi ? » ; trois choix en groupe
     de radios (cibles 44 px) : « Diviser par 3 », « Enlever 5 des deux côtés »,
     « Ajouter 5 ».
  2. Mauvais choix : Tom monte d'un palier, en rouge — relance (« Qu'est-ce qui gêne pour
     isoler x ? »), indice conceptuel (« On peut faire la même opération des deux
     côtés. »), indice ciblé (« Le + 5 est en trop à gauche. »). Jamais la solution.
  3. Bon choix : « 3x = 15 » en bleu, nouvelle question, puis « x = 5 ».
  4. Fin : « Trouvé seul ! » en rouge ; bouton « Rejouer ».
  Répliques annoncées par `aria-live="polite"` ; le focus passe au groupe suivant.
- **Sections** (Problème, Méthode, Modes de saisie, Parents, Confiance, Tarifs, FAQ) :
  titre manuscrit souligné, contenu en fiches collées ; au plus un post-it par section.
  La méthode décrit l'échelle d'indices (relance, indice, étape intermédiaire, exemple
  analogue résolu). Parents : fiche « Le carnet de liaison ». FAQ : `Accordion` shadcn
  dans une fiche.
- La démo en bulles (`chat-demo.tsx`) est supprimée.

## 5. Contraintes

Inchangées : tokens uniquement (hors constantes de l'OG image), thème clair, site
statique, frontière landing (seule intégration serveur : `joinWaitlist`), composants UI via
shadcn, cibles 44 px, contraste AA, fichiers < 400 lignes, collège 6e → 3e, `BRAND_NAME`,
pas de dépendance runtime nouvelle.

## 6. Livraison

Quatre PR courtes, empilées sur `feat/landing-cahier-annote-pages` :

1. Fondations : `Sheet` une fois par page, `Fiche`, retrait du rythme `lh` et de la
   réglure par section, débordement des tarifs, feuille imbriquée de `/aide`.
2. Couvertures : ouverture, fermeture, en-tête collant.
3. Écriture : Caveat, `Hand`, date en marge, première page et exercice.
4. Sections en fiches collées.

Chaque PR : typecheck, lint, build, test de contraste, `test:grid` ; passe visuelle Chrome
(375, 768, 1440 ; reduced-motion ; clavier) ; captures dans la PR.

## 7. Tests

- `@repo/tokens` : paires de contraste.
- `pnpm --filter landing test:grid` (Playwright, local) : marge sur une verticale ;
  `y` de chaque `<text>` manuscrit + haut du SVG ≡ 0 mod 32 depuis le haut de sa feuille ;
  aucune feuille imbriquée ; aucun débordement horizontal à 375, 768 et 1440 ; sous
  reduced-motion, couvertures non épinglées et contenu final visible.
- La logique de l'exercice (transitions, paliers) en fonctions pures testées avec
  `node:test`.

## Hors périmètre

Icônes PNG et favicon (chantier branding), nom définitif du produit, View Transitions
entre pages, timeout du fetch de `joinWaitlist` (PR séparée).
