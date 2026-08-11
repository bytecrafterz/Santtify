-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PostStatus" ADD VALUE 'PENDING';
ALTER TYPE "PostStatus" ADD VALUE 'REJECTED';

-- AlterTable
ALTER TABLE "posts" ADD COLUMN     "imageAssetId" UUID,
ADD COLUMN     "moderatedAt" TIMESTAMP(3),
ADD COLUMN     "moderatedById" UUID,
ADD COLUMN     "moderationNote" TEXT;

-- CreateIndex
CREATE INDEX "posts_imageAssetId_idx" ON "posts"("imageAssetId");

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_imageAssetId_fkey" FOREIGN KEY ("imageAssetId") REFERENCES "media_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
