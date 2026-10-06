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

1. `platform/http/errors.ts` : `FieldError` (`path` pointé, `code` de l'issue Zod), champ `fields`
   optionnel d'`AppError` et de l'enveloppe, absent quand il n'y en a pas.
2. `validate` remplit `fields` depuis les issues Zod. Ni la valeur reçue ni le message Zod, en
   anglais : le client traduit le code.
3. `app.ts` exporte le type `FieldError` ; `@repo/api` le réexporte et `ApiError.fields` le porte.
4. Tests : `request-id-error-handler.test.ts` (chemin imbriqué, valeur non renvoyée, absent hors
   validation), `packages/api/tests/client.test.ts` (lecture des champs).
5. `docs/suivi.md` : le point reporté est retiré.
