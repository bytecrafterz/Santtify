-- O nome ganha posicao e cor, escolhidas por quem compra.
--
-- Pedido dele em 25/09, no desenho do editor novo: tocar no nome mostra "apenas
-- os controles necessarios para tamanho e posicionamento". O tamanho ja existia
-- (`tamanhoDoNome`); faltavam estes dois.
--
-- CENTRO por omissao porque centrar e o que estava escrito no codigo ate agora,
-- e e quase sempre o certo -- os cartoes ja feitos nao mudam de aspecto.
--
-- A cor nasce NULA, e nulo e diferente de "igual a do modelo": uma arte que
-- amanha mude a cor do nome leva consigo todos os cartoes que nao escolheram
-- cor, e so esses.

-- CreateEnum
CREATE TYPE "AlinhamentoDoNome" AS ENUM ('ESQUERDA', 'CENTRO', 'DIREITA');

-- AlterTable
ALTER TABLE "criancas_do_pedido"
  ADD COLUMN "nomeAlinhamento" "AlinhamentoDoNome" NOT NULL DEFAULT 'CENTRO',
  ADD COLUMN "nomeCorHex"      TEXT;
