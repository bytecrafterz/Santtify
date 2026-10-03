-- O código de liberação dos cartões (03/10): o PDF passa a ser montado no
-- telemóvel, e o servidor guarda só o pagamento e este código.
ALTER TABLE "pedidos_de_cartoes" ADD COLUMN "codigoDeLiberacao" TEXT;
CREATE UNIQUE INDEX "pedidos_de_cartoes_codigoDeLiberacao_key" ON "pedidos_de_cartoes"("codigoDeLiberacao");
