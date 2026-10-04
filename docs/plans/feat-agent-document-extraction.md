# Plan — feat/agent-document-extraction

Lot 2, point 3, troisième et dernière PR (`docs/roadmap.md`). Décision et source :
`docs/etudes/2026-10-04/refonte-agent.md` (« Autres usages de l'IA » : l'analyse d'une photo ou
d'un document « devient une extraction seule, qui nourrit la fiche » ; « chaque image est aussi
traitée deux fois avant le premier mot »). Chemins relatifs à `apps/server/src/`.

## Constat

- `documents/document-analysis.service.ts` est un second tuteur : « Analyse pédagogique
  complète », qui répond en priorité à la question de l'élève, sans aucun garde-fou du chat.
- Sa sortie est réinjectée à chaque tour pour tous les fichiers de la séance ; quand l'élève
  écrit quelque chose, `file-context.service.ts` l'habille d'une « RÉPONSE CONTEXTUALISÉE »
  inventée.
- Une image est lue deux fois avant le premier mot : par l'analyse, puis par le chat en
  `image_url`.

## Tâches

1. **Extraction seule**, mise en cache dans `files.educational_context.extractedText` :
   - PDF, docx, texte : le texte tiré par `document-extraction.service.ts` (unpdf, mammoth),
     sans appel au modèle ;
   - image : une lecture par Small 4 en vision, qui transcrit fidèlement le texte et décrit
     les figures dont l'exercice dépend (valeurs, légendes), sans résoudre ni commenter ;
     sortie structurée stricte pour lire l'usage, coût enregistré dans `cost_tracking`.
   - `document-analysis.service.ts`, `document-prompts.ts` et les schémas d'analyse sont
     supprimés, avec la classification : seule la liste des fichiers la lisait, son champ
     `documentType` part avec elle.
2. **Une seule lecture de l'image** : le chat ne reçoit plus l'image, mais le texte extrait.
   - C'est ce qu'il a déjà aux tours suivants : l'image n'est envoyée qu'au tour où elle est
     jointe. La figure passe par sa description ; c'est le prix d'une lecture unique.
   - `prepareMultimodalFiles`, les parts image de `streamChat` et `files` du contexte du tour
     sont retirés.
3. **Place des fichiers dans le prompt** :
   - les fichiers de la séance, dans l'ordre où ils ont été joints, ouvrent la fenêtre après
     l'exercice et avant le résumé : stables d'un tour à l'autre, ils restent dans le préfixe
     mis en cache ;
   - la fiche d'exercice lit les fichiers joints au tour ;
   - le budget de 50 000 caractères passe dans `file-context.service.ts`.
4. **Prompt** : la section des pièces jointes parle du texte lu sur une photo ou un document,
   une donnée.
5. **Tests** : extraction (texte, image, cache, échec), coût de la vision, ordre et budget des
   fichiers, fichiers dans l'ouverture et pas dans le message du tour, fiche nourrie des
   fichiers du tour ; un appel réel lit une image de texte.

## Hors périmètre

- PDF scannés sans couche texte : l'extraction échoue comme aujourd'hui.

## Validation

`bun run typecheck`, `bun run lint`, `bunx knip`, `bun run test` ; `bun run test:live` une
fois. Pas de passage au harnais.
