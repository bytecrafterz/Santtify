-- Os comentarios voltam para o cartao onde foram escritos (pedido do cliente
-- em 21/09).
--
--   "Cada comentario precisa permanecer dentro do conteudo especifico onde a
--    pessoa comentou. (...) um comentario feito em outro cartao nao pode
--    aparecer embaixo do AVISO IMPORTANTE simplesmente porque esse e o final da
--    pagina. (...) Tambem verifique os comentarios antigos que ja estao
--    cadastrados, porque eles precisam voltar para o conteudo onde
--    originalmente foram feitos, e nao serem apagados nem ficarem todos
--    agrupados no final."
--
-- ── O que nao da para fazer, e porque ────────────────────────────────────
--
-- "Voltar para o conteudo onde originalmente foram feitos" nao e recuperavel ao
-- nivel do CARTAO. Estes comentarios foram escritos quando a pagina tinha uma
-- caixa de comentarios so, no fim, ligada ao conteudo inteiro: `blockId` nunca
-- foi gravado, e o evento COMMENT tambem nao o guarda. A informacao de qual dos
-- cartoes a pessoa estava a ler nunca existiu.
--
-- Por isso isto NAO inventa uma origem. Faz a unica coisa honesta que restava:
-- pendura cada comentario no PRIMEIRO cartao do conteudo onde foi escrito, que
-- e onde a pessoa que abre aquela letra o vai encontrar em contexto, em vez de
-- empilhado no fim de tudo. O conteudo esta certo; o cartao e uma escolha, e
-- fica escrita aqui para quem vier depois nao a confundir com um dado.
--
-- Os que ja tem `blockId` nao se tocam: esses foram escritos na faixa e sabem
-- onde moram.

UPDATE "comments" c
   SET "blockId" = primeiro."id"
  FROM (
    SELECT b."contentId",
           b."id",
           ROW_NUMBER() OVER (
             PARTITION BY b."contentId"
             ORDER BY b."slot" ASC NULLS LAST, b."position" ASC, b."id" ASC
           ) AS ordem
      FROM "content_blocks" b
     WHERE b."type" = 'AUDIO'
       AND b."papel" = 'CARTAO'
  ) primeiro
 WHERE primeiro."contentId" = c."contentId"
   AND primeiro.ordem = 1
   AND c."contentId" IS NOT NULL
   AND c."blockId" IS NULL
   AND c."profileUserId" IS NULL;
