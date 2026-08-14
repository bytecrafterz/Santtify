# Publicar no servidor

Passo a passo para pôr a plataforma no ar num VPS, e para operá-la depois.

Serve para qualquer servidor com Ubuntu 24.04 e acesso root — Hostinger KVM,
Hetzner CX, DigitalOcean. **Não serve para hospedagem compartilhada**: aquilo é
feito para PHP e WordPress, e aqui rodam dois processos Node contínuos e um
PostgreSQL.

**Mínimo:** 1 vCPU e 4 GB de RAM. Com menos, o build do site morre por falta de
memória, e a mensagem não diz que foi isso.

---

## Antes de começar

Três coisas precisam existir, nesta ordem:

1. **O domínio registrado**, na conta do cliente.
2. **O registro DNS do tipo A** apontando o domínio para o IP do servidor.
   O certificado HTTPS é emitido na hora da subida e falha se o nome não
   resolver para lá — e tentativa falha repetida entra em limite semanal do
   Let's Encrypt.
3. **O servidor criado**, com a chave SSH configurada.

---

## Primeira publicação

### 1. Preparar o servidor

```bash
ssh root@IP-DO-SERVIDOR
curl -fsSL https://raw.githubusercontent.com/<repo>/main/deploy/provisionar.sh -o provisionar.sh
bash provisionar.sh
```

Instala Docker, cria swap, fecha o firewall (só SSH, 80 e 443), liga as
atualizações de segurança automáticas e cria o usuário `produtovivo`, que é
quem opera daqui em diante. Rodar de novo não quebra nada.

### 2. Trazer o projeto e configurar

```bash
ssh produtovivo@IP-DO-SERVIDOR
git clone <repositorio> produto-vivo && cd produto-vivo
cp deploy/.env.production.exemplo .env.production
```

Gere os segredos e cole no arquivo:

```bash
for v in POSTGRES_PASSWORD JWT_ACCESS_SECRET JWT_REFRESH_SECRET PRIVACY_HASH_SALT; do
  echo "$v=$(openssl rand -base64 32)"
done
```

```bash
nano .env.production   # preencher DOMINIO e colar os segredos
```

### 3. Publicar

```bash
bash deploy/publicar.sh
```

O script confere os segredos e o DNS **antes** de subir qualquer coisa,
constrói as imagens, aplica as migrations e espera o site responder. Ao final
roda a conferência sozinho.

### 4. Criar conteúdo e administrador

Estes dois passos não são automáticos de propósito — rodar seed sozinho em
produção é como se apaga um banco por acidente.

```bash
C="docker compose -f docker-compose.prod.yml --env-file .env.production"

$C exec api npx tsx packages/db/prisma/seed.ts
$C exec api npx tsx packages/db/prisma/criar-admin.ts email-do-cliente@exemplo.com
```

### 5. Antes de divulgar: zerar o Dia Zero

Todo acesso feito durante os testes — seu, do cliente, de quem abriu o link —
criou visitante e evento. O log é append-only: depois não há como separar o que
era teste do que era real.

```bash
$C exec api npx tsx packages/db/prisma/preparar-lancamento.ts             # mostra
$C exec api npx tsx packages/db/prisma/preparar-lancamento.ts --executar  # apaga
```

Preserva **QR Codes, conteúdo e administradores**. Apaga eventos, visitantes,
contas comuns e métricas.

---

## Atualizar depois

```bash
cd produto-vivo && git pull && bash deploy/publicar.sh
```

Banco e mídia ficam em volumes e não são tocados. As migrations novas são
aplicadas na subida da API.

---

## Operação do dia a dia

Todos os comandos assumem `C` definido como acima.

| O que | Comando |
|---|---|
| Ver se está tudo de pé | `bash deploy/verificar.sh` |
| Logs da API | `$C logs -f --tail 100 api` |
| Logs do proxy/HTTPS | `$C logs -f --tail 50 caddy` |
| Reiniciar só a API | `$C restart api` |
| Listar cópias de segurança | `bash deploy/restaurar.sh` |
| Restaurar uma cópia | `bash deploy/restaurar.sh pv_AAAA-MM-DD_HHMM.sql.gz` |
| Espaço em disco | `df -h && docker system df` |

### Conferir o backup de vez em quando

Backup que nunca foi restaurado não é backup, é esperança. Vale restaurar uma
cópia num servidor de teste pelo menos uma vez antes do lançamento, para saber
que o caminho de volta funciona.

---

## Quando alguma coisa dá errado

**O site não abre e o certificado não sai.**
Quase sempre é DNS. Confira para onde o nome aponta:
`getent ahostsv4 SEU-DOMINIO` e compare com `curl -s ifconfig.me` no servidor.
Se estiver usando Cloudflare com a nuvem laranja ligada, o IP será o deles —
nesse caso, ponha o SSL do Cloudflare em **Full (strict)**, senão dá laço de
redirecionamento.

**A API sobe e cai.**
`$C logs api`. Se aparecer erro de migration, o banco está à frente do código:
o entrypoint recusa subir de propósito, porque atender com um schema que a
aplicação não entende corrompe dado em silêncio.

**O build morre com `killed`.**
Faltou memória. Confirme o swap com `swapon --show`; o `provisionar.sh` cria 2 GB.

**Trocou o domínio depois de gerar QR Codes.**
Os códigos impressos apontam para o endereço antigo. Regere:
`$C exec api npx tsx packages/db/prisma/regerar-links.ts` — e reimprima tudo.
É por isso que o domínio se decide antes de imprimir qualquer coisa.

---

## O que nunca fazer

- **Não trocar `PRIVACY_HASH_SALT` depois do lançamento.** Os hashes antigos
  deixam de corresponder aos novos e a mesma pessoa passa a contar como duas.
  Reescreve o significado do histórico sem apagar uma linha.
- **Não expor a porta do Postgres.** Ele só é alcançável pela rede interna do
  compose, e é assim que deve ficar.
- **Não apagar o volume `uploads`.** São as músicas e as artes do cliente.
- **Não rodar `docker compose down -v`.** O `-v` apaga os volumes: banco,
  mídia e certificados de uma vez.
