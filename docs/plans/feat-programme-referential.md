# Plan — `feat/programme-referential`

Lot 1, point 3 de `roadmap.md`, première PR : la chaîne d'extraction du référentiel et les
programmes récents de mathématiques et de français (cycle 3 de 2025, cycle 4 de 2026).

## Pré-vol (contre `main` après #362)

- Les quatre annexes (mathématiques et français, cycles 3 et 4) sont des PDF balisés : même
  forme d'arbre de structure, lue avec `page.getStructTree()` et
  `getTextContent({ includeMarkedContent: true })` de pdf.js via `unpdf` 1.8.1 (déjà en
  dépendance). Un titre H1 porte le domaine (« Nombres et calculs », « Lecture »), un autre
  H1 la classe (« Cinquième », « Sixième », « Cours moyen… ») ; H2 le sous-thème ; H3 ou H4
  un sous-sous-thème, « Automatismes » ou « Prolongements possibles » ; un paragraphe
  « Objectifs d'apprentissage » ouvre la liste des objectifs, un paragraphe chacun ; les
  automatismes sont des éléments de liste.
- **Formules** : les équations Word ne sont pas balisées comme `Formula`, mais leurs
  chiffres restent dans le contenu marqué, empilés (numérateur au-dessus de la ligne,
  dénominateur dessous, même centre). `pdftotext` les perd ; pdf.js les a. Reconstruction
  « a/b » par position, et chaque entrée concernée est signalée à la relecture.
- **Version** : le programme de cycle 4 de 2026 s'applique en 5e en 2026-2027, en 4e en
  2027-2028, en 3e en 2028-2029 (arrêté du 18-2-2026, art. 3) ; celui de cycle 3 de 2025
  en 6e depuis 2025-2026. Les 4e et 3e de 2026 sont extraites mais ne s'appliquent pas
  encore : le référentiel porte la rentrée d'application par classe.
- Les PDF restent hors du dépôt : URL et SHA-256 épinglés, téléchargés à l'extraction.
- Suivi « Lot 1 », référentiel du collège : granularité objectif, NOR, BO, empreinte,
  page, clé par niveau puis enseignement, relecture → cette PR pour les textes récents.

## Choix

- `apps/server/src/referential/` : `sources.ts` (textes officiels : NOR, BO, URL, SHA-256,
  rentrée par classe), `parse.ts` (fonctions pures : blocs → entrées), `extract.ts`
  (script `bun run referential:extract` : télécharge, vérifie l'empreinte, lit l'arbre,
  écrit `texts/<id>.json`), `schema.ts` et `index.ts` (chargement validé par Zod,
  `objectivesFor(level, subject, rentrée)`).
- Une entrée : identifiant stable, classe, enseignement, domaine, sous-thème, type
  (objectif ou automatisme), libellé exact, page, drapeau `formula` si une fraction a été
  reconstruite.
- **Relecture outillée** : l'extracteur relit chaque entrée dans le texte brut de la page
  (`extractText`, sans l'arbre) et échoue si un libellé n'y figure pas mot pour mot ; les
  entrées à formule sont listées pour une vérification visuelle.

## Tâches

1. `parse.ts` et ses tests : blocs aplatis (rôle, texte, page) → entrées ; reconstruction
   des fractions ; paragraphes coupés par un saut de page recollés ; classes hors collège
   (CM1, CM2) écartées.
2. `sources.ts`, `extract.ts`, script ; extraction des quatre annexes ; contrôle croisé.
3. `schema.ts`, `index.ts`, tests (schéma, identifiants uniques, sélection par rentrée).
4. Vérification visuelle des entrées à formule contre le PDF rendu.
5. Doc : `agent.md` (référentiel), suivi ; suppression du plan.

## Renvoyé

- 4e et 3e en 2026-2027 (programme de 2020 et repères de 2019, écrits par cycle) : PR
  suivante du point 3.
- Sciences, histoire-géographie, anglais ; rattachement des exercices du jeu à leur objectif
  et à leurs notions interdites : PR suivantes du point 3.

## Validation

Typecheck, lint, tests, knip ; extraction rejouée deux fois à l'identique.
