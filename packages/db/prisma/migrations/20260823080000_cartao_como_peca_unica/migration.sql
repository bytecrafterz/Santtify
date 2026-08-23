-- O CARTÃO PASSA A SER UMA PEÇA ÚNICA (pedido do cliente em 23/08).
--
-- Até aqui a imagem, o áudio, o título e a descrição eram coisas separadas que
-- por acaso estavam próximas. Ele passou quatro dias a ver a fotografia
-- aparecer sozinha noutro sítio da página e diagnosticou-o melhor do que eu:
-- encostá-las por CSS melhora a aparência e não as torna a mesma coisa.
--
-- A partir daqui um cartão é uma linha de content_blocks com tudo dentro, e
-- tem um estado próprio: só sai de rascunho quando está inteiro.

CREATE TYPE "CardPapel" AS ENUM ('CARTAO', 'IMPRESSAO');
CREATE TYPE "CardEstado" AS ENUM ('RASCUNHO', 'PUBLICADO');

ALTER TABLE "content_blocks"
  ADD COLUMN "slot"        INTEGER,
  ADD COLUMN "papel"       "CardPapel"  NOT NULL DEFAULT 'CARTAO',
  ADD COLUMN "estado"      "CardEstado" NOT NULL DEFAULT 'RASCUNHO',
  ADD COLUMN "titulo"      TEXT,
  ADD COLUMN "linkUpgrade" TEXT;

CREATE INDEX "content_blocks_contentId_slot_idx" ON "content_blocks"("contentId", "slot");

-- O que já existia e está inteiro nasce publicado. Um cartão com imagem, som,
-- título e texto é um cartão pronto, e obrigá-lo a voltar a rascunho faria a
-- página dele esvaziar-se no momento em que esta migração corresse.
UPDATE "content_blocks"
SET "titulo" = COALESCE("titulo", "label")
WHERE "type" = 'AUDIO';

UPDATE "content_blocks"
SET "estado" = 'PUBLICADO'
WHERE "type" = 'AUDIO'
  AND "assetId" IS NOT NULL
  AND "imageAssetId" IS NOT NULL
  AND COALESCE("titulo", '') <> ''
  AND COALESCE("text", '') <> '';
