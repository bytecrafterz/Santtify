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

## Cartões personalizados e carrossel de projetos

Acrescentado em 09/09. `apps/api/src/cartoes/`, `packages/cartoes/`,
`EditorDeCartoes.tsx` e `CarrosselDeProjetos.tsx`.

### A regra que sustenta tudo: uma conta só

`packages/cartoes/index.js` é JavaScript simples, sem dependências, importado
**tal e qual** pelo navegador e pelo servidor. Lá dentro vivem `enquadrar`,
`avaliarFoto` e `corpoDoNome`.

O cliente pediu por escrito, duas vezes, que o PDF não fosse uma fotografia do
ecrã. A prévia é leve para o telemóvel e o PDF sai a 300 dpi — se as duas contas
estivessem escritas em sítios diferentes, divergiriam, **e a divergência não
aparece no ecrã de ninguém: aparece na gráfica, depois de a mãe ter pago**.

O que fica guardado é PROPORÇÃO, nunca pixéis: `escala`, `deslocX`, `deslocY`.
Ela ajusta num ecrã de 360px e a folha sai com 2480px; "moveu 40 pixéis" não
sobrevive a essa mudança de régua, "moveu 11% da moldura" sobrevive a qualquer.

`corpoDoNome` leva um **medidor** — `widthOfTextAtSize` do pdf-lib no servidor,
`measureText` do canvas no navegador. Enquanto estimava, "ANA BEATRIZ" partia-se
em duas linhas no ecrã e saía numa só no papel.

### Os modelos são DADOS

Um modelo de cartão é uma linha em `modelos_de_cartao`, com a arte e as medidas
da moldura e do nome **em milímetros** sobre A4. Milímetros e não pixéis: a folha
mede-se em mm na gráfica e a arte pode ser reexportada com outra resolução.

Um oitavo modelo entra pelo painel. Não precisa de código nenhum.

### A validação corre duas vezes, e cada uma tem o seu papel

| Quando | O quê |
|---|---|
| No envio | Peneira grossa, sem zoom: recusa já o que nunca serviria |
| A cada ajuste | Peneira fina, sobre o recorte real — o que o cliente pediu em 08/09 |

```
dpi = min(px_larg × 25,4 / mm_larg, px_alt × 25,4 / mm_alt) ÷ escala
```

**Três faixas, não duas.** ≥300 verde, 200–299 amarelo, <200 vermelho. O amarelo
não estava no pedido dele: a foto que vem do WhatsApp cai muitas vezes ali, e as
duas respostas possíveis eram más — recusar faz a mãe desistir com uma foto que
ainda dava; aceitar calado faz a gráfica devolver um cartão borrado.

### A arte fica VECTORIAL. Só a fotografia é feita de pixéis

As artes do designer chegam em PDF vectorial, e o cliente pediu por escrito
"mantenha 100% da qualidade". A primeira versão deste código compunha a folha
inteira numa imagem com o sharp e embutia essa imagem — funcionava, e destruía
a arte no processo. Uma arte vectorial rasterizada a 300 dpi não volta atrás, e
nota-se nos contornos das letras grandes e dos ícones.

Além disso **o sharp nem sequer lê PDF**. A versão antiga não perdia qualidade:
rebentava.

Agora o PDF final tem três camadas, cada uma na sua natureza:

| Camada | Como entra |
|---|---|
| Arte do modelo | `embedPdf` — vector, intacta |
| Fotografia | PNG a 300 dpi, já recortado à moldura, com o alfa a fazer o oval |
| Nome | texto vectorial, Helvetica-Bold |

Confirmado num ficheiro real: o `pdftotext` continua a extrair o texto da ARTE
("DIA 1", "IDENTIDADE EM DEUS") do PDF gerado, e o `pdfimages` mostra uma única
imagem na página — a fotografia, 874x1087 a 300 dpi. O ficheiro ficou 42% mais
pequeno do que na versão que rasterizava tudo.

**Duas cópias da arte, e desta vez ao contrário do costume.** Nas letras, a
original é a de ecrã e a de papel é a derivada. Aqui a original é o PDF e a de
ecrã é rasterizada a partir dele — porque o `<img>` do editor não desenha um
PDF. `arteImpressaoUrl` é o PDF; `arteUrl` é o JPEG. Trocá-los imprime a prévia.

A rasterização usa o `pdftoppm` do **poppler-utils**, que teve de ser
acrescentado à imagem da API. É a única coisa no sistema que sabe converter um
PDF em imagem.

**`packages/cartoes` faltava nos dois Dockerfiles.** A API e o site importam-no,
e sem ele o build nem compila. Foi apanhado antes da primeira publicação, mas é
exactamente o género de falha que o README já avisa: não dá erro localmente,
onde o workspace está ligado, e mata o deploy.

### O nome vai em VECTOR, e a arte em pixéis

`sharp` compõe a arte com a foto; `pdf-lib` escreve o nome por cima como texto.
Esta máquina **não tem fontconfig nem tipos de letra**: desenhar texto com o
sharp passaria pelo SVG e sairia vazio, sem erro nenhum. Helvetica-Bold é
obrigatória em qualquer leitor de PDF e a codificação WinAnsi cobre `ã ç é õ` —
um cartão com "JOAO" em vez de "JOÃO" é um cartão estragado.

### Entrega: baixar, imprimir, WhatsApp, e-mail

