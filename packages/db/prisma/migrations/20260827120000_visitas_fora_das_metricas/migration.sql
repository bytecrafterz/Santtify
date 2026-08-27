-- VISITAS QUE NÃO CONTAM PARA AS MÉTRICAS.
--
-- Em 27/08 o painel dizia 66 acessos da Alemanha a um projeto que nunca foi
-- divulgado lá. Eram todos meus: a máquina de desenvolvimento fica num centro
-- de dados alemão, e as 69 linhas partilham um único endereço. Ele ia usar esse
-- número para decidir em que idioma traduzir a plataforma.
--
-- Ele pediu também, e com razão, uma forma de tirar os próprios acessos de
-- administrador das contas: entra no site dezenas de vezes por dia a testar.
--
-- NÃO SE APAGA, MARCA-SE. O log de eventos é append-only de propósito, e é a
-- única coisa deste sistema que não se recria: apagar visitantes levaria os
-- eventos deles atrás. Uma coluna resolve sem perder história, e permite
-- desmarcar se um dia se descobrir que se excluiu de mais.
ALTER TABLE "visitors"
  ADD COLUMN "ignoradoNasMetricas" BOOLEAN NOT NULL DEFAULT false;

-- Os índices das métricas passam a filtrar por isto em todas as consultas, e
-- sem o índice a grade de 26 letras passaria a varrer a tabela inteira.
CREATE INDEX "visitors_projectId_ignoradoNasMetricas_idx"
  ON "visitors" ("projectId", "ignoradoNasMetricas");
