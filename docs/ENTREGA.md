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

### Os QR Codes das artes têm códigos FIXOS

`packages/db/prisma/qr-dos-cartoes.ts`. Sete códigos escritos à mão no ficheiro,
e é deliberado.

O endereço fica gravado dentro do QR e não se muda depois de impresso. O
designer precisava dos QR antes de a plataforma estar publicada, e gerá-los com
o endereço de desenvolvimento poria `localhost` em milhares de cartões. Fixar os
códigos resolve as duas coisas: o designer recebe QR com o domínio de produção,
e o script cria exactamente esses códigos em qualquer base onde correr.

**O script RECUSA correr com `localhost` em `PUBLIC_SHORTLINK_BASE`.** É a única
protecção possível contra um erro que só se descobre com a gráfica já paga.

Não se reescreve nenhum dos sete depois de as artes irem para a gráfica.
Acrescentar um oitavo dia é acrescentar uma linha.

SVG e não PNG, correcção de erro `H` e margem de 4 módulos: vai para papel, que
uma criança dobra e leva na mochila.

### Um modelo por idioma

`ModeloDeCartao.idioma`, em BCP 47. O Dia 1 em português e o Dia 1 em inglês são
duas linhas com o mesmo `dia` e idiomas diferentes, cada uma com a sua arte e a
sua geometria.

A geometria repetida por idioma parece desperdício e não é: "GUILHERME" e "JOHN"
não ocupam o mesmo espaço, e a caixa do nome numa arte alemã quase de certeza
terá de ser mais larga. Partilhá-la obrigaria a escolher a pior medida de todas.

O slug leva o idioma quando não é `pt-BR`, senão o segundo modelo do mesmo dia
chocava contra `@@unique([projectId, slug])`.

### Categorias: Crianças, Adultos, e as que vierem

Pedido do cliente em 11/09: sete cartões novos para adultos, com o mesmo
funcionamento, e poder ele próprio criar categorias e cartões sem código.

Uma categoria é uma linha de `categorias_de_cartoes`, e os modelos pertencem-lhe.
Painel → Cartões personalizados → Categorias.

**Os rótulos são o que faz uma categoria funcionar.** `rotuloSingular` e
`rotuloPlural` ("criança"/"crianças", "pessoa"/"pessoas") são o que o editor usa
para falar. Estão na base e não num `if (adulto)` no ecrã, porque um `if`
resolvia este caso e falhava no próximo.

**As frases do editor evitam o género, de propósito.** "Quantas crianças?"
funciona para nomes femininos e parte-se no primeiro masculino — "Quantas
casais?". Por isso o editor pergunta "Quantas fotos você vai enviar?" e diz "a
foto de cada {rótulo}" e "{Rótulo} 1". Qualquer categoria nova lê-se bem.

**Uma categoria sem cartões activos não aparece no site.** Os Adultos já existem,
vazios, e ficam escondidos até o primeiro cartão entrar. Com uma só categoria
visível, o ecrã de escolha nem aparece.

**O slug de uma categoria não muda.** Vai no endereço do editor, e um endereço
partilhado tem de continuar a abrir.

**Apagar só quando está vazia.** Em cascata levaria cartões e artes num clique;
desactivar esconde sem perder nada, e a mensagem di-lo.

**Preço por categoria, campo a campo.** Vazio vale o do projeto. Pode ter outro
preço e o mesmo desconto sem repetir o desconto.

**A migração foi escrita à mão.** O `migrate diff` acrescentava
`categoriaId NOT NULL` a uma tabela já com modelos — falha na hora, e falharia em
produção. A ordem certa é criar a categoria, acrescentar a coluna vazia,
preenchê-la, e só depois torná-la obrigatória. Confirmado contra o schema com
`migrate diff` (vazio) antes de aplicar.

**O pedido guarda categoria, idioma e o limiar do desconto.** Os dois últimos
eram defeitos que ainda não se tinham visto: o limiar estava escrito "2" na
conta e o valor do painel era ignorado; e a geração do PDF não filtrava o
idioma, por isso no dia das artes em inglês um pedido em português sairia com as
duas línguas. A categoria faz o mesmo papel: sem ela, o PDF de uma criança
levaria também os cartões dos adultos.

**O ValidationPipe corre com `whitelist: true`, que APAGA em silêncio** todo o
campo que o DTO não declara. O `idioma` do modelo ficou fora do `ModeloDto` num
commit anterior: o painel mandava-o sem erro, e ele nunca chegava ao serviço. Ao
acrescentar um campo a um formulário do painel, declará-lo no DTO não é opcional.

