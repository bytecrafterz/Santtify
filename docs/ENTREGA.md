# Entrega técnica

Para quem vai mexer no código sem ter estado aqui desde o início. Diz o que
existe, onde está, e o que não se deve partir.

## O que é

Plataforma social-comercial em monorepo. O projeto nº 1 é o **Jesus Alfabeto
Saudável**: 26 letras, cada uma com quatro cartões (explicação, música,
repetição do versículo, oração), mais publicações que o responsável cria.

**Um cartão é uma peça inteira**: imagem, áudio, título e descrição na mesma
linha, com as suas próprias curtidas e comentários. Vai ao ar inteiro ou fica em
rascunho. Regra do cliente, 23/08, e é o que impede meia publicação de aparecer.

## Stack

| Camada | Tecnologia |
|---|---|
| Monorepo | npm workspaces, Node 20 |
| API | NestJS 11 |
| Site | Next.js 15, App Router, PWA com service worker |
| Base de dados | PostgreSQL 16 via Prisma 6 |
| Imagens | sharp |
| PDF | pdf-lib |
| Infra | Docker Compose atrás de Caddy, um só domínio |

`apps/api` · `apps/web` · `packages/db`

## Rodar

```bash
cp .env.example .env
npm install
docker compose up -d      # Postgres na 5433
npm run db:migrate
npm run db:seed
npm run dev:api           # :3333
npm run dev:web           # :3000
```

## Publicar

```bash
bash deploy/publicar.sh   # no servidor, na raiz, com .env.production preenchido
```

Confere o ambiente **antes** de subir qualquer container: um DNS errado queima
tentativas no Let's Encrypt para a semana, e um segredo de exemplo põe a
plataforma aberta. As migrações correm sozinhas ao arrancar a API, com
`prisma migrate deploy` e nunca `migrate dev`.

## O modelo de dados, e a única coisa que é preciso perceber

```
Project → Content → ContentBlock → MediaAsset
```

**Nada aqui sabe o que é uma "letra".** Está escrito na primeira linha do
`schema.prisma`: uma letra é um `Content` de um `Project`, e `letra` é só uma
etiqueta de um caractere. O alfabeto é uma convenção do ecrã.

O `ContentBlock` é a unidade de tudo. Tem `papel` (`CARTAO` ou `IMPRESSAO`),
`estado` (`PUBLICADO` ou `RASCUNHO`) e `slot` — 1 a 4 nas quatro casas de
origem, `null` em tudo o que o responsável cria. Esse `null` já causou um
defeito: o índice do painel só contava as casas e dizia "1 de 4" a uma letra com
publicações no ar.

## Cartões e PDF: o que JÁ existe

O mais importante para quem chega a trabalhar em cartões.

| O que | Onde |
|---|---|
| PDF A4 real (595.28 × 841.89 pt) | `apps/api/src/admin/storage.service.ts` |
| Rota do PDF | `GET /projects/:p/contents/:c/cartao.pdf` |
| Imagem para impressão | `GET .../cartao.jpg`, até 2480 px |
| QR Code por conteúdo, automático | `apps/api/src/short-links/short-links.service.ts` |
| Rotas do QR | `GET .../qr.svg` e `.../qr.png` |
| Editor do cartão | `apps/web/src/components/EditorDoCartaoDeImpressao.tsx` |
| Página do cartão | `apps/web/src/app/[projectSlug]/[contentSlug]/cartao/` |

O PDF sai em A4 correto. A resolução depende da arte de origem: uma arte de
1000 px dá cerca de 124 DPI no A4. Para 300 DPI é preciso arte com **2480 px de
largura**.

## Regras que não se partem

**`events` é append-only**, por gatilho na base. `UPDATE` e `DELETE` levantam
excepção. Só passa com `SET LOCAL pv.allow_event_purge = 'on'`, que existe para
a retenção do RGPD e para mais nada. Todos os números do painel são contados
desse registo na leitura. Contadores guardados já foram tentados e chegaram a
mostrar **menos três** comentários.

**Cada regra vive num sítio só.** Ver `apps/api/src/content/cartao-inteiro.ts`,
`ordem-do-produto-vivo.ts`, `identity/nome-de-utilizador.ts` e
`identity/nome-de-perfil.ts`. O comentário no topo de cada um conta o que
aconteceu quando não era assim.

**Privacidade.** O IP é truncado para /24 e depois passado por HMAC. Não se
guarda IP cru, user-agent, ASN nem detecção de VPN. Cliente e utilizadores em
Portugal: **RGPD**, não só LGPD. `PRIVACY_HASH_SALT` nunca é versionado.

**`NEXT_PUBLIC_*` entram no build.** Têm de estar no `Dockerfile` (ARG e ENV) **e**
em `build.args` do compose. Uma que falte não dá erro: fica string vazia e o
site sobe com a funcionalidade morta. `publicar.sh` verifica isso.

**Contar uma visita numa página nova exige o `contentId`.** O contador de uma
publicação conta `CONTENT_VIEW` com o id do conteúdo. A página do Produto Vivo
emitiu `PAGE_VIEW` sem id durante 1835 visitas e o número ficou em zero desde
sempre.

## Verificações de interface

`deploy/percursos/` abre o site publicado num navegador de verdade e mede o DOM.

Existem porque os testes normais passavam em **todos** os defeitos que o cliente
encontrou. Um defeito de interface só existe no ecrã. Ver
`deploy/percursos/README.md`.

> Alguns criam contas de teste e escrevem no conteúdo real. Uma conta esquecida
> na base já fez o cliente pensar que o cadastro estava aberto. Se a limpeza
> falha, o percurso falha: é de propósito.

A conta de administração vem de `PV_ADMIN_EMAIL` e `PV_ADMIN_SENHA`, nunca de
dentro dos ficheiros.
