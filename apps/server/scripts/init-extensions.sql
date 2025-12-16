-- PostgreSQL Extensions Initialization for TomAI
-- Optimized for RAG with pgvector + pgvectorscale
-- Performance-first architecture 2025

-- =============================================
-- Core Extensions for Vector Operations
-- =============================================

-- pgvector : Base vector operations and data types
CREATE EXTENSION IF NOT EXISTS vector;

-- pg_stat_statements : Query performance monitoring
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- pg_hint_plan : Query optimization hints
CREATE EXTENSION IF NOT EXISTS pg_hint_plan;

-- uuid-ossp : UUID generation optimized
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- unaccent : Text normalization for French content
CREATE EXTENSION IF NOT EXISTS unaccent;

-- =============================================
-- Timescale Extensions (pgvectorscale)
-- =============================================

-- TimescaleDB : Time-series and performance optimizations
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Note: pgvectorscale will be installed via TimescaleDB image
-- It provides StreamingDiskANN algorithm for 28x better performance

-- =============================================
-- Performance Monitoring Setup
-- =============================================

-- Configure pg_stat_statements for query analysis
ALTER SYSTEM SET shared_preload_libraries = 'timescaledb,pg_stat_statements,pg_hint_plan';
ALTER SYSTEM SET pg_stat_statements.max = 10000;
ALTER SYSTEM SET pg_stat_statements.track = all;

-- Configure logging for performance analysis
ALTER SYSTEM SET log_statement = 'all';
ALTER SYSTEM SET log_min_duration_statement = 100;
ALTER SYSTEM SET log_checkpoints = on;
ALTER SYSTEM SET log_lock_waits = on;

-- =============================================
-- Vector Operations Optimization
-- =============================================

-- Optimize for vector operations
ALTER SYSTEM SET effective_cache_size = '12GB';
ALTER SYSTEM SET shared_buffers = '4GB';
ALTER SYSTEM SET work_mem = '256MB';
ALTER SYSTEM SET maintenance_work_mem = '2GB';

-- Optimize for SSD storage
ALTER SYSTEM SET random_page_cost = 1.1;
ALTER SYSTEM SET seq_page_cost = 1.0;

-- Parallel processing optimization for vectors
ALTER SYSTEM SET max_parallel_workers = 8;
ALTER SYSTEM SET max_parallel_workers_per_gather = 4;
ALTER SYSTEM SET max_parallel_maintenance_workers = 4;

-- Checkpoint optimization for write-heavy workloads
ALTER SYSTEM SET checkpoint_completion_target = 0.9;
ALTER SYSTEM SET wal_buffers = '32MB';

-- Statistics target for better query planning
ALTER SYSTEM SET default_statistics_target = 1000;

-- =============================================
-- Configuration Reload
-- =============================================

-- Reload configuration (requires restart for some settings)
SELECT pg_reload_conf();

-- =============================================
-- Success Confirmation
-- =============================================

SELECT
    'PostgreSQL Extensions Initialized Successfully for TomAI RAG' as status,
    version() as pg_version,
    current_timestamp as initialized_at;

-- Show enabled extensions for verification
SELECT
    extname as extension_name,
    extversion as version
FROM pg_extension
ORDER BY extname;