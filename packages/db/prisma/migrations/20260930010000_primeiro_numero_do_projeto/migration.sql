-- O NÚMERO DO PRIMEIRO BLOCO (30/09)
--
-- A Escola de Sabedoria continua a contagem do Minha Identidade e começa no
-- Dia 8. Só esquema: todos os projetos que já existem ficam em 1, que é o
-- que eram.

-- AlterTable
ALTER TABLE "projects" ADD COLUMN "primeiroNumero" INTEGER NOT NULL DEFAULT 1;
