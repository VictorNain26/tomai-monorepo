/**
 * Conformité de l'énumération de matières exposée à l'agent.
 *
 * `RAG_SUBJECTS` remplit l'argument `matiere` de `search_educational_content`.
 * Un slug absent de l'index ne produit pas d'erreur : Qdrant filtre sur une
 * valeur qui n'existe pas et renvoie zéro résultat. L'agent conclut alors
 * « le programme ne dit rien » et répond de mémoire.
 *
 * Le test de contrat existant (`contract.test.ts`) vérifie les niveaux et les
 * clés de payload, mais **pas les matières** — la seule dimension où l'écart
 * est silencieux et coûteux.
 */

import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { RAG_SUBJECTS } from '../services/chat/rag-subjects.js';

interface CurriculumContract {
  /** Vocabulaire autorisé — inclut des matières lycée sans corpus. */
  matieres: string[];
  /** Couverture réelle, relevée dans la collection vivante. */
  matieres_indexees: string[];
}

const contract = JSON.parse(
  readFileSync(join(import.meta.dir, '../../../curriculum/contract.json'), 'utf-8'),
) as CurriculumContract;

describe('RAG_SUBJECTS vs contrat curriculum', () => {
  it('n\'expose aucune matière absente de l\'index', () => {
    const indexees = new Set(contract.matieres_indexees);
    const fantomes = RAG_SUBJECTS.filter(slug => !indexees.has(slug));

    expect(fantomes).toEqual([]);
  });

  it('expose toutes les matières que l\'index contient', () => {
    const exposees = new Set<string>(RAG_SUBJECTS);
    const inaccessibles = contract.matieres_indexees.filter(slug => !exposees.has(slug));

    expect(inaccessibles).toEqual([]);
  });
});
