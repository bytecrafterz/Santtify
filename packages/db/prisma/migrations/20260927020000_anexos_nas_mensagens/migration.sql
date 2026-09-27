-- Ficheiros e mensagens de voz nas conversas privadas.
CREATE TYPE "TipoDeAnexo" AS ENUM ('IMAGEM', 'AUDIO', 'ARQUIVO');

ALTER TABLE "mensagens_privadas" ALTER COLUMN "texto" SET DEFAULT '';
ALTER TABLE "mensagens_privadas" ADD COLUMN "anexoTipo" "TipoDeAnexo";
ALTER TABLE "mensagens_privadas" ADD COLUMN "anexoCaminho" TEXT;
ALTER TABLE "mensagens_privadas" ADD COLUMN "anexoNome" TEXT;
ALTER TABLE "mensagens_privadas" ADD COLUMN "anexoMime" TEXT;
ALTER TABLE "mensagens_privadas" ADD COLUMN "anexoBytes" INTEGER;
ALTER TABLE "mensagens_privadas" ADD COLUMN "duracaoSeg" DOUBLE PRECISION;
