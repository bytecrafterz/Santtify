-- CreateEnum
CREATE TYPE "DestaqueDoCarrossel" AS ENUM ('ESQUERDA', 'DIREITA');

-- CreateEnum
CREATE TYPE "FormatoDaMoldura" AS ENUM ('CIRCULO', 'ELIPSE', 'RETANGULO');

-- CreateEnum
CREATE TYPE "EstadoDoPedido" AS ENUM ('RASCUNHO', 'AGUARDANDO_PAGAMENTO', 'PAGO', 'PRONTO', 'EXPIRADO');

-- CreateEnum
CREATE TYPE "MeioDePagamento" AS ENUM ('PIX', 'CARTAO');

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "coverUrl" TEXT,
ADD COLUMN     "destaque" "DestaqueDoCarrossel",
ADD COLUMN     "ordemNoCarrossel" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "tagline" TEXT;

-- CreateTable
CREATE TABLE "modelos_de_cartao" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "dia" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "arteUrl" TEXT,
    "arteImpressaoUrl" TEXT,
    "fotoX" DOUBLE PRECISION NOT NULL,
    "fotoY" DOUBLE PRECISION NOT NULL,
    "fotoLargura" DOUBLE PRECISION NOT NULL,
    "fotoAltura" DOUBLE PRECISION NOT NULL,
    "fotoFormato" "FormatoDaMoldura" NOT NULL DEFAULT 'ELIPSE',
    "nomeX" DOUBLE PRECISION NOT NULL,
    "nomeY" DOUBLE PRECISION NOT NULL,
    "nomeLargura" DOUBLE PRECISION NOT NULL,
    "nomeAltura" DOUBLE PRECISION NOT NULL,
    "nomeCorHex" TEXT NOT NULL DEFAULT '#12356B',
    "nomeCorpoMinimo" DOUBLE PRECISION NOT NULL DEFAULT 8,
    "nomeCorpoMaximo" DOUBLE PRECISION NOT NULL DEFAULT 20,
    "nomeMaiusculas" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "modelos_de_cartao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "precos_de_cartoes" (
    "projectId" UUID NOT NULL,
    "precoUnitarioCent" INTEGER NOT NULL DEFAULT 3000,
    "moeda" TEXT NOT NULL DEFAULT 'BRL',
    "descontoPercentagem" INTEGER NOT NULL DEFAULT 30,
    "descontoAPartirDe" INTEGER NOT NULL DEFAULT 2,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "precos_de_cartoes_pkey" PRIMARY KEY ("projectId")
);

-- CreateTable
CREATE TABLE "pedidos_de_cartoes" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "userId" UUID,
    "estado" "EstadoDoPedido" NOT NULL DEFAULT 'RASCUNHO',
    "precoUnitarioCent" INTEGER NOT NULL,
    "descontoPercentagem" INTEGER NOT NULL,
    "subtotalCent" INTEGER NOT NULL DEFAULT 0,
    "descontoCent" INTEGER NOT NULL DEFAULT 0,
    "totalCent" INTEGER NOT NULL DEFAULT 0,
    "moeda" TEXT NOT NULL DEFAULT 'BRL',
    "meio" "MeioDePagamento",
    "referenciaExterna" TEXT,
    "pixCopiaECola" TEXT,
    "pixQrSvg" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "pagoEm" TIMESTAMP(3),
    "prontoEm" TIMESTAMP(3),
    "expiraEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pedidos_de_cartoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "criancas_do_pedido" (
    "id" UUID NOT NULL,
    "pedidoId" UUID NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "nome" TEXT NOT NULL DEFAULT '',
    "fotoPath" TEXT,
    "fotoLargura" INTEGER,
    "fotoAltura" INTEGER,
    "escala" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "deslocX" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "deslocY" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tamanhoDoNome" DOUBLE PRECISION NOT NULL DEFAULT 0.6,
    "dpi" INTEGER,
    "nivel" TEXT,
    "aprovada" BOOLEAN NOT NULL DEFAULT false,
    "selecionada" BOOLEAN NOT NULL DEFAULT false,
    "confirmada" BOOLEAN NOT NULL DEFAULT false,
    "pdfPath" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "criancas_do_pedido_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eventos_de_pagamento" (
    "id" UUID NOT NULL,
    "pedidoId" UUID NOT NULL,
    "idExterno" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "bruto" JSONB NOT NULL DEFAULT '{}',
    "recebidoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "eventos_de_pagamento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "modelos_de_cartao_projectId_ativo_ordem_idx" ON "modelos_de_cartao"("projectId", "ativo", "ordem");

-- CreateIndex
CREATE UNIQUE INDEX "modelos_de_cartao_projectId_slug_key" ON "modelos_de_cartao"("projectId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "pedidos_de_cartoes_referenciaExterna_key" ON "pedidos_de_cartoes"("referenciaExterna");

-- CreateIndex
CREATE INDEX "pedidos_de_cartoes_projectId_estado_idx" ON "pedidos_de_cartoes"("projectId", "estado");

-- CreateIndex
CREATE INDEX "pedidos_de_cartoes_expiraEm_idx" ON "pedidos_de_cartoes"("expiraEm");

-- CreateIndex
CREATE INDEX "criancas_do_pedido_pedidoId_ordem_idx" ON "criancas_do_pedido"("pedidoId", "ordem");

-- CreateIndex
CREATE UNIQUE INDEX "eventos_de_pagamento_idExterno_key" ON "eventos_de_pagamento"("idExterno");

-- CreateIndex
CREATE INDEX "eventos_de_pagamento_pedidoId_idx" ON "eventos_de_pagamento"("pedidoId");

-- CreateIndex
CREATE UNIQUE INDEX "projects_destaque_key" ON "projects"("destaque");

-- AddForeignKey
ALTER TABLE "modelos_de_cartao" ADD CONSTRAINT "modelos_de_cartao_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "precos_de_cartoes" ADD CONSTRAINT "precos_de_cartoes_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos_de_cartoes" ADD CONSTRAINT "pedidos_de_cartoes_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos_de_cartoes" ADD CONSTRAINT "pedidos_de_cartoes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "criancas_do_pedido" ADD CONSTRAINT "criancas_do_pedido_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "pedidos_de_cartoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eventos_de_pagamento" ADD CONSTRAINT "eventos_de_pagamento_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "pedidos_de_cartoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

