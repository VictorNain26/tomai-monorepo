# Landing — refonte sur l'identité

Date : 2026-09-24, révisée le 2026-09-30. Applique la charte
(`2026-09-24-identite-kompri-design.md`) à la landing, en ligne sur `www.tomia.fr`.

## Intention

Un parent arrive et voit, en quelques secondes, **ce que fait l'IA** : elle fait trouver son
enfant au lieu de lui donner la solution. L'atout du produit est cette méthode ; Tom en est
le visage, **un plus, pas l'argument de vente**. La page le montre par un échange d'exemple
plutôt qu'elle ne l'affirme, et décrit l'échelle d'indices de l'agent
(`2026-09-22-agent-ia.md` § 4) sans promettre « jamais la réponse » : Tom ne donne jamais
la réponse de l'exercice de l'élève, mais peut dérouler un exemple analogue.

Critères de réussite :
- au-dessus de la ligne de flottaison, en bureau comme en mobile : le bénéfice et la
  démonstration ;
- aucune formule qui dépasse ce que fait l'agent V1 ;
- signes d'école dans les bornes de la charte (§ 4) ; une seule balise `<h1>` par page ;
- état final complet sans JavaScript et sous `prefers-reduced-motion` ;
- aucun bouton sans destination.

## Décisions

| Sujet | Décision |
|---|---|
| Hero | Titre du bénéfice, accroche qui nomme l'IA et le collège, échange d'exemple ; Tom animé à côté en bureau |
| Échange d'exemple | Composant de la landing, statique, au style du chat de l'app (charte § 7), marqué « Exemple » |
| Tom | Présent par sa tête dans l'échange ; en entier (salut, respiration) seulement dans le hero en bureau |
| Liste d'attente | **Retirée** : son formulaire échoue en production (`api.tomia.fr` répond 404) et Victor lance la page avec l'app |
| Appel à l'action | Un seul, « Commencer gratuitement », vers l'inscription de l'app ; ajouté par la PR qui ouvre l'app (lot 3), pas avant |
| Comment ça marche | Trois étapes qui décrivent l'échelle d'indices ; les modes de saisie (photo, voix, clavier) entrent dans l'étape 1 |
| Appel final | Retiré avec la liste d'attente ; revient en lot 3 avec le bouton, sur une carte `card`, pas sur un bloc noir |
| Fond, cartes, polices, signes d'école | Charte § 2 à § 4 (livrés en PR 1 et 2) |
| Nom, marque, métadonnées | `BRAND_NAME`, tête de Tom en logo et en icônes, `metadata` par page (livrés en PR 3a) |

## 1. Première page

Ordre : Hero, Problème, Comment ça marche, Parents, Confiance, Tarifs, FAQ.

**Hero.**
- Badge « Collège, de la 6e à la 3e ».
- Titre : « Il trouve la réponse. Et il la comprend. », « il la comprend » surligné.
- Accroche : « Une IA qui accompagne votre enfant dans ses devoirs comme un bon professeur :
  une question, puis un indice, à son niveau, jusqu'à ce qu'il trouve seul. »
- Les deux signaux actuels (hébergement UE, gratuit pour commencer).
- À droite en bureau, dessous en mobile : l'échange d'exemple. En bureau (`lg` et plus), Tom
  entier (`TomIllustration`, plus petit qu'aujourd'hui) se tient à côté de la carte ; en
  mobile, seule sa tête reste, dans les messages.
- La note manuscrite « c'est toi qui l'écris ! » quitte le hero : elle devient la note de
  Tom à la fin de l'échange.

**Échange d'exemple** (`components/sections/demo-exchange.tsx`). Une carte `card` titrée
« Exemple de séance », qui déroule l'échelle d'indices sur un exercice de 4e :
1. l'élève : « 3x + 5 = 20. J'ai trouvé x = 20/3, mais c'est faux. » ;
2. Tom repère l'erreur : « Tu as divisé 20 par 3 directement. Qu'est-ce qui accompagne
   encore le 3x, à gauche du signe égal ? » ;
3. l'élève : « Le + 5 ? » ;
4. Tom, indice : « Oui. Que fais-tu de ce 5, des deux côtés, pour garder 3x seul ? » ;
5. l'élève : « J'enlève 5 : 3x = 15, donc x = 5. » ;
6. Tom : « Vérifie : combien font 3 × 5 + 5 ? » ;
7. l'élève : « 20. C'est bon ! » ;
8. note manuscrite de Tom : « c'est toi qui l'as trouvé ! ».

Messages de Tom sur `card` avec sa tête (avatar `tom-tete.png`), ceux de l'élève sur
`primary`, à droite. Formules en texte, `x` en italique : pas de KaTeX pour un exemple
statique. Les messages entrent l'un après l'autre à l'entrée dans la vue (Motion, déjà en
dépendance), et sont tous visibles sans JavaScript et sous mouvement réduit.

