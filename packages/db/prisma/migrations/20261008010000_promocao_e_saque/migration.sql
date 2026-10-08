-- A promoção com prazo, o pedido de saque, e a simulação com os preços dos cartões (08/10).
ALTER TABLE "precos_de_cartoes"
  ADD COLUMN "promocaoInicio" TIMESTAMP(3),
  ADD COLUMN "promocaoFim" TIMESTAMP(3);

ALTER TABLE "afiliados" ADD COLUMN "saqueSolicitadoEm" TIMESTAMP(3);

ALTER TABLE "configuracao_de_afiliados"
  DROP COLUMN "simulacaoPrecoNormalCent",
  DROP COLUMN "simulacaoPrecoPromocionalCent";
