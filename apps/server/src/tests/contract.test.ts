import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { EDUCATION_LEVELS } from '../lib/education-levels.js';

interface CurriculumContract {
  version: number;
  niveaux: string[];
  matieres: string[];
  payload_keys: string[];
  collection: {
    dense: { name: string; size: number; distance: string };
    sparse: { name: string; modifier: string };
  };
}

const contract = JSON.parse(
  readFileSync(join(import.meta.dir, '../../../curriculum/contract.json'), 'utf-8'),
) as CurriculumContract;

describe('curriculum data contract conformance', () => {
  it('every curriculum niveau is a known server education level', () => {
    // Détecte les typos type "6eme" vs "sixieme". Le primaire server (cp..cm2)
    // est volontairement hors couverture curriculum (réconciliation = ticket #204).
    const known = EDUCATION_LEVELS as readonly string[];
    for (const niveau of contract.niveaux) {
      expect(known).toContain(niveau);
    }
  });

  it('exposes the 7 canonical payload keys read by qdrant.service', () => {
    expect([...contract.payload_keys].sort()).toEqual([
      'chunk_index',
      'cycle',
      'matiere',
      'niveau',
      'section',
      'source_file',
      'text',
    ]);
  });

  it('pins the dense vector identity used by the server (1024D cosine)', () => {
    expect(contract.collection.dense).toEqual({ name: 'dense', size: 1024, distance: 'Cosine' });
    expect(contract.collection.sparse.name).toBe('bm25');
  });
});
