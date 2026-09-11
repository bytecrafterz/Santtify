-- Categorias de cartões: Crianças, Adultos, e o que vier depois.
--
-- ESCRITA À MÃO, e não gerada, por uma razão só: o `prisma migrate diff`
-- acrescentava `categoriaId UUID NOT NULL` directamente a uma tabela que já tem
-- modelos — aqui sete, em produção os que lá estiverem. Isso falha na hora, e
-- falha em produção, que é o pior sítio. A ordem certa é: criar a categoria,
-- acrescentar a coluna vazia, preenchê-la, e só depois torná-la obrigatória.
--
-- Todo o modelo que já existia passa para uma categoria "Crianças" do seu
-- projeto, porque era isso que eles eram antes de haver categorias.

-- 1. A tabela das categorias ------------------------------------------------
CREATE TABLE "categorias_de_cartoes" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "capaUrl" TEXT,
    "rotuloSingular" TEXT NOT NULL DEFAULT 'criança',
    "rotuloPlural" TEXT NOT NULL DEFAULT 'crianças',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "precoUnitarioCent" INTEGER,
    "descontoPercentagem" INTEGER,
    "descontoAPartirDe" INTEGER,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categorias_de_cartoes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "categorias_de_cartoes_projectId_ativo_ordem_idx" ON "categorias_de_cartoes"("projectId", "ativo", "ordem");
CREATE UNIQUE INDEX "categorias_de_cartoes_projectId_slug_key" ON "categorias_de_cartoes"("projectId", "slug");

ALTER TABLE "categorias_de_cartoes" ADD CONSTRAINT "categorias_de_cartoes_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 2. Uma categoria "Crianças" em cada projeto que já tinha modelos -----------
-- gen_random_uuid() é nativo desde o Postgres 13; a base é o 16.
INSERT INTO "categorias_de_cartoes" ("id", "projectId", "slug", "nome", "rotuloSingular", "rotuloPlural", "ativo", "ordem", "atualizadoEm")
SELECT gen_random_uuid(), p."projectId", 'criancas', 'Crianças', 'criança', 'crianças', true, 1, CURRENT_TIMESTAMP
FROM (SELECT DISTINCT "projectId" FROM "modelos_de_cartao") AS p;

-- 3. Modelos: coluna vazia, preencher, e só então obrigatória ---------------
ALTER TABLE "modelos_de_cartao" ADD COLUMN "categoriaId" UUID;

UPDATE "modelos_de_cartao" AS m
SET "categoriaId" = c."id"
FROM "categorias_de_cartoes" AS c
WHERE c."projectId" = m."projectId" AND c."slug" = 'criancas';

ALTER TABLE "modelos_de_cartao" ALTER COLUMN "categoriaId" SET NOT NULL;

-- O slug passa a ser único DENTRO da categoria: "dia-1" existe nas duas.
DROP INDEX "modelos_de_cartao_projectId_idioma_ativo_idx";
DROP INDEX "modelos_de_cartao_projectId_slug_key";
CREATE INDEX "modelos_de_cartao_categoriaId_idioma_ativo_idx" ON "modelos_de_cartao"("categoriaId", "idioma", "ativo");
CREATE UNIQUE INDEX "modelos_de_cartao_categoriaId_slug_key" ON "modelos_de_cartao"("categoriaId", "slug");

ALTER TABLE "modelos_de_cartao" ADD CONSTRAINT "modelos_de_cartao_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "categorias_de_cartoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 4. Pedidos: categoria, idioma, e o limiar do desconto copiado -------------
-- Os pedidos antigos foram calculados com o limiar 2 escrito na conta, por
-- isso 2 é o valor fiel para eles, e não o que estiver hoje no painel.
ALTER TABLE "pedidos_de_cartoes"
    ADD COLUMN "categoriaId" UUID,
    ADD COLUMN "idioma" TEXT NOT NULL DEFAULT 'pt-BR',
    ADD COLUMN "descontoAPartirDe" INTEGER NOT NULL DEFAULT 2;

UPDATE "pedidos_de_cartoes" AS pd
SET "categoriaId" = c."id"
FROM "categorias_de_cartoes" AS c
WHERE c."projectId" = pd."projectId" AND c."slug" = 'criancas';

ALTER TABLE "pedidos_de_cartoes" ADD CONSTRAINT "pedidos_de_cartoes_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "categorias_de_cartoes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
