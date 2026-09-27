-- Quem abriu cada conversa privada: o único que pode apagar mensagens nela.
ALTER TABLE "conversas_privadas" ADD COLUMN "criadaPorId" UUID;

-- As conversas que já existiam não guardaram quem as abriu. A primeira pessoa a
-- escrever nelas foi quem as abriu (só um administrador abre, e abre para
-- escrever); sem mensagens, fica nulo e ninguém apaga.
UPDATE "conversas_privadas" c
   SET "criadaPorId" = (
     SELECT m."autorId" FROM "mensagens_privadas" m
      WHERE m."conversaId" = c."id"
      ORDER BY m."criadaEm" ASC
      LIMIT 1
   )
 WHERE c."criadaPorId" IS NULL;

ALTER TABLE "conversas_privadas" ADD CONSTRAINT "conversas_privadas_criadaPorId_fkey"
  FOREIGN KEY ("criadaPorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
