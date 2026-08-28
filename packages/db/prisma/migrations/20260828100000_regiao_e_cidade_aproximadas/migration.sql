-- Região e cidade aproximadas da visita.
--
-- Ele pediu isto em 28/08, depois de gostar do detalhe por país ("6 visitas de
-- 4 redes diferentes") e querer descer mais um nível.
--
-- NOMES, E NUNCA COORDENADAS. A base devolve latitude e longitude por cada
-- endereço e nada disso entra aqui. Numa plataforma usada por crianças, guardar
-- um ponto no mapa é outra categoria de dado, e não é a que ele pediu nem a que
-- a política de privacidade publicada em nome dele permite.
--
-- Aproximadas de verdade: num telemóvel o endereço é o da operadora, e a cidade
-- que sai é onde está o equipamento dela. O ecrã diz isso à frente do número.
ALTER TABLE "visitors" ADD COLUMN "regionName" VARCHAR(80);
ALTER TABLE "visitors" ADD COLUMN "cityName" VARCHAR(80);

CREATE INDEX "visitors_projectId_countryCode_regionName_idx"
  ON "visitors" ("projectId", "countryCode", "regionName");
