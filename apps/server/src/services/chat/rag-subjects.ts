/**
 * Slugs de matières indexés dans Qdrant.
 *
 * Source unique côté serveur — tout slug hors liste retourne 0 résultat en
 * silence.
 *
 * ⚠️ Cette liste est aujourd'hui saisie à la main et **diverge de l'index** :
 * `histoire`, `geographie` et `physique-chimie` n'existent pas dans la
 * collection, qui porte `histoire_geo` et `physique_chimie`. Voir le constat
 * P0-1 de `docs/audits/2026-08-21-rag-agent-ia.md` — le correctif consiste à
 * dériver cette liste de `apps/curriculum/contract.json` au build.
 */
export const RAG_SUBJECTS = [
  'mathematiques', 'francais', 'anglais', 'espagnol', 'allemand',
  'histoire', 'geographie', 'physique-chimie', 'svt', 'technologie',
  'ses', 'philosophie', 'nsi',
] as const;
