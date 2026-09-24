-- A oferta dos cartoes: a arte de pe, a porta fechada, e a voz dele por baixo.
--
-- Pedido dele em 24/09, minutos depois de ver o cartaz no ar:
--
--   "Nao pode ser funcional agora"
--   "O designer esta fazendo a arte vai entregar amanha pode ser provisorio"
--   "Este e provisorio em breve"
--   "Estou fazendo o audio paga colocar abaixo da arte"
--
-- Duas colunas e nao um `if` no codigo: o dia de abrir a loja e dele, e a voz
-- que vende os cartoes troca-se as vezes que ele quiser. Nenhuma das duas volta
-- a passar por uma publicacao minha.

-- AlterTable
ALTER TABLE "categorias_de_cartoes"
  ADD COLUMN "ofertaEmBreve"  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "ofertaAudioUrl" TEXT;
