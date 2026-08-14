-- AlterTable
ALTER TABLE "content_blocks" ADD COLUMN     "imageAssetId" UUID;

-- CreateIndex
CREATE INDEX "content_blocks_imageAssetId_idx" ON "content_blocks"("imageAssetId");

-- AddForeignKey
ALTER TABLE "content_blocks" ADD CONSTRAINT "content_blocks_imageAssetId_fkey" FOREIGN KEY ("imageAssetId") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
