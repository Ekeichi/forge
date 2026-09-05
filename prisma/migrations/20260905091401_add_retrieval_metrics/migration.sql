-- AlterTable
ALTER TABLE "AgentRun" ADD COLUMN     "averageScore" DOUBLE PRECISION,
ADD COLUMN     "resultCount" INTEGER,
ADD COLUMN     "topScore" DOUBLE PRECISION;