**QR dos adultos.** Sete códigos novos em `qr-dos-cartoes.ts`. Os das crianças
ficaram byte a byte iguais aos enviados ao designer em 10/09 — conferido com
`cmp` — e o script recusa reaproveitar um código que já pertença a outro
conteúdo, porque em produção há 26 letras com QR impressos.

**O seed já não mexe nos destaques escolhidos.** Só preenche um destaque se
estiver vazio; antes, correr o seed outra vez desfazia a escolha do cliente no
painel, ou rebentava contra o `@unique` do campo.

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

## Projetos na página inicial, blocos e interações

Refeito em 19/09, depois de ele ver a primeira versão no ar.

### A lista de projetos

Uma imagem horizontal por linha, os quatro números por baixo, o projeto
seguinte. Sem título nem descrição: o público são crianças, muitas sem saber
ler. A imagem aparece INTEIRA, na proporção dela (as dele são 3:1 e 16:9, com
texto até à borda), e as medidas vêm do servidor para a altura ficar reservada
antes de a imagem chegar (`carrossel.service` → `capaLargura`/`capaAltura`).

No painel, `PainelDoCarrossel`: enviar a imagem, mostrar/esconder (é o
`ProjectStatus`; escondido sai da lista e o endereço continua a abrir), ordenar
com setas, e a quantidade de blocos.

### Blocos: A–Z ou 1..N

| | |
| --- | --- |
| `Project.sequencia` | `LETRAS` (só o Jesus Alfabeto) ou `NUMEROS` |
| `Project.blocos` | quantas casas tem a grade; 26 nos alfabetos |
| `Content.ordinal` | a casa do conteúdo, como a `letra` no alfabeto |

A grade (`ExperienciaContinua`), o progresso e o "próximo bloco" seguem a
sequência do projeto. O painel do alfabeto (`admin/alfabeto`) devolve `casa`
("A" ou "3") e `rotulo` ("Letra A" ou "Bloco 3") — o resto do painel é o mesmo.

`PATCH /api/admin/projects/:slug/blocos` muda a quantidade. **Crescer cria** as
casas em falta, cada uma com as mesmas quatro casas de cartão de uma letra **e
com o seu QR Code** — criar projeto e definir a quantidade são duas portas novas
por onde nasce conteúdo, e cada porta tem de repetir o que a antiga fazia (foi
por falhar isso que a Letra B ficou um dia sem QR).

**Encolher não apaga nada: esconde.** Os blocos a mais saem da grade, continuam
a abrir pelo endereço e pelo QR, e voltam inteiros se ele aumentar outra vez. A
primeira versão apagava as casas vazias e estava errada por duas razões: o QR de
um bloco pode já ter sido impresso antes de o conteúdo existir, e um número
escrito por engano no painel não pode ser uma ordem de apagar trabalho.

O backfill da migração decidiu pelos dados, não pelo nome: quem tinha letras
ficou `LETRAS`; nos outros, `dia-3` e `3` ganharam ordinal 3, e as páginas dos
adultos (`adultos-dia-3`) ficaram de fora porque são dos cartões impressos.

### As interações do card

Regra dele: **VIEW = contador**, **LIKE, COMENTÁRIO e COMPARTILHAR = clicáveis
e funcionais**, **card inteiro abre o projeto**.

- **Curtir o projeto** é `ProjectReaction` (tabela própria: uma curtida é sempre
  de alguma coisa, e tornar o conteúdo opcional na `Reaction` estragava o índice
  que impede curtir duas vezes — em Postgres, dois nulos não são iguais).
- **Comentar o projeto** é um `Comment` sem conteúdo, sem faixa e sem perfil. O
  modelo já o permitia; a contagem do carrossel já contava por projeto.
- **Partilhar** cria um link curto identificável para `/{slug}`, como nas
  publicações — é o que faz o número de partilhas dizer a verdade.
- Rotas em `projects/:projectSlug/social` (`ProjetoSocialController`): ler é
  público, escrever exige conta. Sem conta, o card abre o convite de cadastro.
- **O card inteiro é um link e os botões vivem por cima dele** (`.projeto-abrir::after`
  cobre o card; só os `button` sobem). Um botão dentro de um link é HTML
  inválido — e, pior, curtir navegava.

## Pagamentos: Mercado Pago

A conta é a do cliente, no CPF dele, até ele abrir empresa. Mudar para a conta
da empresa é trocar as chaves no servidor; o código não muda.

### Como funciona

