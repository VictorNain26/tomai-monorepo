# Plan — feat/cost-tracking-every-call

Lot 2, point 8 (`docs/roadmap.md`), première PR : chaque appel IA tracé dans `cost_tracking`, à
une précision inférieure au centime (`docs/agent.md` § 13). Le quota lui-même (unité, montant)
attend la décision de Victor et la mesure du passage de fin. Chemins relatifs à `apps/server/src/`.

## Constat (code du 2026-10-06)

- Sont tracés : le tour de chat, la fiche d'exercice, le diagnostic, l'extraction de document,
  chacun par un appel à la main. Ne le sont pas : analyse du tour, titre, résumé, cartes,
  épisode, embeddings, STT, TTS.
- `cost_cents` est un entier : un tour de texte (0,035 à 0,10 c, `etudes/2026-10-01/couts.md`)
  s'arrondit à 0.

## Tarifs (vérifiés le 2026-10-06)

- `mistral-small-2603` : 0,15 $ et 0,60 $ par million de tokens, entrée et sortie (déjà dans le
  code) ; cache à 10 % ; endpoint UE ×1,1.
- `mistral-embed-2312` : 0,10 $ par million de tokens (https://docs.mistral.ai/models/mistral-embed-23-12).
- `voxtral-mini-2602` (STT) : 0,003 $ par minute (https://docs.mistral.ai/models/voxtral-mini-transcribe-26-02) ;
  la réponse donne `usage.prompt_audio_seconds`.
- `voxtral-mini-tts-2603` (TTS) : 16 $ par million de caractères produits, 0 $ en entrée
  (https://docs.mistral.ai/models/voxtral-tts-26-03).

## Tâches

1. **Précision** : `cost_micro_eur` (entier, 1 µ€ = 0,0001 c) remplace `cost_cents` ; rien ne
   lit la table ; migration.
2. **Par construction** : `generateText` et `generateStructured` reçoivent un propriétaire
   obligatoire (élève et séance, ou `null` hors élève : éval, tests réels, santé) et tracent leur
   usage, opération = `functionId` ; les traçages à la main de la fiche, du diagnostic et de
   l'extraction disparaissent, ils compteraient deux fois.
3. **Embeddings, STT, TTS** : même propriétaire obligatoire ; tokens, secondes d'audio,
   caractères ; prix par modèle daté.
4. **Tests** : coût d'un appel de chaque sorte, cache compris ; un appel du client tracé une
   fois, avec son propriétaire, rien pour `null` ; embeddings, STT et TTS tracés avec leurs
   unités.
5. `docs/suivi.md` (défauts de coût du lot 2), `docs/agent.md` § 13.

## Hors périmètre

- Unité et montant du quota, TTS sous quota, fiches réservées au Complet dans le chat : PR
  suivantes du point 8.

## Validation

`bun run typecheck`, `bun run lint`, `bunx knip`, `bun run test`, `db:check`,
`bun run test:integration`.
