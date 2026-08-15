#!/usr/bin/env bash
# Mantém o AMBIENTE DE TESTE de pé.
#
# Não é para produção — em produção quem faz isto é o Docker, com
# `restart: unless-stopped`. Aqui a API e o site rodam soltos, sem supervisor,
# e já caíram cinco vezes durante o desenvolvimento. O problema não é a queda em
# si: é o cliente abrir o link para testar, encontrar o site fora do ar e
# concluir que o trabalho não está pronto.
#
#   nohup bash deploy/manter-no-ar.sh > /tmp/vigia.log 2>&1 &
#
# Confere a cada 30 segundos e religa o que morreu, sem tocar no que está vivo.

set -u

RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
cd "$RAIZ"

# Relê o .env a CADA religada, e não uma vez só na subida do vigia.
#
# Motivo prático: quando o número de WhatsApp entrou no .env, o site foi
# reiniciado e continuou sem ele — o processo herdava o ambiente que o vigia
# tinha carregado minutos antes. Variável nova exigia reiniciar o vigia, o que
# ninguém iria lembrar.
carregar_ambiente() { set -a; . "$RAIZ/.env"; set +a; }
carregar_ambiente

log() { echo "[$(date -u +%FT%TZ)] $*"; }

no_ar() { curl -fsS --max-time 5 -o /dev/null "$1" 2>/dev/null; }

subir_api() {
  log "API fora do ar — religando"
  carregar_ambiente
  # setsid: o processo precisa sobreviver ao encerramento do shell que o criou.
  # Sem isto o site subia, servia algumas páginas e morria junto com a sessão.
  setsid nohup node apps/api/dist/main.js >> /tmp/api.log 2>&1 < /dev/null &
}

subir_web() {
  log "site fora do ar — religando"
  carregar_ambiente
  cd "$RAIZ/apps/web"
  # `next start` e não `next dev`: o cliente testando não pode depender de um
  # servidor de desenvolvimento, que é mais lento e mais frágil.
  setsid nohup npx next dev -p 3100 >> /tmp/web.log 2>&1 < /dev/null &
  cd "$RAIZ"
}

log "vigia iniciado"
while true; do
  no_ar "http://127.0.0.1:3333/health" || subir_api
  no_ar "http://127.0.0.1:3100/" || subir_web
  sleep 30
done
