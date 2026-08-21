/**
 * Matières que l'agent peut demander à `search_educational_content`.
 *
 * Ces slugs sont **exactement** ceux qui ont du contenu dans la collection,
 * relevés dans `apps/curriculum/contract.json` → `matieres_indexees`.
 *
 * Pourquoi cette contrainte est stricte : filtrer sur une matière absente ne
 * provoque aucune erreur. Qdrant renvoie zéro résultat, l'agent en conclut que
 * le programme officiel ne dit rien, et répond de mémoire — sans que rien ne
 * le signale. C'est le constat P0-1 de `docs/audits/2026-08-21-rag-agent-ia.md`,
 * qui coûtait `histoire`, `geographie` et `physique-chimie` : trois slugs
 * inventés là où l'index porte `histoire_geo` et `physique_chimie`.
 *
 * `src/tests/rag-subjects-contract.test.ts` vérifie l'égalité dans les deux
 * sens à chaque exécution des tests. Cette liste ne se modifie donc pas à la
 * main : elle se régénère depuis le contrat après réindexation
 * (`uv run python scripts/export_contract.py` côté curriculum).
 *
 * Absentes et c'est normal — déclarées au vocabulaire mais sans corpus :
 * enseignement_scientifique, hggsp, hlp, nsi, philosophie, ses, snt.
 * Toutes lycée : le corpus s'arrête en 3e.
 */
export const RAG_SUBJECTS = [
  'allemand', 'anglais', 'arts_plastiques', 'education_musicale', 'emc',
  'eps', 'espagnol', 'francais', 'histoire_des_arts', 'histoire_geo',
  'italien', 'langues_vivantes', 'mathematiques', 'physique_chimie',
  'sciences_technologie', 'svt', 'technologie',
] as const;
