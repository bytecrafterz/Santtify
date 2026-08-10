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
| Suites de verificação | 3 (atribuição, social, propagação) — todas passando |

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
