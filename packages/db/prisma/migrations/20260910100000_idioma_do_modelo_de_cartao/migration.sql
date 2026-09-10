-- AlterTable
ALTER TABLE "modelos_de_cartao" ADD COLUMN     "idioma" TEXT NOT NULL DEFAULT 'pt-BR';

-- CreateIndex
CREATE INDEX "modelos_de_cartao_projectId_idioma_ativo_idx" ON "modelos_de_cartao"("projectId", "idioma", "ativo");

