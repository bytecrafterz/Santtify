-- O preco riscado: "Coloca preco 79 por 49" -- 25/09.
--
-- O cartaz dele ja mostrava "DE R$ 79,00" riscado ao lado de "R$ 49,00", mas
-- pintados dentro da imagem -- e a caixa cobrava R$ 30. Agora os dois numeros
-- vivem na base, no painel dele, e o ecra le-os de la.
--
-- Nulo por omissao: nenhum projeto passa a ter preco riscado sem alguem o
-- escrever. Um preco riscado e uma afirmacao sobre o passado -- "custava 79" --
-- e quem a escreve tem de ser quem responde por ela.

-- AlterTable
ALTER TABLE "precos_de_cartoes"   ADD COLUMN "precoDeTabelaCent" INTEGER;
ALTER TABLE "categorias_de_cartoes" ADD COLUMN "precoDeTabelaCent" INTEGER;

-- O pedido congela o riscado que estava em vigor quando nasceu, como ja congela
-- o preco e o desconto: quem viu "de R$ 79 por R$ 49" ao editar tem de ver o
-- mesmo ao pagar, mesmo que a promocao mude no painel entretanto.
ALTER TABLE "pedidos_de_cartoes" ADD COLUMN "precoDeTabelaCent" INTEGER;
