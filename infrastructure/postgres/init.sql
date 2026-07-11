-- SentinelX AI — PostgreSQL Initialization
-- Enables required extensions

-- pgvector for AI embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- pgcrypto for UUID generation
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- pg_trgm for full-text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- uuid-ossp for UUID functions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Set default timezone
SET timezone = 'UTC';

-- Create schema
-- (Prisma manages the schema — this is for extensions only)
COMMENT ON DATABASE sentinelx IS 'SentinelX AI Enterprise Security Platform Database';
