#!/usr/bin/env bash
# Publica (ou atualiza) a plataforma no servidor.
#
#   bash deploy/publicar.sh
#
# Roda na raiz do projeto, no servidor, com o .env.production já preenchido.
# É seguro rodar de novo: atualiza o que mudou e mantém banco e mídia.
#
# A ordem importa. As conferências vêm ANTES de qualquer container subir,
# porque dois erros aqui são caros de desfazer: pedir certificado com o DNS
# errado queima tentativas no Let's Encrypt (que limita por semana), e subir
# com segredo de exemplo deixa a plataforma aberta.

set -euo pipefail

ENV_FILE="${ENV_FILE:-.env.production}"
COMPOSE="docker compose -f docker-compose.prod.yml --env-file $ENV_FILE"

info()  { printf '\n\033[1;34m▸ %s\033[0m\n' "$*"; }
ok()    { printf '  \033[0;32m✓\033[0m %s\n' "$*"; }
erro()  { printf '  \033[0;31m✗\033[0m %s\n' "$*"; }
morrer(){ erro "$*"; exit 1; }

# ── Conferências antes de mexer em qualquer coisa ───────────────────
info "Conferindo o ambiente"

[ -f docker-compose.prod.yml ] || morrer "rode a partir da raiz do projeto"
[ -f "$ENV_FILE" ] || morrer "$ENV_FILE não existe. Copie de deploy/.env.production.exemplo"
command -v docker >/dev/null || morrer "Docker não instalado. Rode deploy/provisionar.sh antes"

set -a; . "./$ENV_FILE"; set +a

[ -n "${DOMINIO:-}" ] || morrer "DOMINIO não definido em $ENV_FILE"

faltando=""
for v in POSTGRES_PASSWORD JWT_ACCESS_SECRET JWT_REFRESH_SECRET PRIVACY_HASH_SALT; do
  valor="${!v:-}"
  [ -n "$valor" ] || faltando="$faltando $v(vazio)"
  [ "$valor" != "TROQUE_ISTO" ] || faltando="$faltando $v(exemplo)"
  [ "${#valor}" -ge 16 ] || [ -z "$valor" ] || faltando="$faltando $v(curto)"
done
[ -z "$faltando" ] || morrer "segredos por preencher:$faltando"
ok "segredos preenchidos"

# A senha do banco é montada dentro do endereço de conexão. Com / + @ ou : no
# meio, o endereço fica inválido e a API morre citando "porta inválida" — erro
# que não aponta para a causa e custa meia hora para achar no servidor.
case "$POSTGRES_PASSWORD" in
  *[!A-Za-z0-9_.-]*)
    morrer "POSTGRES_PASSWORD tem caractere que quebra o endereço do banco. Gere com: openssl rand -hex 24"
    ;;
esac
ok "senha do banco é segura para o endereço de conexão"

# O certificado é emitido na subida. Se o nome não aponta para cá, o Let's
# Encrypt recusa — e recusa repetida entra em limite semanal.
info "Conferindo o DNS de $DOMINIO"
ip_servidor="$(curl -s -4 --max-time 10 ifconfig.me || true)"
ip_dominio="$(getent ahostsv4 "$DOMINIO" 2>/dev/null | awk 'NR==1{print $1}' || true)"

if [ -z "$ip_dominio" ]; then
  morrer "$DOMINIO não resolve. Crie o registro A apontando para $ip_servidor e espere propagar."
elif [ "$ip_dominio" != "$ip_servidor" ]; then
  erro "$DOMINIO aponta para $ip_dominio, mas este servidor é $ip_servidor"
  echo "     Se estiver usando Cloudflare com proxy ligado (nuvem laranja), isto é esperado."
  read -r -p "     Continuar mesmo assim? [s/N] " r
  [ "$r" = "s" ] || exit 1
else
  ok "$DOMINIO → $ip_servidor"
fi

# ── Subida ──────────────────────────────────────────────────────────
# Carimba a versão no service worker ANTES de compilar. O nome do cache sai
# daqui, e é ele que faz a publicação nova apagar a anterior nos telemóveis
# que já têm a aplicação instalada.
info "Carimbando a versão no service worker"
VERSAO="$(date +%Y%m%d%H%M%S)"
sed -i "s/self.__VERSAO__ || '[^']*'/self.__VERSAO__ || '${VERSAO}'/" apps/web/public/sw.js
ok "versão ${VERSAO}"

# O CARIMBO DESFAZ-SE SEMPRE, aconteça o que acontecer daqui para a frente.
#
# O sed acima escreve num ficheiro que está sob controlo de versões, e um
# ficheiro modificado faz o `git pull` seguinte RECUSAR-SE a trazer alterações
# que lhe toquem. Foi o que aconteceu em 23/08: publiquei uma correcção do
# service worker, o carimbo mudou, e o conteúdo era o antigo — o servidor tinha
# ficado preso três commits atrás sem dizer nada a ninguém. Uma publicação que
# falha em silêncio é pior do que uma que falha aos gritos.
restaurar_carimbo() {
  git checkout -- apps/web/public/sw.js 2>/dev/null || true
}
trap restaurar_carimbo EXIT

info "Construindo as imagens"
echo "  (a primeira vez demora — compila a API e o site)"
$COMPOSE build

info "Subindo os serviços"
# As migrations rodam no entrypoint da API, antes de a aplicação atender.
$COMPOSE up -d

info "Esperando ficar de pé"
pronto=0
for i in $(seq 1 60); do
  if curl -fsS --max-time 5 "https://$DOMINIO/health" >/dev/null 2>&1; then pronto=1; break; fi
  sleep 5
  printf '.'
done
printf '\n'

if [ "$pronto" -ne 1 ]; then
  erro "a plataforma não respondeu em https://$DOMINIO/health"
  echo
  echo "  Para ver o motivo:"
  echo "    $COMPOSE logs --tail 60 api"
  echo "    $COMPOSE logs --tail 30 caddy"
  echo
  echo "  Causa mais comum na primeira subida: o certificado ainda está sendo"
  echo "  emitido, ou o DNS não terminou de propagar. Espere um minuto e rode"
  echo "  a conferência: bash deploy/verificar.sh"
  exit 1
fi
ok "API respondendo em https://$DOMINIO/health"

info "Estado dos serviços"
$COMPOSE ps

info "Conferência final"
bash deploy/verificar.sh || true

cat <<FIM

  Publicado em https://$DOMINIO

  Se este for o PRIMEIRO deploy, faltam dois passos que não são automáticos
  de propósito:

    1. Criar o conteúdo inicial (projeto e as 26 letras):
         $COMPOSE exec api npx tsx packages/db/prisma/seed.ts

    2. Criar o administrador do cliente:
         $COMPOSE exec api npx tsx packages/db/prisma/criar-admin.ts email@dele.com

  E ANTES de divulgar para o público, zere a operação para o Dia Zero começar
  limpo (preserva QR Codes, conteúdo e administradores):

       $COMPOSE exec api npx tsx packages/db/prisma/preparar-lancamento.ts
       $COMPOSE exec api npx tsx packages/db/prisma/preparar-lancamento.ts --executar

FIM
