-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- AlterTable
ALTER TABLE "Chunk" ADD COLUMN     "embedding" vector(384);
