-- UMA FOLGA DE UM MINUTO NA TROCA DO TOKEN DE SESSÃO.
--
-- O cliente relatou em 24/08 que ficava três horas sem entrar e ao voltar
-- tinha de fazer login outra vez, mesmo com "lembrar meu login" marcado.
--
-- A causa: o servidor revogava o token antigo ANTES de o telemóvel confirmar
-- que recebeu o novo. Basta a resposta perder-se — e num telemóvel que acaba
-- de acordar, perde-se — para o aparelho ficar com um token que o servidor já
-- matou. A sessão morre sem ninguém ter feito nada de errado.
--
-- `rotatedAt` distingue "trocado" de "revogado". Um token trocado continua a
-- valer um minuto, o suficiente para uma repetição. Sair da conta continua a
-- valer no instante, porque aí só `revokedAt` é preenchido.

ALTER TABLE "refresh_tokens" ADD COLUMN "rotatedAt" TIMESTAMP(3);

-- Os que já foram revogados por troca não se distinguem retroactivamente dos
-- que foram revogados por logout. Ficam todos como revogados, que é o
-- comportamento antigo e o mais seguro dos dois.
