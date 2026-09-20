-- Blocos numerados por projeto (pedido do cliente em 19/09).
--
-- O Jesus Alfabeto é um alfabeto e continua em A–Z. Os outros projetos passam a
-- ter a quantidade de blocos que ele definir no painel, numerados 1, 2, 3…
--
-- O `ordinal` faz no bloco o que a `letra` faz na letra: diz em que casa da
-- grade o conteúdo mora. Sem ele, os catorze conteúdos do "Minha Identidade"
-- existiam na base e não apareciam em lado nenhum — foi o que ele apanhou ao
-- tocar no card e ver uma página vazia.

-- CreateEnum
CREATE TYPE "SequenciaDoProjeto" AS ENUM ('LETRAS', 'NUMEROS');

-- AlterTable
ALTER TABLE "contents" ADD COLUMN     "ordinal" INTEGER;

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "blocos" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "sequencia" "SequenciaDoProjeto" NOT NULL DEFAULT 'NUMEROS';

-- ── O que já existe fica como está ──────────────────────────────────
--
-- Quem tem letras é alfabeto. Decidido pelos DADOS e não pelo nome do projeto:
-- amanhã há outro alfabeto e ninguém se lembra de vir aqui acrescentá-lo.
UPDATE "projects" p
   SET "sequencia" = 'LETRAS', "blocos" = 26
 WHERE EXISTS (
   SELECT 1 FROM "contents" c WHERE c."projectId" = p."id" AND c."letra" IS NOT NULL
 );

-- Os conteúdos que já nasceram numerados ganham o seu número.
--
-- Dois formatos, os dois nossos: "dia-3" veio do script dos QR Codes dos
-- cartões, e "3" veio do painel, quando ele cria um projeto com N blocos. As
-- páginas dos adultos ("adultos-dia-3") ficam de fora de propósito: são dos
-- cartões impressos, não são blocos do projeto.
UPDATE "contents" c
   SET "ordinal" = CAST(substring(c."slug" FROM '^dia-([0-9]+)$') AS INTEGER)
  FROM "projects" p
 WHERE p."id" = c."projectId"
   AND p."sequencia" = 'NUMEROS'
   AND c."slug" ~ '^dia-[0-9]+$';

UPDATE "contents" c
   SET "ordinal" = CAST(c."slug" AS INTEGER)
  FROM "projects" p
 WHERE p."id" = c."projectId"
   AND p."sequencia" = 'NUMEROS'
   AND c."slug" ~ '^[0-9]+$'
   AND c."ordinal" IS NULL;

-- E a grade passa a ter tantas casas quantos os blocos que existem. Ele muda
-- este número no painel quando quiser mais.
UPDATE "projects" p
   SET "blocos" = COALESCE(sub."maior", 0)
  FROM (
    SELECT c."projectId" AS "id", MAX(c."ordinal") AS "maior"
      FROM "contents" c
     WHERE c."ordinal" IS NOT NULL
     GROUP BY c."projectId"
  ) sub
 WHERE p."id" = sub."id" AND p."sequencia" = 'NUMEROS';

-- CreateIndex
CREATE UNIQUE INDEX "contents_projectId_ordinal_key" ON "contents"("projectId", "ordinal");
