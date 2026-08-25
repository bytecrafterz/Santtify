#!/usr/bin/env bash
# Descarrega a base offline de países para o servidor.
#
# É a DB-IP Country Lite, gratuita e sem registo, distribuída sob CC-BY. A
# atribuição fica na página de privacidade, como a licença exige.
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
echo "Pronto."