- **Pix pela API de Orders** (`POST /v1/orders`). O código copia e cola vem na
  resposta; o QR desenha-se a partir dele e aparece no nosso ecrã, com um botão
  "Copiar código Pix" — no telemóvel é esse o caminho, não a câmara. A Orders é
  a que o cliente escolheu ao criar a aplicação e a que o Mercado Pago mantém.
- **Cartão pelo Checkout Pro** (`POST /checkout/preferences`). A pessoa paga na
  página do Mercado Pago e volta para `/[projeto]/cartoes?pedido=<id>`. Os
  dados do cartão nunca passam por nós.
- **O e-mail de quem paga** é pedido no ecrã (o Mercado Pago exige-o), segue para
  ele e não fica guardado no pedido.
- **Avisos** em `POST /api/pagamentos/mercadopago/aviso`. **Nunca se acredita no
  corpo**: a API pergunta ao Mercado Pago o estado da order ou do pagamento, com
  o nosso token, e só essa resposta marca o pedido como pago
  (`processed/accredited` numa order, `approved` num pagamento). A assinatura
  `x-signature` confere-se quando existe `MERCADOPAGO_WEBHOOK_SECRET`
  (`assinatura-mercadopago.ts`; template `id:<data.id em minúsculas>;request-id:<x-request-id>;ts:<ts>;`).
  Idempotente por `mp:<tipo>:<id>:<estado>`.
- O ecrã do pedido verifica o estado sozinho de 5 em 5 s enquanto espera o
  pagamento, até 20 minutos.
- **O provedor escolhe-se no ambiente** (`PAGAMENTOS_PROVEDOR=manual|mercadopago`).
  Voltar ao manual no dia, se algo correr mal, é mudar uma linha e reiniciar a
  API. A confirmação manual no painel continua a existir com os dois.

### Pôr no ar (produção)

1. No Mercado Pago, na aplicação "Santtify": **Credenciais de produção**, activar
   e copiar o **Access Token**.
2. No servidor, em `.env.production`:
   `PAGAMENTOS_PROVEDOR=mercadopago` e `MERCADOPAGO_ACCESS_TOKEN=...`
3. Reiniciar só a API, com o ambiente novo:
   `docker compose -f docker-compose.prod.yml --env-file .env.production up -d api`
4. No Mercado Pago: **Webhooks > Configurar notificações**, modo produtivo,
   endereço `https://santtify.com/api/pagamentos/mercadopago/aviso`, eventos
   **Order (Mercado Pago)** e **Pagamentos**. Salvar gera a chave secreta.
5. `MERCADOPAGO_WEBHOOK_SECRET=<a chave>` no `.env.production`, e o passo 3 outra vez.
6. Um Pix pequeno de verdade antes de anunciar.

### O que foi verificado, e o que não

Verificado contra a API de teste do Mercado Pago (credenciais de teste do
cliente): o Pix devolve um código EMV verdadeiro (`000201…`), o cartão devolve a
página de checkout, um aviso verdadeiro é consultado e registado sem marcar
pago, o repetido é ignorado, uma order inventada é ignorada (404 no Mercado
Pago), a assinatura certa passa e a errada dá 401.

**Não verificado: um pagamento concluído de ponta a ponta.** Um Pix de teste não
se paga, e o cartão de teste exige entrar com um comprador de teste na página do
Mercado Pago. Faz-se no passo 6, com dinheiro de verdade e valor pequeno. Também
por confirmar: se o Checkout Pro da conta brasileira aceita cartões emitidos
fora do Brasil (compradores de Portugal).

## Modo Karaokê

Pedido do cliente em 13/09, fechado em 14/09 com seis artes da Santtify como
referência visual. Condição dele: **a experiência de sempre continua igual**. O
karaokê é uma página a mais por faixa; o tocador não mudou uma linha.

### Onde está cada coisa

| O quê | Onde |
| --- | --- |
| Regras partilhadas (frases, tempos, destaques, composições) | `packages/karaoke` (`@pv/karaoke`) |
| Tabelas | `LetraSincronizada` (uma por cartão com áudio), `PalavraDeDestaque` (por projeto), `Project.karaokeAcesso` |
| API pública | `GET /api/projects/:slug/karaoke/:blocoId` |
| API do painel | `GET/PATCH /api/admin/projects/:slug/karaoke`, `PUT .../karaoke/palavras`, `DELETE /api/admin/karaoke/palavras/:id`, `GET/PUT /api/admin/cards/:id/karaoke` |
| Ecrã do karaokê | `/[projeto]/karaoke/[blocoId]` → `KaraokeDaFaixa` + `PalcoDoKaraoke` |
| Painel | `/[projeto]/admin/karaoke` (acesso, palavras, músicas) e `/[projeto]/admin/karaoke/[blocoId]` (sincronizar) |
| Entrada | botão roxo por baixo do tocador (`PublicacaoDaLetra`), só com letra publicada; atalho "🎤 Karaokê" no editor do cartão |

