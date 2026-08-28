#!/usr/bin/env bash
# Descarrega as bases offline de localização para o servidor.
#
# São a DB-IP Country Lite e a DB-IP City Lite, gratuitas e sem registo,
# distribuídas sob CC-BY. A atribuição fica na página de privacidade, como a
# licença exige.
#
# A de cidade entrou em 28/08, quando ele pediu região e cidade. É pesada (60 MB
# comprimida, 125 MB no disco) e é OPCIONAL: sem ela o país continua a sair da
# pequena, que é o que estava a acontecer até agora.
#
# Porquê offline e não um serviço de consulta: perguntar o país a um terceiro
# por cada visita obrigaria a mandar para fora o endereço de rede de cada
# criança que abre a plataforma. A política de privacidade publicada promete o
# contrário. Assim o endereço nunca sai daqui.
#
# A base é mensal. Correr isto uma vez por mês mantém-na fresca; não correr
# nunca faz o país deixar de ser identificado, e mais nada.
set -euo pipefail

DESTINO="${1:-/opt/produtovivo/geo}"
MES="$(date +%Y-%m)"
URL="https://download.db-ip.com/free/dbip-country-lite-${MES}.mmdb.gz"

mkdir -p "$DESTINO"
echo "A descarregar ${URL}"

if ! curl -fsSL -o "${DESTINO}/nova.mmdb.gz" "$URL"; then
  # No princípio do mês a base nova pode ainda não existir. A do mês passado
  # serve: um país não muda de sítio em trinta dias.
  ANTERIOR="$(date -d '1 month ago' +%Y-%m 2>/dev/null || date -v-1m +%Y-%m)"
  echo "  o mês corrente ainda não está publicado; a usar ${ANTERIOR}"
  curl -fsSL -o "${DESTINO}/nova.mmdb.gz" \
    "https://download.db-ip.com/free/dbip-country-lite-${ANTERIOR}.mmdb.gz"
fi

gunzip -f "${DESTINO}/nova.mmdb.gz"
# Só troca a que está em uso depois de a nova estar inteira no disco: assim uma
# descarga interrompida nunca deixa o servidor com um ficheiro meio escrito.
mv -f "${DESTINO}/nova.mmdb" "${DESTINO}/dbip-country-lite.mmdb"
ls -lh "${DESTINO}/dbip-country-lite.mmdb"

# ── Base de cidade ─────────────────────────────────────────────────────────
# A mesma dança, com o mesmo cuidado de só trocar no fim. Se falhar, o aviso
# fica e o script sai bem: a base de países já está no sítio e é ela que
# sustenta o painel. Uma falha aqui não pode travar um deploy.
URL_CIDADE="https://download.db-ip.com/free/dbip-city-lite-${MES}.mmdb.gz"
echo "A descarregar ${URL_CIDADE}"

if ! curl -fsSL -o "${DESTINO}/nova-cidade.mmdb.gz" "$URL_CIDADE"; then
  ANTERIOR="$(date -d '1 month ago' +%Y-%m 2>/dev/null || date -v-1m +%Y-%m)"
  echo "  o mês corrente ainda não está publicado; a usar ${ANTERIOR}"
  if ! curl -fsSL -o "${DESTINO}/nova-cidade.mmdb.gz" \
    "https://download.db-ip.com/free/dbip-city-lite-${ANTERIOR}.mmdb.gz"; then
    echo "  AVISO: não consegui a base de cidades. Região e cidade ficam vazias."
    rm -f "${DESTINO}/nova-cidade.mmdb.gz"
    echo "Pronto."
    exit 0
  fi
fi

gunzip -f "${DESTINO}/nova-cidade.mmdb.gz"
mv -f "${DESTINO}/nova-cidade.mmdb" "${DESTINO}/dbip-city-lite.mmdb"
ls -lh "${DESTINO}/dbip-city-lite.mmdb"
echo "Pronto."
