# Landing — démonstration de l'IA : plan des PR 4 à 6

**Spec :** `specs/2026-09-24-landing-kompri-design.md` (révision du 2026-09-30), qui applique
`specs/2026-09-24-identite-kompri-design.md` (charte, § 2 à § 4 et § 7).

**But :** la landing montre ce que fait l'IA par un échange d'exemple ; Tom devient un plus ;
la liste d'attente, cassée en production, disparaît ; aucun bouton sans destination jusqu'à
l'ouverture de l'app (lot 3).

## Contraintes communes

- Tokens uniquement, thème clair, aucune dépendance nouvelle, Motion pour toute animation.
- Signes d'école : un surlignage par titre, une note manuscrite par section, numéros entourés.
- Aucune promesse au-delà de l'agent V1 : pas de « jamais la réponse » ; « jamais la réponse
  de son exercice » est exact (`specs/2026-09-22-agent-ia.md` § 4).
- Fichiers de moins de 400 lignes ; zéro commentaire sauf un « pourquoi » ; aucun
  `eslint-disable`.
- Avant chaque commit : `cd apps/landing && pnpm typecheck && pnpm lint`, puis `pnpm exec
  knip` à la racine (sortie dans un fichier de log, exit code lu).
- Avant chaque PR : `pnpm --filter landing test:e2e` ; captures à 375, 768 et 1440 px, avec
  mouvement réduit, en faisant défiler la page avant la capture (les révélations attendent
  la vue).
- `docs/superpowers/suivi.md` mis à jour dans chaque PR.

---

## PR 4 — Retrait de la liste d'attente

Branche `feat/landing-drop-waitlist`.

**Pourquoi d'abord :** le formulaire échoue en production (`api.tomia.fr` répond 404). Le
retirer est un correctif ; il libère le hero pour la PR 5.

1. **Supprimer** `components/molecules/waitlist-form.tsx`, `lib/actions/waitlist.ts`,
   `lib/urls.ts` s'il n'a plus d'usage, `components/molecules/mobile-cta-bar.tsx`,
   `components/sections/cta.tsx`, `tests/waitlist.spec.ts`, `tests/cta.spec.ts`.
2. **Retirer les usages** : le formulaire du hero ; le bouton « S'inscrire » de
   `header.tsx` et de `mobile-menu.tsx` ; le bouton des cartes de `pricing.tsx` ; `<CTA />`
   de `app/page.tsx` ; `<MobileCTABar />` du layout ; toute ancre `#waitlist`.
3. **Confidentialité** (`app/confidentialite/page.tsx`) : retirer « liste d'attente » des
   données du site vitrine et de la base légale « Liste d'attente et contact », qui devient
   « Contact — consentement ». Mettre à jour la date de la page.
4. **Tests** : un test garde qu'aucun lien de la page ne pointe vers `#waitlist` et
   qu'aucun `<form>` n'est rendu sur `/`. Adapter `menu.spec.ts` et les tests de cibles si
   leurs sélecteurs visaient « S'inscrire ».
5. **Doc** : `apps/landing/CLAUDE.md` (la frontière : plus d'appel serveur ; en lot 3, le
   bouton « Commencer gratuitement »), `README.md` racine si la liste d'attente y figure ;
   `suivi.md` : ligne de la PR, et en « Reporté » la route `/api/waitlist`, sa table et son
   test côté serveur (lot 3), ainsi que la variable `NEXT_PUBLIC_SERVER_URL` de Vercel à
   retirer par Victor.

Vérifier : `grep -rn "waitlist\|WaitlistForm\|joinWaitlist\|S'inscrire" apps/landing` ne
renvoie plus rien hors du suivi.

## PR 5 — Hero et échange d'exemple

Branche `feat/landing-demo-exchange`.

1. **`components/sections/demo-exchange.tsx`** : carte `card`, `rounded-2xl`, `ring-1
   ring-border`, titre « Exemple de séance » en `text-sm font-bold text-muted-foreground`.
   Les huit messages de la spec § 1, en liste (`<ol>`) : Tom à gauche avec son avatar
   (`assets/tom-tete.png`, `next/image`, `sizes="32px"`, `alt=""`) sur `card` ; l'élève à
   droite sur `primary`, texte `primary-foreground`. `x` en `<i>`. La note finale en
   `HandNote`. Chaque message entre à la vue avec `FadeIn` (délai croissant, bornes de
   `lib/motion.ts`) ; tous visibles sans JavaScript.
2. **`hero.tsx`** : badge ; `<h1>` « Il trouve la réponse. Et il la comprend. » avec
   `Highlight` sur « il la comprend » ; accroche de la spec ; les deux signaux ; colonne de
   droite : `DemoExchange`, et en `lg` et plus `TomIllustration` plus petit, posé à côté de
   la carte (`hidden lg:block`). La `HandNote` du hero est retirée.
3. **`tom-illustration.tsx`** : retirer `preload` (l'échange est le contenu principal) ;
   accepter une taille plus petite par `className`.
4. **Tests** (`tests/hero.spec.ts`, réécrit) : à 1440 px, l'échange commence dans le premier
   écran et Tom est à côté ; à 375 px, l'échange suit l'accroche et Tom entier n'est pas
   rendu visible ; sans JavaScript et sous mouvement réduit, les huit messages sont visibles
   (`reveals.spec.ts`) ; aucun décalage de mise en page au chargement ; un seul surlignage
   dans le `<h1>` (`signs.spec.ts`). Le test d'animation de Tom est gardé.
5. **Image Open Graph** : le titre suit le nouveau `<h1>`.

## PR 6 — Sections

Branche `feat/landing-sections`.

1. **`how-it-works.tsx`** : les trois étapes de la spec § 1 ; l'étape 1 nomme photo, voix
   et clavier ; `input-modes.tsx` et son import supprimés ; titres de carte en `text-xl`.
2. **Titres de carte** : `pricing.tsx` et `parents.tsx` en `text-xl` (charte § 3) ; le nom de
   formule de `pricing.tsx` peut rester plus grand s'il s'agit d'un prix affiché, à trancher
   à la passe visuelle.
3. **Vides** : resserrer `problem.tsx` et `parents.tsx` (espacements Tailwind, pas de
   valeur à la main), vérifié par capture.
4. **Tests** : `type.spec.ts` couvre la taille des titres de carte ; les tests de cibles et
   de défilement horizontal repassent.

## Après : lot 3

La PR qui ouvre l'app ajoute « Commencer gratuitement » partout (en-tête, menu, barre
mobile, hero, tarifs, appel final sur `card`), vers l'inscription de l'app, et supprime la
route `/api/waitlist` côté serveur.
