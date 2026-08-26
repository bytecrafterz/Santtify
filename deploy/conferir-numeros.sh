#!/usr/bin/env bash
# Confere, de fora e sem sessão, que os números que aparecem ao lado de cada
# publicação batem com o que se encontra ao abrir.
#
#   bash deploy/conferir-numeros.sh [dominio] [projecto]
#
# Existe porque este foi o defeito que o cliente teve de apontar três vezes: o
# contador dizia uma coisa e a lista mostrava outra, e das duas primeiras vezes
# eu dei-o por corrigido sem ter comparado os dois no ar. Comparar é uma linha;
# acreditar custou duas semanas de confiança.

set -uo pipefail

DOMINIO="${1:-santtify.com}"
PROJECTO="${2:-jesus-alfabeto-saudavel}"
API="https://$DOMINIO/api"

printf '\n\033[1;34m▸ Contadores em %s\033[0m\n' "$DOMINIO"

slugs="$(curl -fsS "$API/projects/$PROJECTO/contents" \
  | python3 -c 'import sys,json;d=json.load(sys.stdin);print(" ".join(c["slug"] for c in (d.get("contents") or d) if c.get("publicado")))' 2>/dev/null)"

if [ -z "$slugs" ]; then
  printf '  \033[0;31m✗\033[0m não consegui listar os conteúdos publicados\n'
  exit 1
fi

falhas=0
for slug in $slugs; do
  id="$(curl -fsS "$API/projects/$PROJECTO/contents/$slug" \
    | python3 -c 'import sys,json;print(json.load(sys.stdin)["content"]["id"])' 2>/dev/null)"
  [ -n "$id" ] || continue

  linha="$(curl -fsS "$API/contents/$id/social" | python3 -c '
import sys, json
d = json.load(sys.stdin)
campos = [d["comentarios"], len(d["lista"]), d["visualizacoes"], d["curtidas"]]
print("\t".join(str(c) for c in campos))' 2>/dev/null)"
  [ -n "$linha" ] || continue

  contador="$(echo "$linha" | cut -f1)"
  lista="$(echo "$linha" | cut -f2)"
  vistas="$(echo "$linha" | cut -f3)"
  curtidas="$(echo "$linha" | cut -f4)"

  if [ "$contador" = "$lista" ]; then
    printf '  \033[0;32m✓\033[0m %-14s comentários %s = %s na lista   (%s vistas, %s curtidas)\n' \
      "$slug" "$contador" "$lista" "$vistas" "$curtidas"
  else
    printf '  \033[0;31m✗\033[0m %-14s comentários %s MAS %s na lista\n' "$slug" "$contador" "$lista"
    falhas=$((falhas + 1))
  fi

  # Um contador negativo não é um número errado, é um número que denuncia a
  # forma como foi obtido. Se voltar a aparecer, alguém repôs a tabela guardada.
  case "$contador$vistas$curtidas" in
    *-*) printf '      \033[0;31mnúmero negativo: o contador voltou a ser guardado em vez de contado\033[0m\n'
         falhas=$((falhas + 1)) ;;
  esac
done

printf '\n\033[1;34m▸ QR de cada letra\033[0m\n'
for slug in $slugs; do
  svg="$(curl -s -o /dev/null -w '%{http_code}' "$API/projects/$PROJECTO/contents/$slug/qr.svg")"
  png="$(curl -s -o /dev/null -w '%{http_code}' "$API/projects/$PROJECTO/contents/$slug/qr.png")"
  if [ "$svg" = "200" ] && [ "$png" = "200" ]; then
    printf '  \033[0;32m✓\033[0m %-14s svg e png\n' "$slug"
  else
    printf '  \033[0;31m✗\033[0m %-14s svg=%s png=%s\n' "$slug" "$svg" "$png"
    falhas=$((falhas + 1))
  fi
done

printf '\n'
if [ "$falhas" -eq 0 ]; then
  printf '\033[0;32m✓ Os números batem com o que se encontra ao abrir.\033[0m\n\n'
else
  printf '\033[0;31m✗ %s divergência(s). Nenhuma delas se resolve sem olhar.\033[0m\n\n' "$falhas"
  exit 1
fi
