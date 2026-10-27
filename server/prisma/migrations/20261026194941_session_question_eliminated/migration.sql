-- AlterTable
ALTER TABLE "SessionQuestion" ADD COLUMN     "eliminated" TEXT[] DEFAULT ARRAY[]::TEXT[];
