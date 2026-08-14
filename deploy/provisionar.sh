#!/usr/bin/env bash
# Prepara um servidor Ubuntu recém-criado para receber a plataforma.
#
# Roda UMA vez, como root, num VPS novo (Hostinger KVM, Hetzner CX ou
# equivalente) com Ubuntu 24.04. Depois disto, o servidor tem Docker, firewall,
# swap e um usuário sem privilégio de root para operar o dia a dia.
#
#   ssh root@IP
#   bash provisionar.sh
#
# É seguro rodar de novo: cada passo confere antes de agir.

set -euo pipefail

USUARIO="${USUARIO:-produtovivo}"
SWAP_GB="${SWAP_GB:-2}"

info() { printf '\n\033[1;34m▸ %s\033[0m\n' "$*"; }
ok()   { printf '  \033[0;32m✓\033[0m %s\n' "$*"; }
aviso(){ printf '  \033[0;33m!\033[0m %s\n' "$*"; }

[ "$(id -u)" -eq 0 ] || { echo "Rode como root."; exit 1; }

info "Sistema"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get upgrade -y -qq
apt-get install -y -qq ca-certificates curl git ufw unattended-upgrades >/dev/null
ok "pacotes atualizados"

# Correções de segurança aplicadas sozinhas. Servidor de projeto pequeno é
# justamente o que fica meses sem ninguém olhar.
dpkg-reconfigure -f noninteractive unattended-upgrades >/dev/null 2>&1 || true
ok "atualizações de segurança automáticas ativadas"

info "Swap de ${SWAP_GB} GB"
if swapon --show | grep -q '/swapfile'; then
  ok "já existe"
else
  # O build do Next.js consome bem mais memória do que a aplicação em regime.
  # Num servidor de 4 GB sem swap, o build morre com "killed" e a mensagem não
  # diz que faltou memória.
  fallocate -l "${SWAP_GB}G" /swapfile
  chmod 600 /swapfile
  mkswap /swapfile >/dev/null
  swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  ok "criado e ativo"
fi

info "Firewall"
ufw allow OpenSSH >/dev/null
ufw allow 80/tcp >/dev/null
ufw allow 443/tcp >/dev/null
ufw --force enable >/dev/null
ok "apenas SSH, 80 e 443 abertos"
aviso "o Postgres NÃO é exposto: só a rede interna do compose o alcança"

info "Docker"
if command -v docker >/dev/null 2>&1; then
  ok "já instalado ($(docker --version))"
else
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] \
https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin >/dev/null
  systemctl enable --now docker >/dev/null
  ok "instalado ($(docker --version))"
fi

info "Usuário de operação: ${USUARIO}"
if id "$USUARIO" >/dev/null 2>&1; then
  ok "já existe"
else
  adduser --disabled-password --gecos '' "$USUARIO" >/dev/null
  ok "criado sem senha (entra por chave SSH)"
fi
usermod -aG docker "$USUARIO"
ok "pode usar o Docker sem sudo"

# Leva a chave SSH do root para o novo usuário: sem isto, ninguém consegue
# entrar como ele e o passo seguinte trava.
if [ -f /root/.ssh/authorized_keys ]; then
  install -d -m 700 -o "$USUARIO" -g "$USUARIO" "/home/$USUARIO/.ssh"
  install -m 600 -o "$USUARIO" -g "$USUARIO" /root/.ssh/authorized_keys "/home/$USUARIO/.ssh/authorized_keys"
  ok "chave SSH copiada"
else
  aviso "root não tem authorized_keys — garanta o acesso de ${USUARIO} antes de fechar esta sessão"
fi

info "Pronto"
cat <<FIM

  Servidor preparado. Próximos passos, agora como ${USUARIO}:

    ssh ${USUARIO}@$(curl -s -4 ifconfig.me 2>/dev/null || echo 'IP-DO-SERVIDOR')
    git clone <repositorio> produto-vivo && cd produto-vivo
    cp deploy/.env.production.exemplo .env.production
    nano .env.production          # preencher DOMINIO e gerar os segredos
    bash deploy/publicar.sh

  Antes de publicar, o DNS do domínio já precisa apontar para este servidor:
  o certificado HTTPS é emitido na hora da subida e falha se o nome não
  resolver para cá.

FIM
