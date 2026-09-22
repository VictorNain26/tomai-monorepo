# Charte « Cahier annoté » et refonte de la landing

Statut : design validé en conversation le 2026-09-22, spec à relire. Cadre produit :
`2026-09-22-cible-v1.md` ; périmètre fonctionnel annoncé : `2026-09-22-agent-ia.md`.

## Intention

La landing doit convaincre un parent que TomIA n'est pas « un ChatGPT qui fait les
devoirs ». L'identité actuelle (bleu `#2563EB` sur slate, shadcn par défaut) ne le dit
pas ; le langage visuel des produits IA 2025-2026 (dégradés violets, bento, verre
dépoli) non plus, il est devenu la norme.

Direction retenue : **Cahier annoté**. Tom n'écrit pas la réponse, il annote dans la
marge ; l'annotation au stylo est le motif visuel de toute la charte. Tendances
2026 qui la soutiennent : fonds « papier » plutôt que blanc pur, retour du serif
éditorial, typographie comme image du hero ([Figma](https://www.figma.com/resource-library/web-design-trends/),
[Fontfabric](https://www.fontfabric.com/blog/10-design-trends-shaping-the-visual-typographic-landscape-in-2026/)).

## Décisions

| Sujet | Décision |
|---|---|
| Portée de la charte | **Tout le produit** : `@repo/tokens` est réécrit, `apps/web` (lot 3) en hérite |
| Nom | **TomIA, provisoire** : wordmark = texte en fonte titre, nom dans une seule constante ; la décision « Nom de l'app » de la cible reste ouverte |
| Contenu | Réécrit ; ne promet que ce que les specs V1 prévoient |
| Périmètre annoncé | **Collège, 6e → 3e** (`2026-09-22-agent-ia.md`, périmètre V1) |
| Stack | Next.js, Tailwind v4, shadcn via `@repo/ui`, `motion` ; `next-themes` retiré |
| Thème | **Clair uniquement**, pour tout le produit : pas de mode sombre (décision du 2026-09-22) |
| Couleurs | **Les quatre couleurs du stylo Bic** sur papier : noir = texte, bleu = action, rouge = annotation du prof, vert = validé (décision du 2026-09-22, remplace le terracotta) |
| Intégration serveur | Inchangée : Server Action `joinWaitlist` → `POST /api/waitlist`, seul point de contact |

## Tokens `@repo/tokens`

Ratios de contraste WCAG calculés (formule de luminance relative WCAG 2.x) ; toute
paire texte/fond ci-dessous est ≥ 4,5:1.

### Couleurs

Le code de l'école : l'élève écrit en bleu, le prof corrige en rouge, le vert valide,
le noir porte le texte. Papier, sable et surligneur jaune complètent.

| Token | Valeur | Rôle | Contraste |
|---|---|---|---|
| `background` | `#FAF7F0` | papier | — |
| `foreground` et `*-foreground` des surfaces | `#1D1D22` | noir Bic : texte | 15,7 sur papier |
| `card`, `popover` | `#FFFDF8` | surfaces | fg 16,5 |
| `secondary`, `muted`, `accent` | `#F0EADD` | sable : blocs, badges | fg 14,0 |
| `muted-foreground` | `#5C5C66` | texte secondaire | 6,2 sur papier, 5,5 sur sable |
| `primary`, `ring` | `#1F3F9E` | bleu Bic : boutons, liens, focus | 8,7 sur papier, 7,7 sur sable |
| `primary-foreground` | `#FFFFFF` | texte sur bleu | 9,3 |
| `annotation` (nouveau) | `#C0282D` | rouge Bic : traits, mot corrigé, notes en marge, surtitres, marge du cahier | 5,5 sur papier, 4,9 sur sable |
| `success` | `#1B7337` | vert Bic : validé, confiance | 5,5 sur papier, blanc dessus 5,9 |
| `destructive` | `#B42318` | erreur | blanc dessus 6,6 |
| `warning` | `#E0A43A` | avertissement | noir dessus 7,0 |
| `info` | `#2B5C8A` | information | blanc dessus 7,0 |
| `violet` | `#6D3FC0` | registre élève (lot 3) | blanc dessus 6,7 |
| `highlight` | `#F9E08B` | surligneur sous le texte | noir dessus 12,8 |
| `border`, `input` | `#E7E0D2` | traits | — |
| `overlay` | `#000000` | inchangé | — |

`annotation` est distinct de `destructive` : même famille rouge, usages différents
(correction pédagogique contre message d'erreur), qui doivent pouvoir évoluer séparément.

Sur le bloc CTA noir, le texte papier à 80 % d'opacité tient 10,4:1 ; le bouton y passe
en papier, un bouton bleu sur noir ne ressortant qu'à 1,8:1 (sous le 3:1 exigé pour un
contrôle, WCAG 1.4.11).

Pas de mode sombre : `theme-dark.css` disparaît de `@repo/tokens`, avec la bascule et
`next-themes` dans la landing. Un futur mode sombre repartira de cette palette ; la
version sombre calculée pour le terracotta reste dans l'historique git.

### Typographie

- `--font-heading` : **Fraunces** (variable, axes `opsz` et `SOFT`), titres.
- `--font-sans` : **Figtree**, texte courant.
- `--font-mono` : **JetBrains Mono**, inchangé.

Chargement par `next/font/google` (les trois sont exposées par la version installée :
`node_modules/next/dist/compiled/@next/font/dist/google/index.d.ts`), qui expose des
variables CSS reliées aux tokens. Disparaissent : Inter et Plus Jakarta Sans chargés
dans `app/layout.tsx`, et `app/fonts/GeistVF.woff` / `GeistMonoVF.woff`, référencés
nulle part. La règle `.claude/rules/design-system.md` passe de « Poppins / Nunito Sans »
à « Fraunces / Figtree », ce qui supprime l'écart actuel entre règle, tokens et
landing.

### Forme et motion

- `--radius` : 0,75 → 1 rem, échelle `--radius-*` décalée d'autant. Boutons en
  pilule (`rounded-full`) via un changement du variant par défaut de `Button` dans
  `@repo/ui`.
- Durées `fast` / `base` / `slow` / `pulse` inchangées. Pas de token pour le tracé
  des annotations : `motion` prend ses durées en secondes dans le JS et ne lit pas
  une variable CSS, un token serait une valeur morte. La durée vit dans une
  constante unique de la landing (`lib/motion.ts`).
- Tout mouvement est coupé sous `prefers-reduced-motion` : état final affiché
  directement. `MotionConfig reducedMotion="user"` ne coupe que les transformations
  et le layout ([doc motion](https://motion.dev/docs/react-accessibility)) ; les
  tracés (`pathLength`) testent donc `useReducedMotion` eux-mêmes.
- Feuille à carreaux : utilitaire `bg-notebook` local à `apps/landing/app/globals.css`,
  carreaux bleu pâle dérivés de `primary` par `color-mix` ; marge rouge verticale
  (`annotation` à 40 %) fixe à gauche à partir de `md` (masquée sur mobile, où la
  gouttière ne fait que 16 px).

## Page d'accueil

Une idée par section. Les annotations au stylo rouge font le fil d'une section à l'autre.

1. **Hero** — plein écran (hauteur visible moins le header), contenu centré. Titre Fraunces : « Il ne donne pas la réponse. Il aide à la
   ~~trouver~~ *comprendre*. », le mot barré puis corrigé au stylo. Démo de
   conversation animée (l'élève demande la réponse d'un exercice, Tom répond par une
   question ; annotation en marge « méthode socratique »). Formulaire liste
   d'attente. Signaux : collège 6e → 3e, hébergé en UE, gratuit pour commencer.
2. **Le problème** — bandeau éditorial d'une phrase : « Copier une réponse prend
   10 secondes. L'oublier aussi. »
3. **Comment Tom guide** — trois temps numérotés à la main : il questionne ; il
   s'adapte à la classe et à la matière ; il fait réviser (répétition espacée).
4. **Photo, voix, texte** — l'élève photographie son exercice, parle ou écrit.
5. **Pour les parents** — résumé et alertes, **pas le verbatim** (matières, temps,
   difficultés) ; Pronote : devoirs, notes, emploi du temps.
6. **Confiance** — données en UE, RGPD, IA Mistral, aucune publicité, aucune
   revente ; mise en forme de note en marge.
7. **Tarifs** — Gratuit (volume limité chaque jour) et Complet (tarif annoncé aux
   inscrits). « 10 matières » est retiré tant que la liste V1 n'est pas figée.
8. **FAQ** — les huit questions actuelles relues, plus « Quelle IA utilisez-vous ? ».
   Toute affirmation factuelle (lieux d'hébergement, fonctionnalités) est vérifiée
   dans le code ou les specs avant d'être reprise. JSON-LD `FAQPage` conservé.
9. **CTA final** — formulaire liste d'attente sur un bloc à fond encre.

Pages secondaires (`aide`, `contact`, `faq`, `cgu`, `confidentialite`,
`mentions-legales`) : nouvelle charte via le layout, fond juridique inchangé.

### Composants

- **Supprimés** : `sections/stats.tsx`, `sections/problem-solution.tsx`,
  `atoms/animated-counter.tsx`, `atoms/rotating-text.tsx`,
  `atoms/background-pattern.tsx`.
- **Nouveaux** : primitives d'annotation décoratives (trait SVG qui se dessine,
  surligneur, note en marge), `aria-hidden`, sur `motion` et les tokens ; démo de
  conversation du hero ; sections 2 à 6 réécrites.
- **Conservés et restylés** : header, footer, `waitlist-form`, `mobile-cta-bar`,
  sélecteur clair/sombre, `faq`, `pricing`, `cta`.
- **SEO** : metadata mises à jour (collège, méthode socratique, IA européenne) ; OG
  image régénérée dans la charte via `next/og`.

### Contraintes

Les contraintes de `apps/landing/CLAUDE.md` et de `.claude/rules/design-system.md`
ont été relues contre ce design. Chacune est gardée pour ce qu'elle protège ; deux
sont reformulées là où leur lettre interdit ce design sans rien protéger.

| Contrainte | Sort | Raison |
|---|---|---|
| Tokens uniquement, aucune couleur, durée ou rayon littéral | **Gardée** | C'est ce qui rend la charte partageable avec `apps/web` et modifiable en un seul endroit |
| « Aucun composant UI custom : passer par shadcn » | **Reformulée** : les **primitives interactives** (bouton, champ, dialog, menu) passent par `@repo/ui` ; les composants de **composition** (sections, annotations, démo du hero) sont libres | shadcn apporte l'accessibilité des contrôles ; il ne fournit ni annotation ni démo de chat, et la lettre actuelle interdirait la page elle-même |
| « Aucun CSS custom ni style inline » | **Reformulée** : pas de valeur de style écrite à la main hors tokens. Deux exceptions nommées : les valeurs animées que `motion` pose lui-même dans `style`, et `app/opengraph-image.tsx` | `motion` anime par l'attribut `style`, c'est son mécanisme ; `ImageResponse` ne connaît que `style` et les propriétés CSS supportées par Satori ([doc Next 16.3](https://nextjs.org/docs/app/api-reference/functions/image-response), « Supported HTML and CSS features »), sans CSS variables. L'OG image importe ses couleurs d'une constante unique, recopiée de `theme.css` |
| États complets sur tout interactif, cibles ≥ 44 px, contraste AA | **Gardée** | Accessibilité ; 44 px dépasse le minimum AA (24 px, [WCAG 2.2 critère 2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)), choix assumé pour un public d'enfants et de parents sur mobile |
| Frontière stricte : pas d'Eden ni d'auth, seule la waitlist | **Gardée** | Empêche la landing de dériver en second produit |
| Aucun fichier au-delà de ~400 lignes | **Gardée** | |
| Patterns UX de la règle (skeletons, empty state, toast/dialog) | **Sans objet ici** | Ils visent l'app ; la landing n'a qu'un formulaire, dont les états sont couverts ci-dessus |

Les deux reformulations sont reportées dans `apps/landing/CLAUDE.md` et
`.claude/rules/design-system.md` par la PR L1.

L'OG image embarque une fonte Fraunces en `ttf` (formats acceptés : `ttf`, `otf`,
`woff`, même page de doc) ; les fichiers de `next/font/google` ne sont pas
réutilisables pour elle.

## Livraison

Worktree `.claude/worktrees/landing-cahier-annote`, branche
`feat/landing-cahier-annote` depuis `main` (la PR E1 avance en parallèle sur sa
branche). `docs/superpowers/suivi.md` gagne une ligne « hors lot 0 » dans chaque PR.

| PR | Contenu |
|---|---|
| **L1 — Charte** | `packages/tokens/theme.css` (`theme-dark.css` supprimé) ; fontes dans `app/layout.tsx` ; `globals.css` ; variant pilule de `Button` ; règle `design-system.md` et `apps/landing/CLAUDE.md` (typo, contraintes reformulées) ; suppression des `.woff` Geist |
| **L2 — Landing** | sections, primitives d'annotation, démo du hero, suppressions, metadata et OG image, pages secondaires |

L1 se relit seule parce qu'elle change `@repo/tokens`, partagé.

## Validation

Par PR :

- `pnpm typecheck`, `pnpm lint` (zéro warning) et `pnpm build` dans `apps/landing`,
  codes de sortie lus. La landing n'a pas de runner de test.
- Rendu réel : `pnpm dev`, captures Chrome à 375 px et 1440 px, clair et sombre ;
  `prefers-reduced-motion` émulé, animations coupées.
- Contrastes recalculés si un token change pendant l'implémentation.
- Liste d'attente de bout en bout contre le serveur local, et état d'erreur serveur
  éteint.
- Preview Vercel de la PR vérifiée avant merge.

Doc-first avant d'écrire le code : `next/og` (`ImageResponse`, fontes) et `motion`
(`pathLength`, `useReducedMotion`) via Context7, source citée dans le commit.

## Hors périmètre

- Le nom définitif du produit et un logo dessiné.
- L'application de la charte à `apps/web`, qui n'existe pas encore (lot 3).
- Le sort de `apps/landing` (conservée ou absorbée par `apps/web`), décision du lot 3.