`packages/karaoke` é JavaScript simples pelo mesmo motivo que `packages/cartoes`:
o painel, o ecrã e a API têm de concordar sobre a mesma letra. Está nos dois
Dockerfiles e em `transpilePackages`.

### Como a letra é guardada

`LetraSincronizada.frases` é JSON: `[{ texto, inicioMs, fimMs, palavras: [{ texto,
inicioMs, fimMs, destaque?, marcada? }] }]`. Lê-se e grava-se sempre inteira,
por isso não é uma tabela por palavra.

- **Uma linha do texto é uma frase.** Ao gravar texto novo, as linhas iguais no
  mesmo lugar guardam os tempos (`frasesDoTexto`): corrigir uma gralha não obriga
  a sincronizar outra vez.
- **Marcas → tempos** em `aplicarMarcas`. Ele marca o começo da frase (um toque),
  ou o começo de palavras (modo palavra a palavra). Entre marcas, o tempo
  espalha-se pelas palavras em proporção às vogais. `marcada: true` guarda quais
  foram marcadas à mão, e `marcasDasFrases` faz o caminho inverso quando o painel
  abre.
- **O fim de uma frase não é o começo da seguinte**: num intervalo instrumental
  o destaque ficaria parado na última palavra. Acaba no que a frase demora a
  cantar, com folga (`fimDaFrase`).
- Cada toque desconta **150 ms** (`ATRASO_DO_TOQUE_MS`), o tempo de reacção.
- **Publicar exige a música toda sincronizada**, e qualquer gravação que a deixe
  incompleta tira-a do ar. Gravar marcas de uma letra que entretanto mudou dá
  409 (duas abas abertas).

### O desenho

- **Destaque de cada palavra** (`niveisDaFrase`): marca manual na música → lista
  do projeto (normalizada sem acentos; expressões de duas palavras primeiro) → se a
  frase ficar sem nenhum, a palavra de conteúdo mais comprida ganha nível 1.
- **Linhas** (`linhasDaFrase` no palco): palavra de nível 2–3 numa linha só dela;
  palavras curtas encostam-se à grande ("A LUZ"); o resto enche linhas de ~16
  caracteres.
- **Composições**: seis (`cartaz`, `faixa`, `degrau`, `pilula`, `pilha`,
  `inclinado`) × cinco paletas, escolhidas pelo número da frase. Fixo e não
  aleatório: a mesma música desenha-se sempre igual, e o que ele vê no painel é o
  que a criança vê (o painel usa o mesmo `PalcoDoKaraoke`).
- Letra **Lilita One** (OFL), no repositório em `app/fontes`, carregada só nas
  páginas do karaokê. Contorno com `-webkit-text-stroke` + `paint-order`, halo
  creme e relevo com `text-shadow`. Tamanhos em `cqi` (largura do palco).
- **Nenhuma linha sai do ecrã**: mede-se cada linha e encolhe-se só a que não
  cabe, com as animações desligadas durante a medida (`a-medir`) — no Chrome o
  `scrollWidth` conta as transformações.
- **Sem barrinhas** neste modo, a pedido dele. O relógio é `requestAnimationFrame`
  sobre `audio.currentTime` (o `timeupdate` chega só ~4 vezes por segundo).
- Tocar no karaokê conta como `MEDIA_PLAY`/`MEDIA_COMPLETE` da faixa, com
  `props.modo = "karaoke"`.

### Acesso

`TODOS` (padrão), `CONTA` (sem sessão a API responde 403 `precisaDeConta` e o
ecrã convida a entrar; o cliente tenta renovar a sessão antes) e `DESLIGADO` (o
botão desaparece e a rota dá 404).

### As letras escrevem-se sozinhas

Pedido dele em 19/09, depois de perceber o que era sincronizar sessenta músicas
à mão: *"eu envio o áudio e o sistema faz a transcrição automática da voz, sem eu
precisar fornecer nenhum texto"*. O computador ouve a música e escreve a letra
com o tempo de cada palavra — que é exactamente o que o karaokê precisa.

