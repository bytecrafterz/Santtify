# Arquitetura — Produto Vivo / Jesus Alfabeto Saudável

> Documento técnico da Fase 1. Deriva de [contexto/04-escopo-acordado.md](contexto/04-escopo-acordado.md).

---

## Princípio central

Existem **duas coisas sendo construídas ao mesmo tempo**, e confundi-las é o único erro
capaz de inviabilizar a Fase 2:

- **Produto Vivo** — a plataforma. Não sabe o que é uma letra do alfabeto.
- **Jesus Alfabeto Saudável** — um *projeto* dentro da plataforma, cujos *conteúdos*
  acontecem de ser 26 letras.

Regra prática aplicada em todo o código: **se um identificador, tabela, rota ou componente
menciona "letra", "alfabeto" ou "26", ele está no lugar errado** — exceto dentro do seed
de dados e da camada de apresentação específica do projeto.

Segundo princípio, igualmente estruturante:

> **Eventos brutos são a fonte da verdade. Todo agregado é derivado e recalculável.**

Nunca o contrário. Isso foi confirmado explicitamente com o cliente e é o que permite,
daqui a seis meses, responder perguntas que ninguém formulou hoje.

---

## Stack

| Camada | Escolha | Por quê |
|---|---|---|
| PWA | Next.js 15 (App Router) + TypeScript | Exigido pelo cliente; instalabilidade e SSR sem configuração extra |
| Backend | NestJS + TypeScript | Módulos com fronteira explícita — o módulo social precisa virar API white label sem reescrita |
| Banco | PostgreSQL 16 | Relacional (exigido) + JSONB para extensibilidade sem migration + agregações analíticas |
| ORM | Prisma | Migrations versionadas e tipagem compartilhada |
| Auth | JWT próprio (access + refresh) | "Autenticação própria" foi acordado; usuário único global, não por projeto |
| Fila/Jobs | Cron do NestJS (Fase 1) | Fotografia diária e recálculo de agregados |
| QR Code | Geração server-side (SVG + PNG) | Cliente nunca fornece QR pronto; sistema gera ao publicar |

### Por que backend separado e não API routes do Next.js

