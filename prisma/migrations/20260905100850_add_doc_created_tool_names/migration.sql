/*
  Warnings:

  - You are about to drop the column `toolName` on the `AgentRun` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "AgentRun" DROP COLUMN "toolName",
ADD COLUMN     "docCreated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "toolNames" TEXT;
