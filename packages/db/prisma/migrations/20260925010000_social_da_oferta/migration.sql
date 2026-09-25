-- A oferta dos cartoes passa a ser uma publicacao: ver, curtir, comentar,
-- partilhar.
--
-- Pedido dele em 25/09, sobre o cartaz que entrou ontem por baixo dos dias:
-- "Tem que ter esta funcoes view like comentario compartilhamento".
--
-- O comentario vai para a MESMA tabela dos outros, numa coluna nova. E a
-- terceira vez que este ficheiro escreve esta frase, e a razao nao mudou: a
-- fila de moderacao dele le de `comments`, e um comentario guardado noutra
-- tabela ficaria publico sem ninguem o ver. Num cartaz que vende fotografias
-- de criancas, isso nao e um detalhe de arrumo.
--
-- A curtida leva tabela propria, como a do projeto, porque a chave unica e o
-- que garante uma curtida por pessoa -- e uma chave unica sobre colunas que se
-- alternam a nulo nao garante nada.

-- AlterTable
ALTER TABLE "comments" ADD COLUMN "ofertaId" UUID;

-- CreateTable
CREATE TABLE "reacoes_da_oferta" (
    "id"        UUID NOT NULL,
    "ofertaId"  UUID NOT NULL,
    "userId"    UUID NOT NULL,
    "type"      "ReactionType" NOT NULL DEFAULT 'LIKE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reacoes_da_oferta_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reacoes_da_oferta_ofertaId_idx" ON "reacoes_da_oferta"("ofertaId");
CREATE UNIQUE INDEX "reacoes_da_oferta_ofertaId_userId_type_key"
    ON "reacoes_da_oferta"("ofertaId", "userId", "type");
CREATE INDEX "comments_ofertaId_idx" ON "comments"("ofertaId");

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_ofertaId_fkey"
    FOREIGN KEY ("ofertaId") REFERENCES "categorias_de_cartoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reacoes_da_oferta" ADD CONSTRAINT "reacoes_da_oferta_ofertaId_fkey"
    FOREIGN KEY ("ofertaId") REFERENCES "categorias_de_cartoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reacoes_da_oferta" ADD CONSTRAINT "reacoes_da_oferta_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
