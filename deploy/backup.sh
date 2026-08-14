#!/bin/sh
# Backup diário do banco.
#
# O log de eventos é a prova comercial do Produto Vivo e é o único dado do
# projeto que não pode ser recriado: conteúdo se cadastra de novo, evento
# perdido não volta. Por isso o backup existe desde o primeiro dia, e não
# "quando o projeto crescer".
#
# Roda como serviço no compose em vez de cron do host — assim quem subir o
# projeto em outro servidor herda o backup junto, sem configurar nada.

set -eu

DESTINO=/backups
RETENCAO=${RETENCAO_DIAS:-14}

fazer_backup() {
  data=$(date -u +%Y-%m-%d_%H%M)
  arquivo="$DESTINO/pv_${data}.sql.gz"

  echo "[$(date -u +%FT%TZ)] iniciando backup"

  # --clean e --if-exists deixam o dump restaurável sobre um banco existente.
  if pg_dump -h db -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists \
      | gzip > "$arquivo.parcial"; then
    # Renomeia só no fim: um arquivo com nome final é sempre um backup
    # completo. Sem isso, um backup interrompido pareceria válido.
    mv "$arquivo.parcial" "$arquivo"
    echo "[$(date -u +%FT%TZ)] backup pronto: $(basename "$arquivo") ($(du -h "$arquivo" | cut -f1))"
  else
    echo "[$(date -u +%FT%TZ)] FALHA no backup" >&2
    rm -f "$arquivo.parcial"
    return 1
  fi

  # Remove os antigos só DEPOIS de um backup novo ter dado certo.
  find "$DESTINO" -name 'pv_*.sql.gz' -mtime "+$RETENCAO" -delete
  echo "[$(date -u +%FT%TZ)] backups guardados: $(ls -1 "$DESTINO"/pv_*.sql.gz 2>/dev/null | wc -l)"
}

mkdir -p "$DESTINO"

# Um backup logo na subida, para nunca existir uma janela sem cópia nenhuma.
fazer_backup || echo 'primeiro backup falhou, seguindo para o ciclo diário' >&2

while true; do
  sleep 86400
  fazer_backup || true
done
