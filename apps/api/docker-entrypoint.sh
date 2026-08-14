#!/bin/sh
# Aplica as migrations e só então sobe a API.
#
# POR QUE ISTO EXISTE: até 14/08 o container subia direto no `node main.js`.
# Num servidor novo, o banco está vazio e nenhuma tabela existe — a API subia,
# respondia o /health, e quebrava em toda consulta. O erro apareceria só quando
# alguém abrisse o site, e pareceria problema de aplicação, não de implantação.
#
# `migrate deploy` (e não `migrate dev`) é o comando certo aqui: aplica o que
# está versionado em packages/db/prisma/migrations e NUNCA gera migration nova
# nem apaga dado. Se o banco estiver à frente do código, ele falha e o container
# não sobe — que é o comportamento desejado, porque subir a API contra um schema
# que ela não entende corrompe dado de forma silenciosa.
#
# Roda no start de cada container. É idempotente: com tudo aplicado, não faz
# nada. Com mais de uma réplica de API isso viraria corrida — hoje é uma só, e
# quando deixar de ser, este passo vira um serviço próprio no compose.

set -eu

echo "[entrada] aplicando migrations..."
npx prisma migrate deploy --schema packages/db/prisma/schema.prisma

echo "[entrada] migrations aplicadas. Subindo a API."
exec "$@"
