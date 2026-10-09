-- O QR de cada publicação (09/10): um link curto por cartão, para o designer.
-- AlterEnum
ALTER TYPE "ShortLinkKind" ADD VALUE IF NOT EXISTS 'PUBLICACAO_QR';

-- AlterTable
ALTER TABLE "short_links" ADD COLUMN     "blocoId" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "short_links_blocoId_key" ON "short_links"("blocoId");
