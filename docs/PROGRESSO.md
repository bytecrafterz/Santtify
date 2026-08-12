# Progresso do projeto — 11/08/2026

Registro do estado técnico e da relação com o cliente. Quem retomar este projeto
deve ler este arquivo primeiro, depois [ARQUITETURA.md](ARQUITETURA.md) e
[contexto/04-escopo-acordado.md](contexto/04-escopo-acordado.md).

---

## Situação em uma frase

**Todo o escopo contratado está construído, verificado e entregue seis dias antes do
prazo.** O que resta está bloqueado por decisões do cliente (domínio, hospedagem,
triagem dos mockups) ou é fase seguinte, orçada e aguardando aprovação.

| | |
|---|---|
| Contrato | USD 256 (líquido ~200, taxa Workana 20%) |
| Prazo assumido | Entrega 1 antes de 17/08 — **cumprido em 10/08** |
| Commits | 15 |
| Migrations | 5 |
| Tabelas | 23 |
| Suites de verificação | 4 (atribuição, social, propagação, foto) — todas passando |

---

## Entregas

### Entrega 1 — completa

| Item | Situação |
|---|---|
| 26 páginas de conteúdo | ✔ |
| QR Code automático + gerenciador | ✔ |
| PWA instalável (Next.js) | ✔ |
| Autenticação própria (JWT) | ✔ |
| Perfil com as três áreas | ✔ |
| Painel admin (celular ou computador) | ✔ |
| Página institucional PV | ✔ estrutura (falta arte e WhatsApp dele) |
| Camada de coleta Dia Zero | ✔ |

### Entrega 2 — completa

| Item | Situação |
|---|---|
| Módulo social (curtir, comentar, compartilhar) | ✔ |
| Dashboard com métricas essenciais | ✔ |

### Fora do contrato, entregue sem custo

- **My Post — publicar música/áudio da plataforma no perfil com legenda.** Concedido
  em 11/08 para resolver a ambiguidade de "Minhas Publicações" a favor dele.
- **Meus Lançamentos.** Ficou indefinido desde a proposta; os mockups de 11/08
  esclareceram que é a vitrine de próximos produtos. Construído no mesmo dia.
  Removido da interface no mesmo dia, a pedido dele; a API continua de pé.
- **Foto no My Post, com fila de moderação.** Concedido em 12/08 no acordo de escopo
  (ver `docs/mensagens/2026-08-12-resposta-escopo-my-post.md`). Era o Bloco 2, orçado
  em USD 900; **o orçamento estava errado** — a infraestrutura de envio já existia do
  painel, e foi por honestidade que o número foi corrigido para baixo antes de ceder.

#### Como a foto funciona, e por que assim

| Decisão | Motivo |
|---|---|
| Com foto nasce `PENDING`; sem foto nasce `PUBLISHED` | Imagem de criança que fica pública e sai da plataforma é de outra ordem de risco que uma legenda sobre uma música do próprio projeto. Moderar as duas coisas igual atrasaria o uso legítimo sem reduzir o risco que importa |
| Foto e legenda numa requisição só | Enviar em duas etapas deixaria arquivo órfão no disco quando a segunda falha |
| Recusa não apaga: fica `REJECTED` com o motivo, visível para o autor | Recusar em silêncio faz a criança reenviar a mesma foto até desistir |
| Autor vê as próprias pendentes | Esconder daria a impressão de que a publicação sumiu |
| Máximo de 5 fotos por pessoa esperando aprovação | Uma conta sozinha encheria a fila e tiraria do responsável a única proteção que ele tem: conseguir olhar item a item |
| Só imagem; vídeo recusado na porta | Aceitar vídeo abriria por acidente o bloco que ficou fora do contrato |
| Aprovação e recusa gravadas em `AdminAuditLog` | Quem moderou o quê, e quando, precisa ser reconstituível |
| Remoção é `DELETED`, não apagamento da linha | O `POST_CREATED` continua no log; apagar a linha deixaria o histórico contando uma publicação que não existe |

---

## Decisões de arquitetura que sustentam o resto

1. **Nada conhece o conceito de "letra".** Uma letra é um `Content` de um `Project`.
2. **`events` é fonte da verdade e append-only**, imposto por trigger no banco, não
   por convenção. `DailyMetric` e `ContentStats` são derivados e recalculáveis.
3. **Três origens gravadas separadamente**: primeira da pessoa, imediata da visita,
   e raiz da cadeia. O pedido do cliente citava duas; são três coisas distintas.
4. **FKs de atribuição são `RESTRICT`**, nunca `SET NULL`. Apagar usuário ou conteúdo
   não pode zerar histórico. Erasure LGPD/GDPR = anonimizar, não apagar.
