#!/usr/bin/env bash
# Restaura o banco a partir de uma cópia de segurança.
#
#   bash deploy/restaurar.sh                  # lista as cópias disponíveis
#   bash deploy/restaurar.sh pv_2026-08-20_0300.sql.gz
#
# POR QUE ISTE SCRIPT EXISTE: backup que nunca foi restaurado não é backup, é
# esperança. O `backup.sh` roda desde o primeiro dia, mas até existir o caminho
# de volta — testado — ninguém sabe se aqueles arquivos servem para alguma coisa.
#
# É DESTRUTIVO: substitui o banco atual inteiro pelo do arquivo. Por isso pede
# confirmação digitada e tira uma cópia do estado atual antes de mexer.

set -euo pipefail

ENV_FILE="${ENV_FILE:-.env.production}"
COMPOSE="docker compose -f docker-compose.prod.yml --env-file $ENV_FILE"

info() { printf '\n\033[1;34m▸ %s\033[0m\n' "$*"; }
ok()   { printf '  \033[0;32m✓\033[0m %s\n' "$*"; }
morrer(){ printf '  \033[0;31m✗\033[0m %s\n' "$*"; exit 1; }

[ -f "$ENV_FILE" ] || morrer "$ENV_FILE não existe"
set -a; . "./$ENV_FILE"; set +a

ARQUIVO="${1:-}"

if [ -z "$ARQUIVO" ]; then
  info "Cópias disponíveis no servidor"
  $COMPOSE exec -T backup sh -c 'ls -lh /backups/pv_*.sql.gz 2>/dev/null || echo "  nenhuma cópia ainda"'
  cat <<FIM

  Para restaurar uma delas:

    bash deploy/restaurar.sh pv_AAAA-MM-DD_HHMM.sql.gz

FIM
  exit 0
fi

info "Conferindo a cópia"
$COMPOSE exec -T backup sh -c "[ -f /backups/$ARQUIVO ]" \
  || morrer "não encontrei /backups/$ARQUIVO"
# Um .gz truncado só aparece na hora de descomprimir. Melhor descobrir agora.
$COMPOSE exec -T backup sh -c "gzip -t /backups/$ARQUIVO" \
  || morrer "o arquivo está corrompido"
ok "$ARQUIVO íntegro"

cat <<AVISO

  ATENÇÃO: isto substitui TODO o banco de dados atual pelo conteúdo de
  $ARQUIVO. Tudo o que aconteceu depois daquela cópia — visitas, cadastros,
  comentários, eventos — desaparece.

AVISO
read -r -p "  Digite RESTAURAR para confirmar: " confirmacao
[ "$confirmacao" = "RESTAURAR" ] || { echo "  Cancelado."; exit 1; }

# Rede de segurança: se a restauração for a cópia errada, ainda dá para voltar.
info "Guardando o estado atual antes de sobrescrever"
antes="pv_antes-de-restaurar_$(date -u +%Y-%m-%d_%H%M).sql.gz"
$COMPOSE exec -T backup sh -c \
  "pg_dump -h db -U '$POSTGRES_USER' -d '$POSTGRES_DB' --clean --if-exists | gzip > /backups/$antes"
ok "estado atual salvo como $antes"

info "Parando a API para ninguém escrever durante a restauração"
$COMPOSE stop api web >/dev/null
ok "API e site parados"

info "Restaurando"
# O dump foi feito com --clean --if-exists, então ele mesmo derruba e recria.
$COMPOSE exec -T backup sh -c \
  "gunzip -c /backups/$ARQUIVO | psql -h db -U '$POSTGRES_USER' -d '$POSTGRES_DB' -v ON_ERROR_STOP=1 -q"
ok "banco restaurado"

info "Subindo de volta"
$COMPOSE start api web >/dev/null
for i in $(seq 1 30); do
  curl -fsS --max-time 5 "https://$DOMINIO/health" >/dev/null 2>&1 && break
  sleep 3; printf '.'
done
printf '\n'
ok "plataforma no ar"

info "Conferência"
bash deploy/verificar.sh || true

cat <<FIM

  Restauração concluída a partir de $ARQUIVO.
  Se algo saiu errado, o estado anterior está em $antes.

FIM
