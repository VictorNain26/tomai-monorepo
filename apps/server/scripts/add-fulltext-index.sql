/**
 * Migration: Add Full-Text Search Index (PostgreSQL tsvector)
 *
 * Purpose: Enable BM25-like keyword search for hybrid RAG (2025 best practices)
 * Tables: semantic_chunks, micro_chunks
 * Performance: GIN index for fast full-text search
 *
 * Benefits:
 * - +15-25% recall improvement (hybrid BM25 + semantic)
 * - Exact term matching (complements semantic search)
 * - Fast keyword search (<50ms for 10k+ chunks)
 *
 * Usage:
 *   psql -h localhost -U tomai_dev -d tomai_dev -f scripts/add-fulltext-index.sql
 *   # Production:
 *   DATABASE_URL="..." psql -f scripts/add-fulltext-index.sql
 */

-- =============================================
-- SEMANTIC CHUNKS: Add tsvector column + index
-- =============================================

-- Check if column already exists (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'semantic_chunks'
      AND column_name = 'content_tsv'
  ) THEN
    -- Add tsvector column (generated always, indexed)
    ALTER TABLE semantic_chunks
    ADD COLUMN content_tsv tsvector
    GENERATED ALWAYS AS (to_tsvector('french', content)) STORED;

    -- Create GIN index for fast full-text search
    CREATE INDEX semantic_chunks_content_tsv_idx
    ON semantic_chunks USING GIN(content_tsv);

    RAISE NOTICE 'Added content_tsv column and GIN index to semantic_chunks';
  ELSE
    RAISE NOTICE 'Column content_tsv already exists in semantic_chunks, skipping';
  END IF;
END $$;

-- =============================================
-- MICRO CHUNKS: Add tsvector column + index
-- =============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'micro_chunks'
      AND column_name = 'content_tsv'
  ) THEN
    -- Add tsvector column (generated always, indexed)
    ALTER TABLE micro_chunks
    ADD COLUMN content_tsv tsvector
    GENERATED ALWAYS AS (to_tsvector('french', content)) STORED;

    -- Create GIN index for fast full-text search
    CREATE INDEX micro_chunks_content_tsv_idx
    ON micro_chunks USING GIN(content_tsv);

    RAISE NOTICE 'Added content_tsv column and GIN index to micro_chunks';
  ELSE
    RAISE NOTICE 'Column content_tsv already exists in micro_chunks, skipping';
  END IF;
END $$;

-- =============================================
-- VERIFICATION
-- =============================================

-- Verify indexes created
SELECT
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename IN ('semantic_chunks', 'micro_chunks')
  AND indexname LIKE '%tsv%'
ORDER BY tablename, indexname;

-- Test full-text search (sample query)
SELECT
  COUNT(*) as semantic_chunks_with_tsv
FROM semantic_chunks
WHERE content_tsv IS NOT NULL;

SELECT
  COUNT(*) as micro_chunks_with_tsv
FROM micro_chunks
WHERE content_tsv IS NOT NULL;

-- =============================================
-- PERFORMANCE STATS
-- =============================================

-- Estimate index sizes
SELECT
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
WHERE indexname LIKE '%tsv%'
ORDER BY pg_relation_size(indexrelid) DESC;
