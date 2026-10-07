# Plan — le quota par élève (étape 5, PR 4)

Pré-vol (2026-10-07) : chiffres de `docs/etudes/2026-10-07/rentabilite.md`, retenus par Victor
le 2026-10-07 : 2 c par élève et par jour en Gratuit, 10 c en Complet, voix comprise, remise à
zéro à 4 h, heure de Paris ; refus si le quota ne se lit pas, sauf la détresse. Le paiement
n'existe pas encore (lot 3) : tout élève est au Gratuit, le budget du Complet arrive avec lui. Le
coût réel de chaque appel est déjà écrit dans `ai_cost` (#430).

## Problème

Un tour coûte des appels Mistral sans borne : un élève, ou un script avec sa session, peut faire
tourner la facture. La vision promet un gratuit utilisable chaque soir, pas illimité.

## Critères d'acceptation

- [ ] Le jour du quota commence à 4 h, heure de Paris, heures d'été et d'hiver comprises.
- [ ] Un tour est refusé (429) quand l'élève a dépensé son budget du jour, avant tout appel au
      modèle ; une détresse reçoit quand même la réponse fixe ; une séance close aussi.
- [ ] Une base qui ne répond pas refuse le tour, sans ouvrir le quota.
- [ ] Tests sur une vraie base, cas limites du jour compris.

## Hors périmètre

Le budget du Complet et le choix de formule (paiement, lot 3) ; un affichage du quota dans le web
(étape 6).

## Vérification de bout en bout

`bun run typecheck && bun run lint && bun run test`, knip vert.

## Décision humaine

Quotas retenus par Victor le 2026-10-07.
