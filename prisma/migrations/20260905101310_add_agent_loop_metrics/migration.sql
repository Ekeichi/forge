-- AlterTable
ALTER TABLE "AgentRun" ADD COLUMN     "iterations" INTEGER,
ADD COLUMN     "stopReason" TEXT,
ADD COLUMN     "success" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "toolErrors" INTEGER NOT NULL DEFAULT 0;