**Comment ça marche** (`how-it-works.tsx`), trois cartes aux numéros entourés :
1. « Il pose sa question » — une photo de l'exercice, sa voix ou le clavier, dans n'importe
   quelle matière (remplace la section `input-modes.tsx`, supprimée) ;
2. « Tom cherche où ça coince » — puis une question, un indice, une étape, à son niveau ;
   jamais la réponse de son exercice ;
3. « Il trouve seul » — et ce qu'il a compris revient en révision au bon moment.

**Autres sections.** Problème, Parents, Confiance, Tarifs et FAQ gardent leur texte. Leurs
titres de carte passent à `text-xl` (charte § 3) ; les vides entre titre et cartes de
Problème et Parents se resserrent. Tarifs : plus de bouton jusqu'au lot 3.

## 2. Structure commune

En-tête, menu mobile et barre d'action mobile perdent « S'inscrire » : le bouton revient en
lot 3 sous le libellé unique. Pied de page inchangé. La politique de confidentialité retire
la liste d'attente des données et des bases légales.

## 3. Tom

`components/atoms/tom-illustration.tsx` : `assets/tom.png` (première image des
animations, `next/image`, préchargé), puis le salut enchaîné sur la respiration en boucle
(`public/tom/`), deux sources par vidéo, HEVC avec alpha (`.mov`) d'abord pour Safari, puis
WebM VP9 ([Jake Archibald](https://jakearchibald.com/2024/video-with-transparency/)). Le
conteneur porte le nom accessible. Dans le hero révisé, il n'est plus préchargé : l'échange
devient le contenu principal.

## 4. Nom et logo

Livré en PR 3a : `BRAND_NAME` partout où le nom s'affiche, `metadata` par page, image Open
Graph en Nunito, tête de Tom en logo, favicon et icônes. Reste la **PR 3b**, qui dépend du
nom : domaine (`metadataBase`, `sitemap.ts`, `robots.ts`, mentions légales,
`CONTACT_EMAIL`, JSON-LD) et logotype en tracés SVG (fontTools). Préalable : nom tranché,
domaine réservé et relié à Vercel, boîte de contact créée (actions de Victor).

## 5. Contraintes

Tokens uniquement (hors valeurs animées par Motion et image Open Graph), thème clair, site
statique, primitives interactives via `@repo/ui`, cibles de 44 px, contraste AA, fichiers de
moins de 400 lignes, aucune promesse au-delà de la V1. **Frontière** : sans liste d'attente,
la landing n'appelle plus le serveur ; en lot 3, son seul lien vers le produit est le bouton
« Commencer gratuitement ».

## 6. Livraison

Livrées : PR 1 (fondations et pages, #325), PR 2 (première page, #326), Tom animé (#329),
PR 3a (constantes de marque, #331). Suivent, courtes, sur `main`, dans cet ordre (plan
`plans/2026-09-30-landing-demonstration.md`) :

4. **Retrait de la liste d'attente** : formulaire, Server Action, tests, ancres, boutons
   « S'inscrire », section d'appel final, confidentialité.
5. **Hero et échange d'exemple** : titre, accroche, `demo-exchange.tsx`, Tom plus petit à côté.
6. **Sections** : Comment ça marche en échelle d'indices, `input-modes.tsx` supprimé,
   titres de carte, vides resserrés.

Puis **lot 3** : « Commencer gratuitement » partout (en-tête, menu, barre mobile, hero,
tarifs, appel final sur `card`), vers l'inscription de l'app. **3b** dès que le nom est
tranché.

Chaque PR : typecheck, lint, build, tests ; passe visuelle à 375, 768 et 1440 px, avec
mouvement réduit et au clavier ; captures dans la PR.

## 7. Tests

Suite Playwright (`pnpm --filter landing test:e2e`) : aucun défilement horizontal ; cibles
de 44 px ; sans JavaScript, chaque bloc révélé visible ; sous mouvement réduit, chaque
révélation finit opaque et en place ; aucun décalage de mise en page au chargement ; un seul
`<h1>` par page ; lignes légales de 85 caractères au plus ; questions de FAQ sur trois
lignes au plus à 375 px. S'ajoutent : l'échange d'exemple entièrement visible sans
JavaScript et sous mouvement réduit, et qui commence dans le premier écran à 1440 px ; aucun lien
vers `#waitlist`. En PR 3b : aucune occurrence de « TomIA » dans le HTML rendu.

## Hors périmètre

La production de Tom (dépôt `tom-mascotte`), l'app, la suppression côté serveur de la route
`/api/waitlist` et de sa table (lot 3), les View Transitions entre pages.
