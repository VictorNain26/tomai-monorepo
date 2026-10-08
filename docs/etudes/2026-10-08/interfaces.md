# Étude des interfaces : l'app et le site (2026-10-08)

Victor a demandé le 2026-10-08 une étude des interfaces et du site, avant de reprendre le lot 3.
Parcours faits dans Chrome, le jour même, à 390 px de large (un cadre de même origine, la fenêtre
ne descendant pas sous 1 920 px) : le staging avec le compte de Victor, côté parent seulement ;
une stack locale (`bun run dev`, commit `724c1fac`) avec un parent et un élève de test, pour tout
le parcours, de l'invitation à la séance ; tomia.fr en production et en local. Le cadre du lot 3 :
aucune nouvelle direction visuelle avant le lot 4 (`.claude/rules/design-system.md`). Ce qui suit
porte sur les parcours, la structure et les mots, pas sur l'identité.

## Ce qui marche

- Le parcours complet tient sans aide : invitation, code, prénom, enfant ajouté, appareil relié par
  un code, espace de l'enfant ouvert sur le téléphone du parent, consentement à la mémoire, séance.
- Les cibles tactiles mesurées font toutes 44 px de haut ou plus.
- Le tuteur tient sous la pression : à « donne moi juste la réponse stp », il relance par une
  question sans donner la solution.
- Le site est aligné sur l'hébergement réel : confidentialité et mentions légales citent Clever
  Cloud, Scaleway et Mistral AI, plus aucun ancien hébergeur.

## Constats, par ordre d'importance

### 1. La séance, le cœur du produit, est l'écran le moins travaillé

- **Attente.** La première réponse arrive après 12 à 15 s, les suivantes après 4 à 5 s (horodatages
  de `ai_cost` sur la séance de test). Les trois tirages de la fiche, en raisonnement, passent avant
  le chat. Pendant ce temps, seul « Tom réfléchit… » s'affiche.
- **Rien de Tom.** Pas d'accueil, pas d'avatar, pas un mot qui dise que Tom est une IA. Or
  l'article 50(1) de l'AI Act est une condition d'ouverture (`roadmap.md`, « Porte avant
  ouverture »). Le site montre une conversation plus incarnée que l'app : avatar de Tom, bulles
  distinctes.
- **Mise en forme brute.** Tom écrit `*x*` et l'élève lit les astérisques : le web ne rend ni
  Markdown ni maths. Au collège, fractions et puissances reviennent à chaque exercice.
- **Champ de saisie dans le flux**, sous le dernier message, au lieu d'être fixé en bas comme dans
  toutes les messageries. Pas encore de photo ni de voix (prévues au lot 3).
- **Accords genrés.** « Je comprends que tu sois frustré » : le tuteur ne connaît pas le genre de
  l'élève. Il faut des tournures épicènes, ce qui relève du prompt.

### 2. Le parent ne voit rien de ce que fait son enfant

La promesse est un résumé pour le parent (`vision.md` : ce qui a été travaillé, ce qui résiste,
que l'élève voit aussi). Aujourd'hui, le foyer et la fiche enfant ne montrent que de
l'administration : prénom, classe, appareils, mémoire, suppression. Le site annonce « matières
travaillées, temps passé, notions qui résistent » : rien de cela n'existe encore dans l'app.

### 3. L'accueil parent est un long formulaire

- Le formulaire « Ajouter un enfant » reste ouvert même quand un enfant existe déjà. Les clés
  d'accès et la déconnexion sont au même niveau que les enfants.
- Après l'ajout d'un enfant, rien ne guide vers la suite. L'enfant apparaît dans la liste, le
  formulaire se vide, et le parent doit deviner qu'il faut ouvrir sa fiche pour relier un
  appareil.
- Sur la fiche enfant, deux boutons pleins de même poids se suivent : « Ouvrir l'espace » et
  « Relier un appareil ». Le code de jumelage s'accompagne d'une adresse à taper à la main, sans
  QR code.
- Le champ du mois de naissance affiche `--------- ----` tant qu'il est vide.
- Le texte de la case mémoire, « jamais ce qu'il écrit », suppose un garçon.

### 4. L'espace de l'élève parle comme un écran de réglages

- La moitié de l'accueil est occupée par « Tes appareils reliés » et deux paragraphes sur la
  sécurité. Accepter la mémoire ne donne aucun retour.
- « Ce que Tom retient » reprend le texte du programme officiel à la troisième personne (« Il
  identifie la structure d'une expression littérale (somme, produit). ») et un terme interne
  (« aide jusqu'à « Indice conceptuel » »). Un élève de 4e ne s'y reconnaît pas.
- « Changer de profil » mène à la page de connexion générique, qui empile deux encadrés (appareil
  relié, bêta fermée) et le lien « Tu es élève ? ». Il n'y a pas de choix « Qui utilise Tom ? ».

### 5. Le site

Gelé jusqu'au lot 4, hors correctif d'honnêteté (`.claude/rules/landing.md`). Un point à
trancher : la formule Complet annonce « Fiches de révision et répétition espacée ». Les fiches de
révision sont dans `vision.md`, pas la répétition espacée. Soit la vision l'inclut, soit le site
retire ces deux mots. Le site n'a aucune inscription : « Contactez-nous » est le seul appel.
C'est cohérent avec une bêta fermée, et ça se décide au lot 4.

## Ordre proposé pour le lot 3

Chaque point devient une PR, testée à largeur de téléphone (`tooling/playwright-web`) :

1. **La séance.** Un accueil de Tom qui dit qu'il est une IA (art. 50), l'avatar déjà dessiné
   pour le site, le champ fixé en bas, un rendu sûr des maths et de la mise en forme (bibliothèque
   à choisir et à vérifier selon les règles de dépendance), et une attente qui dit ce qui se passe.
   Raccourcir la première réponse touche le tuteur : à voir avec le chantier IA.
2. **L'accueil parent.** Des cartes enfant, l'ajout replié derrière un bouton, une page « Mon
   compte » pour les clés d'accès et la déconnexion, et l'étape suivante proposée juste après
   l'ajout d'un enfant.
3. **L'accueil élève.** Les séances d'abord, les appareils repliés, la mémoire écrite dans les
   mots de l'élève, un choix de profil au lieu de la page de connexion.
4. **Le résumé parent**, que l'élève voit aussi. C'est le plus gros morceau : il demande un
   service côté serveur, construit sur les enregistrements de tour et les notions, et la décision
   de ce que le parent voit de la mémoire.
5. **Le jumelage** par QR code, et les micro-textes (mois de naissance, accords).

Les accords genrés de Tom et la latence de la fiche reviennent au chantier IA (étape 8 et suite).
