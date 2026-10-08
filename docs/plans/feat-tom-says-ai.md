# Plan — Tom se dit IA, à l'écran et dans le prompt

## Problème

L'AI Act (art. 50(1) et (5), applicable depuis le 2026-08-02) demande que l'élève sache qu'il
parle à une IA, clairement, dès la première interaction, et, d'après le projet de lignes
directrices, par une marque visible pendant toute la séance, près du champ, et redite dans les
contextes sensibles (`etudes/2026-10-08/accompagnement-ia.md`, § 1.1). Aujourd'hui le prompt ne
le dit que « si l'élève te le demande », et la mention en tête de séance défile avec la
conversation. Décision : Tom se dit programme, jamais ami, sans sentiments (`decisions.md`).

## Critères d'acceptation

- [ ] Le prompt : Tom est un programme, pas une personne ; il le redit en une phrase quand
      l'élève lui demande s'il est humain ou parle de lui, puis revient à l'exercice ; il ne se
      dit jamais ami, n'exprime ni sentiment ni souvenir personnel. Test vu rouge d'abord.
- [ ] Sous le champ, toujours visible : « Tom est une IA : il peut se tromper, vérifie avec ton
      cours. » Test e2e vu rouge d'abord.
- [ ] `suivi.md` : la mesure de ce comportement au harnais, qui demande une question de plus à la
      grille de Victor, renvoyée au lot 2.

## Hors périmètre

Le champ fixé en bas, l'attente, le rendu des maths (PR suivantes de l'étape 1). Un contrôle de
sortie qui détecterait une réponse affective : fragile en chaînes, à voir après la mesure.

## Vérification de bout en bout

`bun run test` ; Playwright `chat.spec.ts` sur Android ; la séance vue dans Chrome.

## Décision humaine

Victor, 2026-10-08 : « la loutre se dit programme » ; choix d'exécution délégués.