5. **Origem contada pela RAIZ da cadeia** no dashboard. Contar pelo toque imediato
   faria o WhatsApp parecer o maior canal quando é só o meio de propagação.
6. **Origem única** em produção (site e API no mesmo domínio, prefixo `/api`),
   eliminando CORS entre subdomínios e cookie com `Domain=`.

---

## Bugs encontrados e corrigidos

Todos foram descobertos verificando o comportamento real, não lendo o código.

| # | Bug | Como apareceu |
|---|---|---|
| 1 | Navegação interna virava origem `OTHER`, sobrescrevendo a atribuição a cada toque | Olhando o banco após um teste que "passou" na tela |
| 2 | Ação no app (consentimento, cadastro) virava origem `DIRECT` | Idem — levou à regra de "evidência positiva" |
| 3 | Perfil contava zero para quem navegou antes de criar conta | Eventos pré-cadastro têm `userId` nulo; a leitura precisa passar pelo elo visitante→usuário |
| 4 | `count(*)` do Postgres volta BigInt e derrubava o dashboard com 500 genérico | Primeira chamada real da API de métricas |
| 5 | Barra social só aparecia após resposta da API, empurrando o conteúdo | Inspeção do HTML servido |
| 6 | Compartilhar mostrava erro mesmo com o link criado, em HTTP | `navigator.share`/`clipboard` só existem em contexto seguro |
| 7 | Login não devolvia a pessoa à página que ela tentou abrir | **Reportado pelo cliente** — ele achou que o painel não existia |
| 8 | API lenta pendurava a página inteira, sem timeout | Primeiro build de produção, apontado a domínio inexistente |
| 9 | A lista do My Post existia em dois lugares, e a versão do perfil filtrava só `PUBLISHED` — a foto pendente sumia da tela de quem a enviou | Verificação da foto: a API criava o `PENDING` certo e a autora não via nada |
| 10 | A trava de toque duplo recusava publicar a música logo depois de mandar uma foto dela, como se fosse repetição | Mesma verificação, último passo |
| 11 | `/favicon.ico` respondia 404 em toda visita, com erro no console de qualquer visitante | Verificação visual no navegador, que falha se houver qualquer erro de JavaScript |

> Padrão que se repetiu: **o teste visual passa e o dado está errado.** Daí as três
> suites de verificação que rodam contra a API no ar.

---

## Relação com o cliente

### Perfil

Rossandro Caxito, Portugal (+351). Visão comercial forte, não é desenvolvedor mas
formula requisitos com precisão incomum. **Responde bem a delimitação honesta de
escopo** — aceitou adiar funcionalidades três vezes quando a justificativa técnica
foi clara. Ritmo de resposta irregular mas engajado.

### O padrão que importa

O escopo cresceu muito depois do aceite, e **cada expansão chegou depois de um ponto
de compromisso**:

| Quando | O que foi acrescentado |
|---|---|
| Publicação original | PWA, 26 páginas, social simples, dashboard |
| ← proposta aceita | |
| Logo depois | Gerador de QR, botão multi-projeto, página PV |
| Véspera do escrow | **Toda a camada de rastreamento e atribuição** (9 seções) |
| ← pagamento feito | |
| Dia 2 | Produto pago, desbloqueio diário, playlist, **KYC internacional**, **vídeo** |
| Dia 3 | Mockups com ~13 funções nunca discutidas |

**A fórmula que funcionou, 3 de 3:** reconhecer o valor do pedido → explicar por que
fazer agora é estruturalmente errado ou prematuro → confirmar que a arquitetura já
comporta → propor como etapa seguinte com orçamento próprio.

### Orçamento da fase seguinte — enviado 11/08, aguardando resposta

| Bloco | Valor | Prazo |
|---|---|---|
| 1. Venda + desbloqueio + playlist | USD 1.400 | 2–3 semanas |
| 3. Permissões (visitante × membro) | USD 900 | 1–2 semanas |
| 2. Foto no My Post (vídeo removido a pedido dele) | a revisar, era USD 2.600 com vídeo | 4–5 semanas |

Ordem **1 → 3 → 2** por dependência: o bloco 1 define o que é ser membro; o 3 define
quem publica; e o 1 é o único que gera receita.

> **A resposta dele a esses números é o dado mais informativo do projeto.** Engajamento
> significa cliente real. Recuo significa que o escopo contratado foi entregue por
> inteiro, no prazo, e dá para encerrar bem.

### Posições assumidas por escrito

- **Verificação por documento não agora.** Custaria US$1,50–2,00 por pessoa (mais que
  o contrato inteiro em 1.000 clientes) e contradiz o objetivo dele de baixo atrito.
  Proposto: a compra já é o filtro de identidade, mais telefone por SMS.
