# Plan — La photo de l'exercice

## Problème

Le soir, sur téléphone, un élève photographie son exercice plutôt que de le recopier : la vision
le prévoit (« texte, photo et voix ») et le prompt du tuteur sait déjà lire un bloc
`<attached_file>` (« le texte lu sur une photo »), mais rien ne prend ni ne lit une photo
(`suivi.md`, « Photo : `attachedFilesBlock` est encore toujours vide »).

## Choix

- **Lue par Mistral Small 4 en vision**, une fois, au début du tour (`core/photo.ts`) :
  l'énoncé, les consignes, ce que l'élève a écrit, une figure décrite en une phrase ; une photo
  illisible ou qui ne montre pas un devoir est dite comme telle, jamais décrite. Le coût s'écrit
  dans `ai_cost` comme tout appel du tour, donc dans le quota.
- **La photo ne se garde pas** : seul son texte entre dans le tour (`<attached_file>` pour la
  fiche et le rédacteur ; la modération et la détresse le lisent avec le message). Le message
  enregistré est celui de l'élève, ou « Photo envoyée ».
- **Envoyée avec le message**, JSON `{ text, image: { mediaType, data } }` en base64, réduite
  côté web à 1600 px en JPEG ; JPEG, PNG ou WebP ; 3 Mo au plus (`bodyLimit`, 413).
- **Côté web** : un bouton « Photo » près du champ (`capture="environment"`), un aperçu avant
  l'envoi, « Photo envoyée » dans la bulle de l'élève.

## Critères d'acceptation

- [ ] `readPhoto` : le texte lu, l'illisible, le hors-devoir, l'échec ; tests vus rouges.
- [ ] Le tour : la photo seule passe, le rédacteur et la fiche reçoivent le bloc, la photo n'est
      jamais stockée, son coût est facturé ; trop lourde (413), mauvais type, ni texte ni photo
      (400) ; tests vus rouges.
- [ ] E2E : la photo choisie part avec le message et la bulle le dit ; vu rouge.

## Hors périmètre

La voix (PR suivante). Plusieurs photos par message. Un PDF.

## Vérification de bout en bout

`bun run test`, Playwright ; une vraie photo d'exercice lue par Mistral sur la stack locale.

## Décision humaine

Victor, 2026-10-09 : « Photo et voix » ensuite ; choix d'exécution délégués.
