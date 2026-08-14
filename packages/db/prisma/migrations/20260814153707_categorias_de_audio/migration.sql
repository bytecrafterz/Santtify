-- AlterTable
ALTER TABLE "content_blocks" ADD COLUMN     "categoryId" UUID;

-- CreateTable
CREATE TABLE "block_categories" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "block_categories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "block_categories_projectId_position_idx" ON "block_categories"("projectId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "block_categories_projectId_slug_key" ON "block_categories"("projectId", "slug");

-- CreateIndex
CREATE INDEX "content_blocks_categoryId_idx" ON "content_blocks"("categoryId");

-- AddForeignKey
ALTER TABLE "content_blocks" ADD CONSTRAINT "content_blocks_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "block_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "block_categories" ADD CONSTRAINT "block_categories_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
