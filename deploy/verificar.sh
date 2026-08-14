#!/usr/bin/env bash
# Confere se a plataforma no ar está realmente funcionando.
#
#   bash deploy/verificar.sh
#
# Não olha se o container "está rodando" — container rodando e site quebrado
# convivem bem. Confere o que o visitante vê: HTTPS, redirecionamento, páginas,
# QR Code, mídia e backup.

set -uo pipefail

ENV_FILE="${ENV_FILE:-.env.production}"
[ -f "$ENV_FILE" ] && { set -a; . "./$ENV_FILE"; set +a; }
DOMINIO="${DOMINIO:-${1:-}}"
[ -n "$DOMINIO" ] || { echo "Uso: DOMINIO=exemplo.com bash deploy/verificar.sh"; exit 1; }

# BASE permite apontar as mesmas conferências para o ambiente de teste, que roda
# em HTTP e sem domínio. Sem isso este script só poderia ser exercitado depois
# de existir produção — ou seja, exatamente quando não se quer descobrir que ele
# tem um erro de digitação.
BASE="${BASE:-https://$DOMINIO}"
case "$BASE" in
  https://*) SEGURO=1 ;;
  *)         SEGURO=0 ;;
esac

PROJETO="${NEXT_PUBLIC_PROJETO_PADRAO:-jesus-alfabeto-saudavel}"
# Em produção a API mora sob /api no mesmo domínio; no ambiente de teste ela
# atende numa porta própria.
BASE_API="${BASE_API:-$BASE/api}"
# /health fica na RAIZ da API, fora do prefixo /api (é assim que o Caddy o
# encaminha em produção, e é assim que o container se auto-verifica).
RAIZ_API="${RAIZ_API:-${BASE_API%/api}}"
falhas=0

conferir() { # nome, esperado, obtido
  if [ "$2" = "$3" ]; then
    printf '  \033[0;32m✓\033[0m %s\n' "$1"
  else
    falhas=$((falhas + 1))
    printf '  \033[0;31m✗\033[0m %s (esperado %s, obtido %s)\n' "$1" "$2" "$3"
  fi
}
codigo() { curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$1"; }

echo
echo "Conferindo $BASE"
[ "$SEGURO" -eq 1 ] || echo "(sem HTTPS: as conferências de certificado e redirecionamento ficam de fora)"
echo

conferir "a API responde"            200 "$(codigo "$RAIZ_API/health")"
conferir "o site abre"               200 "$(codigo "$BASE/$PROJETO")"
conferir "a playlist abre"           200 "$(codigo "$BASE/$PROJETO/playlist")"
conferir "a política de privacidade" 200 "$(codigo "$BASE/privacidade")"
conferir "os termos de uso"          200 "$(codigo "$BASE/termos")"
conferir "o app instalável"          200 "$(codigo "$BASE/manifest.json")"

if [ "$SEGURO" -eq 1 ]; then
  # HTTP tem de virar HTTPS sozinho: o QR impresso pode acabar sem o s.
  conferir "http redireciona para https" 308 \
    "$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "http://$DOMINIO/$PROJETO")"

  # O certificado precisa ser válido de verdade, não só existir.
  if curl -fsS --max-time 15 "https://$DOMINIO/health" >/dev/null 2>&1; then
    printf '  \033[0;32m✓\033[0m certificado HTTPS válido\n'
  else
    falhas=$((falhas + 1)); printf '  \033[0;31m✗\033[0m certificado HTTPS inválido ou ausente\n'
  fi
fi

# Um QR Code que não abre é material impresso perdido. O código fica no detalhe
# do conteúdo, não na listagem — por isso os dois passos.
# O primeiro "slug" da resposta é o do PROJETO, não o da primeira letra —
# por isso corta-se tudo até "contents" antes de procurar.
primeira="$(curl -s --max-time 15 "$BASE_API/projects/$PROJETO/contents" \
  | sed 's/.*"contents"//' \
  | grep -oE '"slug":"[^"]+"' | head -1 | cut -d'"' -f4)"
# Confere o endereço EXATO que está gravado dentro do QR, e não um montado
# aqui: é esse endereço que vai para o papel impresso, e é ele que precisa
# abrir. Se um dia o domínio mudar e os links não forem regerados, é aqui que
# aparece — antes de alguém imprimir.
qr_url=""
if [ -n "$primeira" ]; then
  qr_url="$(curl -s --max-time 15 "$BASE_API/projects/$PROJETO/contents/$primeira" \
    | grep -oE '"qrUrl":"[^"]+"' | head -1 | cut -d'"' -f4)"
fi
if [ -n "$qr_url" ]; then
  destino="$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$qr_url")"
  case "$destino" in
    30*|200) printf '  \033[0;32m✓\033[0m o endereço gravado no QR abre (%s → %s)\n' "$qr_url" "$destino" ;;
    *) falhas=$((falhas + 1)); printf '  \033[0;31m✗\033[0m o endereço gravado no QR responde %s: %s\n' "$destino" "$qr_url" ;;
  esac
  case "$qr_url" in
    "$BASE"/*) : ;;
    *) printf '  \033[0;33m!\033[0m o QR aponta para fora de %s — regere os links se o domínio mudou\n' "$BASE" ;;
  esac
else
  printf '  \033[0;33m!\033[0m nenhum QR Code encontrado ainda (conteúdo não cadastrado?)\n'
fi

# A mídia é servida em pedaços: sem isso o áudio não toca no iPhone e não dá
# para arrastar o cursor dentro de uma música de sete minutos.
capa="$(curl -s --max-time 15 "$BASE_API/projects/$PROJETO/contents" \
  | grep -oE '"coverUrl":"[^"]+"' | head -1 | cut -d'"' -f4)"
if [ -n "$capa" ]; then
  parcial="$(curl -s -o /dev/null -w '%{http_code}' -H 'Range: bytes=0-99' --max-time 15 "$capa")"
  conferir "a mídia aceita download em pedaços (áudio no iPhone)" 206 "$parcial"
else
  printf '  \033[0;33m!\033[0m nenhuma capa cadastrada ainda para testar a mídia\n'
fi

# Backup: o log de eventos é o único dado que não se recria.
if command -v docker >/dev/null 2>&1; then
  copias="$(docker compose -f docker-compose.prod.yml --env-file "$ENV_FILE" \
    exec -T backup sh -c 'ls -1 /backups/*.sql.gz 2>/dev/null | wc -l' 2>/dev/null | tr -d '\r' || echo 0)"
  if [ "${copias:-0}" -ge 1 ] 2>/dev/null; then
    printf '  \033[0;32m✓\033[0m %s cópia(s) de segurança no servidor\n' "$copias"
  else
    printf '  \033[0;33m!\033[0m nenhuma cópia ainda — a primeira sai no próximo ciclo diário\n'
  fi
fi

echo
if [ "$falhas" -eq 0 ]; then
  printf '\033[0;32m✓ Tudo respondendo.\033[0m\n\n'
else
  printf '\033[0;31m✗ %s verificação(ões) falharam.\033[0m\n\n' "$falhas"
  exit 1
fi
