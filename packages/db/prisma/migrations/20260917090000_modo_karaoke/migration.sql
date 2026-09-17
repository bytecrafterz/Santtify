-- CreateEnum
CREATE TYPE "KaraokeAcesso" AS ENUM ('TODOS', 'CONTA', 'DESLIGADO');

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "karaokeAcesso" "KaraokeAcesso" NOT NULL DEFAULT 'TODOS';

-- CreateTable
CREATE TABLE "letras_sincronizadas" (
    "id" UUID NOT NULL,
    "blocoId" UUID NOT NULL,
    "texto" TEXT NOT NULL DEFAULT '',
    "frases" JSONB NOT NULL DEFAULT '[]',
    "publicada" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "letras_sincronizadas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "palavras_de_destaque" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "palavra" TEXT NOT NULL,
    "exibicao" TEXT NOT NULL,
    "nivel" INTEGER NOT NULL DEFAULT 2,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "palavras_de_destaque_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "letras_sincronizadas_blocoId_key" ON "letras_sincronizadas"("blocoId");

-- CreateIndex
CREATE UNIQUE INDEX "palavras_de_destaque_projectId_palavra_key" ON "palavras_de_destaque"("projectId", "palavra");

-- AddForeignKey
ALTER TABLE "letras_sincronizadas" ADD CONSTRAINT "letras_sincronizadas_blocoId_fkey" FOREIGN KEY ("blocoId") REFERENCES "content_blocks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "palavras_de_destaque" ADD CONSTRAINT "palavras_de_destaque_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

