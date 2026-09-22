#!/bin/bash
# Poe as letras na ordem do alfabeto.
#
# `position` e "ordem de exibicao dentro do projeto (A=1, B=2, ... no alfabeto)",
# esta escrito no proprio schema. A Letra B ficou na 101 e a playlist tocava
# Introducao, A, C, D ... N, e so ai o B.
#
# NAO calcula a partir do valor actual: calcula a partir da LETRA.
#   Introducao fica na 1 (letra nula, nao se toca)
#   A=2, B=3, C=4 ... Z=27
#   Produto Vivo fica na 900 (letra nula, nao se toca)
#
# Correr isto duas vezes da o mesmo resultado. So mexe na ORDEM: a slug nao
# muda, os enderecos curtos dos QR impressos nao mudam, nenhum conteudo se toca.
set -euo pipefail

SQL=$(cat <<'FIM'
\set ON_ERROR_STOP on
begin;

\echo '== ANTES: a ordem, lida pela posicao =='
select string_agg(coalesce(c.letra,'?'), '' order by c.position) as pela_posicao
  from contents c join projects p on p.id = c."projectId"
 where p.slug = 'jesus-alfabeto-saudavel' and c.letra is not null;

\echo
\echo '== As linhas que vao mudar =='
select c.position as antes, ascii(c.letra) - ascii('A') + 2 as depois, c.slug, c.letra
  from contents c join projects p on p.id = c."projectId"
 where p.slug = 'jesus-alfabeto-saudavel'
   and c.letra is not null
   and c.position is distinct from (ascii(c.letra) - ascii('A') + 2)
 order by c.position;

update contents
   set position = ascii(letra) - ascii('A') + 2
 where "projectId" = (select id from projects where slug = 'jesus-alfabeto-saudavel')
   and letra is not null;

\echo
\echo '== DEPOIS =='
select c.position, c.slug, c.letra, left(c.title,26) as titulo, c.status
  from contents c join projects p on p.id = c."projectId"
 where p.slug = 'jesus-alfabeto-saudavel'
 order by c.position;

\echo
\echo '== CONFERENCIA: tem de sair o alfabeto inteiro, por ordem =='
select string_agg(c.letra, '' order by c.position) as pela_posicao,
       (string_agg(c.letra, '' order by c.position) = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') as certo
  from contents c join projects p on p.id = c."projectId"
 where p.slug = 'jesus-alfabeto-saudavel' and c.letra is not null;

\echo
\echo '== CONFERENCIA: nenhuma posicao repetida =='
select count(*) as posicoes_repetidas from (
  select c.position from contents c join projects p on p.id = c."projectId"
   where p.slug = 'jesus-alfabeto-saudavel'
   group by c.position having count(*) > 1
) x;

commit;

\echo
\echo '== E os outros projectos, que vao por numero em vez de letra =='
select p.slug, c.position, c.ordinal, left(c.title,26) as titulo
  from contents c join projects p on p.id = c."projectId"
 where p.sequencia = 'NUMEROS' and c.ordinal is not null
   and c.position is distinct from c.ordinal
 order by p.slug, c.ordinal;
FIM
)

echo "$SQL" | docker exec -i produtovivo-db-1 psql -U produtovivo -d produtovivo -A -F'|'