Ponto 8. Os dois primeiros saem do ficheiro; os dois últimos saem de uma
LIGAÇÃO, e não do ficheiro — **nem o WhatsApp nem o e-mail aceitam um anexo
vindo de uma página web**. Quem tentar mandar o PDF por `wa.me` perde uma tarde:
abre com o texto e sem ficheiro.

A ligação (`ligacao-de-partilha.ts`) é assinada e traz o prazo lá dentro:

- **assinada**, logo ninguém a fabrica sem a chave;
- **com prazo igual ao do expurgo**, logo nunca sobrevive ao ficheiro nem morre
  antes dele. Uma ligação viva a apontar para um ficheiro apagado é uma promessa
  partida ao sétimo dia;
- **chave derivada** do `JWT_ACCESS_SECRET` com um domínio próprio: não há
  variável nova para o deploy esquecer, e uma ficha de partilha nunca pode ser
  usada como sessão;
- a comparação é de **tempo constante** — um `===` desiste no primeiro byte
  diferente e essa diferença mede-se.

`GET /api/cartoes/partilha/:ficha` não tem guarda nenhuma **de propósito**: é
para abrir na gráfica, no telemóvel do marido, no computador da escola. Quem
manda é a assinatura.

**O e-mail leva o link, nunca o anexo.** Um PDF de impressão passa do que muitos
servidores aceitam, e um anexo é mais uma cópia da fotografia de uma criança —
numa caixa de correio, fora do nosso expurgo, para sempre. Sem `BREVO_API_KEY`,
a rota devolve a ligação ao ecrã em vez de fingir que enviou.

O botão de imprimir abre o PDF numa aba. Um `window.print()` do lado do
navegador imprimiria a PÁGINA — botões e tudo — e não os cartões.

### Privacidade: `CARTOES_DIR` NÃO é servida estaticamente

`UPLOAD_DIR` é servida em `/uploads` — quem souber o endereço abre o ficheiro
sem sessão. Serve para a música e para a arte, que são públicas. **A fotografia
de uma criança não pode viver nessa pasta nem por engano**: sai por rota que
confere o pedido, com `Cache-Control: no-store`.

`expiraEm` nunca é nulo e o `ExpurgoDeCartoesService` varre de hora a hora. Um
prazo de sete dias varrido uma vez por dia é, na prática, um prazo entre sete e
oito. O registo da venda fica; a foto e o PDF saem.

Utilizadores em Portugal: **RGPD**, não só LGPD.

### Pagamento: falta a conta, não falta o código

O percurso está inteiro — cobrança, espera sem prender a mãe ao ecrã, e
destrancar só na confirmação real. O que falta é o adaptador do provedor, e esse
**não se escreve sem um CNPJ brasileiro** para liquidar o Pix.

Até lá atende o `ProvedorManual`: a cobrança nasce e a confirmação entra pela
MESMA porta, carregada à mão no painel. Ligar um provedor a sério é escrever uma
classe com dois métodos e trocar o `useClass` em `cartoes.module.ts`.

`idExterno` é único na base — é isso que torna o webhook idempotente. Os
provedores reenviam quando não recebem resposta a tempo.

### Coisas que já morderam aqui

- **`PRONTO` também é pago.** Aceitar só `PAGO` partia o "VOLTAR PARA CORRIGIR"
  do ponto 7: ela aprovava, corrigia, e a nova geração era recusada com "só
  depois do pagamento" — a quem tinha pago minutos antes.
- **O aviso da arte mede o ORIGINAL.** `ArquivoSalvo.largura` é a cópia de ecrã,
  limitada a 1200px: uma arte perfeita de 2480px voltava de lá como 1200 e o
  aviso disparava sempre. Um aviso que grita em todas cala-se na que interessa.
- **O `ScheduleModule` nunca tinha sido ligado.** Estava nas dependências e não
  no `app.module`. Um `@Cron` sem ele não dá erro: simplesmente nunca acontece.
- **`localStorage` guarda o pedido.** O Pix confirma-se por fora e ela VAI sair
  da página. Sem isto, fechar o separador depois de pagar apagava o caminho de
  volta aos ficheiros.
- **Acentos no nome do ficheiro.** `NFD` separa a letra do acento; sem apagar os
  acentos soltos, "João" saía como "joa-o".

### O que falta, e não é código

As medidas da moldura em milímetros, do designer. Os valores em
`modelos-de-cartao.ts` foram tirados a olho das artes e servem para o editor
abrir a funcionar — não são a régua. **E a arte tem de ter 2480px de largura**,
senão sai a ~124 dpi em A4.

### Carrossel

`GET /api/carrossel/projetos`. Ordem: destaque ESQUERDA, destaque DIREITA, e o
resto por `ordemNoCarrossel`. `Project.destaque` tem `@unique` num campo
opcional — o Postgres deixa passar tantos nulos quantos quiser e só um de cada
lado, por isso não há código nenhum a vigiar isso.

Os totais vêm de `ContagensService.deProjectos`, que conta na leitura. **Não se
guardam contadores aqui** — ver a nota no topo dessa classe sobre os menos três
comentários.

`abreviarKM` dá "1,5K" e "20K", que foi o que ele escreveu no ponto 1. É
diferente de `abreviar` em `lib/numeros`, que dá "1,5 mil" — as duas estão certas
e servem ecrãs diferentes, ambas escritas por ele. `Intl.NumberFormat` em
português nunca dá "K".

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
