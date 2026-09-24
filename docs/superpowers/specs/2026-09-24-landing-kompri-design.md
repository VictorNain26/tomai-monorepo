# Landing Kompri — refonte sur la nouvelle identité

Date : 2026-09-24. Applique `2026-09-24-identite-kompri-design.md` (nom, couleurs,
typographies, signes d'école, Tom, logotype) à la landing. Maquette validée : écran
`direction-retenue` du brainstorming du même jour (nav, hero, trois étapes). Remplace les
directions « cahier annoté » et « copie corrigée ».

## Intention

Un parent arrive, lit en dix secondes que Tom aide son enfant à trouver la réponse au lieu
de la donner, et repart avec une impression chaleureuse et humaine. La page est une page de
marque ordinaire, sur papier crème : l'école ne vient que par trois signes rares (surligneur,
numéros entourés, une note manuscrite). Plus de feuille Seyès, de marge, de fiches collées
ni de couvertures.

Critères de réussite :
- aucun reste du cahier dans le code : ni `NotebookSheet`, ni `Fiche`, ni utilitaires
  `sheet-*`, ni variables `--cell`, `--band`, `--margin-x` ;
- signes d'école dans les bornes de l'identité (§ 4) : un surlignage au plus par titre, une
  note manuscrite au plus par section ;
- une seule balise `<h1>` par page, pages secondaires comprises ;
- état final complet sans JavaScript et sous `prefers-reduced-motion` ;
- la place de Tom est prête : quand les images arrivent, un seul composant change et la
  mise en page ne bouge pas ;
- aucune dépendance runtime nouvelle ; aucun composant d'animation maison au-delà de ceux
  qui existent.

## Décisions

| Sujet | Décision |
|---|---|
| Fond, cartes | Tokens de l'identité § 2 ; cartes `card` à coins doux et ombre légère, comme la maquette |
| Polices | Nunito (texte et titres) et Caveat (notes), par `next/font/google` ; Figtree et Fraunces retirées |
| Hero | Badge « Collège, de la 6e à la 3e », titre de la maquette, note manuscrite, formulaire, Tom à droite |
| Tom | Composant `TomIllustration` ; en attendant les images, un disque `secondary` décoratif de même taille |
| Étapes | « Comment ça marche » en trois étapes numérotées cerclées, la troisième en vert |
| Traits | `Scribble` ne garde que le cercle ; soulignés et barré deviennent surlignage ou disparaissent |
| Note manuscrite | `MarginNote` devient `HandNote` : Caveat, `annotation`, légère inclinaison |
| Démo en bulles | `chat-demo.tsx` supprimé |
| Pages secondaires | Colonne de lecture sur le papier, titre en `<h1>` ; plus de feuille ni de fiche |
| Menu mobile | `Sheet` de `@repo/ui`, repris de la branche `feat/landing-couvertures` |
| Formulaire | Non contrôlé, repris de la même branche : la saisie faite avant l'hydratation est gardée |
| Nom | Provisoire : constantes de `apps/landing/lib/brand.ts` (`TomIA`, mascotte `Tom`) jusqu'à la décision de Victor |
| Logo | Provisoire, comme le nom ; pas de logotype tant que le nom n'est pas tranché |

## 1. Fondations

**Tokens** (`packages/tokens/theme.css`) : les trois changements de l'identité § 2
(`background`, `secondary`/`muted`/`accent`, `card`/`popover`) ; `--font-sans` et
`--font-heading` pointent tous deux vers Nunito, et `--font-hand` est ajouté pour Caveat.
`packages/tokens/contrast.test.mjs` couvre les nouvelles paires de fond. Le commentaire
« Copie corrigée » du fichier est mis à jour.

**Polices** (`apps/landing/app/layout.tsx`) : Nunito (axe `wght`) et Caveat (graisse 600)
remplacent Figtree et Fraunces. Titres en 800, texte en 400, libellés et boutons en 700.

