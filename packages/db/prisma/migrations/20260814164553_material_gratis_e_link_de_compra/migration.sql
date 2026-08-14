-- AlterTable
ALTER TABLE "contents" ADD COLUMN     "freeFileName" TEXT,
ADD COLUMN     "freeFileUrl" TEXT;

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "checkoutUrl" TEXT;
