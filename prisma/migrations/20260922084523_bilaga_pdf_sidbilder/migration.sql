-- AlterTable
ALTER TABLE "bilaga" ADD COLUMN     "sidantal" INTEGER,
ADD COLUMN     "sidbildnycklar" TEXT[] DEFAULT ARRAY[]::TEXT[];
