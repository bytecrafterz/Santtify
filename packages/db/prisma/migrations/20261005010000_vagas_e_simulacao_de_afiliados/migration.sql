-- As vagas do programa de afiliados e a simulação de ganhos (05/10).
ALTER TABLE "configuracao_de_afiliados"
  ADD COLUMN "vagas" INTEGER NOT NULL DEFAULT 10,
  ADD COLUMN "simulacaoKits" INTEGER NOT NULL DEFAULT 100,
  ADD COLUMN "simulacaoPrecoNormalCent" INTEGER NOT NULL DEFAULT 13900,
  ADD COLUMN "simulacaoPrecoPromocionalCent" INTEGER NOT NULL DEFAULT 4900;