**Feuille retirée** : `components/notebook/` (`NotebookSheet`, `Fiche`), les utilitaires
`sheet`, `sheet-rules`, `sheet-verticals`, `sheet-margin`, `fiche-tape` et les variables
`--cell`, `--rule`, `--band`, `--margin-x` de `app/globals.css`. L'utilitaire `container`
reprend des marges latérales fixes : 16 px en mobile, plus larges ensuite. Les
utilitaires `legal-copy`, la sélection en `highlight` et le focus visible restent.

**Mouvement** : `FadeIn` reste le seul révélateur de section. Ses durées et celles de
`Scribble` passent par les constantes de `lib/motion.ts`, au lieu de valeurs écrites en dur.

## 2. Structure commune

- **En-tête** (`components/layout/header.tsx`) : logotype à gauche ; liens « Comment ça
  marche », « Parents », « Tarifs » ; bouton « S'inscrire » vers `#waitlist`. En mobile, le
  menu s'ouvre dans le `Sheet` de `@repo/ui` (composant et `mobile-menu.tsx` repris de
  `feat/landing-couvertures`, avec leur `<nav>` étiquetée). Fond `background` translucide
  au défilement, comme aujourd'hui.
- **Pied de page** (`components/layout/footer.tsx`) : inchangé dans son contenu, sur fond
  `secondary`.
- **Pages secondaires** (`aide`, `faq`, `contact`, `cgu`, `confidentialite`,
  `mentions-legales`) : `PageLayout` rend une colonne de lecture sur le papier, avec le titre
  en `<h1>` (`SectionHeader` reçoit le niveau de titre en paramètre). Ferme le point reporté
  de la PR 1 du 2026-09-23.
- **Page 404** (`app/not-found.tsx`) : reprise de `feat/landing-couvertures` (repère
  `<main>`, pied de page, titre de document).

## 3. Première page

Ordre des sections inchangé : Hero, Problème, Comment ça marche, Modes de saisie, Parents,
Confiance, Tarifs, FAQ, appel final. Les textes restent ceux de `main`, sauf ci-dessous.

- **Hero** : badge « Collège, de la 6e à la 3e » (`success` sur `card`) ; titre « Tom ne
  donne pas la réponse. Il aide votre enfant à la trouver. », « la trouver » surligné ;
  paragraphe d'accroche actuel ; note manuscrite « c'est toi qui l'écris ! » ; formulaire
  d'inscription ; les deux autres signaux actuels (hébergement UE, gratuit pour commencer)
  sous le formulaire. `TomIllustration` (pose « bonjour ») à droite, dessous en mobile.
  « Tom ne donne pas la réponse » reste exact au sens de `2026-09-22-agent-ia.md` § 4.
- **Problème** : « L'oublier aussi. » passe du souligné au surligné.
- **Comment ça marche** (`how-it-works.tsx`) : trois étapes de la maquette, en cartes.
  1. « Il pose sa question » — une photo de l'exercice ou quelques mots, dans n'importe
     quelle matière.
  2. « Tom le guide » — une question, puis un indice, puis un autre, à son niveau de la 6e
     à la 3e ; jamais la réponse de son exercice.
  3. « Il trouve seul » — et ce qu'il a compris revient en révision au bon moment, jusqu'au
     contrôle.
  Numéros cerclés de rouge, le troisième de vert (`Scribble kind="circle"`, tracé par
  Motion). Aucun surlignage dans le corps des étapes.
- **Parents** : « sans lire par-dessus son épaule » passe du souligné au surligné.
- **Confiance** : la note « Ce qu'on s'engage à faire, et à ne pas faire. » devient une
  `HandNote` ; « ne sont pas un produit » reste surligné.
- Les autres sections gardent leur contenu et prennent les cartes de la maquette.

## 4. Tom

`components/atoms/tom-illustration.tsx` expose `TomIllustration({ className })`, la pose
« bonjour » du hero, seule utilisée par la landing. En attendant l'image, il rend un disque
`secondary` décoratif (`aria-hidden`), dans une boîte carrée de la taille finale. À la
livraison du SVG, le composant l'affiche avec un `alt` qui décrit la pose, et rien d'autre ne
change. Les autres poses arriveront avec l'app, qui en aura l'usage.

Le disque et sa place dans la mise en page sont provisoires eux aussi : Victor n'a pas encore
arrêté la mascotte ni où elle se place dans le hero.

