/**
 * Canonical chunk payload — mirrored from
 * `tomai-curriculum/schema/document.py:Chunk.to_qdrant_payload`.
 *
 * Source of truth lives in the Python Pydantic model. This TS mirror is
 * checked manually for now; a follow-up will generate it from the Pydantic
 * schema via `datamodel-codegen` + a CI parity test. Until then, every
 * field-level change must land in both repos in the same review.
 *
 * The matiere / niveau / cycle string unions duplicate the Python `Enum`
 * `.value` strings exactly — keep them aligned.
 */

export type Matiere =
  | 'mathematiques'
  | 'francais'
  | 'histoire_geo'
  | 'physique_chimie'
  | 'svt'
  | 'emc'
  | 'technologie'
  | 'sciences_technologie'
  | 'arts_plastiques'
  | 'education_musicale'
  | 'histoire_des_arts'
  | 'eps'
  | 'anglais'
  | 'espagnol'
  | 'allemand'
  | 'italien'
  | 'langues_vivantes'
  | 'snt'
  | 'enseignement_scientifique'
  | 'philosophie'
  | 'ses'
  | 'nsi'
  | 'hggsp'
  | 'hlp';

export type NiveauCollege = 'sixieme' | 'cinquieme' | 'quatrieme' | 'troisieme';
export type NiveauLycee = 'seconde' | 'premiere' | 'terminale';
export type Niveau = NiveauCollege | NiveauLycee;

export type Cycle = 'cycle3' | 'cycle4' | 'lycee';

/**
 * Exact shape of a Qdrant payload row produced by `ingest.upsert_to_qdrant`.
 * Read consumers (server `qdrant.service.ts`) must align with this shape.
 */
export interface ChunkPayload {
  text: string;
  source_file: string;
  matiere: Matiere;
  niveau: Niveau;
  cycle: Cycle;
  section: string;
  chunk_index: number;
}
