-- AFILIADOS E VENDAS (28/09)
--
-- O programa de afiliados automático e o painel de vendas: o afiliado, os
-- cliques (um por pessoa por dia), a comissão de cada venda, os pagamentos
-- feitos a afiliados, as regras do programa numa linha só, e no pedido o
-- número, quem comprou, a taxa do processador e o reembolso.
--
-- Os dados que já existem são arrumados no fim, na mesma migração, para o
-- painel abrir certo no primeiro dia — ver as notas em baixo.

-- CreateEnum
CREATE TYPE "EstadoDoAfiliado" AS ENUM ('ATIVO', 'SUSPENSO');

-- CreateEnum
CREATE TYPE "OrigemDoAfiliado" AS ENUM ('COMPRA', 'COMPRA_ANTERIOR', 'PAINEL');

-- CreateEnum
CREATE TYPE "EstadoDaComissao" AS ENUM ('PENDENTE', 'PAGA', 'CANCELADA', 'ESTORNADA');

-- AlterEnum
ALTER TYPE "ShortLinkKind" ADD VALUE 'AFILIADO';

-- AlterTable
ALTER TABLE "pedidos_de_cartoes" ADD COLUMN     "afiliadoId" UUID,
ADD COLUMN     "emailDoComprador" VARCHAR(254),
ADD COLUMN     "nomeDoComprador" VARCHAR(120),
ADD COLUMN     "numero" INTEGER,
ADD COLUMN     "reembolsadoCent" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "reembolsadoEm" TIMESTAMP(3),
ADD COLUMN     "taxaCent" INTEGER,
ADD COLUMN     "taxaEstimada" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "afiliados" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "codigo" VARCHAR(40) NOT NULL,
    "estado" "EstadoDoAfiliado" NOT NULL DEFAULT 'ATIVO',
    "origem" "OrigemDoAfiliado" NOT NULL DEFAULT 'COMPRA',
    "linkId" UUID,
    "pedidoDeDesbloqueioId" UUID,
    "tipoDaChavePix" VARCHAR(20),
    "chavePix" VARCHAR(140),
    "nomeDoTitular" VARCHAR(120),
    "suspensoEm" TIMESTAMP(3),
    "motivoDaSuspensao" VARCHAR(300),
    "vistoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "afiliados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cliques_de_afiliados" (
    "id" UUID NOT NULL,
    "afiliadoId" UUID NOT NULL,
    "visitorId" UUID NOT NULL,
    "dia" DATE NOT NULL,
    "primeiroEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultimoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vezes" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "cliques_de_afiliados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comissoes_de_afiliados" (
    "id" UUID NOT NULL,
    "afiliadoId" UUID NOT NULL,
    "pedidoId" UUID NOT NULL,
    "baseCent" INTEGER NOT NULL,
    "comissaoBp" INTEGER NOT NULL,
    "valorCent" INTEGER NOT NULL,
    "estornoCent" INTEGER NOT NULL DEFAULT 0,
    "estornoDescontadoCent" INTEGER NOT NULL DEFAULT 0,
    "moeda" TEXT NOT NULL DEFAULT 'BRL',
    "estado" "EstadoDaComissao" NOT NULL DEFAULT 'PENDENTE',
    "liberaEm" TIMESTAMP(3) NOT NULL,
    "pagamentoId" UUID,
    "pagaEm" TIMESTAMP(3),
    "canceladaEm" TIMESTAMP(3),
    "motivoDoCancelamento" VARCHAR(300),
    "estornadaEm" TIMESTAMP(3),
    "descontoPagamentoId" UUID,
    "descontadaEm" TIMESTAMP(3),
    "avisoDisponivelEm" TIMESTAMP(3),
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadaEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "comissoes_de_afiliados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pagamentos_a_afiliados" (
    "id" UUID NOT NULL,
    "afiliadoId" UUID NOT NULL,
    "comissoesCent" INTEGER NOT NULL,
    "descontosCent" INTEGER NOT NULL DEFAULT 0,
    "valorCent" INTEGER NOT NULL,
    "moeda" TEXT NOT NULL DEFAULT 'BRL',
    "chavePix" VARCHAR(140),
    "nomeDoTitular" VARCHAR(120),
    "observacao" VARCHAR(300),
    "pagoPorId" UUID,
    "pagoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pagamentos_a_afiliados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "configuracao_de_afiliados" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "comissaoBp" INTEGER NOT NULL DEFAULT 4000,
    "diasDeCarencia" INTEGER NOT NULL DEFAULT 30,
    "diasDeAtribuicao" INTEGER NOT NULL DEFAULT 30,
    "minimoParaPagamentoCent" INTEGER NOT NULL DEFAULT 5000,
    "destino" VARCHAR(300),
    "mensagemDoWhatsapp" VARCHAR(600) NOT NULL DEFAULT 'Olá! Conheça os cartões personalizados da Santtify, com a foto e o nome da criança: {link}',
    "regulamento" VARCHAR(6000),
    "taxaPixBp" INTEGER NOT NULL DEFAULT 99,
    "taxaCartaoBp" INTEGER NOT NULL DEFAULT 498,
    "emailDeAvisos" VARCHAR(254),
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "atualizadoPorId" UUID,

    CONSTRAINT "configuracao_de_afiliados_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "afiliados_userId_key" ON "afiliados"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "afiliados_codigo_key" ON "afiliados"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "afiliados_linkId_key" ON "afiliados"("linkId");

-- CreateIndex
CREATE INDEX "afiliados_estado_criadoEm_idx" ON "afiliados"("estado", "criadoEm");

-- CreateIndex
CREATE INDEX "cliques_de_afiliados_visitorId_ultimoEm_idx" ON "cliques_de_afiliados"("visitorId", "ultimoEm");

-- CreateIndex
CREATE INDEX "cliques_de_afiliados_afiliadoId_dia_idx" ON "cliques_de_afiliados"("afiliadoId", "dia");

-- CreateIndex
CREATE UNIQUE INDEX "cliques_de_afiliados_afiliadoId_visitorId_dia_key" ON "cliques_de_afiliados"("afiliadoId", "visitorId", "dia");

-- CreateIndex
CREATE UNIQUE INDEX "comissoes_de_afiliados_pedidoId_key" ON "comissoes_de_afiliados"("pedidoId");

-- CreateIndex
CREATE INDEX "comissoes_de_afiliados_afiliadoId_estado_liberaEm_idx" ON "comissoes_de_afiliados"("afiliadoId", "estado", "liberaEm");

-- CreateIndex
CREATE INDEX "comissoes_de_afiliados_estado_liberaEm_idx" ON "comissoes_de_afiliados"("estado", "liberaEm");

-- CreateIndex
CREATE INDEX "comissoes_de_afiliados_criadaEm_idx" ON "comissoes_de_afiliados"("criadaEm");

-- CreateIndex
CREATE INDEX "pagamentos_a_afiliados_afiliadoId_pagoEm_idx" ON "pagamentos_a_afiliados"("afiliadoId", "pagoEm");

-- CreateIndex
CREATE INDEX "pagamentos_a_afiliados_pagoEm_idx" ON "pagamentos_a_afiliados"("pagoEm");

-- CreateIndex
CREATE UNIQUE INDEX "pedidos_de_cartoes_numero_key" ON "pedidos_de_cartoes"("numero");

-- CreateIndex
CREATE INDEX "pedidos_de_cartoes_pagoEm_idx" ON "pedidos_de_cartoes"("pagoEm");

-- CreateIndex
CREATE INDEX "pedidos_de_cartoes_afiliadoId_pagoEm_idx" ON "pedidos_de_cartoes"("afiliadoId", "pagoEm");

-- CreateIndex
CREATE INDEX "pedidos_de_cartoes_emailDoComprador_idx" ON "pedidos_de_cartoes"("emailDoComprador");

-- AddForeignKey
ALTER TABLE "pedidos_de_cartoes" ADD CONSTRAINT "pedidos_de_cartoes_afiliadoId_fkey" FOREIGN KEY ("afiliadoId") REFERENCES "afiliados"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "afiliados" ADD CONSTRAINT "afiliados_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "afiliados" ADD CONSTRAINT "afiliados_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "short_links"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cliques_de_afiliados" ADD CONSTRAINT "cliques_de_afiliados_afiliadoId_fkey" FOREIGN KEY ("afiliadoId") REFERENCES "afiliados"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cliques_de_afiliados" ADD CONSTRAINT "cliques_de_afiliados_visitorId_fkey" FOREIGN KEY ("visitorId") REFERENCES "visitors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comissoes_de_afiliados" ADD CONSTRAINT "comissoes_de_afiliados_afiliadoId_fkey" FOREIGN KEY ("afiliadoId") REFERENCES "afiliados"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comissoes_de_afiliados" ADD CONSTRAINT "comissoes_de_afiliados_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "pedidos_de_cartoes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comissoes_de_afiliados" ADD CONSTRAINT "comissoes_de_afiliados_pagamentoId_fkey" FOREIGN KEY ("pagamentoId") REFERENCES "pagamentos_a_afiliados"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comissoes_de_afiliados" ADD CONSTRAINT "comissoes_de_afiliados_descontoPagamentoId_fkey" FOREIGN KEY ("descontoPagamentoId") REFERENCES "pagamentos_a_afiliados"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagamentos_a_afiliados" ADD CONSTRAINT "pagamentos_a_afiliados_afiliadoId_fkey" FOREIGN KEY ("afiliadoId") REFERENCES "afiliados"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagamentos_a_afiliados" ADD CONSTRAINT "pagamentos_a_afiliados_pagoPorId_fkey" FOREIGN KEY ("pagoPorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ─────────────────────────────────────────────────────────────────────
-- DADOS QUE JÁ EXISTEM
-- ─────────────────────────────────────────────────────────────────────

-- As regras do programa, com os valores propostos em 28/09. Mudam no painel.
INSERT INTO "configuracao_de_afiliados" ("id", "atualizadoEm")
VALUES ('global', CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

-- O número dos pedidos: #1001, #1002... Só para os que chegaram ao pagamento,
-- pela ordem em que nasceram. Os seguintes recebem-no quando o pagamento
-- começa (`CartoesService.iniciarPagamento`).
CREATE SEQUENCE "pedidos_de_cartoes_numero_seq" START WITH 1001;

WITH "ordem" AS (
  SELECT "id", 1000 + ROW_NUMBER() OVER (ORDER BY "criadoEm", "id") AS "n"
    FROM "pedidos_de_cartoes"
   WHERE "referenciaExterna" IS NOT NULL
)
UPDATE "pedidos_de_cartoes" p
   SET "numero" = "ordem"."n"
  FROM "ordem"
 WHERE "ordem"."id" = p."id";

SELECT setval(
  '"pedidos_de_cartoes_numero_seq"',
  (SELECT COALESCE(MAX("numero"), 1000) FROM "pedidos_de_cartoes")
);

-- A taxa das vendas antigas, estimada com as percentagens por omissão (Pix
-- 0,99%, cartão 4,98%) e marcada como estimada. Sem isto, o "seu líquido" do
-- painel somava as vendas antigas como se não tivessem custado nada.
UPDATE "pedidos_de_cartoes"
   SET "taxaCent" = ROUND("totalCent" * (CASE WHEN "meio" = 'CARTAO' THEN 498 ELSE 99 END) / 10000.0),
       "taxaEstimada" = true
 WHERE "pagoEm" IS NOT NULL
   AND "taxaCent" IS NULL;

-- QUEM JÁ COMPROU COM CONTA JÁ É AFILIADO.
--
-- A regra é "a área desbloqueia depois da compra", e quem comprou antes de o
-- programa existir cumpriu-a. O código do link é o @identificador; quem não o
-- tem recebe um "u" com dez caracteres do id, que não se parece com nenhum
-- identificador escolhido por uma pessoa. O link rastreado nasce no primeiro
-- clique — o endereço do site não é conhecido aqui.
INSERT INTO "afiliados" ("id", "userId", "codigo", "estado", "origem", "pedidoDeDesbloqueioId", "criadoEm", "atualizadoEm")
SELECT gen_random_uuid(),
       u."id",
       COALESCE(u."username", 'u' || substr(md5(u."id"::text), 1, 10)),
       'ATIVO',
       'COMPRA_ANTERIOR',
       primeiro."id",
       CURRENT_TIMESTAMP,
       CURRENT_TIMESTAMP
  FROM "users" u
  JOIN LATERAL (
    SELECT p."id"
      FROM "pedidos_de_cartoes" p
     WHERE p."userId" = u."id"
       AND p."pagoEm" IS NOT NULL
     ORDER BY p."pagoEm"
     LIMIT 1
  ) primeiro ON true
 WHERE u."status" = 'ACTIVE'
ON CONFLICT DO NOTHING;
