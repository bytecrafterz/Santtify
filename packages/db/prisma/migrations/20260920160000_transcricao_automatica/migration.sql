-- CreateEnum
CREATE TYPE "OrigemDaLetra" AS ENUM ('MANUAL', 'AUTOMATICA');

-- CreateEnum
CREATE TYPE "EstadoDaTranscricao" AS ENUM ('PENDENTE', 'A_OUVIR', 'PRONTA', 'FALHOU');

-- AlterTable
ALTER TABLE "letras_sincronizadas" ADD COLUMN     "origem" "OrigemDaLetra" NOT NULL DEFAULT 'MANUAL';

-- CreateTable
CREATE TABLE "transcricoes_de_audio" (
    "id" UUID NOT NULL,
    "blocoId" UUID NOT NULL,
    "estado" "EstadoDaTranscricao" NOT NULL DEFAULT 'PENDENTE',
    "progresso" INTEGER NOT NULL DEFAULT 0,
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "erro" TEXT,
    "segundosAOuvir" INTEGER,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "comecouEm" TIMESTAMP(3),
    "terminouEm" TIMESTAMP(3),

    CONSTRAINT "transcricoes_de_audio_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "transcricoes_de_audio_blocoId_key" ON "transcricoes_de_audio"("blocoId");

-- CreateIndex
CREATE INDEX "transcricoes_de_audio_estado_criadoEm_idx" ON "transcricoes_de_audio"("estado", "criadoEm");

-- AddForeignKey
ALTER TABLE "transcricoes_de_audio" ADD CONSTRAINT "transcricoes_de_audio_blocoId_fkey" FOREIGN KEY ("blocoId") REFERENCES "content_blocks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

