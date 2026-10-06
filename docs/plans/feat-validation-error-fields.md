# Champs en erreur dans l'enveloppe `VALIDATION_ERROR`

Point reporté du lot 3 (`docs/suivi.md`, « Erreurs de validation »), pris pendant le passage de
fin du lot 2 : il ne fait aucun appel Mistral.

## Pré-vol

- Toute validation HTTP passe par `validate` (`platform/http/context.ts`), qui lève
  `AppError('VALIDATION_ERROR', result.error.message)` : le message Zod reste dans les logs,
  le client reçoit le message générique.
- `@repo/api` lit l'enveloppe dans `buildApiError` (`packages/api/src/client.ts`) ; ses types
  viennent de `tomai-server/app`.
- Les tests d'intégration lisent l'enveloppe avec `toMatchObject` : un champ ajouté ne les casse pas.

## Tâches

1. `platform/http/errors.ts` : `FieldError` (`location` : `json`, `param`, `query`… ; `path` pointé ;
   `code` de l'issue Zod, typé ; `message` en français), champ `fields` optionnel d'`AppError` et de
   l'enveloppe, absent quand il n'y en a pas.
2. `validate` remplit `fields` depuis les issues Zod, une entrée par clé inconnue. Les messages
   restent ceux des schémas, en français ; les autres passent par la locale française de Zod
   (`z.config(z.locales.fr())`). Aucun ne contient la valeur reçue. Le gestionnaire journalise les
   champs d'un 400.
3. `app.ts` exporte le type `FieldError` ; `@repo/api` le réexporte et `ApiError.fields` le porte.
4. Tests : `request-id-error-handler.test.ts` (chemin imbriqué, valeur non renvoyée, absent hors
   validation), `packages/api/tests/client.test.ts` (lecture des champs).
5. `docs/suivi.md` : le point reporté est retiré.

## Revue

`/code-review` : 10 constats, tous traités.

- Le seul code Zod ne distinguait pas deux règles d'un même champ (deux regex donnent
  `invalid_format`), et jetait les messages français des schémas : chaque champ porte son message,
  en français, celui du schéma d'abord.
- Une règle sur tout le corps (`path` vide) n'était pas lisible : son message la dit.
- Une clé inconnue (`unrecognized_keys`) ne nommait pas la clé : une entrée par clé, au bon chemin.
- Un `id` de route et un champ `id` du corps se confondaient : `location`.
- Le 400 ne laissait rien dans les logs : les champs y sont.
- `fields` lu sans contrôle côté client : gardé seulement si c'est une liste.
- `code` en `string` : typé par les codes d'issue de Zod.
- Commentaire d'en-tête du gestionnaire et import en double de `FieldError` dans `@repo/api` : corrigés.