## 5. Nom et logo

Le nom du site et celui de la mascotte restent provisoires, derrière les constantes de
`apps/landing/lib/brand.ts` (valeur actuelle : « TomIA », mascotte « Tom »), jusqu'à la
décision de Victor. Le sujet se scinde en deux PR (§ 7) :

- **Indépendant du nom, PR 3a** : chaque « TomIA » écrit en dur (`cgu`, `confidentialite`,
  `public/manifest.webmanifest`) et le nom de la mascotte passent par la constante ; image
  Open Graph (`app/opengraph-image.tsx`) en Nunito à la place de Fraunces.
- **Dépend du nom, PR 3b** : domaine (`metadataBase`, `sitemap.ts`, `robots.ts`, mentions
  légales, `CONTACT_EMAIL`), logotype (converti en tracés par fontTools, trois fichiers SVG
  sous `apps/landing/public/brand/`), icônes (`app/icon.svg`, `apple-icon.png`,
  `icon-192.png`, `icon-512.png`, `favicon.ico`, `theme_color` du manifeste). Préalable :
  nom tranché, domaine réservé et relié à Vercel, boîte de contact créée (actions de
  Victor).

## 6. Contraintes

Inchangées : tokens uniquement (hors valeurs animées par Motion et image Open Graph),
thème clair, site statique, frontière landing (seule intégration serveur : `joinWaitlist`),
primitives interactives via `@repo/ui`, cibles de 44 px, contraste AA, fichiers de moins de
400 lignes, aucune promesse au-delà de la V1.

## 7. Livraison

Quatre PR courtes, sur `main`, dans cet ordre :

1. **Fondations et pages** : tokens, polices, retrait de la feuille, en-tête, pied de page,
   pages secondaires en `<h1>`, 404, formulaire non contrôlé, nouvelle suite de tests. Au
   démarrage, fermeture de la PR `feat/landing-couvertures` (avec accord), dont les pièces
   ci-dessus sont reprises.
2. **Première page** : hero, étapes, `TomIllustration`, `HandNote`, `Scribble` réduit au
   cercle, suppression de `chat-demo.tsx`, sections restylées.
3a. **Constantes de marque** (§ 5) : ne dépend pas du nom choisi, démarrable dès maintenant.
3b. **Nom définitif** (§ 5) : domaine, adresse de contact, logotype, icônes. Démarre une
    fois le nom tranché par Victor.

Entre les PR 1 et 2, la première page de `main` est dans un état intermédiaire (nouvelles
couleurs, anciens textes) : les deux PR se suivent sans pause. Chaque PR : typecheck, lint,
build, tests ; passe visuelle dans Chrome à 375, 768 et 1440 px, avec mouvement réduit et
au clavier ; captures dans la PR. Les specs et plans des directions « cahier annoté » et
« copie corrigée » sont supprimés dans la PR 1.

## 8. Tests

- `@repo/tokens` : paires de contraste sur les nouveaux fonds.
- Suite Playwright locale : `tests/grid.spec.ts` et le script `test:grid` sont remplacés par
  `tests/*.spec.ts` et un script `test:e2e`, sur les mêmes pages et largeurs (375, 768,
  1024, 1441). Restent : aucun défilement horizontal ; cibles de 44 px ; sans JavaScript,
  chaque bloc révélé visible et chaque trait tracé ; sous mouvement réduit, chaque révélation
  finit opaque et en place ; aucun décalage de mise en page au chargement ; lignes légales
  de 85 caractères au plus ; questions de FAQ sur trois lignes au plus à 375 px ; écart du
  libellé de tarif. S'ajoutent : un seul `<h1>` par page ; saisie de l'e-mail avant
  l'hydratation conservée (repris de `feat/landing-couvertures`) ; en PR 3b, aucune
  occurrence de « TomIA » dans le HTML rendu.
- `.claude/rules/testing-and-commits.md` et `apps/landing/CLAUDE.md` décrivent la nouvelle
  suite et le nouveau nom.

## Hors périmètre

Les images de Tom (génération par Victor, finition dans une PR à part), l'app, les View
Transitions entre pages, le délai d'expiration du `fetch` de `joinWaitlist`.