O Produto Vivo é vendido como **API white label** consumida por sites e apps de terceiros
(o exemplo do cliente: o app do McDonald's exibindo card social num Big Mac). Uma API que
nasce dentro do app Next.js do alfabeto não sai de lá sem reescrita — exatamente o problema
que a proposta se comprometeu a evitar. Backend separado desde o dia 1 custa pouco agora e
elimina a reescrita depois.

---

## Estrutura do repositório

```
apps/
  web/            Next.js — PWA público (26 páginas, perfil, social) + painel admin
  api/            NestJS — API REST, futura API white label do Produto Vivo
packages/
  db/             Prisma schema, migrations, seed
  shared/         Tipos e contratos compartilhados (eventos, enums, DTOs)
docs/
  contexto/       Requisitos, proposta, histórico e escopo (imutáveis)
  ARQUITETURA.md  Este documento
```

Módulos do NestJS, com a fronteira que importa:

```
core/          projetos, conteúdo, mídia, blocos, short links, QR
identity/      visitantes, usuários, auth, consentimento
social/        reações, comentários, compartilhamentos   ← genérico, futuro white label
tracking/      ingestão de eventos, atribuição, cadeia de propagação
analytics/     agregação diária, leitura do dashboard
admin/         painel, CRUD de conteúdo, auditoria
```

`social/` e `tracking/` **não importam nada de um projeto específico**. Recebem
`projectId` e `contentId` e não sabem o que representam.

---

## Modelo de dados

### 1. Conteúdo — genérico por construção

```
Project ──< Content ──< ContentBlock >── MediaAsset
                └──── ContentMetadata (1-1)
```

Uma letra é um `Content` do projeto "Jesus Alfabeto Saudável". A página não é montada por
campos fixos ("música", "letra da música", "texto educativo") — isso amarraria a estrutura
ao alfabeto. É montada por **blocos ordenados** (`ContentBlock`) de tipo `TEXT`, `AUDIO`,
`VIDEO`, `IMAGE`, `EMBED`, cada um com um rótulo livre. O cliente compõe a página pelo
painel, e o mesmo mecanismo serve para o próximo projeto sem uma linha de código nova.

**`ContentMetadata`** atende ao último pedido do cliente: plataforma, formato, tema,
produto, campanha, CTA, data/hora e variante de teste — mais um `attributes` JSONB para o
que ainda não sabemos que vamos querer. Fica em tabela separada porque é dado analítico,
não dado de renderização: não pesa no caminho quente de leitura da página, e a IA da Fase 2
cruza desempenho × características sem tocar no schema.

### 2. Links e QR Codes — uma tabela, três usos

`ShortLink` é a espinha dorsal do rastreamento. Todo link rastreável do sistema passa por
ela, com `kind` distinguindo o uso:

| kind | Criado quando | Serve para |
|---|---|---|
| `CONTENT_QR` | Conteúdo é publicado | O QR Code impresso/exibido de cada letra |
| `CAMPAIGN` | Admin cria uma campanha/post/vídeo | Identificador próprio por publicação |
| `SHARE` | Usuário clica em "Compartilhar" | Medir propagação pessoa → pessoa |

Os três campos que transformam isso numa árvore:

- `parentShortLinkId` — o link pelo qual **quem compartilhou** havia chegado. É a aresta da cadeia.
- `rootShortLinkId` — a raiz da cadeia, desnormalizada.
- `depth` — profundidade, desnormalizada.

Guardar raiz e profundidade no momento da criação (em vez de calcular por recursão depois)
é o que faz "quanto dinheiro esta cadeia inteira gerou" ser **uma consulta**, não uma
reconstrução — que foi precisamente o que se prometeu ao cliente.

### 3. Identidade — atribuição começa antes do cadastro

```
Visitor (pseudônimo) ──0..1──> User (perfil global, não por projeto)
```

`Visitor` existe desde o **primeiro** acesso anônimo. Quando a pessoa se cadastra, o
`Visitor` é ligado ao `User` — e com isso **toda a atribuição anterior ao cadastro é
preservada**. Sem essa separação, a origem de quem chegou pelo Instagram e só se cadastrou
três dias depois estaria perdida.

`User` não tem `projectId`. O cliente foi explícito: *"o utilizador terá apenas um perfil
principal e poderá interagir com diferentes empresas sem precisar criar uma conta para cada
aplicativo."*

#### As três origens, guardadas separadamente

O cliente pediu "origem inicial" e "origem imediata". Lendo a explicação dele com atenção,
são na verdade **três** coisas distintas, e guardamos as três — é estritamente mais
informação e elimina a ambiguidade:

| Campo | Significado | Exemplo (Usuário C da cadeia) |
|---|---|---|
| `firstTouch*` | Como **esta pessoa** chegou pela primeira vez | WhatsApp, link do Usuário B |
| `lastTouch*` | De onde veio **a visita atual** | Link direto |
| `root*` | O que originou **a cadeia inteira** | Instagram, Vídeo 03 |

`chainDepth` e `referredByUserId` completam o quadro: C tem `chainDepth = 2` e
`referredByUserId = B`. A árvore `Instagram → A → B → C → D,E,F` é reconstruível
integralmente, inclusive retroativamente, sem que a visualização exista ainda.

### 4. Evento — a tabela que não pode ser refeita depois

Append-only. Nunca sofre `UPDATE`, nunca sofre `DELETE` fora da política de retenção.

Cada evento carrega um **snapshot da atribuição no momento em que ocorreu** — não uma
referência ao estado atual do visitante. Se o visitante for reatribuído amanhã, o que
aconteceu ontem continua verdadeiro. Essa é a diferença entre um log de eventos e uma
tabela de auditoria inútil.

A chave mínima que o próprio cliente formulou está inteira:

```
visitorId/userId + occurredAt + type + source + campaignId
                 + contentId + shortLinkId + parentShortLinkId
```

Mais: `value`, `currency`, `productRef`, `externalOrderRef` — **os campos de compra já
existem desde a primeira migration**, embora nenhum evento de compra seja gerado na Fase 1.
Ligar o webhook do checkout externo na Fase 2 não toca no schema.

Mais: `props JSONB` — qualquer atributo novo entra sem migration. Isso importa porque o
cliente vai querer medir coisas que ainda não imaginou.

Tipos de evento previstos desde já:

```
SESSION_START · PAGE_VIEW · CONTENT_VIEW · QR_SCAN
CONSENT_GIVEN · CONSENT_REVOKED
SIGNUP · LOGIN
MEDIA_PLAY · MEDIA_PROGRESS · MEDIA_COMPLETE
LIKE · UNLIKE · COMMENT · COMMENT_DELETED
SHARE_CREATED · SHARE_LINK_CLICKED
CHECKOUT_CLICKED · PURCHASE_COMPLETED      ← reservados, Fase 2
CUSTOM
```

`MEDIA_PROGRESS` e o par `SESSION_START`/duração são o que permite calcular tempo médio de
permanência na Fase 2 — coletado agora, apresentado depois. Mesma lógica de tudo o mais.

### 5. Agregados — derivados, jamais fonte da verdade

`DailyMetric` guarda a fotografia diária por dimensão (`TOTAL`, `SOURCE`, `CAMPAIGN`,
`CONTENT`). Um job noturno recalcula a partir de `Event`. Um comando de CLI recalcula
qualquer intervalo do zero.

`ContentStats` guarda contadores quentes (curtidas, comentários, visualizações) para a
página não precisar agregar em tempo de leitura. Também derivado, também recalculável.

Se um agregado divergir, a correção é recalcular. Se um evento bruto não foi gravado, não
existe correção — daí toda a ênfase.

### 6. Dia Zero e LGPD/GDPR

`BaselineSnapshot` registra o marco de lançamento (Instagram ~200, TikTok ~40, YouTube 0,
Produto Vivo 0) como linha de base explícita, para a curva de crescimento ter um ponto de
partida real quando for apresentada a uma empresa.

`Consent` registra consentimento por visitante com versão da política e finalidades
granulares. O fluxo de eventos usa **identificadores pseudônimos**; IP e user-agent são
armazenados apenas como hash com salt de servidor. Nenhum dado pessoal desnecessário entra
em `Event`.

#### Direito ao apagamento: anonimizar, não apagar

Todas as chaves estrangeiras que carregam atribuição — usuário, conteúdo, campanha, link,
sessão — são `RESTRICT`, nunca `SET NULL`. O motivo é concreto: com `SET NULL`, apagar um
usuário zeraria o `userId` de todos os eventos históricos dele, destruindo em silêncio
exatamente o dado que o cliente contratou. O banco agora recusa essa operação.

Para atender ao direito ao apagamento da LGPD/GDPR, o procedimento é **anonimizar o
registro do usuário** — limpar e-mail, nome e avatar, manter o `id` — em vez de removê-lo.
Isso é o que o GDPR admite como anonimização, satisfaz o titular e preserva as métricas
agregadas: a pessoa deixa de ser identificável, e a curva de crescimento continua correta.

A remoção física só ocorre pela rotina de retenção, com a flag de sessão explícita
`pv.allow_event_purge`, o que a torna deliberada e auditável em vez de acidental.

> Nota regulatória: o cliente está em Portugal (+351). Portanto **GDPR aplica-se
> diretamente**, não só a LGPD que ele citou. Tratamos o GDPR como piso, por ser o mais
> rígido dos dois. Ver [contexto/05-cliente.md](contexto/05-cliente.md).

---

## Fluxo de propagação, ponta a ponta

O cenário exato descrito pelo cliente, e o que o sistema grava em cada passo:

```
1. Instagram, Vídeo 03  →  link com ?pv=<code da campanha>
   Visitor A criado. firstTouch = instagram/video-03. root = instagram/video-03.
   chainDepth = 0. Evento SESSION_START + PAGE_VIEW com o snapshot.

2. A se cadastra
   User A criado, ligado ao Visitor A. A atribuição do passo 1 é preservada.
   Evento SIGNUP carregando source=instagram, campaignId=video-03.

3. A clica em Compartilhar no conteúdo "Letra B", canal WhatsApp
   ShortLink SHARE criado: createdBy=A, content=Letra B, channel=WHATSAPP,
   parent = link do passo 1, root = campanha do Instagram, depth = 1.
   Evento SHARE_CREATED.

4. B abre o link do WhatsApp
   Visitor B criado. firstTouch = whatsapp/share-de-A. lastTouch = idem.
   root = instagram/video-03  ← a cadeia preserva a origem verdadeira.
   referredByUser = A. chainDepth = 1.
   Eventos SHARE_LINK_CLICKED + SESSION_START.

5. B compartilha → C, C compartilha → D, E, F
   Mesma mecânica. depth 2, 3. root continua instagram/video-03 em todos.
```

Consequência: no dia em que a árvore visual for construída, ela é uma leitura de dados que
já estão lá. E a pergunta comercial que o cliente quer responder — *"esta pessoa nunca
comprou, mas a cadeia dela gerou R$ 2.000"* — é uma soma de `Event.value` filtrando por
`rootShortLinkId`.

---

## O que a Fase 2 precisa fazer (e o que não precisa)

| Funcionalidade da Fase 2 | Precisa de migration? | O que falta |
|---|---|---|
| Árvore visual de propagação | Não | Só a tela |
| Comparação entre plataformas | Não | Só as consultas e a tela |
| Funil por campanha | Não | Só as consultas e a tela |
| Confirmação de compra (webhook) | Não | Só o endpoint que recebe |
| Faturamento por cadeia | Não | Só a consulta |
| Tempo médio de permanência | Não | Só o cálculo sobre sessões |
| IA analítica | Não | Camada de leitura sobre os eventos |
| Painel multi-projeto | Não | Só a interface — `projectId` já existe em tudo |
| API white label | Não | Chaves de API e rate limit sobre o módulo `social/` |

Essa tabela é o critério de aceitação da arquitetura da Fase 1. Qualquer item que passe a
exigir migration significa que algo foi modelado errado agora.

---

## Decisões registradas

1. **Backend separado do front** — a API white label precisa existir fora do app do alfabeto.
2. **Blocos de conteúdo em vez de campos fixos** — a página da letra não pode ditar o schema.
3. **`Visitor` separado de `User`** — atribuição pré-cadastro é a maior parte do funil.
4. **Três origens, não duas** — resolve a ambiguidade do pedido com mais informação.
5. **Raiz e profundidade desnormalizadas no `ShortLink`** — transforma reconstrução em consulta.
6. **Campos de compra criados vazios** — a Fase 2 liga a entrada, não refaz o banco.
7. **`props`/`attributes` JSONB em evento e metadados** — extensibilidade sem migration.
8. **Hash de IP e user-agent, nunca o valor cru** — GDPR como piso.
9. **Agregados sempre recalculáveis** — divergência é sempre corrigível.
10. **`RESTRICT` em toda FK de atribuição** — apagar uma dimensão não pode zerar histórico.
11. **Append-only imposto por trigger, não por convenção** — bug de aplicação não reescreve
    o passado.
12. **Moderação assimétrica no `Post`** — publicação com foto nasce `PENDING` e só fica
    visível depois da aprovação; sem foto nasce `PUBLISHED`, como sempre foi. O risco
    está na imagem de criança que vira pública e sai da plataforma, não na legenda
    sobre uma música do próprio projeto. Moderar as duas coisas igual atrasaria o uso
    legítimo sem reduzir o risco que importa.
13. **`PostsService` em módulo próprio, usado pelos dois lados** — quem decide o que
    nasce pendente é quem decide o que o autor enxerga. Com a regra escrita em dois
    lugares (era o caso: o perfil filtrava só `PUBLISHED`), a foto esperando aprovação
    sumia da tela de quem a enviou.
14. **Foto e legenda numa requisição só** — envio em duas etapas deixa arquivo órfão no
    disco toda vez que a segunda falha.

## Pontos de crescimento previstos

- `Event` particionado por mês quando passar de ~10M linhas (migration em SQL puro; o
  modelo não muda).
- Ingestão de eventos assíncrona via fila quando o volume justificar; hoje é gravação direta.
- Réplica de leitura para o dashboard quando as consultas analíticas competirem com o app.