- **Conta pertence sempre ao adulto responsável**, criança sem perfil público próprio,
  moderação antes de ficar visível. Aceito por ele.
- **Vídeo tem custo mensal permanente contra receita única.** Retenção precisa ser
  decidida e informada na compra.
- **Hospedagem na conta dele**, no cartão dele.

### Em aberto: quem pode publicar foto (12/08)

Ele propôs substituir a fila de aprovação por controle de acesso — só **Membro Premium**
(quem comprou) publica foto, com selo de verificado, aceite de regras, bloqueio
permanente e Bloquear/Denunciar. Argumento: aprovar 100 mil fotos à mão é impossível.

**Resposta dada:** concordar com a barreira de entrada, discordar de remover a revisão.

| Ponto | Posição assumida por escrito |
|---|---|
| Entrada ≠ conteúdo | Pagar não impede publicar a foto errada. O caso mais provável é o pai de boa-fé cuja foto tem outra criança, ou rosto + uniforme + escola. Premium não toca nesse caso; a fila pega |
| Escala | A fila cresce com **fotos publicadas**, não com usuários. Com o desenho dele, só quem pagou publica — o universo já encolhe sozinho |
| Confiança graduada | Revisar só as primeiras publicações de cada conta; depois de N aprovadas, publica direto. A fila fica proporcional a **contas novas**, não à base |
| Denunciar | É moderação **depois**, reativa, e vira fila também: dá mais trabalho, não menos. Numa plataforma de crianças, o intervalo entre publicar e denunciar **é o risco**. Recomendado ter — na UE é praticamente obrigatório — mas como obrigação adicional, não como troca |
| Selo "verificado" | Ele recusou verificação por documento pelo custo. Selo que diz "verificado" significando só "comprou" é **risco**, não proteção: pai vê selo e baixa a guarda. Proposto: chamar de **Membro** |
| Gratuito | Deve continuar publicando **conteúdo da plataforma com legenda**; só a **foto do aparelho** exige Premium. A restrição fica onde está o risco e preserva o compartilhamento que alimenta as métricas |
| Custo técnico | **Zero.** O `PostsService` já se ramifica em "tem foto / não tem foto". A mesma separação que decide o que nasce pendente passa a decidir quem pode publicar |
| Enquadramento | O que ele descreveu **é Bloco 1 (USD 1.000) + Bloco 3 (USD 700)**, já orçados. Segurança em vez de funcionalidade não muda o trabalho |
| Nunca orçado | Aceite de regras versionado, bloqueio permanente com registro, bloquear/denunciar com motivos e fila própria |

**Consequência prática:** enquanto o Bloco 1 não existir, ninguém é Premium — a regra
"só Premium publica" desligaria a foto para todos. A fila fica como está até lá.

### Decidido em 12/08: sem aprovação prévia

Ele reafirmou depois de ouvir a recomendação contrária, e **o motivo muda o peso da
decisão**: não é estimativa de volume, é que não tem tempo nem condição financeira de
contratar quem modere. Restrição real, não preferência.

**Posição assumida:** aceito, sem insistir uma terceira vez. A recomendação contrária
está por escrito em `2026-08-12-quem-pode-publicar.md`; a decisão e o conteúdo hospedado
são dele.

**O que mudou no código, sem cobrar:**

| | |
|---|---|
| `Project.photoApprovalRequired` | Chave no painel (área de Aprovações). Ele liga e desliga sozinho |
| `project.photo_approval.on/off` | Vai para o `AdminAuditLog` — é a configuração de maior consequência do painel |
| Aviso antes de publicar | O texto dele, palavra por palavra, com a foto já escolhida e antes do botão Publicar |
| A fila **não foi apagada** | Desligada continua sendo a caixa de entrada natural das denúncias |

**Os três buracos apontados no desenho dele, aguardando resposta:**

1. **Foto de perfil do membro grátis é upload de foto pessoal** — contradiz "só Premium
   envia foto" e seria a única porta aberta de graça. Recomendado: avatar de um conjunto
   de ilustrações do projeto. **É o ponto que trava o cadastro.**
2. **Telefone coletado ≠ verificado** — sem código por SMS é um campo de texto, não
   barreira. Custa por envio; ele decide sabendo disso. Mesmo caso do "nome verdadeiro".
3. **Denúncia precisa de caixa de entrada** — a tela existe (é a fila), o sistema de
   bloquear/denunciar com motivos e reincidência **não está orçado**.

### Perguntas abertas com ele

1. **Triagem dos mockups** — quais das ~13 funções são essenciais para o lançamento.
2. **SANTTIFY** — imagens 5 e 6 são outro produto (31 atributos, outra marca). É
   segundo projeto ou referência visual?
