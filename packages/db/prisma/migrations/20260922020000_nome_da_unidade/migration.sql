-- Como se chama uma casa deste projeto (pedido do cliente em 21/09).
--
-- Ele foi publicar no "Minha Identidade e Poder em Jesus" e nao reconheceu o
-- painel: "a estrutura de publicacao esta muito desorganizada e nao tem as
-- mesmas opcoes que já existem no Jesus Alfabeto Saudavel". E nao tinha, mas
-- nao por falta de estrutura -- a estrutura e a mesma desde 19/09. O que
-- faltava era o painel falar a lingua do projeto:
--
--   "O que muda de um projeto para outro e o conteudo e a identificacao da
--    unidade -- por exemplo, no Alfabeto e Letra A, Letra B, Letra C; no Minha
--    Identidade e Dia 1, Dia 2, Dia 3... A estrutura de gerenciamento e
--    publicacao deve continuar a mesma."
--
-- O nome estava escrito no codigo em cinco sitios, e por isso um projeto de
-- sete dias dizia "Letra", "Bloco", "Escolha uma letra" e "CONTINUA ATE A
-- LETRA Z". Passa a estar na base, uma vez, por projeto.

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "unidade" TEXT NOT NULL DEFAULT 'Bloco';

-- ── Quem se chama o que, decidido pelos DADOS ────────────────────────────
--
-- Mesma regra da migracao dos blocos numerados, e pelo mesmo motivo: amanha ha
-- outro alfabeto, ou outro projeto de sete dias, e ninguem se lembra de vir
-- aqui acrescentar o slug dele a uma lista.

-- Quem tem letras e alfabeto.
UPDATE "projects"
   SET "unidade" = 'Letra'
 WHERE "sequencia" = 'LETRAS';

-- Quem tem conteudos slugados "dia-N" conta-se por dias. E o caso do Minha
-- Identidade, cujos sete conteudos nasceram assim no script dos QR Codes.
UPDATE "projects" p
   SET "unidade" = 'Dia'
 WHERE p."sequencia" = 'NUMEROS'
   AND EXISTS (
     SELECT 1 FROM "contents" c
      WHERE c."projectId" = p."id"
        AND c."slug" ~ '^dia-[0-9]+$'
   );

-- Os restantes ficam em "Bloco", que e o nome generico e honesto para uma casa
-- de um projeto que ainda nao disse como se conta. Ele muda-o no painel.
