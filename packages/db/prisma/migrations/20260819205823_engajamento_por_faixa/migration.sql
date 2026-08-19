-- AlterTable
ALTER TABLE "comments" ADD COLUMN     "blockId" UUID;

-- CreateTable
CREATE TABLE "block_reactions" (
    "id" UUID NOT NULL,
    "blockId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" "ReactionType" NOT NULL DEFAULT 'LIKE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "block_reactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "block_reactions_blockId_idx" ON "block_reactions"("blockId");

-- CreateIndex
CREATE UNIQUE INDEX "block_reactions_blockId_userId_type_key" ON "block_reactions"("blockId", "userId", "type");

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "content_blocks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "block_reactions" ADD CONSTRAINT "block_reactions_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "content_blocks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "block_reactions" ADD CONSTRAINT "block_reactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
