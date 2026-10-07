# Plan — la mémoire d'apprentissage sans horloge murale

## Problème

`learner-memory.test.ts` échoue environ une fois sur dix en local. Tracé le 2026-10-07 : l'horloge
du Postgres local a reculé d'environ 2,4 s pendant un passage, et des écritures postérieures
portaient des dates antérieures. La mémoire décide « avant ou après une remise à zéro » en
comparant `created_at` et `now()`, donc une horloge non monotone : un recul fait compter un
exercice oublié, ou en oublie un récent. Une machine virtuelle de production peut aussi sauter.

## Critères d'acceptation

- [ ] Une remise à zéro de la mémoire et l'oubli d'une notion retiennent la dernière `position`
      d'exercice de l'élève (identité de la table, monotone), plus une date ; le module `tutor`
      les tient (`learner_memory_reset`, `learner_notion_reset`), `household` ne garde que le
      consentement : le retrait du parent efface la réponse, et toute réactivation repasse par une
      acceptation, qui remet à zéro.
- [ ] Le départage de l'erreur fréquente ne dépend plus de l'ordre des tours.
- [ ] Migrations : ajout nullable, reprise des données depuis les dates, puis contrainte et
      suppression des anciennes colonnes (`.claude/rules/database-migrations.md`).
- [ ] Un test rejoue la remise à zéro avec des dates qui reculent.
- [ ] `learner-memory.test.ts` passe 40 fois de suite en local.

## Hors périmètre

- La borne de l'année scolaire reste une date : elle tombe une fois par an.
- Les listes triées par date pour l'affichage (séances, appareils).

## Vérification de bout en bout

`bun run test` ; 40 passages de `learner-memory.test.ts` ; Migration Sync en CI.

## Décision humaine

Victor, 2026-10-07 : PR dédiée au test intermittent, sans pansement.
