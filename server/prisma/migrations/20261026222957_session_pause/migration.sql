-- AlterTable
ALTER TABLE "GameSession" ADD COLUMN     "pausedAt" TIMESTAMP(3),
ADD COLUMN     "pausesUsed" INTEGER NOT NULL DEFAULT 0;