| O quê | Onde |
| --- | --- |
| Fila | tabela `TranscricaoDeAudio` (uma linha por cartão com áudio), `TranscricaoService` |
| Porta do transcritor | `POST /api/interno/transcricoes/proxima`, `PATCH :id/progresso`, `POST :id/pronta`, `POST :id/falhou` — fechadas pela chave `TRANSCRITOR_TOKEN` |
| Painel | `GET/POST /api/admin/projects/:slug/transcricoes`, `POST /api/admin/cards/:id/transcricao` |
| Quem ouve | `deploy/transcritor/transcritor.py` (imagem própria, serviço `transcritor` no compose) |
| Ecrã | `OficinaDasLetras` no topo de `/[projeto]/admin/karaoke` |
| Agrupamento em frases | `frasesDeTranscricao` em `@pv/karaoke` |

**Porque é uma fila e não um pedido.** Ouvir uma música demora à volta do tempo
da própria música. Um pedido HTTP que demora seis minutos morre em qualquer
proxy, e ninguém fica a olhar para um ecrã à espera. Quem envia o áudio deixa um
pedido; o transcritor — processo à parte, que ninguém chama — pergunta se há
trabalho, faz um de cada vez e devolve o resultado. Parar o transcritor a meio
não parte nada: uma música presa há mais de 30 minutos volta sozinha à fila.

**O áudio novo entra sozinho.** `salvarCartao` põe a faixa na fila quando o
`assetId` muda. É a única porta por onde entra áudio na plataforma, e é por isso
que o pedido nasce ali e não num botão que ele teria de carregar sessenta vezes.

**Quem pode passar por cima de quê** (`PorqueOuvir`):

| Razão | Quando | O que respeita |
| --- | --- | --- |
| `AUDIO_NOVO` | ele trocou o áudio do cartão | refaz mesmo que já tivesse sido ouvida (a letra antiga é de outra música), mas **não toca em letra escrita à mão** |
| `FALTA_LETRA` | "Escrever as letras que faltam" | só mexe em quem não tem letra publicada nem foi ouvida |
| `ELE_PEDIU` | "Ouvir de novo" / "Refazer todas" | refaz tudo, incluindo o que ele escreveu |

Gravar a letra no painel marca-a `MANUAL` — a partir daí é dele, e só volta a
ser ouvida se ele pedir. Basta haver texto: uma letra colada e ainda por
sincronizar também está protegida.

**Publicar.** A letra automática passa pelo mesmo `validarFrases` da escrita à
mão e vai ao ar publicada, sem revisão. É uma decisão: uma letra com uma palavra
trocada é melhor do que nenhuma — a criança canta à mesma — e deixá-la à espera
de revisão punha-o a fazer, uma a uma, o trabalho de que se queixou. O painel
marca-a como **automática** para ele saber onde olhar. Se as frases não passarem
nas regras (áudio mais curto do que a letra, por exemplo), fica **guardada por
publicar** e a faixa aparece com a razão escrita.

**A percentagem.** Conta a música que está a ser ouvida agora, e não só as
acabadas: com sessenta faixas de quatro minutos, uma barra que só saltasse de
faixa em faixa ficaria parada minutos a fio, e uma barra parada é
indistinguível de uma avaria. Cada música vale uma e não mais.

**O modelo.** `medium` do Whisper (via faster-whisper, `int8`, CPU). Medido com
as músicas dele: o `small` é três vezes mais rápido e escreve disparates em voz
cantada ("Antes de eu nascer" saía "Ante deus e nasce"); o `medium` acerta. O
filtro de silêncio (VAD) vai **desligado**: numa canção com instrumental, o
filtro tomava a música por silêncio e deitava fora metade da letra.

```bash
# no servidor, uma vez
TRANSCRITOR_TOKEN=$(openssl rand -hex 24)   # vai para .env.production
docker compose -f docker-compose.prod.yml up -d --build transcritor
docker compose -f docker-compose.prod.yml logs -f transcritor
```

Depois, no painel, **Escrever as letras que faltam** põe tudo na fila. Conta com
mais ou menos o tempo somado das músicas — sessenta faixas de quatro minutos são
umas quatro a sete horas de servidor, e o site continua a funcionar enquanto
isso acontece. Num servidor de 1 vCPU vale a pena fazê-lo de noite, ou pôr o
`transcritor` numa máquina maior: ele só precisa de alcançar a API.

### O que falta, e não é código

As **duas músicas de exemplo** fazem-se no painel de produção, com os áudios e as
letras reais dele: colar a letra, marcar, publicar. O ambiente de
desenvolvimento não tem os áudios dele.

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
