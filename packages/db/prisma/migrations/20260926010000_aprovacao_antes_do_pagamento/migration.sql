-- A aprovação que o cliente dá antes de pagar: quando, e a frase que aceitou.
ALTER TABLE "pedidos_de_cartoes" ADD COLUMN "aprovacaoEm" TIMESTAMP(3);
ALTER TABLE "pedidos_de_cartoes" ADD COLUMN "aprovacaoTexto" TEXT;
