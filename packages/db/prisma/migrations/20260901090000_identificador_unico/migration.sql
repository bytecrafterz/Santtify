-- O identificador único de cada pessoa: @nomedeutilizador.
--
-- Pedido dele em 31/08, depois de aparecer na plataforma um perfil chamado
-- "Pf 005981", sem foto e sem nome que identificasse alguém. A frase dele:
-- "duas pessoas podem ter o mesmo nome verdadeiro, isso é normal, mas o
-- identificador não pode se repetir".
--
-- NULO É PERMITIDO NA BASE, e é obrigatório no cadastro. Não é contradição, é
-- a ordem certa: as contas que já existem foram criadas antes desta regra e
-- não podem ser trancadas fora por causa dela. Um NOT NULL aqui obrigaria a
-- inventar um identificador para elas no mesmo segundo, à pressa, e a primeira
-- vez que alguém perde o acesso à sua conta nesta plataforma é a última vez
-- que confia nela.
--
-- Guardado sempre em minúsculas. Assim @JoaoSilva e @joaosilva são a mesma
-- pessoa impossível de existir duas vezes, sem depender de a base ter uma
-- extensão de comparação sem maiúsculas instalada.
ALTER TABLE "users" ADD COLUMN "username" VARCHAR(20);

CREATE UNIQUE INDEX "users_username_key" ON "users" ("username");
