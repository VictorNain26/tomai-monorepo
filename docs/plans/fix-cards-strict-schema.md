# Cartes en sortie structurée stricte, une seule définition des types

Point reporté du lot 2 (`docs/suivi.md`, « Cartes en `json_schema` non strict »).

## Pré-vol

- Les types de cartes vivent à cinq endroits qui divergent : l'enum `card_type`
  (`modules/learning/decks.schema.ts`, 15 types), les types et interfaces écrits à la main de
  `modules/learning/card-generation.types.ts` (déjà faux : `hint` au lieu de `hints`, sans
  `commonMistakes`), les schémas Zod de `cards-domain.schema.ts` et `cards.schema.ts`, dont les
  champs communs sont recopiés, `ALL_CARD_TYPES` de `prompts/by-subject.ts`, et
  `card.routes.ts` qui n'accepte que 3 types, comme `card-validation.ts`, qui rejette les 12 autres.
- La doc Mistral ne liste pas les mots-clés acceptés en mode strict. Mesuré dans
  `live/structured-output.test.ts` : `oneOf`, champs optionnels et `nullable` passent ; `format: uri`
  (`z.url()`) et `propertyNames` (`z.record`) sont rejetés en 400/3051.
- `docs/agent.md` (§ modèles) annonce déjà la génération de cartes en sortie stricte : vrai après
  cette PR.
- Les cartes sont la seule sortie non stricte : l'option `strict` de `generateStructured` n'a pas
  d'autre appelant.

## Tâches

1. `modules/learning/card-content.schema.ts` remplace `cards-domain.schema.ts` et `cards.schema.ts` :
   `CARD_TYPES`, un schéma Zod par type, `CardSchema` (union discriminée sur `cardType`),
   `CardGenerationSchema`, et les types `CardType`, `Card` qui en dérivent.
   - `imageUrl` retiré de tous les types : le modèle inventerait l'URL, et aucun client n'affiche
     d'image.
   - `classification` : `categories` devient `[{ name, itemIndexes }]` au lieu de `categories[]` et
     `correctClassification` en `z.record`.
   - `coerceIndex` (préprocesseur) retiré : en strict, la sortie suit le schéma.
   - Un index de bonne réponse pointe dans ses options (`qcm`, `fill_blank`, `cause_effect`) :
     invariant porté par le schéma, que le chemin d'écriture et la génération partagent.
2. `decks.schema.ts` : `pgEnum('card_type', CARD_TYPES)`, sans changement de valeurs, donc sans
   migration ; les interfaces de contenu à 3 types sont supprimées.
3. `card-generation.types.ts` ne garde que `EducationCycle` et `CardGenerationParams` ;
   `ParsedCard` devient `Card`.
4. `card-validation.ts` : `validateCardContent` parse avec `CardSchema`, pour les 15 types.
5. `card.routes.ts` accepte les 15 types (`z.enum(CARD_TYPES)`) : élargissement, rétrocompatible.
6. `prompts/by-subject.ts` lit `CARD_TYPES` ; `prompts/templates.ts` décrit la nouvelle forme de
   `classification`.
7. `card-generator.service.ts` passe en strict ; l'option `strict` de `generateStructured` est
   supprimée (`platform/ai/mistral-client.ts`, son test).
8. Tests : `tests/card-content.schema.test.ts` (union, index hors options, classification, JSON
   Schema sans `format` ni `propertyNames`, `validateCardContent` sur un type hors des trois
   anciens) ; `card-generator.test.ts` attend `strict: true` ; `live/structured-output.test.ts`
   passe les cartes en strict, lancé une fois après le passage de fin du lot 2 (débit Mistral).
9. `docs/suivi.md` : le point reporté est retiré.

## Revue

`/code-review` : 9 constats, 7 corrigés dans la PR.

- Indices sans lien avec leur liste (`timeline`, `process_order`, `matching_era`,
  `classification`) : `CardSchema` vérifie chaque ordre et chaque répartition, chaque indice une
  fois.
- Un indice mal placé faisait échouer tout le lot généré : la génération ne contraint que la forme,
  les cartes fautives sont écartées une à une, `INVALID_OUTPUT` si aucune ne reste.
- Le PATCH validait contre un `cardType` qu'il ne stockait pas : `cardType` retiré du corps, le
  contenu se valide contre le type stocké.
- Le contenu brut était stocké, clés inconnues comprises : `validateCardContent` rend le contenu
  parsé, et c'est lui qui est stocké.
- `prompts/templates.ts` recopiait les formes à la main et divergeait déjà : supprimé, le prompt
  nomme les types et le schéma strict donne leur forme.
- Le test du JSON Schema lisait `z.toJSONSchema`, pas ce que l'AI SDK envoie : il lit désormais le
  `response_format` capturé.
- Contrat client resserré (`explanation` requise, bornes, `cardType` hors du PATCH) : aucun client
  n'existe avant le lot 3, la rupture est assumée et dite dans la PR.
- Renvoyés : migration des cartes existantes (aucune carte en base, ni utilisateur ni seed) ; test
  réel en strict, lancé avant le merge, après le passage de fin.