3. **Domínio** — decisão irreversível depois de imprimir QR.
4. **Hospedagem** — recomendado Hetzner CX22 (~€4/mês) + Cloudflare grátis.

---

## Bloqueios e pendências

| Item | Bloqueado por | Urgência |
|---|---|---|
| Deploy em produção | Domínio + conta de hospedagem dele | **Alta** — nada está no ar |
| Imagens Docker nunca construídas | Máquina com Docker | Média — reservar 1h no servidor dele |
| Apagar dados de demonstração | Nada; fazer antes do lançamento | **Crítica** — 439 visitantes falsos contaminam o Dia Zero |
| Trocar senha temporária dele | Deploy real | Média |
| Arte e textos da página PV | Ele | Baixa |
| Conteúdo das 26 letras | Ele | Baixa — ele cadastra pelo painel |

### Comandos que importam

```bash
# antes do lançamento, obrigatório
npx tsx packages/db/prisma/dados-demonstracao.ts --limpar

# se o domínio mudar, regera destinos e QR
npx tsx packages/db/prisma/regerar-links.ts

# verificar que tudo continua correto (com a API no ar)
npx tsx packages/db/prisma/verificar-atribuicao.ts   # 14 verificações
npx tsx packages/db/prisma/verificar-social.ts       # 20 verificações
npx tsx packages/db/prisma/verificar-propagacao.ts   # cadeia completa
npx tsx packages/db/prisma/verificar-foto.ts         # 43 verificações da foto e da chave de aprovação
```

---

## Ambiente de demonstração

`http://49.12.170.6:3100` — HTTP, sem domínio, **temporário**. Serve para o cliente
ver e dar retorno; não é lançamento.

Admin dele: `rossandro@alfabeto.local` / `Alfabeto5639Vivo`

> **Cuidado:** é servidor de desenvolvimento, sem supervisor. Já caiu três vezes, duas
> por ação minha. **Conferir antes de apontar o cliente para ele:**
> `curl -s -o /dev/null -w '%{http_code}\n' http://49.12.170.6:3100/jesus-alfabeto-saudavel`
>
> E **nunca rodar `next build` na mesma árvore do servidor de desenvolvimento** — o
> build sobrescreve `.next` e o servidor passa a servir uma mistura corrompida.

---

## Avisos que não podem ser esquecidos

**O domínio fica gravado dentro de cada QR Code.** Trocar depois de imprimir invalida
todo o material. Decidir antes de qualquer impressão. Para demonstração não há risco.

**O backup do banco não é opcional.** Os eventos brutos são o Dia Zero e não existem
em nenhum outro lugar. O serviço `backup` do compose de produção precisa estar rodando
antes do primeiro visitante real.

**A mídia vive em disco.** `UPLOAD_DIR` precisa ser volume persistente com backup.
Nada de plataforma serverless com disco efêmero — `StorageService` isola essa troca.

**Não construir nada dos mockups** antes da triagem dele. São ~13 funções, e cada uma
construída "para ajudar" vira trabalho não pago.

**Nunca descontar trabalho atual contra promessa de fase futura.** A visão do Produto
Vivo (McDonald's, Zara, Nike) não vai acontecer como descrita; isso não é problema a
resolver, mas é motivo para cobrar cada bloco pelo próprio mérito.

---

## Histórico de mensagens

Todas em [docs/mensagens/](mensagens/), com o contexto e a intenção de cada uma:

| Arquivo | Assunto |
|---|---|
| `2026-08-08-inicio-dia-zero.md` | Confirmação dos metadados e início |
| `2026-08-08-prazo-e-inicio.md` | Resposta a "quando pode me entregar", antecipação para 17/08 |
| `2026-08-10-entrega-1-e-2.md` | Entrega das duas fases, acesso ao ambiente de teste |
| `2026-08-11-orcamento-tres-blocos.md` | Orçamento separado dos três blocos novos |
| `2026-08-11-resposta-my-post-e-mockups.md` | Resposta objetiva sobre My Post + leitura dos mockups |
| `2026-08-11-troca-jornada-por-playlist.md` | Troca das duas áreas pela playlist; correção do orçamento |
| `2026-08-12-resposta-escopo-my-post.md` | **Acordo de escopo**: foto concedida, playlist mantida à parte |
| `2026-08-12-foto-entregue.md` | Entrega da foto com moderação |
| `2026-08-12-quem-pode-publicar.md` | **Barreira na entrada em vez de fila manual** — o que foi aceito e o que foi contestado |
| `2026-08-12-sem-aprovacao-previa.md` | **Decisão dele: sem revisão manual.** Aceite, chave no painel, e os três buracos do desenho |
