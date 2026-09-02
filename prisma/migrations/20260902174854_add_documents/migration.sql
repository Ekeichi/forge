/*
  Warnings:

  - You are about to drop the column `content` on the `Document` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Document" DROP COLUMN "content",
ADD COLUMN     "fileUrl" TEXT;
